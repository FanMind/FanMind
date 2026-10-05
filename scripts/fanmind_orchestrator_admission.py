#!/usr/bin/env python3
"""Fail-closed FanMind Orchestrator handoff admission and closeout checks."""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Callable

import fanmind_next_best_action as selector


ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
RECEIPT_PATH = PM / "ORCHESTRATOR_RESULT.json"
TERMINAL_RESULTS = {"COMPLETED", "BLOCKED", "FAILED", "NO_CHANGE"}
SENDABLE_HANDOFF_STATE = "PREPARED"
AGENT_CONTEXT = "FanMind Builder"


class AdmissionError(ValueError):
    pass


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise AdmissionError(f"unreadable_json:{path}:{exc}") from exc
    if not isinstance(value, dict):
        raise AdmissionError(f"json_object_required:{path}")
    return value


def _required_text(value: Any, name: str) -> str:
    if not isinstance(value, str) or not value.strip():
        raise AdmissionError(f"missing_or_invalid:{name}")
    return value.strip()


def _required_string_list(value: Any, name: str) -> list[str]:
    if (
        not isinstance(value, list)
        or not value
        or any(not isinstance(item, str) or not item.strip() for item in value)
    ):
        raise AdmissionError(f"missing_or_invalid:{name}")
    return [item.strip() for item in value]


def canonical_task_envelope(handoff: dict[str, Any]) -> dict[str, Any]:
    task_id = _required_text(handoff.get("task_id"), "handoff.task_id")
    source = _required_text(handoff.get("source"), "handoff.source")
    if source not in {"CATALOG", "OWNER_DIRECT"}:
        raise AdmissionError("invalid:handoff.source")
    scope = handoff.get("scope")
    if not isinstance(scope, dict) or not any(scope.values()):
        raise AdmissionError("missing_or_invalid:handoff.scope")
    for key, values in scope.items():
        _required_string_list(values, f"handoff.scope.{key}")
    envelope = {
        "agent_context": AGENT_CONTEXT,
        "task_id": task_id,
        "handoff_id": _required_text(handoff.get("handoff_id"), "handoff.handoff_id"),
        "source": source,
        "goal": _required_text(handoff.get("goal"), "handoff.goal"),
        "scope": scope,
        "acceptance": _required_string_list(handoff.get("acceptance"), "handoff.acceptance"),
        "risk": _required_text(handoff.get("risk"), "handoff.risk"),
        "forbidden": _required_string_list(handoff.get("forbidden"), "handoff.forbidden"),
        "previous_task_id": _required_text(
            handoff.get("previous_task_id"), "handoff.previous_task_id"
        ),
        "prepared_main_sha": _required_text(
            handoff.get("prepared_main_sha"), "handoff.prepared_main_sha"
        ),
    }
    return envelope


def render_builder_input(envelope: dict[str, Any]) -> str:
    canonical = json.dumps(envelope, sort_keys=True, separators=(",", ":"), ensure_ascii=True)
    return (
        "FanMind Orchestrator task envelope. Execute exactly this single envelope; "
        "do not select substitute work. Verify the envelope digest before acting.\n"
        f"{canonical}\n"
    )


def envelope_digest(envelope: dict[str, Any]) -> str:
    return hashlib.sha256(render_builder_input(envelope).encode("utf-8")).hexdigest()


def verify_envelope_binding(
    handoff: dict[str, Any], *, composer_input: str | None = None
) -> tuple[dict[str, Any], str, str]:
    envelope = canonical_task_envelope(handoff)
    builder_input = render_builder_input(envelope)
    digest = envelope_digest(envelope)
    recorded = _required_text(handoff.get("payload_sha256"), "handoff.payload_sha256")
    if recorded != digest:
        raise AdmissionError("handoff_payload_digest_mismatch")
    if composer_input is not None and composer_input != builder_input:
        raise AdmissionError("composer_content_mismatch")
    return envelope, builder_input, digest


def validate_typed_receipt(receipt: dict[str, Any]) -> None:
    if receipt.get("schema_version") != 2:
        raise AdmissionError("typed_receipt_v2_required")
    _required_text(receipt.get("task_id"), "receipt.task_id")
    _required_text(receipt.get("handoff_id"), "receipt.handoff_id")
    _required_text(receipt.get("payload_sha256"), "receipt.payload_sha256")
    status = _required_text(receipt.get("status"), "receipt.status")
    if status not in TERMINAL_RESULTS:
        raise AdmissionError("receipt_not_terminal")
    _required_text(receipt.get("summary"), "receipt.summary")
    _required_string_list(receipt.get("evidence"), "receipt.evidence")
    _required_text(receipt.get("completed_at"), "receipt.completed_at")
    _required_text(receipt.get("main_sha"), "receipt.main_sha")
    if status in {"BLOCKED", "FAILED"}:
        _required_text(receipt.get("blocker"), "receipt.blocker")
        _required_text(receipt.get("resume_condition"), "receipt.resume_condition")
    if status == "COMPLETED":
        source = receipt.get("source_acceptance")
        if not isinstance(source, dict) or source.get("kind") != "pull_request":
            raise AdmissionError("completed_receipt_pr_acceptance_required")
        if not isinstance(source.get("pr_number"), int) or source["pr_number"] < 1:
            raise AdmissionError("invalid:receipt.source_acceptance.pr_number")
        _required_text(source.get("head_sha"), "receipt.source_acceptance.head_sha")
        _required_text(source.get("merge_sha"), "receipt.source_acceptance.merge_sha")
        _required_string_list(
            source.get("required_checks"), "receipt.source_acceptance.required_checks"
        )
        runtime = receipt.get("runtime_evidence")
        if not isinstance(runtime, dict) or not isinstance(runtime.get("required"), bool):
            raise AdmissionError("typed_runtime_evidence_required")


def _check_github_truth(
    handoff: dict[str, Any], receipt: dict[str, Any], truth: dict[str, Any]
) -> None:
    observed_main = _required_text(truth.get("observed_main_sha"), "truth.observed_main_sha")
    if observed_main != handoff.get("prepared_main_sha"):
        raise AdmissionError("handoff_main_is_stale")
    if truth.get("main_readable") is not True:
        raise AdmissionError("github_main_unreadable")
    if truth.get("receipt_main_reachable") is not True:
        raise AdmissionError("receipt_main_not_reachable")
    if truth.get("previous_handoff_matches") is not True:
        raise AdmissionError("previous_handoff_identity_missing_or_mismatched")
    if receipt["status"] == "COMPLETED":
        source = receipt["source_acceptance"]
        pr = truth.get("previous_pr")
        if not isinstance(pr, dict):
            raise AdmissionError("github_pr_evidence_missing")
        expected = {
            "number": source["pr_number"],
            "head_sha": source["head_sha"],
            "merge_sha": source["merge_sha"],
            "merged": True,
        }
        for key, value in expected.items():
            if pr.get(key) != value:
                raise AdmissionError(f"github_pr_evidence_mismatch:{key}")
        checks = truth.get("checks")
        if not isinstance(checks, dict):
            raise AdmissionError("github_check_evidence_missing")
        for name in source["required_checks"]:
            if checks.get(name) != "success":
                raise AdmissionError(f"required_check_not_success:{name}")
    duplicates = truth.get("matching_dispatches")
    if not isinstance(duplicates, list):
        raise AdmissionError("github_dispatch_evidence_missing")
    if duplicates:
        raise AdmissionError("duplicate_dispatch_same_state")


def _selector_inputs() -> tuple[dict, dict, set[str], set[str], list[dict], set[str]]:
    state = selector.load_json(selector.STATE_PATH)
    catalog = selector.load_json(selector.CATALOG_PATH)
    deferred_text = (
        selector.DEFERRED_PATH.read_text(encoding="utf-8")
        if selector.DEFERRED_PATH.exists()
        else ""
    )
    started_text = (
        selector.STARTED_WORK_PATH.read_text(encoding="utf-8")
        if selector.STARTED_WORK_PATH.exists()
        else ""
    )
    locks_text = (
        selector.WORK_LOCKS_PATH.read_text(encoding="utf-8")
        if selector.WORK_LOCKS_PATH.exists()
        else ""
    )
    failed_text = (
        selector.FAILED_ATTEMPTS_PATH.read_text(encoding="utf-8")
        if selector.FAILED_ATTEMPTS_PATH.exists()
        else ""
    )
    deferred = selector.deferred_owner_ids(deferred_text)
    active_tasks = selector.active_task_ids(started_text, locks_text)
    active_slots = selector.active_work_slots(started_text, locks_text)
    failed = selector.persisted_failed_action_ids(failed_text, catalog, state)
    return state, catalog, deferred, active_tasks, active_slots, failed


def _check_selection(handoff: dict[str, Any], selector_decision: dict[str, Any]) -> None:
    source = handoff["source"]
    if source == "CATALOG":
        action_id = _required_text(handoff.get("catalog_action_id"), "handoff.catalog_action_id")
        if selector_decision.get("executable") is not True:
            raise AdmissionError(f"selector_not_ready:{selector_decision.get('state')}")
        if selector_decision.get("action_id") != action_id:
            raise AdmissionError("selector_action_mismatch")
        if selector_decision.get("task") != handoff.get("roadmap_task"):
            raise AdmissionError("selector_task_mismatch")
        if selector_decision.get("safe_ready_set") != [action_id]:
            raise AdmissionError("selector_not_exactly_one")
    else:
        if handoff.get("catalog_action_id") is not None:
            raise AdmissionError("owner_direct_must_not_claim_catalog_action")
        _required_text(handoff.get("owner_authorized_at"), "handoff.owner_authorized_at")
        if handoff.get("selection_basis") != "EXPLICIT_OWNER_TASK":
            raise AdmissionError("owner_direct_selection_basis_required")


def evaluate_admission(
    handoff: dict[str, Any],
    receipt: dict[str, Any],
    github_truth: dict[str, Any],
    selector_decision: dict[str, Any],
    *,
    requested_task_id: str,
    requested_handoff_id: str | None = None,
    requested_previous_task_id: str | None = None,
    composer_input: str | None = None,
    requested_payload_sha256: str | None = None,
) -> dict[str, Any]:
    try:
        if handoff.get("schema_version") != 1:
            raise AdmissionError("unsupported_handoff_schema")
        if handoff.get("state") != SENDABLE_HANDOFF_STATE:
            raise AdmissionError(f"handoff_not_sendable:{handoff.get('state')}")
        if _required_text(requested_task_id, "requested_task_id") != handoff.get("task_id"):
            raise AdmissionError("requested_task_id_mismatch")
        if requested_handoff_id is not None and requested_handoff_id != handoff.get("handoff_id"):
            raise AdmissionError("requested_handoff_id_mismatch")
        if (
            requested_previous_task_id is not None
            and requested_previous_task_id != handoff.get("previous_task_id")
        ):
            raise AdmissionError("requested_previous_task_id_mismatch")
        envelope, builder_input, digest = verify_envelope_binding(
            handoff, composer_input=composer_input
        )
        if requested_payload_sha256 is not None and requested_payload_sha256 != digest:
            raise AdmissionError("requested_payload_digest_mismatch")
        validate_typed_receipt(receipt)
        if handoff.get("previous_task_id") != receipt.get("task_id"):
            raise AdmissionError("previous_task_id_receipt_mismatch")
        if receipt["status"] != "COMPLETED":
            raise AdmissionError(f"previous_result_not_completed:{receipt['status']}")
        _check_github_truth(handoff, receipt, github_truth)
        _check_selection(handoff, selector_decision)
        return {
            "decision": "SEND",
            "task_id": handoff["task_id"],
            "handoff_id": handoff["handoff_id"],
            "payload_sha256": digest,
            "builder_input": builder_input,
            "blocker": "",
            "resume_condition": "",
        }
    except AdmissionError as exc:
        return {
            "decision": "BLOCK",
            "task_id": handoff.get("task_id"),
            "handoff_id": handoff.get("handoff_id"),
            "payload_sha256": handoff.get("payload_sha256"),
            "builder_input": "",
            "blocker": str(exc),
            "resume_condition": "Reconcile the named evidence or envelope mismatch, then prepare a new main-bound handoff.",
        }


def evaluate_closeout(
    handoff: dict[str, Any], receipt: dict[str, Any], github_truth: dict[str, Any]
) -> dict[str, Any]:
    try:
        validate_typed_receipt(receipt)
        if receipt.get("task_id") != handoff.get("task_id"):
            raise AdmissionError("closeout_task_id_mismatch")
        if github_truth.get("main_readable") is not True:
            raise AdmissionError("github_main_unreadable")
        if github_truth.get("receipt_main_reachable") is not True:
            raise AdmissionError("receipt_main_not_reachable")
        if receipt.get("status") == "COMPLETED":
            closeout_truth = dict(github_truth)
            closeout_truth["observed_main_sha"] = handoff.get("prepared_main_sha")
            closeout_truth["matching_dispatches"] = []
            _check_github_truth(handoff, receipt, closeout_truth)
        return {
            "decision": "TERMINAL",
            "task_id": receipt["task_id"],
            "status": receipt["status"],
            "summary": receipt["summary"],
        }
    except AdmissionError as exc:
        return {"decision": "WAIT", "blocker": str(exc)}


def dispatch_if_admitted(
    decision: dict[str, Any], send: Callable[[str], dict[str, Any]]
) -> dict[str, Any]:
    if decision.get("decision") != "SEND":
        return {"sent": 0, "decision": decision}
    response = send(_required_text(decision.get("builder_input"), "decision.builder_input"))
    return {"sent": 1, "decision": decision, "response": response}


class GitHubClient:
    def __init__(self, repository: str, token: str = ""):
        self.repository = repository
        self.token = token

    def get(self, path: str) -> Any:
        headers = {
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "fanmind-orchestrator-admission",
        }
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        request = urllib.request.Request(
            f"https://api.github.com/repos/{self.repository}/{path.lstrip('/')}",
            headers=headers,
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except (urllib.error.URLError, json.JSONDecodeError) as exc:
            raise AdmissionError(f"github_read_failed:{path}:{exc}") from exc

    def file_json(self, path: str, ref: str = "main") -> dict[str, Any]:
        value = self.get(f"contents/{path}?ref={ref}")
        try:
            raw = base64.b64decode(value["content"], validate=False)
            parsed = json.loads(raw.decode("utf-8"))
        except (KeyError, ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise AdmissionError(f"github_file_unreadable:{path}:{exc}") from exc
        if not isinstance(parsed, dict):
            raise AdmissionError(f"github_file_not_object:{path}")
        return parsed


def collect_github_truth(
    client: GitHubClient,
    handoff: dict[str, Any],
    receipt: dict[str, Any],
    *,
    current_run_id: str = "",
) -> dict[str, Any]:
    main = client.get("commits/main")
    observed_main = _required_text(main.get("sha"), "github.main.sha")
    compare = client.get(f"compare/{receipt.get('main_sha')}...{observed_main}")
    reachable = compare.get("status") in {"ahead", "identical"}
    truth: dict[str, Any] = {
        "observed_main_sha": observed_main,
        "main_readable": True,
        "receipt_main_reachable": reachable,
        "previous_pr": None,
        "checks": {},
        "matching_dispatches": [],
        "previous_handoff_matches": False,
        "previous_handoff_source": "",
    }
    source = receipt.get("source_acceptance")
    if receipt.get("status") == "COMPLETED" and isinstance(source, dict):
        pr = client.get(f"pulls/{source.get('pr_number')}")
        truth["previous_pr"] = {
            "number": pr.get("number"),
            "head_sha": (pr.get("head") or {}).get("sha"),
            "merge_sha": pr.get("merge_commit_sha"),
            "merged": bool(pr.get("merged_at")),
        }
        check_runs = client.get(f"commits/{source.get('head_sha')}/check-runs?per_page=100")
        truth["checks"] = {
            item.get("name"): item.get("conclusion")
            for item in check_runs.get("check_runs", [])
            if isinstance(item, dict) and item.get("name")
        }
    runs = client.get(
        "actions/workflows/fanmind-manager-event-dispatch.yml/runs?event=workflow_dispatch&per_page=100"
    )
    current_marker = (
        f"Orchestrator handoff {handoff.get('handoff_id')} task "
        f"{handoff.get('task_id')} digest {handoff.get('payload_sha256')}"
    )
    run_pattern = re.compile(
        r"^Orchestrator handoff (?P<handoff>\S+) task (?P<task>\S+) digest (?P<digest>[0-9a-f]{64})$"
    )
    prior_runs = sorted(
        (
            run
            for run in runs.get("workflow_runs", [])
            if str(run.get("id")) != current_run_id
        ),
        key=lambda run: (
            str(run.get("run_started_at") or run.get("created_at") or ""),
            int(run.get("id") or 0),
        ),
        reverse=True,
    )
    structured_runs = []
    for run in prior_runs:
        title = str(run.get("display_title") or run.get("name") or "")
        match = run_pattern.fullmatch(title)
        if match:
            structured_runs.append((run, match.groupdict()))
    if structured_runs:
        latest_run, identity = structured_runs[0]
        truth["latest_previous_handoff"] = {
            **identity,
            "run_id": str(latest_run.get("id")),
            "status": latest_run.get("status"),
            "conclusion": latest_run.get("conclusion"),
        }
        truth["previous_handoff_matches"] = (
            identity["handoff"] == receipt.get("handoff_id")
            and identity["task"] == receipt.get("task_id")
            and identity["task"] == handoff.get("previous_task_id")
            and identity["digest"] == receipt.get("payload_sha256")
        )
        truth["previous_handoff_source"] = "latest_workflow_run"
    else:
        started = selector.STARTED_WORK_PATH.read_text(encoding="utf-8")
        bootstrap_markers = (
            f"- Orchestrator handoff: {receipt.get('handoff_id')}",
            f"- Orchestrator task_id: {receipt.get('task_id')}",
            f"- Payload digest: {receipt.get('payload_sha256')}",
        )
        if all(item in started for item in bootstrap_markers):
            truth["previous_handoff_matches"] = True
            truth["previous_handoff_source"] = "started_work_bootstrap"
    truth["matching_dispatches"] = [
        {
            "id": str(run.get("id")),
            "status": run.get("status"),
            "conclusion": run.get("conclusion"),
        }
        for run in prior_runs
        if current_marker == str(run.get("display_title") or run.get("name") or "")
        and run.get("status") in {"queued", "in_progress", "completed"}
    ]
    return truth


def dispatch_with_github(
    handoff: dict[str, Any],
    receipt: dict[str, Any],
    selector_decision: dict[str, Any],
    client: GitHubClient,
    send: Callable[[str], dict[str, Any]],
    *,
    requested_task_id: str,
    requested_handoff_id: str,
    requested_previous_task_id: str,
    requested_payload_sha256: str,
    current_run_id: str = "",
) -> dict[str, Any]:
    truth = collect_github_truth(
        client, handoff, receipt, current_run_id=current_run_id
    )
    decision = evaluate_admission(
        handoff,
        receipt,
        truth,
        selector_decision,
        requested_task_id=requested_task_id,
        requested_handoff_id=requested_handoff_id,
        requested_previous_task_id=requested_previous_task_id,
        requested_payload_sha256=requested_payload_sha256,
    )
    return dispatch_if_admitted(decision, send)


def check_with_github(
    handoff: dict[str, Any],
    receipt: dict[str, Any],
    selector_decision: dict[str, Any],
    client: GitHubClient,
    *,
    requested_task_id: str,
    requested_handoff_id: str,
    requested_previous_task_id: str,
    requested_payload_sha256: str,
    composer_input: str,
    current_run_id: str = "",
) -> dict[str, Any]:
    truth = collect_github_truth(
        client, handoff, receipt, current_run_id=current_run_id
    )
    return evaluate_admission(
        handoff,
        receipt,
        truth,
        selector_decision,
        requested_task_id=requested_task_id,
        requested_handoff_id=requested_handoff_id,
        requested_previous_task_id=requested_previous_task_id,
        requested_payload_sha256=requested_payload_sha256,
        composer_input=composer_input,
    )


def send_builder(api_url: str, token: str, builder_input: str) -> dict[str, Any]:
    body = json.dumps({"input": builder_input}, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(
        api_url,
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            if response.status < 200 or response.status >= 300:
                raise AdmissionError(f"builder_transport_http:{response.status}")
            return json.load(response)
    except (urllib.error.URLError, json.JSONDecodeError) as exc:
        raise AdmissionError(f"builder_transport_failed:{exc}") from exc


def _current_selector_decision() -> dict[str, Any]:
    state, catalog, deferred, active_tasks, active_slots, failed = _selector_inputs()
    return selector.dispatch_decision(
        state,
        catalog,
        deferred,
        failed_action_ids=failed,
        active_tasks=active_tasks,
        active_slots=active_slots,
    )


def _local_head() -> str:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError) as exc:
        raise AdmissionError("local_checked_out_head_unavailable") from exc


def _write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    prepare = sub.add_parser("prepare")
    prepare.add_argument("--handoff", type=Path, required=True)
    prepare.add_argument("--composer-output", type=Path)

    check = sub.add_parser("check")
    check.add_argument("--handoff", type=Path, required=True)
    check.add_argument("--receipt", type=Path, default=RECEIPT_PATH)
    check.add_argument("--repository", required=True)
    check.add_argument("--task-id", required=True)
    check.add_argument("--handoff-id", required=True)
    check.add_argument("--previous-task-id", required=True)
    check.add_argument("--payload-sha256", required=True)
    check.add_argument("--composer-input", type=Path, required=True)
    check.add_argument("--current-run-id", default="")

    dispatch = sub.add_parser("dispatch")
    dispatch.add_argument("--handoff", type=Path, required=True)
    dispatch.add_argument("--receipt", type=Path, default=RECEIPT_PATH)
    dispatch.add_argument("--task-id", required=True)
    dispatch.add_argument("--handoff-id", required=True)
    dispatch.add_argument("--previous-task-id", required=True)
    dispatch.add_argument("--payload-sha256", required=True)
    dispatch.add_argument("--repository", required=True)
    dispatch.add_argument("--agent-trigger-id", required=True)
    dispatch.add_argument("--agent-token", required=True)
    dispatch.add_argument("--current-run-id", default="")

    closeout = sub.add_parser("await-closeout")
    closeout.add_argument("--handoff", type=Path, required=True)
    closeout.add_argument("--repository", required=True)
    closeout.add_argument("--timeout-seconds", type=int, default=21000)
    closeout.add_argument("--poll-seconds", type=int, default=600)

    args = parser.parse_args()
    handoff = _read_json(args.handoff)
    if args.command == "prepare":
        envelope = canonical_task_envelope(handoff)
        rendered = render_builder_input(envelope)
        digest = envelope_digest(envelope)
        handoff["payload_sha256"] = digest
        _write_json(args.handoff, handoff)
        if args.composer_output:
            args.composer_output.write_text(rendered, encoding="utf-8")
        encoded = base64.b64encode(args.handoff.read_bytes()).decode("ascii")
        print(json.dumps({"prepared": True, "payload_sha256": digest, "handoff_base64": encoded}))
        return 0

    if args.command == "await-closeout":
        client = GitHubClient(args.repository)
        deadline = time.monotonic() + args.timeout_seconds
        while time.monotonic() < deadline:
            try:
                current_receipt = client.file_json(
                    "project-memory/ORCHESTRATOR_RESULT.json"
                )
                if current_receipt.get("task_id") != handoff.get("task_id"):
                    result = {"decision": "WAIT", "blocker": "closeout_task_id_mismatch"}
                    print(json.dumps(result, sort_keys=True), flush=True)
                    time.sleep(args.poll_seconds)
                    continue
                truth = collect_github_truth(client, handoff, current_receipt)
                result = evaluate_closeout(handoff, current_receipt, truth)
                if result["decision"] == "TERMINAL":
                    print(json.dumps(result, sort_keys=True))
                    return 0
            except AdmissionError as exc:
                result = {"decision": "WAIT", "blocker": str(exc)}
            print(json.dumps(result, sort_keys=True), flush=True)
            time.sleep(args.poll_seconds)
        print(json.dumps({"decision": "BLOCK", "blocker": "closeout_timeout"}))
        return 1

    receipt = _read_json(args.receipt)
    selector_decision = _current_selector_decision()
    if args.command == "check":
        composer = args.composer_input.read_text(encoding="utf-8")
        decision = check_with_github(
            handoff,
            receipt,
            selector_decision,
            GitHubClient(args.repository),
            requested_task_id=args.task_id,
            requested_handoff_id=args.handoff_id,
            requested_previous_task_id=args.previous_task_id,
            requested_payload_sha256=args.payload_sha256,
            composer_input=composer,
            current_run_id=args.current_run_id,
        )
        print(json.dumps(decision, sort_keys=True))
        return 0 if decision["decision"] == "SEND" else 1

    if _local_head() != handoff.get("prepared_main_sha"):
        print(json.dumps({"decision": "BLOCK", "blocker": "local_head_not_prepared_main"}))
        return 1
    client = GitHubClient(args.repository)
    result = dispatch_with_github(
        handoff,
        receipt,
        selector_decision,
        client,
        lambda payload: send_builder(
            f"https://api.chatgpt.com/v1/workspace_agents/{args.agent_trigger_id}/trigger",
            args.agent_token,
            payload,
        ),
        requested_task_id=args.task_id,
        requested_handoff_id=args.handoff_id,
        requested_previous_task_id=args.previous_task_id,
        requested_payload_sha256=args.payload_sha256,
        current_run_id=args.current_run_id,
    )
    printable = dict(result)
    printable["decision"] = dict(result["decision"])
    printable["decision"].pop("builder_input", None)
    print(json.dumps(printable, sort_keys=True))
    return 0 if result["sent"] == 1 else 1


if __name__ == "__main__":
    raise SystemExit(main())

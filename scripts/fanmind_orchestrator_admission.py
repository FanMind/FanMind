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
IDENTITY_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
LEGACY_WORKFLOW_RUN_BOUNDARY = 37234276748
RUNTIME_CLI_EVIDENCE_KIND = "authorized_cli_test"
RUNTIME_CLI_COMMAND = (
    "python3 -m unittest -v tests/test_fanmind_orchestrator_admission.py && "
    "node --test tests/fanmind-manager-event-dispatch.test.mjs"
)
OWNER_AUTHORIZATION_KIND = "github_issue_comment_v1"
OWNER_AUTHORIZATION_PREFIX = "FanMind OWNER_DIRECT authorization v1\n"
OWNER_GITHUB_LOGIN = "Bernds-tech"
LEGACY_OWNER_RECEIPT_IDENTITY = (
    "fanmind-orchestrator-method-20261005-01",
    "owner-fanmind-orchestrator-method-20261005-01",
    "eb7b0f9ce7455f874ba235b5a229f529d3e63301c9bc39116cb74b7857b6c2b2",
)


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


def _required_identity(value: Any, name: str) -> str:
    text = _required_text(value, name)
    if not IDENTITY_PATTERN.fullmatch(text):
        raise AdmissionError(f"invalid_identity:{name}")
    return text


def canonical_task_envelope(
    handoff: dict[str, Any], *, allow_legacy_owner_binding: bool = False
) -> dict[str, Any]:
    if handoff.get("agent_context") != AGENT_CONTEXT:
        raise AdmissionError("agent_context_mismatch")
    task_id = _required_identity(handoff.get("task_id"), "handoff.task_id")
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
        "handoff_id": _required_identity(handoff.get("handoff_id"), "handoff.handoff_id"),
        "source": source,
        "goal": _required_text(handoff.get("goal"), "handoff.goal"),
        "scope": scope,
        "acceptance": _required_string_list(handoff.get("acceptance"), "handoff.acceptance"),
        "risk": _required_text(handoff.get("risk"), "handoff.risk"),
        "required_checks": _required_string_list(
            handoff.get("required_checks"), "handoff.required_checks"
        ),
        "forbidden": _required_string_list(handoff.get("forbidden"), "handoff.forbidden"),
        "previous_task_id": _required_identity(
            handoff.get("previous_task_id"), "handoff.previous_task_id"
        ),
        "prepared_main_sha": _required_text(
            handoff.get("prepared_main_sha"), "handoff.prepared_main_sha"
        ),
        "previous_result_disposition": _required_text(
            handoff.get("previous_result_disposition"),
            "handoff.previous_result_disposition",
        ),
    }
    runtime = handoff.get("runtime_requirement")
    if not isinstance(runtime, dict) or not isinstance(runtime.get("required"), bool):
        raise AdmissionError("missing_or_invalid:handoff.runtime_requirement")
    envelope["runtime_requirement"] = {"required": runtime["required"]}
    if runtime["required"]:
        if runtime.get("evidence_kind") != RUNTIME_CLI_EVIDENCE_KIND:
            raise AdmissionError("unsupported:handoff.runtime_requirement.evidence_kind")
        if runtime.get("command") != RUNTIME_CLI_COMMAND:
            raise AdmissionError("invalid:handoff.runtime_requirement.command")
        envelope["runtime_requirement"]["evidence_kind"] = RUNTIME_CLI_EVIDENCE_KIND
        envelope["runtime_requirement"]["command"] = RUNTIME_CLI_COMMAND
        if runtime.get("release_binding") != "source_merge":
            raise AdmissionError("invalid:handoff.runtime_requirement.release_binding")
        envelope["runtime_requirement"]["release_binding"] = "source_merge"
    if source == "CATALOG":
        envelope["catalog_action_id"] = _required_text(
            handoff.get("catalog_action_id"), "handoff.catalog_action_id"
        )
        envelope["roadmap_task"] = _required_text(
            handoff.get("roadmap_task"), "handoff.roadmap_task"
        )
        envelope["catalog_contract_sha256"] = _required_text(
            handoff.get("catalog_contract_sha256"),
            "handoff.catalog_contract_sha256",
        )
    else:
        envelope["selection_basis"] = _required_text(
            handoff.get("selection_basis"), "handoff.selection_basis"
        )
        envelope["owner_authorized_at"] = _required_text(
            handoff.get("owner_authorized_at"), "handoff.owner_authorized_at"
        )
        locks = handoff.get("non_overlapping_active_locks")
        if not isinstance(locks, list) or any(
            not isinstance(item, str) or not item.startswith("LOCK-") for item in locks
        ):
            raise AdmissionError("missing_or_invalid:handoff.non_overlapping_active_locks")
        if len(set(locks)) != len(locks):
            raise AdmissionError("duplicate:handoff.non_overlapping_active_locks")
        envelope["non_overlapping_active_locks"] = sorted(locks)
        authorization = handoff.get("owner_authorization")
        if authorization is None and allow_legacy_owner_binding:
            authorization = None
        elif not isinstance(authorization, dict):
            raise AdmissionError("missing_or_invalid:handoff.owner_authorization")
        if authorization is None:
            pass
        elif authorization.get("kind") != OWNER_AUTHORIZATION_KIND:
            raise AdmissionError("invalid:handoff.owner_authorization.kind")
        else:
            issue_number = authorization.get("issue_number")
            comment_id = authorization.get("comment_id")
            body_sha256 = authorization.get("body_sha256")
            if type(issue_number) is not int or issue_number < 1:
                raise AdmissionError("invalid:handoff.owner_authorization.issue_number")
            if type(comment_id) is not int or comment_id < 1:
                raise AdmissionError("invalid:handoff.owner_authorization.comment_id")
            if not isinstance(body_sha256, str) or not re.fullmatch(
                r"[0-9a-f]{64}", body_sha256
            ):
                raise AdmissionError("invalid:handoff.owner_authorization.body_sha256")
            envelope["owner_authorization"] = {
                "kind": OWNER_AUTHORIZATION_KIND,
                "issue_number": issue_number,
                "comment_id": comment_id,
                "body_sha256": body_sha256,
                "updated_at": _required_text(
                    authorization.get("updated_at"),
                    "handoff.owner_authorization.updated_at",
                ),
            }
    semantic_identity = {
        "goal": envelope["goal"],
        "scope": envelope["scope"],
        "acceptance": envelope["acceptance"],
    }
    envelope["work_identity_sha256"] = hashlib.sha256(
        json.dumps(
            semantic_identity,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=True,
        ).encode("utf-8")
    ).hexdigest()
    if handoff.get("resume_evidence") is not None:
        envelope["resume_evidence"] = _required_string_list(
            handoff.get("resume_evidence"), "handoff.resume_evidence"
        )
    return envelope


def owner_authorization_contract(envelope: dict[str, Any]) -> dict[str, Any]:
    if envelope.get("source") != "OWNER_DIRECT":
        raise AdmissionError("owner_authorization_requires_owner_direct")
    excluded = {"owner_authorized_at", "owner_authorization"}
    return {key: value for key, value in envelope.items() if key not in excluded}


def render_owner_authorization(envelope: dict[str, Any]) -> str:
    contract = owner_authorization_contract(envelope)
    return OWNER_AUTHORIZATION_PREFIX + json.dumps(
        contract, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    )


def owner_authorization_template(handoff: dict[str, Any]) -> str:
    draft = dict(handoff)
    draft["owner_authorized_at"] = "PENDING_GITHUB_OWNER_COMMENT"
    draft["owner_authorization"] = {
        "kind": OWNER_AUTHORIZATION_KIND,
        "issue_number": 1,
        "comment_id": 1,
        "body_sha256": "0" * 64,
        "updated_at": "PENDING_GITHUB_OWNER_COMMENT",
    }
    return render_owner_authorization(canonical_task_envelope(draft))


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
    accepted = receipt.get("accepted_handoff")
    if not isinstance(accepted, dict):
        raise AdmissionError("typed_receipt_accepted_handoff_required")
    identity = (
        receipt.get("task_id"),
        receipt.get("handoff_id"),
        receipt.get("payload_sha256"),
    )
    accepted_envelope = canonical_task_envelope(
        accepted,
        allow_legacy_owner_binding=identity == LEGACY_OWNER_RECEIPT_IDENTITY,
    )
    if accepted_envelope.get("task_id") != receipt.get("task_id"):
        raise AdmissionError("receipt_accepted_handoff_task_mismatch")
    if accepted_envelope.get("handoff_id") != receipt.get("handoff_id"):
        raise AdmissionError("receipt_accepted_handoff_identity_mismatch")
    if envelope_digest(accepted_envelope) != receipt.get("payload_sha256"):
        raise AdmissionError("receipt_accepted_handoff_digest_mismatch")
    if status in {"BLOCKED", "FAILED", "NO_CHANGE"}:
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


def _accepted_handoff(receipt: dict[str, Any]) -> dict[str, Any]:
    validate_typed_receipt(receipt)
    identity = (
        receipt.get("task_id"),
        receipt.get("handoff_id"),
        receipt.get("payload_sha256"),
    )
    return canonical_task_envelope(
        receipt["accepted_handoff"],
        allow_legacy_owner_binding=identity == LEGACY_OWNER_RECEIPT_IDENTITY,
    )


def _check_github_truth(
    handoff: dict[str, Any],
    receipt: dict[str, Any],
    truth: dict[str, Any],
    *,
    require_current_run: bool = True,
) -> None:
    previous_handoff = _accepted_handoff(receipt)
    observed_main = _required_text(truth.get("observed_main_sha"), "truth.observed_main_sha")
    if observed_main != handoff.get("prepared_main_sha"):
        raise AdmissionError("handoff_main_is_stale")
    if truth.get("main_readable") is not True:
        raise AdmissionError("github_main_unreadable")
    if truth.get("receipt_main_reachable") is not True:
        raise AdmissionError("receipt_main_not_reachable")
    if truth.get("previous_handoff_matches") is not True:
        raise AdmissionError("previous_handoff_identity_missing_or_mismatched")
    if truth.get("previous_handoff_source") == "latest_workflow_run":
        latest = truth.get("latest_previous_handoff")
        if not isinstance(latest, dict) or any(
            (
                latest.get("status") != "completed",
                latest.get("conclusion") != "success",
                latest.get("transport_state") != "TRANSPORT_ACCEPTED",
            )
        ):
            raise AdmissionError("previous_handoff_not_terminal_and_reconciled")
    if require_current_run:
        if truth.get("current_handoff_matches") is not True:
            raise AdmissionError("current_workflow_run_identity_missing_or_mismatched")
        if truth.get("current_run_attempt") != 1:
            raise AdmissionError("workflow_rerun_requires_reconciliation")
    _check_source_acceptance(previous_handoff, receipt, truth)
    duplicates = truth.get("matching_dispatches")
    if not isinstance(duplicates, list):
        raise AdmissionError("github_dispatch_evidence_missing")
    if duplicates:
        raise AdmissionError("duplicate_dispatch_same_state")


def _check_source_acceptance(
    handoff: dict[str, Any], receipt: dict[str, Any], truth: dict[str, Any]
) -> None:
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
            "base": "main",
        }
        for key, value in expected.items():
            if pr.get(key) != value:
                raise AdmissionError(f"github_pr_evidence_mismatch:{key}")
        if truth.get("source_merge_reachable") is not True:
            raise AdmissionError("source_merge_not_reachable_from_main")
        expected_checks = handoff.get("required_checks")
        if source.get("required_checks") != expected_checks:
            raise AdmissionError("receipt_required_checks_mismatch_task_contract")
        checks = truth.get("workflow_checks")
        if not isinstance(checks, dict):
            raise AdmissionError("github_workflow_check_evidence_missing")
        for name in expected_checks:
            if checks.get(name) != "success":
                raise AdmissionError(f"required_check_not_success:{name}")
        requirement = handoff.get("runtime_requirement")
        runtime = receipt.get("runtime_evidence")
        if requirement.get("required") is False:
            if runtime != {"required": False, "status": "NOT_REQUIRED"}:
                raise AdmissionError("runtime_evidence_must_be_not_required")
        else:
            if runtime.get("required") is not True or runtime.get("status") != "VERIFIED":
                raise AdmissionError("required_runtime_evidence_not_verified")
            runtime_expected = {
                "required": True,
                "status": "VERIFIED",
                "evidence_kind": RUNTIME_CLI_EVIDENCE_KIND,
                "command": RUNTIME_CLI_COMMAND,
                "source_merge_sha": source.get("merge_sha"),
                "local_head_sha": source.get("merge_sha"),
                "task_id": handoff.get("task_id"),
                "handoff_id": handoff.get("handoff_id"),
                "payload_sha256": receipt.get("payload_sha256"),
            }
            for key, value in runtime_expected.items():
                if runtime.get(key) != value:
                    raise AdmissionError(f"runtime_cli_evidence_mismatch:{key}")
            log_sha = runtime.get("log_sha256")
            if not isinstance(log_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", log_sha):
                raise AdmissionError("runtime_cli_evidence_log_digest_invalid")
            _required_text(runtime.get("checked_at"), "receipt.runtime_evidence.checked_at")


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


def _blocks(text: str) -> list[str]:
    return re.split(r"(?m)^## ", text)[1:]


def _owner_direct_binding(
    handoff: dict[str, Any], client: "GitHubClient", locks_text: str
) -> dict[str, Any]:
    envelope = canonical_task_envelope(handoff)
    authorization = envelope["owner_authorization"]
    comment = client.get(f"issues/comments/{authorization['comment_id']}")
    if not isinstance(comment, dict):
        return {"authorized": False, "reason": "owner_authorization_comment_unreadable"}
    issue_suffix = f"/issues/{authorization['issue_number']}"
    if (
        comment.get("id") != authorization["comment_id"]
        or not str(comment.get("issue_url") or "").endswith(issue_suffix)
    ):
        return {
            "authorized": False,
            "reason": "owner_authorization_comment_identity_mismatch",
        }
    user = comment.get("user")
    if not isinstance(user, dict) or user.get("login") != OWNER_GITHUB_LOGIN:
        return {"authorized": False, "reason": "owner_authorization_login_mismatch"}
    if comment.get("author_association") not in {"MEMBER", "OWNER"}:
        return {"authorized": False, "reason": "owner_authorization_not_repository_owner"}
    body = comment.get("body")
    created_at = comment.get("created_at")
    updated_at = comment.get("updated_at")
    if (
        not isinstance(body, str)
        or not isinstance(created_at, str)
        or not isinstance(updated_at, str)
    ):
        return {"authorized": False, "reason": "owner_authorization_comment_unreadable"}
    if (
        created_at != envelope.get("owner_authorized_at")
        or updated_at != authorization["updated_at"]
    ):
        return {"authorized": False, "reason": "owner_authorization_timestamp_mismatch"}
    if (
        hashlib.sha256(body.encode("utf-8")).hexdigest()
        != authorization["body_sha256"]
    ):
        return {"authorized": False, "reason": "owner_authorization_body_digest_mismatch"}
    if body != render_owner_authorization(envelope):
        return {"authorized": False, "reason": "owner_authorization_contract_mismatch"}
    lock_blocks = {
        block.splitlines()[0].strip(): block
        for block in _blocks(locks_text)
        if block.splitlines() and block.splitlines()[0].strip().startswith("LOCK-")
    }
    active_locks = {
        lock_id
        for lock_id, block in lock_blocks.items()
        if "- Status: ACTIVE" in block
    }
    declared = set(handoff.get("non_overlapping_active_locks") or [])
    if declared != active_locks:
        return {"authorized": False, "reason": "owner_active_lock_conflict_or_stale_parallel_proof"}
    return {
        "authorized": True,
        "reason": "",
        "owner_login": OWNER_GITHUB_LOGIN,
        "comment_id": authorization["comment_id"],
    }


def _check_selection(
    handoff: dict[str, Any],
    selector_decision: dict[str, Any],
    owner_binding: dict[str, Any] | None = None,
) -> None:
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
        task_contract = selector_decision.get("task_contract")
        if not isinstance(task_contract, dict):
            raise AdmissionError("catalog_dispatch_contract_missing")
        expected_contract = {
            "goal": handoff.get("goal"),
            "scope": handoff.get("scope"),
            "acceptance": handoff.get("acceptance"),
            "required_checks": handoff.get("required_checks"),
            "runtime_requirement": handoff.get("runtime_requirement"),
        }
        if handoff.get("resume_evidence") is not None:
            expected_contract["resume_evidence"] = handoff.get("resume_evidence")
        if task_contract != expected_contract:
            raise AdmissionError("catalog_dispatch_contract_mismatch")
        canonical = json.dumps(
            task_contract, sort_keys=True, separators=(",", ":"), ensure_ascii=True
        )
        expected_hash = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if handoff.get("catalog_contract_sha256") != expected_hash:
            raise AdmissionError("catalog_contract_digest_mismatch")
    else:
        if any(
            handoff.get(key) is not None
            for key in ("catalog_action_id", "roadmap_task", "catalog_contract_sha256")
        ):
            raise AdmissionError("owner_direct_must_not_claim_catalog_action")
        _required_text(handoff.get("owner_authorized_at"), "handoff.owner_authorized_at")
        if handoff.get("selection_basis") != "EXPLICIT_OWNER_TASK":
            raise AdmissionError("owner_direct_selection_basis_required")
        binding = owner_binding or {
            "authorized": False,
            "reason": "owner_authorization_evidence_missing",
        }
        if binding.get("authorized") is not True:
            raise AdmissionError(str(binding.get("reason") or "owner_direct_not_authorized"))


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
    owner_binding: dict[str, Any] | None = None,
    require_current_run: bool = True,
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
        previous_envelope = _accepted_handoff(receipt)
        if handoff.get("previous_task_id") != receipt.get("task_id"):
            raise AdmissionError("previous_task_id_receipt_mismatch")
        if handoff.get("task_id") == receipt.get("task_id"):
            raise AdmissionError("task_identity_already_terminal")
        same_work = (
            envelope.get("work_identity_sha256")
            == previous_envelope.get("work_identity_sha256")
        )
        if same_work and receipt["status"] == "COMPLETED":
            raise AdmissionError("work_identity_already_accepted")
        if same_work and receipt["status"] != "COMPLETED":
            current_resume = set(envelope.get("resume_evidence") or [])
            previous_resume = set(previous_envelope.get("resume_evidence") or [])
            if not current_resume:
                raise AdmissionError("same_work_resume_evidence_required")
            if not current_resume > previous_resume:
                raise AdmissionError("same_work_new_resume_evidence_required")
        disposition = handoff.get("previous_result_disposition")
        if receipt["status"] == "COMPLETED":
            if disposition != "ACCEPTED_COMPLETION":
                raise AdmissionError("completed_previous_result_not_accepted")
        else:
            if disposition != "RECONCILED_PARKED":
                raise AdmissionError(f"previous_result_not_reconciled:{receipt['status']}")
            latest = github_truth.get("latest_previous_handoff")
            if not isinstance(latest, dict) or any(
                (
                    latest.get("status") != "completed",
                    latest.get("conclusion") != "success",
                    latest.get("transport_state") != "TRANSPORT_ACCEPTED",
                )
            ):
                raise AdmissionError(f"previous_result_unresolved:{receipt['status']}")
        _check_github_truth(
            handoff,
            receipt,
            github_truth,
            require_current_run=require_current_run,
        )
        _check_selection(
            handoff,
            selector_decision,
            owner_binding or github_truth.get("owner_binding"),
        )
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
        if receipt.get("handoff_id") != handoff.get("handoff_id"):
            raise AdmissionError("closeout_handoff_id_mismatch")
        if receipt.get("payload_sha256") != handoff.get("payload_sha256"):
            raise AdmissionError("closeout_payload_digest_mismatch")
        if github_truth.get("current_handoff_matches") is not True:
            raise AdmissionError("current_workflow_run_identity_missing_or_mismatched")
        if github_truth.get("main_readable") is not True:
            raise AdmissionError("github_main_unreadable")
        if github_truth.get("receipt_main_reachable") is not True:
            raise AdmissionError("receipt_main_not_reachable")
        if receipt.get("status") == "COMPLETED":
            _check_source_acceptance(handoff, receipt, github_truth)
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

    def file_text(self, path: str, ref: str = "main") -> str:
        value = self.get(f"contents/{path}?ref={ref}")
        try:
            return base64.b64decode(value["content"], validate=False).decode("utf-8")
        except (KeyError, ValueError, UnicodeDecodeError) as exc:
            raise AdmissionError(f"github_file_unreadable:{path}:{exc}") from exc


def _complete_workflow_run_history(client: GitHubClient) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    expected_total: int | None = None
    for page in range(1, 11):
        value = client.get(
            "actions/workflows/fanmind-manager-event-dispatch.yml/runs"
            f"?event=workflow_dispatch&per_page=100&page={page}"
        )
        page_runs = value.get("workflow_runs") if isinstance(value, dict) else None
        total = value.get("total_count") if isinstance(value, dict) else None
        if not isinstance(page_runs, list) or not isinstance(total, int) or total < 0:
            raise AdmissionError("github_workflow_run_history_unreadable")
        if expected_total is None:
            expected_total = total
            if total > 1000:
                raise AdmissionError("github_workflow_run_history_unbounded")
        elif total != expected_total:
            raise AdmissionError("github_workflow_run_history_changed_during_read")
        if any(not isinstance(run, dict) for run in page_runs):
            raise AdmissionError("github_workflow_run_history_unreadable")
        collected.extend(page_runs)
        if len(page_runs) < 100:
            if len(collected) != expected_total:
                raise AdmissionError("github_workflow_run_history_incomplete")
            return collected
    raise AdmissionError("github_workflow_run_history_incomplete")


def _complete_run_jobs(
    client: GitHubClient, run_id: int, attempt: int
) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    expected_total: int | None = None
    for page in range(1, 11):
        value = client.get(
            f"actions/runs/{run_id}/attempts/{attempt}/jobs?per_page=100&page={page}"
        )
        entries = value.get("jobs") if isinstance(value, dict) else None
        total = value.get("total_count") if isinstance(value, dict) else None
        if not isinstance(entries, list) or not isinstance(total, int) or total < 0:
            raise AdmissionError("github_workflow_job_history_unreadable")
        if expected_total is None:
            expected_total = total
            if total > 1000:
                raise AdmissionError("github_workflow_job_history_unbounded")
        elif total != expected_total:
            raise AdmissionError("github_workflow_job_history_changed_during_read")
        if any(not isinstance(job, dict) for job in entries):
            raise AdmissionError("github_workflow_job_history_unreadable")
        collected.extend(entries)
        if len(entries) < 100:
            if len(collected) != expected_total:
                raise AdmissionError("github_workflow_job_history_incomplete")
            return collected
    raise AdmissionError("github_workflow_job_history_incomplete")


def _attempt_transport_state(entries: list[dict[str, Any]]) -> str:
    steps = [
        step
        for job in entries
        for step in job.get("steps", [])
        if isinstance(step, dict)
    ]
    admit = next((step for step in steps if step.get("name") == "Admit prepared handoff"), None)
    transport = next(
        (step for step in steps if step.get("name") == "Transport exactly one admitted handoff"),
        None,
    )
    if transport and transport.get("conclusion") == "skipped":
        if admit and admit.get("conclusion") == "success":
            return "TRANSPORT_UNRESOLVED"
        if admit and admit.get("conclusion") in {"failure", "skipped"}:
            return "REJECTED_BEFORE_TRANSPORT"
        raise AdmissionError("github_workflow_transport_state_unreadable")
    if transport and transport.get("conclusion") == "success":
        return "TRANSPORT_ACCEPTED"
    if transport and (
        transport.get("status") in {"queued", "in_progress"}
        or transport.get("conclusion") in {"failure", "cancelled", "timed_out"}
    ):
        return "TRANSPORT_UNRESOLVED"
    raise AdmissionError("github_workflow_transport_state_unreadable")


def _transport_state(client: GitHubClient, run: dict[str, Any]) -> str:
    run_id = run.get("id")
    attempts = run.get("run_attempt")
    if not isinstance(run_id, int) or not isinstance(attempts, int) or attempts < 1:
        raise AdmissionError("github_workflow_attempt_history_unreadable")
    states = [
        _attempt_transport_state(_complete_run_jobs(client, run_id, attempt))
        for attempt in range(1, attempts + 1)
    ]
    if any(state == "TRANSPORT_UNRESOLVED" for state in states):
        return "TRANSPORT_UNRESOLVED"
    if any(state == "TRANSPORT_ACCEPTED" for state in states):
        return "TRANSPORT_ACCEPTED"
    if all(state == "REJECTED_BEFORE_TRANSPORT" for state in states):
        return "REJECTED_BEFORE_TRANSPORT"
    raise AdmissionError("github_workflow_transport_state_unreadable")


def _complete_source_workflow_runs(
    client: GitHubClient, head_sha: str
) -> list[dict[str, Any]]:
    collected: list[dict[str, Any]] = []
    expected_total: int | None = None
    for page in range(1, 11):
        value = client.get(
            f"actions/runs?head_sha={head_sha}&event=pull_request&per_page=100&page={page}"
        )
        runs = value.get("workflow_runs") if isinstance(value, dict) else None
        total = value.get("total_count") if isinstance(value, dict) else None
        if not isinstance(runs, list) or not isinstance(total, int) or total < 0:
            raise AdmissionError("github_source_workflow_history_unreadable")
        if expected_total is None:
            expected_total = total
            if total > 1000:
                raise AdmissionError("github_source_workflow_history_unbounded")
        elif total != expected_total:
            raise AdmissionError("github_source_workflow_history_changed_during_read")
        if any(not isinstance(run, dict) for run in runs):
            raise AdmissionError("github_source_workflow_history_unreadable")
        collected.extend(runs)
        if len(runs) < 100:
            if len(collected) != expected_total:
                raise AdmissionError("github_source_workflow_history_incomplete")
            return collected
    raise AdmissionError("github_source_workflow_history_incomplete")


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
        "source_merge_reachable": False,
        "previous_pr": None,
        "workflow_checks": {},
        "matching_dispatches": [],
        "previous_handoff_matches": False,
        "previous_handoff_source": "",
        "current_handoff_matches": False,
        "current_run_attempt": None,
    }
    source = receipt.get("source_acceptance")
    if receipt.get("status") == "COMPLETED" and isinstance(source, dict):
        pr = client.get(f"pulls/{source.get('pr_number')}")
        truth["previous_pr"] = {
            "number": pr.get("number"),
            "head_sha": (pr.get("head") or {}).get("sha"),
            "merge_sha": pr.get("merge_commit_sha"),
            "merged": bool(pr.get("merged_at")),
            "base": (pr.get("base") or {}).get("ref"),
        }
        merge_compare = client.get(f"compare/{source.get('merge_sha')}...{observed_main}")
        truth["source_merge_reachable"] = merge_compare.get("status") in {
            "ahead",
            "identical",
        }
        source_runs = _complete_source_workflow_runs(client, source.get("head_sha"))
        latest_workflow_runs: dict[str, dict[str, Any]] = {}
        for item in source_runs:
            if (
                item.get("event") != "pull_request"
                or item.get("head_sha") != source.get("head_sha")
                or not isinstance(item.get("name"), str)
            ):
                raise AdmissionError("github_source_workflow_identity_mismatch")
            run_id = item.get("id")
            run_attempt = item.get("run_attempt")
            status = item.get("status")
            conclusion = item.get("conclusion")
            if (
                type(run_id) is not int
                or run_id < 1
                or type(run_attempt) is not int
                or run_attempt < 1
                or not isinstance(status, str)
                or (conclusion is not None and not isinstance(conclusion, str))
            ):
                raise AdmissionError("github_source_workflow_authority_unreadable")
            name = item["name"]
            current = latest_workflow_runs.get(name)
            order_key = (run_id, run_attempt)
            current_key = (
                int((current or {}).get("id") or 0),
                int((current or {}).get("run_attempt") or 0),
            )
            if current is None or order_key > current_key:
                latest_workflow_runs[name] = item
        truth["workflow_checks"] = {
            name: run.get("conclusion") if run.get("status") == "completed" else None
            for name, run in latest_workflow_runs.items()
        }
    workflow_runs = _complete_workflow_run_history(client)
    current_marker = (
        f"Orchestrator handoff {handoff.get('handoff_id')} task "
        f"{handoff.get('task_id')} digest {handoff.get('payload_sha256')}"
    )
    run_pattern = re.compile(
        r"^Orchestrator handoff (?P<handoff>\S+) task (?P<task>\S+) digest (?P<digest>[0-9a-f]{64})$"
    )
    if current_run_id:
        current_run = client.get(f"actions/runs/{current_run_id}")
        current_title = str(current_run.get("display_title") or current_run.get("name") or "")
        current_identity = run_pattern.fullmatch(current_title)
        truth["current_run_attempt"] = current_run.get("run_attempt")
        truth["current_handoff_matches"] = bool(
            current_identity
            and str(current_run.get("id")) == current_run_id
            and current_run.get("event") == "workflow_dispatch"
            and current_run.get("path")
            == ".github/workflows/fanmind-manager-event-dispatch.yml"
            and current_identity.group("handoff") == handoff.get("handoff_id")
            and current_identity.group("task") == handoff.get("task_id")
            and current_identity.group("digest") == handoff.get("payload_sha256")
        )
    prior_runs = sorted(
        (
            run
            for run in workflow_runs
            if str(run.get("id")) != current_run_id
        ),
        key=lambda run: (
            str(run.get("run_started_at") or run.get("created_at") or ""),
            int(run.get("id") or 0),
        ),
        reverse=True,
    )
    structured_runs = []
    matching_dispatches = []
    for run in prior_runs:
        title = str(run.get("display_title") or run.get("name") or "")
        match = run_pattern.fullmatch(title)
        if not match:
            run_id = run.get("id")
            if isinstance(run_id, int) and run_id <= LEGACY_WORKFLOW_RUN_BOUNDARY:
                continue
            raise AdmissionError("github_workflow_run_identity_unreadable")
        identity = match.groupdict()
        marker_matches = current_marker == (
            f"Orchestrator handoff {identity['handoff']} task {identity['task']} "
            f"digest {identity['digest']}"
        )
        if structured_runs and not marker_matches:
            continue
        transport_state = _transport_state(client, run)
        if transport_state == "REJECTED_BEFORE_TRANSPORT":
            continue
        if not structured_runs:
            structured_runs.append((run, identity, transport_state))
        if marker_matches:
            matching_dispatches.append(
                {
                    "id": str(run.get("id")),
                    "status": run.get("status"),
                    "conclusion": run.get("conclusion"),
                    "transport_state": transport_state,
                }
            )
    if structured_runs:
        latest_run, identity, transport_state = structured_runs[0]
        truth["latest_previous_handoff"] = {
            **identity,
            "run_id": str(latest_run.get("id")),
            "status": latest_run.get("status"),
            "conclusion": latest_run.get("conclusion"),
            "transport_state": transport_state,
        }
        truth["previous_handoff_matches"] = (
            identity["handoff"] == receipt.get("handoff_id")
            and identity["task"] == receipt.get("task_id")
            and identity["task"] == handoff.get("previous_task_id")
            and identity["digest"] == receipt.get("payload_sha256")
        )
        truth["previous_handoff_source"] = "latest_workflow_run"
    else:
        started = client.file_text(
            "project-memory/STARTED_WORK.md", ref=observed_main
        )
        bootstrap_markers = (
            f"- Orchestrator handoff: {receipt.get('handoff_id')}",
            f"- Orchestrator task_id: {receipt.get('task_id')}",
            f"- Payload digest: {receipt.get('payload_sha256')}",
        )
        if all(item in started for item in bootstrap_markers):
            truth["previous_handoff_matches"] = True
            truth["previous_handoff_source"] = "started_work_bootstrap"
    truth["matching_dispatches"] = matching_dispatches
    if handoff.get("source") == "OWNER_DIRECT":
        locks_text = client.file_text(
            "project-memory/WORK_LOCKS.md", ref=observed_main
        )
        truth["owner_binding"] = _owner_direct_binding(handoff, client, locks_text)
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
        owner_binding=truth.get("owner_binding"),
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
    local_head: str | None = None,
) -> dict[str, Any]:
    if local_head != handoff.get("prepared_main_sha"):
        return {
            "decision": "BLOCK",
            "task_id": handoff.get("task_id"),
            "handoff_id": handoff.get("handoff_id"),
            "payload_sha256": handoff.get("payload_sha256"),
            "builder_input": "",
            "blocker": "local_head_not_prepared_main",
            "resume_condition": "Check out the exact freshly observed prepared main before repeating preparation validation.",
        }
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
        composer_input=composer_input,
        owner_binding=truth.get("owner_binding"),
        require_current_run=False,
    )
    if decision.get("decision") == "SEND":
        return {
            **decision,
            "decision": "PREPARED_ONLY",
            "builder_input": "",
            "send_authorized": False,
            "blocker": "",
            "resume_condition": "An explicitly authorized Parent may use the exact prepared composer content through the existing manual Builder path, then must reconcile it serially; this check creates no reservation or automatic send authority.",
        }
    return decision


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
    decision = selector.dispatch_decision(
        state,
        catalog,
        deferred,
        failed_action_ids=failed,
        active_tasks=active_tasks,
        active_slots=active_slots,
    )
    if decision.get("executable") is True:
        action = next(
            (
                item
                for item in catalog.get("actions", [])
                if item.get("id") == decision.get("action_id")
            ),
            None,
        )
        if isinstance(action, dict) and all(
            key in action
            for key in (
                "dispatch_goal",
                "dispatch_scope",
                "dispatch_acceptance",
                "dispatch_required_checks",
                "dispatch_runtime_requirement",
            )
        ):
            contract = {
                "goal": action["dispatch_goal"],
                "scope": action["dispatch_scope"],
                "acceptance": action["dispatch_acceptance"],
                "required_checks": action["dispatch_required_checks"],
                "runtime_requirement": action["dispatch_runtime_requirement"],
            }
            if action.get("dispatch_resume_evidence") is not None:
                contract["resume_evidence"] = action["dispatch_resume_evidence"]
            decision["task_contract"] = contract
        else:
            decision["task_contract"] = None
    return decision


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

    owner_template = sub.add_parser("owner-authorization-template")
    owner_template.add_argument("--handoff", type=Path, required=True)

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

    admit = sub.add_parser("admit")
    admit.add_argument("--handoff", type=Path, required=True)
    admit.add_argument("--receipt", type=Path, default=RECEIPT_PATH)
    admit.add_argument("--task-id", required=True)
    admit.add_argument("--handoff-id", required=True)
    admit.add_argument("--previous-task-id", required=True)
    admit.add_argument("--payload-sha256", required=True)
    admit.add_argument("--repository", required=True)
    admit.add_argument("--current-run-id", required=True)
    admit.add_argument("--output", type=Path, required=True)

    transport = sub.add_parser("transport")
    transport.add_argument("--input", type=Path, required=True)
    transport.add_argument("--agent-trigger-id", required=True)
    transport.add_argument("--agent-token", required=True)

    closeout = sub.add_parser("await-closeout")
    closeout.add_argument("--handoff", type=Path, required=True)
    closeout.add_argument("--repository", required=True)
    closeout.add_argument("--timeout-seconds", type=int, default=21000)
    closeout.add_argument("--poll-seconds", type=int, default=600)
    closeout.add_argument("--current-run-id", required=True)

    args = parser.parse_args()
    if args.command == "transport":
        payload = args.input.read_text(encoding="utf-8")
        if not payload:
            raise AdmissionError("admitted_transport_payload_missing")
        response = send_builder(
            f"https://api.chatgpt.com/v1/workspace_agents/{args.agent_trigger_id}/trigger",
            args.agent_token,
            payload,
        )
        print(json.dumps({"sent": 1, "response": response}, sort_keys=True))
        return 0

    handoff = _read_json(args.handoff)
    if args.command == "owner-authorization-template":
        print(owner_authorization_template(handoff))
        return 0

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
                truth = collect_github_truth(
                    client,
                    handoff,
                    current_receipt,
                    current_run_id=args.current_run_id,
                )
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
        if _local_head() != handoff.get("prepared_main_sha"):
            print(json.dumps({"decision": "BLOCK", "blocker": "local_head_not_prepared_main"}))
            return 1
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
            local_head=_local_head(),
        )
        print(json.dumps(decision, sort_keys=True))
        return 0 if decision["decision"] in {"SEND", "PREPARED_ONLY"} else 1

    if _local_head() != handoff.get("prepared_main_sha"):
        print(json.dumps({"decision": "BLOCK", "blocker": "local_head_not_prepared_main"}))
        return 1
    client = GitHubClient(args.repository)
    if args.command == "admit":
        truth = collect_github_truth(
            client, handoff, receipt, current_run_id=args.current_run_id
        )
        decision = evaluate_admission(
            handoff,
            receipt,
            truth,
            selector_decision,
            requested_task_id=args.task_id,
            requested_handoff_id=args.handoff_id,
            requested_previous_task_id=args.previous_task_id,
            requested_payload_sha256=args.payload_sha256,
        )
        if decision["decision"] != "SEND":
            decision.pop("builder_input", None)
            print(json.dumps(decision, sort_keys=True))
            return 1
        args.output.write_text(decision["builder_input"], encoding="utf-8")
        print(json.dumps({"decision": "ADMITTED", "sent": 0}, sort_keys=True))
        return 0
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

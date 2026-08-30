#!/usr/bin/env python3
"""Validate and render the legacy #642/#643/#644 reconciliation contract."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_STATE = ROOT / "project-memory" / "LEGACY_ISSUE_RECONCILIATION.json"
DEFAULT_RENDERED = ROOT / "project-memory" / "LEGACY_ISSUE_RECONCILIATION.md"
EXPECTED_ISSUES = {642, 643, 644}
ALLOWED_STATUSES = {
    "ACCEPTED",
    "PARTIAL",
    "RETAINED_GATE",
    "SUPERSEDED_PROCEDURE",
    "TRANSFERRED",
}


class ContractError(ValueError):
    pass


def require(condition: bool, code: str) -> None:
    if not condition:
        raise ContractError(code)


def load_state(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ContractError("state_missing") from exc
    except json.JSONDecodeError as exc:
        raise ContractError("state_json_invalid") from exc
    require(isinstance(data, dict), "state_root_invalid")
    return data


def validate_state(data: dict[str, Any]) -> None:
    require(data.get("schema_version") == 1, "schema_version_invalid")
    require(data.get("repository") == "FanMind/FanMind", "repository_invalid")
    require(data.get("task") == "FM-MEM-009", "task_invalid")
    require(data.get("change_request") == "FM-CR-008", "change_request_invalid")
    require(data.get("master_issue") == 874, "master_issue_invalid")
    require(
        isinstance(data.get("reconciled_at"), str)
        and re.fullmatch(r"\d{4}-\d{2}-\d{2}", data["reconciled_at"]),
        "reconciled_at_invalid",
    )

    evidence = data.get("evidence")
    require(isinstance(evidence, dict) and evidence, "evidence_invalid")
    for evidence_id, record in evidence.items():
        require(re.fullmatch(r"[A-Z0-9_]+", evidence_id) is not None, "evidence_id_invalid")
        require(isinstance(record, dict), f"evidence_record_invalid:{evidence_id}")
        require(bool(record.get("kind")), f"evidence_kind_missing:{evidence_id}")
        require(bool(record.get("reference")), f"evidence_reference_missing:{evidence_id}")
        commit = record.get("commit")
        require(
            isinstance(commit, str) and re.fullmatch(r"[0-9a-f]{40}", commit) is not None,
            f"evidence_commit_invalid:{evidence_id}",
        )
        if record.get("kind") == "immutable_workflow_run":
            require(record.get("conclusion") == "success", f"workflow_not_success:{evidence_id}")

    issues = data.get("issues")
    require(isinstance(issues, list), "issues_invalid")
    numbers = [issue.get("number") for issue in issues if isinstance(issue, dict)]
    require(set(numbers) == EXPECTED_ISSUES and len(numbers) == 3, "issue_set_invalid")

    for issue in issues:
        require(isinstance(issue, dict), "issue_record_invalid")
        number = issue["number"]
        require(
            isinstance(issue.get("source_updated_at"), str)
            and issue["source_updated_at"].endswith("Z"),
            f"source_updated_at_invalid:{number}",
        )
        require(issue.get("successor") == 874, f"successor_invalid:{number}")
        require(bool(issue.get("summary")), f"summary_missing:{number}")

        counts = issue.get("source_checkbox_counts")
        require(isinstance(counts, dict), f"counts_invalid:{number}")
        for key in ("total", "checked", "unchecked"):
            require(
                isinstance(counts.get(key), int) and counts[key] >= 0,
                f"count_invalid:{number}:{key}",
            )
        require(
            counts["checked"] + counts["unchecked"] == counts["total"],
            f"count_sum_invalid:{number}",
        )

        items = issue.get("legacy_unchecked_items")
        require(isinstance(items, list), f"items_invalid:{number}")
        require(len(items) == counts["unchecked"], f"unchecked_count_mismatch:{number}")
        texts = [item.get("text") for item in items if isinstance(item, dict)]
        require(len(set(texts)) == len(items) and all(texts), f"item_text_invalid:{number}")

        used_gates: set[str] = set()
        for item in items:
            require(isinstance(item, dict), f"item_invalid:{number}")
            status = item.get("status")
            require(status in ALLOWED_STATUSES, f"item_status_invalid:{number}")
            item_evidence = item.get("evidence", [])
            require(isinstance(item_evidence, list), f"item_evidence_invalid:{number}")
            for evidence_id in item_evidence:
                require(evidence_id in evidence, f"item_evidence_unknown:{number}:{evidence_id}")

            gate = item.get("gate")
            if status in {"PARTIAL", "RETAINED_GATE", "TRANSFERRED"}:
                require(
                    isinstance(gate, str) and re.fullmatch(r"[A-Z0-9_]+", gate) is not None,
                    f"item_gate_missing:{number}",
                )
                used_gates.add(gate)
            else:
                require(gate is None, f"closed_item_has_gate:{number}")
            if status in {"ACCEPTED", "PARTIAL", "SUPERSEDED_PROCEDURE"}:
                require(bool(item_evidence), f"proved_item_missing_evidence:{number}")
            if status == "ACCEPTED":
                require(gate is None, f"accepted_item_has_gate:{number}")

        retained = issue.get("retained_gates")
        require(isinstance(retained, list), f"retained_gates_invalid:{number}")
        require(len(retained) == len(set(retained)), f"retained_gates_duplicate:{number}")
        require(set(retained) == used_gates, f"retained_gates_mismatch:{number}")

        if number in {642, 643}:
            require(issue.get("disposition") == "KEEP_OPEN_RECONCILED", f"open_disposition_invalid:{number}")
            require(issue.get("target_state") == "open", f"open_target_invalid:{number}")
            require(bool(retained), f"open_issue_without_gate:{number}")
        else:
            require(issue.get("disposition") == "CLOSE_SUPERSEDED", "issue_644_disposition_invalid")
            require(issue.get("target_state") == "closed", "issue_644_target_invalid")
            require(bool(retained), "issue_644_successor_gates_missing")


def render_markdown(data: dict[str, Any]) -> str:
    evidence = data["evidence"]
    lines = [
        "# Legacy Issue Reconciliation",
        "",
        "Canonical, machine-validated mapping for historical issues #642, #643 and #644. "
        "The active finishline remains #874. This document prevents unchecked historical "
        "items from being mistaken for a zero-state while retaining every unproved gate.",
        "",
        f"- Reconciled: {data['reconciled_at']}",
        f"- Task/change: {data['task']} / {data['change_request']}",
        f"- Master issue: #{data['master_issue']}",
        "",
        "| Issue | Disposition | Historical checkboxes | Result |",
        "| --- | --- | ---: | --- |",
    ]
    for issue in data["issues"]:
        counts = issue["source_checkbox_counts"]
        lines.append(
            f"| #{issue['number']} | `{issue['disposition']}` | "
            f"{counts['checked']} checked / {counts['unchecked']} unchecked | {issue['summary']} |"
        )

    lines.extend(["", "## Evidence index", ""])
    for evidence_id, record in evidence.items():
        conclusion = f", conclusion `{record['conclusion']}`" if record.get("conclusion") else ""
        lines.append(
            f"- `{evidence_id}`: {record['reference']} — commit `{record['commit']}`{conclusion}."
        )

    for issue in data["issues"]:
        lines.extend(
            [
                "",
                f"## Issue #{issue['number']}",
                "",
                issue["summary"],
                "",
                f"Target GitHub state: `{issue['target_state']}`; successor: #{issue['successor']}.",
                "",
                "### Formerly unchecked items",
                "",
            ]
        )
        for item in issue["legacy_unchecked_items"]:
            details: list[str] = []
            if item.get("evidence"):
                details.append("evidence " + ", ".join(f"`{value}`" for value in item["evidence"]))
            if item.get("gate"):
                details.append(f"retained as `{item['gate']}`")
            suffix = f" — {'; '.join(details)}" if details else ""
            lines.append(f"- `{item['status']}` — {item['text']}{suffix}")

        lines.extend(["", "### Genuine retained/successor gates", ""])
        for gate in issue["retained_gates"]:
            lines.append(f"- `{gate}`")

    lines.extend(
        [
            "",
            "## Safety boundary",
            "",
            "This reconciliation changes governance and GitHub issue metadata only. It does not "
            "authorize a Production/Stripe/database/provider mutation, a payment, a Mobile build, "
            "iOS Phase 8, legal acceptance or completion of any retained gate.",
            "",
        ]
    )
    return "\n".join(lines)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--state", type=Path, default=DEFAULT_STATE)
    parser.add_argument("--rendered", type=Path, default=DEFAULT_RENDERED)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--render", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        state = load_state(args.state)
        validate_state(state)
        rendered = render_markdown(state)
        if args.render:
            print(rendered, end="")
        if args.check:
            try:
                actual = args.rendered.read_text(encoding="utf-8")
            except FileNotFoundError as exc:
                raise ContractError("rendered_missing") from exc
            require(actual == rendered, "rendered_drift")
    except ContractError as exc:
        print("FANMIND_LEGACY_ISSUE_RECONCILIATION_RESULT=failed")
        print(f"FANMIND_LEGACY_ISSUE_RECONCILIATION_ERROR={exc}")
        return 1
    if not args.render:
        print("FANMIND_LEGACY_ISSUE_RECONCILIATION_RESULT=passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())

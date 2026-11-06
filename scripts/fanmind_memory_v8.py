#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"

REQUIRED = [
    "CROSS_CHAT_STATE.json",
    "IMPACT_MATRIX.json",
    "OWNER_ACTION_INBOX.md",
    "NEXT_BEST_ACTION.md",
    "FINISHLINE_STATE.json",
    "DEFERRED_OWNER_ACTIONS.md",
]


def load_json(name: str):
    return json.loads((PM / name).read_text(encoding="utf-8"))


def render_handoff() -> str:
    state = load_json("FINISHLINE_STATE.json")
    next_action = (PM / "NEXT_BEST_ACTION.md").read_text(encoding="utf-8")
    owner = (PM / "OWNER_ACTION_INBOX.md").read_text(encoding="utf-8")
    selected = re.search(r"Selected action: `([^`]+)`", next_action)
    title = re.search(r"- Title: (.+)", next_action)
    selection_status = re.search(r"- Selection status: `([A-Z_]+)`", next_action)
    deferred = re.findall(r"^## ([^\n]+)\n- Status: DEFERRED_BY_OWNER", owner, flags=re.M)
    gates = state.get("gates", {})
    gate_lines = [f"- `{name}`: `{data.get('state','UNKNOWN')}`" for name, data in gates.items()]
    lines = [
        "# FanMind Automatic Handoff",
        "",
        "Generated from current Project Memory. Chat memory is a navigation hint only; chat claims are never accepted as evidence without repository/external reconciliation.",
        "",
        f"- Repository: `{state.get('repository')}`",
        f"- Sales ready: `{str(bool(state.get('sales_ready'))).lower()}`",
        f"- Phase 8 started: `{str(bool(state.get('phase8_started'))).lower()}`",
        f"- Next action: `{selected.group(1) if selected else 'UNKNOWN'}`",
        f"- Next action status: `{selection_status.group(1) if selection_status else 'UNKNOWN'}`",
        f"- Next action title: {title.group(1) if title else 'UNKNOWN'}",
        "",
        "## Finishline gates",
        "",
        *gate_lines,
        "",
        "## Deferred owner actions",
        "",
    ]
    lines.extend([f"- {x}" for x in deferred] or ["- none"])
    lines += [
        "",
        "## Mandatory new-chat / project-entry rule",
        "",
        "Before answering project-state questions or proposing/executing work, read Project Memory first: `PROTOCOL.md`, `CURRENT_STATE.md`, `FINISHLINE_STATE.json`, `NEXT_BEST_ACTION.md`, `AUTO_HANDOFF.md`, `OWNER_ACTION_INBOX.md`, `SESSION_HANDOFF.md`, `STARTED_WORK.md`, `WORK_LOCKS.md`, `OPEN_LOOPS.md`, `TASK_LEDGER.md`, `DEPENDENCIES.md`, `DECISIONS.md`, `FAILED_ATTEMPTS.md` and relevant canonical Source-of-Truth documents. Then reconcile current GitHub/main/PR/CI plus relevant runtime/provider evidence and run the Next Best Action selector. Do not repeat completed, failed, superseded or owner-deferred work. If Project Memory and current evidence disagree, record/reconcile the contradiction before continuing.",
        "",
    ]
    return "\n".join(lines)


def validate() -> list[str]:
    errors = []
    for name in REQUIRED:
        p = PM / name
        if not p.exists() or not p.read_text(encoding="utf-8").strip():
            errors.append(f"missing-or-empty:{name}")
    try:
        cross = load_json("CROSS_CHAT_STATE.json")
        if cross.get("repository") != "FanMind/FanMind" or cross.get("status") != "ACTIVE":
            errors.append("cross-chat-state-invalid")
        rules = cross.get("rules", {})
        for key in [
            "require_project_memory_preflight_before_project_answer_or_action",
            "chat_memory_is_navigation_only",
            "chat_claim_is_not_evidence",
            "github_and_project_memory_win_on_conflict",
            "require_current_evidence_reconciliation",
            "require_memory_refresh_after_external_chat_completion",
            "require_next_best_action_refresh",
            "do_not_repeat_if_verified_elsewhere",
        ]:
            if rules.get(key) is not True:
                errors.append(f"cross-chat-rule-disabled:{key}")
    except Exception as exc:
        errors.append(f"cross-chat-json-invalid:{exc}")
    try:
        impact = load_json("IMPACT_MATRIX.json")
        if impact.get("rules", {}).get("automatic_downgrade_target") != "NEEDS_REVALIDATION":
            errors.append("impact-matrix-downgrade-contract-invalid")
        if not impact.get("mappings"):
            errors.append("impact-matrix-empty")
    except Exception as exc:
        errors.append(f"impact-matrix-json-invalid:{exc}")
    inbox = (PM / "OWNER_ACTION_INBOX.md").read_text(encoding="utf-8") if (PM / "OWNER_ACTION_INBOX.md").exists() else ""
    if "DEFERRED_BY_OWNER" not in inbox or "Do not ask before" not in inbox:
        errors.append("owner-action-inbox-contract-invalid")
    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--write-handoff", action="store_true")
    args = ap.parse_args()
    errors = validate()
    rendered = render_handoff() if not errors else ""
    target = PM / "AUTO_HANDOFF.md"
    if args.write_handoff and not errors:
        target.write_text(rendered, encoding="utf-8")
    if args.check and not errors:
        current = target.read_text(encoding="utf-8") if target.exists() else ""
        if current != rendered:
            errors.append("auto-handoff-stale")
    if errors:
        print("FANMIND_MEMORY_V8_RESULT=failed")
        for err in errors:
            print(f"FANMIND_MEMORY_V8_ERROR={err}")
        return 1
    print("FANMIND_MEMORY_V8_RESULT=passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

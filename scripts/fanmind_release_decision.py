#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"


def load(name: str):
    return json.loads((PM / name).read_text(encoding="utf-8"))


def evaluate_release_decision(invariants: dict, integration: dict, snapshot: dict) -> tuple[str, list[str]]:
    blockers: list[str] = []

    for item in invariants.get("invariants", []):
        if item.get("required") is True and item.get("status") != "ENFORCED":
            blockers.append(f"invariant:{item.get('id')}:{item.get('status')}")

    for gate in integration.get("gates", []):
        if gate.get("applicable") is True and gate.get("status") != "VERIFIED":
            blockers.append(f"integration_gate:{gate.get('id')}:{gate.get('status')}")

    strict_fields = {
        "current_head_bound": True,
        "evidence_quorum_complete": True,
        "open_p1": 0,
        "open_p2": 0,
        "pending_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
    }
    for key, expected in strict_fields.items():
        if snapshot.get(key) != expected:
            blockers.append(f"release_input:{key}")

    if blockers:
        return "BLOCK", blockers
    if snapshot.get("protected_action_required") is True:
        return "OWNER_REQUIRED", ["protected_action_required"]
    return "ALLOW", []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    args = ap.parse_args()

    invariants = load("SYSTEM_INVARIANTS.json")
    integration = load("INTEGRATION_GATES.json")
    snapshot = load("RELEASE_DECISION.json")
    decision, reasons = evaluate_release_decision(invariants, integration, snapshot)

    print(f"FANMIND_RELEASE_DECISION={decision}")
    for reason in reasons:
        print(f"FANMIND_RELEASE_REASON={reason}")

    if args.check and snapshot.get("decision") != decision:
        print(f"FANMIND_RELEASE_DECISION_MISMATCH=declared:{snapshot.get('decision')}:computed:{decision}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

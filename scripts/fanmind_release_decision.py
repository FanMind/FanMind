#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"


def load(name: str):
    return json.loads((PM / name).read_text(encoding="utf-8"))


def evaluate_release_decision(
    invariants: dict,
    integration: dict,
    contracts: dict,
    snapshot: dict,
) -> tuple[str, list[str]]:
    blockers: list[str] = []

    for item in invariants.get("invariants", []):
        if item.get("required") is True and item.get("status") != "ENFORCED":
            blockers.append(f"invariant:{item.get('id')}:{item.get('status')}")

    for gate in integration.get("gates", []):
        if gate.get("applicable") is True and gate.get("status") != "VERIFIED":
            blockers.append(f"integration_gate:{gate.get('id')}:{gate.get('status')}")

    contract_by_id = {
        item.get("id"): item
        for item in contracts.get("contracts", [])
        if isinstance(item, dict) and item.get("id")
    }
    affected_contracts = snapshot.get("affected_contracts")
    if not isinstance(affected_contracts, list):
        blockers.append("release_input:affected_contracts")
        affected_contracts = []
    for contract_id in affected_contracts:
        item = contract_by_id.get(contract_id)
        if item is None:
            blockers.append(f"contract:unknown:{contract_id}")
        elif item.get("status") != "ACTIVE":
            blockers.append(f"contract:{contract_id}:{item.get('status')}")

    strict_fields = {
        "current_head_bound": True,
        "evidence_quorum_complete": True,
        "evidence_freshness_current": True,
        "dependencies_satisfied": True,
        "consumer_impact_revalidated": True,
        "open_p1": 0,
        "open_p2": 0,
        "pending_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
    }
    for key, expected in strict_fields.items():
        if snapshot.get(key) != expected:
            blockers.append(f"release_input:{key}")

    risk = snapshot.get("risk")
    if risk not in {"R1", "R2", "R3", "R4"}:
        blockers.append("release_input:risk")
    elif risk in {"R3", "R4"}:
        if snapshot.get("negative_evidence_complete") is not True:
            blockers.append("release_input:negative_evidence_complete")
        if snapshot.get("rollback_recovery_evidence_complete") is not True:
            blockers.append("release_input:rollback_recovery_evidence_complete")

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
    contracts = load("CONTRACT_REGISTRY.json")
    snapshot = load("RELEASE_DECISION.json")
    decision, reasons = evaluate_release_decision(invariants, integration, contracts, snapshot)

    print(f"FANMIND_RELEASE_DECISION={decision}")
    for reason in reasons:
        print(f"FANMIND_RELEASE_REASON={reason}")

    if args.check and snapshot.get("decision") != decision:
        print(f"FANMIND_RELEASE_DECISION_MISMATCH=declared:{snapshot.get('decision')}:computed:{decision}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

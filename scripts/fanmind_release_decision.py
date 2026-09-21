#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
RISK_ORDER = {"R1": 1, "R2": 2, "R3": 3, "R4": 4}
CURRENT_EVIDENCE_STATES = {"VERIFIED", "COUNTERCHECKED", "ACCEPTED", "PRODUCTION_CONFIRMED"}


def load(name: str):
    return json.loads((PM / name).read_text(encoding="utf-8"))


def current_git_head() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _required_gate_ids(affected_contracts: list[str], impact: dict) -> tuple[set[str], list[str]]:
    blockers: list[str] = []
    by_contract = {
        item.get("contract"): item
        for item in impact.get("mappings", [])
        if isinstance(item, dict) and item.get("contract")
    }
    gate_ids: set[str] = set()
    for contract_id in affected_contracts:
        mapping = by_contract.get(contract_id)
        if mapping is None:
            blockers.append(f"impact_map:missing:{contract_id}")
            continue
        mapped = mapping.get("gates")
        if not isinstance(mapped, list) or not mapped:
            blockers.append(f"impact_map:gates_missing:{contract_id}")
            continue
        gate_ids.update(str(value) for value in mapped)
    return gate_ids, blockers


def _scope_risk_floor(affected_contracts: list[str], contract_by_id: dict[str, dict]) -> tuple[str | None, list[str]]:
    blockers: list[str] = []
    floor = "R1"
    for contract_id in affected_contracts:
        contract = contract_by_id.get(contract_id)
        if contract is None:
            continue
        minimum = contract.get("minimum_risk")
        if minimum not in RISK_ORDER:
            blockers.append(f"contract:risk_floor_invalid:{contract_id}")
            continue
        if RISK_ORDER[minimum] > RISK_ORDER[floor]:
            floor = minimum
    return floor, blockers


def _validate_bound_evidence(
    snapshot: dict,
    freshness: dict,
    actual_head: str | None,
    actual_target: str | None,
    effective_risk: str | None,
) -> list[str]:
    blockers: list[str] = []
    if not actual_head or len(actual_head) != 40:
        blockers.append("release_evidence:actual_head_missing")
        return blockers
    if not actual_target:
        blockers.append("release_evidence:actual_target_missing")
        return blockers
    if snapshot.get("evaluated_commit") != actual_head:
        blockers.append("release_evidence:evaluated_commit_mismatch")
    if snapshot.get("evaluated_target") != actual_target:
        blockers.append("release_evidence:evaluated_target_mismatch")

    bindings = snapshot.get("evidence_bindings")
    if not isinstance(bindings, list):
        blockers.append("release_evidence:bindings_invalid")
        return blockers

    fresh_by_id = {
        item.get("id"): item
        for item in freshness.get("entries", [])
        if isinstance(item, dict) and item.get("id")
    }
    valid_ids: set[str] = set()
    classes: set[str] = set()
    for binding in bindings:
        if not isinstance(binding, dict):
            blockers.append("release_evidence:binding_invalid")
            continue
        evidence_id = binding.get("id")
        entry = fresh_by_id.get(evidence_id)
        if entry is None:
            blockers.append(f"release_evidence:unknown:{evidence_id}")
            continue
        if entry.get("status") not in CURRENT_EVIDENCE_STATES:
            blockers.append(f"release_evidence:not_current:{evidence_id}:{entry.get('status')}")
        if entry.get("bound_commit") != actual_head or binding.get("commit") != actual_head:
            blockers.append(f"release_evidence:commit_mismatch:{evidence_id}")
        if entry.get("target") != actual_target or binding.get("target") != actual_target:
            blockers.append(f"release_evidence:target_mismatch:{evidence_id}")
        if entry.get("invalidated_by") or entry.get("superseded_by"):
            blockers.append(f"release_evidence:invalidated:{evidence_id}")
        if not any(reason.startswith(f"release_evidence:") and evidence_id in reason for reason in blockers):
            valid_ids.add(str(evidence_id))
            evidence_class = entry.get("class")
            if evidence_class:
                classes.add(str(evidence_class))

    minimum_classes = 2 if effective_risk in {"R3", "R4"} else 1
    if len(classes) < minimum_classes:
        blockers.append(f"release_evidence:quorum_classes:{len(classes)}<{minimum_classes}")

    negative_id = snapshot.get("negative_evidence_id")
    recovery_id = snapshot.get("rollback_recovery_evidence_id")
    if effective_risk in {"R3", "R4"}:
        if negative_id not in valid_ids:
            blockers.append("release_evidence:negative_missing_or_unbound")
        if recovery_id not in valid_ids:
            blockers.append("release_evidence:rollback_recovery_missing_or_unbound")

    return blockers


def evaluate_release_decision(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict,
    freshness: dict,
    snapshot: dict,
    *,
    actual_head: str | None = None,
    actual_target: str | None = None,
) -> tuple[str, list[str]]:
    blockers: list[str] = []

    for item in invariants.get("invariants", []):
        if item.get("required") is True and item.get("status") != "ENFORCED":
            blockers.append(f"invariant:{item.get('id')}:{item.get('status')}")

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

    required_gate_ids, impact_blockers = _required_gate_ids(affected_contracts, impact)
    blockers.extend(impact_blockers)
    gate_by_id = {
        item.get("id"): item
        for item in integration.get("gates", [])
        if isinstance(item, dict) and item.get("id")
    }
    for gate_id in required_gate_ids:
        gate = gate_by_id.get(gate_id)
        if gate is None:
            blockers.append(f"integration_gate:missing:{gate_id}")
        elif gate.get("status") != "VERIFIED":
            blockers.append(f"integration_gate:{gate_id}:{gate.get('status')}")
    for gate in integration.get("gates", []):
        if gate.get("applicable") is True and gate.get("status") != "VERIFIED":
            reason = f"integration_gate:{gate.get('id')}:{gate.get('status')}"
            if reason not in blockers:
                blockers.append(reason)

    declared_risk = snapshot.get("risk")
    risk_floor, risk_blockers = _scope_risk_floor(affected_contracts, contract_by_id)
    blockers.extend(risk_blockers)
    effective_risk: str | None = None
    if declared_risk not in RISK_ORDER:
        blockers.append("release_input:risk")
    elif risk_floor is not None and RISK_ORDER[declared_risk] < RISK_ORDER[risk_floor]:
        blockers.append(f"release_input:risk_below_scope_floor:{declared_risk}<{risk_floor}")
        effective_risk = risk_floor
    else:
        effective_risk = declared_risk

    strict_fields = {
        "dependencies_satisfied": True,
        "consumer_impact_revalidated": True,
        "open_p0": 0,
        "open_p1": 0,
        "open_p2": 0,
        "pending_checks": False,
        "failed_required_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
    }
    for key, expected in strict_fields.items():
        if snapshot.get(key) != expected:
            blockers.append(f"release_input:{key}")

    blocking_reasons = snapshot.get("blocking_reasons")
    if not isinstance(blocking_reasons, list):
        blockers.append("release_input:blocking_reasons")
    elif blocking_reasons:
        blockers.extend(f"declared_blocker:{reason}" for reason in blocking_reasons)

    blockers.extend(
        _validate_bound_evidence(
            snapshot,
            freshness,
            actual_head=actual_head,
            actual_target=actual_target,
            effective_risk=effective_risk,
        )
    )

    if blockers:
        return "BLOCK", blockers
    if snapshot.get("protected_action_required") is True:
        return "OWNER_REQUIRED", ["protected_action_required"]
    return "ALLOW", []


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--snapshot-file", type=Path)
    ap.add_argument("--target")
    args = ap.parse_args()

    invariants = load("SYSTEM_INVARIANTS.json")
    integration = load("INTEGRATION_GATES.json")
    contracts = load("CONTRACT_REGISTRY.json")
    impact = load("IMPACT_MAP.json")
    freshness = load("EVIDENCE_FRESHNESS.json")
    snapshot = (
        json.loads(args.snapshot_file.read_text(encoding="utf-8"))
        if args.snapshot_file
        else load("RELEASE_DECISION.json")
    )
    actual_head = os.environ.get("GITHUB_SHA") or current_git_head()
    actual_target = args.target or os.environ.get("FANMIND_RELEASE_TARGET")
    decision, reasons = evaluate_release_decision(
        invariants,
        integration,
        contracts,
        impact,
        freshness,
        snapshot,
        actual_head=actual_head,
        actual_target=actual_target,
    )

    print(f"FANMIND_RELEASE_DECISION={decision}")
    for reason in reasons:
        print(f"FANMIND_RELEASE_REASON={reason}")

    if args.check and snapshot.get("decision") != decision:
        print(f"FANMIND_RELEASE_DECISION_MISMATCH=declared:{snapshot.get('decision')}:computed:{decision}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

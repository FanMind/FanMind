#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"

REQUIRED = [
    "GOD_MODE_POLICY.md",
    "SYSTEM_INVARIANTS.json",
    "CONTRACT_REGISTRY.json",
    "INTEGRATION_GATES.json",
    "IMPACT_MAP.json",
    "RELEASE_DECISION.json",
]
REQUIRED_INVARIANTS = {f"FM-INV-{i:03d}" for i in range(1, 13)}
REQUIRED_CONTRACTS = {
    "FM-CONTRACT-CREATOR-AI-001",
    "FM-CONTRACT-CHATADMIN-AI-001",
    "FM-CONTRACT-CHATADMIN-STORAGE-001",
    "FM-CONTRACT-SOCIAL-CRM-001",
    "FM-CONTRACT-REG-ENTITLEMENT-001",
    "FM-CONTRACT-AI-BILLING-001",
    "FM-CONTRACT-DISCLOSURE-DELETE-001",
}
REQUIRED_GATES = {
    "FM-IGATE-CREATOR-AI-001",
    "FM-IGATE-CHATADMIN-AI-001",
    "FM-IGATE-CHATADMIN-STORAGE-001",
    "FM-IGATE-SOCIAL-CRM-001",
    "FM-IGATE-REG-ENTITLEMENT-001",
    "FM-IGATE-AI-BILLING-001",
    "FM-IGATE-DISCLOSURE-DELETE-001",
}
VALID_RELEASE = {"ALLOW", "BLOCK", "OWNER_REQUIRED"}
VALID_STATUS = {"REGISTERED", "ENFORCED", "VERIFIED", "NEEDS_REVALIDATION", "BLOCKED", "ACTIVE"}
VALID_RISK = {"R1", "R2", "R3", "R4"}


def load(name: str):
    return json.loads((PM / name).read_text(encoding="utf-8"))


def validate() -> list[str]:
    errors: list[str] = []
    for name in REQUIRED:
        path = PM / name
        if not path.exists() or not path.read_text(encoding="utf-8").strip():
            errors.append(f"missing-or-empty:{name}")

    if errors:
        return errors

    invariants = load("SYSTEM_INVARIANTS.json")
    inv = invariants.get("invariants", [])
    inv_ids = [x.get("id") for x in inv if isinstance(x, dict)]
    if set(inv_ids) != REQUIRED_INVARIANTS or len(inv_ids) != len(set(inv_ids)):
        errors.append("system-invariants-required-set-invalid")
    for item in inv:
        if item.get("required") is not True or item.get("status") not in VALID_STATUS:
            errors.append(f"system-invariant-invalid:{item.get('id')}")
        if not item.get("revalidate_on"):
            errors.append(f"system-invariant-revalidation-missing:{item.get('id')}")

    contracts = load("CONTRACT_REGISTRY.json").get("contracts", [])
    contract_ids = [x.get("id") for x in contracts if isinstance(x, dict)]
    if set(contract_ids) != REQUIRED_CONTRACTS or len(contract_ids) != len(set(contract_ids)):
        errors.append("contract-registry-required-set-invalid")
    for item in contracts:
        if not item.get("owner_module") or not item.get("consumers") or not item.get("revalidate_on"):
            errors.append(f"contract-registry-entry-invalid:{item.get('id')}")
        if item.get("status") not in VALID_STATUS:
            errors.append(f"contract-registry-status-invalid:{item.get('id')}")
        if item.get("minimum_risk") not in VALID_RISK:
            errors.append(f"contract-registry-risk-invalid:{item.get('id')}")

    gates = load("INTEGRATION_GATES.json")
    gate_items = gates.get("gates", [])
    gate_ids = [x.get("id") for x in gate_items if isinstance(x, dict)]
    if set(gate_ids) != REQUIRED_GATES or len(gate_ids) != len(set(gate_ids)):
        errors.append("integration-gates-required-set-invalid")
    for item in gate_items:
        if item.get("status") not in VALID_STATUS or item.get("applicable") not in {True, False}:
            errors.append(f"integration-gate-invalid:{item.get('id')}")
        if not item.get("evidence_required"):
            errors.append(f"integration-gate-evidence-contract-missing:{item.get('id')}")
        unknown = set(item.get("contracts", [])) - set(contract_ids)
        if unknown:
            errors.append(f"integration-gate-unknown-contract:{item.get('id')}")

    golden = {x.get("id") for x in gates.get("synthetic_golden_flows", []) if isinstance(x, dict)}
    if golden != {"FM-GOLDEN-CRM-001", "FM-GOLDEN-CHATADMIN-001"}:
        errors.append("synthetic-golden-flow-registry-invalid")

    impact = load("IMPACT_MAP.json").get("mappings", [])
    impact_contracts = {x.get("contract") for x in impact if isinstance(x, dict)}
    if impact_contracts != set(contract_ids):
        errors.append("impact-map-contract-coverage-invalid")
    for item in impact:
        if not item.get("consumers") or not item.get("tests") or not item.get("gates"):
            errors.append(f"impact-map-entry-invalid:{item.get('contract')}")
        if set(item.get("gates", [])) - set(gate_ids):
            errors.append(f"impact-map-unknown-gate:{item.get('contract')}")

    decision = load("RELEASE_DECISION.json")
    if decision.get("decision") not in VALID_RELEASE:
        errors.append("release-decision-value-invalid")
    if decision.get("risk") not in VALID_RISK:
        errors.append("release-decision-risk-invalid")
    affected = decision.get("affected_contracts")
    if not isinstance(affected, list):
        errors.append("release-decision-affected-contracts-invalid")
        affected = []
    unknown_affected = set(affected) - set(contract_ids)
    if unknown_affected:
        errors.append("release-decision-affected-contracts-unknown")
    blockers = decision.get("blocking_reasons")
    if not isinstance(blockers, list):
        errors.append("release-decision-blocking-reasons-invalid")
    bindings = decision.get("evidence_bindings")
    if not isinstance(bindings, list):
        errors.append("release-decision-evidence-bindings-invalid")
    for key in ("open_p0", "open_p1", "open_p2"):
        value = decision.get(key)
        if not isinstance(value, int) or value < 0:
            errors.append(f"release-decision-{key}-invalid")
    for key in ("pending_checks", "failed_required_checks", "unresolved_review_threads", "reconciliation_required", "protected_action_required"):
        if decision.get(key) not in {True, False}:
            errors.append(f"release-decision-{key}-invalid")

    # A checked-in ALLOW/OWNER_REQUIRED snapshot must carry explicit revision/target-bound
    # evidence. The actual runtime evaluator independently verifies those bindings.
    if decision.get("decision") in {"ALLOW", "OWNER_REQUIRED"}:
        if not decision.get("evaluated_commit") or not decision.get("evaluated_target"):
            errors.append("release-decision-binding-missing")
        if not bindings:
            errors.append("release-decision-evidence-bindings-missing")
        if blockers:
            errors.append("release-decision-retains-blockers")

    return errors


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.parse_args()
    errors = validate()
    if errors:
        print("FANMIND_GOD_MODE_PREFLIGHT=failed")
        for err in errors:
            print(f"FANMIND_GOD_MODE_ERROR={err}")
        return 1
    print("FANMIND_GOD_MODE_PREFLIGHT=passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

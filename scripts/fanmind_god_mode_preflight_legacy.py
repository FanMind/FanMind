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
    "EVIDENCE_TTL_POLICY.json",
]
CONTROL_PLANE_JSON = [
    "SYSTEM_INVARIANTS.json",
    "CONTRACT_REGISTRY.json",
    "INTEGRATION_GATES.json",
    "IMPACT_MAP.json",
    "RELEASE_DECISION.json",
    "EVIDENCE_TTL_POLICY.json",
]
SUPPORTED_SCHEMA_VERSION = 1
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
VALID_STATUS = {
    "REGISTERED",
    "ENFORCED",
    "VERIFIED",
    "NEEDS_REVALIDATION",
    "BLOCKED",
    "ACTIVE",
}
VALID_RISK = {"R1", "R2", "R3", "R4"}


def load(name: str):
    return json.loads((PM / name).read_text(encoding="utf-8"))


def exact_bool(value) -> bool:
    return type(value) is bool


def exact_nonnegative_int(value) -> bool:
    return type(value) is int and value >= 0


def duplicate_values(values: list[str]) -> set[str]:
    seen: set[str] = set()
    duplicates: set[str] = set()
    for value in values:
        if value in seen:
            duplicates.add(value)
        seen.add(value)
    return duplicates


def validate() -> list[str]:
    errors: list[str] = []
    for name in REQUIRED:
        path = PM / name
        if not path.exists() or not path.read_text(encoding="utf-8").strip():
            errors.append(f"missing-or-empty:{name}")

    if errors:
        return errors

    # Every JSON document interpreted by the God Mode control plane has an
    # explicit version contract.  Reject missing, boolean, malformed and future
    # versions before any v1 semantic validation is attempted.
    for name in CONTROL_PLANE_JSON:
        document = load(name)
        if not isinstance(document, dict):
            errors.append(f"control-plane-document-invalid:{name}")
            continue
        schema_version = document.get("schema_version")
        if type(schema_version) is not int or schema_version != SUPPORTED_SCHEMA_VERSION:
            errors.append(f"control-plane-schema-version-unsupported:{name}")

    invariants = load("SYSTEM_INVARIANTS.json")
    inv = invariants.get("invariants", [])
    if not isinstance(inv, list):
        errors.append("system-invariants-list-invalid")
        inv = []
    inv_ids = [x.get("id") for x in inv if isinstance(x, dict)]
    if set(inv_ids) != REQUIRED_INVARIANTS or len(inv_ids) != len(set(inv_ids)):
        errors.append("system-invariants-required-set-invalid")
    for item in inv:
        if not isinstance(item, dict):
            errors.append("system-invariant-entry-invalid")
            continue
        if item.get("required") is not True or item.get("status") not in VALID_STATUS:
            errors.append(f"system-invariant-invalid:{item.get('id')}")
        risk = item.get("risk")
        if not isinstance(risk, str) or risk not in VALID_RISK:
            errors.append(f"system-invariant-risk-invalid:{item.get('id')}")
        if not item.get("revalidate_on"):
            errors.append(f"system-invariant-revalidation-missing:{item.get('id')}")

    contracts = load("CONTRACT_REGISTRY.json").get("contracts", [])
    if not isinstance(contracts, list):
        errors.append("contract-registry-list-invalid")
        contracts = []
    contract_ids = [x.get("id") for x in contracts if isinstance(x, dict)]
    if set(contract_ids) != REQUIRED_CONTRACTS or len(contract_ids) != len(set(contract_ids)):
        errors.append("contract-registry-required-set-invalid")
    for item in contracts:
        if not isinstance(item, dict):
            errors.append("contract-registry-entry-invalid")
            continue
        if not item.get("owner_module") or not item.get("consumers") or not item.get("revalidate_on"):
            errors.append(f"contract-registry-entry-invalid:{item.get('id')}")
        if item.get("status") not in VALID_STATUS:
            errors.append(f"contract-registry-status-invalid:{item.get('id')}")
        if item.get("minimum_risk") not in VALID_RISK:
            errors.append(f"contract-registry-risk-invalid:{item.get('id')}")

    gates = load("INTEGRATION_GATES.json")
    gate_items = gates.get("gates", [])
    if not isinstance(gate_items, list):
        errors.append("integration-gates-list-invalid")
        gate_items = []
    gate_ids = [x.get("id") for x in gate_items if isinstance(x, dict)]
    if set(gate_ids) != REQUIRED_GATES or len(gate_ids) != len(set(gate_ids)):
        errors.append("integration-gates-required-set-invalid")
    for item in gate_items:
        if not isinstance(item, dict):
            errors.append("integration-gate-entry-invalid")
            continue
        if item.get("status") not in VALID_STATUS or not exact_bool(item.get("applicable")):
            errors.append(f"integration-gate-invalid:{item.get('id')}")
        if not item.get("evidence_required"):
            errors.append(f"integration-gate-evidence-contract-missing:{item.get('id')}")
        unknown = set(item.get("contracts", [])) - set(contract_ids)
        if unknown:
            errors.append(f"integration-gate-unknown-contract:{item.get('id')}")

    golden = {
        x.get("id")
        for x in gates.get("synthetic_golden_flows", [])
        if isinstance(x, dict)
    }
    if golden != {"FM-GOLDEN-CRM-001", "FM-GOLDEN-CHATADMIN-001"}:
        errors.append("synthetic-golden-flow-registry-invalid")

    impact = load("IMPACT_MAP.json").get("mappings", [])
    if not isinstance(impact, list):
        errors.append("impact-map-list-invalid")
        impact = []
    impact_contract_list = [
        x.get("contract") for x in impact if isinstance(x, dict) and x.get("contract")
    ]
    if duplicate_values(impact_contract_list):
        errors.append("impact-map-duplicate-contract")
    impact_contracts = set(impact_contract_list)
    if impact_contracts != set(contract_ids):
        errors.append("impact-map-contract-coverage-invalid")
    for item in impact:
        if not isinstance(item, dict):
            errors.append("impact-map-entry-invalid")
            continue
        if not item.get("consumers") or not item.get("tests") or not item.get("gates"):
            errors.append(f"impact-map-entry-invalid:{item.get('contract')}")
        if set(item.get("gates", [])) - set(gate_ids):
            errors.append(f"impact-map-unknown-gate:{item.get('contract')}")

    ttl_policy = load("EVIDENCE_TTL_POLICY.json").get("policy")
    if not isinstance(ttl_policy, dict) or not ttl_policy:
        errors.append("evidence-ttl-policy-invalid")
    else:
        for evidence_class, policy in ttl_policy.items():
            if not isinstance(evidence_class, str) or not evidence_class or not isinstance(policy, dict):
                errors.append("evidence-ttl-policy-entry-invalid")
                continue
            ttl_hours = policy.get("ttl_hours")
            if ttl_hours is not None and (
                isinstance(ttl_hours, bool)
                or not isinstance(ttl_hours, (int, float))
                or ttl_hours < 0
            ):
                errors.append(f"evidence-ttl-policy-ttl-invalid:{evidence_class}")
            revalidate_on = policy.get("revalidate_on")
            if not isinstance(revalidate_on, list) or not revalidate_on:
                errors.append(f"evidence-ttl-policy-revalidate-invalid:{evidence_class}")

    decision = load("RELEASE_DECISION.json")
    if decision.get("decision") not in VALID_RELEASE:
        errors.append("release-decision-value-invalid")
    if decision.get("risk") not in VALID_RISK:
        errors.append("release-decision-risk-invalid")

    affected = decision.get("affected_contracts")
    if not isinstance(affected, list):
        errors.append("release-decision-affected-contracts-invalid")
        affected = []
    else:
        if any(not isinstance(value, str) or not value for value in affected):
            errors.append("release-decision-affected-contracts-entry-invalid")
        if duplicate_values([value for value in affected if isinstance(value, str)]):
            errors.append("release-decision-affected-contracts-duplicate")
    unknown_affected = set(value for value in affected if isinstance(value, str)) - set(contract_ids)
    if unknown_affected:
        errors.append("release-decision-affected-contracts-unknown")

    blockers = decision.get("blocking_reasons")
    if not isinstance(blockers, list):
        errors.append("release-decision-blocking-reasons-invalid")
        blockers = []
    elif any(not isinstance(value, str) or not value for value in blockers):
        errors.append("release-decision-blocking-reason-entry-invalid")

    bindings = decision.get("evidence_bindings")
    if not isinstance(bindings, list):
        errors.append("release-decision-evidence-bindings-invalid")
        bindings = []
    else:
        binding_ids: list[str] = []
        for binding in bindings:
            if not isinstance(binding, dict):
                errors.append("release-decision-evidence-binding-entry-invalid")
                continue
            evidence_id = binding.get("id")
            if not isinstance(evidence_id, str) or not evidence_id:
                errors.append("release-decision-evidence-binding-id-invalid")
            else:
                binding_ids.append(evidence_id)
            if not isinstance(binding.get("commit"), str) or len(binding.get("commit", "")) != 40:
                errors.append(f"release-decision-evidence-binding-commit-invalid:{evidence_id}")
            if not isinstance(binding.get("target"), str) or not binding.get("target"):
                errors.append(f"release-decision-evidence-binding-target-invalid:{evidence_id}")
        if duplicate_values(binding_ids):
            errors.append("release-decision-evidence-bindings-duplicate")

    for key in ("open_p0", "open_p1", "open_p2"):
        if not exact_nonnegative_int(decision.get(key)):
            errors.append(f"release-decision-{key}-invalid")
    for key in (
        "pending_checks",
        "failed_required_checks",
        "unresolved_review_threads",
        "reconciliation_required",
        "protected_action_required",
    ):
        if not exact_bool(decision.get(key)):
            errors.append(f"release-decision-{key}-invalid")

    if decision.get("decision") in {"ALLOW", "OWNER_REQUIRED"}:
        if not affected:
            errors.append("release-decision-affected-contracts-empty")
        if not decision.get("evaluated_commit") or not decision.get("evaluated_target"):
            errors.append("release-decision-binding-missing")
        if not bindings:
            errors.append("release-decision-evidence-bindings-missing")
        if blockers:
            errors.append("release-decision-retains-blockers")
        if decision.get("risk") in {"R2", "R3", "R4"}:
            for key in (
                "implementation_evidence_id",
                "countercheck_evidence_id",
                "negative_evidence_id",
            ):
                if not isinstance(decision.get(key), str) or not decision.get(key):
                    errors.append(f"release-decision-{key}-missing")
        if decision.get("risk") in {"R3", "R4"}:
            key = "rollback_recovery_evidence_id"
            if not isinstance(decision.get(key), str) or not decision.get(key):
                errors.append(f"release-decision-{key}-missing")

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
    print("FANMIND_GOD_MODE_PREFLIGHT=failed")
    print("FANMIND_GOD_MODE_ERROR=legacy_preflight_cli_disabled_use_canonical_entrypoint")
    raise SystemExit(2)

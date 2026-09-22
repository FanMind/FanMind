#!/usr/bin/env python3
from __future__ import annotations

import argparse
from copy import deepcopy
import math

import fanmind_god_mode_preflight_legacy as _legacy
from fanmind_god_mode_preflight_legacy import *  # noqa: F401,F403

_legacy_validate = _legacy.validate

REQUIRED_COMPLETENESS_FLAGS = (
    "current_head_bound",
    "evidence_quorum_complete",
    "evidence_freshness_current",
    "negative_evidence_complete",
    "rollback_recovery_evidence_complete",
)

CONTROL_PLANE_DOCUMENT_ERRORS = {
    "SYSTEM_INVARIANTS.json": "system-invariants-document-invalid",
    "CONTRACT_REGISTRY.json": "contract-registry-document-invalid",
    "INTEGRATION_GATES.json": "integration-gates-document-invalid",
    "IMPACT_MAP.json": "impact-map-document-invalid",
    "RELEASE_DECISION.json": "release-decision-document-invalid",
    "EVIDENCE_TTL_POLICY.json": "ttl-policy-document-invalid",
}


def _round8_preflight_input_errors() -> list[str]:
    """Fail closed before legacy validation can consume malformed metadata."""

    errors: list[str] = []

    # Legacy validation assumes every control-plane JSON document is an object
    # and dereferences `.get()` directly. A syntactically valid JSON scalar/list
    # must therefore be rejected here before the legacy validator is entered.
    # Load exceptions intentionally fall through to the existing per-document
    # checks below so their established diagnostic markers remain stable.
    for name, marker in CONTROL_PLANE_DOCUMENT_ERRORS.items():
        try:
            document = load(name)
        except Exception:
            continue
        if not isinstance(document, dict):
            errors.append(marker)
    if errors:
        return list(dict.fromkeys(errors))

    try:
        registry = load("CONTRACT_REGISTRY.json")
    except Exception as exc:  # malformed/unreadable input is never success
        return [f"contract-registry-load-invalid:{type(exc).__name__}"]

    contracts = registry.get("contracts", []) if isinstance(registry, dict) else []
    if isinstance(contracts, list):
        for item in contracts:
            if not isinstance(item, dict):
                continue
            contract_id = item.get("id")
            minimum_risk = item.get("minimum_risk")
            if not isinstance(minimum_risk, str) or minimum_risk not in VALID_RISK:
                errors.append(f"contract-registry-risk-invalid:{contract_id}")
            triggers = item.get("revalidate_on")
            if (
                not isinstance(triggers, list)
                or not triggers
                or any(not isinstance(trigger, str) or not trigger.strip() for trigger in triggers)
                or len(set(triggers)) != len(triggers)
            ):
                errors.append(f"contract-registry-revalidation-invalid:{contract_id}")

    try:
        ttl_policy = load("EVIDENCE_TTL_POLICY.json")
    except Exception as exc:  # malformed/unreadable input is never success
        return list(
            dict.fromkeys(
                [*errors, f"ttl-policy-load-invalid:{type(exc).__name__}"]
            )
        )

    policy = ttl_policy.get("policy") if isinstance(ttl_policy, dict) else None
    if isinstance(policy, dict):
        for evidence_class, item in policy.items():
            if not isinstance(item, dict):
                continue
            ttl_hours = item.get("ttl_hours")
            if ttl_hours is not None and (
                isinstance(ttl_hours, bool)
                or not isinstance(ttl_hours, (int, float))
                or (isinstance(ttl_hours, float) and not math.isfinite(ttl_hours))
                or ttl_hours < 0
                or ttl_hours > 24 * 365 * 100
            ):
                errors.append(f"ttl-policy-ttl-invalid:{evidence_class}")

    try:
        integration = load("INTEGRATION_GATES.json")
    except Exception as exc:
        return list(dict.fromkeys([*errors, f"integration-gates-load-invalid:{type(exc).__name__}"]))
    gates = integration.get("gates", []) if isinstance(integration, dict) else []
    allowed_roles = {"evidence", "implementation", "countercheck", "negative", "recovery"}
    if isinstance(gates, list):
        for gate in gates:
            if not isinstance(gate, dict):
                continue
            gate_id = gate.get("id")
            gate_contracts = gate.get("contracts")
            if (
                not isinstance(gate_contracts, list)
                or not gate_contracts
                or any(
                    not isinstance(contract_id, str) or not contract_id.strip()
                    for contract_id in gate_contracts
                )
                or len(set(gate_contracts)) != len(gate_contracts)
            ):
                errors.append(f"integration-gate-contracts-invalid:{gate_id}")
                continue
            required = gate.get("evidence_required")
            role_map = gate.get("evidence_required_roles")
            if not isinstance(required, list) or not required:
                errors.append(f"integration-gate-evidence-required-invalid:{gate_id}")
                continue
            if (
                any(not isinstance(requirement, str) or not requirement.strip() for requirement in required)
                or len(set(required)) != len(required)
            ):
                errors.append(f"integration-gate-evidence-required-invalid:{gate_id}")
                continue
            if not isinstance(role_map, dict) or set(role_map) != set(required):
                errors.append(f"integration-gate-evidence-role-map-invalid:{gate_id}")
                continue
            if any(not isinstance(role, str) or role not in allowed_roles for role in role_map.values()):
                errors.append(f"integration-gate-evidence-role-map-invalid:{gate_id}")

    # Reject duplicate gate identities inside a single impact mapping before
    # legacy validation can normalize the list into a set.
    try:
        impact = load("IMPACT_MAP.json")
    except Exception as exc:
        return list(dict.fromkeys([*errors, f"impact-map-load-invalid:{type(exc).__name__}"]))
    mappings = impact.get("mappings") if isinstance(impact, dict) else None
    if isinstance(mappings, list):
        for mapping in mappings:
            if not isinstance(mapping, dict):
                continue
            contract_id = mapping.get("contract")
            mapped_gates = mapping.get("gates")
            if isinstance(mapped_gates, list) and all(
                isinstance(gate_id, str) and gate_id.strip() for gate_id in mapped_gates
            ):
                if len(set(mapped_gates)) != len(mapped_gates):
                    marker = contract_id if isinstance(contract_id, str) and contract_id else "unknown"
                    errors.append(f"impact-map-gates-duplicate:{marker}")

    # The persisted release snapshot must be a JSON object before legacy `.get`
    # access. Completeness flags must always have exact boolean types, and any
    # candidate non-BLOCK state may only exist when every flag is exactly true.
    try:
        release = load("RELEASE_DECISION.json")
    except Exception as exc:
        return list(dict.fromkeys([*errors, f"release-decision-load-invalid:{type(exc).__name__}"]))
    if not isinstance(release, dict):
        errors.append("release-decision-document-invalid")
    else:
        for key in REQUIRED_COMPLETENESS_FLAGS:
            value = release.get(key)
            if type(value) is not bool:
                errors.append(f"release-decision-{key}-invalid")
            elif release.get("decision") in {"ALLOW", "OWNER_REQUIRED"} and value is not True:
                errors.append(f"release-decision-{key}-required")

    # The producer trust anchor is intentionally fail-closed. It may remain
    # UNPROVISIONED while God Mode itself is reviewed/merged, but only an ACTIVE
    # anchor with an exact 64-hex key digest can ever authorize a non-BLOCK
    # protected evidence decision. The secret key itself is never stored in Git.
    # Runtime additionally requires the same digest from an independently
    # protected host identity outside the checkout.
    try:
        anchor = load("GOD_MODE_TRUST_ANCHOR.json")
    except Exception as exc:
        return list(dict.fromkeys([*errors, f"trust-anchor-load-invalid:{type(exc).__name__}"]))
    if not isinstance(anchor, dict):
        errors.append("trust-anchor-document-invalid")
    else:
        if type(anchor.get("schema_version")) is not int or anchor.get("schema_version") != 1:
            errors.append("trust-anchor-schema-invalid")
        if anchor.get("algorithm") != "HMAC-SHA256":
            errors.append("trust-anchor-algorithm-invalid")
        status = anchor.get("status")
        if status not in {"UNPROVISIONED", "ACTIVE"}:
            errors.append("trust-anchor-status-invalid")
        digest = anchor.get("key_sha256")
        if status == "UNPROVISIONED":
            if digest is not None:
                errors.append("trust-anchor-unprovisioned-digest-must-be-null")
        elif status == "ACTIVE":
            if (
                not isinstance(digest, str)
                or len(digest) != 64
                or any(ch not in "0123456789abcdefABCDEF" for ch in digest)
            ):
                errors.append("trust-anchor-key-digest-invalid")

    return list(dict.fromkeys(errors))


def validate() -> list[str]:
    early = _round8_preflight_input_errors()
    if early:
        return early

    # Existing focused tests monkeypatch the public `load` function. Preserve
    # that supported test seam while delegating the unchanged structural rules
    # to the previously reviewed implementation.
    original_load = _legacy.load
    _legacy.load = globals()["load"]
    try:
        return _legacy_validate()
    finally:
        _legacy.load = original_load


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

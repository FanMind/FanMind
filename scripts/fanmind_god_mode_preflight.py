#!/usr/bin/env python3
from __future__ import annotations

import argparse
from copy import deepcopy
import math

import fanmind_god_mode_preflight_legacy as _legacy
from fanmind_god_mode_preflight_legacy import *  # noqa: F401,F403

_legacy_validate = _legacy.validate


def _round8_preflight_input_errors() -> list[str]:
    """Fail closed before legacy validation can consume malformed metadata."""

    errors: list[str] = []
    try:
        registry = load("CONTRACT_REGISTRY.json")
    except Exception as exc:  # malformed/unreadable input is never success
        return [f"contract-registry-load-invalid:{type(exc).__name__}"]

    contracts = registry.get("contracts", []) if isinstance(registry, dict) else []
    if isinstance(contracts, list):
        for item in contracts:
            if not isinstance(item, dict):
                continue
            minimum_risk = item.get("minimum_risk")
            if not isinstance(minimum_risk, str) or minimum_risk not in VALID_RISK:
                errors.append(f"contract-registry-risk-invalid:{item.get('id')}")

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
            required = gate.get("evidence_required")
            role_map = gate.get("evidence_required_roles")
            if not isinstance(required, list) or not required:
                continue
            if not isinstance(role_map, dict) or set(role_map) != set(required):
                errors.append(f"integration-gate-evidence-role-map-invalid:{gate_id}")
                continue
            if any(not isinstance(role, str) or role not in allowed_roles for role in role_map.values()):
                errors.append(f"integration-gate-evidence-role-map-invalid:{gate_id}")

    return list(dict.fromkeys(errors))


def validate() -> list[str]:
    early = _round8_preflight_input_errors()
    if early:
        return early

    # Existing focused tests monkeypatch the public `load` function.  Preserve
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

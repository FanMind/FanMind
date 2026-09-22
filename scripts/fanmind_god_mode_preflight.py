#!/usr/bin/env python3
from __future__ import annotations

import argparse
from copy import deepcopy

import fanmind_god_mode_preflight_legacy as _legacy
from fanmind_god_mode_preflight_legacy import *  # noqa: F401,F403

_legacy_validate = _legacy.validate


def _round8_preflight_input_errors() -> list[str]:
    """Fail closed before legacy validation can hash malformed risk metadata."""

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

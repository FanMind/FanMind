#!/usr/bin/env python3
from __future__ import annotations

import argparse

import fanmind_god_mode_preflight_legacy_current as _current

# Preserve every existing validation/test seam while placing a strict load guard
# in front of the retained validator. This prevents malformed canonical JSON from
# falling through into legacy `.get()` calls and turning fail-closed validation
# into an uncontrolled traceback.
for _name in dir(_current):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_current, _name)

_current_validate = _current.validate

CONTROL_PLANE_DOCUMENT_ERRORS = _current.CONTROL_PLANE_DOCUMENT_ERRORS
CONTROL_PLANE_LOAD_ERRORS = {
    "SYSTEM_INVARIANTS.json": "system-invariants-load-invalid",
    "CONTRACT_REGISTRY.json": "contract-registry-load-invalid",
    "INTEGRATION_GATES.json": "integration-gates-load-invalid",
    "IMPACT_MAP.json": "impact-map-load-invalid",
    "RELEASE_DECISION.json": "release-decision-load-invalid",
    "EVIDENCE_TTL_POLICY.json": "ttl-policy-load-invalid",
}


def _canonical_document_load_errors() -> list[str]:
    errors: list[str] = []
    loader = globals()["load"]
    for name, document_marker in CONTROL_PLANE_DOCUMENT_ERRORS.items():
        try:
            document = loader(name)
        except Exception as exc:
            load_marker = CONTROL_PLANE_LOAD_ERRORS[name]
            errors.append(f"{load_marker}:{type(exc).__name__}")
            continue
        if not isinstance(document, dict):
            errors.append(document_marker)
    return list(dict.fromkeys(errors))


def validate() -> list[str]:
    early = _canonical_document_load_errors()
    if early:
        return early

    # Retain the documented monkeypatch seam used by the adversarial tests while
    # delegating every already-reviewed structural rule to the prior validator.
    previous_load = _current.load
    _current.load = globals()["load"]
    try:
        return _current_validate()
    finally:
        _current.load = previous_load


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

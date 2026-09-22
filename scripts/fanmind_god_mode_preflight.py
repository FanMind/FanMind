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


def _nested_registry_id_errors() -> list[str]:
    """Validate IDs before retained validators normalize them into sets/maps."""
    errors: list[str] = []
    loader = globals()["load"]
    registries = (
        ("SYSTEM_INVARIANTS.json", "invariants", "system-invariant"),
        ("CONTRACT_REGISTRY.json", "contracts", "contract"),
        ("INTEGRATION_GATES.json", "gates", "integration-gate"),
    )
    for name, key, marker in registries:
        try:
            document = loader(name)
        except Exception:
            # The earlier load guard owns the canonical load-error marker.
            continue
        if not isinstance(document, dict):
            continue
        items = document.get(key)
        if not isinstance(items, list):
            continue
        seen: set[str] = set()
        for item in items:
            if not isinstance(item, dict):
                continue
            item_id = item.get("id")
            if not isinstance(item_id, str) or not item_id.strip():
                errors.append(f"{marker}-id-invalid")
                continue
            if item_id in seen:
                errors.append(f"{marker}-id-duplicate:{item_id}")
                continue
            seen.add(item_id)
    return list(dict.fromkeys(errors))



def _enum_shape_errors() -> list[str]:
    """Reject unhashable/malformed enum identities before legacy membership checks."""
    errors: list[str] = []
    loader = globals()["load"]

    def exact_text(value) -> bool:
        return isinstance(value, str) and bool(value.strip()) and value == value.strip()

    try:
        invariants = loader("SYSTEM_INVARIANTS.json")
        for item in invariants.get("invariants", []) if isinstance(invariants, dict) else []:
            if not isinstance(item, dict):
                continue
            item_id = item.get("id")
            if not exact_text(item.get("status")):
                errors.append(f"system-invariant-status-invalid:{item_id}")
            if not exact_text(item.get("risk")):
                errors.append(f"system-invariant-risk-invalid:{item_id}")
    except Exception:
        pass

    try:
        contracts = loader("CONTRACT_REGISTRY.json")
        for item in contracts.get("contracts", []) if isinstance(contracts, dict) else []:
            if not isinstance(item, dict):
                continue
            item_id = item.get("id")
            if not exact_text(item.get("status")):
                errors.append(f"contract-status-invalid:{item_id}")
            if not exact_text(item.get("minimum_risk")):
                errors.append(f"contract-risk-invalid:{item_id}")
    except Exception:
        pass

    try:
        integration = loader("INTEGRATION_GATES.json")
        gates = integration.get("gates", []) if isinstance(integration, dict) else []
        for item in gates if isinstance(gates, list) else []:
            if not isinstance(item, dict):
                continue
            item_id = item.get("id")
            if not exact_text(item.get("status")):
                errors.append(f"integration-gate-status-invalid:{item_id}")
        golden = integration.get("synthetic_golden_flows", []) if isinstance(integration, dict) else []
        seen: set[str] = set()
        for item in golden if isinstance(golden, list) else []:
            if not isinstance(item, dict):
                errors.append("golden-flow-entry-invalid")
                continue
            flow_id = item.get("id")
            if not exact_text(flow_id):
                errors.append("golden-flow-id-invalid")
                continue
            if flow_id in seen:
                errors.append(f"golden-flow-id-duplicate:{flow_id}")
            seen.add(flow_id)
            if not exact_text(item.get("name")):
                errors.append(f"golden-flow-name-invalid:{flow_id}")
            if not exact_text(item.get("status")):
                errors.append(f"golden-flow-status-invalid:{flow_id}")
    except Exception:
        pass

    try:
        release = loader("RELEASE_DECISION.json")
        if isinstance(release, dict):
            if not exact_text(release.get("decision")):
                errors.append("release-decision-decision-invalid")
            if not exact_text(release.get("risk")):
                errors.append("release-decision-risk-invalid")
    except Exception:
        pass

    try:
        anchor = loader("GOD_MODE_TRUST_ANCHOR.json")
        if isinstance(anchor, dict):
            if not exact_text(anchor.get("status")):
                errors.append("trust-anchor-status-invalid")
            if not exact_text(anchor.get("algorithm")):
                errors.append("trust-anchor-algorithm-invalid")
    except Exception:
        pass

    return list(dict.fromkeys(errors))


def validate() -> list[str]:
    early = _canonical_document_load_errors()
    if early:
        return early
    id_errors = _nested_registry_id_errors()
    if id_errors:
        return id_errors
    enum_errors = _enum_shape_errors()
    if enum_errors:
        return enum_errors

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

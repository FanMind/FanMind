#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone

import fanmind_release_decision_core_round11 as _round11
from fanmind_release_decision_core_round11 import *  # noqa: F401,F403

_base = _round11._base
_current = _round11._current
_round11_evaluate_release_decision = _round11.evaluate_release_decision

# Round 12 closes exact-current-head review findings around direct CLI routing,
# malformed evidence boundary arrays, extreme timestamps, and orphan impact-map
# contracts. Bind this wrapper into the signed control plane before evaluation.
_base.CONTROL_PLANE_FILES = tuple(
    dict.fromkeys(
        (
            *_base.CONTROL_PLANE_FILES,
            "scripts/fanmind_release_decision_core_round12.py",
        )
    )
)
_current.CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES
_round11.CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES
CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES


def _safe_timestamp(value) -> bool:
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return False
        parsed.astimezone(timezone.utc)
    except (ValueError, OverflowError, OSError):
        return False
    return True


def _timestamp_shape_blockers(
    attestation: dict | None,
    current_trigger_state: dict | None,
) -> list[str]:
    blockers: list[str] = []
    if isinstance(attestation, dict):
        if not _safe_timestamp(attestation.get("issued_at")) or not _safe_timestamp(
            attestation.get("expires_at")
        ):
            blockers.append("attestation:time_invalid")
        evidence = attestation.get("evidence")
        if isinstance(evidence, list):
            for entry in evidence:
                if not isinstance(entry, dict):
                    continue
                evidence_id = entry.get("id")
                marker = evidence_id if isinstance(evidence_id, str) and evidence_id else "unknown"
                if not _safe_timestamp(entry.get("observed_at")):
                    blockers.append(f"release_evidence:observed_at_invalid:{marker}")
    if isinstance(current_trigger_state, dict):
        if not _safe_timestamp(current_trigger_state.get("issued_at")) or not _safe_timestamp(
            current_trigger_state.get("expires_at")
        ):
            blockers.append("trigger_state:time_invalid")
    return blockers


def _evidence_boundary_shape_blockers(attestation: dict | None) -> list[str]:
    if not isinstance(attestation, dict):
        return []
    evidence = attestation.get("evidence")
    if not isinstance(evidence, list):
        return []

    blockers: list[str] = []
    for entry in evidence:
        if not isinstance(entry, dict):
            continue
        evidence_id = entry.get("id")
        marker = evidence_id if isinstance(evidence_id, str) and evidence_id else "unknown"
        for plural, singular in (("gates", "gate"), ("invariants", "invariant")):
            plural_present = plural in entry
            singular_present = singular in entry
            if plural_present and singular_present:
                blockers.append(f"release_evidence:{plural}_ambiguous:{marker}")

            if plural_present:
                values = entry.get(plural)
                if not isinstance(values, list):
                    blockers.append(f"release_evidence:{plural}_invalid:{marker}")
                elif any(
                    not isinstance(value, str) or not value.strip()
                    for value in values
                ):
                    blockers.append(f"release_evidence:{plural}_invalid:{marker}")
                elif len(set(values)) != len(values):
                    blockers.append(f"release_evidence:{plural}_duplicate:{marker}")

            if singular_present:
                value = entry.get(singular)
                if not isinstance(value, str) or not value.strip():
                    blockers.append(f"release_evidence:{singular}_invalid:{marker}")
    return blockers


def _impact_registry_blockers(contracts: dict, impact: dict) -> list[str]:
    contract_items = contracts.get("contracts") if isinstance(contracts, dict) else None
    mappings = impact.get("mappings") if isinstance(impact, dict) else None
    if not isinstance(contract_items, list) or not isinstance(mappings, list):
        return []  # inherited evaluator reports malformed registries

    known_contract_ids = {
        item.get("id")
        for item in contract_items
        if isinstance(item, dict) and isinstance(item.get("id"), str) and item.get("id")
    }
    blockers: list[str] = []
    for mapping in mappings:
        if not isinstance(mapping, dict):
            continue
        contract_id = mapping.get("contract")
        if isinstance(contract_id, str) and contract_id and contract_id not in known_contract_ids:
            blockers.append(f"impact_map:unknown_contract:{contract_id}")
    return blockers


def _round12_input_blockers(
    contracts: dict,
    impact: dict,
    *,
    attestation: dict | None,
    current_trigger_state: dict | None,
) -> list[str]:
    blockers = [
        *_timestamp_shape_blockers(attestation, current_trigger_state),
        *_evidence_boundary_shape_blockers(attestation),
        *_impact_registry_blockers(contracts, impact),
    ]
    return list(dict.fromkeys(blockers))


def evaluate_release_decision(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict,
    freshness: dict,
    snapshot: dict,
    ttl_policy: dict | None = None,
    *,
    actual_head: str | None = None,
    actual_target: str | None = None,
    current_control_plane_fingerprint: str | None = None,
    now: datetime | None = None,
    attestation: dict | None = None,
    attestation_key: str | bytes | None = None,
    current_trigger_state: dict | None = None,
) -> tuple[str, list[str]]:
    # Validate adversarial input shapes before the inherited evaluator performs
    # normalization or timezone conversion. Invalid/uncertain input must BLOCK,
    # never crash or be silently normalized into success.
    early = _round12_input_blockers(
        contracts,
        impact,
        attestation=attestation,
        current_trigger_state=current_trigger_state,
    )
    if early:
        return "BLOCK", early

    return _round11_evaluate_release_decision(
        invariants,
        integration,
        contracts,
        impact,
        freshness,
        snapshot,
        ttl_policy,
        actual_head=actual_head,
        actual_target=actual_target,
        current_control_plane_fingerprint=current_control_plane_fingerprint,
        now=now,
        attestation=attestation,
        attestation_key=attestation_key,
        current_trigger_state=current_trigger_state,
    )


def _round12_cli_evaluate_release_decision(*args, **kwargs):
    """CLI boundary preserving the exact Git-object check plus round-12 rules."""
    actual_head = kwargs.get("actual_head")
    if not _current._round8.git_commit_resolves(actual_head):
        return "BLOCK", ["release_evidence:actual_head_unresolvable"]
    return evaluate_release_decision(*args, **kwargs)


# Direct imports of the newest wrapper and canonical consumers share the same
# evaluator hook. The CLI additionally swaps the core's CLI hook below so the
# historical core entrypoint cannot bypass round-11/round-12 hardening.
_round11.evaluate_release_decision = evaluate_release_decision
_current.evaluate_release_decision = evaluate_release_decision
_base.evaluate_release_decision = evaluate_release_decision


def main() -> int:
    previous_cli_evaluator = _current._cli_evaluate_release_decision
    _current._cli_evaluate_release_decision = _round12_cli_evaluate_release_decision
    try:
        return _round11.main()
    finally:
        _current._cli_evaluate_release_decision = previous_cli_evaluator


if __name__ == "__main__":
    raise SystemExit(main())

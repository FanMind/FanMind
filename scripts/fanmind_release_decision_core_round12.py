#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone

import fanmind_release_decision_core_round11 as _round11
from fanmind_release_decision_core_round11 import *  # noqa: F401,F403

_base = _round11._base
_current = _round11._current
_round11_evaluate_release_decision = _round11.evaluate_release_decision

# Round 12 closes exact-current-head review findings around direct CLI routing,
# malformed evidence boundary arrays, extreme timestamps, orphan impact-map
# contracts, malformed release snapshots and persisted evidence-completeness
# claims. Bind this wrapper into the signed control plane before evaluation.
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

REQUIRED_COMPLETENESS_FLAGS = (
    "current_head_bound",
    "evidence_quorum_complete",
    "evidence_freshness_current",
    "negative_evidence_complete",
    "rollback_recovery_evidence_complete",
)


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
        # Only intercept supplied timestamps whose timezone normalization could
        # otherwise raise. Missing fields remain owned by the inherited
        # authenticator so all existing fail-closed reasons are preserved.
        if (
            ("issued_at" in attestation and not _safe_timestamp(attestation.get("issued_at")))
            or ("expires_at" in attestation and not _safe_timestamp(attestation.get("expires_at")))
        ):
            blockers.append("attestation:time_invalid")
        evidence = attestation.get("evidence")
        if isinstance(evidence, list):
            for entry in evidence:
                if not isinstance(entry, dict):
                    continue
                evidence_id = entry.get("id")
                marker = evidence_id if isinstance(evidence_id, str) and evidence_id else "unknown"
                if "observed_at" in entry and not _safe_timestamp(entry.get("observed_at")):
                    blockers.append(f"release_evidence:observed_at_invalid:{marker}")
    if isinstance(current_trigger_state, dict):
        if (
            ("issued_at" in current_trigger_state and not _safe_timestamp(current_trigger_state.get("issued_at")))
            or ("expires_at" in current_trigger_state and not _safe_timestamp(current_trigger_state.get("expires_at")))
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

        # Do not allow duplicate gate IDs to disappear when the inherited
        # evaluator normalizes the mapping to a set. Ambiguous boundaries are
        # a fail-closed input error even if they point to the same gate.
        mapped_gates = mapping.get("gates")
        if isinstance(mapped_gates, list) and all(
            isinstance(gate_id, str) and gate_id.strip() for gate_id in mapped_gates
        ):
            if len(set(mapped_gates)) != len(mapped_gates):
                marker = contract_id if isinstance(contract_id, str) and contract_id else "unknown"
                blockers.append(f"impact_map:duplicate_gate:{marker}")
    return blockers


def _snapshot_shape_blockers(snapshot) -> list[str]:
    """Validate persisted release-decision prerequisites before any `.get` use."""
    if not isinstance(snapshot, dict):
        return ["release_input:snapshot_invalid"]

    # Synthetic evaluator callers used by adversarial unit tests do not carry a
    # persisted `decision` field. The canonical RELEASE_DECISION snapshot does,
    # and only that persisted record can contradict its own completeness flags.
    # Once persistence is declared, false *or omitted* flags must block any
    # computed ALLOW/OWNER_REQUIRED result.
    if "decision" not in snapshot:
        return []

    blockers: list[str] = []
    for key in REQUIRED_COMPLETENESS_FLAGS:
        if snapshot.get(key) is not True:
            blockers.append(f"release_input:{key}")
    return blockers


def _round12_input_blockers(
    contracts: dict,
    impact: dict,
    snapshot,
    *,
    attestation: dict | None,
    current_trigger_state: dict | None,
) -> list[str]:
    blockers = [
        *_snapshot_shape_blockers(snapshot),
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
    # normalization, dictionary access or timezone conversion. Invalid or
    # incomplete persisted input must BLOCK, never crash or normalize to success.
    early = _round12_input_blockers(
        contracts,
        impact,
        snapshot,
        attestation=attestation,
        current_trigger_state=current_trigger_state,
    )
    if early:
        return "BLOCK", early

    # Preserve the canonical evaluator's trust-anchor injection seam through all
    # wrapper layers. Round 11 intentionally forwards its own loader into the
    # core, so the outer loader must be mirrored there for the duration too.
    previous_round11_loader = _round11.load_trust_anchor
    previous_current_loader = _current.load_trust_anchor
    _round11.load_trust_anchor = load_trust_anchor
    _current.load_trust_anchor = load_trust_anchor
    try:
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
    finally:
        _round11.load_trust_anchor = previous_round11_loader
        _current.load_trust_anchor = previous_current_loader


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
        # Round 11's executable is intentionally disabled. Enter the canonical
        # core CLI directly while its evaluation hook is bound to round 12.
        return _current.main()
    finally:
        _current._cli_evaluate_release_decision = previous_cli_evaluator


if __name__ == "__main__":
    raise SystemExit(main())

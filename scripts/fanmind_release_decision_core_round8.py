#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone

import fanmind_release_decision_core_legacy as _legacy
from fanmind_release_decision_core_legacy import *  # noqa: F401,F403

# Keep the previously reviewed evaluator as an internal implementation layer and
# add the current-head fail-closed corrections here.  This module remains the
# only canonical evaluator import used by scripts/fanmind_release_decision.py.
_base = _legacy._base
_legacy_evaluate_release_decision = _legacy.evaluate_release_decision

# The split implementation is itself security relevant.  Bind both internal
# implementation files into the signed control-plane fingerprint so moving the
# previous implementation behind this wrapper cannot create an unsigned path.
_base.CONTROL_PLANE_FILES = tuple(
    dict.fromkeys(
        (
            *_base.CONTROL_PLANE_FILES,
            "scripts/fanmind_release_decision_core_legacy.py",
            "scripts/fanmind_god_mode_preflight_legacy.py",
        )
    )
)
CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES

# Preserve private helper compatibility for focused tests and future hardening.
_binding_map = _legacy._binding_map
_entry_is_current_for_hardening = _legacy._entry_is_current_for_hardening
_configured_trigger_list = _legacy._configured_trigger_list
_configured_requirement_list = _legacy._configured_requirement_list
_entry_matches_triggers = _legacy._entry_matches_triggers
_higher_risk = _legacy._higher_risk


def _round8_input_blockers(invariants, contracts) -> list[str]:
    """Reject malformed risk/required metadata before any hash membership use."""

    blockers: list[str] = []

    if isinstance(invariants, dict):
        invariant_items = invariants.get("invariants")
        if isinstance(invariant_items, list):
            for invariant in invariant_items:
                if not isinstance(invariant, dict):
                    blockers.append("invariant:entry_invalid")
                    continue
                invariant_id = invariant.get("id")
                if not isinstance(invariant_id, str) or not invariant_id:
                    blockers.append("invariant:id_invalid")
                    continue

                # Validate risk for every registry entry before deciding whether
                # the invariant is required.  A false/non-required neighbor may
                # not hide malformed, unhashable risk metadata from the runtime
                # evaluator.
                invariant_risk = invariant.get("risk")
                if not isinstance(invariant_risk, str) or invariant_risk not in RISK_ORDER:
                    blockers.append(f"invariant:risk_invalid:{invariant_id}")

                required = invariant.get("required")
                if type(required) is not bool:
                    blockers.append(f"invariant:required_invalid:{invariant_id}")

    if isinstance(contracts, dict):
        contract_items = contracts.get("contracts")
        if isinstance(contract_items, list):
            for contract in contract_items:
                if not isinstance(contract, dict):
                    continue
                contract_id = contract.get("id")
                if not isinstance(contract_id, str) or not contract_id:
                    continue
                minimum_risk = contract.get("minimum_risk")
                if not isinstance(minimum_risk, str) or minimum_risk not in RISK_ORDER:
                    blockers.append(f"contract:risk_floor_invalid:{contract_id}")

    return list(dict.fromkeys(blockers))


def _round8_revalidated_quorum_blockers(
    invariants: dict,
    integration: dict,
    contracts: dict,
    snapshot: dict,
    ttl_policy: dict,
    *,
    actual_head: str | None,
    actual_target: str | None,
    control_fingerprint: str | None,
    now: datetime,
    attestation: dict | None,
) -> list[str]:
    """Require the R3/R4 two-class quorum to be fully revalidated.

    The legacy/current-head evaluator already validates class TTL/triggers,
    contract/invariant revalidation, role quorum and provenance independence.
    This final layer recomputes the *class* quorum using only entries that are
    still eligible after the applicable contract and invariant trigger
    contracts are applied.  A stale second-class gate record therefore cannot
    keep an otherwise one-class release at ALLOW.
    """

    if not isinstance(attestation, dict):
        return []
    trigger_state = attestation.get("trigger_state")
    evidence = attestation.get("evidence")
    if not isinstance(trigger_state, dict) or not isinstance(evidence, list):
        return []

    contract_items = contracts.get("contracts") if isinstance(contracts, dict) else None
    contract_by_id, _ = _base._registry_by_id(contract_items, "contract")
    affected = snapshot.get("affected_contracts") if isinstance(snapshot, dict) else None
    affected_list = [item for item in affected if isinstance(item, str)] if isinstance(affected, list) else []
    affected_set = set(affected_list)

    contract_risk_floor, _ = _base._scope_risk_floor(affected_list, contract_by_id)
    invariant_risk_floor = "R1"
    invariant_triggers: dict[str, list[str]] = {}
    invariant_items = invariants.get("invariants") if isinstance(invariants, dict) else None
    if isinstance(invariant_items, list):
        for invariant in invariant_items:
            if not isinstance(invariant, dict) or invariant.get("required") is not True:
                continue
            invariant_id = invariant.get("id")
            invariant_risk = invariant.get("risk")
            if not isinstance(invariant_id, str) or not invariant_id:
                continue
            if isinstance(invariant_risk, str) and invariant_risk in RISK_ORDER:
                invariant_risk_floor = _higher_risk(invariant_risk_floor, invariant_risk)
            triggers = _configured_trigger_list(invariant.get("revalidate_on"))
            if triggers is not None:
                invariant_triggers[invariant_id] = triggers

    effective_risk = _higher_risk(contract_risk_floor, invariant_risk_floor)
    declared_risk = snapshot.get("risk") if isinstance(snapshot, dict) else None
    if isinstance(declared_risk, str) and declared_risk in RISK_ORDER:
        effective_risk = _higher_risk(effective_risk, declared_risk)
    if effective_risk not in {"R3", "R4"}:
        return []

    contract_triggers: dict[str, list[str]] = {}
    for contract_id in affected_list:
        contract = contract_by_id.get(contract_id)
        if not isinstance(contract, dict):
            continue
        triggers = _configured_trigger_list(contract.get("revalidate_on"))
        if triggers is not None:
            contract_triggers[contract_id] = triggers

    gate_items = integration.get("gates") if isinstance(integration, dict) else None
    gate_by_id: dict[str, dict] = {}
    gate_contracts: dict[str, set[str]] = {}
    mandatory_gate_ids: set[str] = set()
    if isinstance(gate_items, list):
        for gate in gate_items:
            if not isinstance(gate, dict):
                continue
            gate_id = gate.get("id")
            if not isinstance(gate_id, str) or not gate_id:
                continue
            gate_by_id[gate_id] = gate
            configured_contracts = _configured_requirement_list(gate.get("contracts"))
            current_contracts = set(configured_contracts or [])
            gate_contracts[gate_id] = current_contracts
            if gate.get("applicable") is True or bool(current_contracts & affected_set):
                mandatory_gate_ids.add(gate_id)

    bindings = _binding_map(snapshot)
    current_entries: dict[str, dict] = {}
    for entry in evidence:
        if not isinstance(entry, dict):
            continue
        evidence_id = entry.get("id")
        if not isinstance(evidence_id, str) or not evidence_id:
            continue
        if _entry_is_current_for_hardening(
            entry,
            bindings.get(evidence_id),
            trigger_state,
            ttl_policy,
            actual_head,
            actual_target,
            control_fingerprint,
            now,
        ):
            current_entries[evidence_id] = entry

    selected_ids = {
        value
        for key in (
            "implementation_evidence_id",
            "countercheck_evidence_id",
            "negative_evidence_id",
            "rollback_recovery_evidence_id",
        )
        for value in [snapshot.get(key)]
        if isinstance(value, str) and value
    }

    eligible: list[dict] = []
    required_invariant_ids = set(invariant_triggers)
    for evidence_id, entry in current_entries.items():
        entry_gate_ids = _base._entry_set(entry, "gates", "gate") & mandatory_gate_ids
        entry_invariant_ids = (
            _base._entry_set(entry, "invariants", "invariant") & required_invariant_ids
        )

        qualifying_gate = False
        gate_revalidated = True
        for gate_id in entry_gate_ids:
            gate = gate_by_id.get(gate_id)
            if gate is None:
                gate_revalidated = False
                continue
            gate_roles, role_error = _base._required_roles_for_gate(gate, effective_risk)
            if role_error:
                gate_revalidated = False
                continue
            if _base._entry_roles(entry) & gate_roles:
                qualifying_gate = True
            for contract_id in gate_contracts.get(gate_id, set()) & affected_set:
                triggers = contract_triggers.get(contract_id)
                if triggers is None or not _entry_matches_triggers(entry, triggers, trigger_state):
                    gate_revalidated = False

        invariant_revalidated = True
        for invariant_id in entry_invariant_ids:
            if not _entry_matches_triggers(
                entry, invariant_triggers[invariant_id], trigger_state
            ):
                invariant_revalidated = False

        participates = (
            evidence_id in selected_ids
            or qualifying_gate
            or bool(entry_invariant_ids)
        )
        if participates and gate_revalidated and invariant_revalidated:
            eligible.append(entry)

    classes = {
        entry.get("class")
        for entry in eligible
        if isinstance(entry.get("class"), str) and entry.get("class")
    }
    blockers: list[str] = []
    if len(classes) < 2:
        blockers.append(f"release_evidence:revalidated_quorum_classes:{len(classes)}<2")
        return blockers

    independent_pair = any(
        left.get("class") != right.get("class") and _base._independent(left, right)
        for index, left in enumerate(eligible)
        for right in eligible[index + 1 :]
    )
    if not independent_pair:
        blockers.append("release_evidence:revalidated_quorum_classes_not_independent")
    return blockers


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
) -> tuple[str, list[str]]:
    early = _round8_input_blockers(invariants, contracts)
    if early:
        return "BLOCK", early

    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    decision, reasons = _legacy_evaluate_release_decision(
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
        now=now_utc,
        attestation=attestation,
        attestation_key=attestation_key,
    )
    if decision == "BLOCK":
        return decision, reasons

    extra = _round8_revalidated_quorum_blockers(
        invariants,
        integration,
        contracts,
        snapshot,
        ttl_policy or {"policy": {}},
        actual_head=actual_head,
        actual_target=actual_target,
        control_fingerprint=current_control_plane_fingerprint,
        now=now_utc,
        attestation=attestation,
    )
    if extra:
        return "BLOCK", list(dict.fromkeys([*reasons, *extra]))
    return decision, reasons


# The CLI main function is defined in the internal base module and resolves its
# evaluator through _base at runtime.  Point that path at the canonical wrapper
# so direct CLI execution cannot bypass these current-head checks.
_base.evaluate_release_decision = evaluate_release_decision


if __name__ == "__main__":
    raise SystemExit(main())

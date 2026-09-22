#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timezone

import fanmind_release_decision_core as _current
from fanmind_release_decision_core import *  # noqa: F401,F403

_base = _current._base
_round8 = _current._round8
_current_evaluate_release_decision = _current.evaluate_release_decision

# Round 11 is security-relevant evaluator code. Bind it into the same signed
# control-plane fingerprint before any decision is evaluated.
_base.CONTROL_PLANE_FILES = tuple(
    dict.fromkeys(
        (
            *_base.CONTROL_PLANE_FILES,
            "scripts/fanmind_release_decision_core_round11.py",
        )
    )
)
_current.CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES
CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES


def _strict_semantic_quorum_blockers(
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
    current_trigger_state: dict | None,
) -> list[str]:
    """Prevent irrelevant evidence from manufacturing R3/R4 class diversity.

    The round-8 quorum already requires current, independent evidence. This
    follow-up tightens semantic participation:
    - a selected global proof must also be bound to an affected gate/invariant;
    - a gate-bound record cannot fall back to incidental invariant labels when
      it claims none of that gate's semantic requirements;
    - invariant-only evidence may still participate when it carries a real
      qualifying R3/R4 role and its invariant triggers are current.
    """

    if not isinstance(attestation, dict):
        return []
    trigger_state = (
        current_trigger_state.get("state")
        if isinstance(current_trigger_state, dict)
        else None
    )
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
            if isinstance(invariant_risk, str) and invariant_risk in _base.RISK_ORDER:
                invariant_risk_floor = _round8._higher_risk(invariant_risk_floor, invariant_risk)
            triggers = _round8._configured_trigger_list(invariant.get("revalidate_on"))
            if triggers is not None:
                invariant_triggers[invariant_id] = triggers

    effective_risk = _round8._higher_risk(contract_risk_floor, invariant_risk_floor)
    declared_risk = snapshot.get("risk") if isinstance(snapshot, dict) else None
    if isinstance(declared_risk, str) and declared_risk in _base.RISK_ORDER:
        effective_risk = _round8._higher_risk(effective_risk, declared_risk)
    if effective_risk not in {"R3", "R4"}:
        return []

    contract_triggers: dict[str, list[str]] = {}
    for contract_id in affected_list:
        contract = contract_by_id.get(contract_id)
        if not isinstance(contract, dict):
            continue
        triggers = _round8._configured_trigger_list(contract.get("revalidate_on"))
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
            configured_contracts = _round8._configured_requirement_list(gate.get("contracts"))
            current_contracts = set(configured_contracts or [])
            gate_contracts[gate_id] = current_contracts
            if gate.get("applicable") is True or bool(current_contracts & affected_set):
                mandatory_gate_ids.add(gate_id)

    bindings = _round8._binding_map(snapshot)
    current_entries: dict[str, dict] = {}
    for entry in evidence:
        if not isinstance(entry, dict):
            continue
        evidence_id = entry.get("id")
        if not isinstance(evidence_id, str) or not evidence_id:
            continue
        if _round8._entry_is_current_for_hardening(
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

    selected_role_ids: dict[str, str] = {}
    for role, field in _base.ROLE_SNAPSHOT_FIELDS.items():
        selected = snapshot.get(field) if isinstance(snapshot, dict) else None
        if isinstance(selected, str) and selected:
            selected_role_ids[role] = selected

    qualifying_invariant_roles = _base.REQUIRED_EVIDENCE_ROLES[effective_risk]
    required_invariant_ids = set(invariant_triggers)
    eligible: list[dict] = []

    for evidence_id, entry in current_entries.items():
        entry_roles = _base._entry_roles(entry)
        entry_gate_ids = _base._entry_set(entry, "gates", "gate") & mandatory_gate_ids
        entry_invariant_ids = (
            _base._entry_set(entry, "invariants", "invariant") & required_invariant_ids
        )

        qualifying_gate_requirement = False
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

            this_gate_revalidated = bool(entry_roles & gate_roles)
            for contract_id in gate_contracts.get(gate_id, set()) & affected_set:
                triggers = contract_triggers.get(contract_id)
                if triggers is None or not _round8._entry_matches_triggers(entry, triggers, trigger_state):
                    this_gate_revalidated = False
                    gate_revalidated = False
            if not this_gate_revalidated:
                continue

            requirements = _round8._configured_requirement_list(gate.get("evidence_required")) or []
            role_map = gate.get("evidence_required_roles")
            claimed_map = entry.get("requirements")
            claimed = (
                _round8._configured_requirement_list(claimed_map.get(gate_id))
                if isinstance(claimed_map, dict)
                else None
            )
            if isinstance(role_map, dict) and claimed is not None:
                for requirement in requirements:
                    expected_role = role_map.get(requirement)
                    if (
                        isinstance(expected_role, str)
                        and expected_role in entry_roles
                        and requirement in claimed
                    ):
                        qualifying_gate_requirement = True
                        break

        invariant_revalidated = True
        for invariant_id in entry_invariant_ids:
            if not _round8._entry_matches_triggers(
                entry, invariant_triggers[invariant_id], trigger_state
            ):
                invariant_revalidated = False

        # Invariant evidence is a separate semantic path only when the record is
        # not also bound to a mandatory integration gate. Otherwise a record
        # with empty gate claims could bypass the gate contract merely by
        # carrying generic invariant labels.
        qualifying_invariant_only = (
            not entry_gate_ids
            and bool(entry_invariant_ids)
            and bool(entry_roles & qualifying_invariant_roles)
        )

        # A globally selected implementation/countercheck/negative/recovery
        # proof may count only when it is also bound to the affected release
        # boundary. A selected but unbound record cannot manufacture a second
        # evidence class.
        has_boundary_binding = bool(entry_gate_ids or entry_invariant_ids)
        qualifying_selected = has_boundary_binding and any(
            selected_id == evidence_id and role in entry_roles
            for role, selected_id in selected_role_ids.items()
        )

        participates = (
            qualifying_gate_requirement
            or qualifying_invariant_only
            or qualifying_selected
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
    current_trigger_state: dict | None = None,
) -> tuple[str, list[str]]:
    # Preserve the canonical trust-anchor hook across the hardening wrapper.
    # Focused tests replace this module's loader to prove that an attacker-
    # supplied producer key is rejected; production uses the same imported
    # canonical loader. The underlying evaluator must see the identical hook.
    previous_trust_anchor_loader = _current.load_trust_anchor
    _current.load_trust_anchor = load_trust_anchor
    try:
        decision, reasons = _current_evaluate_release_decision(
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
        _current.load_trust_anchor = previous_trust_anchor_loader
    if decision == "BLOCK":
        return decision, reasons

    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    extra = _strict_semantic_quorum_blockers(
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
        current_trigger_state=current_trigger_state,
    )
    if extra:
        return "BLOCK", list(dict.fromkeys([*reasons, *extra]))
    return decision, reasons


# The existing canonical CLI performs the Git-object and protected-key checks.
# Point its module/global hook at this stricter evaluator while preserving the
# already-reviewed CLI entrypoint and fail-closed behavior.
_current.evaluate_release_decision = evaluate_release_decision
_base.evaluate_release_decision = evaluate_release_decision


def main() -> int:
    return _current.main()


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
from __future__ import annotations

from datetime import datetime, timedelta, timezone

import _fanmind_release_decision_base as _base
from _fanmind_release_decision_base import *  # noqa: F401,F403

# Preserve the reviewed v1 evaluator as an internal implementation detail while
# keeping this module as the only canonical evaluator entry point.  The files
# below are security-relevant inputs and therefore participate in the signed
# control-plane fingerprint.  In particular, RELEASE_DECISION.json must be
# bound into the protected attestation so a decision-only commit cannot reuse
# an attestation issued for an older snapshot.
_base_evaluate_release_decision = _base.evaluate_release_decision
_base.CONTROL_PLANE_FILES = tuple(
    dict.fromkeys(
        (
            *_base.CONTROL_PLANE_FILES,
            "scripts/_fanmind_release_decision_base.py",
            "project-memory/RELEASE_DECISION.json",
        )
    )
)
CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES


def _binding_map(snapshot: dict) -> dict[str, dict]:
    bindings = snapshot.get("evidence_bindings")
    if not isinstance(bindings, list):
        return {}
    result: dict[str, dict] = {}
    for binding in bindings:
        if not isinstance(binding, dict):
            continue
        evidence_id = binding.get("id")
        if isinstance(evidence_id, str) and evidence_id and evidence_id not in result:
            result[evidence_id] = binding
    return result


def _entry_is_current_for_hardening(
    entry: dict,
    binding: dict | None,
    trigger_state: dict[str, str],
    ttl_policy: dict,
    actual_head: str | None,
    actual_target: str | None,
    control_fingerprint: str | None,
    now: datetime,
) -> bool:
    if not isinstance(binding, dict):
        return False
    if entry.get("status") not in CURRENT_EVIDENCE_STATES:
        return False
    if entry.get("bound_commit") != actual_head or binding.get("commit") != actual_head:
        return False
    if entry.get("target") != actual_target or binding.get("target") != actual_target:
        return False
    if entry.get("invalidated_by") or entry.get("superseded_by"):
        return False
    if entry.get("control_plane_fingerprint") != control_fingerprint:
        return False
    if _base._entry_provenance(entry) is None:
        return False

    evidence_class = entry.get("class")
    if not isinstance(evidence_class, str) or not evidence_class:
        return False
    class_policy, error = _base._class_policy(evidence_class, ttl_policy)
    if error or class_policy is None:
        return False

    observed = _base._parse_time(entry.get("observed_at"))
    if observed is None or observed > now + timedelta(minutes=5):
        return False
    ttl_hours = class_policy.get("ttl_hours")
    if ttl_hours is not None and now - observed > timedelta(hours=float(ttl_hours)):
        return False

    fingerprints = entry.get("trigger_fingerprints")
    if not isinstance(fingerprints, dict):
        return False
    for trigger in class_policy.get("revalidate_on", []):
        current = trigger_state.get(trigger)
        if not isinstance(current, str) or not current or fingerprints.get(trigger) != current:
            return False
    return True


def _configured_trigger_list(value) -> list[str] | None:
    if not isinstance(value, list) or not value:
        return None
    if any(not isinstance(item, str) or not item for item in value):
        return None
    if len(set(value)) != len(value):
        return None
    return value


def _configured_requirement_list(value) -> list[str] | None:
    if not isinstance(value, list) or not value:
        return None
    if any(not isinstance(item, str) or not item for item in value):
        return None
    if len(set(value)) != len(value):
        return None
    return value


def _entry_matches_triggers(
    entry: dict, triggers: list[str], trigger_state: dict[str, str]
) -> bool:
    fingerprints = entry.get("trigger_fingerprints")
    if not isinstance(fingerprints, dict):
        return False
    return all(
        isinstance(trigger_state.get(trigger), str)
        and bool(trigger_state.get(trigger))
        and fingerprints.get(trigger) == trigger_state.get(trigger)
        for trigger in triggers
    )


def _higher_risk(left: str, right: str) -> str:
    if RISK_ORDER.get(right, 0) > RISK_ORDER.get(left, 0):
        return right
    return left


def _hardening_blockers(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict,
    snapshot: dict,
    ttl_policy: dict,
    *,
    actual_head: str | None,
    actual_target: str | None,
    control_fingerprint: str | None,
    now: datetime,
    attestation: dict | None,
) -> list[str]:
    """Additional fail-closed proof contracts found by current-head review.

    The base evaluator still owns the full release decision.  These checks only
    make acceptance stricter; they can never turn a base BLOCK into success.
    """

    blockers: list[str] = []
    if not isinstance(attestation, dict):
        return blockers

    trigger_state = attestation.get("trigger_state")
    if not isinstance(trigger_state, dict):
        return blockers
    evidence = attestation.get("evidence")
    if not isinstance(evidence, list):
        return blockers

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

    # Required invariants carry their own revalidation contract.  Evidence that
    # names an invariant qualifies only when one current record also proves all
    # of that invariant's trigger fingerprints against the protected producer's
    # current trigger state.  Their declared risk also contributes to the
    # effective release risk floor; a high-risk invariant cannot be downgraded
    # by lowering only contract risk metadata.
    invariant_items = invariants.get("invariants")
    invariant_risk_floor = "R1"
    if isinstance(invariant_items, list):
        for invariant in invariant_items:
            if not isinstance(invariant, dict) or invariant.get("required") is not True:
                continue
            invariant_id = invariant.get("id")
            if not isinstance(invariant_id, str) or not invariant_id:
                continue
            invariant_risk = invariant.get("risk")
            if invariant_risk in RISK_ORDER:
                invariant_risk_floor = _higher_risk(invariant_risk_floor, invariant_risk)
            elif invariant_risk is not None:
                blockers.append(f"invariant:risk_invalid:{invariant_id}")

            triggers = _configured_trigger_list(invariant.get("revalidate_on"))
            if triggers is None:
                blockers.append(f"invariant:revalidate_contract_invalid:{invariant_id}")
                continue

            candidates = [
                entry
                for entry in current_entries.values()
                if invariant_id in _base._entry_set(entry, "invariants", "invariant")
            ]
            if not candidates:
                # The base evaluator emits invariant_missing; avoid duplicating
                # that message here.
                continue
            if not any(
                _entry_matches_triggers(entry, triggers, trigger_state)
                for entry in candidates
            ):
                blockers.append(f"release_evidence:invariant_revalidation_unsatisfied:{invariant_id}")

    contract_by_id, _ = _base._registry_by_id(contracts.get("contracts"), "contract")
    affected = snapshot.get("affected_contracts")
    affected_list = [item for item in affected if isinstance(item, str)] if isinstance(affected, list) else []
    affected_set = set(affected_list)

    # Contract-specific revalidation triggers are a second semantic boundary.
    # The canonical preflight already requires them for registered contracts;
    # the evaluator consumes them whenever present so declared triggers cannot
    # be ignored by otherwise current gate evidence.
    contract_triggers: dict[str, list[str] | None] = {}
    for contract_id in affected_list:
        contract = contract_by_id.get(contract_id)
        if contract is None:
            continue
        raw_triggers = contract.get("revalidate_on")
        if raw_triggers is None:
            # Synthetic unit fixtures predating the registry contract remain
            # compatible; canonical Project Memory cannot omit this field
            # because fanmind_god_mode_preflight rejects it.
            contract_triggers[contract_id] = []
            continue
        configured = _configured_trigger_list(raw_triggers)
        if configured is None:
            blockers.append(f"contract:revalidate_contract_invalid:{contract_id}")
            contract_triggers[contract_id] = None
        else:
            contract_triggers[contract_id] = configured

    gate_items = integration.get("gates")
    gate_by_id: dict[str, dict] = {}
    gate_contracts: dict[str, set[str]] = {}
    authoritative_contract_gates: dict[str, set[str]] = {}
    if isinstance(gate_items, list):
        for gate in gate_items:
            if not isinstance(gate, dict) or not isinstance(gate.get("id"), str):
                continue
            gate_id = gate["id"]
            gate_by_id[gate_id] = gate
            configured_contracts = _configured_requirement_list(gate.get("contracts"))
            if configured_contracts is None:
                blockers.append(f"integration_gate:contracts_invalid:{gate_id}")
                gate_contracts[gate_id] = set()
                continue
            current_contracts = set(configured_contracts)
            gate_contracts[gate_id] = current_contracts
            for contract_id in current_contracts:
                if contract_id not in contract_by_id:
                    blockers.append(f"integration_gate:unknown_contract:{gate_id}:{contract_id}")
                    continue
                authoritative_contract_gates.setdefault(contract_id, set()).add(gate_id)

    # IMPACT_MAP and INTEGRATION_GATES describe the same boundary from opposite
    # directions.  They must agree exactly for affected contracts.  This blocks
    # a tampered map from rerouting a contract to an easier gate or omitting an
    # authoritative gate entirely.
    impact_by_contract, _ = _base._validate_impact_map(impact)
    for contract_id in affected_list:
        mapping = impact_by_contract.get(contract_id)
        if mapping is None:
            continue  # base evaluator already emits impact_map:missing
        mapped = mapping.get("gates")
        if not isinstance(mapped, list) or not mapped or any(
            not isinstance(gate_id, str) or not gate_id for gate_id in mapped
        ):
            continue  # base evaluator owns shape errors
        mapped_set = set(mapped)
        authoritative = authoritative_contract_gates.get(contract_id, set())
        for gate_id in sorted(mapped_set - authoritative):
            blockers.append(f"impact_map:gate_contract_mismatch:{contract_id}:{gate_id}")
        for gate_id in sorted(authoritative - mapped_set):
            blockers.append(f"impact_map:authoritative_gate_missing:{contract_id}:{gate_id}")

    explicit_gate_ids = {
        gate_id for gate_id, gate in gate_by_id.items() if gate.get("applicable") is True
    }
    authoritative_gate_ids = {
        gate_id
        for contract_id in affected_set
        for gate_id in authoritative_contract_gates.get(contract_id, set())
    }
    mandatory_gate_ids = explicit_gate_ids | authoritative_gate_ids

    contract_risk_floor, _ = _base._scope_risk_floor(affected_list, contract_by_id)
    combined_risk_floor = _higher_risk(contract_risk_floor, invariant_risk_floor)
    declared_risk = snapshot.get("risk")
    effective_risk = combined_risk_floor
    if declared_risk in RISK_ORDER:
        if RISK_ORDER[declared_risk] < RISK_ORDER[invariant_risk_floor]:
            blockers.append(
                f"release_input:risk_below_invariant_floor:{declared_risk}<{invariant_risk_floor}"
            )
        effective_risk = _higher_risk(combined_risk_floor, declared_risk)

    # Every mandatory integration gate has a semantic proof contract in
    # evidence_required.  Roles (implementation/countercheck/negative/recovery)
    # are necessary but not sufficient.  Requirement claims count only from
    # current evidence carrying a role required for this gate and satisfying
    # every affected contract trigger behind that gate.
    for gate_id in sorted(mandatory_gate_ids):
        gate = gate_by_id.get(gate_id)
        if gate is None:
            continue
        requirements = _configured_requirement_list(gate.get("evidence_required"))
        if requirements is None:
            blockers.append(f"integration_gate:evidence_contract_invalid:{gate_id}")
            continue

        gate_roles, role_error = _base._required_roles_for_gate(gate, effective_risk)
        if role_error:
            blockers.append(f"integration_gate:{gate_id}:{role_error}")
            continue

        candidates = [
            entry
            for entry in current_entries.values()
            if gate_id in _base._entry_set(entry, "gates", "gate")
        ]
        relevant_contracts = gate_contracts.get(gate_id, set()) & affected_set

        for contract_id in sorted(relevant_contracts):
            triggers = contract_triggers.get(contract_id)
            if triggers is None:
                continue
            if triggers and not any(
                _entry_matches_triggers(entry, triggers, trigger_state)
                for entry in candidates
            ):
                blockers.append(
                    f"release_evidence:contract_revalidation_unsatisfied:{contract_id}:{gate_id}"
                )

        fully_revalidated: list[dict] = []
        for entry in candidates:
            qualifies = True
            for contract_id in relevant_contracts:
                triggers = contract_triggers.get(contract_id)
                if triggers is None:
                    qualifies = False
                    break
                if triggers and not _entry_matches_triggers(entry, triggers, trigger_state):
                    qualifies = False
                    break
            if qualifies:
                fully_revalidated.append(entry)

        for role in sorted(gate_roles):
            if not any(role in _base._entry_roles(entry) for entry in fully_revalidated):
                blockers.append(
                    f"release_evidence:gate_role_revalidation_missing:{gate_id}:{role}"
                )

        semantic_entries = [
            entry
            for entry in fully_revalidated
            if _base._entry_roles(entry) & gate_roles
        ]
        covered: set[str] = set()
        for entry in semantic_entries:
            requirement_map = entry.get("requirements")
            if not isinstance(requirement_map, dict):
                continue
            values = requirement_map.get(gate_id)
            configured = _configured_requirement_list(values)
            if configured is not None:
                covered.update(configured)

        for requirement in requirements:
            if requirement not in covered:
                blockers.append(
                    f"release_evidence:gate_requirement_missing:{gate_id}:{requirement}"
                )

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
    policy = ttl_policy or {"policy": {}}
    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)

    decision, reasons = _base_evaluate_release_decision(
        invariants,
        integration,
        contracts,
        impact,
        freshness,
        snapshot,
        policy,
        actual_head=actual_head,
        actual_target=actual_target,
        current_control_plane_fingerprint=current_control_plane_fingerprint,
        now=now_utc,
        attestation=attestation,
        attestation_key=attestation_key,
    )

    extra = _hardening_blockers(
        invariants,
        integration,
        contracts,
        impact,
        snapshot,
        policy,
        actual_head=actual_head,
        actual_target=actual_target,
        control_fingerprint=current_control_plane_fingerprint,
        now=now_utc,
        attestation=attestation,
    )
    if extra:
        return "BLOCK", list(dict.fromkeys([*reasons, *extra]))
    return decision, reasons


# The legacy main() resolves globals from its defining module at runtime.  Point
# that module to the hardened evaluator so the CLI and GitHub Actions path cannot
# bypass these checks.
_base.evaluate_release_decision = evaluate_release_decision


if __name__ == "__main__":
    raise SystemExit(main())

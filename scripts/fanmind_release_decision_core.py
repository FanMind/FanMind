#!/usr/bin/env python3
from __future__ import annotations

import fanmind_release_decision_core_round8 as _round8
from fanmind_release_decision_core_round8 import *  # noqa: F401,F403

# The prior current-head wrapper is now an internal security-relevant layer; add
# it to the signed control-plane fingerprint so this refactor cannot create an
# unsigned evaluator path. Round8 also binds itself internally so direct imports
# cannot omit it from the authenticated control-plane fingerprint.
_base = _round8._base
_base.CONTROL_PLANE_FILES = tuple(
    dict.fromkeys(
        (
            *_base.CONTROL_PLANE_FILES,
            "scripts/fanmind_release_decision_core_round8.py",
        )
    )
)
CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES


def _higher_risk(left: str, right: str) -> str:
    return right if _base.RISK_ORDER[right] > _base.RISK_ORDER[left] else left


def _canonical_runtime_input_blockers(
    invariants: dict,
    contracts: dict,
    snapshot: dict,
    *,
    attestation: dict | None,
    current_trigger_state: dict | None,
) -> list[str]:
    """Close canonical runtime gaps that structural preflight cannot be trusted to cover.

    The release evaluator is itself a trust boundary. Missing contract
    revalidation metadata, malformed trigger-state schema versions, and
    implementation-only acceptance hidden by inert role padding must therefore
    fail closed even when callers invoke the canonical evaluator without first
    running the structural preflight.
    """

    blockers: list[str] = []

    # The separately protected current-trigger-state producer uses the same exact
    # schema-version rule as the evidence attestation and checked-in control
    # plane. Python bool/float equality must not make True or 1.0 look like v1.
    if isinstance(current_trigger_state, dict):
        schema_version = current_trigger_state.get("schema_version")
        if type(schema_version) is not int or schema_version != 1:
            blockers.append("trigger_state:schema_invalid")

    # Contract revalidation metadata is security-relevant runtime input, not a
    # test-fixture compatibility hint. Every affected contract must carry a
    # non-empty list of concrete trigger names. Missing metadata may never mean
    # "no revalidation required".
    affected = snapshot.get("affected_contracts") if isinstance(snapshot, dict) else None
    affected_ids = {value for value in affected if isinstance(value, str) and value} if isinstance(affected, list) else set()
    contract_items = contracts.get("contracts") if isinstance(contracts, dict) else None
    if isinstance(contract_items, list):
        for contract in contract_items:
            if not isinstance(contract, dict):
                continue
            contract_id = contract.get("id")
            if not isinstance(contract_id, str) or not contract_id or contract_id not in affected_ids:
                continue
            triggers = contract.get("revalidate_on")
            if (
                not isinstance(triggers, list)
                or not triggers
                or any(not isinstance(trigger, str) or not trigger for trigger in triggers)
            ):
                blockers.append(f"contract:revalidation_invalid:{contract_id}")

    # Determine the effective release risk using the same monotonic floors used
    # by the hardened evaluator. This is needed to decide which evidence roles
    # are actually meaningful for the current release.
    effective_risk = "R1"
    declared_risk = snapshot.get("risk") if isinstance(snapshot, dict) else None
    if isinstance(declared_risk, str) and declared_risk in _base.RISK_ORDER:
        effective_risk = _higher_risk(effective_risk, declared_risk)

    if isinstance(contract_items, list):
        for contract in contract_items:
            if not isinstance(contract, dict) or contract.get("id") not in affected_ids:
                continue
            minimum_risk = contract.get("minimum_risk")
            if isinstance(minimum_risk, str) and minimum_risk in _base.RISK_ORDER:
                effective_risk = _higher_risk(effective_risk, minimum_risk)

    invariant_items = invariants.get("invariants") if isinstance(invariants, dict) else None
    if isinstance(invariant_items, list):
        for invariant in invariant_items:
            if not isinstance(invariant, dict) or invariant.get("required") is not True:
                continue
            invariant_risk = invariant.get("risk")
            if isinstance(invariant_risk, str) and invariant_risk in _base.RISK_ORDER:
                effective_risk = _higher_risk(effective_risk, invariant_risk)

    # ACCEPTED / PRODUCTION_CONFIRMED evidence may not masquerade as more than
    # implementation proof by padding its role list with an inert role such as
    # `evidence` on R2-R4. Consider only roles that qualify at effective risk.
    if isinstance(attestation, dict):
        evidence_entries = attestation.get("evidence")
        if isinstance(evidence_entries, list):
            qualifying_roles = _base.REQUIRED_EVIDENCE_ROLES.get(effective_risk, set())
            for entry in evidence_entries:
                if not isinstance(entry, dict):
                    continue
                status = entry.get("status")
                if not isinstance(status, str) or status not in {"ACCEPTED", "PRODUCTION_CONFIRMED"}:
                    continue
                effective_roles = _base._entry_roles(entry) & qualifying_roles
                if effective_roles == {"implementation"}:
                    evidence_id = entry.get("id")
                    blockers.append(
                        f"release_evidence:implementation_only_acceptance:{evidence_id}:{status}"
                    )

    return list(dict.fromkeys(blockers))


def evaluate_release_decision(*args, **kwargs):
    """Pure evaluator used by focused tests and protected producer consumers."""
    if len(args) < 6:
        return "BLOCK", ["release_input:canonical_arguments_missing"]
    invariants = args[0]
    contracts = args[2]
    snapshot = args[5]
    early = _canonical_runtime_input_blockers(
        invariants,
        contracts,
        snapshot,
        attestation=kwargs.get("attestation"),
        current_trigger_state=kwargs.get("current_trigger_state"),
    )
    if early:
        return "BLOCK", early
    return _round8.evaluate_release_decision(*args, **kwargs)


def _cli_evaluate_release_decision(*args, **kwargs):
    """Canonical CLI trust boundary: a bound release SHA must resolve to Git."""
    actual_head = kwargs.get("actual_head")
    if not _round8.git_commit_resolves(actual_head):
        return "BLOCK", ["release_evidence:actual_head_unresolvable"]
    return evaluate_release_decision(*args, **kwargs)


def main() -> int:
    # The inherited base CLI resolves its evaluator through this module-level
    # hook. Apply the Git-object check only at the CLI boundary so pure evaluator
    # tests can continue to use synthetic but syntactically valid 40-hex SHAs.
    previous = _base.evaluate_release_decision
    _base.evaluate_release_decision = _cli_evaluate_release_decision
    try:
        return _base.main()
    finally:
        _base.evaluate_release_decision = previous


# Direct imports use the fully hardened evaluator; canonical CLI execution swaps
# this hook temporarily to the stricter Git-object-resolving wrapper above.
_base.evaluate_release_decision = evaluate_release_decision


if __name__ == "__main__":
    raise SystemExit(main())

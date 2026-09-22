#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json

import fanmind_release_decision_core_round12_legacy as _legacy

# Preserve the complete reviewed round-12 implementation under an immutable
# compatibility module while keeping the canonical import path as the newest
# hardened boundary. Export its private test seams as well as its public API so
# existing exact-scope adversarial tests keep exercising the same implementation.
for _name in dir(_legacy):
    if not _name.startswith("__"):
        globals()[_name] = getattr(_legacy, _name)

_round11 = _legacy._round11
_current = _legacy._current
_base = _legacy._base
_legacy_evaluate_release_decision = _legacy.evaluate_release_decision
_legacy_semantic_projection = _legacy._semantic_projection

# Round 11 captured the prior core evaluator at import time. Keep that retained
# implementation as its internal delegate; only external core imports route
# back through this newest wrapper.
_round11._current_evaluate_release_decision = _current._pre_round12_evaluate_release_decision

# Both compatibility sources contain security-relevant executable logic and are
# therefore authenticated by the same control-plane fingerprint as this shim.
CONTROL_PLANE_FILES = tuple(
    dict.fromkeys(
        (
            *_legacy.CONTROL_PLANE_FILES,
            "scripts/fanmind_release_decision_core_round12_legacy.py",
            "scripts/fanmind_god_mode_preflight_legacy_current.py",
        )
    )
)
for _module in (_base, _current, _round11, _legacy):
    _module.CONTROL_PLANE_FILES = CONTROL_PLANE_FILES

# Pin every security-relevant canonical semantic dimension independently of the
# contributor-controlled JSON registries. Revalidation triggers are part of the
# release trust boundary: weakening them must invalidate the digest just like a
# lowered risk floor or weakened evidence-role requirement.
CANONICAL_SECURITY_SEMANTICS_SHA256 = (
    "65f9c6a1e6b73ba6c2095507b65ff3c51186f6bccdd815e42d5b3acfd59cbf1b"
)


def _semantic_projection(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict,
    ttl_policy: dict,
) -> dict:
    projection = _legacy_semantic_projection(invariants, integration, contracts)
    contract_items = contracts.get("contracts") if isinstance(contracts, dict) else None
    invariant_items = invariants.get("invariants") if isinstance(invariants, dict) else None
    projection["contract_revalidation"] = {
        item.get("id"): item.get("revalidate_on")
        for item in (contract_items if isinstance(contract_items, list) else [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    projection["invariant_revalidation"] = {
        item.get("id"): item.get("revalidate_on")
        for item in (invariant_items if isinstance(invariant_items, list) else [])
        if isinstance(item, dict)
        and item.get("required") is True
        and isinstance(item.get("id"), str)
    }
    gate_items = integration.get("gates") if isinstance(integration, dict) else None
    mappings = impact.get("mappings") if isinstance(impact, dict) else None
    policy = ttl_policy.get("policy") if isinstance(ttl_policy, dict) else None
    projection["gate_contracts"] = {
        item.get("id"): item.get("contracts")
        for item in (gate_items if isinstance(gate_items, list) else [])
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    projection["impact_gate_mappings"] = {
        item.get("contract"): item.get("gates")
        for item in (mappings if isinstance(mappings, list) else [])
        if isinstance(item, dict) and isinstance(item.get("contract"), str)
    }
    projection["evidence_ttl_policy"] = policy
    return projection


def _canonical_semantics_blockers(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict | None = None,
    ttl_policy: dict | None = None,
) -> list[str]:
    impact = impact if impact is not None else _base.load("IMPACT_MAP.json")
    ttl_policy = ttl_policy if ttl_policy is not None else _base.load("EVIDENCE_TTL_POLICY.json")
    try:
        encoded = json.dumps(
            _semantic_projection(invariants, integration, contracts, impact, ttl_policy),
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
        ).encode("utf-8")
    except (TypeError, ValueError):
        return ["canonical_semantics:invalid"]
    actual = hashlib.sha256(encoded).hexdigest()
    if not _base.hmac.compare_digest(actual, CANONICAL_SECURITY_SEMANTICS_SHA256):
        return ["canonical_semantics:digest_mismatch"]
    return []


# The retained evaluator resolves these names from its own module globals. Patch
# exactly those seams so every direct call and the canonical CLI receives the
# strengthened semantic digest without creating an alternate evaluator path.
# The outer evaluator enforces the expanded canonical projection before calling
# the retained implementation. Avoid a weaker second projection in the
# compatibility layer while preserving its internal call signature.
_legacy._canonical_semantics_blockers = lambda _i, _g, _c: []
_legacy.CANONICAL_SECURITY_SEMANTICS_SHA256 = CANONICAL_SECURITY_SEMANTICS_SHA256


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
    now=None,
    attestation: dict | None = None,
    attestation_key: str | bytes | None = None,
    current_trigger_state: dict | None = None,
) -> tuple[str, list[str]]:
    requirement_blockers = _evidence_requirement_claim_blockers(attestation, integration)
    canonical = _current._canonical_runtime_mode(integration, contracts, impact, snapshot)
    canonical_shape_valid = not _current._canonical_registry_blockers(contracts, integration)
    if canonical and canonical_shape_valid:
        semantic_blockers = _canonical_semantics_blockers(
            invariants, integration, contracts, impact, ttl_policy or {}
        )
        if semantic_blockers:
            return "BLOCK", semantic_blockers
    # Reject a semantically empty target identifier before canonical-registry
    # hardening can mask the more fundamental malformed release boundary. This
    # remains fail-closed and restores the documented adversarial contract for
    # test-only synthetic fixtures as well as canonical callers.
    if isinstance(snapshot, dict):
        target_blockers = _current._target_identifier_blockers(
            snapshot.get("operation"), actual_target
        )
        if target_blockers:
            return "BLOCK", target_blockers

    # Preserve the established monkeypatch seam used to prove that verification
    # key identity comes from an independently pinned anchor. The retained
    # evaluator forwards its own module-global loader through older layers, so
    # mirror the canonical wrapper's loader there for this call only.
    previous_legacy_loader = _legacy.load_trust_anchor
    _legacy.load_trust_anchor = globals()["load_trust_anchor"]
    try:
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
            now=now,
            attestation=attestation,
            attestation_key=attestation_key,
            current_trigger_state=current_trigger_state,
        )
        if requirement_blockers:
            return "BLOCK", list(dict.fromkeys([*reasons, *requirement_blockers]))
        return decision, reasons
    finally:
        _legacy.load_trust_anchor = previous_legacy_loader


def _evidence_requirement_claim_blockers(attestation: dict | None, integration: dict) -> list[str]:
    if not isinstance(attestation, dict):
        return []
    gates = integration.get("gates") if isinstance(integration, dict) else None
    configured = {
        gate.get("id"): set(gate.get("evidence_required", []))
        for gate in (gates if isinstance(gates, list) else [])
        if isinstance(gate, dict)
        and isinstance(gate.get("id"), str)
        and isinstance(gate.get("evidence_required"), list)
    }
    evidence = attestation.get("evidence")
    blockers: list[str] = []
    for entry in evidence if isinstance(evidence, list) else []:
        if not isinstance(entry, dict) or "requirements" not in entry:
            continue
        claims = entry.get("requirements")
        if not isinstance(claims, dict):
            blockers.append("release_evidence:requirements_invalid")
            continue
        entry_gates = set(entry.get("gates", [])) if isinstance(entry.get("gates"), list) else set()
        for gate_id, values in claims.items():
            if gate_id not in configured:
                blockers.append(f"release_evidence:requirement_gate_unknown:{gate_id}")
                continue
            if (
                not isinstance(values, list)
                or any(not isinstance(value, str) or value not in configured[gate_id] for value in values)
                or len(set(values)) != len(values)
            ):
                blockers.append(f"release_evidence:requirement_unknown:{gate_id}")
    return list(dict.fromkeys(blockers))


# Keep every historical import seam on the newest evaluator. The legacy
# round-12 CLI wrapper resolves its evaluator dynamically from its module, so
# rebinding it here also hardens scripts/fanmind_release_decision.py and direct
# fanmind_release_decision_core.py execution.
_legacy.evaluate_release_decision = evaluate_release_decision
_round11.evaluate_release_decision = evaluate_release_decision
_current.evaluate_release_decision = evaluate_release_decision
_base.evaluate_release_decision = evaluate_release_decision


def main() -> int:
    # Preserve the exact-HEAD loader seam used by the CLI negative tests. The
    # retained main resolves this helper from its own module globals.
    try:
        snapshot = globals()["_load_head_project_memory"]("RELEASE_DECISION.json")
    except Exception as exc:
        print("FANMIND_RELEASE_DECISION=BLOCK")
        print(f"FANMIND_RELEASE_REASON=release_input:snapshot_load_invalid:{type(exc).__name__}")
        return 1
    if not isinstance(snapshot, dict):
        print("FANMIND_RELEASE_DECISION=BLOCK")
        print("FANMIND_RELEASE_REASON=release_input:snapshot_invalid")
        return 1

    required = (
        "SYSTEM_INVARIANTS.json", "INTEGRATION_GATES.json", "CONTRACT_REGISTRY.json",
        "IMPACT_MAP.json", "RELEASE_DECISION.json", "EVIDENCE_TTL_POLICY.json",
    )
    try:
        for name in required:
            document = globals()["_load_head_project_memory"](name)
            if not isinstance(document, dict):
                raise ValueError(f"non-object HEAD project-memory JSON: {name}")
    except Exception as exc:
        print("FANMIND_RELEASE_DECISION=BLOCK")
        print(f"FANMIND_RELEASE_REASON=canonical_control_plane:head_load_invalid:{type(exc).__name__}")
        return 1

    previous_loader = _legacy._load_head_project_memory
    _legacy._load_head_project_memory = globals()["_load_head_project_memory"]
    try:
        return _legacy.main()
    finally:
        _legacy._load_head_project_memory = previous_loader


if __name__ == "__main__":
    raise SystemExit(main())

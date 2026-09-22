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
    "4bce0a8c1e46142e35e2598c2c9a25de5d4fe36e61dc28299b040c2265d8429e"
)


def _semantic_projection(
    invariants: dict,
    integration: dict,
    contracts: dict,
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
    return projection


def _canonical_semantics_blockers(
    invariants: dict,
    integration: dict,
    contracts: dict,
) -> list[str]:
    try:
        encoded = json.dumps(
            _semantic_projection(invariants, integration, contracts),
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
_legacy._semantic_projection = _semantic_projection
_legacy._canonical_semantics_blockers = _canonical_semantics_blockers
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

    return _legacy_evaluate_release_decision(
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


# Keep every historical import seam on the newest evaluator. The legacy
# round-12 CLI wrapper resolves its evaluator dynamically from its module, so
# rebinding it here also hardens scripts/fanmind_release_decision.py and direct
# fanmind_release_decision_core.py execution.
_legacy.evaluate_release_decision = evaluate_release_decision
_round11.evaluate_release_decision = evaluate_release_decision
_current.evaluate_release_decision = evaluate_release_decision
_base.evaluate_release_decision = evaluate_release_decision


def main() -> int:
    return _legacy.main()


if __name__ == "__main__":
    raise SystemExit(main())

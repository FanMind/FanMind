#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import stat
from datetime import datetime, timezone
from pathlib import Path

import fanmind_release_decision_core_round11 as _round11
from fanmind_release_decision_core_round11 import *  # noqa: F401,F403

_base = _round11._base
_current = _round11._current
_round11_evaluate_release_decision = _round11.evaluate_release_decision

# Round 12 closes exact-current-head review findings around direct CLI routing,
# malformed evidence boundary arrays, extreme timestamps, orphan impact-map
# contracts, malformed release snapshots, persisted evidence-completeness claims,
# independently protected producer-key identity, canonical risk/role semantics,
# and authenticated exact-byte loading at the CLI trust boundary.
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

# The key identity used to authenticate protected evidence must not come from the
# contributor-controlled checkout. A future protected producer may provision
# this fixed host path on a dedicated environment where the checkout user cannot
# alter it. Ordinary PR CI intentionally has no such file, so any attempted
# canonical non-BLOCK decision with an attestation fails closed.
PROTECTED_TRUST_IDENTITY_PATH = Path("/etc/fanmind/god-mode/trust-anchor.sha256")

# Canonical security semantics are independently pinned in evaluator code so a
# PR cannot lower every JSON risk floor or remap every evidence requirement to a
# weaker role while retaining a mutually self-consistent registry. The digest is
# over exactly: contract minimum-risk by ID, required invariant risk by ID, and
# gate evidence_required_roles by gate/requirement. Any intentional semantic
# change therefore requires an explicit reviewed evaluator update too.
CANONICAL_SECURITY_SEMANTICS_SHA256 = (
    "bf1db42720bcd4a4e8c18146a16352e79655e1fd74135c3e717741bc44331019"
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


def _registry_ids(document: dict, key: str) -> set[str]:
    items = document.get(key) if isinstance(document, dict) else None
    if not isinstance(items, list):
        return set()
    return {
        item.get("id")
        for item in items
        if isinstance(item, dict) and isinstance(item.get("id"), str) and item.get("id")
    }


def _evidence_boundary_shape_blockers(
    attestation: dict | None,
    invariants: dict,
    integration: dict,
) -> list[str]:
    if not isinstance(attestation, dict):
        return []
    evidence = attestation.get("evidence")
    if not isinstance(evidence, list):
        return []

    known_gates = _registry_ids(integration, "gates")
    known_invariants = _registry_ids(invariants, "invariants")
    blockers: list[str] = []
    for entry in evidence:
        if not isinstance(entry, dict):
            continue
        evidence_id = entry.get("id")
        marker = evidence_id if isinstance(evidence_id, str) and evidence_id else "unknown"
        for plural, singular, known in (
            ("gates", "gate", known_gates),
            ("invariants", "invariant", known_invariants),
        ):
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
                else:
                    for value in values:
                        if value not in known:
                            blockers.append(
                                f"release_evidence:{singular}_unknown:{marker}:{value}"
                            )

            if singular_present:
                value = entry.get(singular)
                if not isinstance(value, str) or not value.strip():
                    blockers.append(f"release_evidence:{singular}_invalid:{marker}")
                elif value not in known:
                    blockers.append(
                        f"release_evidence:{singular}_unknown:{marker}:{value}"
                    )
    return blockers


def _invariant_registry_blockers(invariants: dict) -> list[str]:
    items = invariants.get("invariants") if isinstance(invariants, dict) else None
    if not isinstance(items, list):
        return []  # inherited evaluator owns malformed document structure
    ids = {
        item.get("id")
        for item in items
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }
    if ids != _base.REQUIRED_INVARIANT_IDS:
        return ["invariant:canonical_set_invalid"]
    return []


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
    """Reject malformed release snapshots before inherited `.get` access."""
    if not isinstance(snapshot, dict):
        return ["release_input:snapshot_invalid"]
    return []


def _persisted_completeness_blockers(snapshot: dict) -> list[str]:
    """A persisted non-BLOCK decision must prove all completeness flags.

    Synthetic pure-evaluator fixtures historically omit the persisted decision
    field. That is safe only outside canonical runtime mode. The canonical CLI
    and the canonical Project-Memory snapshot are identified independently by
    the runtime flag/task marker, so deleting `decision` cannot select a weaker
    test path. A declared BLOCK remains allowed to record incomplete evidence.
    """
    decision = snapshot.get("decision")
    canonical = _current._CANONICAL_CLI_ACTIVE or snapshot.get("task") == _current.CANONICAL_GOD_MODE_TASK

    if decision in {"ALLOW", "OWNER_REQUIRED"}:
        return [
            f"release_input:{key}"
            for key in REQUIRED_COMPLETENESS_FLAGS
            if snapshot.get(key) is not True
        ]
    if decision == "BLOCK":
        return []
    if canonical:
        return ["release_input:decision_missing_or_invalid"]
    return []


def _semantic_projection(
    invariants: dict,
    integration: dict,
    contracts: dict,
) -> dict:
    contract_items = contracts.get("contracts") if isinstance(contracts, dict) else None
    invariant_items = invariants.get("invariants") if isinstance(invariants, dict) else None
    gate_items = integration.get("gates") if isinstance(integration, dict) else None
    return {
        "contracts": {
            item.get("id"): item.get("minimum_risk")
            for item in (contract_items if isinstance(contract_items, list) else [])
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        },
        "invariants": {
            item.get("id"): item.get("risk")
            for item in (invariant_items if isinstance(invariant_items, list) else [])
            if isinstance(item, dict)
            and item.get("required") is True
            and isinstance(item.get("id"), str)
        },
        "gate_evidence_roles": {
            item.get("id"): item.get("evidence_required_roles")
            for item in (gate_items if isinstance(gate_items, list) else [])
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        },
    }


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


def _secure_external_trust_digest() -> str | None:
    path = PROTECTED_TRUST_IDENTITY_PATH
    try:
        # The identity itself and each non-system parent must be root-owned and
        # not group/world writable; symlinks are never accepted.
        for candidate in (path.parent.parent, path.parent, path):
            info = candidate.lstat()
            if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or (info.st_mode & 0o022):
                return None
        info = path.lstat()
        if not stat.S_ISREG(info.st_mode):
            return None
        value = path.read_text(encoding="ascii").strip().lower()
    except (OSError, UnicodeError):
        return None
    if len(value) != 64 or any(ch not in "0123456789abcdef" for ch in value):
        return None
    return value


def _protected_trust_identity_blockers(attestation: dict | None, attestation_key) -> list[str]:
    if attestation is None:
        return []

    blockers: list[str] = []
    try:
        anchor = load_trust_anchor()
    except Exception:
        anchor = {"_load_error": True}

    checked_in = None
    if not isinstance(anchor, dict) or anchor.get("_load_error") is True:
        blockers.append("trust_anchor:load_error")
    else:
        if anchor.get("status") != "ACTIVE":
            blockers.append("trust_anchor:not_active")
        checked_in = anchor.get("key_sha256")
        if (
            not isinstance(checked_in, str)
            or len(checked_in) != 64
            or any(ch not in "0123456789abcdefABCDEF" for ch in checked_in)
        ):
            blockers.append("trust_anchor:key_digest_invalid")
            checked_in = None

    key_bytes = attestation_key.encode("utf-8") if isinstance(attestation_key, str) else attestation_key
    actual = None
    if not isinstance(key_bytes, bytes) or len(key_bytes) < 32:
        blockers.append("trust_anchor:verification_key_unavailable")
    else:
        actual = hashlib.sha256(key_bytes).hexdigest()
        if isinstance(checked_in, str) and not _base.hmac.compare_digest(
            actual.lower(), checked_in.lower()
        ):
            blockers.append("trust_anchor:key_identity_mismatch")

    expected = _secure_external_trust_digest()
    if expected is None:
        blockers.append("trust_anchor:protected_identity_unavailable")
    else:
        if isinstance(checked_in, str) and not _base.hmac.compare_digest(
            checked_in.lower(), expected
        ):
            blockers.append("trust_anchor:protected_identity_mismatch")
        if isinstance(actual, str) and not _base.hmac.compare_digest(actual, expected):
            blockers.append("trust_anchor:key_identity_mismatch")

    return list(dict.fromkeys(blockers))


def _round12_input_blockers(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict,
    snapshot,
    *,
    actual_head: str | None,
    actual_target: str | None,
    current_control_plane_fingerprint: str | None,
    attestation: dict | None,
    attestation_key,
    current_trigger_state: dict | None,
) -> list[str]:
    blockers = [
        *_snapshot_shape_blockers(snapshot),
        *_timestamp_shape_blockers(attestation, current_trigger_state),
        *_evidence_boundary_shape_blockers(attestation, invariants, integration),
        *_invariant_registry_blockers(invariants),
        *_impact_registry_blockers(contracts, impact),
    ]
    if isinstance(snapshot, dict):
        blockers.extend(_persisted_completeness_blockers(snapshot))

    if _current._canonical_runtime_mode(integration, contracts, impact, snapshot):
        blockers.extend(_current._canonical_registry_blockers(contracts, integration))
        blockers.extend(_canonical_semantics_blockers(invariants, integration, contracts))
        blockers.extend(_protected_trust_identity_blockers(attestation, attestation_key))
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
    # Validate adversarial input shapes and protected semantics before the
    # inherited evaluator performs normalization, dictionary access, trust
    # decisions or timezone conversion. Invalid/unknown input must BLOCK, never
    # crash, normalize away, or become success.
    early = _round12_input_blockers(
        invariants,
        integration,
        contracts,
        impact,
        snapshot,
        actual_head=actual_head,
        actual_target=actual_target,
        current_control_plane_fingerprint=current_control_plane_fingerprint,
        attestation=attestation,
        attestation_key=attestation_key,
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


def _load_head_project_memory(name: str):
    """Parse the exact HEAD blob, never mutable working-tree bytes, for CLI input."""
    raw = _base._git_show(f"project-memory/{name}")
    if raw is None:
        raise FileNotFoundError(name)
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid HEAD project-memory JSON: {name}") from exc


# Direct imports of the newest wrapper and canonical consumers share the same
# evaluator hook. The CLI additionally swaps the core's CLI hook below so the
# historical core entrypoint cannot bypass round-11/round-12 hardening.
_round11.evaluate_release_decision = evaluate_release_decision
_current.evaluate_release_decision = evaluate_release_decision
_base.evaluate_release_decision = evaluate_release_decision


def main() -> int:
    previous_cli_evaluator = _current._cli_evaluate_release_decision
    previous_load = _base.load
    _current._cli_evaluate_release_decision = _round12_cli_evaluate_release_decision
    # Close the worktree TOCTOU window: the same immutable HEAD blobs that feed
    # the control-plane fingerprint are now the JSON bytes actually evaluated.
    _base.load = _load_head_project_memory
    try:
        # Round 11's executable is intentionally disabled. Enter the canonical
        # core CLI directly while its evaluation hook is bound to round 12.
        return _current.main()
    finally:
        _base.load = previous_load
        _current._cli_evaluate_release_decision = previous_cli_evaluator


if __name__ == "__main__":
    raise SystemExit(main())

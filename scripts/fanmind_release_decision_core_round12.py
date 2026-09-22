#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
from pathlib import Path

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

SUPPORTED_EVIDENCE_ROLES = frozenset(
    role for roles in _base.REQUIRED_EVIDENCE_ROLES.values() for role in roles
)

CANONICAL_IMPACT_SCOPE = {
    "FM-CONTRACT-CREATOR-AI-001": {
        "consumers": ["Creator API/routes", "AI context loaders", "reply generation", "confirmed-chat learning"],
        "tests": ["Creator tenant/context tests", "AI reply tests"],
    },
    "FM-CONTRACT-CHATADMIN-AI-001": {
        "consumers": ["ChatAdmin APIs", "character context", "suggestion generation", "manual handoff UI"],
        "tests": ["ChatAdmin authorization tests", "suggestion count/context tests"],
    },
    "FM-CONTRACT-CHATADMIN-STORAGE-001": {
        "consumers": ["storage.objects policies", "character profile images", "ChatAdmin storage helpers"],
        "tests": ["storage policy/path tests", "cross-workspace negatives"],
    },
    "FM-CONTRACT-SOCIAL-CRM-001": {
        "consumers": ["provider callbacks", "inbound workers", "contacts", "conversations", "messages"],
        "tests": ["inbound idempotency", "tenant mapping", "revocation/delete"],
    },
    "FM-CONTRACT-REG-ENTITLEMENT-001": {
        "consumers": ["registration", "workspace provisioning", "login routing", "Admin CRM"],
        "tests": ["permanent/temp/blocked lifecycle", "direct read/login negatives"],
    },
    "FM-CONTRACT-AI-BILLING-001": {
        "consumers": ["AI cost engine", "usage provider metrics", "tier entitlements", "Stripe bridge", "referral/billing projection"],
        "tests": ["cost arithmetic", "malformed usage", "ledger ordering/idempotency"],
    },
    "FM-CONTRACT-DISCLOSURE-DELETE-001": {
        "consumers": ["Creator disclosure", "ChatAdmin disclosure", "contact/account delete", "provider cleanup"],
        "tests": ["disclosure completeness", "exact-tenant delete", "cross-tenant negatives"],
    },
}

CANONICAL_INVARIANT_MEANINGS = {
    "FM-INV-001": ("workspace_tenant_isolation", "Workspace/tenant data must never cross an authorized workspace boundary."),
    "FM-INV-002": ("chatadmin_authority_boundary", "ChatAdmin is never Platform Admin, Admin CRM, Billing, Operations or service_role."),
    "FM-INV-003": ("no_browser_service_role", "Browser/client code must never receive or exercise service_role authority."),
    "FM-INV-004": ("no_social_or_onlyfans_auto_send_v1", "Social and OnlyFans V1 remain human-send/manual-handoff only unless a separately approved contract supersedes this invariant."),
    "FM-INV-005": ("creator_workspace_uniqueness", "Normal Creator semantics require creators.workspace_id uniqueness for the ordinary Creator path."),
    "FM-INV-006": ("character_context_isolation", "Character context must never cross character or workspace boundaries."),
    "FM-INV-007": ("payment_activation_gate", "No payment or paid-tier activation without satisfied Tax, Billing and Entitlement gates."),
    "FM-INV-008": ("no_normal_web_deploy_db_migration", "Controlled database migrations must never be applied by the normal Web deploy path."),
    "FM-INV-009": ("no_implementation_only_acceptance", "Implementation-only evidence can never produce ACCEPTED or PRODUCTION_CONFIRMED."),
    "FM-INV-010": ("no_automerge_with_blockers", "Auto-merge is forbidden with P1/P2, unresolved review threads, pending required checks or red required checks."),
    "FM-INV-011": ("no_rebuild_closed_scope", "ACCEPTED, VERIFIED, PRODUCTION_CONFIRMED, SUPERSEDED, FAILED or owner-deferred scope must not be rebuilt without a recorded revalidation/reopen reason."),
    "FM-INV-012": ("no_secrets_in_repo_logs_chat", "Secrets, passwords, tokens, private keys and raw protected credentials must never enter Git, logs or chat."),
}


def _strict_identity(value) -> bool:
    return (
        isinstance(value, str)
        and bool(value)
        and value == value.strip()
        and all(ord(ch) >= 0x20 and ch != "\x7f" for ch in value)
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
    invariant_items = invariants.get("invariants") if isinstance(invariants, dict) else None
    mappings = impact.get("mappings") if isinstance(impact, dict) else None
    if isinstance(mappings, list):
        by_contract = {
            item.get("contract"): item
            for item in mappings
            if isinstance(item, dict) and isinstance(item.get("contract"), str)
        }
        for contract_id, expected in CANONICAL_IMPACT_SCOPE.items():
            item = by_contract.get(contract_id)
            if not isinstance(item, dict):
                return [f"canonical_semantics:impact_missing:{contract_id}"]
            if item.get("consumers") != expected["consumers"] or item.get("tests") != expected["tests"]:
                return [f"canonical_semantics:impact_scope_mismatch:{contract_id}"]
    if isinstance(invariant_items, list):
        by_id = {
            item.get("id"): item
            for item in invariant_items
            if isinstance(item, dict) and isinstance(item.get("id"), str)
        }
        for invariant_id, (expected_name, expected_description) in CANONICAL_INVARIANT_MEANINGS.items():
            item = by_id.get(invariant_id)
            if not isinstance(item, dict):
                return [f"canonical_semantics:invariant_missing:{invariant_id}"]
            if item.get("name") != expected_name or item.get("description") != expected_description:
                return [f"canonical_semantics:invariant_meaning_mismatch:{invariant_id}"]
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


def _attestation_boundary_blockers(attestation: dict | None, snapshot: dict) -> list[str]:
    """Validate signed-evidence authority without normalizing unsafe input away."""
    if not isinstance(attestation, dict):
        return []
    evidence = attestation.get("evidence")
    if not isinstance(evidence, list):
        return []

    blockers: list[str] = []
    attested_ids: set[str] = set()
    for entry in evidence:
        if not isinstance(entry, dict):
            continue
        evidence_id = entry.get("id")
        label = evidence_id if _strict_identity(evidence_id) else "<invalid>"
        if _strict_identity(evidence_id):
            attested_ids.add(evidence_id)
        else:
            blockers.append("release_evidence:id_invalid")

        status = entry.get("status")
        if not isinstance(status, str):
            # Keep the established not_current prefix so existing consumers and
            # regressions see the same fail-closed class without ever performing
            # set membership on an unhashable status value.
            blockers.append(f"release_evidence:not_current:{label}:invalid_status_type")

        roles = entry.get("roles")
        if roles is not None:
            if not isinstance(roles, list) or any(
                not isinstance(role, str) or not role for role in roles
            ):
                blockers.append(f"release_evidence:roles_invalid:{label}")
            else:
                for role in roles:
                    if role not in SUPPORTED_EVIDENCE_ROLES:
                        blockers.append(f"release_evidence:role_unknown:{label}:{role}")
        role = entry.get("role")
        if role is not None:
            if not isinstance(role, str) or not role:
                blockers.append(f"release_evidence:role_invalid:{label}")
            elif role not in SUPPORTED_EVIDENCE_ROLES:
                blockers.append(f"release_evidence:role_unknown:{label}:{role}")

    bindings = snapshot.get("evidence_bindings") if isinstance(snapshot, dict) else None
    if isinstance(bindings, list):
        binding_ids = {
            binding.get("id")
            for binding in bindings
            if isinstance(binding, dict)
            and _strict_identity(binding.get("id"))
        }
        if attested_ids != binding_ids:
            blockers.append("attestation:evidence_binding_set_mismatch")

    return list(dict.fromkeys(blockers))


def _fatal_attestation_shape_blockers(blockers: list[str]) -> list[str]:
    """Return only defects that could make the retained evaluator throw."""
    prefixes = (
        "release_evidence:not_current:",
        "release_evidence:roles_invalid:",
        "release_evidence:role_invalid:",
    )
    return [reason for reason in blockers if reason.startswith(prefixes)]


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
    synthetic_test_requested = (
        _base.os.environ.get("FANMIND_GOD_MODE_TEST_ONLY_SYNTHETIC") == "1"
    )

    boundary_blockers = _attestation_boundary_blockers(attestation, snapshot)
    fatal_shape_blockers = _fatal_attestation_shape_blockers(boundary_blockers)
    if fatal_shape_blockers:
        return "BLOCK", list(dict.fromkeys(fatal_shape_blockers))

    requirement_blockers = _evidence_requirement_claim_blockers(attestation, integration)
    canonical = _current._canonical_runtime_mode(integration, contracts, impact, snapshot)
    synthetic_test_bypass = synthetic_test_requested and not canonical
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
        extra_blockers = [*boundary_blockers, *requirement_blockers]
        if extra_blockers:
            return "BLOCK", list(dict.fromkeys([*reasons, *extra_blockers]))
        if decision != "BLOCK" and not synthetic_test_bypass:
            checked_out_head = _base.current_git_head()
            if not isinstance(actual_head, str) or not _current._round8.git_commit_resolves(actual_head):
                return "BLOCK", ["release_evidence:actual_head_unresolvable"]
            if not isinstance(checked_out_head, str) or actual_head != checked_out_head:
                return "BLOCK", ["release_evidence:actual_head_not_checked_out_head"]
        return decision, reasons
    finally:
        _legacy.load_trust_anchor = previous_legacy_loader


def _evidence_requirement_claim_blockers(attestation: dict | None, integration: dict) -> list[str]:
    if not isinstance(attestation, dict):
        return []
    gates = integration.get("gates") if isinstance(integration, dict) else None
    configured: dict[str, set[str]] = {}
    blockers: list[str] = []
    for gate in gates if isinstance(gates, list) else []:
        if not isinstance(gate, dict) or not isinstance(gate.get("id"), str):
            continue
        gate_id = gate["id"]
        required = gate.get("evidence_required")
        if (
            not isinstance(required, list)
            or any(not _strict_identity(value) for value in required)
            or len(set(required)) != len(required)
        ):
            blockers.append(f"release_evidence:configured_requirements_invalid:{gate_id}")
            continue
        configured[gate_id] = set(required)
    evidence = attestation.get("evidence")
    for entry in evidence if isinstance(evidence, list) else []:
        if not isinstance(entry, dict) or "requirements" not in entry:
            continue
        claims = entry.get("requirements")
        if not isinstance(claims, dict):
            blockers.append("release_evidence:requirements_invalid")
            continue
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


def _exact_head_cli_evaluate_release_decision(*args, **kwargs):
    """Canonical CLI boundary: supplied release SHA must be this checkout's HEAD."""
    actual_head = kwargs.get("actual_head")
    checked_out_head = _base.current_git_head()
    if not _current._round8.git_commit_resolves(actual_head):
        return "BLOCK", ["release_evidence:actual_head_unresolvable"]
    if not isinstance(checked_out_head, str) or actual_head != checked_out_head:
        return "BLOCK", ["release_evidence:actual_head_not_checked_out_head"]
    return evaluate_release_decision(*args, **kwargs)


def load_trust_anchor() -> dict:
    """Load reviewed trust-anchor bytes from immutable HEAD, never mutable worktree."""
    try:
        value = globals()["_load_head_project_memory"]("GOD_MODE_TRUST_ANCHOR.json")
    except Exception:
        return {"_load_error": True}
    return value if isinstance(value, dict) else {"_load_error": True}


def _safe_external_json(path_value: str | None) -> dict | None:
    """Load external signed JSON fail-closed, including invalid UTF-8."""
    if not path_value:
        return None
    try:
        value = json.loads(Path(path_value).read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        return {"_load_error": True}
    return value if isinstance(value, dict) else {"_load_error": True}


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
        "EVIDENCE_FRESHNESS.json",
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
    previous_cli = _legacy._round12_cli_evaluate_release_decision
    previous_attestation_loader = _base._load_attestation
    previous_trigger_loader = _base._load_current_trigger_state
    _legacy._load_head_project_memory = globals()["_load_head_project_memory"]
    _legacy._round12_cli_evaluate_release_decision = _exact_head_cli_evaluate_release_decision
    _base._load_attestation = _safe_external_json
    _base._load_current_trigger_state = _safe_external_json
    try:
        return _legacy.main()
    finally:
        _base._load_current_trigger_state = previous_trigger_loader
        _base._load_attestation = previous_attestation_loader
        _legacy._round12_cli_evaluate_release_decision = previous_cli
        _legacy._load_head_project_memory = previous_loader


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os

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
            "project-memory/GOD_MODE_TRUST_ANCHOR.json",
        )
    )
)
CONTROL_PLANE_FILES = _base.CONTROL_PLANE_FILES

CANONICAL_GOD_MODE_TASK = "FM-GOV-GODMODE-001"
TRUST_ANCHOR_FILE = "GOD_MODE_TRUST_ANCHOR.json"
TEST_ONLY_SYNTHETIC_ENV = "FANMIND_GOD_MODE_TEST_ONLY_SYNTHETIC"
TEST_ONLY_SYNTHETIC_TARGET = "repository:synthetic"
TEST_ONLY_SYNTHETIC_CONTRACT_IDS = {"FM-CONTRACT-A", "FM-CONTRACT-B"}
TEST_ONLY_SYNTHETIC_GATE_IDS = {"FM-IGATE-A", "FM-IGATE-B"}
REQUIRED_CONTRACT_IDS = {
    "FM-CONTRACT-CREATOR-AI-001",
    "FM-CONTRACT-CHATADMIN-AI-001",
    "FM-CONTRACT-CHATADMIN-STORAGE-001",
    "FM-CONTRACT-SOCIAL-CRM-001",
    "FM-CONTRACT-REG-ENTITLEMENT-001",
    "FM-CONTRACT-AI-BILLING-001",
    "FM-CONTRACT-DISCLOSURE-DELETE-001",
}
REQUIRED_GATE_IDS = {
    "FM-IGATE-CREATOR-AI-001",
    "FM-IGATE-CHATADMIN-AI-001",
    "FM-IGATE-CHATADMIN-STORAGE-001",
    "FM-IGATE-SOCIAL-CRM-001",
    "FM-IGATE-REG-ENTITLEMENT-001",
    "FM-IGATE-AI-BILLING-001",
    "FM-IGATE-DISCLOSURE-DELETE-001",
}
CANONICAL_CONTRACT_REVALIDATION = {
    "FM-CONTRACT-CREATOR-AI-001": (
        "creator_schema_change",
        "ai_context_change",
        "reply_profile_change",
        "entitlement_change",
    ),
    "FM-CONTRACT-CHATADMIN-AI-001": (
        "character_schema_change",
        "chatadmin_authority_change",
        "ai_context_change",
    ),
    "FM-CONTRACT-CHATADMIN-STORAGE-001": (
        "storage_policy_change",
        "path_contract_change",
        "workspace_or_character_schema_change",
    ),
    "FM-CONTRACT-SOCIAL-CRM-001": (
        "provider_payload_change",
        "crm_schema_change",
        "identity_mapping_change",
        "delete_disclosure_change",
    ),
    "FM-CONTRACT-REG-ENTITLEMENT-001": (
        "registration_change",
        "workspace_change",
        "entitlement_change",
        "billing_route_change",
    ),
    "FM-CONTRACT-AI-BILLING-001": (
        "price_catalog_change",
        "usage_schema_change",
        "entitlement_change",
        "stripe_lifecycle_change",
    ),
    "FM-CONTRACT-DISCLOSURE-DELETE-001": (
        "schema_change",
        "new_personal_data_field",
        "new_provider_payload",
        "delete_flow_change",
    ),
}
_CANONICAL_CLI_ACTIVE = False


def _higher_risk(left: str, right: str) -> str:
    return right if _base.RISK_ORDER[right] > _base.RISK_ORDER[left] else left


def load_trust_anchor() -> dict:
    """Load the independently pinned producer-key identity from canonical memory."""
    try:
        value = _base.load(TRUST_ANCHOR_FILE)
    except Exception:
        return {"_load_error": True}
    return value if isinstance(value, dict) else {"_load_error": True}


def _ids(document: dict, key: str) -> set[str]:
    items = document.get(key) if isinstance(document, dict) else None
    if not isinstance(items, list):
        return set()
    return {
        item.get("id")
        for item in items
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    }


def _canonical_runtime_mode(*documents: dict) -> bool:
    """Return True except for an explicit, structurally synthetic test fixture.

    Canonical trust is the default for every direct evaluator call. Contributor-
    controlled task markers never select a weaker mode. The sole opt-out requires
    the dedicated test environment marker plus either the harmless exact
    `repository:synthetic` target used by noncanonical review fixtures, or the
    exact A/B synthetic registry identities used for namespace-negative tests.
    Presence of any real canonical registry identity forces canonical mode even
    when the test variable or synthetic-looking snapshot fields are supplied.
    """
    if _CANONICAL_CLI_ACTIVE:
        return True
    if os.environ.get(TEST_ONLY_SYNTHETIC_ENV) != "1":
        return True

    contract_documents = [
        document for document in documents
        if isinstance(document, dict) and "contracts" in document
    ]
    gate_documents = [
        document for document in documents
        if isinstance(document, dict) and "gates" in document
    ]
    if any(_ids(document, "contracts") == REQUIRED_CONTRACT_IDS for document in contract_documents):
        return True
    if any(_ids(document, "gates") == REQUIRED_GATE_IDS for document in gate_documents):
        return True

    synthetic_repository_target = any(
        isinstance(document, dict)
        and document.get("evaluated_target") == TEST_ONLY_SYNTHETIC_TARGET
        for document in documents
    )
    synthetic_registry_pair = (
        any(_ids(document, "contracts") == TEST_ONLY_SYNTHETIC_CONTRACT_IDS for document in contract_documents)
        and any(_ids(document, "gates") == TEST_ONLY_SYNTHETIC_GATE_IDS for document in gate_documents)
    )
    no_registry_documents = not contract_documents and not gate_documents
    synthetic_snapshot = no_registry_documents and any(
        isinstance(document, dict)
        and isinstance(document.get("affected_contracts"), list)
        and set(document.get("affected_contracts", [])) == TEST_ONLY_SYNTHETIC_CONTRACT_IDS
        for document in documents
    )
    return not (synthetic_repository_target or synthetic_registry_pair or synthetic_snapshot)


def _canonical_registry_blockers(contracts: dict, integration: dict) -> list[str]:
    blockers: list[str] = []
    contract_items = contracts.get("contracts") if isinstance(contracts, dict) else None
    gate_items = integration.get("gates") if isinstance(integration, dict) else None

    contract_ids = {
        item.get("id")
        for item in contract_items
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    } if isinstance(contract_items, list) else set()
    gate_ids = {
        item.get("id")
        for item in gate_items
        if isinstance(item, dict) and isinstance(item.get("id"), str)
    } if isinstance(gate_items, list) else set()

    if contract_ids != REQUIRED_CONTRACT_IDS:
        blockers.append("contract_registry:canonical_set_mismatch")
    if gate_ids != REQUIRED_GATE_IDS:
        blockers.append("integration_gate:canonical_set_mismatch")
    return blockers


def _canonical_contract_semantics_blockers(contracts: dict) -> list[str]:
    """Pin external-state invalidation semantics independently of JSON policy."""
    contract_items = contracts.get("contracts") if isinstance(contracts, dict) else None
    if not isinstance(contract_items, list):
        return ["canonical_semantics:contract_revalidation_invalid"]
    actual: dict[str, tuple[str, ...]] = {}
    for item in contract_items:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            continue
        triggers = item.get("revalidate_on")
        if (
            not isinstance(triggers, list)
            or any(not isinstance(trigger, str) or not trigger for trigger in triggers)
            or len(set(triggers)) != len(triggers)
        ):
            return ["canonical_semantics:contract_revalidation_invalid"]
        actual[item["id"]] = tuple(triggers)
    if actual != CANONICAL_CONTRACT_REVALIDATION:
        return ["canonical_semantics:contract_revalidation_mismatch"]
    return []


def _trusted_key_blockers(attestation_key: str | bytes | None) -> list[str]:
    anchor = load_trust_anchor()
    blockers: list[str] = []
    if anchor.get("_load_error") is True:
        return ["trust_anchor:load_error"]
    if type(anchor.get("schema_version")) is not int or anchor.get("schema_version") != 1:
        blockers.append("trust_anchor:schema_invalid")
    if anchor.get("algorithm") != "HMAC-SHA256":
        blockers.append("trust_anchor:algorithm_invalid")
    if anchor.get("status") != "ACTIVE":
        blockers.append("trust_anchor:not_active")

    digest = anchor.get("key_sha256")
    if (
        not isinstance(digest, str)
        or len(digest) != 64
        or any(ch not in "0123456789abcdefABCDEF" for ch in digest)
    ):
        blockers.append("trust_anchor:key_digest_invalid")

    key_bytes = attestation_key.encode("utf-8") if isinstance(attestation_key, str) else attestation_key
    if not isinstance(key_bytes, bytes) or len(key_bytes) < 32:
        blockers.append("trust_anchor:verification_key_unavailable")
    elif isinstance(digest, str) and len(digest) == 64:
        actual_digest = hashlib.sha256(key_bytes).hexdigest()
        if not _base.hmac.compare_digest(actual_digest.lower(), digest.lower()):
            blockers.append("trust_anchor:key_identity_mismatch")
    return blockers


def _load_head_json(path: str):
    raw = _base._git_show(path)
    if raw is None:
        return None
    try:
        return json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        return None


def _canonical_head_input_blockers(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict,
    snapshot: dict,
    ttl_policy: dict | None,
    current_control_plane_fingerprint: str | None,
) -> list[str]:
    """Authenticate direct evaluator inputs against the immutable current HEAD."""
    blockers: list[str] = []
    expected_fingerprint = _base.control_plane_fingerprint()
    if (
        not isinstance(current_control_plane_fingerprint, str)
        or expected_fingerprint is None
        or not _base.hmac.compare_digest(current_control_plane_fingerprint, expected_fingerprint)
    ):
        blockers.append("canonical_control_plane:fingerprint_mismatch")

    expected = {
        "SYSTEM_INVARIANTS.json": invariants,
        "INTEGRATION_GATES.json": integration,
        "CONTRACT_REGISTRY.json": contracts,
        "IMPACT_MAP.json": impact,
        "RELEASE_DECISION.json": snapshot,
        "EVIDENCE_TTL_POLICY.json": ttl_policy,
    }
    for name, supplied in expected.items():
        head_value = _load_head_json(f"project-memory/{name}")
        if head_value is None:
            blockers.append(f"canonical_control_plane:head_document_unavailable:{name}")
        elif supplied != head_value:
            blockers.append(f"canonical_control_plane:document_mismatch:{name}")
    return blockers


def _target_identifier_blockers(operation, target) -> list[str]:
    if not isinstance(operation, str) or not isinstance(target, str):
        return []  # the inherited evaluator owns missing/type errors

    prefixes: tuple[str, ...] | None = None
    if operation in _base.REPOSITORY_OPERATIONS:
        prefixes = ("repository:",)
    elif operation in _base.PROTECTED_OPERATIONS:
        prefixes = _base.PROTECTED_OPERATION_TARGET_PREFIXES[operation]
    if prefixes is None:
        return []

    matching = next((prefix for prefix in prefixes if target.startswith(prefix)), None)
    if matching is None:
        return []  # namespace mismatch is reported by the inherited evaluator
    identifier = target[len(matching) :]
    if (
        not identifier
        or identifier != identifier.strip()
        or any(ch.isspace() or ord(ch) < 32 for ch in identifier)
        or len(identifier) > 512
    ):
        return ["release_input:target_identifier_invalid"]
    return []


def _evidence_role_shape_blockers(attestation: dict | None) -> list[str]:
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
        roles = entry.get("roles")
        singular = entry.get("role")
        if roles is not None:
            if (
                not isinstance(roles, list)
                or not roles
                or any(not isinstance(role, str) or not role for role in roles)
                or len(set(roles)) != len(roles)
            ):
                blockers.append(f"release_evidence:roles_invalid:{marker}")
            if singular is not None:
                blockers.append(f"release_evidence:roles_ambiguous:{marker}")
        elif singular is not None and (not isinstance(singular, str) or not singular):
            blockers.append(f"release_evidence:roles_invalid:{marker}")
    return blockers


def _canonical_runtime_input_blockers(
    invariants: dict,
    integration: dict,
    contracts: dict,
    impact: dict,
    snapshot: dict,
    ttl_policy: dict | None,
    *,
    actual_head: str | None,
    actual_target: str | None,
    current_control_plane_fingerprint: str | None,
    attestation: dict | None,
    attestation_key: str | bytes | None,
    current_trigger_state: dict | None,
) -> list[str]:
    """Close canonical runtime gaps that structural preflight cannot be trusted to cover."""

    blockers: list[str] = []

    blockers.extend(_target_identifier_blockers(snapshot.get("operation"), actual_target))
    blockers.extend(_evidence_role_shape_blockers(attestation))

    canonical_mode = _canonical_runtime_mode(integration, contracts, impact, snapshot)
    if canonical_mode:
        blockers.extend(_canonical_registry_blockers(contracts, integration))
        blockers.extend(_canonical_contract_semantics_blockers(contracts))
        blockers.extend(
            _canonical_head_input_blockers(
                invariants,
                integration,
                contracts,
                impact,
                snapshot,
                ttl_policy,
                current_control_plane_fingerprint,
            )
        )
        if attestation is not None:
            blockers.extend(_trusted_key_blockers(attestation_key))

        # The separately protected current-trigger-state producer must be bound
        # to the same exact release context as the evidence attestation.
        if isinstance(current_trigger_state, dict):
            if current_trigger_state.get("release_sha") != actual_head:
                blockers.append("trigger_state:release_sha_mismatch")
            if current_trigger_state.get("target") != actual_target:
                blockers.append("trigger_state:target_mismatch")
            if current_trigger_state.get("control_plane_fingerprint") != current_control_plane_fingerprint:
                blockers.append("trigger_state:control_plane_mismatch")

    # The separately protected current-trigger-state producer uses the same exact
    # schema-version rule as the evidence attestation and checked-in control
    # plane. Python bool/float equality must not make True or 1.0 look like v1.
    if isinstance(current_trigger_state, dict):
        schema_version = current_trigger_state.get("schema_version")
        if type(schema_version) is not int or schema_version != 1:
            blockers.append("trigger_state:schema_invalid")

    # Contract revalidation metadata is security-relevant runtime input. Every
    # affected contract must carry a non-empty list of concrete trigger names.
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
    # implementation proof by padding its role list with an inert role.
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
    """Evaluator with canonical trust enforcement by default for direct callers."""
    if len(args) < 6:
        return "BLOCK", ["release_input:canonical_arguments_missing"]
    invariants = args[0]
    integration = args[1]
    contracts = args[2]
    impact = args[3]
    snapshot = args[5]
    ttl_policy = args[6] if len(args) > 6 else kwargs.get("ttl_policy")
    early = _canonical_runtime_input_blockers(
        invariants,
        integration,
        contracts,
        impact,
        snapshot,
        ttl_policy,
        actual_head=kwargs.get("actual_head"),
        actual_target=kwargs.get("actual_target"),
        current_control_plane_fingerprint=kwargs.get("current_control_plane_fingerprint"),
        attestation=kwargs.get("attestation"),
        attestation_key=kwargs.get("attestation_key"),
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
    global _CANONICAL_CLI_ACTIVE
    previous = _base.evaluate_release_decision
    previous_cli_mode = _CANONICAL_CLI_ACTIVE
    _CANONICAL_CLI_ACTIVE = True
    _base.evaluate_release_decision = _cli_evaluate_release_decision
    try:
        return _base.main()
    finally:
        _base.evaluate_release_decision = previous
        _CANONICAL_CLI_ACTIVE = previous_cli_mode


# Direct imports use the fully hardened evaluator; canonical CLI execution swaps
# this hook temporarily to the stricter Git-object-resolving wrapper above.
_base.evaluate_release_decision = evaluate_release_decision


if __name__ == "__main__":
    # Historical direct execution must traverse the newest hardened wrapper.
    # Import lazily to avoid a circular import during normal module loading.
    from fanmind_release_decision_core_round12 import main as _round12_main

    raise SystemExit(_round12_main())

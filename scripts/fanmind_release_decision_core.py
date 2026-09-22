#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import hmac
import json
import os
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
RISK_ORDER = {"R1": 1, "R2": 2, "R3": 3, "R4": 4}
CURRENT_EVIDENCE_STATES = {"VERIFIED", "COUNTERCHECKED", "ACCEPTED", "PRODUCTION_CONFIRMED"}
REQUIRED_EVIDENCE_ROLES = {
    "R1": {"evidence"},
    "R2": {"implementation", "countercheck", "negative"},
    "R3": {"implementation", "countercheck", "negative", "recovery"},
    "R4": {"implementation", "countercheck", "negative", "recovery"},
}
ROLE_SNAPSHOT_FIELDS = {
    "implementation": "implementation_evidence_id",
    "countercheck": "countercheck_evidence_id",
    "negative": "negative_evidence_id",
    "recovery": "rollback_recovery_evidence_id",
}
CONTROL_PLANE_FILES = (
    ".github/workflows/fanmind-god-mode-gate.yml",
    "scripts/fanmind_god_mode_preflight.py",
    "scripts/fanmind_release_decision.py",
    "scripts/fanmind_release_decision_core.py",
    "project-memory/GOD_MODE_POLICY.md",
    "project-memory/SYSTEM_INVARIANTS.json",
    "project-memory/CONTRACT_REGISTRY.json",
    "project-memory/INTEGRATION_GATES.json",
    "project-memory/IMPACT_MAP.json",
    "project-memory/EVIDENCE_TTL_POLICY.json",
)
ATTESTATION_ISSUER = "fanmind-protected-evidence-producer-v1"
ATTESTATION_MAX_LIFETIME = timedelta(hours=2)
REPOSITORY_OPERATIONS = {
    "repository_review",
    "repository_merge",
    "repository_governance",
    "repository_release",
}
PROTECTED_OPERATIONS = {
    "staging_verify",
    "staging_apply",
    "staging_accept",
    "production_deploy",
    "production_apply",
    "production_accept",
    "database_write",
    "provider_change",
    "billing_change",
    "restore_write",
    "capability_grant",
    "destructive_action",
}


def load(name: str):
    return json.loads((PM / name).read_text(encoding="utf-8"))


def current_git_head() -> str | None:
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True, stderr=subprocess.DEVNULL
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None


def _git_show(path: str) -> bytes | None:
    try:
        return subprocess.check_output(
            ["git", "show", f"HEAD:{path}"], cwd=ROOT, stderr=subprocess.DEVNULL
        )
    except (OSError, subprocess.CalledProcessError):
        return None


def _tracked_file_matches_head(path: str) -> bool:
    expected = _git_show(path)
    if expected is None:
        return False
    try:
        return (ROOT / path).read_bytes() == expected
    except OSError:
        return False


def control_plane_fingerprint() -> str | None:
    digest = hashlib.sha256()
    for rel in CONTROL_PLANE_FILES:
        expected = _git_show(rel)
        if expected is None:
            return None
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        digest.update(expected)
        digest.update(b"\0")
    return digest.hexdigest()


def _exact_bool(value) -> bool:
    return type(value) is bool


def _exact_nonnegative_int(value) -> bool:
    return type(value) is int and value >= 0


def _parse_time(value) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _canonical_json(value: dict) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sign_attestation(attestation: dict, key: str | bytes) -> str:
    """Test/producer helper. The key must come from a protected producer, never Git."""
    key_bytes = key.encode("utf-8") if isinstance(key, str) else key
    payload = dict(attestation)
    payload.pop("signature", None)
    return "hmac-sha256:" + hmac.new(key_bytes, _canonical_json(payload), hashlib.sha256).hexdigest()


def _authenticate_attestation(
    attestation: dict | None,
    attestation_key: str | bytes | None,
    actual_head: str | None,
    actual_target: str | None,
    control_fingerprint: str | None,
    now: datetime,
) -> tuple[list[dict], dict[str, str], list[str]]:
    blockers: list[str] = []
    if not isinstance(attestation, dict):
        return [], {}, ["attestation:missing"]
    key_bytes = (
        attestation_key.encode("utf-8")
        if isinstance(attestation_key, str)
        else attestation_key
    )
    if not isinstance(key_bytes, bytes) or len(key_bytes) < 32:
        blockers.append("attestation:protected_key_unavailable")
    if attestation.get("schema_version") != 1:
        blockers.append("attestation:schema_invalid")
    if attestation.get("issuer") != ATTESTATION_ISSUER:
        blockers.append("attestation:issuer_invalid")
    if attestation.get("release_sha") != actual_head:
        blockers.append("attestation:release_sha_mismatch")
    if attestation.get("target") != actual_target:
        blockers.append("attestation:target_mismatch")
    if attestation.get("control_plane_fingerprint") != control_fingerprint:
        blockers.append("attestation:control_plane_mismatch")

    issued = _parse_time(attestation.get("issued_at"))
    expires = _parse_time(attestation.get("expires_at"))
    if issued is None or expires is None:
        blockers.append("attestation:time_invalid")
    else:
        if issued > now + timedelta(minutes=5):
            blockers.append("attestation:issued_at_future")
        if expires <= now:
            blockers.append("attestation:expired")
        if expires <= issued or expires - issued > ATTESTATION_MAX_LIFETIME:
            blockers.append("attestation:lifetime_invalid")

    signature = attestation.get("signature")
    if not isinstance(signature, str) or not signature.startswith("hmac-sha256:"):
        blockers.append("attestation:signature_invalid")
    elif isinstance(key_bytes, bytes) and len(key_bytes) >= 32:
        expected = sign_attestation(attestation, key_bytes)
        if not hmac.compare_digest(signature, expected):
            blockers.append("attestation:signature_mismatch")

    trigger_state = attestation.get("trigger_state")
    if not isinstance(trigger_state, dict) or any(
        not isinstance(k, str) or not k or not isinstance(v, str) or not v
        for k, v in (trigger_state.items() if isinstance(trigger_state, dict) else [])
    ):
        blockers.append("attestation:trigger_state_invalid")
        trigger_state = {}

    evidence = attestation.get("evidence")
    if not isinstance(evidence, list):
        blockers.append("attestation:evidence_invalid")
        evidence = []
    return evidence, trigger_state, blockers


def _validate_impact_map(impact: dict) -> tuple[dict[str, dict], list[str]]:
    mappings = impact.get("mappings")
    if not isinstance(mappings, list):
        return {}, ["impact_map:mappings_invalid"]
    blockers: list[str] = []
    result: dict[str, dict] = {}
    for item in mappings:
        if not isinstance(item, dict):
            blockers.append("impact_map:mapping_invalid")
            continue
        contract_id = item.get("contract")
        if not isinstance(contract_id, str) or not contract_id:
            blockers.append("impact_map:contract_invalid")
            continue
        if contract_id in result:
            blockers.append(f"impact_map:duplicate_contract:{contract_id}")
            continue
        result[contract_id] = item
    return result, blockers


def _required_gate_ids(
    affected_contracts: list[str], impact: dict
) -> tuple[set[str], dict[str, set[str]], list[str]]:
    by_contract, blockers = _validate_impact_map(impact)
    gate_ids: set[str] = set()
    contract_gates: dict[str, set[str]] = {}
    for contract_id in affected_contracts:
        mapping = by_contract.get(contract_id)
        if mapping is None:
            blockers.append(f"impact_map:missing:{contract_id}")
            continue
        mapped = mapping.get("gates")
        if not isinstance(mapped, list) or not mapped:
            blockers.append(f"impact_map:gates_missing:{contract_id}")
            continue
        current: set[str] = set()
        for gate_id in mapped:
            if not isinstance(gate_id, str) or not gate_id:
                blockers.append(f"impact_map:gate_invalid:{contract_id}")
                continue
            current.add(gate_id)
            gate_ids.add(gate_id)
        contract_gates[contract_id] = current
    return gate_ids, contract_gates, blockers


def _registry_by_id(items, prefix: str) -> tuple[dict[str, dict], list[str]]:
    if not isinstance(items, list):
        return {}, [f"{prefix}:registry_invalid"]
    blockers: list[str] = []
    result: dict[str, dict] = {}
    for item in items:
        if not isinstance(item, dict):
            blockers.append(f"{prefix}:entry_invalid")
            continue
        item_id = item.get("id")
        if not isinstance(item_id, str) or not item_id:
            blockers.append(f"{prefix}:id_invalid")
            continue
        if item_id in result:
            blockers.append(f"{prefix}:duplicate:{item_id}")
            continue
        result[item_id] = item
    return result, blockers


def _scope_risk_floor(affected: list[str], contracts: dict[str, dict]) -> tuple[str, list[str]]:
    floor = "R1"
    blockers: list[str] = []
    for contract_id in affected:
        contract = contracts.get(contract_id)
        if contract is None:
            continue
        minimum = contract.get("minimum_risk")
        if minimum not in RISK_ORDER:
            blockers.append(f"contract:risk_floor_invalid:{contract_id}")
            continue
        if RISK_ORDER[minimum] > RISK_ORDER[floor]:
            floor = minimum
    return floor, blockers


def _class_policy(evidence_class: str, ttl_policy: dict) -> tuple[dict | None, str | None]:
    policy = ttl_policy.get("policy")
    if not isinstance(policy, dict):
        return None, "ttl_policy:policy_invalid"
    entry = policy.get(evidence_class)
    if not isinstance(entry, dict):
        return None, f"ttl_policy:unknown_class:{evidence_class}"
    ttl_hours = entry.get("ttl_hours")
    if ttl_hours is not None and (
        isinstance(ttl_hours, bool) or not isinstance(ttl_hours, (int, float)) or ttl_hours < 0
    ):
        return None, f"ttl_policy:ttl_invalid:{evidence_class}"
    triggers = entry.get("revalidate_on")
    if not isinstance(triggers, list) or not triggers or any(
        not isinstance(trigger, str) or not trigger for trigger in triggers
    ):
        return None, f"ttl_policy:revalidate_invalid:{evidence_class}"
    return entry, None


def _entry_roles(entry: dict) -> set[str]:
    roles = entry.get("roles")
    if isinstance(roles, list):
        return {role for role in roles if isinstance(role, str) and role}
    role = entry.get("role")
    return {role} if isinstance(role, str) and role else set()


def _entry_set(entry: dict, plural: str, singular: str) -> set[str]:
    result: set[str] = set()
    values = entry.get(plural)
    if isinstance(values, list):
        result.update(value for value in values if isinstance(value, str) and value)
    value = entry.get(singular)
    if isinstance(value, str) and value:
        result.add(value)
    return result


def _entry_provenance(entry: dict) -> tuple[str, str, str] | None:
    provenance = entry.get("provenance")
    if not isinstance(provenance, dict):
        return None
    values = tuple(provenance.get(k) for k in ("source", "execution_id", "independence_key"))
    if not all(isinstance(value, str) and value for value in values):
        return None
    return values  # type: ignore[return-value]


def _independent(left: dict, right: dict) -> bool:
    lp = _entry_provenance(left)
    rp = _entry_provenance(right)
    return bool(lp and rp and all(a != b for a, b in zip(lp, rp)))


def _required_roles_for_gate(gate: dict, risk: str) -> tuple[set[str], str | None]:
    required = REQUIRED_EVIDENCE_ROLES[risk]
    configured = gate.get("required_roles")
    if configured is None:
        return set(required), None
    if not isinstance(configured, list) or not configured:
        return set(), "required_roles_invalid"
    configured_roles = {role for role in configured if isinstance(role, str) and role}
    if len(configured_roles) != len(configured):
        return set(), "required_roles_invalid"
    allowed = {"evidence", "implementation", "countercheck", "negative", "recovery"}
    if configured_roles - allowed:
        return set(), "required_roles_invalid"
    if not required.issubset(configured_roles):
        return set(), "required_roles_weaker_than_risk"
    return configured_roles, None


def _derive_protected_action(operation, target) -> tuple[bool | None, str | None]:
    if not isinstance(operation, str) or not operation:
        return None, "release_input:operation"
    if not isinstance(target, str) or not target:
        return None, "release_input:target"
    if operation in REPOSITORY_OPERATIONS:
        if target.startswith("repository:"):
            return False, None
        return None, "release_input:repository_operation_target_mismatch"
    if operation in PROTECTED_OPERATIONS:
        return True, None
    return None, f"release_input:unknown_operation:{operation}"


def _validate_bound_evidence(
    snapshot: dict,
    evidence_entries: list[dict],
    trigger_state: dict[str, str],
    ttl_policy: dict,
    actual_head: str | None,
    actual_target: str | None,
    effective_risk: str | None,
    mandatory_gate_ids: set[str],
    contract_gates: dict[str, set[str]],
    gate_by_id: dict[str, dict],
    invariant_ids: set[str],
    control_fingerprint: str | None,
    now: datetime,
) -> list[str]:
    blockers: list[str] = []
    if not isinstance(actual_head, str) or len(actual_head) != 40:
        return ["release_evidence:actual_head_missing"]
    if not isinstance(actual_target, str) or not actual_target:
        return ["release_evidence:actual_target_missing"]
    if snapshot.get("evaluated_commit") != actual_head:
        blockers.append("release_evidence:evaluated_commit_mismatch")
    if snapshot.get("evaluated_target") != actual_target:
        blockers.append("release_evidence:evaluated_target_mismatch")
    if not isinstance(control_fingerprint, str) or len(control_fingerprint) != 64:
        blockers.append("release_evidence:control_plane_fingerprint_unavailable")

    bindings = snapshot.get("evidence_bindings")
    if not isinstance(bindings, list):
        return blockers + ["release_evidence:bindings_invalid"]
    by_id, registry_blockers = _registry_by_id(evidence_entries, "release_evidence")
    blockers.extend(registry_blockers)
    valid: dict[str, dict] = {}
    binding_ids: set[str] = set()

    for binding in bindings:
        if not isinstance(binding, dict):
            blockers.append("release_evidence:binding_invalid")
            continue
        evidence_id = binding.get("id")
        if not isinstance(evidence_id, str) or not evidence_id:
            blockers.append("release_evidence:binding_id_invalid")
            continue
        if evidence_id in binding_ids:
            blockers.append(f"release_evidence:duplicate_binding:{evidence_id}")
            continue
        binding_ids.add(evidence_id)
        entry = by_id.get(evidence_id)
        if entry is None:
            blockers.append(f"release_evidence:unknown:{evidence_id}")
            continue
        bad = False
        if entry.get("status") not in CURRENT_EVIDENCE_STATES:
            blockers.append(f"release_evidence:not_current:{evidence_id}:{entry.get('status')}")
            bad = True
        if entry.get("bound_commit") != actual_head or binding.get("commit") != actual_head:
            blockers.append(f"release_evidence:commit_mismatch:{evidence_id}")
            bad = True
        if entry.get("target") != actual_target or binding.get("target") != actual_target:
            blockers.append(f"release_evidence:target_mismatch:{evidence_id}")
            bad = True
        if entry.get("invalidated_by") or entry.get("superseded_by"):
            blockers.append(f"release_evidence:invalidated:{evidence_id}")
            bad = True
        evidence_class = entry.get("class")
        class_policy = None
        if not isinstance(evidence_class, str) or not evidence_class:
            blockers.append(f"release_evidence:class_missing:{evidence_id}")
            bad = True
        else:
            class_policy, error = _class_policy(evidence_class, ttl_policy)
            if error:
                blockers.append(f"{error}:{evidence_id}")
                bad = True
        if class_policy is not None:
            observed = _parse_time(entry.get("observed_at"))
            ttl_hours = class_policy.get("ttl_hours")
            if observed is None:
                blockers.append(f"release_evidence:observed_at_invalid:{evidence_id}")
                bad = True
            elif observed > now + timedelta(minutes=5):
                blockers.append(f"release_evidence:observed_at_future:{evidence_id}")
                bad = True
            elif ttl_hours is not None and now - observed > timedelta(hours=float(ttl_hours)):
                blockers.append(f"release_evidence:expired:{evidence_id}")
                bad = True
            fingerprints = entry.get("trigger_fingerprints")
            if not isinstance(fingerprints, dict):
                blockers.append(f"release_evidence:trigger_fingerprints_missing:{evidence_id}")
                bad = True
                fingerprints = {}
            for trigger in class_policy.get("revalidate_on", []):
                current = trigger_state.get(trigger)
                recorded = fingerprints.get(trigger)
                if not isinstance(current, str) or not current or recorded != current:
                    blockers.append(f"release_evidence:trigger_stale:{evidence_id}:{trigger}")
                    bad = True
        if entry.get("control_plane_fingerprint") != control_fingerprint:
            blockers.append(f"release_evidence:control_plane_drift:{evidence_id}")
            bad = True
        if not _entry_roles(entry):
            blockers.append(f"release_evidence:roles_missing:{evidence_id}")
            bad = True
        if _entry_provenance(entry) is None:
            blockers.append(f"release_evidence:provenance_missing:{evidence_id}")
            bad = True
        if not bad:
            valid[evidence_id] = entry

    if effective_risk is None:
        return blockers

    required_roles = REQUIRED_EVIDENCE_ROLES[effective_risk]
    role_ids: dict[str, set[str]] = {role: set() for role in required_roles}
    for evidence_id, entry in valid.items():
        for role in _entry_roles(entry):
            if role in role_ids:
                role_ids[role].add(evidence_id)
    for role in sorted(required_roles):
        if not role_ids[role]:
            blockers.append(f"release_evidence:role_missing:{role}")

    selected: dict[str, str] = {}
    for role in required_roles:
        field = ROLE_SNAPSHOT_FIELDS.get(role)
        if field is None:
            continue
        evidence_id = snapshot.get(field)
        if not isinstance(evidence_id, str) or evidence_id not in role_ids.get(role, set()):
            blockers.append(f"release_evidence:{role}_missing_or_unbound")
        else:
            selected[role] = evidence_id

    if effective_risk in {"R2", "R3", "R4"}:
        impl = selected.get("implementation")
        counter = selected.get("countercheck")
        if impl and counter and not _independent(valid[impl], valid[counter]):
            blockers.append("release_evidence:implementation_countercheck_not_independent")
    if effective_risk in {"R3", "R4"}:
        negative = selected.get("negative")
        recovery = selected.get("recovery")
        if negative and recovery and negative == recovery:
            blockers.append("release_evidence:negative_recovery_not_distinct")

    participating: set[str] = set(selected.values())
    for gate_id in sorted(mandatory_gate_ids):
        gate = gate_by_id.get(gate_id)
        if gate is None:
            continue
        gate_roles, error = _required_roles_for_gate(gate, effective_risk)
        if error:
            blockers.append(f"integration_gate:{gate_id}:{error}")
            continue
        gate_role_ids: dict[str, set[str]] = {}
        for role in gate_roles:
            ids = {
                evidence_id
                for evidence_id, entry in valid.items()
                if role in _entry_roles(entry) and gate_id in _entry_set(entry, "gates", "gate")
            }
            gate_role_ids[role] = ids
            participating.update(ids)
            if not ids:
                blockers.append(f"release_evidence:gate_role_missing:{gate_id}:{role}")
        impls = gate_role_ids.get("implementation", set())
        counters = gate_role_ids.get("countercheck", set())
        if impls and counters and not any(_independent(valid[a], valid[b]) for a in impls for b in counters):
            blockers.append(f"release_evidence:gate_countercheck_not_independent:{gate_id}")
        negatives = gate_role_ids.get("negative", set())
        recoveries = gate_role_ids.get("recovery", set())
        if negatives and recoveries and negatives & recoveries:
            blockers.append(f"release_evidence:gate_negative_recovery_not_distinct:{gate_id}")

    for contract_id, gates in contract_gates.items():
        for gate_id in gates:
            if gate_id not in mandatory_gate_ids:
                blockers.append(f"release_evidence:contract_gate_not_mandatory:{contract_id}:{gate_id}")

    for invariant_id in sorted(invariant_ids):
        ids = {
            evidence_id
            for evidence_id, entry in valid.items()
            if invariant_id in _entry_set(entry, "invariants", "invariant")
        }
        participating.update(ids)
        if not ids:
            blockers.append(f"release_evidence:invariant_missing:{invariant_id}")

    participating_entries = [valid[evidence_id] for evidence_id in participating if evidence_id in valid]
    classes = {entry.get("class") for entry in participating_entries if entry.get("class")}
    minimum_classes = 2 if effective_risk in {"R3", "R4"} else 1
    if len(classes) < minimum_classes:
        blockers.append(f"release_evidence:quorum_classes:{len(classes)}<{minimum_classes}")
    elif effective_risk in {"R3", "R4"}:
        independent_class_pair = any(
            left.get("class") != right.get("class") and _independent(left, right)
            for i, left in enumerate(participating_entries)
            for right in participating_entries[i + 1 :]
        )
        if not independent_class_pair:
            blockers.append("release_evidence:quorum_classes_not_independent")
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
    del freshness  # repository evidence is historical input; release evidence must be protected-attested
    blockers: list[str] = []
    ttl_policy = ttl_policy or {"policy": {}}
    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)

    invariant_items = invariants.get("invariants")
    if not isinstance(invariant_items, list):
        blockers.append("invariant:registry_invalid")
        invariant_items = []
    invariant_by_id, registry_errors = _registry_by_id(invariant_items, "invariant")
    blockers.extend(registry_errors)
    required_invariants: set[str] = set()
    for invariant_id, item in invariant_by_id.items():
        if item.get("required") is True:
            required_invariants.add(invariant_id)
            if item.get("status") != "ENFORCED":
                blockers.append(f"invariant:{invariant_id}:{item.get('status')}")

    contract_by_id, registry_errors = _registry_by_id(contracts.get("contracts"), "contract")
    blockers.extend(registry_errors)
    affected = snapshot.get("affected_contracts")
    if not isinstance(affected, list):
        blockers.append("release_input:affected_contracts")
        affected = []
    elif not affected:
        blockers.append("release_input:affected_contracts_empty")
    else:
        seen: set[str] = set()
        normalized: list[str] = []
        for contract_id in affected:
            if not isinstance(contract_id, str) or not contract_id:
                blockers.append("release_input:affected_contract_invalid")
                continue
            if contract_id in seen:
                blockers.append(f"release_input:affected_contract_duplicate:{contract_id}")
                continue
            seen.add(contract_id)
            normalized.append(contract_id)
        affected = normalized
    for contract_id in affected:
        item = contract_by_id.get(contract_id)
        if item is None:
            blockers.append(f"contract:unknown:{contract_id}")
        elif item.get("status") != "ACTIVE":
            blockers.append(f"contract:{contract_id}:{item.get('status')}")
    if set(affected) != set(contract_by_id):
        blockers.append("release_scope:contract_registry_incomplete")

    required_gate_ids, contract_gates, impact_errors = _required_gate_ids(affected, impact)
    blockers.extend(impact_errors)
    gate_by_id, registry_errors = _registry_by_id(integration.get("gates"), "integration_gate")
    blockers.extend(registry_errors)
    explicit_gate_ids = {gate_id for gate_id, gate in gate_by_id.items() if gate.get("applicable") is True}
    mandatory_gate_ids = required_gate_ids | explicit_gate_ids
    for gate_id in sorted(mandatory_gate_ids):
        gate = gate_by_id.get(gate_id)
        if gate is None:
            blockers.append(f"integration_gate:missing:{gate_id}")
        elif gate.get("status") != "VERIFIED":
            blockers.append(f"integration_gate:{gate_id}:{gate.get('status')}")

    declared_risk = snapshot.get("risk")
    risk_floor, risk_errors = _scope_risk_floor(affected, contract_by_id)
    blockers.extend(risk_errors)
    effective_risk: str | None = None
    if declared_risk not in RISK_ORDER:
        blockers.append("release_input:risk")
    elif RISK_ORDER[declared_risk] < RISK_ORDER[risk_floor]:
        blockers.append(f"release_input:risk_below_scope_floor:{declared_risk}<{risk_floor}")
        effective_risk = risk_floor
    else:
        effective_risk = declared_risk

    expected_bools = {
        "dependencies_satisfied": True,
        "consumer_impact_revalidated": True,
        "pending_checks": False,
        "failed_required_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
    }
    for key, expected in expected_bools.items():
        value = snapshot.get(key)
        if not _exact_bool(value) or value is not expected:
            blockers.append(f"release_input:{key}")
    for key in ("open_p0", "open_p1", "open_p2"):
        value = snapshot.get(key)
        if not _exact_nonnegative_int(value) or value != 0:
            blockers.append(f"release_input:{key}")

    declared_protected = snapshot.get("protected_action_required")
    if not _exact_bool(declared_protected):
        blockers.append("release_input:protected_action_required")
    derived_protected, protection_error = _derive_protected_action(snapshot.get("operation"), actual_target)
    if protection_error:
        blockers.append(protection_error)
    elif _exact_bool(declared_protected) and declared_protected is not derived_protected:
        blockers.append("release_input:protected_action_mismatch")

    blocking_reasons = snapshot.get("blocking_reasons")
    if not isinstance(blocking_reasons, list):
        blockers.append("release_input:blocking_reasons")
    else:
        for reason in blocking_reasons:
            if not isinstance(reason, str) or not reason:
                blockers.append("release_input:blocking_reason_invalid")
            else:
                blockers.append(f"declared_blocker:{reason}")

    evidence_entries, trigger_state, attestation_errors = _authenticate_attestation(
        attestation,
        attestation_key,
        actual_head,
        actual_target,
        current_control_plane_fingerprint,
        now_utc,
    )
    blockers.extend(attestation_errors)
    blockers.extend(
        _validate_bound_evidence(
            snapshot,
            evidence_entries,
            trigger_state,
            ttl_policy,
            actual_head,
            actual_target,
            effective_risk,
            mandatory_gate_ids,
            contract_gates,
            gate_by_id,
            required_invariants,
            current_control_plane_fingerprint,
            now_utc,
        )
    )

    if blockers:
        return "BLOCK", blockers
    if derived_protected is True:
        return "OWNER_REQUIRED", ["protected_action_required"]
    if derived_protected is False:
        return "ALLOW", []
    return "BLOCK", ["release_input:protected_action_unresolved"]


def _canonical_inputs_authenticated() -> list[str]:
    reasons: list[str] = []
    for rel in (
        "project-memory/RELEASE_DECISION.json",
        "project-memory/EVIDENCE_FRESHNESS.json",
        *CONTROL_PLANE_FILES,
    ):
        if not _tracked_file_matches_head(rel):
            reasons.append(f"canonical_input:not_head_tracked:{rel}")
    return reasons


def _load_attestation(path_value: str | None) -> dict | None:
    if not path_value:
        return None
    try:
        value = json.loads(Path(path_value).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {"_load_error": True}
    return value if isinstance(value, dict) else {"_load_error": True}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--release-sha")
    ap.add_argument("--target")
    ap.add_argument("--attestation-file")
    args = ap.parse_args()

    invariants = load("SYSTEM_INVARIANTS.json")
    integration = load("INTEGRATION_GATES.json")
    contracts = load("CONTRACT_REGISTRY.json")
    impact = load("IMPACT_MAP.json")
    freshness = load("EVIDENCE_FRESHNESS.json")
    ttl_policy = load("EVIDENCE_TTL_POLICY.json")
    snapshot = load("RELEASE_DECISION.json")
    actual_head = args.release_sha or os.environ.get("FANMIND_RELEASE_SHA") or os.environ.get("GITHUB_SHA") or current_git_head()
    actual_target = args.target or os.environ.get("FANMIND_RELEASE_TARGET")
    cp_fingerprint = control_plane_fingerprint()
    attestation_path = args.attestation_file or os.environ.get("FANMIND_GOD_MODE_ATTESTATION_FILE")
    attestation = _load_attestation(attestation_path)
    key = os.environ.get("FANMIND_GOD_MODE_ATTESTATION_KEY")

    canonical_errors = _canonical_inputs_authenticated()
    if canonical_errors:
        decision, reasons = "BLOCK", canonical_errors
    else:
        decision, reasons = evaluate_release_decision(
            invariants,
            integration,
            contracts,
            impact,
            freshness,
            snapshot,
            ttl_policy,
            actual_head=actual_head,
            actual_target=actual_target,
            current_control_plane_fingerprint=cp_fingerprint,
            attestation=attestation,
            attestation_key=key,
        )

    print(f"FANMIND_RELEASE_DECISION={decision}")
    for reason in reasons:
        print(f"FANMIND_RELEASE_REASON={reason}")
    if args.check and snapshot.get("decision") != decision:
        print(f"FANMIND_RELEASE_DECISION_MISMATCH=declared:{snapshot.get('decision')}:computed:{decision}")
        return 1
    return 0

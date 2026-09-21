#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
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
    "project-memory/GOD_MODE_POLICY.md",
    "project-memory/SYSTEM_INVARIANTS.json",
    "project-memory/CONTRACT_REGISTRY.json",
    "project-memory/INTEGRATION_GATES.json",
    "project-memory/IMPACT_MAP.json",
    "project-memory/EVIDENCE_TTL_POLICY.json",
)


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
        actual = (ROOT / path).read_bytes()
    except OSError:
        return False
    return actual == expected


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


def _parse_observed_at(value) -> datetime | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(timezone.utc)


def _validate_impact_map(impact: dict) -> tuple[dict[str, dict], list[str]]:
    blockers: list[str] = []
    by_contract: dict[str, dict] = {}
    mappings = impact.get("mappings")
    if not isinstance(mappings, list):
        return {}, ["impact_map:mappings_invalid"]
    for item in mappings:
        if not isinstance(item, dict):
            blockers.append("impact_map:mapping_invalid")
            continue
        contract_id = item.get("contract")
        if not isinstance(contract_id, str) or not contract_id:
            blockers.append("impact_map:contract_invalid")
            continue
        if contract_id in by_contract:
            blockers.append(f"impact_map:duplicate_contract:{contract_id}")
            continue
        by_contract[contract_id] = item
    return by_contract, blockers


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
        for value in mapped:
            if not isinstance(value, str) or not value:
                blockers.append(f"impact_map:gate_invalid:{contract_id}")
                continue
            current.add(value)
            gate_ids.add(value)
        contract_gates[contract_id] = current
    return gate_ids, contract_gates, blockers


def _registry_by_id(items, prefix: str) -> tuple[dict[str, dict], list[str]]:
    blockers: list[str] = []
    result: dict[str, dict] = {}
    if not isinstance(items, list):
        return {}, [f"{prefix}:registry_invalid"]
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


def _scope_risk_floor(
    affected_contracts: list[str], contract_by_id: dict[str, dict]
) -> tuple[str | None, list[str]]:
    blockers: list[str] = []
    floor = "R1"
    for contract_id in affected_contracts:
        contract = contract_by_id.get(contract_id)
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
        isinstance(ttl_hours, bool)
        or not isinstance(ttl_hours, (int, float))
        or ttl_hours < 0
    ):
        return None, f"ttl_policy:ttl_invalid:{evidence_class}"
    revalidate_on = entry.get("revalidate_on")
    if not isinstance(revalidate_on, list) or not revalidate_on or any(
        not isinstance(trigger, str) or not trigger for trigger in revalidate_on
    ):
        return None, f"ttl_policy:revalidate_invalid:{evidence_class}"
    return entry, None


def _entry_roles(entry: dict) -> set[str]:
    roles = entry.get("roles")
    if isinstance(roles, list):
        return {role for role in roles if isinstance(role, str) and role}
    role = entry.get("role")
    if isinstance(role, str) and role:
        return {role}
    return set()


def _entry_gates(entry: dict) -> set[str]:
    gates = entry.get("gates")
    result: set[str] = set()
    if isinstance(gates, list):
        result.update(gate for gate in gates if isinstance(gate, str) and gate)
    gate = entry.get("gate")
    if isinstance(gate, str) and gate:
        result.add(gate)
    return result


def _entry_provenance(entry: dict) -> tuple[str, str, str] | None:
    provenance = entry.get("provenance")
    if not isinstance(provenance, dict):
        return None
    source = provenance.get("source")
    execution_id = provenance.get("execution_id")
    independence_key = provenance.get("independence_key")
    if not all(isinstance(value, str) and value for value in (source, execution_id, independence_key)):
        return None
    return source, execution_id, independence_key


def _independent(left: dict, right: dict) -> bool:
    left_p = _entry_provenance(left)
    right_p = _entry_provenance(right)
    if left_p is None or right_p is None:
        return False
    return all(a != b for a, b in zip(left_p, right_p))


def _required_roles_for_gate(gate: dict, effective_risk: str) -> tuple[set[str], str | None]:
    configured = gate.get("required_roles")
    if configured is None:
        return set(REQUIRED_EVIDENCE_ROLES[effective_risk]), None
    if not isinstance(configured, list) or not configured:
        return set(), "required_roles_invalid"
    configured_roles = {role for role in configured if isinstance(role, str) and role}
    if len(configured_roles) != len(configured):
        return set(), "required_roles_invalid"
    unknown = configured_roles - {"evidence", "implementation", "countercheck", "negative", "recovery"}
    if unknown:
        return set(), "required_roles_invalid"
    required = REQUIRED_EVIDENCE_ROLES[effective_risk]
    if not required.issubset(configured_roles):
        return set(), "required_roles_weaker_than_risk"
    return set(required), None


def _validate_bound_evidence(
    snapshot: dict,
    freshness: dict,
    ttl_policy: dict,
    actual_head: str | None,
    actual_target: str | None,
    effective_risk: str | None,
    mandatory_gate_ids: set[str],
    contract_gates: dict[str, set[str]],
    gate_by_id: dict[str, dict],
    *,
    current_control_plane_fingerprint: str | None,
    now: datetime | None = None,
) -> list[str]:
    blockers: list[str] = []
    if not isinstance(actual_head, str) or len(actual_head) != 40:
        blockers.append("release_evidence:actual_head_missing")
        return blockers
    if not isinstance(actual_target, str) or not actual_target:
        blockers.append("release_evidence:actual_target_missing")
        return blockers
    if snapshot.get("evaluated_commit") != actual_head:
        blockers.append("release_evidence:evaluated_commit_mismatch")
    if snapshot.get("evaluated_target") != actual_target:
        blockers.append("release_evidence:evaluated_target_mismatch")

    if not isinstance(current_control_plane_fingerprint, str) or len(current_control_plane_fingerprint) != 64:
        blockers.append("release_evidence:control_plane_fingerprint_unavailable")

    bindings = snapshot.get("evidence_bindings")
    if not isinstance(bindings, list):
        blockers.append("release_evidence:bindings_invalid")
        return blockers

    fresh_by_id, registry_blockers = _registry_by_id(freshness.get("entries"), "release_evidence")
    blockers.extend(registry_blockers)
    valid_entries: dict[str, dict] = {}
    now_utc = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)

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

        entry = fresh_by_id.get(evidence_id)
        if entry is None:
            blockers.append(f"release_evidence:unknown:{evidence_id}")
            continue

        entry_blocked = False
        if entry.get("status") not in CURRENT_EVIDENCE_STATES:
            blockers.append(f"release_evidence:not_current:{evidence_id}:{entry.get('status')}")
            entry_blocked = True
        if entry.get("bound_commit") != actual_head or binding.get("commit") != actual_head:
            blockers.append(f"release_evidence:commit_mismatch:{evidence_id}")
            entry_blocked = True
        if entry.get("target") != actual_target or binding.get("target") != actual_target:
            blockers.append(f"release_evidence:target_mismatch:{evidence_id}")
            entry_blocked = True
        if entry.get("invalidated_by") or entry.get("superseded_by"):
            blockers.append(f"release_evidence:invalidated:{evidence_id}")
            entry_blocked = True

        evidence_class = entry.get("class")
        if not isinstance(evidence_class, str) or not evidence_class:
            blockers.append(f"release_evidence:class_missing:{evidence_id}")
            entry_blocked = True
            class_policy = None
        else:
            class_policy, policy_error = _class_policy(evidence_class, ttl_policy)
            if policy_error:
                blockers.append(f"{policy_error}:{evidence_id}")
                entry_blocked = True
                class_policy = None

        if class_policy is not None:
            ttl_hours = class_policy.get("ttl_hours")
            observed_at = _parse_observed_at(entry.get("observed_at"))
            if observed_at is None:
                blockers.append(f"release_evidence:observed_at_invalid:{evidence_id}")
                entry_blocked = True
            elif observed_at > now_utc + timedelta(minutes=5):
                blockers.append(f"release_evidence:observed_at_future:{evidence_id}")
                entry_blocked = True
            elif ttl_hours is not None and now_utc - observed_at > timedelta(hours=float(ttl_hours)):
                blockers.append(f"release_evidence:expired:{evidence_id}")
                entry_blocked = True

            if entry.get("control_plane_fingerprint") != current_control_plane_fingerprint:
                blockers.append(f"release_evidence:control_plane_drift:{evidence_id}")
                entry_blocked = True

        roles = _entry_roles(entry)
        if not roles:
            blockers.append(f"release_evidence:roles_missing:{evidence_id}")
            entry_blocked = True
        if _entry_provenance(entry) is None:
            blockers.append(f"release_evidence:provenance_missing:{evidence_id}")
            entry_blocked = True

        if not entry_blocked:
            valid_entries[evidence_id] = entry

    if effective_risk is None:
        return blockers

    required_roles = REQUIRED_EVIDENCE_ROLES[effective_risk]
    role_ids: dict[str, set[str]] = {role: set() for role in required_roles}
    for evidence_id, entry in valid_entries.items():
        for role in _entry_roles(entry):
            if role in role_ids:
                role_ids[role].add(evidence_id)

    for role in sorted(required_roles):
        if not role_ids[role]:
            blockers.append(f"release_evidence:role_missing:{role}")

    selected_role_ids: dict[str, str] = {}
    for role in required_roles:
        field = ROLE_SNAPSHOT_FIELDS.get(role)
        if field is None:
            continue
        evidence_id = snapshot.get(field)
        if not isinstance(evidence_id, str) or evidence_id not in role_ids.get(role, set()):
            blockers.append(f"release_evidence:{role}_missing_or_unbound")
        else:
            selected_role_ids[role] = evidence_id

    if effective_risk in {"R2", "R3", "R4"}:
        implementation_id = selected_role_ids.get("implementation")
        countercheck_id = selected_role_ids.get("countercheck")
        if implementation_id and countercheck_id:
            if not _independent(valid_entries[implementation_id], valid_entries[countercheck_id]):
                blockers.append("release_evidence:implementation_countercheck_not_independent")

    if effective_risk in {"R3", "R4"}:
        raw_negative_id = snapshot.get("negative_evidence_id")
        raw_recovery_id = snapshot.get("rollback_recovery_evidence_id")
        if (
            isinstance(raw_negative_id, str)
            and isinstance(raw_recovery_id, str)
            and raw_negative_id == raw_recovery_id
        ):
            blockers.append("release_evidence:negative_recovery_not_distinct")

    participating_ids: set[str] = set(selected_role_ids.values())

    for gate_id in sorted(mandatory_gate_ids):
        gate = gate_by_id.get(gate_id)
        if gate is None:
            continue
        gate_roles, gate_role_error = _required_roles_for_gate(gate, effective_risk)
        if gate_role_error:
            blockers.append(f"integration_gate:{gate_id}:{gate_role_error}")
            continue

        gate_role_ids: dict[str, set[str]] = {}
        for role in gate_roles:
            ids = {
                evidence_id
                for evidence_id, entry in valid_entries.items()
                if role in _entry_roles(entry) and gate_id in _entry_gates(entry)
            }
            gate_role_ids[role] = ids
            participating_ids.update(ids)
            if not ids:
                blockers.append(f"release_evidence:gate_role_missing:{gate_id}:{role}")

        if "implementation" in gate_roles and "countercheck" in gate_roles:
            implementation_candidates = gate_role_ids.get("implementation", set())
            countercheck_candidates = gate_role_ids.get("countercheck", set())
            independent_pair = any(
                _independent(valid_entries[impl_id], valid_entries[counter_id])
                for impl_id in implementation_candidates
                for counter_id in countercheck_candidates
            )
            if implementation_candidates and countercheck_candidates and not independent_pair:
                blockers.append(f"release_evidence:gate_countercheck_not_independent:{gate_id}")

    for contract_id, gates in contract_gates.items():
        for gate_id in sorted(gates):
            if gate_id not in mandatory_gate_ids:
                blockers.append(f"release_evidence:contract_gate_not_mandatory:{contract_id}:{gate_id}")

    participating_classes = {
        valid_entries[evidence_id].get("class")
        for evidence_id in participating_ids
        if evidence_id in valid_entries
    }
    participating_classes.discard(None)
    minimum_classes = 2 if effective_risk in {"R3", "R4"} else 1
    if len(participating_classes) < minimum_classes:
        blockers.append(
            f"release_evidence:quorum_classes:{len(participating_classes)}<{minimum_classes}"
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
) -> tuple[str, list[str]]:
    blockers: list[str] = []
    ttl_policy = ttl_policy or {"policy": {}}

    invariant_items = invariants.get("invariants")
    if not isinstance(invariant_items, list):
        blockers.append("invariant:registry_invalid")
        invariant_items = []
    invariant_by_id, inv_registry_blockers = _registry_by_id(invariant_items, "invariant")
    blockers.extend(inv_registry_blockers)
    for item in invariant_by_id.values():
        if item.get("required") is True and item.get("status") != "ENFORCED":
            blockers.append(f"invariant:{item.get('id')}:{item.get('status')}")

    contract_by_id, contract_registry_blockers = _registry_by_id(
        contracts.get("contracts"), "contract"
    )
    blockers.extend(contract_registry_blockers)

    affected_contracts = snapshot.get("affected_contracts")
    if not isinstance(affected_contracts, list):
        blockers.append("release_input:affected_contracts")
        affected_contracts = []
    elif not affected_contracts:
        blockers.append("release_input:affected_contracts_empty")
    else:
        seen_contracts: set[str] = set()
        normalized_contracts: list[str] = []
        for contract_id in affected_contracts:
            if not isinstance(contract_id, str) or not contract_id:
                blockers.append("release_input:affected_contract_invalid")
                continue
            if contract_id in seen_contracts:
                blockers.append(f"release_input:affected_contract_duplicate:{contract_id}")
                continue
            seen_contracts.add(contract_id)
            normalized_contracts.append(contract_id)
        affected_contracts = normalized_contracts

    for contract_id in affected_contracts:
        item = contract_by_id.get(contract_id)
        if item is None:
            blockers.append(f"contract:unknown:{contract_id}")
        elif item.get("status") != "ACTIVE":
            blockers.append(f"contract:{contract_id}:{item.get('status')}")

    scope_contracts = {
        contract_id
        for contract_id, item in contract_by_id.items()
        if item.get("status") in {"REGISTERED", "ACTIVE"}
    }
    if set(affected_contracts) != scope_contracts:
        blockers.append("release_scope:registered_contract_set_incomplete")

    required_gate_ids, contract_gates, impact_blockers = _required_gate_ids(
        affected_contracts, impact
    )
    blockers.extend(impact_blockers)

    gate_by_id, gate_registry_blockers = _registry_by_id(
        integration.get("gates"), "integration_gate"
    )
    blockers.extend(gate_registry_blockers)

    explicit_gate_ids: set[str] = set()
    for gate_id, gate in gate_by_id.items():
        if gate.get("applicable") is True:
            explicit_gate_ids.add(gate_id)
    mandatory_gate_ids = required_gate_ids | explicit_gate_ids

    for gate_id in sorted(mandatory_gate_ids):
        gate = gate_by_id.get(gate_id)
        if gate is None:
            blockers.append(f"integration_gate:missing:{gate_id}")
        elif gate.get("status") != "VERIFIED":
            blockers.append(f"integration_gate:{gate_id}:{gate.get('status')}")

    declared_risk = snapshot.get("risk")
    risk_floor, risk_blockers = _scope_risk_floor(affected_contracts, contract_by_id)
    blockers.extend(risk_blockers)
    effective_risk: str | None = None
    if declared_risk not in RISK_ORDER:
        blockers.append("release_input:risk")
    elif risk_floor is not None and RISK_ORDER[declared_risk] < RISK_ORDER[risk_floor]:
        blockers.append(f"release_input:risk_below_scope_floor:{declared_risk}<{risk_floor}")
        effective_risk = risk_floor
    else:
        effective_risk = declared_risk

    bool_fields = {
        "dependencies_satisfied": True,
        "consumer_impact_revalidated": True,
        "pending_checks": False,
        "failed_required_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
    }
    for key, expected in bool_fields.items():
        value = snapshot.get(key)
        if not _exact_bool(value) or value is not expected:
            blockers.append(f"release_input:{key}")

    for key in ("open_p0", "open_p1", "open_p2"):
        value = snapshot.get(key)
        if not _exact_nonnegative_int(value) or value != 0:
            blockers.append(f"release_input:{key}")

    protected_action_required = snapshot.get("protected_action_required")
    if not _exact_bool(protected_action_required):
        blockers.append("release_input:protected_action_required")

    blocking_reasons = snapshot.get("blocking_reasons")
    if not isinstance(blocking_reasons, list):
        blockers.append("release_input:blocking_reasons")
    else:
        for reason in blocking_reasons:
            if not isinstance(reason, str) or not reason:
                blockers.append("release_input:blocking_reason_invalid")
            else:
                blockers.append(f"declared_blocker:{reason}")

    blockers.extend(
        _validate_bound_evidence(
            snapshot,
            freshness,
            ttl_policy,
            actual_head=actual_head,
            actual_target=actual_target,
            effective_risk=effective_risk,
            mandatory_gate_ids=mandatory_gate_ids,
            contract_gates=contract_gates,
            gate_by_id=gate_by_id,
            current_control_plane_fingerprint=current_control_plane_fingerprint,
            now=now,
        )
    )

    if blockers:
        return "BLOCK", blockers
    if protected_action_required is True:
        return "OWNER_REQUIRED", ["protected_action_required"]
    if protected_action_required is False:
        return "ALLOW", []
    return "BLOCK", ["release_input:protected_action_required"]


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


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    ap.add_argument(
        "--release-sha",
        help="Exact evaluated release SHA. Distinct from the control-plane checkout SHA when needed.",
    )
    ap.add_argument("--target")
    args = ap.parse_args()

    invariants = load("SYSTEM_INVARIANTS.json")
    integration = load("INTEGRATION_GATES.json")
    contracts = load("CONTRACT_REGISTRY.json")
    impact = load("IMPACT_MAP.json")
    freshness = load("EVIDENCE_FRESHNESS.json")
    ttl_policy = load("EVIDENCE_TTL_POLICY.json")
    snapshot = load("RELEASE_DECISION.json")
    actual_head = (
        args.release_sha
        or os.environ.get("FANMIND_RELEASE_SHA")
        or os.environ.get("GITHUB_SHA")
        or current_git_head()
    )
    actual_target = args.target or os.environ.get("FANMIND_RELEASE_TARGET")
    cp_fingerprint = control_plane_fingerprint()

    canonical_auth_errors = _canonical_inputs_authenticated()
    if canonical_auth_errors:
        decision = "BLOCK"
        reasons = canonical_auth_errors
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
        )

    print(f"FANMIND_RELEASE_DECISION={decision}")
    for reason in reasons:
        print(f"FANMIND_RELEASE_REASON={reason}")

    if args.check and snapshot.get("decision") != decision:
        print(
            f"FANMIND_RELEASE_DECISION_MISMATCH=declared:{snapshot.get('decision')}:computed:{decision}"
        )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

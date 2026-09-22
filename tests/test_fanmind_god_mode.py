from datetime import datetime, timezone
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_release_decision", ROOT / "scripts" / "fanmind_release_decision.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)

HEAD = "a" * 40
OTHER_HEAD = "b" * 40
TARGET = "repository:synthetic"
STAGING_TARGET = "staging:synthetic"
NOW = datetime(2026, 9, 21, 22, 0, 0, tzinfo=timezone.utc)
CONTROL = "c" * 64
OTHER_CONTROL = "d" * 64
KEY = "test-only-protected-attestation-key-000000000000"
ALL_ROLES = ["implementation", "countercheck", "negative", "recovery"]
TRIGGERS = {
    "head_changed": "head:a",
    "workflow_contract_changed": "workflow:v1",
    "staging_deploy": "staging:deploy-1",
    "runtime_config_change": "runtime:config-1",
    "schema_or_authority_change": "authority:v1",
}


def enforced_invariants():
    return {"invariants": [
        {"id": "FM-INV-001", "required": True, "status": "ENFORCED", "risk": "R3",
         "revalidate_on": ["schema_or_authority_change"]},
        {"id": "FM-INV-002", "required": True, "status": "ENFORCED", "risk": "R3",
         "revalidate_on": ["schema_or_authority_change"]},
    ]}


def verified_gates():
    return {"gates": [
        {"id": "FM-IGATE-A", "applicable": True, "status": "VERIFIED",
         "contracts": ["FM-CONTRACT-A"], "required_roles": list(ALL_ROLES),
         "evidence_required": ["synthetic semantic proof"]},
        {"id": "FM-IGATE-B", "applicable": True, "status": "VERIFIED",
         "contracts": ["FM-CONTRACT-B"], "required_roles": list(ALL_ROLES),
         "evidence_required": ["synthetic semantic proof"]},
    ]}


def active_contracts(minimum_risk="R3"):
    return {"contracts": [
        {"id": "FM-CONTRACT-A", "status": "ACTIVE", "minimum_risk": minimum_risk},
        {"id": "FM-CONTRACT-B", "status": "ACTIVE", "minimum_risk": minimum_risk},
    ]}


def impact_map():
    return {"mappings": [
        {"contract": "FM-CONTRACT-A", "gates": ["FM-IGATE-A"]},
        {"contract": "FM-CONTRACT-B", "gates": ["FM-IGATE-B"]},
    ]}


def ttl_policy():
    return {"policy": {
        "ci_exact_head": {"ttl_hours": None, "revalidate_on": ["head_changed", "workflow_contract_changed"]},
        "staging_smoke": {"ttl_hours": 24, "revalidate_on": ["staging_deploy", "runtime_config_change"]},
    }}


def evidence_entry(evidence_id, evidence_class, roles, gates, *, target=TARGET, head=HEAD,
                   source, execution_id, independence_key, invariants=None):
    triggers = ttl_policy()["policy"][evidence_class]["revalidate_on"]
    return {
        "id": evidence_id,
        "status": "COUNTERCHECKED",
        "class": evidence_class,
        "roles": roles,
        "gates": gates,
        "invariants": invariants if invariants is not None else ["FM-INV-001", "FM-INV-002"],
        "requirements": {gate: ["synthetic semantic proof"] for gate in gates},
        "bound_commit": head,
        "target": target,
        "observed_at": "2026-09-21T21:30:00Z",
        "control_plane_fingerprint": CONTROL,
        "trigger_fingerprints": {
            **{trigger: TRIGGERS[trigger] for trigger in triggers},
            "schema_or_authority_change": TRIGGERS["schema_or_authority_change"],
        },
        "provenance": {"source": source, "execution_id": execution_id, "independence_key": independence_key},
    }


def current_evidence(target=TARGET, head=HEAD):
    both = ["FM-IGATE-A", "FM-IGATE-B"]
    return [
        evidence_entry("EV-IMPLEMENTATION", "ci_exact_head", ["implementation"], both,
                       target=target, head=head, source="github-actions:implementation",
                       execution_id="run-impl-1", independence_key="impl-1"),
        evidence_entry("EV-COUNTERCHECK", "staging_smoke", ["countercheck"], both,
                       target=target, head=head, source="protected-staging:countercheck",
                       execution_id="run-counter-2", independence_key="counter-2"),
        evidence_entry("EV-NEGATIVE", "ci_exact_head", ["negative"], both,
                       target=target, head=head, source="github-actions:negative",
                       execution_id="run-negative-3", independence_key="negative-3"),
        evidence_entry("EV-RECOVERY", "staging_smoke", ["recovery"], both,
                       target=target, head=head, source="protected-staging:recovery",
                       execution_id="run-recovery-4", independence_key="recovery-4"),
    ]


def clean_snapshot(target=TARGET, **overrides):
    data = {
        "operation": "repository_merge",
        "risk": "R3",
        "affected_contracts": ["FM-CONTRACT-A", "FM-CONTRACT-B"],
        "evaluated_commit": HEAD,
        "evaluated_target": target,
        "evidence_bindings": [
            {"id": "EV-IMPLEMENTATION", "commit": HEAD, "target": target},
            {"id": "EV-COUNTERCHECK", "commit": HEAD, "target": target},
            {"id": "EV-NEGATIVE", "commit": HEAD, "target": target},
            {"id": "EV-RECOVERY", "commit": HEAD, "target": target},
        ],
        "implementation_evidence_id": "EV-IMPLEMENTATION",
        "countercheck_evidence_id": "EV-COUNTERCHECK",
        "negative_evidence_id": "EV-NEGATIVE",
        "rollback_recovery_evidence_id": "EV-RECOVERY",
        "dependencies_satisfied": True,
        "consumer_impact_revalidated": True,
        "open_p0": 0, "open_p1": 0, "open_p2": 0,
        "pending_checks": False,
        "failed_required_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
        "protected_action_required": False,
        "blocking_reasons": [],
    }
    data.update(overrides)
    return data


def signed_attestation(entries=None, *, target=TARGET, head=HEAD, control=CONTROL, trigger_state=None):
    value = {
        "schema_version": 1,
        "issuer": MODULE.ATTESTATION_ISSUER,
        "release_sha": head,
        "target": target,
        "control_plane_fingerprint": control,
        "issued_at": "2026-09-21T21:45:00Z",
        "expires_at": "2026-09-21T22:45:00Z",
        "trigger_state": dict(TRIGGERS if trigger_state is None else trigger_state),
        "evidence": current_evidence(target, head) if entries is None else entries,
    }
    value["signature"] = MODULE.sign_attestation(value, KEY)
    return value


def evaluate(snapshot=None, invariants=None, gates=None, contracts=None, impact=None, policy=None,
             actual_head=HEAD, actual_target=TARGET, control=CONTROL, attestation=None, key=KEY):
    return MODULE.evaluate_release_decision(
        invariants if invariants is not None else enforced_invariants(),
        gates if gates is not None else verified_gates(),
        contracts if contracts is not None else active_contracts(),
        impact if impact is not None else impact_map(),
        {},
        snapshot if snapshot is not None else clean_snapshot(actual_target),
        policy if policy is not None else ttl_policy(),
        actual_head=actual_head,
        actual_target=actual_target,
        current_control_plane_fingerprint=control,
        now=NOW,
        attestation=attestation if attestation is not None else signed_attestation(target=actual_target, head=actual_head, control=control),
        attestation_key=key,
    )


class GodModeReleaseDecisionTests(unittest.TestCase):
    def test_clean_repository_release_allows_with_protected_attestation(self):
        self.assertEqual(("ALLOW", []), evaluate())

    def test_missing_or_unkeyed_attestation_fails_closed(self):
        decision, reasons = MODULE.evaluate_release_decision(
            enforced_invariants(), verified_gates(), active_contracts(), impact_map(), {},
            clean_snapshot(), ttl_policy(), actual_head=HEAD, actual_target=TARGET,
            current_control_plane_fingerprint=CONTROL, now=NOW,
            attestation=None, attestation_key=None)
        self.assertEqual("BLOCK", decision)
        self.assertIn("attestation:missing", reasons)
        decision, reasons = evaluate(key=None)
        self.assertEqual("BLOCK", decision)
        self.assertIn("attestation:protected_key_unavailable", reasons)

    def test_tampered_or_wrong_control_attestation_fails_closed(self):
        attestation = signed_attestation()
        attestation["evidence"][0]["status"] = "VERIFIED"
        self.assertIn("attestation:signature_mismatch", evaluate(attestation=attestation)[1])
        attestation = signed_attestation(control=OTHER_CONTROL)
        self.assertIn("attestation:control_plane_mismatch", evaluate(attestation=attestation)[1])

    def test_required_invariant_needs_enforced_status_and_bound_evidence(self):
        inv = enforced_invariants()
        inv["invariants"][0]["status"] = "REGISTERED"
        self.assertIn("invariant:FM-INV-001:REGISTERED", evaluate(invariants=inv)[1])
        entries = current_evidence()
        for entry in entries:
            entry["invariants"] = ["FM-INV-001"]
        self.assertIn("release_evidence:invariant_missing:FM-INV-002",
                      evaluate(attestation=signed_attestation(entries))[1])

    def test_required_invariant_missing_risk_fails_closed(self):
        inv = enforced_invariants()
        del inv["invariants"][0]["risk"]
        self.assertIn("invariant:risk_invalid:FM-INV-001", evaluate(invariants=inv)[1])

    def test_mapped_gate_cannot_hide_behind_applicable_false(self):
        gates = verified_gates()
        gates["gates"][0]["applicable"] = False
        gates["gates"][0]["status"] = "REGISTERED"
        self.assertIn("integration_gate:FM-IGATE-A:REGISTERED", evaluate(gates=gates)[1])

    def test_every_contract_registry_entry_remains_in_authoritative_scope(self):
        contracts = active_contracts()
        contracts["contracts"][1]["status"] = "VERIFIED"
        snapshot = clean_snapshot(affected_contracts=["FM-CONTRACT-A"])
        reasons = evaluate(snapshot=snapshot, contracts=contracts)[1]
        self.assertIn("release_scope:contract_registry_incomplete", reasons)
        contracts["contracts"][1]["status"] = "BLOCKED"
        reasons = evaluate(contracts=contracts)[1]
        self.assertIn("contract:FM-CONTRACT-B:BLOCKED", reasons)

    def test_empty_duplicate_and_unknown_scope_fail_closed(self):
        self.assertIn("release_input:affected_contracts_empty",
                      evaluate(snapshot=clean_snapshot(affected_contracts=[]))[1])
        self.assertIn("release_input:affected_contract_duplicate:FM-CONTRACT-A",
                      evaluate(snapshot=clean_snapshot(affected_contracts=["FM-CONTRACT-A", "FM-CONTRACT-A"]))[1])
        self.assertIn("contract:unknown:FM-CONTRACT-X",
                      evaluate(snapshot=clean_snapshot(affected_contracts=["FM-CONTRACT-A", "FM-CONTRACT-X"]))[1])

    def test_duplicate_impact_mapping_and_risk_downgrade_fail_closed(self):
        impact = impact_map()
        impact["mappings"].append({"contract": "FM-CONTRACT-A", "gates": ["FM-IGATE-B"]})
        self.assertIn("impact_map:duplicate_contract:FM-CONTRACT-A", evaluate(impact=impact)[1])
        self.assertIn("release_input:risk_below_scope_floor:R1<R3",
                      evaluate(snapshot=clean_snapshot(risk="R1"))[1])

    def test_release_sha_and_target_bindings_are_exact(self):
        self.assertIn("release_evidence:evaluated_commit_mismatch",
                      evaluate(snapshot=clean_snapshot(evaluated_commit=OTHER_HEAD))[1])
        snapshot = clean_snapshot(evaluated_target="repository:other")
        self.assertIn("release_evidence:evaluated_target_mismatch", evaluate(snapshot=snapshot)[1])

    def test_revalidation_trigger_fingerprints_are_consumed(self):
        entries = current_evidence()
        entries[0]["trigger_fingerprints"]["workflow_contract_changed"] = "old"
        reasons = evaluate(attestation=signed_attestation(entries))[1]
        self.assertIn("release_evidence:trigger_stale:EV-IMPLEMENTATION:workflow_contract_changed", reasons)
        trigger_state = dict(TRIGGERS)
        trigger_state.pop("runtime_config_change")
        reasons = evaluate(attestation=signed_attestation(trigger_state=trigger_state))[1]
        self.assertTrue(any("runtime_config_change" in reason for reason in reasons))

    def test_mutable_expiry_unknown_class_and_invalidation_fail_closed(self):
        entries = current_evidence()
        entries[1]["observed_at"] = "2026-09-19T20:00:00Z"
        self.assertIn("release_evidence:expired:EV-COUNTERCHECK",
                      evaluate(attestation=signed_attestation(entries))[1])
        entries = current_evidence()
        entries[0]["class"] = "unknown_runtime_class"
        self.assertIn("ttl_policy:unknown_class:unknown_runtime_class:EV-IMPLEMENTATION",
                      evaluate(attestation=signed_attestation(entries))[1])
        entries = current_evidence()
        entries[3]["invalidated_by"] = "later-change"
        self.assertIn("release_evidence:invalidated:EV-RECOVERY",
                      evaluate(attestation=signed_attestation(entries))[1])

    def test_per_gate_negative_and_recovery_records_must_be_distinct(self):
        entries = current_evidence()
        shared = evidence_entry("EV-SHARED", "ci_exact_head", ["negative", "recovery"],
                                ["FM-IGATE-A", "FM-IGATE-B"], source="github:shared",
                                execution_id="run-shared", independence_key="shared")
        entries.append(shared)
        snapshot = clean_snapshot()
        snapshot["evidence_bindings"].append({"id": "EV-SHARED", "commit": HEAD, "target": TARGET})
        reasons = evaluate(snapshot=snapshot, attestation=signed_attestation(entries))[1]
        self.assertIn("release_evidence:gate_negative_recovery_not_distinct:FM-IGATE-A", reasons)

    def test_gate_configured_stronger_roles_are_enforced_not_discarded(self):
        gates = verified_gates()
        gates["gates"][0]["required_roles"] = ALL_ROLES + ["evidence"]
        self.assertIn("release_evidence:gate_role_missing:FM-IGATE-A:evidence", evaluate(gates=gates)[1])
        gates = verified_gates()
        gates["gates"][0]["required_roles"] = ["implementation", "countercheck"]
        self.assertIn("integration_gate:FM-IGATE-A:required_roles_weaker_than_risk", evaluate(gates=gates)[1])

    def test_implementation_countercheck_requires_independent_provenance(self):
        entries = current_evidence()
        entries[1]["provenance"] = dict(entries[0]["provenance"])
        self.assertIn("release_evidence:implementation_countercheck_not_independent",
                      evaluate(attestation=signed_attestation(entries))[1])

    def test_two_class_quorum_requires_independent_provenance_not_labels(self):
        entries = current_evidence()
        for entry in entries:
            entry["class"] = "ci_exact_head"
            entry["trigger_fingerprints"] = {trigger: TRIGGERS[trigger]
                for trigger in ttl_policy()["policy"]["ci_exact_head"]["revalidate_on"]}
        entries[0]["provenance"] = {"source": "source-a", "execution_id": "exec-1", "independence_key": "key-x"}
        entries[1]["provenance"] = {"source": "source-b", "execution_id": "exec-2", "independence_key": "key-y"}
        entries[2]["provenance"] = {"source": "source-a", "execution_id": "exec-2", "independence_key": "key-z"}
        entries[3]["provenance"] = {"source": "source-b", "execution_id": "exec-1", "independence_key": "key-w"}
        supplemental = evidence_entry("EV-SUPPLEMENTAL", "staging_smoke", ["evidence"], [],
                                      source="source-a", execution_id="exec-2", independence_key="key-w")
        entries.append(supplemental)
        snapshot = clean_snapshot()
        snapshot["evidence_bindings"].append({"id": "EV-SUPPLEMENTAL", "commit": HEAD, "target": TARGET})
        reasons = evaluate(snapshot=snapshot, attestation=signed_attestation(entries))[1]
        self.assertIn("release_evidence:quorum_classes_not_independent", reasons)

    def test_one_class_r3_quorum_fails_closed(self):
        entries = current_evidence()
        for entry in entries:
            entry["class"] = "ci_exact_head"
            entry["trigger_fingerprints"] = {trigger: TRIGGERS[trigger]
                for trigger in ttl_policy()["policy"]["ci_exact_head"]["revalidate_on"]}
        self.assertIn("release_evidence:quorum_classes:1<2",
                      evaluate(attestation=signed_attestation(entries))[1])

    def test_findings_red_checks_and_retained_blockers_fail_closed(self):
        self.assertIn("release_input:open_p1", evaluate(snapshot=clean_snapshot(open_p1=1))[1])
        self.assertIn("release_input:failed_required_checks",
                      evaluate(snapshot=clean_snapshot(failed_required_checks=True))[1])
        self.assertIn("declared_blocker:SCHEMA_MISSING",
                      evaluate(snapshot=clean_snapshot(blocking_reasons=["SCHEMA_MISSING"]))[1])
        self.assertIn("release_input:open_p0", evaluate(snapshot=clean_snapshot(open_p0=False))[1])

    def test_protected_action_is_derived_from_operation_and_target(self):
        target = STAGING_TARGET
        entries = current_evidence(target)
        snapshot = clean_snapshot(target=target, operation="staging_apply", protected_action_required=True)
        decision, reasons = evaluate(snapshot=snapshot, actual_target=target,
                                     attestation=signed_attestation(entries, target=target))
        self.assertEqual("OWNER_REQUIRED", decision)
        self.assertEqual(["protected_action_required"], reasons)
        snapshot["protected_action_required"] = False
        self.assertIn("release_input:protected_action_mismatch",
                      evaluate(snapshot=snapshot, actual_target=target,
                               attestation=signed_attestation(entries, target=target))[1])

    def test_protected_operation_cannot_cross_target_namespace(self):
        target = "production:synthetic"
        entries = current_evidence(target)
        snapshot = clean_snapshot(
            target=target,
            operation="staging_apply",
            protected_action_required=True,
        )
        reasons = evaluate(
            snapshot=snapshot,
            actual_target=target,
            attestation=signed_attestation(entries, target=target),
        )[1]
        self.assertIn("release_input:protected_operation_target_mismatch:staging_apply", reasons)

    def test_repository_operation_cannot_target_staging_and_unknown_operation_blocks(self):
        target = STAGING_TARGET
        entries = current_evidence(target)
        snapshot = clean_snapshot(target=target)
        self.assertIn("release_input:repository_operation_target_mismatch",
                      evaluate(snapshot=snapshot, actual_target=target,
                               attestation=signed_attestation(entries, target=target))[1])
        self.assertIn("release_input:unknown_operation:magic_release",
                      evaluate(snapshot=clean_snapshot(operation="magic_release"))[1])

    def test_global_negative_and_recovery_ids_must_be_distinct(self):
        entries = current_evidence()
        entries[2]["roles"] = ["negative", "recovery"]
        snapshot = clean_snapshot(rollback_recovery_evidence_id="EV-NEGATIVE")
        self.assertIn("release_evidence:negative_recovery_not_distinct",
                      evaluate(snapshot=snapshot, attestation=signed_attestation(entries))[1])

    def test_duplicate_evidence_binding_fails_closed(self):
        snapshot = clean_snapshot()
        snapshot["evidence_bindings"].append(dict(snapshot["evidence_bindings"][0]))
        self.assertIn("release_evidence:duplicate_binding:EV-IMPLEMENTATION", evaluate(snapshot=snapshot)[1])


if __name__ == "__main__":
    unittest.main()

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
}


def enforced_invariants():
    return {
        "invariants": [
            {"id": "FM-INV-001", "required": True, "status": "ENFORCED"},
            {"id": "FM-INV-002", "required": True, "status": "ENFORCED"},
        ]
    }


def verified_gates():
    return {
        "gates": [
            {
                "id": "FM-IGATE-A",
                "applicable": True,
                "status": "VERIFIED",
                "contracts": ["FM-CONTRACT-A"],
                "required_roles": list(ALL_ROLES),
            },
            {
                "id": "FM-IGATE-B",
                "applicable": True,
                "status": "VERIFIED",
                "contracts": ["FM-CONTRACT-B"],
                "required_roles": list(ALL_ROLES),
            },
        ]
    }


def active_contracts(minimum_risk="R3"):
    return {
        "contracts": [
            {"id": "FM-CONTRACT-A", "status": "ACTIVE", "minimum_risk": minimum_risk},
            {"id": "FM-CONTRACT-B", "status": "ACTIVE", "minimum_risk": minimum_risk},
        ]
    }


def impact_map():
    return {
        "mappings": [
            {"contract": "FM-CONTRACT-A", "gates": ["FM-IGATE-A"]},
            {"contract": "FM-CONTRACT-B", "gates": ["FM-IGATE-B"]},
        ]
    }


def ttl_policy():
    return {
        "policy": {
            "ci_exact_head": {
                "ttl_hours": None,
                "revalidate_on": ["head_changed", "workflow_contract_changed"],
            },
            "staging_smoke": {
                "ttl_hours": 24,
                "revalidate_on": ["staging_deploy", "runtime_config_change"],
            },
        }
    }


def evidence_entry(
    evidence_id,
    evidence_class,
    roles,
    gates,
    *,
    target=TARGET,
    head=HEAD,
    source,
    execution_id,
    independence_key,
    invariants=None,
):
    required_triggers = ttl_policy()["policy"][evidence_class]["revalidate_on"]
    return {
        "id": evidence_id,
        "status": "COUNTERCHECKED",
        "class": evidence_class,
        "roles": roles,
        "gates": gates,
        "invariants": invariants if invariants is not None else ["FM-INV-001", "FM-INV-002"],
        "bound_commit": head,
        "target": target,
        "observed_at": "2026-09-21T21:30:00Z",
        "control_plane_fingerprint": CONTROL,
        "trigger_fingerprints": {trigger: TRIGGERS[trigger] for trigger in required_triggers},
        "provenance": {
            "source": source,
            "execution_id": execution_id,
            "independence_key": independence_key,
        },
    }


def current_evidence(target=TARGET, head=HEAD):
    both = ["FM-IGATE-A", "FM-IGATE-B"]
    return [
        evidence_entry(
            "EV-IMPLEMENTATION",
            "ci_exact_head",
            ["implementation"],
            both,
            target=target,
            head=head,
            source="github-actions:implementation",
            execution_id="run-impl-1",
            independence_key="impl-quorum-1",
        ),
        evidence_entry(
            "EV-COUNTERCHECK",
            "staging_smoke",
            ["countercheck"],
            both,
            target=target,
            head=head,
            source="protected-staging:countercheck",
            execution_id="run-counter-2",
            independence_key="counter-quorum-2",
        ),
        evidence_entry(
            "EV-NEGATIVE",
            "ci_exact_head",
            ["negative"],
            both,
            target=target,
            head=head,
            source="github-actions:negative",
            execution_id="run-negative-3",
            independence_key="negative-quorum-3",
        ),
        evidence_entry(
            "EV-RECOVERY",
            "staging_smoke",
            ["recovery"],
            both,
            target=target,
            head=head,
            source="protected-staging:recovery",
            execution_id="run-recovery-4",
            independence_key="recovery-quorum-4",
        ),
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
        "open_p0": 0,
        "open_p1": 0,
        "open_p2": 0,
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


def evaluate(
    snapshot=None,
    invariants=None,
    gates=None,
    contracts=None,
    impact=None,
    policy=None,
    actual_head=HEAD,
    actual_target=TARGET,
    control=CONTROL,
    attestation=None,
    key=KEY,
):
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


+class GodModeReleaseDecisionTests(unittest.TestCase):
+    def test_clean_repository_release_allows_only_with_protected_attestation(self):
+        decision, reasons = evaluate()
+        self.assertEqual("ALLOW", decision)
+        self.assertEqual([], reasons)
+
+    def test_missing_attestation_fails_closed(self):
+        decision, reasons = MODULE.evaluate_release_decision(
+            enforced_invariants(), verified_gates(), active_contracts(), impact_map(), {},
+            clean_snapshot(), ttl_policy(), actual_head=HEAD, actual_target=TARGET,
+            current_control_plane_fingerprint=CONTROL, now=NOW, attestation=None,
+            attestation_key=None,
+        )
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("attestation:missing", reasons)
+
+    def test_attestation_signature_tamper_fails_closed(self):
+        attestation = signed_attestation()
+        attestation["evidence"][0]["status"] = "VERIFIED"
+        decision, reasons = evaluate(attestation=attestation)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("attestation:signature_mismatch", reasons)
+
+    def test_attestation_control_plane_mismatch_fails_closed(self):
+        attestation = signed_attestation(control=OTHER_CONTROL)
+        decision, reasons = evaluate(attestation=attestation)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("attestation:control_plane_mismatch", reasons)
+
+    def test_attestation_without_protected_key_fails_closed(self):
+        decision, reasons = evaluate(key=None)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("attestation:protected_key_unavailable", reasons)
+
+    def test_broken_invariant_status_forces_block(self):
+        inv = enforced_invariants()
+        inv["invariants"][0]["status"] = "REGISTERED"
+        decision, reasons = evaluate(invariants=inv)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("invariant:FM-INV-001:REGISTERED", reasons)
+
+    def test_required_invariant_needs_current_bound_evidence(self):
+        entries = current_evidence()
+        for entry in entries:
+            entry["invariants"] = ["FM-INV-001"]
+        decision, reasons = evaluate(attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:invariant_missing:FM-INV-002", reasons)
+
+    def test_unverified_integration_gate_forces_block(self):
+        gates = verified_gates()
+        gates["gates"][1]["status"] = "NEEDS_REVALIDATION"
+        decision, reasons = evaluate(gates=gates)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("integration_gate:FM-IGATE-B:NEEDS_REVALIDATION", reasons)
+
+    def test_mapped_gate_is_mandatory_even_when_applicable_false(self):
+        gates = verified_gates()
+        gates["gates"][0]["applicable"] = False
+        gates["gates"][0]["status"] = "REGISTERED"
+        decision, reasons = evaluate(gates=gates)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("integration_gate:FM-IGATE-A:REGISTERED", reasons)
+
+    def test_every_contract_registry_entry_remains_authoritative_scope(self):
+        contracts = active_contracts()
+        contracts["contracts"][1]["status"] = "VERIFIED"
+        snapshot = clean_snapshot(affected_contracts=["FM-CONTRACT-A"])
+        decision, reasons = evaluate(snapshot=snapshot, contracts=contracts)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_scope:contract_registry_incomplete", reasons)
+
+    def test_non_active_contract_cannot_be_hidden_by_status_change(self):
+        contracts = active_contracts()
+        contracts["contracts"][1]["status"] = "BLOCKED"
+        decision, reasons = evaluate(contracts=contracts)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("contract:FM-CONTRACT-B:BLOCKED", reasons)
+
+    def test_empty_contract_scope_forces_block(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(affected_contracts=[]))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:affected_contracts_empty", reasons)
+
+    def test_duplicate_impact_mapping_forces_block(self):
+        impact = impact_map()
+        impact["mappings"].append({"contract": "FM-CONTRACT-A", "gates": ["FM-IGATE-B"]})
+        decision, reasons = evaluate(impact=impact)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("impact_map:duplicate_contract:FM-CONTRACT-A", reasons)
+
+    def test_risk_cannot_be_downgraded_below_contract_floor(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(risk="R1"))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:risk_below_scope_floor:R1<R3", reasons)
+
+    def test_r4_contract_forces_r4_floor(self):
+        contracts = active_contracts()
+        contracts["contracts"][0]["minimum_risk"] = "R4"
+        decision, reasons = evaluate(contracts=contracts)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:risk_below_scope_floor:R3<R4", reasons)
+
+    def test_bound_release_sha_mismatch_forces_block(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(evaluated_commit=OTHER_HEAD))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:evaluated_commit_mismatch", reasons)
+
+    def test_trigger_fingerprint_mismatch_invalidates_evidence(self):
+        entries = current_evidence()
+        entries[0]["trigger_fingerprints"]["workflow_contract_changed"] = "old-workflow"
+        decision, reasons = evaluate(attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn(
+            "release_evidence:trigger_stale:EV-IMPLEMENTATION:workflow_contract_changed",
+            reasons,
+        )
+
+    def test_missing_trigger_state_invalidates_evidence(self):
+        trigger_state = dict(TRIGGERS)
+        trigger_state.pop("runtime_config_change")
+        decision, reasons = evaluate(attestation=signed_attestation(trigger_state=trigger_state))
+        self.assertEqual("BLOCK", decision)
+        self.assertTrue(any("runtime_config_change" in reason for reason in reasons))
+
+    def test_mutable_evidence_expiry_forces_block(self):
+        entries = current_evidence()
+        entries[1]["observed_at"] = "2026-09-19T20:00:00Z"
+        decision, reasons = evaluate(attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:expired:EV-COUNTERCHECK", reasons)
+
+    def test_unknown_evidence_class_fails_closed(self):
+        entries = current_evidence()
+        entries[0]["class"] = "unknown_runtime_class"
+        decision, reasons = evaluate(attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("ttl_policy:unknown_class:unknown_runtime_class:EV-IMPLEMENTATION", reasons)
+
+    def test_per_gate_negative_and_recovery_must_use_distinct_records(self):
+        entries = current_evidence()
+        shared = evidence_entry(
+            "EV-SHARED-NEG-REC", "ci_exact_head", ["negative", "recovery"],
+            ["FM-IGATE-A", "FM-IGATE-B"], source="github-actions:shared",
+            execution_id="run-shared-8", independence_key="shared-8",
+        )
+        entries.append(shared)
+        snapshot = clean_snapshot()
+        snapshot["evidence_bindings"].append(
+            {"id": "EV-SHARED-NEG-REC", "commit": HEAD, "target": TARGET}
+        )
+        decision, reasons = evaluate(snapshot=snapshot, attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:gate_negative_recovery_not_distinct:FM-IGATE-A", reasons)
+
+    def test_gate_configured_stronger_roles_are_actually_enforced(self):
+        gates = verified_gates()
+        gates["gates"][0]["required_roles"] = ALL_ROLES + ["evidence"]
+        decision, reasons = evaluate(gates=gates)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:gate_role_missing:FM-IGATE-A:evidence", reasons)
+
+    def test_gate_cannot_configure_weaker_roles_than_risk(self):
+        gates = verified_gates()
+        gates["gates"][0]["required_roles"] = ["implementation", "countercheck"]
+        decision, reasons = evaluate(gates=gates)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("integration_gate:FM-IGATE-A:required_roles_weaker_than_risk", reasons)
+
+    def test_implementation_countercheck_requires_independent_provenance(self):
+        entries = current_evidence()
+        entries[1]["provenance"] = dict(entries[0]["provenance"])
+        decision, reasons = evaluate(attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:implementation_countercheck_not_independent", reasons)
+
+    def test_two_class_quorum_requires_independent_provenance_not_labels(self):
+        entries = current_evidence()
+        for entry in entries:
+            entry["class"] = "ci_exact_head"
+            entry["trigger_fingerprints"] = {
+                trigger: TRIGGERS[trigger]
+                for trigger in ttl_policy()["policy"]["ci_exact_head"]["revalidate_on"]
+            }
+        supplemental = evidence_entry(
+            "EV-SUPPLEMENTAL-CLASS", "staging_smoke", ["evidence"], [],
+            source=entries[0]["provenance"]["source"],
+            execution_id=entries[1]["provenance"]["execution_id"],
+            independence_key="supplemental-key",
+        )
+        entries.append(supplemental)
+        snapshot = clean_snapshot()
+        snapshot["evidence_bindings"].append(
+            {"id": "EV-SUPPLEMENTAL-CLASS", "commit": HEAD, "target": TARGET}
+        )
+        decision, reasons = evaluate(snapshot=snapshot, attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:quorum_classes_not_independent", reasons)
+
+    def test_one_class_quorum_for_r3_forces_block(self):
+        entries = current_evidence()
+        for entry in entries:
+            entry["class"] = "ci_exact_head"
+            entry["trigger_fingerprints"] = {
+                trigger: TRIGGERS[trigger]
+                for trigger in ttl_policy()["policy"]["ci_exact_head"]["revalidate_on"]
+            }
+        decision, reasons = evaluate(attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:quorum_classes:1<2", reasons)
+
+    def test_open_p1_forces_block(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(open_p1=1))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:open_p1", reasons)
+
+    def test_boolean_cannot_masquerade_as_finding_count(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(open_p0=False))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:open_p0", reasons)
+
+    def test_failed_required_check_forces_block(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(failed_required_checks=True))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:failed_required_checks", reasons)
+
+    def test_retained_blocking_reason_forces_block(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(blocking_reasons=["SCHEMA_MISSING"]))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("declared_blocker:SCHEMA_MISSING", reasons)
+
+    def test_repository_operation_on_staging_target_fails_closed(self):
+        target = STAGING_TARGET
+        snapshot = clean_snapshot(target=target)
+        entries = current_evidence(target)
+        decision, reasons = evaluate(
+            snapshot=snapshot,
+            actual_target=target,
+            attestation=signed_attestation(entries, target=target),
+        )
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:repository_operation_target_mismatch", reasons)
+
+    def test_staging_apply_is_derived_owner_required(self):
+        target = STAGING_TARGET
+        snapshot = clean_snapshot(
+            target=target,
+            operation="staging_apply",
+            protected_action_required=True,
+        )
+        entries = current_evidence(target)
+        decision, reasons = evaluate(
+            snapshot=snapshot,
+            actual_target=target,
+            attestation=signed_attestation(entries, target=target),
+        )
+        self.assertEqual("OWNER_REQUIRED", decision)
+        self.assertEqual(["protected_action_required"], reasons)
+
+    def test_staging_apply_cannot_self_declare_unprotected(self):
+        target = STAGING_TARGET
+        snapshot = clean_snapshot(
+            target=target,
+            operation="staging_apply",
+            protected_action_required=False,
+        )
+        entries = current_evidence(target)
+        decision, reasons = evaluate(
+            snapshot=snapshot,
+            actual_target=target,
+            attestation=signed_attestation(entries, target=target),
+        )
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:protected_action_mismatch", reasons)
+
+    def test_unknown_operation_fails_closed(self):
+        decision, reasons = evaluate(snapshot=clean_snapshot(operation="magic_release"))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_input:unknown_operation:magic_release", reasons)
+
+    def test_global_negative_and_recovery_ids_must_be_distinct(self):
+        snapshot = clean_snapshot(rollback_recovery_evidence_id="EV-NEGATIVE")
+        entries = current_evidence()
+        entries[2]["roles"] = ["negative", "recovery"]
+        decision, reasons = evaluate(snapshot=snapshot, attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:negative_recovery_not_distinct", reasons)
+
+    def test_duplicate_evidence_binding_forces_block(self):
+        snapshot = clean_snapshot()
+        snapshot["evidence_bindings"].append(dict(snapshot["evidence_bindings"][0]))
+        decision, reasons = evaluate(snapshot=snapshot)
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:duplicate_binding:EV-IMPLEMENTATION", reasons)
+
+    def test_invalidated_evidence_forces_block(self):
+        entries = current_evidence()
+        entries[3]["invalidated_by"] = "later-change"
+        decision, reasons = evaluate(attestation=signed_attestation(entries))
+        self.assertEqual("BLOCK", decision)
+        self.assertIn("release_evidence:invalidated:EV-RECOVERY", reasons)
+
+
+if __name__ == "__main__":
+    unittest.main()

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
TARGET = "synthetic-staging"
NOW = datetime(2026, 9, 21, 22, 0, 0, tzinfo=timezone.utc)


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
            },
            {
                "id": "FM-IGATE-B",
                "applicable": True,
                "status": "VERIFIED",
                "contracts": ["FM-CONTRACT-B"],
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
            "ci_exact_head": {"ttl_hours": None, "revalidate_on": ["head_changed"]},
            "staging_smoke": {"ttl_hours": 24, "revalidate_on": ["staging_deploy"]},
        }
    }


def evidence_entry(evidence_id, evidence_class, roles, gates):
    return {
        "id": evidence_id,
        "status": "COUNTERCHECKED",
        "class": evidence_class,
        "roles": roles,
        "gates": gates,
        "bound_commit": HEAD,
        "target": TARGET,
        "observed_at": "2026-09-21T21:30:00Z",
    }


def current_freshness():
    return {
        "entries": [
            evidence_entry(
                "EV-IMPLEMENTATION", "ci_exact_head", ["implementation"], ["FM-IGATE-A"]
            ),
            evidence_entry(
                "EV-COUNTERCHECK", "staging_smoke", ["countercheck"], ["FM-IGATE-B"]
            ),
            evidence_entry(
                "EV-NEGATIVE",
                "ci_exact_head",
                ["negative"],
                ["FM-IGATE-A", "FM-IGATE-B"],
            ),
            evidence_entry(
                "EV-RECOVERY",
                "staging_smoke",
                ["recovery"],
                ["FM-IGATE-A", "FM-IGATE-B"],
            ),
        ]
    }


def clean_snapshot(**overrides):
    data = {
        "risk": "R3",
        "affected_contracts": ["FM-CONTRACT-A", "FM-CONTRACT-B"],
        "evaluated_commit": HEAD,
        "evaluated_target": TARGET,
        "evidence_bindings": [
            {"id": "EV-IMPLEMENTATION", "commit": HEAD, "target": TARGET},
            {"id": "EV-COUNTERCHECK", "commit": HEAD, "target": TARGET},
            {"id": "EV-NEGATIVE", "commit": HEAD, "target": TARGET},
            {"id": "EV-RECOVERY", "commit": HEAD, "target": TARGET},
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


def evaluate(
    snapshot=None,
    invariants=None,
    gates=None,
    contracts=None,
    impact=None,
    freshness=None,
    policy=None,
    actual_head=HEAD,
    actual_target=TARGET,
    now=NOW,
):
    return MODULE.evaluate_release_decision(
        invariants or enforced_invariants(),
        gates or verified_gates(),
        contracts or active_contracts(),
        impact or impact_map(),
        freshness or current_freshness(),
        snapshot or clean_snapshot(),
        policy or ttl_policy(),
        actual_head=actual_head,
        actual_target=actual_target,
        now=now,
    )


class GodModeReleaseDecisionTests(unittest.TestCase):
    def test_allow_only_when_every_gate_is_clean_and_evidence_is_bound(self):
        decision, reasons = evaluate()
        self.assertEqual("ALLOW", decision)
        self.assertEqual([], reasons)

    def test_broken_invariant_forces_block(self):
        inv = enforced_invariants()
        inv["invariants"][0]["status"] = "REGISTERED"
        decision, reasons = evaluate(invariants=inv)
        self.assertEqual("BLOCK", decision)
        self.assertTrue(any("FM-INV-001" in reason for reason in reasons))

    def test_unverified_integration_gate_forces_block(self):
        gates = verified_gates()
        gates["gates"][1]["status"] = "NEEDS_REVALIDATION"
        decision, reasons = evaluate(gates=gates)
        self.assertEqual("BLOCK", decision)
        self.assertTrue(any("FM-IGATE-B" in reason for reason in reasons))

    def test_affected_contract_forces_mapped_gate_even_when_gate_claims_inapplicable(self):
        gates = verified_gates()
        gates["gates"][0]["applicable"] = False
        gates["gates"][0]["status"] = "REGISTERED"
        decision, reasons = evaluate(gates=gates)
        self.assertEqual("BLOCK", decision)
        self.assertIn("integration_gate:FM-IGATE-A:REGISTERED", reasons)

    def test_unknown_affected_contract_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(affected_contracts=["FM-CONTRACT-MISSING"]))
        self.assertEqual("BLOCK", decision)
        self.assertIn("contract:unknown:FM-CONTRACT-MISSING", reasons)

    def test_empty_affected_scope_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(affected_contracts=[]))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:affected_contracts_empty", reasons)

    def test_duplicate_affected_contract_forces_block(self):
        decision, reasons = evaluate(
            clean_snapshot(affected_contracts=["FM-CONTRACT-A", "FM-CONTRACT-A"])
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:affected_contract_duplicate:FM-CONTRACT-A", reasons)

    def test_inactive_affected_contract_forces_block(self):
        contracts = active_contracts()
        contracts["contracts"][0]["status"] = "REGISTERED"
        decision, reasons = evaluate(contracts=contracts)
        self.assertEqual("BLOCK", decision)
        self.assertIn("contract:FM-CONTRACT-A:REGISTERED", reasons)

    def test_duplicate_impact_mapping_forces_block_instead_of_last_write_wins(self):
        impact = impact_map()
        impact["mappings"].append(
            {"contract": "FM-CONTRACT-A", "gates": ["FM-IGATE-B"]}
        )
        decision, reasons = evaluate(impact=impact)
        self.assertEqual("BLOCK", decision)
        self.assertIn("impact_map:duplicate_contract:FM-CONTRACT-A", reasons)

    def test_stale_commit_binding_forces_block_even_when_boolean_claims_are_clean(self):
        snapshot = clean_snapshot(evaluated_commit=OTHER_HEAD)
        decision, reasons = evaluate(snapshot)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:evaluated_commit_mismatch", reasons)

    def test_runtime_release_sha_can_differ_from_control_plane_checkout(self):
        runtime_head = OTHER_HEAD
        snapshot = clean_snapshot(evaluated_commit=runtime_head)
        snapshot["evidence_bindings"] = [
            {**binding, "commit": runtime_head} for binding in snapshot["evidence_bindings"]
        ]
        freshness = current_freshness()
        for entry in freshness["entries"]:
            entry["bound_commit"] = runtime_head
        decision, reasons = evaluate(
            snapshot=snapshot, freshness=freshness, actual_head=runtime_head
        )
        self.assertEqual("ALLOW", decision)
        self.assertEqual([], reasons)

    def test_stale_evidence_registry_binding_forces_block(self):
        freshness = current_freshness()
        freshness["entries"][0]["bound_commit"] = OTHER_HEAD
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:commit_mismatch:EV-IMPLEMENTATION", reasons)

    def test_wrong_target_binding_forces_block(self):
        snapshot = clean_snapshot(evaluated_target="production")
        decision, reasons = evaluate(snapshot)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:evaluated_target_mismatch", reasons)

    def test_invalidated_evidence_forces_block(self):
        freshness = current_freshness()
        freshness["entries"][3]["invalidated_by"] = "later-runtime-change"
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:invalidated:EV-RECOVERY", reasons)

    def test_mutable_evidence_expires_on_unchanged_head_and_target(self):
        freshness = current_freshness()
        freshness["entries"][1]["observed_at"] = "2026-09-19T20:00:00Z"
        freshness["entries"][3]["observed_at"] = "2026-09-19T20:00:00Z"
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:expired:EV-COUNTERCHECK", reasons)
        self.assertIn("release_evidence:expired:EV-RECOVERY", reasons)

    def test_malformed_mutable_observed_at_forces_block(self):
        freshness = current_freshness()
        freshness["entries"][1]["observed_at"] = "not-a-timestamp"
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:observed_at_invalid:EV-COUNTERCHECK", reasons)

    def test_r3_requires_two_independent_evidence_classes(self):
        freshness = current_freshness()
        for entry in freshness["entries"]:
            entry["class"] = "ci_exact_head"
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:quorum_classes:1<2", reasons)

    def test_negative_and_recovery_roles_must_be_typed_and_distinct(self):
        freshness = current_freshness()
        freshness["entries"][3]["roles"] = ["negative"]
        snapshot = clean_snapshot(rollback_recovery_evidence_id="EV-NEGATIVE")
        decision, reasons = evaluate(snapshot=snapshot, freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:role_missing:recovery", reasons)
        self.assertIn("release_evidence:rollback_recovery_missing_or_unbound", reasons)
        self.assertIn("release_evidence:negative_recovery_not_distinct", reasons)

    def test_required_gate_needs_current_gate_specific_evidence(self):
        freshness = current_freshness()
        for entry in freshness["entries"]:
            entry["gates"] = [gate for gate in entry["gates"] if gate != "FM-IGATE-B"]
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:gate_evidence_missing:FM-IGATE-B", reasons)

    def test_risk_cannot_be_downgraded_below_contract_floor(self):
        decision, reasons = evaluate(clean_snapshot(risk="R1"))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:risk_below_scope_floor:R1<R3", reasons)

    def test_r4_contract_forces_r4_floor(self):
        contracts = active_contracts()
        contracts["contracts"][0]["minimum_risk"] = "R4"
        decision, reasons = evaluate(clean_snapshot(risk="R3"), contracts=contracts)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:risk_below_scope_floor:R3<R4", reasons)

    def test_open_p0_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(open_p0=1))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:open_p0", reasons)

    def test_boolean_cannot_masquerade_as_zero_count(self):
        decision, reasons = evaluate(clean_snapshot(open_p0=False))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:open_p0", reasons)

    def test_integer_cannot_masquerade_as_boolean(self):
        decision, reasons = evaluate(clean_snapshot(dependencies_satisfied=1))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:dependencies_satisfied", reasons)

    def test_failed_required_check_forces_block_independent_of_pending_state(self):
        decision, reasons = evaluate(
            clean_snapshot(pending_checks=False, failed_required_checks=True)
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:failed_required_checks", reasons)

    def test_declared_blocking_reason_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(blocking_reasons=["SCHEMA_MISSING"]))
        self.assertEqual("BLOCK", decision)
        self.assertIn("declared_blocker:SCHEMA_MISSING", reasons)

    def test_malformed_blocking_reasons_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(blocking_reasons=None))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:blocking_reasons", reasons)

    def test_missing_negative_evidence_binding_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(negative_evidence_id="EV-MISSING"))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:negative_missing_or_unbound", reasons)

    def test_missing_recovery_evidence_binding_forces_block(self):
        decision, reasons = evaluate(
            clean_snapshot(rollback_recovery_evidence_id="EV-MISSING")
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:rollback_recovery_missing_or_unbound", reasons)

    def test_omitted_protected_action_state_forces_block(self):
        snapshot = clean_snapshot()
        del snapshot["protected_action_required"]
        decision, reasons = evaluate(snapshot)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:protected_action_required", reasons)

    def test_malformed_protected_action_state_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(protected_action_required=0))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:protected_action_required", reasons)

    def test_protected_action_requires_owner_after_technical_quorum(self):
        decision, reasons = evaluate(clean_snapshot(protected_action_required=True))
        self.assertEqual("OWNER_REQUIRED", decision)
        self.assertEqual(["protected_action_required"], reasons)

    def test_r2_requires_independent_countercheck_and_negative_proof(self):
        contracts = active_contracts(minimum_risk="R2")
        snapshot = clean_snapshot(risk="R2", countercheck_evidence_id="EV-IMPLEMENTATION")
        decision, reasons = evaluate(snapshot=snapshot, contracts=contracts)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:countercheck_missing_or_unbound", reasons)
        self.assertIn("release_evidence:implementation_countercheck_not_independent", reasons)

    def test_unknown_evidence_class_fails_closed(self):
        freshness = current_freshness()
        freshness["entries"][0]["class"] = "unknown_runtime_class"
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            "ttl_policy:unknown_class:unknown_runtime_class:EV-IMPLEMENTATION", reasons
        )


if __name__ == "__main__":
    unittest.main()

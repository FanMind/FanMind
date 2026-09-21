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
TARGET = "synthetic-staging"


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


def active_contracts():
    return {
        "contracts": [
            {"id": "FM-CONTRACT-A", "status": "ACTIVE", "minimum_risk": "R3"},
            {"id": "FM-CONTRACT-B", "status": "ACTIVE", "minimum_risk": "R3"},
        ]
    }


def impact_map():
    return {
        "mappings": [
            {"contract": "FM-CONTRACT-A", "gates": ["FM-IGATE-A"]},
            {"contract": "FM-CONTRACT-B", "gates": ["FM-IGATE-B"]},
        ]
    }


def current_freshness():
    return {
        "entries": [
            {
                "id": "EV-NEGATIVE",
                "status": "COUNTERCHECKED",
                "class": "negative_test",
                "bound_commit": HEAD,
                "target": TARGET,
            },
            {
                "id": "EV-RECOVERY",
                "status": "VERIFIED",
                "class": "recovery_test",
                "bound_commit": HEAD,
                "target": TARGET,
            },
        ]
    }


def clean_snapshot(**overrides):
    data = {
        "risk": "R3",
        "affected_contracts": ["FM-CONTRACT-A", "FM-CONTRACT-B"],
        "evaluated_commit": HEAD,
        "evaluated_target": TARGET,
        "evidence_bindings": [
            {"id": "EV-NEGATIVE", "commit": HEAD, "target": TARGET},
            {"id": "EV-RECOVERY", "commit": HEAD, "target": TARGET},
        ],
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


def evaluate(snapshot=None, invariants=None, gates=None, contracts=None, impact=None, freshness=None):
    return MODULE.evaluate_release_decision(
        invariants or enforced_invariants(),
        gates or verified_gates(),
        contracts or active_contracts(),
        impact or impact_map(),
        freshness or current_freshness(),
        snapshot or clean_snapshot(),
        actual_head=HEAD,
        actual_target=TARGET,
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

    def test_inactive_affected_contract_forces_block(self):
        contracts = active_contracts()
        contracts["contracts"][0]["status"] = "REGISTERED"
        decision, reasons = evaluate(contracts=contracts)
        self.assertEqual("BLOCK", decision)
        self.assertIn("contract:FM-CONTRACT-A:REGISTERED", reasons)

    def test_stale_commit_binding_forces_block_even_when_boolean_claims_are_clean(self):
        stale = "b" * 40
        snapshot = clean_snapshot(evaluated_commit=stale)
        decision, reasons = evaluate(snapshot)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:evaluated_commit_mismatch", reasons)

    def test_stale_evidence_registry_binding_forces_block(self):
        freshness = current_freshness()
        freshness["entries"][0]["bound_commit"] = "b" * 40
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:commit_mismatch:EV-NEGATIVE", reasons)

    def test_wrong_target_binding_forces_block(self):
        snapshot = clean_snapshot(evaluated_target="production")
        decision, reasons = evaluate(snapshot)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:evaluated_target_mismatch", reasons)

    def test_invalidated_evidence_forces_block(self):
        freshness = current_freshness()
        freshness["entries"][1]["invalidated_by"] = "later-runtime-change"
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:invalidated:EV-RECOVERY", reasons)

    def test_r3_requires_two_independent_evidence_classes(self):
        freshness = current_freshness()
        freshness["entries"][1]["class"] = "negative_test"
        decision, reasons = evaluate(freshness=freshness)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:quorum_classes:1<2", reasons)

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

    def test_failed_required_check_forces_block_independent_of_pending_state(self):
        decision, reasons = evaluate(clean_snapshot(pending_checks=False, failed_required_checks=True))
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
        decision, reasons = evaluate(clean_snapshot(rollback_recovery_evidence_id="EV-MISSING"))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:rollback_recovery_missing_or_unbound", reasons)

    def test_protected_action_requires_owner_after_technical_quorum(self):
        decision, reasons = evaluate(clean_snapshot(protected_action_required=True))
        self.assertEqual("OWNER_REQUIRED", decision)
        self.assertEqual(["protected_action_required"], reasons)


if __name__ == "__main__":
    unittest.main()

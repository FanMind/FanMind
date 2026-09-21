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
            {"id": "FM-IGATE-A", "applicable": True, "status": "VERIFIED"},
            {"id": "FM-IGATE-B", "applicable": True, "status": "VERIFIED"},
        ]
    }


def active_contracts():
    return {
        "contracts": [
            {"id": "FM-CONTRACT-A", "status": "ACTIVE"},
            {"id": "FM-CONTRACT-B", "status": "ACTIVE"},
        ]
    }


def clean_snapshot(**overrides):
    data = {
        "risk": "R3",
        "affected_contracts": ["FM-CONTRACT-A", "FM-CONTRACT-B"],
        "current_head_bound": True,
        "evidence_quorum_complete": True,
        "evidence_freshness_current": True,
        "dependencies_satisfied": True,
        "consumer_impact_revalidated": True,
        "negative_evidence_complete": True,
        "rollback_recovery_evidence_complete": True,
        "open_p1": 0,
        "open_p2": 0,
        "pending_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
        "protected_action_required": False,
    }
    data.update(overrides)
    return data


def evaluate(snapshot=None, invariants=None, gates=None, contracts=None):
    return MODULE.evaluate_release_decision(
        invariants or enforced_invariants(),
        gates or verified_gates(),
        contracts or active_contracts(),
        snapshot or clean_snapshot(),
    )


class GodModeReleaseDecisionTests(unittest.TestCase):
    def test_allow_only_when_every_gate_is_clean(self):
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

    def test_stale_or_unbound_head_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(current_head_bound=False))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:current_head_bound", reasons)

    def test_missing_or_stale_evidence_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(evidence_freshness_current=False))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:evidence_freshness_current", reasons)

    def test_unmet_dependencies_force_block(self):
        decision, reasons = evaluate(clean_snapshot(dependencies_satisfied=False))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:dependencies_satisfied", reasons)

    def test_consumer_impact_not_revalidated_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(consumer_impact_revalidated=False))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:consumer_impact_revalidated", reasons)

    def test_inactive_affected_contract_forces_block(self):
        contracts = active_contracts()
        contracts["contracts"][0]["status"] = "REGISTERED"
        decision, reasons = evaluate(contracts=contracts)
        self.assertEqual("BLOCK", decision)
        self.assertIn("contract:FM-CONTRACT-A:REGISTERED", reasons)

    def test_unknown_affected_contract_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(affected_contracts=["FM-CONTRACT-MISSING"]))
        self.assertEqual("BLOCK", decision)
        self.assertIn("contract:unknown:FM-CONTRACT-MISSING", reasons)

    def test_r3_missing_negative_evidence_forces_block(self):
        decision, reasons = evaluate(clean_snapshot(negative_evidence_complete=False))
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:negative_evidence_complete", reasons)

    def test_r4_missing_rollback_recovery_forces_block(self):
        decision, reasons = evaluate(
            clean_snapshot(risk="R4", rollback_recovery_evidence_complete=False)
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:rollback_recovery_evidence_complete", reasons)

    def test_protected_action_requires_owner_after_technical_quorum(self):
        decision, reasons = evaluate(clean_snapshot(protected_action_required=True))
        self.assertEqual("OWNER_REQUIRED", decision)
        self.assertEqual(["protected_action_required"], reasons)


if __name__ == "__main__":
    unittest.main()

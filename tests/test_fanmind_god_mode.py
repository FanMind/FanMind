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


def clean_snapshot(**overrides):
    data = {
        "current_head_bound": True,
        "evidence_quorum_complete": True,
        "open_p1": 0,
        "open_p2": 0,
        "pending_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
        "protected_action_required": False,
    }
    data.update(overrides)
    return data


class GodModeReleaseDecisionTests(unittest.TestCase):
    def test_allow_only_when_every_gate_is_clean(self):
        decision, reasons = MODULE.evaluate_release_decision(
            enforced_invariants(), verified_gates(), clean_snapshot()
        )
        self.assertEqual("ALLOW", decision)
        self.assertEqual([], reasons)

    def test_broken_invariant_forces_block(self):
        inv = enforced_invariants()
        inv["invariants"][0]["status"] = "REGISTERED"
        decision, reasons = MODULE.evaluate_release_decision(
            inv, verified_gates(), clean_snapshot()
        )
        self.assertEqual("BLOCK", decision)
        self.assertTrue(any("FM-INV-001" in reason for reason in reasons))

    def test_unverified_integration_gate_forces_block(self):
        gates = verified_gates()
        gates["gates"][1]["status"] = "NEEDS_REVALIDATION"
        decision, reasons = MODULE.evaluate_release_decision(
            enforced_invariants(), gates, clean_snapshot()
        )
        self.assertEqual("BLOCK", decision)
        self.assertTrue(any("FM-IGATE-B" in reason for reason in reasons))

    def test_stale_or_unbound_head_forces_block(self):
        decision, reasons = MODULE.evaluate_release_decision(
            enforced_invariants(), verified_gates(), clean_snapshot(current_head_bound=False)
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:current_head_bound", reasons)

    def test_protected_action_requires_owner_after_technical_quorum(self):
        decision, reasons = MODULE.evaluate_release_decision(
            enforced_invariants(),
            verified_gates(),
            clean_snapshot(protected_action_required=True),
        )
        self.assertEqual("OWNER_REQUIRED", decision)
        self.assertEqual(["protected_action_required"], reasons)


if __name__ == "__main__":
    unittest.main()

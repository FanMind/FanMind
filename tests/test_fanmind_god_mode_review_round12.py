from copy import deepcopy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_round12_base_tests",
    ROOT / "tests" / "test_fanmind_god_mode_review_hardening.py",
)
BASE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BASE)


class CurrentHeadRound12RegressionTests(unittest.TestCase):
    def test_round12_wrapper_is_part_of_signed_control_plane(self):
        self.assertIn(
            "scripts/fanmind_release_decision_core_round12.py",
            BASE.MODULE.CONTROL_PLANE_FILES,
        )

    def test_direct_core_cli_delegates_to_newest_wrapper(self):
        source = (ROOT / "scripts" / "fanmind_release_decision_core.py").read_text(
            encoding="utf-8"
        )
        self.assertIn(
            "from fanmind_release_decision_core_round12 import main as _round12_main",
            source,
        )
        self.assertIn("raise SystemExit(_round12_main())", source)

    def test_duplicate_gate_boundaries_fail_closed_instead_of_set_normalization(self):
        entry = BASE.evidence()
        entry["gates"] = [BASE.GATE, BASE.GATE]
        decision, reasons = BASE.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"release_evidence:gates_duplicate:{entry['id']}", reasons)

    def test_singular_and_plural_boundary_declarations_are_ambiguous(self):
        entry = BASE.evidence()
        entry["gate"] = BASE.GATE
        decision, reasons = BASE.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"release_evidence:gates_ambiguous:{entry['id']}", reasons)

    def test_malformed_invariant_boundary_member_fails_closed(self):
        entry = BASE.evidence()
        entry["invariants"] = [BASE.INVARIANT, "   "]
        decision, reasons = BASE.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"release_evidence:invariants_invalid:{entry['id']}", reasons)

    def test_extreme_observed_timestamp_blocks_without_timezone_overflow(self):
        entry = BASE.evidence()
        entry["observed_at"] = "9999-12-31T23:59:59-23:59"
        decision, reasons = BASE.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            f"release_evidence:observed_at_invalid:{entry['id']}", reasons
        )

    def test_impact_map_cannot_reference_contract_missing_from_registry(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        impact = deepcopy(impact)
        impact["mappings"].append(
            {"contract": "FM-CONTRACT-ORPHAN", "gates": [BASE.GATE]}
        )
        decision, reasons = BASE.evaluate_case(
            BASE.evidence(),
            invariants=invariants,
            gates=gates,
            contracts=contracts,
            impact=impact,
            ttl=ttl,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("impact_map:unknown_contract:FM-CONTRACT-ORPHAN", reasons)


if __name__ == "__main__":
    unittest.main()

from copy import deepcopy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_round14_base", ROOT / "tests" / "test_fanmind_god_mode_review_round12.py"
)
BASE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BASE)

CORE = BASE.CORE
ROUND12 = BASE.ROUND12
PREFLIGHT = BASE.BASE.PREFLIGHT


class CurrentHeadRound14RegressionTests(unittest.TestCase):
    def test_imported_core_routes_to_latest_evaluator(self):
        self.assertIs(CORE.evaluate_release_decision, ROUND12.evaluate_release_decision)

    def test_malformed_impact_gate_collection_fails_runtime_and_preflight(self):
        invariants, gates, contracts, impact, ttl = BASE.BASE.structures()
        impact["mappings"][0]["gates"] = 1
        decision, reasons = BASE.BASE.evaluate_case(
            BASE.BASE.evidence(), invariants=invariants, gates=gates,
            contracts=contracts, impact=impact, ttl=ttl,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"impact_map:gates_invalid:{BASE.BASE.CONTRACT}", reasons)

        original = PREFLIGHT.load
        PREFLIGHT.load = lambda name: impact if name == "IMPACT_MAP.json" else deepcopy(original(name))
        try:
            errors = PREFLIGHT.validate()
        finally:
            PREFLIGHT.load = original
        self.assertTrue(any(error.startswith("impact-map-gates-invalid:") for error in errors), errors)

    def test_unknown_requirement_claims_fail_closed(self):
        _invariants, gates, _contracts, _impact, _ttl = BASE.BASE.structures()
        entry = BASE.BASE.evidence()
        entry["requirements"] = {BASE.BASE.GATE: ["invented"]}
        reasons = ROUND12._evidence_requirement_claim_blockers(
            BASE.BASE.signed_attestation(entry), gates
        )
        self.assertIn(f"release_evidence:requirement_unknown:{BASE.BASE.GATE}", reasons)

        entry["requirements"] = {"FM-IGATE-UNKNOWN": ["invented"]}
        reasons = ROUND12._evidence_requirement_claim_blockers(
            BASE.BASE.signed_attestation(entry), gates
        )
        self.assertIn("release_evidence:requirement_gate_unknown:FM-IGATE-UNKNOWN", reasons)

    def test_gate_contract_and_impact_semantics_are_pinned(self):
        invariants = PREFLIGHT.load("SYSTEM_INVARIANTS.json")
        gates = PREFLIGHT.load("INTEGRATION_GATES.json")
        contracts = PREFLIGHT.load("CONTRACT_REGISTRY.json")
        impact = PREFLIGHT.load("IMPACT_MAP.json")
        ttl = PREFLIGHT.load("EVIDENCE_TTL_POLICY.json")
        self.assertEqual([], ROUND12._canonical_semantics_blockers(invariants, gates, contracts, impact, ttl))
        weakened_gates = deepcopy(gates)
        weakened_impact = deepcopy(impact)
        weakened_gates["gates"][0]["contracts"], weakened_gates["gates"][1]["contracts"] = (
            weakened_gates["gates"][1]["contracts"], weakened_gates["gates"][0]["contracts"]
        )
        weakened_impact["mappings"][0]["gates"], weakened_impact["mappings"][1]["gates"] = (
            weakened_impact["mappings"][1]["gates"], weakened_impact["mappings"][0]["gates"]
        )
        self.assertIn("canonical_semantics:digest_mismatch", ROUND12._canonical_semantics_blockers(invariants, weakened_gates, contracts, weakened_impact, ttl))

    def test_ttl_policy_semantics_are_pinned(self):
        invariants = PREFLIGHT.load("SYSTEM_INVARIANTS.json")
        gates = PREFLIGHT.load("INTEGRATION_GATES.json")
        contracts = PREFLIGHT.load("CONTRACT_REGISTRY.json")
        impact = PREFLIGHT.load("IMPACT_MAP.json")
        ttl = PREFLIGHT.load("EVIDENCE_TTL_POLICY.json")
        weakened = deepcopy(ttl)
        for value in weakened["policy"].values():
            value["ttl_hours"] = None
            value["revalidate_on"] = ["head_changed"]
        self.assertIn("canonical_semantics:digest_mismatch", ROUND12._canonical_semantics_blockers(invariants, gates, contracts, impact, weakened))

    def test_cli_loads_all_six_head_documents_before_evaluation(self):
        original = ROUND12._load_head_project_memory
        ROUND12._load_head_project_memory = lambda name: (_ for _ in ()).throw(ValueError(name))
        try:
            self.assertEqual(1, ROUND12.main())
        finally:
            ROUND12._load_head_project_memory = original


if __name__ == "__main__":
    unittest.main()

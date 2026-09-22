from copy import deepcopy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_round8_base_tests",
    ROOT / "tests" / "test_fanmind_god_mode_review_hardening.py",
)
BASE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BASE)


class CurrentHeadRound8RegressionTests(unittest.TestCase):
    def test_malformed_contract_risk_blocks_runtime_and_preflight(self):
        _, _, contracts, _, _ = BASE.structures()
        contracts["contracts"][0]["minimum_risk"] = ["R4"]
        decision, reasons = BASE.evaluate_case(BASE.evidence(), contracts=contracts)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"contract:risk_floor_invalid:{BASE.CONTRACT}", reasons)

        original_load = BASE.PREFLIGHT.load
        canonical_contracts = deepcopy(original_load("CONTRACT_REGISTRY.json"))
        contract_id = canonical_contracts["contracts"][0]["id"]
        canonical_contracts["contracts"][0]["minimum_risk"] = {"value": "R4"}

        def load_with_bad_contract_risk(name):
            if name == "CONTRACT_REGISTRY.json":
                return deepcopy(canonical_contracts)
            return original_load(name)

        BASE.PREFLIGHT.load = load_with_bad_contract_risk
        try:
            errors = BASE.PREFLIGHT.validate()
        finally:
            BASE.PREFLIGHT.load = original_load

        self.assertIn(f"contract-registry-risk-invalid:{contract_id}", errors)

    def test_nonrequired_invariant_cannot_hide_malformed_risk_or_required_flag(self):
        invariants, _, _, _, _ = BASE.structures()
        invariants["invariants"][0]["required"] = False
        invariants["invariants"][0]["risk"] = ["R4"]
        decision, reasons = BASE.evaluate_case(BASE.evidence(), invariants=invariants)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"invariant:risk_invalid:{BASE.INVARIANT}", reasons)

        invariants, _, _, _, _ = BASE.structures()
        invariants["invariants"][0]["required"] = "false"
        decision, reasons = BASE.evaluate_case(BASE.evidence(), invariants=invariants)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"invariant:required_invalid:{BASE.INVARIANT}", reasons)

    def test_stale_second_class_does_not_satisfy_revalidated_r3_quorum(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        contracts["contracts"][0]["minimum_risk"] = "R3"
        ttl["policy"]["staging_smoke"] = {
            "ttl_hours": None,
            "revalidate_on": ["head_changed"],
        }

        def role_entry(evidence_id, role, sequence):
            entry = deepcopy(BASE.evidence())
            entry["id"] = evidence_id
            entry["roles"] = [role]
            entry["provenance"] = {
                "source": f"round8-source-{sequence}",
                "execution_id": f"round8-execution-{sequence}",
                "independence_key": f"round8-key-{sequence}",
            }
            return entry

        implementation = role_entry("EV-R8-IMPLEMENTATION", "implementation", 1)
        countercheck = role_entry("EV-R8-COUNTERCHECK", "countercheck", 2)
        negative = role_entry("EV-R8-NEGATIVE", "negative", 3)
        recovery = role_entry("EV-R8-RECOVERY", "recovery", 4)

        # This record is class-current (`head_changed` matches), gate-bound and
        # independently sourced, so the older global class-quorum logic counts
        # it.  Its contract-specific price trigger is stale, however, so it may
        # not supply the second evidence class after full revalidation.
        stale_second_class = role_entry("EV-R8-STALE-SECOND-CLASS", "countercheck", 5)
        stale_second_class["class"] = "staging_smoke"
        stale_second_class["trigger_fingerprints"]["price_catalog_change"] = "price:old"

        entries = [
            implementation,
            countercheck,
            negative,
            recovery,
            stale_second_class,
        ]
        snap = BASE.snapshot()
        snap["risk"] = "R3"
        snap["implementation_evidence_id"] = implementation["id"]
        snap["countercheck_evidence_id"] = countercheck["id"]
        snap["negative_evidence_id"] = negative["id"]
        snap["rollback_recovery_evidence_id"] = recovery["id"]

        decision, reasons = BASE.evaluate_case(
            entries,
            invariants=invariants,
            gates=gates,
            contracts=contracts,
            impact=impact,
            snapshot_value=snap,
            ttl=ttl,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:revalidated_quorum_classes:1<2", reasons)


if __name__ == "__main__":
    unittest.main()

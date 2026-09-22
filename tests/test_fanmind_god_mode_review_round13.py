from copy import deepcopy
import importlib.util
import os
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_round13_base",
    ROOT / "tests" / "test_fanmind_god_mode_review_round12.py",
)
BASE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BASE)

CORE = BASE.CORE
PREFLIGHT = BASE.BASE.PREFLIGHT


class CurrentHeadRound13RegressionTests(unittest.TestCase):
    def test_synthetic_test_mode_is_bound_to_exact_fixture_registries_not_target(self):
        previous = os.environ.get(CORE.TEST_ONLY_SYNTHETIC_ENV)
        os.environ[CORE.TEST_ONLY_SYNTHETIC_ENV] = "1"
        try:
            contracts = BASE.BASE.active_contracts()
            gates = BASE.BASE.verified_gates()
            for target in (
                "repository:synthetic",
                "repository:other",
                "repository:",
                "staging:synthetic",
                "production:synthetic",
            ):
                snapshot = BASE.BASE.clean_snapshot(target=target)
                self.assertFalse(
                    CORE._canonical_runtime_mode(gates, contracts, BASE.BASE.impact_map(), snapshot),
                    target,
                )

            canonical_contracts = PREFLIGHT.load("CONTRACT_REGISTRY.json")
            canonical_gates = PREFLIGHT.load("INTEGRATION_GATES.json")
            self.assertTrue(
                CORE._canonical_runtime_mode(
                    canonical_gates,
                    canonical_contracts,
                    PREFLIGHT.load("IMPACT_MAP.json"),
                    PREFLIGHT.load("RELEASE_DECISION.json"),
                )
            )
        finally:
            if previous is None:
                os.environ.pop(CORE.TEST_ONLY_SYNTHETIC_ENV, None)
            else:
                os.environ[CORE.TEST_ONLY_SYNTHETIC_ENV] = previous

    def test_contract_revalidation_semantics_are_independently_pinned(self):
        contracts = PREFLIGHT.load("CONTRACT_REGISTRY.json")
        self.assertEqual([], CORE._canonical_contract_semantics_blockers(contracts))

        weakened = deepcopy(contracts)
        for contract in weakened["contracts"]:
            contract["revalidate_on"] = ["head_changed"]
        self.assertIn(
            "canonical_semantics:contract_revalidation_mismatch",
            CORE._canonical_contract_semantics_blockers(weakened),
        )

    def test_direct_canonical_inputs_must_match_current_head_objects(self):
        invariants = PREFLIGHT.load("SYSTEM_INVARIANTS.json")
        integration = PREFLIGHT.load("INTEGRATION_GATES.json")
        contracts = PREFLIGHT.load("CONTRACT_REGISTRY.json")
        impact = PREFLIGHT.load("IMPACT_MAP.json")
        snapshot = PREFLIGHT.load("RELEASE_DECISION.json")
        ttl = PREFLIGHT.load("EVIDENCE_TTL_POLICY.json")
        fingerprint = CORE._base.control_plane_fingerprint()
        self.assertIsNotNone(fingerprint)
        self.assertEqual(
            [],
            CORE._canonical_head_input_blockers(
                invariants,
                integration,
                contracts,
                impact,
                snapshot,
                ttl,
                fingerprint,
            ),
        )

        replayed = deepcopy(contracts)
        replayed["contracts"][0]["minimum_risk"] = "R1"
        reasons = CORE._canonical_head_input_blockers(
            invariants,
            integration,
            replayed,
            impact,
            snapshot,
            ttl,
            fingerprint,
        )
        self.assertIn(
            "canonical_control_plane:document_mismatch:CONTRACT_REGISTRY.json",
            reasons,
        )

        reasons = CORE._canonical_head_input_blockers(
            invariants,
            integration,
            contracts,
            impact,
            snapshot,
            ttl,
            "0" * 64,
        )
        self.assertIn("canonical_control_plane:fingerprint_mismatch", reasons)

    def test_malformed_gate_contract_collection_fails_before_legacy_set(self):
        original_load = PREFLIGHT.load

        def malformed(name):
            value = deepcopy(original_load(name))
            if name == "INTEGRATION_GATES.json":
                value["gates"][0]["contracts"] = 1
            return value

        PREFLIGHT.load = malformed
        try:
            errors = PREFLIGHT.validate()
        finally:
            PREFLIGHT.load = original_load
        self.assertTrue(
            any(error.startswith("integration-gate-contracts-invalid:") for error in errors),
            errors,
        )


if __name__ == "__main__":
    unittest.main()

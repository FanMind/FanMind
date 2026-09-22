from copy import deepcopy
import importlib.util
import pathlib
import subprocess
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_round9_base_tests",
    ROOT / "tests" / "test_fanmind_god_mode_review_hardening.py",
)
BASE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BASE)


class CurrentHeadRound9RegressionTests(unittest.TestCase):
    def test_role_padded_implementation_acceptance_fails_closed(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        contracts["contracts"][0]["minimum_risk"] = "R3"
        for invariant in invariants["invariants"]:
            invariant["risk"] = "R3"

        padded = deepcopy(BASE.evidence())
        padded["status"] = "ACCEPTED"
        padded["roles"] = ["implementation", "evidence"]
        snap = BASE.snapshot()
        snap["risk"] = "R3"
        snap["implementation_evidence_id"] = padded["id"]

        decision, reasons = BASE.evaluate_case(
            padded,
            invariants=invariants,
            gates=gates,
            contracts=contracts,
            impact=impact,
            snapshot_value=snap,
            ttl=ttl,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            f"release_evidence:implementation_only_acceptance:{padded['id']}:ACCEPTED",
            reasons,
        )

    def test_trigger_state_schema_version_requires_exact_integer(self):
        original = BASE.signed_trigger_state

        def malformed(state=None):
            value = original(state)
            value["schema_version"] = True
            value["signature"] = BASE.MODULE.sign_attestation(value, BASE.KEY)
            return value

        BASE.signed_trigger_state = malformed
        try:
            decision, reasons = BASE.evaluate_case(BASE.evidence())
        finally:
            BASE.signed_trigger_state = original

        self.assertEqual("BLOCK", decision)
        self.assertIn("trigger_state:schema_invalid", reasons)

    def test_missing_contract_revalidation_metadata_fails_closed_at_runtime(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        del contracts["contracts"][0]["revalidate_on"]

        decision, reasons = BASE.evaluate_case(
            BASE.evidence(),
            invariants=invariants,
            gates=gates,
            contracts=contracts,
            impact=impact,
            ttl=ttl,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            f"contract:revalidation_invalid:{BASE.CONTRACT}",
            reasons,
        )

    def test_legacy_preflight_cli_is_fail_closed(self):
        completed = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "fanmind_god_mode_preflight_legacy.py"),
                "--check",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(0, completed.returncode)
        self.assertIn("FANMIND_GOD_MODE_PREFLIGHT=failed", completed.stdout)
        self.assertIn(
            "legacy_preflight_cli_disabled_use_canonical_entrypoint",
            completed.stdout,
        )


if __name__ == "__main__":
    unittest.main()

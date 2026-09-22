from copy import deepcopy
import importlib.util
import pathlib
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_round15_base", ROOT / "tests" / "test_fanmind_god_mode_review_round12.py"
)
BASE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BASE)

ROUND12 = BASE.ROUND12
FIX = BASE.BASE
PREFLIGHT = FIX.PREFLIGHT


class CurrentHeadRound15RegressionTests(unittest.TestCase):
    def test_cli_rejects_resolvable_release_sha_that_is_not_checked_out_head(self):
        original_head = ROUND12._base.current_git_head
        original_resolves = ROUND12._current._round8.git_commit_resolves
        ROUND12._base.current_git_head = lambda: "b" * 40
        ROUND12._current._round8.git_commit_resolves = lambda _value: True
        try:
            decision, reasons = ROUND12._exact_head_cli_evaluate_release_decision(
                actual_head=FIX.HEAD
            )
        finally:
            ROUND12._current._round8.git_commit_resolves = original_resolves
            ROUND12._base.current_git_head = original_head
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:actual_head_not_checked_out_head", reasons)

    def test_unhashable_evidence_status_fails_closed_before_legacy_membership(self):
        entry = FIX.evidence()
        entry["status"] = []
        decision, reasons = FIX.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"release_evidence:status_invalid:{entry['id']}", reasons)

    def test_unknown_authenticated_evidence_role_fails_closed(self):
        entry = FIX.evidence()
        entry["roles"] = ["evidence", "invented-authority"]
        decision, reasons = FIX.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            f"release_evidence:role_unknown:{entry['id']}:invented-authority",
            reasons,
        )

    def test_attested_evidence_id_set_must_equal_snapshot_binding_set(self):
        invariants, gates, contracts, impact, ttl = FIX.structures()
        entry = FIX.evidence()
        extra = deepcopy(entry)
        extra["id"] = "EV-UNBOUND-CONTRADICTORY"
        extra["status"] = "BLOCKED"
        attestation = FIX.signed_attestation([entry, extra])
        decision, reasons = ROUND12.evaluate_release_decision(
            invariants,
            gates,
            contracts,
            impact,
            {},
            FIX.snapshot(),
            ttl,
            actual_head=FIX.HEAD,
            actual_target=FIX.TARGET,
            current_control_plane_fingerprint=FIX.CONTROL,
            now=FIX.NOW,
            attestation=attestation,
            attestation_key=FIX.KEY,
            current_trigger_state=FIX.signed_trigger_state(),
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("attestation:evidence_binding_set_mismatch", reasons)

    def test_invalid_utf8_external_signed_json_becomes_load_error(self):
        with tempfile.TemporaryDirectory() as directory:
            path = pathlib.Path(directory) / "attestation.json"
            path.write_bytes(b"\xff\xfe\xfa")
            self.assertEqual({"_load_error": True}, ROUND12._safe_external_json(str(path)))

    def test_preflight_rejects_unhashable_nested_registry_ids_before_set_use(self):
        original = PREFLIGHT.load
        cases = (
            ("SYSTEM_INVARIANTS.json", "invariants", "system-invariant-id-invalid"),
            ("CONTRACT_REGISTRY.json", "contracts", "contract-id-invalid"),
            ("INTEGRATION_GATES.json", "gates", "integration-gate-id-invalid"),
        )
        for filename, key, marker in cases:
            with self.subTest(filename=filename):
                def loader(name, filename=filename, key=key):
                    document = deepcopy(original(name))
                    if name == filename:
                        document[key][0]["id"] = []
                    return document

                PREFLIGHT.load = loader
                try:
                    errors = PREFLIGHT.validate()
                finally:
                    PREFLIGHT.load = original
                self.assertIn(marker, errors)

    def test_preflight_rejects_duplicate_nested_registry_ids(self):
        original = PREFLIGHT.load

        def loader(name):
            document = deepcopy(original(name))
            if name == "CONTRACT_REGISTRY.json":
                duplicate = deepcopy(document["contracts"][0])
                document["contracts"].append(duplicate)
            return document

        PREFLIGHT.load = loader
        try:
            errors = PREFLIGHT.validate()
        finally:
            PREFLIGHT.load = original
        self.assertTrue(
            any(error.startswith("contract-id-duplicate:") for error in errors),
            errors,
        )


if __name__ == "__main__":
    unittest.main()

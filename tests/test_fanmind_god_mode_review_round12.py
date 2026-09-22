from copy import deepcopy
import importlib.util
import pathlib
import subprocess
import sys
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

    def test_standalone_round11_cli_is_disabled_fail_closed(self):
        proc = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "fanmind_release_decision_core_round11.py"),
                "--check",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(0, proc.returncode)
        self.assertIn("FANMIND_RELEASE_DECISION=BLOCK", proc.stdout)
        self.assertIn("round11_cli_disabled_use_round12", proc.stdout)

    def test_duplicate_gate_boundaries_fail_closed_instead_of_set_normalization(self):
        entry = BASE.evidence()
        entry["gates"] = [BASE.GATE, BASE.GATE]
        decision, reasons = BASE.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"release_evidence:gates_duplicate:{entry['id']}", reasons)

    def test_duplicate_impact_mapping_gate_ids_fail_closed_at_runtime(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        impact = deepcopy(impact)
        impact["mappings"][0]["gates"] = [BASE.GATE, BASE.GATE]
        decision, reasons = BASE.evaluate_case(
            BASE.evidence(),
            invariants=invariants,
            gates=gates,
            contracts=contracts,
            impact=impact,
            ttl=ttl,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"impact_map:duplicate_gate:{BASE.CONTRACT}", reasons)

    def test_duplicate_impact_mapping_gate_ids_fail_structural_preflight(self):
        original_load = BASE.PREFLIGHT.load

        def load_with_duplicate_gate(name):
            document = deepcopy(original_load(name))
            if name == "IMPACT_MAP.json":
                first = document["mappings"][0]
                gate_id = first["gates"][0]
                first["gates"] = [gate_id, gate_id]
            return document

        BASE.PREFLIGHT.load = load_with_duplicate_gate
        try:
            errors = BASE.PREFLIGHT.validate()
        finally:
            BASE.PREFLIGHT.load = original_load
        self.assertTrue(
            any(error.startswith("impact-map-gates-duplicate:") for error in errors),
            errors,
        )

    def test_non_object_release_snapshot_blocks_before_get_dereference(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        entry = BASE.evidence()
        decision, reasons = BASE.MODULE.evaluate_release_decision(
            invariants,
            gates,
            contracts,
            impact,
            {},
            [],
            ttl,
            actual_head=BASE.HEAD,
            actual_target=BASE.TARGET,
            current_control_plane_fingerprint=BASE.CONTROL,
            now=BASE.NOW,
            attestation=BASE.signed_attestation(entry),
            attestation_key=BASE.KEY,
            current_trigger_state=BASE.signed_trigger_state(),
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:snapshot_invalid", reasons)

    def test_persisted_completeness_flags_are_exact_true_or_block(self):
        snap = BASE.snapshot()
        snap["decision"] = "ALLOW"
        for key in BASE.MODULE.REQUIRED_COMPLETENESS_FLAGS:
            snap[key] = True

        self.assertEqual(
            ("ALLOW", []),
            BASE.evaluate_case(BASE.evidence(), snapshot_value=snap),
        )

        for key in BASE.MODULE.REQUIRED_COMPLETENESS_FLAGS:
            with self.subTest(flag=key, mode="false"):
                bad = deepcopy(snap)
                bad[key] = False
                decision, reasons = BASE.evaluate_case(
                    BASE.evidence(), snapshot_value=bad
                )
                self.assertEqual("BLOCK", decision)
                self.assertIn(f"release_input:{key}", reasons)

            with self.subTest(flag=key, mode="omitted"):
                bad = deepcopy(snap)
                bad.pop(key)
                decision, reasons = BASE.evaluate_case(
                    BASE.evidence(), snapshot_value=bad
                )
                self.assertEqual("BLOCK", decision)
                self.assertIn(f"release_input:{key}", reasons)

    def test_persisted_completeness_flags_are_validated_by_preflight(self):
        original_load = BASE.PREFLIGHT.load
        canonical = deepcopy(original_load("RELEASE_DECISION.json"))
        canonical["decision"] = "OWNER_REQUIRED"
        for key in BASE.PREFLIGHT.REQUIRED_COMPLETENESS_FLAGS:
            canonical[key] = True
        canonical["evidence_quorum_complete"] = False

        def load_with_incomplete_release(name):
            if name == "RELEASE_DECISION.json":
                return deepcopy(canonical)
            return deepcopy(original_load(name))

        BASE.PREFLIGHT.load = load_with_incomplete_release
        try:
            errors = BASE.PREFLIGHT.validate()
        finally:
            BASE.PREFLIGHT.load = original_load
        self.assertIn(
            "release-decision-evidence_quorum_complete-required",
            errors,
        )

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

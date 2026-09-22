from copy import deepcopy
import importlib.util
import os
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
        self.assertIn(
            f"release_evidence:not_current:{entry['id']}:invalid_status_type",
            reasons,
        )

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


    def test_public_evaluator_rejects_non_checkout_head_outside_synthetic_test_bypass(self):
        original_head = ROUND12._base.current_git_head
        original_resolves = ROUND12._current._round8.git_commit_resolves
        original_mode = ROUND12._current._canonical_runtime_mode
        original_eval = ROUND12._legacy_evaluate_release_decision
        previous = os.environ.pop("FANMIND_GOD_MODE_TEST_ONLY_SYNTHETIC", None)
        ROUND12._base.current_git_head = lambda: "b" * 40
        ROUND12._current._round8.git_commit_resolves = lambda _value: True
        ROUND12._current._canonical_runtime_mode = lambda *_args, **_kwargs: False
        ROUND12._legacy_evaluate_release_decision = lambda *_args, **_kwargs: ("ALLOW", [])
        try:
            invariants, gates, contracts, impact, ttl = FIX.structures()
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
                attestation=FIX.signed_attestation(FIX.evidence()),
                attestation_key=FIX.KEY,
                current_trigger_state=FIX.signed_trigger_state(),
            )
        finally:
            if previous is not None:
                os.environ["FANMIND_GOD_MODE_TEST_ONLY_SYNTHETIC"] = previous
            ROUND12._legacy_evaluate_release_decision = original_eval
            ROUND12._current._canonical_runtime_mode = original_mode
            ROUND12._current._round8.git_commit_resolves = original_resolves
            ROUND12._base.current_git_head = original_head
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:actual_head_not_checked_out_head", reasons)

    def test_canonical_invariant_meaning_is_pinned(self):
        invariants = PREFLIGHT.load("SYSTEM_INVARIANTS.json")
        gates = PREFLIGHT.load("INTEGRATION_GATES.json")
        contracts = PREFLIGHT.load("CONTRACT_REGISTRY.json")
        impact = PREFLIGHT.load("IMPACT_MAP.json")
        ttl = PREFLIGHT.load("EVIDENCE_TTL_POLICY.json")
        weakened = deepcopy(invariants)
        weakened["invariants"][0]["description"] = "always true"
        reasons = ROUND12._canonical_semantics_blockers(
            weakened, gates, contracts, impact, ttl
        )
        self.assertIn(
            "canonical_semantics:invariant_meaning_mismatch:FM-INV-001",
            reasons,
        )

    def test_preflight_rejects_unhashable_enum_shapes(self):
        original = PREFLIGHT.load

        def loader(name):
            document = deepcopy(original(name))
            if name == "SYSTEM_INVARIANTS.json":
                document["invariants"][0]["status"] = []
            if name == "RELEASE_DECISION.json":
                document["decision"] = {}
            return document

        PREFLIGHT.load = loader
        try:
            errors = PREFLIGHT.validate()
        finally:
            PREFLIGHT.load = original
        self.assertIn("system-invariant-status-invalid:FM-INV-001", errors)
        self.assertIn("release-decision-decision-invalid", errors)

    def test_blank_provenance_cannot_form_independent_quorum(self):
        entry = FIX.evidence()
        entry["provenance"] = {
            "source": " ",
            "execution_id": "  ",
            "independence_key": "   ",
        }
        decision, _reasons = FIX.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)

    def test_blank_or_padded_evidence_identity_is_rejected(self):
        entry = FIX.evidence()
        entry["id"] = " EV-HARDENING"
        decision, reasons = FIX.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:id_invalid", reasons)

    def test_cli_head_guard_includes_evidence_freshness_document(self):
        original = ROUND12._load_head_project_memory

        def loader(name):
            if name == "EVIDENCE_FRESHNESS.json":
                raise ValueError("freshness malformed")
            return original(name)

        ROUND12._load_head_project_memory = loader
        try:
            self.assertEqual(1, ROUND12.main())
        finally:
            ROUND12._load_head_project_memory = original

    def test_signed_document_canonicalization_errors_fail_closed(self):
        attestation = FIX.signed_attestation(FIX.evidence())
        attestation["issuer"] = "\udcff"
        attestation["signature"] = "hmac-sha256:" + ("0" * 64)
        _evidence, _trigger, blockers = ROUND12._base._authenticate_attestation(
            attestation,
            FIX.KEY,
            FIX.HEAD,
            FIX.TARGET,
            FIX.CONTROL,
            FIX.NOW,
        )
        self.assertIn("attestation:canonicalization_invalid", blockers)

        trigger = FIX.signed_trigger_state()
        trigger["issuer"] = "\udcff"
        trigger["signature"] = "hmac-sha256:" + ("0" * 64)
        _state, trigger_blockers = ROUND12._base._authenticate_current_trigger_state(
            trigger,
            FIX.KEY,
            FIX.NOW,
        )
        self.assertIn("trigger_state:canonicalization_invalid", trigger_blockers)


    def test_owner_required_also_requires_checked_out_head(self):
        original_head = ROUND12._base.current_git_head
        original_resolves = ROUND12._current._round8.git_commit_resolves
        original_mode = ROUND12._current._canonical_runtime_mode
        original_eval = ROUND12._legacy_evaluate_release_decision
        previous = os.environ.pop("FANMIND_GOD_MODE_TEST_ONLY_SYNTHETIC", None)
        ROUND12._base.current_git_head = lambda: "b" * 40
        ROUND12._current._round8.git_commit_resolves = lambda _value: True
        ROUND12._current._canonical_runtime_mode = lambda *_args, **_kwargs: False
        ROUND12._legacy_evaluate_release_decision = lambda *_args, **_kwargs: ("OWNER_REQUIRED", [])
        try:
            invariants, gates, contracts, impact, ttl = FIX.structures()
            decision, reasons = ROUND12.evaluate_release_decision(
                invariants, gates, contracts, impact, {}, FIX.snapshot(), ttl,
                actual_head=FIX.HEAD,
                actual_target=FIX.TARGET,
                current_control_plane_fingerprint=FIX.CONTROL,
                now=FIX.NOW,
                attestation=FIX.signed_attestation(FIX.evidence()),
                attestation_key=FIX.KEY,
                current_trigger_state=FIX.signed_trigger_state(),
            )
        finally:
            if previous is not None:
                os.environ["FANMIND_GOD_MODE_TEST_ONLY_SYNTHETIC"] = previous
            ROUND12._legacy_evaluate_release_decision = original_eval
            ROUND12._current._canonical_runtime_mode = original_mode
            ROUND12._current._round8.git_commit_resolves = original_resolves
            ROUND12._base.current_git_head = original_head
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:actual_head_not_checked_out_head", reasons)

    def test_malformed_gate_requirement_members_fail_closed_before_set(self):
        _invariants, gates, _contracts, _impact, _ttl = FIX.structures()
        gates["gates"][0]["evidence_required"] = [[]]
        blockers = ROUND12._evidence_requirement_claim_blockers(
            FIX.signed_attestation(FIX.evidence()), gates
        )
        self.assertIn(
            f"release_evidence:configured_requirements_invalid:{FIX.GATE}",
            blockers,
        )

    def test_preflight_rejects_nonlist_golden_flow_registry(self):
        original = PREFLIGHT.load
        for malformed in (False, None, 1):
            with self.subTest(value=malformed):
                def loader(name, malformed=malformed):
                    document = deepcopy(original(name))
                    if name == "INTEGRATION_GATES.json":
                        document["synthetic_golden_flows"] = malformed
                    return document
                PREFLIGHT.load = loader
                try:
                    errors = PREFLIGHT.validate()
                finally:
                    PREFLIGHT.load = original
                self.assertIn("golden-flow-registry-invalid", errors)

    def test_canonical_impact_consumers_and_tests_are_pinned(self):
        invariants = PREFLIGHT.load("SYSTEM_INVARIANTS.json")
        gates = PREFLIGHT.load("INTEGRATION_GATES.json")
        contracts = PREFLIGHT.load("CONTRACT_REGISTRY.json")
        impact = PREFLIGHT.load("IMPACT_MAP.json")
        ttl = PREFLIGHT.load("EVIDENCE_TTL_POLICY.json")
        weakened = deepcopy(impact)
        weakened["mappings"][0]["consumers"] = ["noop"]
        weakened["mappings"][0]["tests"] = ["noop"]
        reasons = ROUND12._canonical_semantics_blockers(
            invariants, gates, contracts, weakened, ttl
        )
        self.assertIn(
            "canonical_semantics:impact_scope_mismatch:FM-CONTRACT-CREATOR-AI-001",
            reasons,
        )

    def test_trust_anchor_loader_uses_immutable_head_document(self):
        original_head_loader = ROUND12._load_head_project_memory
        original_mutable_loader = ROUND12._base.load
        head_anchor = {
            "schema_version": 1,
            "algorithm": "HMAC-SHA256",
            "status": "UNPROVISIONED",
            "key_sha256": None,
        }
        ROUND12._load_head_project_memory = (
            lambda name: deepcopy(head_anchor)
            if name == "GOD_MODE_TRUST_ANCHOR.json"
            else original_head_loader(name)
        )
        ROUND12._base.load = lambda _name: {
            "schema_version": 1,
            "algorithm": "HMAC-SHA256",
            "status": "ACTIVE",
            "key_sha256": "0" * 64,
        }
        try:
            self.assertEqual(head_anchor, ROUND12.load_trust_anchor())
        finally:
            ROUND12._base.load = original_mutable_loader
            ROUND12._load_head_project_memory = original_head_loader


if __name__ == "__main__":
    unittest.main()

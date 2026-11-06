from copy import deepcopy
import hashlib
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_round10_base_tests",
    ROOT / "tests" / "test_fanmind_god_mode_review_hardening.py",
)
BASE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BASE)

TASK = "FM-GOV-GODMODE-001"


def _role_entry(evidence_id, role, sequence, *, evidence_class="ci_exact_head"):
    entry = deepcopy(BASE.evidence())
    entry["id"] = evidence_id
    entry["roles"] = [role] if isinstance(role, str) else list(role)
    entry["class"] = evidence_class
    entry["provenance"] = {
        "source": f"round10-source-{sequence}",
        "execution_id": f"round10-execution-{sequence}",
        "independence_key": f"round10-key-{sequence}",
    }
    return entry


class CurrentHeadRound10RegressionTests(unittest.TestCase):
    def test_current_trigger_state_is_bound_to_exact_release_context(self):
        invariants = BASE.MODULE.load("SYSTEM_INVARIANTS.json")
        gates = BASE.MODULE.load("INTEGRATION_GATES.json")
        contracts = BASE.MODULE.load("CONTRACT_REGISTRY.json")
        impact = BASE.MODULE.load("IMPACT_MAP.json")
        ttl = BASE.MODULE.load("EVIDENCE_TTL_POLICY.json")
        snapshot = BASE.MODULE.load("RELEASE_DECISION.json")

        trigger_state = {
            "schema_version": 1,
            "issuer": BASE.MODULE.TRIGGER_STATE_ISSUER,
            "release_sha": "b" * 40,
            "target": "staging:other",
            "control_plane_fingerprint": "d" * 64,
            "issued_at": "2026-09-21T21:59:00Z",
            "expires_at": "2026-09-21T22:04:00Z",
            "state": {},
            "signature": "hmac-sha256:" + "0" * 64,
        }
        decision, reasons = BASE.MODULE.evaluate_release_decision(
            invariants,
            gates,
            contracts,
            impact,
            {},
            snapshot,
            ttl,
            actual_head=BASE.HEAD,
            actual_target="staging:fanmind",
            current_control_plane_fingerprint=BASE.CONTROL,
            now=BASE.NOW,
            attestation=None,
            attestation_key=None,
            current_trigger_state=trigger_state,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("trigger_state:release_sha_mismatch", reasons)
        self.assertIn("trigger_state:target_mismatch", reasons)
        self.assertIn("trigger_state:control_plane_mismatch", reasons)

    def test_canonical_contract_and_gate_sets_cannot_be_truncated_together(self):
        invariants = BASE.MODULE.load("SYSTEM_INVARIANTS.json")
        gates = deepcopy(BASE.MODULE.load("INTEGRATION_GATES.json"))
        contracts = deepcopy(BASE.MODULE.load("CONTRACT_REGISTRY.json"))
        impact = deepcopy(BASE.MODULE.load("IMPACT_MAP.json"))
        ttl = BASE.MODULE.load("EVIDENCE_TTL_POLICY.json")
        snapshot = BASE.MODULE.load("RELEASE_DECISION.json")

        removed_contract = contracts["contracts"].pop()["id"]
        removed_gate = gates["gates"].pop()["id"]
        impact["mappings"] = [
            item for item in impact.get("mappings", [])
            if item.get("contract") != removed_contract and removed_gate not in item.get("gates", [])
        ]

        decision, reasons = BASE.MODULE.evaluate_release_decision(
            invariants,
            gates,
            contracts,
            impact,
            {},
            snapshot,
            ttl,
            actual_head=BASE.HEAD,
            actual_target=BASE.TARGET,
            current_control_plane_fingerprint=BASE.CONTROL,
            now=BASE.NOW,
            attestation=None,
            attestation_key=None,
            current_trigger_state=None,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("contract_registry:canonical_set_mismatch", reasons)
        self.assertIn("integration_gate:canonical_set_mismatch", reasons)

    def test_empty_target_namespace_fails_closed(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        snapshot = BASE.snapshot()
        snapshot["evaluated_target"] = "repository:"
        decision, reasons = BASE.MODULE.evaluate_release_decision(
            invariants,
            gates,
            contracts,
            impact,
            {},
            snapshot,
            ttl,
            actual_head=BASE.HEAD,
            actual_target="repository:",
            current_control_plane_fingerprint=BASE.CONTROL,
            now=BASE.NOW,
            attestation=None,
            attestation_key=None,
            current_trigger_state=None,
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_input:target_identifier_invalid", reasons)

    def test_gate_bound_but_semantically_empty_second_class_does_not_count(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        contracts["contracts"][0]["minimum_risk"] = "R3"
        for invariant in invariants["invariants"]:
            invariant["risk"] = "R3"
        gates["gates"][0]["evidence_required_roles"] = {
            requirement: "negative" for requirement in gates["gates"][0]["evidence_required"]
        }
        ttl["policy"]["staging_smoke"] = {
            "ttl_hours": None,
            "revalidate_on": ["head_changed"],
        }

        implementation = _role_entry("EV-R10-IMPL", "implementation", 1)
        countercheck = _role_entry("EV-R10-COUNTER", "countercheck", 2)
        negative = _role_entry("EV-R10-NEG", "negative", 3)
        recovery = _role_entry("EV-R10-RECOVERY", "recovery", 4)
        empty_second_class = _role_entry(
            "EV-R10-EMPTY-SECOND", "negative", 5, evidence_class="staging_smoke"
        )
        empty_second_class["requirements"] = {}

        entries = [implementation, countercheck, negative, recovery, empty_second_class]
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

    def test_countercheck_semantic_claim_must_be_on_independent_countercheck(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        contracts["contracts"][0]["minimum_risk"] = "R3"
        for invariant in invariants["invariants"]:
            invariant["risk"] = "R3"
        requirements = list(gates["gates"][0]["evidence_required"])
        gates["gates"][0]["evidence_required_roles"] = {
            requirements[0]: "countercheck",
            requirements[1]: "negative",
        }
        ttl["policy"]["staging_smoke"] = {
            "ttl_hours": None,
            "revalidate_on": ["head_changed"],
        }

        mixed = _role_entry("EV-R10-MIXED", ["implementation", "countercheck"], 11)
        mixed["requirements"] = {BASE.GATE: [requirements[0]]}
        independent_counter = _role_entry(
            "EV-R10-INDEPENDENT-COUNTER", "countercheck", 12, evidence_class="staging_smoke"
        )
        independent_counter["requirements"] = {}
        negative = _role_entry("EV-R10-NEGATIVE", "negative", 13)
        negative["requirements"] = {BASE.GATE: [requirements[1]]}
        recovery = _role_entry(
            "EV-R10-RECOVERY", "recovery", 14, evidence_class="staging_smoke"
        )
        recovery["requirements"] = {}

        entries = [mixed, independent_counter, negative, recovery]
        snap = BASE.snapshot()
        snap["risk"] = "R3"
        snap["implementation_evidence_id"] = mixed["id"]
        snap["countercheck_evidence_id"] = independent_counter["id"]
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
        self.assertIn(
            f"release_evidence:gate_countercheck_requirement_not_independent:{BASE.GATE}:{requirements[0]}",
            reasons,
        )

    def test_malformed_role_array_is_not_normalized_into_valid_evidence(self):
        entry = BASE.evidence()
        entry["roles"] = ["evidence", {"bad": "role"}]
        decision, reasons = BASE.evaluate_case(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"release_evidence:roles_invalid:{entry['id']}", reasons)

    def test_canonical_key_verification_is_pinned_to_independent_anchor(self):
        invariants = BASE.MODULE.load("SYSTEM_INVARIANTS.json")
        gates = BASE.MODULE.load("INTEGRATION_GATES.json")
        contracts = BASE.MODULE.load("CONTRACT_REGISTRY.json")
        impact = BASE.MODULE.load("IMPACT_MAP.json")
        ttl = BASE.MODULE.load("EVIDENCE_TTL_POLICY.json")
        snapshot = BASE.MODULE.load("RELEASE_DECISION.json")

        trusted_key = "trusted-protected-producer-key-0000000000000000"
        attacker_key = "attacker-selected-producer-key-000000000000000"
        globals_map = BASE.MODULE.evaluate_release_decision.__globals__
        original_loader = globals_map["load_trust_anchor"]
        globals_map["load_trust_anchor"] = lambda: {
            "schema_version": 1,
            "algorithm": "HMAC-SHA256",
            "status": "ACTIVE",
            "key_sha256": hashlib.sha256(trusted_key.encode("utf-8")).hexdigest(),
        }
        try:
            decision, reasons = BASE.MODULE.evaluate_release_decision(
                invariants,
                gates,
                contracts,
                impact,
                {},
                snapshot,
                ttl,
                actual_head=BASE.HEAD,
                actual_target=BASE.TARGET,
                current_control_plane_fingerprint=BASE.CONTROL,
                now=BASE.NOW,
                attestation={"evidence": []},
                attestation_key=attacker_key,
                current_trigger_state=None,
            )
        finally:
            globals_map["load_trust_anchor"] = original_loader

        self.assertEqual("BLOCK", decision)
        self.assertIn("trust_anchor:key_identity_mismatch", reasons)


if __name__ == "__main__":
    unittest.main()

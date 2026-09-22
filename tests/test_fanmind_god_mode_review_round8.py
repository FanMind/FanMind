from copy import deepcopy
import importlib.util
import pathlib
import subprocess
import sys
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
        # it. Its contract-specific price trigger is stale, however, so it may
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

    def test_unbound_selected_second_class_does_not_satisfy_r3_quorum(self):
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
                "source": f"round8-unbound-source-{sequence}",
                "execution_id": f"round8-unbound-execution-{sequence}",
                "independence_key": f"round8-unbound-key-{sequence}",
            }
            return entry

        implementation = role_entry("EV-R8-U-IMPLEMENTATION", "implementation", 1)
        countercheck = role_entry("EV-R8-U-COUNTERCHECK", "countercheck", 2)
        negative = role_entry("EV-R8-U-NEGATIVE", "negative", 3)
        gate_recovery = role_entry("EV-R8-U-GATE-RECOVERY", "recovery", 4)
        unbound_selected_recovery = role_entry("EV-R8-U-SELECTED-RECOVERY", "recovery", 5)
        unbound_selected_recovery["class"] = "staging_smoke"
        unbound_selected_recovery.pop("gates", None)
        unbound_selected_recovery.pop("invariants", None)
        unbound_selected_recovery.pop("requirements", None)
        # Deliberately stale for the affected contract. Because this evidence
        # is unbound to any affected gate/invariant, the old round-8 loop never
        # evaluated that contract fingerprint and counted its class solely from
        # the global selected recovery field.
        unbound_selected_recovery["trigger_fingerprints"]["price_catalog_change"] = "price:old"

        entries = [
            implementation,
            countercheck,
            negative,
            gate_recovery,
            unbound_selected_recovery,
        ]
        snap = BASE.snapshot()
        snap["risk"] = "R3"
        snap["implementation_evidence_id"] = implementation["id"]
        snap["countercheck_evidence_id"] = countercheck["id"]
        snap["negative_evidence_id"] = negative["id"]
        snap["rollback_recovery_evidence_id"] = unbound_selected_recovery["id"]

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

    def test_invariant_observer_cannot_supply_second_revalidated_class(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        contracts["contracts"][0]["minimum_risk"] = "R3"
        invariants["invariants"][0]["risk"] = "R3"
        ttl["policy"]["staging_smoke"] = {
            "ttl_hours": None,
            "revalidate_on": ["head_changed"],
        }

        def role_entry(evidence_id, role, sequence):
            entry = deepcopy(BASE.evidence())
            entry["id"] = evidence_id
            entry["roles"] = [role]
            entry["provenance"] = {
                "source": f"round8-observer-source-{sequence}",
                "execution_id": f"round8-observer-execution-{sequence}",
                "independence_key": f"round8-observer-key-{sequence}",
            }
            return entry

        implementation = role_entry("EV-R8-O-IMPLEMENTATION", "implementation", 1)
        countercheck = role_entry("EV-R8-O-COUNTERCHECK", "countercheck", 2)
        negative = role_entry("EV-R8-O-NEGATIVE", "negative", 3)
        gate_recovery = role_entry("EV-R8-O-GATE-RECOVERY", "recovery", 4)

        # Class B is split across two records: the globally selected recovery is
        # unbound to the affected system boundary, while the invariant-bound
        # record is only an observer. Neither record is both bound and carrying
        # a qualifying R3 release role, so class B must not count.
        unbound_recovery = role_entry("EV-R8-O-UNBOUND-RECOVERY", "recovery", 5)
        unbound_recovery["class"] = "staging_smoke"
        unbound_recovery.pop("gates", None)
        unbound_recovery.pop("invariants", None)
        unbound_recovery.pop("requirements", None)

        observer = role_entry("EV-R8-O-INVARIANT-OBSERVER", "observer", 6)
        observer["class"] = "staging_smoke"
        observer.pop("gates", None)
        observer.pop("requirements", None)

        entries = [
            implementation,
            countercheck,
            negative,
            gate_recovery,
            unbound_recovery,
            observer,
        ]
        snap = BASE.snapshot()
        snap["risk"] = "R3"
        snap["implementation_evidence_id"] = implementation["id"]
        snap["countercheck_evidence_id"] = countercheck["id"]
        snap["negative_evidence_id"] = negative["id"]
        snap["rollback_recovery_evidence_id"] = unbound_recovery["id"]

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

    def test_invariant_observer_cannot_substitute_for_qualifying_release_role(self):
        qualifying = deepcopy(BASE.evidence())
        qualifying.pop("invariants", None)

        observer = deepcopy(BASE.evidence())
        observer["id"] = "EV-R8-INVARIANT-OBSERVER"
        observer["roles"] = ["observer"]
        observer.pop("gates", None)
        observer.pop("requirements", None)
        observer["provenance"] = {
            "source": "round8-invariant-observer",
            "execution_id": "round8-invariant-observer-1",
            "independence_key": "round8-invariant-observer-key-1",
        }

        decision, reasons = BASE.evaluate_case([qualifying, observer])
        self.assertEqual("BLOCK", decision)
        self.assertIn(f"release_evidence:invariant_missing:{BASE.INVARIANT}", reasons)

    def test_nonfinite_ttl_fails_closed_in_runtime_and_preflight(self):
        _, _, _, _, ttl = BASE.structures()
        ttl["policy"]["ci_exact_head"]["ttl_hours"] = float("nan")
        decision, reasons = BASE.evaluate_case(BASE.evidence(), ttl=ttl)
        self.assertEqual("BLOCK", decision)
        self.assertIn("ttl_policy:ttl_invalid:ci_exact_head", reasons)

        original_load = BASE.PREFLIGHT.load
        canonical_ttl = deepcopy(original_load("EVIDENCE_TTL_POLICY.json"))
        evidence_class = next(iter(canonical_ttl["policy"]))
        canonical_ttl["policy"][evidence_class]["ttl_hours"] = float("inf")

        def load_with_nonfinite_ttl(name):
            if name == "EVIDENCE_TTL_POLICY.json":
                return deepcopy(canonical_ttl)
            return original_load(name)

        BASE.PREFLIGHT.load = load_with_nonfinite_ttl
        try:
            errors = BASE.PREFLIGHT.validate()
        finally:
            BASE.PREFLIGHT.load = original_load
        self.assertIn(f"ttl-policy-ttl-invalid:{evidence_class}", errors)

        canonical_ttl[evidence_class]["ttl_hours"] = 10**10000
        BASE.PREFLIGHT.load = load_with_nonfinite_ttl
        try:
            errors = BASE.PREFLIGHT.validate()
        finally:
            BASE.PREFLIGHT.load = original_load
        self.assertIn(f"ttl-policy-ttl-invalid:{evidence_class}", errors)

    def test_nonhex_release_sha_fails_closed(self):
        invariants, gates, contracts, impact, ttl = BASE.structures()
        entry = BASE.evidence()
        decision, reasons = BASE.MODULE.evaluate_release_decision(
            invariants,
            gates,
            contracts,
            impact,
            {},
            BASE.snapshot(),
            ttl,
            actual_head="z" * 40,
            actual_target=BASE.TARGET,
            current_control_plane_fingerprint=BASE.CONTROL,
            now=BASE.NOW,
            attestation=BASE.signed_attestation(entry),
            attestation_key=BASE.KEY,
            current_trigger_state=BASE.signed_trigger_state(),
        )
        self.assertEqual("BLOCK", decision)
        self.assertIn("release_evidence:actual_head_invalid", reasons)

    def test_attestation_schema_version_requires_exact_integer(self):
        original = BASE.signed_attestation

        def malformed(entries):
            value = original(entries)
            value["schema_version"] = True
            value["signature"] = BASE.MODULE.sign_attestation(value, BASE.KEY)
            return value

        BASE.signed_attestation = malformed
        try:
            decision, reasons = BASE.evaluate_case(BASE.evidence())
        finally:
            BASE.signed_attestation = original
        self.assertEqual("BLOCK", decision)
        self.assertIn("attestation:schema_invalid", reasons)

    def test_malformed_evidence_status_fails_closed_without_type_error(self):
        original = BASE.signed_attestation

        def malformed(entries):
            value = original(entries)
            value["evidence"][0]["status"] = ["COUNTERCHECKED"]
            value["signature"] = BASE.MODULE.sign_attestation(value, BASE.KEY)
            return value

        BASE.signed_attestation = malformed
        try:
            decision, reasons = BASE.evaluate_case(BASE.evidence())
        finally:
            BASE.signed_attestation = original
        self.assertEqual("BLOCK", decision)
        self.assertTrue(
            any(reason.startswith("release_evidence:not_current:EV-HARDENING") for reason in reasons),
            reasons,
        )

    def test_canonical_cli_rejects_unresolvable_release_sha(self):
        completed = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "fanmind_release_decision.py"),
                "--release-sha",
                "b" * 40,
                "--target",
                "repository:synthetic",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertIn("FANMIND_RELEASE_DECISION=BLOCK", completed.stdout)
        self.assertIn("release_evidence:actual_head_unresolvable", completed.stdout)

    def test_round8_cli_is_fail_closed_and_not_an_alternate_evaluator(self):
        completed = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "fanmind_release_decision_core_round8.py"),
                "--check",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(0, completed.returncode)
        self.assertIn("FANMIND_RELEASE_DECISION=BLOCK", completed.stdout)
        self.assertIn("round8_cli_disabled_use_canonical_entrypoint", completed.stdout)

    def test_legacy_cli_is_fail_closed_and_not_an_alternate_evaluator(self):
        completed = subprocess.run(
            [
                sys.executable,
                str(ROOT / "scripts" / "fanmind_release_decision_core_legacy.py"),
                "--check",
            ],
            cwd=ROOT,
            text=True,
            capture_output=True,
            check=False,
        )
        self.assertNotEqual(0, completed.returncode)
        self.assertIn("FANMIND_RELEASE_DECISION=BLOCK", completed.stdout)
        self.assertIn("legacy_cli_disabled_use_canonical_entrypoint", completed.stdout)


if __name__ == "__main__":
    unittest.main()

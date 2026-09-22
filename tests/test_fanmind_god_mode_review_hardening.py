from datetime import datetime, timezone
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fanmind_release_decision_hardened", ROOT / "scripts" / "fanmind_release_decision.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)

HEAD = "a" * 40
TARGET = "repository:synthetic"
CONTROL = "c" * 64
KEY = "test-only-protected-attestation-key-000000000000"
NOW = datetime(2026, 9, 21, 22, 0, 0, tzinfo=timezone.utc)
GATE = "FM-IGATE-REVIEW-HARDENING"
INVARIANT = "FM-INV-REVIEW-HARDENING"
CONTRACT = "FM-CONTRACT-REVIEW-HARDENING"


def structures():
    invariants = {
        "invariants": [
            {
                "id": INVARIANT,
                "required": True,
                "status": "ENFORCED",
                "revalidate_on": ["schema_or_authority_change"],
            }
        ]
    }
    gates = {
        "gates": [
            {
                "id": GATE,
                "applicable": True,
                "status": "VERIFIED",
                "contracts": [CONTRACT],
                "evidence_required": ["exact tenant proof", "negative authority proof"],
            }
        ]
    }
    contracts = {
        "contracts": [
            {"id": CONTRACT, "status": "ACTIVE", "minimum_risk": "R1"}
        ]
    }
    impact = {"mappings": [{"contract": CONTRACT, "gates": [GATE]}]}
    ttl = {
        "policy": {
            "ci_exact_head": {
                "ttl_hours": None,
                "revalidate_on": ["head_changed"],
            }
        }
    }
    return invariants, gates, contracts, impact, ttl


def snapshot():
    return {
        "operation": "repository_merge",
        "risk": "R1",
        "affected_contracts": [CONTRACT],
        "evaluated_commit": HEAD,
        "evaluated_target": TARGET,
        "evidence_bindings": [{"id": "EV-HARDENING", "commit": HEAD, "target": TARGET}],
        "dependencies_satisfied": True,
        "consumer_impact_revalidated": True,
        "open_p0": 0,
        "open_p1": 0,
        "open_p2": 0,
        "pending_checks": False,
        "failed_required_checks": False,
        "unresolved_review_threads": False,
        "reconciliation_required": False,
        "protected_action_required": False,
        "blocking_reasons": [],
    }


def evidence():
    return {
        "id": "EV-HARDENING",
        "status": "COUNTERCHECKED",
        "class": "ci_exact_head",
        "roles": ["evidence"],
        "gates": [GATE],
        "invariants": [INVARIANT],
        "requirements": {
            GATE: ["exact tenant proof", "negative authority proof"],
        },
        "bound_commit": HEAD,
        "target": TARGET,
        "observed_at": "2026-09-21T21:30:00Z",
        "control_plane_fingerprint": CONTROL,
        "trigger_fingerprints": {
            "head_changed": "head:a",
            "schema_or_authority_change": "authority:v1",
        },
        "provenance": {
            "source": "protected-review-proof",
            "execution_id": "review-proof-1",
            "independence_key": "review-proof-key-1",
        },
    }


def signed_attestation(entry):
    value = {
        "schema_version": 1,
        "issuer": MODULE.ATTESTATION_ISSUER,
        "release_sha": HEAD,
        "target": TARGET,
        "control_plane_fingerprint": CONTROL,
        "issued_at": "2026-09-21T21:45:00Z",
        "expires_at": "2026-09-21T22:45:00Z",
        "trigger_state": {
            "head_changed": "head:a",
            "schema_or_authority_change": "authority:v1",
        },
        "evidence": [entry],
    }
    value["signature"] = MODULE.sign_attestation(value, KEY)
    return value


def evaluate(entry):
    invariants, gates, contracts, impact, ttl = structures()
    return MODULE.evaluate_release_decision(
        invariants,
        gates,
        contracts,
        impact,
        {},
        snapshot(),
        ttl,
        actual_head=HEAD,
        actual_target=TARGET,
        current_control_plane_fingerprint=CONTROL,
        now=NOW,
        attestation=signed_attestation(entry),
        attestation_key=KEY,
    )


class CurrentHeadReviewHardeningTests(unittest.TestCase):
    def test_release_decision_snapshot_is_in_signed_control_plane(self):
        self.assertIn("project-memory/RELEASE_DECISION.json", MODULE.CONTROL_PLANE_FILES)
        self.assertIn("scripts/_fanmind_release_decision_base.py", MODULE.CONTROL_PLANE_FILES)

    def test_clean_semantic_evidence_contract_still_allows_repository_decision(self):
        self.assertEqual(("ALLOW", []), evaluate(evidence()))

    def test_invariant_specific_revalidation_trigger_cannot_be_stale(self):
        entry = evidence()
        entry["trigger_fingerprints"]["schema_or_authority_change"] = "authority:old"
        decision, reasons = evaluate(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            f"release_evidence:invariant_revalidation_unsatisfied:{INVARIANT}", reasons
        )

    def test_gate_roles_cannot_replace_gate_semantic_evidence_contract(self):
        entry = evidence()
        entry["requirements"][GATE] = ["exact tenant proof"]
        decision, reasons = evaluate(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            f"release_evidence:gate_requirement_missing:{GATE}:negative authority proof",
            reasons,
        )

    def test_gate_requirement_claim_from_stale_entry_does_not_count(self):
        entry = evidence()
        entry["trigger_fingerprints"]["head_changed"] = "head:old"
        decision, reasons = evaluate(entry)
        self.assertEqual("BLOCK", decision)
        self.assertIn(
            f"release_evidence:gate_requirement_missing:{GATE}:exact tenant proof",
            reasons,
        )


if __name__ == "__main__":
    unittest.main()

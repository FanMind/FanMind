from __future__ import annotations

import copy
import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
SPEC = importlib.util.spec_from_file_location(
    "fanmind_orchestrator_admission",
    ROOT / "scripts" / "fanmind_orchestrator_admission.py",
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


def handoff() -> dict:
    value = {
        "schema_version": 1,
        "handoff_id": "handoff-next-001",
        "state": "PREPARED",
        "task_id": "next-task-001",
        "previous_task_id": "previous-task-001",
        "source": "CATALOG",
        "catalog_action_id": "NBA-NEXT",
        "roadmap_task": "FM-NEXT-001",
        "goal": "Deliver one bounded repository-only change.",
        "scope": {
            "files": ["src/next.py"],
            "contracts": ["FM-CONTRACT-NEXT-001"],
        },
        "acceptance": ["focused test passes", "exact-head checks pass"],
        "risk": "R2",
        "forbidden": [
            "Production mutation",
            "database apply",
            "payment or Billing activation",
            "secret or permission mutation",
        ],
        "prepared_main_sha": "b" * 40,
    }
    value["payload_sha256"] = MODULE.envelope_digest(
        MODULE.canonical_task_envelope(value)
    )
    return value


def receipt(status: str = "COMPLETED") -> dict:
    value = {
        "schema_version": 2,
        "task_id": "previous-task-001",
        "handoff_id": "handoff-previous-001",
        "payload_sha256": "f" * 64,
        "status": status,
        "summary": "Previous bounded task reached its real terminal state.",
        "evidence": ["immutable source evidence"],
        "blocker": "" if status == "COMPLETED" else "real blocker",
        "resume_condition": "" if status == "COMPLETED" else "new evidence",
        "completed_at": "2026-10-05T10:00:00Z",
        "main_sha": "a" * 40,
        "source_acceptance": {
            "kind": "pull_request",
            "pr_number": 123,
            "head_sha": "c" * 40,
            "merge_sha": "a" * 40,
            "required_checks": ["FanMind CI", "God Mode"],
        },
        "runtime_evidence": {"required": False, "status": "NOT_REQUIRED"},
    }
    return value


def truth() -> dict:
    return {
        "observed_main_sha": "b" * 40,
        "main_readable": True,
        "receipt_main_reachable": True,
        "previous_pr": {
            "number": 123,
            "head_sha": "c" * 40,
            "merge_sha": "a" * 40,
            "merged": True,
        },
        "checks": {"FanMind CI": "success", "God Mode": "success"},
        "matching_dispatches": [],
        "previous_handoff_matches": True,
        "previous_handoff_source": "workflow_run",
    }


def ready() -> dict:
    return {
        "state": "READY",
        "executable": True,
        "action_id": "NBA-NEXT",
        "task": "FM-NEXT-001",
        "safe_ready_set": ["NBA-NEXT"],
    }


class AdmissionTests(unittest.TestCase):
    def decision(self, **overrides):
        values = {
            "handoff": handoff(),
            "receipt": receipt(),
            "github_truth": truth(),
            "selector_decision": ready(),
            "requested_task_id": "next-task-001",
        }
        values.update(overrides)
        return MODULE.evaluate_admission(**values)

    def test_verified_previous_completion_and_one_ready_task_send_once(self):
        calls = []
        result = MODULE.dispatch_if_admitted(
            self.decision(), lambda payload: calls.append(payload) or {"status": 202}
        )
        self.assertEqual(1, result["sent"])
        self.assertEqual(1, len(calls))
        self.assertIn('"task_id":"next-task-001"', calls[0])

    def test_manual_composer_rejects_residual_text_with_zero_sends(self):
        prepared = handoff()
        exact = MODULE.render_builder_input(MODULE.canonical_task_envelope(prepared))
        decision = self.decision(
            handoff=prepared,
            composer_input="old composer content\n" + exact,
        )
        calls = []
        result = MODULE.dispatch_if_admitted(
            decision, lambda payload: calls.append(payload) or {"status": 202}
        )
        self.assertEqual("composer_content_mismatch", decision["blocker"])
        self.assertEqual(0, result["sent"])
        self.assertEqual([], calls)

    def test_main_may_advance_after_immutable_previous_merge(self):
        decision = self.decision()
        self.assertEqual("SEND", decision["decision"])

    def test_duplicate_dispatch_on_unchanged_state_sends_nothing(self):
        observed = truth()
        observed["matching_dispatches"] = [{"id": "99", "status": "completed"}]
        result = MODULE.dispatch_if_admitted(
            self.decision(github_truth=observed),
            lambda _payload: self.fail("transport must not be called"),
        )
        self.assertEqual(0, result["sent"])
        self.assertEqual("duplicate_dispatch_same_state", result["decision"]["blocker"])

    def test_non_completed_results_preserve_their_real_meaning(self):
        for status in ("BLOCKED", "FAILED", "NO_CHANGE"):
            with self.subTest(status=status):
                decision = self.decision(receipt=receipt(status))
                self.assertEqual("BLOCK", decision["decision"])
                self.assertEqual(
                    f"previous_result_not_completed:{status}", decision["blocker"]
                )

    def test_missing_wrong_or_untyped_result_sends_nothing(self):
        cases = []
        wrong = receipt()
        wrong["task_id"] = "another-task"
        cases.append((wrong, "previous_task_id_receipt_mismatch"))
        untyped = receipt()
        untyped.pop("schema_version")
        cases.append((untyped, "typed_receipt_v2_required"))
        nonterminal = receipt()
        nonterminal["status"] = "IN_PROGRESS"
        cases.append((nonterminal, "receipt_not_terminal"))
        for candidate, blocker in cases:
            with self.subTest(blocker=blocker):
                decision = self.decision(receipt=candidate)
                self.assertEqual("BLOCK", decision["decision"])
                self.assertEqual(blocker, decision["blocker"])

    def test_stale_or_unreadable_evidence_sends_nothing(self):
        stale = truth()
        stale["observed_main_sha"] = "d" * 40
        unreadable = truth()
        unreadable["main_readable"] = False
        unreachable = truth()
        unreachable["receipt_main_reachable"] = False
        for candidate, blocker in (
            (stale, "handoff_main_is_stale"),
            (unreadable, "github_main_unreadable"),
            (unreachable, "receipt_main_not_reachable"),
        ):
            with self.subTest(blocker=blocker):
                self.assertEqual(blocker, self.decision(github_truth=candidate)["blocker"])

    def test_receipt_never_substitutes_for_previous_handoff_identity(self):
        observed = truth()
        observed["previous_handoff_matches"] = False
        observed["previous_handoff_source"] = ""
        decision = self.decision(github_truth=observed)
        self.assertEqual(
            "previous_handoff_identity_missing_or_mismatched", decision["blocker"]
        )

    def test_github_get_failure_blocks_before_transport(self):
        class BrokenClient:
            def get(self, _path):
                raise MODULE.AdmissionError("github_read_failed:synthetic")

        calls = []
        with self.assertRaisesRegex(MODULE.AdmissionError, "github_read_failed"):
            MODULE.dispatch_with_github(
                handoff(),
                receipt(),
                ready(),
                BrokenClient(),
                lambda payload: calls.append(payload) or {"status": 202},
                requested_task_id="next-task-001",
                requested_handoff_id="handoff-next-001",
                requested_previous_task_id="previous-task-001",
                requested_payload_sha256=handoff()["payload_sha256"],
                current_run_id="500",
            )
        self.assertEqual([], calls)

    def test_manual_check_uses_github_truth_and_rejects_residual_text(self):
        class FakeClient:
            def get(self, _path):
                raise MODULE.AdmissionError("github_read_failed:synthetic")

        prepared = handoff()
        exact = MODULE.render_builder_input(MODULE.canonical_task_envelope(prepared))
        with self.assertRaisesRegex(MODULE.AdmissionError, "github_read_failed"):
            MODULE.check_with_github(
                prepared,
                receipt(),
                ready(),
                FakeClient(),
                requested_task_id="next-task-001",
                requested_handoff_id="handoff-next-001",
                requested_previous_task_id="previous-task-001",
                requested_payload_sha256=prepared["payload_sha256"],
                composer_input=exact,
            )

        decision = self.decision(
            handoff=prepared,
            composer_input=exact + "unexpected stale suffix",
        )
        self.assertEqual("BLOCK", decision["decision"])
        self.assertEqual("composer_content_mismatch", decision["blocker"])

    def test_latest_actual_run_blocks_old_receipt_after_cancel_or_timeout(self):
        previous = receipt()
        current = handoff()

        class FakeClient:
            def get(self, path):
                if path == "commits/main":
                    return {"sha": "b" * 40}
                if path.startswith("compare/"):
                    return {"status": "ahead"}
                if path == "pulls/123":
                    return {
                        "number": 123,
                        "head": {"sha": "c" * 40},
                        "merge_commit_sha": "a" * 40,
                        "merged_at": "2026-10-05T10:00:00Z",
                    }
                if path.startswith("commits/") and path.endswith("check-runs?per_page=100"):
                    return {
                        "check_runs": [
                            {"name": "FanMind CI", "conclusion": "success"},
                            {"name": "God Mode", "conclusion": "success"},
                        ]
                    }
                if path.startswith("actions/workflows/"):
                    return {
                        "workflow_runs": [
                            {
                                "id": 499,
                                "display_title": "Orchestrator handoff newer-handoff task unresolved-task digest "
                                + "e" * 64,
                                "status": "completed",
                                "conclusion": "cancelled",
                            },
                            {
                                "id": 498,
                                "display_title": "Orchestrator handoff handoff-previous-001 task previous-task-001 digest "
                                + "f" * 64,
                                "status": "completed",
                                "conclusion": "success",
                            },
                        ]
                    }
                self.fail(f"unexpected path: {path}")

        observed = MODULE.collect_github_truth(
            FakeClient(), current, previous, current_run_id="500"
        )
        self.assertEqual("unresolved-task", observed["latest_previous_handoff"]["task"])
        self.assertEqual("cancelled", observed["latest_previous_handoff"]["conclusion"])
        self.assertFalse(observed["previous_handoff_matches"])
        self.assertEqual(
            "previous_handoff_identity_missing_or_mismatched",
            self.decision(github_truth=observed)["blocker"],
        )

    def test_actual_pr_head_merge_and_checks_are_bound(self):
        wrong_head = truth()
        wrong_head["previous_pr"]["head_sha"] = "e" * 40
        red = truth()
        red["checks"]["God Mode"] = "failure"
        self.assertEqual(
            "github_pr_evidence_mismatch:head_sha",
            self.decision(github_truth=wrong_head)["blocker"],
        )
        self.assertEqual(
            "required_check_not_success:God Mode",
            self.decision(github_truth=red)["blocker"],
        )

    def test_consumed_owner_only_unready_or_conflicting_selector_is_not_executable(self):
        for state in ("NONE", "OWNER_ACTION_REQUIRED", "DEFERRED_BY_OWNER", "PARALLEL_ACTIVE"):
            candidate = {
                "state": state,
                "executable": False,
                "action_id": None,
                "task": None,
                "safe_ready_set": [],
            }
            with self.subTest(state=state):
                decision = self.decision(selector_decision=candidate)
                self.assertEqual(f"selector_not_ready:{state}", decision["blocker"])

    def test_active_selector_continuation_is_not_redispatched(self):
        action = MODULE.selector._action("ACTIVE", 1, task="FM-ACTIVE-001")
        state = MODULE.selector._synthetic_state(["ACTIVE"])
        decision = MODULE.selector.dispatch_decision(
            state,
            {"actions": [action]},
            set(),
            active_slots=[
                {
                    "tasks": {"FM-ACTIVE-001"},
                    "action": "ACTIVE",
                    "status": "ACTIVE",
                    "status_conflict": False,
                }
            ],
        )
        self.assertFalse(decision["executable"])
        self.assertEqual("PARALLEL_ACTIVE", decision["state"])

    def test_wrong_or_multiple_ready_actions_are_rejected(self):
        wrong = ready()
        wrong["action_id"] = "NBA-OTHER"
        multiple = ready()
        multiple["safe_ready_set"] = ["NBA-NEXT", "NBA-OTHER"]
        self.assertEqual("selector_action_mismatch", self.decision(selector_decision=wrong)["blocker"])
        self.assertEqual("selector_not_exactly_one", self.decision(selector_decision=multiple)["blocker"])

    def test_tampered_scope_or_boundary_invalidates_payload_digest(self):
        candidate = handoff()
        candidate["scope"]["files"].append("src/unapproved.py")
        self.assertEqual(
            "handoff_payload_digest_mismatch", self.decision(handoff=candidate)["blocker"]
        )
        candidate = handoff()
        candidate["forbidden"].remove("database apply")
        self.assertEqual(
            "handoff_payload_digest_mismatch", self.decision(handoff=candidate)["blocker"]
        )

    def test_owner_direct_handoff_never_masquerades_as_catalog_work(self):
        candidate = handoff()
        candidate.update(
            {
                "source": "OWNER_DIRECT",
                "catalog_action_id": "NBA-NEXT",
                "selection_basis": "EXPLICIT_OWNER_TASK",
                "owner_authorized_at": "2026-10-05T10:59:00Z",
            }
        )
        candidate["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(candidate)
        )
        self.assertEqual(
            "owner_direct_must_not_claim_catalog_action",
            self.decision(handoff=candidate)["blocker"],
        )


if __name__ == "__main__":
    unittest.main()

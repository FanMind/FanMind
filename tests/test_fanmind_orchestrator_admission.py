from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import sys
import unittest
from pathlib import Path
from unittest import mock


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
        "agent_context": "FanMind Builder",
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
        "required_checks": ["FanMind CI", "FanMind God Mode Gate"],
        "runtime_requirement": {"required": False},
        "forbidden": [
            "Production mutation",
            "database apply",
            "payment or Billing activation",
            "secret or permission mutation",
        ],
        "prepared_main_sha": "b" * 40,
        "previous_result_disposition": "ACCEPTED_COMPLETION",
    }
    contract = {
        "goal": value["goal"],
        "scope": value["scope"],
        "acceptance": value["acceptance"],
        "required_checks": value["required_checks"],
        "runtime_requirement": value["runtime_requirement"],
    }
    value["catalog_contract_sha256"] = hashlib.sha256(
        json.dumps(contract, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    value["payload_sha256"] = MODULE.envelope_digest(
        MODULE.canonical_task_envelope(value)
    )
    return value


def previous_handoff() -> dict:
    value = handoff()
    value.update(
        {
            "handoff_id": "handoff-previous-001",
            "task_id": "previous-task-001",
            "previous_task_id": "before-previous-task-001",
            "catalog_action_id": "NBA-PREVIOUS",
            "roadmap_task": "FM-PREVIOUS-001",
            "goal": "Deliver the previous bounded repository change.",
            "scope": {
                "files": ["src/previous.py"],
                "contracts": ["FM-CONTRACT-PREVIOUS-001"],
            },
            "acceptance": ["previous focused test passes", "previous exact-head checks pass"],
        }
    )
    contract = {
        "goal": value["goal"],
        "scope": value["scope"],
        "acceptance": value["acceptance"],
        "required_checks": value["required_checks"],
        "runtime_requirement": value["runtime_requirement"],
    }
    value["catalog_contract_sha256"] = hashlib.sha256(
        json.dumps(contract, sort_keys=True, separators=(",", ":")).encode()
    ).hexdigest()
    value["payload_sha256"] = MODULE.envelope_digest(
        MODULE.canonical_task_envelope(value)
    )
    return value


def receipt_for_handoff(accepted: dict, status: str = "COMPLETED") -> dict:
    value = {
        "schema_version": 2,
        "task_id": accepted["task_id"],
        "handoff_id": accepted["handoff_id"],
        "payload_sha256": accepted["payload_sha256"],
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
            "required_checks": accepted["required_checks"],
        },
        "runtime_evidence": {"required": False, "status": "NOT_REQUIRED"},
        "accepted_handoff": MODULE.canonical_task_envelope(accepted),
    }
    return value


def receipt(status: str = "COMPLETED") -> dict:
    return receipt_for_handoff(previous_handoff(), status)


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
            "base": "main",
        },
        "source_merge_reachable": True,
        "workflow_checks": {
            "FanMind CI": "success",
            "FanMind God Mode Gate": "success",
        },
        "matching_dispatches": [],
        "previous_handoff_matches": True,
        "previous_handoff_source": "workflow_run",
        "current_handoff_matches": True,
        "current_run_attempt": 1,
    }


def source_workflow_history(
    checks: dict[str, str] | None = None, head_sha: str = "c" * 40
) -> dict:
    conclusions = checks or {
        "FanMind CI": "success",
        "FanMind God Mode Gate": "success",
    }
    return {
        "total_count": len(conclusions),
        "workflow_runs": [
            {
                "id": 1000 + index,
                "name": name,
                "event": "pull_request",
                "head_sha": head_sha,
                "status": "completed",
                "conclusion": conclusion,
            }
            for index, (name, conclusion) in enumerate(conclusions.items())
        ],
    }


def ready() -> dict:
    return {
        "state": "READY",
        "executable": True,
        "action_id": "NBA-NEXT",
        "task": "FM-NEXT-001",
        "safe_ready_set": ["NBA-NEXT"],
        "task_contract": {
            "goal": "Deliver one bounded repository-only change.",
            "scope": {
                "files": ["src/next.py"],
                "contracts": ["FM-CONTRACT-NEXT-001"],
            },
            "acceptance": ["focused test passes", "exact-head checks pass"],
            "required_checks": ["FanMind CI", "FanMind God Mode Gate"],
            "runtime_requirement": {"required": False},
        },
    }


def current_receipt(status: str = "COMPLETED") -> dict:
    value = receipt(status)
    prepared = handoff()
    value["task_id"] = prepared["task_id"]
    value["handoff_id"] = prepared["handoff_id"]
    value["payload_sha256"] = prepared["payload_sha256"]
    value["accepted_handoff"] = MODULE.canonical_task_envelope(prepared)
    return value


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

    def test_foreign_agent_context_is_rejected_not_normalized(self):
        prepared = handoff()
        prepared["agent_context"] = "DifferentAgent"
        self.assertEqual("agent_context_mismatch", self.decision(handoff=prepared)["blocker"])

    def test_manual_check_is_fresh_but_never_a_consuming_send_admission(self):
        prepared = handoff()
        exact = MODULE.render_builder_input(MODULE.canonical_task_envelope(prepared))
        kwargs = {
            "requested_task_id": prepared["task_id"],
            "requested_handoff_id": prepared["handoff_id"],
            "requested_previous_task_id": prepared["previous_task_id"],
            "requested_payload_sha256": prepared["payload_sha256"],
            "composer_input": exact,
            "local_head": prepared["prepared_main_sha"],
        }
        with mock.patch.object(MODULE, "collect_github_truth", return_value=truth()):
            first = MODULE.check_with_github(
                prepared, receipt(), ready(), object(), **kwargs
            )
            second = MODULE.check_with_github(
                prepared, receipt(), ready(), object(), **kwargs
            )
        self.assertEqual("PREPARED_ONLY", first["decision"])
        self.assertEqual("PREPARED_ONLY", second["decision"])
        self.assertFalse(first["send_authorized"])
        self.assertFalse(second["send_authorized"])

        stale = MODULE.check_with_github(
            prepared,
            receipt(),
            ready(),
            object(),
            **{**kwargs, "local_head": "d" * 40},
        )
        self.assertEqual("local_head_not_prepared_main", stale["blocker"])

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

    def test_rerun_attempt_never_posts_again(self):
        observed = truth()
        observed["current_run_attempt"] = 2
        result = MODULE.dispatch_if_admitted(
            self.decision(github_truth=observed),
            lambda _payload: self.fail("rerun must not call transport"),
        )
        self.assertEqual(0, result["sent"])
        self.assertEqual(
            "workflow_rerun_requires_reconciliation", result["decision"]["blocker"]
        )

    def test_non_completed_results_preserve_their_real_meaning(self):
        for status in ("BLOCKED", "FAILED", "NO_CHANGE"):
            with self.subTest(status=status):
                decision = self.decision(receipt=receipt(status))
                self.assertEqual("BLOCK", decision["decision"])
                self.assertEqual(
                    f"previous_result_not_reconciled:{status}", decision["blocker"]
                )

    def test_reconciled_parked_result_allows_only_independent_safe_followup(self):
        prepared = handoff()
        prepared["previous_result_disposition"] = "RECONCILED_PARKED"
        prepared["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(prepared)
        )
        observed = truth()
        observed["latest_previous_handoff"] = {
            "status": "completed",
            "conclusion": "success",
            "transport_state": "TRANSPORT_ACCEPTED",
        }
        allowed = self.decision(
            handoff=prepared,
            receipt=receipt("BLOCKED"),
            github_truth=observed,
        )
        self.assertEqual("SEND", allowed["decision"])

        observed["latest_previous_handoff"]["conclusion"] = "failure"
        blocked = self.decision(
            handoff=prepared,
            receipt=receipt("BLOCKED"),
            github_truth=observed,
        )
        self.assertEqual("previous_result_unresolved:BLOCKED", blocked["blocker"])

    def test_same_parked_work_requires_selector_bound_resume_evidence(self):
        accepted = handoff()
        accepted.update(
            {
                "handoff_id": "handoff-parked-work",
                "task_id": "parked-work-task",
                "previous_task_id": "older-task",
            }
        )
        accepted["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(accepted)
        )
        previous = receipt_for_handoff(accepted, "BLOCKED")
        prepared = handoff()
        prepared["previous_task_id"] = accepted["task_id"]
        prepared["previous_result_disposition"] = "RECONCILED_PARKED"
        prepared["resume_evidence"] = ["verified upstream revision 7"]
        contract = copy.deepcopy(ready()["task_contract"])
        contract["resume_evidence"] = prepared["resume_evidence"]
        prepared["catalog_contract_sha256"] = hashlib.sha256(
            json.dumps(contract, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        prepared["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(prepared)
        )
        selector_decision = ready()
        selector_decision["task_contract"] = contract
        observed = truth()
        observed["latest_previous_handoff"] = {
            "status": "completed",
            "conclusion": "success",
            "transport_state": "TRANSPORT_ACCEPTED",
        }
        self.assertEqual(
            "SEND",
            self.decision(
                handoff=prepared,
                receipt=previous,
                github_truth=observed,
                selector_decision=selector_decision,
            )["decision"],
        )

        unbound = copy.deepcopy(selector_decision)
        unbound["task_contract"].pop("resume_evidence")
        self.assertEqual(
            "catalog_dispatch_contract_mismatch",
            self.decision(
                handoff=prepared,
                receipt=previous,
                github_truth=observed,
                selector_decision=unbound,
            )["blocker"],
        )

        repeated = copy.deepcopy(prepared)
        repeated["handoff_id"] = "handoff-repeated-resume"
        repeated["task_id"] = "repeated-resume-task"
        repeated["previous_task_id"] = prepared["task_id"]
        repeated["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(repeated)
        )
        repeated_receipt = receipt_for_handoff(prepared, "BLOCKED")
        self.assertEqual(
            "same_work_new_resume_evidence_required",
            self.decision(
                handoff=repeated,
                receipt=repeated_receipt,
                github_truth=observed,
                selector_decision=selector_decision,
                requested_task_id=repeated["task_id"],
            )["blocker"],
        )

        repeated["resume_evidence"].append("verified upstream revision 8")
        repeated_contract = copy.deepcopy(contract)
        repeated_contract["resume_evidence"] = repeated["resume_evidence"]
        repeated["catalog_contract_sha256"] = hashlib.sha256(
            json.dumps(repeated_contract, sort_keys=True, separators=(",", ":")).encode()
        ).hexdigest()
        repeated["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(repeated)
        )
        repeated_ready = copy.deepcopy(selector_decision)
        repeated_ready["task_contract"] = repeated_contract
        self.assertEqual(
            "SEND",
            self.decision(
                handoff=repeated,
                receipt=repeated_receipt,
                github_truth=observed,
                selector_decision=repeated_ready,
                requested_task_id=repeated["task_id"],
            )["decision"],
        )

    def test_new_catalog_action_task_and_handoff_ids_do_not_reopen_completed_work(self):
        prepared = handoff()
        accepted = handoff()
        accepted.update(
            {
                "handoff_id": "handoff-accepted-same-work",
                "task_id": "accepted-same-work-task",
                "previous_task_id": "older-task",
                "catalog_action_id": "NBA-ACCEPTED-OLD-ID",
                "roadmap_task": "FM-ACCEPTED-OLD-ID",
            }
        )
        accepted["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(accepted)
        )
        prepared["previous_task_id"] = accepted["task_id"]
        prepared["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(prepared)
        )
        previous = receipt_for_handoff(accepted)
        self.assertEqual(
            "work_identity_already_accepted",
            self.decision(handoff=prepared, receipt=previous)["blocker"],
        )

    def test_missing_wrong_or_untyped_result_sends_nothing(self):
        cases = []
        wrong = receipt()
        wrong["task_id"] = "another-task"
        cases.append((wrong, "receipt_accepted_handoff_task_mismatch"))
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
                local_head="b" * 40,
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
                        "base": {"ref": "main"},
                    }
                if path.startswith("actions/runs?head_sha="):
                    return source_workflow_history()
                if path.startswith("actions/workflows/"):
                    return {
                        "total_count": 2,
                        "workflow_runs": [
                            {
                                "id": 499,
                                "display_title": "Orchestrator handoff newer-handoff task unresolved-task digest "
                                + "e" * 64,
                                "status": "completed",
                                "conclusion": "cancelled",
                                "run_attempt": 1,
                            },
                            {
                                "id": 498,
                                "display_title": "Orchestrator handoff handoff-previous-001 task previous-task-001 digest "
                                + previous["payload_sha256"],
                                "status": "completed",
                                "conclusion": "success",
                                "run_attempt": 1,
                            },
                        ]
                    }
                if path == "actions/runs/500":
                    return {
                        "id": 500,
                        "display_title": "Orchestrator handoff handoff-next-001 task next-task-001 digest "
                        + current["payload_sha256"],
                        "event": "workflow_dispatch",
                        "path": ".github/workflows/fanmind-manager-event-dispatch.yml",
                        "run_attempt": 1,
                    }
                if path in {
                    "actions/runs/499/attempts/1/jobs?per_page=100&page=1",
                    "actions/runs/498/attempts/1/jobs?per_page=100&page=1",
                }:
                    return {
                        "total_count": 1,
                        "jobs": [
                            {
                                "steps": [
                                    {"name": "Admit prepared handoff", "conclusion": "success"},
                                    {
                                        "name": "Transport exactly one admitted handoff",
                                        "status": "completed",
                                        "conclusion": "success",
                                    },
                                ]
                            }
                        ],
                    }
                self.fail(f"unexpected path: {path}")

        observed = MODULE.collect_github_truth(
            FakeClient(), current, previous, current_run_id="500"
        )
        self.assertEqual(
            {"FanMind CI": "success", "FanMind God Mode Gate": "success"},
            observed["workflow_checks"],
        )
        self.assertEqual("unresolved-task", observed["latest_previous_handoff"]["task"])
        self.assertEqual("cancelled", observed["latest_previous_handoff"]["conclusion"])
        self.assertFalse(observed["previous_handoff_matches"])
        self.assertEqual(
            "previous_handoff_identity_missing_or_mismatched",
            self.decision(github_truth=observed)["blocker"],
        )

    def test_rejected_pretransport_run_is_not_previous_handoff_but_bad_title_blocks(self):
        prepared = handoff()
        previous = receipt()
        current_run_id = str(MODULE.LEGACY_WORKFLOW_RUN_BOUNDARY + 3)
        rejected_run_id = MODULE.LEGACY_WORKFLOW_RUN_BOUNDARY + 2
        accepted_run_id = MODULE.LEGACY_WORKFLOW_RUN_BOUNDARY + 1

        class FakeClient:
            bad_title = False

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
                        "base": {"ref": "main"},
                    }
                if path.startswith("actions/runs?head_sha="):
                    return source_workflow_history()
                if path.startswith("actions/workflows/"):
                    title = (
                        "unreadable latest identity"
                        if self.bad_title
                        else "Orchestrator handoff rejected task rejected-task digest " + "e" * 64
                    )
                    return {
                        "total_count": 2,
                        "workflow_runs": [
                            {"id": rejected_run_id, "display_title": title, "created_at": "2026-10-05T11:00:00Z", "run_attempt": 1},
                            {
                                "id": accepted_run_id,
                                "display_title": "Orchestrator handoff handoff-previous-001 task previous-task-001 digest "
                                + previous["payload_sha256"],
                                "created_at": "2026-10-05T10:00:00Z",
                                "status": "completed",
                                "conclusion": "success",
                                "run_attempt": 1,
                            },
                        ],
                    }
                if path == f"actions/runs/{current_run_id}":
                    return {
                        "id": int(current_run_id),
                        "display_title": "Orchestrator handoff handoff-next-001 task next-task-001 digest "
                        + prepared["payload_sha256"],
                        "event": "workflow_dispatch",
                        "path": ".github/workflows/fanmind-manager-event-dispatch.yml",
                        "run_attempt": 1,
                    }
                if path == f"actions/runs/{rejected_run_id}/attempts/1/jobs?per_page=100&page=1":
                    return {
                        "total_count": 1,
                        "jobs": [{"steps": [
                            {"name": "Admit prepared handoff", "conclusion": "failure"},
                            {"name": "Transport exactly one admitted handoff", "conclusion": "skipped"},
                        ]}],
                    }
                if path == f"actions/runs/{accepted_run_id}/attempts/1/jobs?per_page=100&page=1":
                    return {
                        "total_count": 1,
                        "jobs": [{"steps": [
                            {"name": "Admit prepared handoff", "conclusion": "success"},
                            {"name": "Transport exactly one admitted handoff", "conclusion": "success"},
                        ]}],
                    }
                self.fail(f"unexpected path: {path}")

        client = FakeClient()
        observed = MODULE.collect_github_truth(
            client, prepared, previous, current_run_id=current_run_id
        )
        self.assertTrue(observed["previous_handoff_matches"])
        self.assertEqual(str(accepted_run_id), observed["latest_previous_handoff"]["run_id"])
        client.bad_title = True
        with self.assertRaisesRegex(
            MODULE.AdmissionError, "github_workflow_run_identity_unreadable"
        ):
            MODULE.collect_github_truth(
                client, prepared, previous, current_run_id=current_run_id
            )

    def test_admitted_then_skipped_transport_remains_unresolved(self):
        class Client:
            def get(self, _path):
                return {
                    "total_count": 1,
                    "jobs": [{"steps": [
                        {"name": "Admit prepared handoff", "conclusion": "success"},
                        {"name": "Transport exactly one admitted handoff", "conclusion": "skipped"},
                    ]}],
                }

        self.assertEqual(
            "TRANSPORT_UNRESOLVED",
            MODULE._transport_state(Client(), {"id": 1, "run_attempt": 1}),
        )

    def test_rerun_cannot_hide_transport_from_an_earlier_attempt(self):
        class Client:
            def get(self, path):
                if "/attempts/1/" in path:
                    return {
                        "total_count": 1,
                        "jobs": [{"steps": [
                            {"name": "Admit prepared handoff", "conclusion": "success"},
                            {"name": "Transport exactly one admitted handoff", "conclusion": "success"},
                        ]}],
                    }
                if "/attempts/2/" in path:
                    return {
                        "total_count": 1,
                        "jobs": [{"steps": [
                            {"name": "Admit prepared handoff", "conclusion": "failure"},
                            {"name": "Transport exactly one admitted handoff", "conclusion": "skipped"},
                        ]}],
                    }
                self.fail(f"unexpected path: {path}")

        self.assertEqual(
            "TRANSPORT_ACCEPTED",
            MODULE._transport_state(Client(), {"id": 499, "run_attempt": 2}),
        )

    def test_rerun_after_an_earlier_post_blocks_the_next_run_with_zero_sends(self):
        previous = receipt()
        current = handoff()
        history = [
            {
                "id": 499,
                "display_title": "Orchestrator handoff timed-out-handoff task timed-out-task digest "
                + "e" * 64,
                "created_at": "2026-10-05T11:00:00Z",
                "status": "completed",
                "conclusion": "failure",
                "run_attempt": 2,
            },
            {
                "id": 498,
                "display_title": "Orchestrator handoff handoff-previous-001 task previous-task-001 digest "
                + previous["payload_sha256"],
                "created_at": "2026-10-05T10:00:00Z",
                "status": "completed",
                "conclusion": "success",
                "run_attempt": 1,
            },
        ]

        class Client:
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
                        "base": {"ref": "main"},
                    }
                if path.startswith("actions/runs?head_sha="):
                    return source_workflow_history()
                if path == "actions/runs/500":
                    return {
                        "id": 500,
                        "display_title": "Orchestrator handoff handoff-next-001 task next-task-001 digest "
                        + current["payload_sha256"],
                        "event": "workflow_dispatch",
                        "path": ".github/workflows/fanmind-manager-event-dispatch.yml",
                        "run_attempt": 1,
                    }
                if "/runs/499/attempts/1/" in path or "/runs/498/attempts/1/" in path:
                    return {
                        "total_count": 1,
                        "jobs": [{"steps": [
                            {"name": "Admit prepared handoff", "conclusion": "success"},
                            {"name": "Transport exactly one admitted handoff", "conclusion": "success"},
                        ]}],
                    }
                if "/runs/499/attempts/2/" in path:
                    return {
                        "total_count": 1,
                        "jobs": [{"steps": [
                            {"name": "Admit prepared handoff", "conclusion": "failure"},
                            {"name": "Transport exactly one admitted handoff", "conclusion": "skipped"},
                        ]}],
                    }
                self.fail(f"unexpected path: {path}")

        with mock.patch.object(
            MODULE, "_complete_workflow_run_history", return_value=history
        ):
            observed = MODULE.collect_github_truth(
                Client(), current, previous, current_run_id="500"
            )
        result = MODULE.dispatch_if_admitted(
            self.decision(github_truth=observed),
            lambda _payload: self.fail("unreconciled earlier POST must not send"),
        )
        self.assertEqual(0, result["sent"])
        self.assertEqual("TRANSPORT_ACCEPTED", observed["latest_previous_handoff"]["transport_state"])
        self.assertEqual(
            "previous_handoff_identity_missing_or_mismatched",
            result["decision"]["blocker"],
        )

    def test_older_duplicate_is_found_behind_newer_valid_predecessor(self):
        prepared = handoff()
        previous = receipt()
        current_id = MODULE.LEGACY_WORKFLOW_RUN_BOUNDARY + 30
        history = [
            {
                "id": current_id,
                "display_title": "Orchestrator handoff handoff-next-001 task next-task-001 digest "
                + prepared["payload_sha256"],
                "created_at": "2026-10-05T12:00:00Z",
            },
            {
                "id": current_id - 1,
                "display_title": "Orchestrator handoff handoff-previous-001 task previous-task-001 digest "
                + previous["payload_sha256"],
                "created_at": "2026-10-05T11:00:00Z",
                "status": "completed",
                "conclusion": "success",
            },
            {
                "id": current_id - 2,
                "display_title": "Orchestrator handoff handoff-next-001 task next-task-001 digest "
                + prepared["payload_sha256"],
                "created_at": "2026-10-05T10:00:00Z",
                "status": "completed",
                "conclusion": "success",
            },
        ]

        class Client:
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
                        "base": {"ref": "main"},
                    }
                if path.startswith("actions/runs?head_sha="):
                    return source_workflow_history()
                if path == f"actions/runs/{current_id}":
                    return {
                        **history[0],
                        "event": "workflow_dispatch",
                        "path": ".github/workflows/fanmind-manager-event-dispatch.yml",
                        "run_attempt": 1,
                    }
                self.fail(f"unexpected path: {path}")

        with mock.patch.object(
            MODULE, "_complete_workflow_run_history", return_value=history
        ), mock.patch.object(
            MODULE, "_transport_state", return_value="TRANSPORT_ACCEPTED"
        ):
            observed = MODULE.collect_github_truth(
                Client(), prepared, previous, current_run_id=str(current_id)
            )
        self.assertTrue(observed["previous_handoff_matches"])
        self.assertEqual(1, len(observed["matching_dispatches"]))
        self.assertEqual(str(current_id - 2), observed["matching_dispatches"][0]["id"])

    def test_actual_pr_head_merge_and_checks_are_bound(self):
        wrong_head = truth()
        wrong_head["previous_pr"]["head_sha"] = "e" * 40
        red = truth()
        red["workflow_checks"]["FanMind God Mode Gate"] = "failure"
        self.assertEqual(
            "github_pr_evidence_mismatch:head_sha",
            self.decision(github_truth=wrong_head)["blocker"],
        )
        self.assertEqual(
            "required_check_not_success:FanMind God Mode Gate",
            self.decision(github_truth=red)["blocker"],
        )

    def test_latest_exact_head_workflow_run_controls_full_dispatch_chain(self):
        prepared = handoff()
        previous = receipt()
        previous_title = (
            "Orchestrator handoff handoff-previous-001 task previous-task-001 digest "
            + previous["payload_sha256"]
        )
        current_title = (
            "Orchestrator handoff handoff-next-001 task next-task-001 digest "
            + prepared["payload_sha256"]
        )

        class Client:
            def __init__(self, newest_status, newest_conclusion):
                self.newest_status = newest_status
                self.newest_conclusion = newest_conclusion

            def get(self, path):
                if path == "commits/main":
                    return {"sha": "b" * 40}
                if path in {
                    "compare/" + "a" * 40 + "..." + "b" * 40,
                }:
                    return {"status": "ahead"}
                if path == "pulls/123":
                    return {
                        "number": 123,
                        "head": {"sha": "c" * 40},
                        "merge_commit_sha": "a" * 40,
                        "merged_at": "2026-10-05T10:00:00Z",
                        "base": {"ref": "main"},
                    }
                if path.startswith("actions/runs?head_sha="):
                    return {
                        "total_count": 3,
                        "workflow_runs": [
                            {
                                "id": 1202,
                                "run_attempt": 1,
                                "name": "FanMind CI",
                                "event": "pull_request",
                                "head_sha": "c" * 40,
                                "created_at": "2026-10-05T11:02:00Z",
                                "status": self.newest_status,
                                "conclusion": self.newest_conclusion,
                            },
                            {
                                "id": 1201,
                                "run_attempt": 1,
                                "name": "FanMind God Mode Gate",
                                "event": "pull_request",
                                "head_sha": "c" * 40,
                                "created_at": "2026-10-05T11:01:00Z",
                                "status": "completed",
                                "conclusion": "success",
                            },
                            {
                                "id": 1200,
                                "run_attempt": 1,
                                "name": "FanMind CI",
                                "event": "pull_request",
                                "head_sha": "c" * 40,
                                "created_at": "2026-10-05T11:00:00Z",
                                "status": "completed",
                                "conclusion": "success",
                            },
                        ],
                    }
                if path.startswith("actions/workflows/"):
                    return {
                        "total_count": 2,
                        "workflow_runs": [
                            {
                                "id": 500,
                                "run_attempt": 1,
                                "display_title": current_title,
                                "created_at": "2026-10-05T12:00:00Z",
                                "status": "in_progress",
                                "conclusion": None,
                            },
                            {
                                "id": 499,
                                "run_attempt": 1,
                                "display_title": previous_title,
                                "created_at": "2026-10-05T10:00:00Z",
                                "status": "completed",
                                "conclusion": "success",
                            },
                        ],
                    }
                if path == "actions/runs/500":
                    return {
                        "id": 500,
                        "run_attempt": 1,
                        "display_title": current_title,
                        "event": "workflow_dispatch",
                        "path": ".github/workflows/fanmind-manager-event-dispatch.yml",
                    }
                if path == "actions/runs/499/attempts/1/jobs?per_page=100&page=1":
                    return {
                        "total_count": 1,
                        "jobs": [
                            {
                                "steps": [
                                    {
                                        "name": "Admit prepared handoff",
                                        "conclusion": "success",
                                    },
                                    {
                                        "name": "Transport exactly one admitted handoff",
                                        "status": "completed",
                                        "conclusion": "success",
                                    },
                                ]
                            }
                        ],
                    }
                self.fail(f"unexpected path: {path}")

        for status, conclusion, expected_sends in (
            ("completed", "success", 1),
            ("completed", "failure", 0),
            ("in_progress", None, 0),
        ):
            with self.subTest(status=status, conclusion=conclusion):
                calls = []
                result = MODULE.dispatch_with_github(
                    prepared,
                    previous,
                    ready(),
                    Client(status, conclusion),
                    lambda payload: calls.append(payload) or {"status": 202},
                    requested_task_id=prepared["task_id"],
                    requested_handoff_id=prepared["handoff_id"],
                    requested_previous_task_id=prepared["previous_task_id"],
                    requested_payload_sha256=prepared["payload_sha256"],
                    current_run_id="500",
                )
                self.assertEqual(expected_sends, result["sent"])
                self.assertEqual(expected_sends, len(calls))
                if expected_sends == 0:
                    self.assertEqual(
                        "required_check_not_success:FanMind CI",
                        result["decision"]["blocker"],
                    )

    def test_pr_must_merge_to_main_and_exact_merge_must_be_reachable(self):
        wrong_base = truth()
        wrong_base["previous_pr"]["base"] = "release"
        unreachable = truth()
        unreachable["source_merge_reachable"] = False
        self.assertEqual(
            "github_pr_evidence_mismatch:base",
            self.decision(github_truth=wrong_base)["blocker"],
        )
        self.assertEqual(
            "source_merge_not_reachable_from_main",
            self.decision(github_truth=unreachable)["blocker"],
        )

    def test_receipt_cannot_shrink_task_required_checks(self):
        candidate = receipt()
        candidate["source_acceptance"]["required_checks"] = ["FanMind CI"]
        self.assertEqual(
            "receipt_required_checks_mismatch_task_contract",
            self.decision(receipt=candidate)["blocker"],
        )

    def test_runtime_requirement_is_bound_to_task_and_actual_release(self):
        prepared = handoff()  # New task B is source-only.
        accepted = previous_handoff()  # Previous task A required runtime.
        accepted["required_checks"] = ["Previous Source Workflow"]
        accepted["runtime_requirement"] = {
            "required": True,
            "evidence_kind": MODULE.RUNTIME_CLI_EVIDENCE_KIND,
            "command": MODULE.RUNTIME_CLI_COMMAND,
            "release_binding": "source_merge",
        }
        accepted_contract = {
            "goal": accepted["goal"],
            "scope": accepted["scope"],
            "acceptance": accepted["acceptance"],
            "required_checks": accepted["required_checks"],
            "runtime_requirement": accepted["runtime_requirement"],
        }
        accepted["catalog_contract_sha256"] = hashlib.sha256(
            json.dumps(
                accepted_contract, sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
        accepted["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(accepted)
        )
        candidate = receipt_for_handoff(accepted)
        candidate["runtime_evidence"] = {
            "required": True,
            "status": "VERIFIED",
            "evidence_kind": MODULE.RUNTIME_CLI_EVIDENCE_KIND,
            "command": MODULE.RUNTIME_CLI_COMMAND,
            "source_merge_sha": "a" * 40,
            "local_head_sha": "a" * 40,
            "task_id": accepted["task_id"],
            "handoff_id": accepted["handoff_id"],
            "payload_sha256": candidate["payload_sha256"],
            "log_sha256": "9" * 64,
            "checked_at": "2026-10-05T12:00:00Z",
        }
        observed = truth()
        observed["workflow_checks"] = {"Previous Source Workflow": "success"}
        self.assertEqual(
            "SEND",
            self.decision(
                handoff=prepared, receipt=candidate, github_truth=observed
            )["decision"],
        )

        workflow_substitute = handoff()
        workflow_substitute["runtime_requirement"] = {
            "required": True,
            "allowed_workflow": "FanMind God Mode Gate",
            "release_binding": "source_merge",
        }
        result = MODULE.dispatch_if_admitted(
            self.decision(handoff=workflow_substitute),
            lambda _payload: self.fail("ordinary workflow evidence must not send"),
        )
        self.assertEqual(0, result["sent"])
        self.assertEqual(
            "unsupported:handoff.runtime_requirement.evidence_kind",
            result["decision"]["blocker"],
        )

        candidate["runtime_evidence"] = {"required": True, "status": "NOT_RUN"}
        self.assertEqual(
            "required_runtime_evidence_not_verified",
            self.decision(
                handoff=prepared, receipt=candidate, github_truth=observed
            )["blocker"],
        )
        candidate["runtime_evidence"] = {
            "required": True,
            "status": "VERIFIED",
            "evidence_kind": MODULE.RUNTIME_CLI_EVIDENCE_KIND,
            "command": MODULE.RUNTIME_CLI_COMMAND,
            "source_merge_sha": "a" * 40,
            "local_head_sha": "a" * 40,
            "task_id": accepted["task_id"],
            "handoff_id": accepted["handoff_id"],
            "payload_sha256": candidate["payload_sha256"],
            "checked_at": "2026-10-05T12:00:00Z",
        }
        self.assertEqual(
            "runtime_cli_evidence_log_digest_invalid",
            self.decision(
                handoff=prepared, receipt=candidate, github_truth=observed
            )["blocker"],
        )
        candidate["runtime_evidence"]["log_sha256"] = "9" * 64
        candidate["runtime_evidence"]["source_merge_sha"] = "e" * 40
        self.assertEqual(
            "runtime_cli_evidence_mismatch:source_merge_sha",
            self.decision(
                handoff=prepared, receipt=candidate, github_truth=observed
            )["blocker"],
        )

        current_runtime = handoff()
        current_runtime["runtime_requirement"] = {
            "required": True,
            "evidence_kind": MODULE.RUNTIME_CLI_EVIDENCE_KIND,
            "command": MODULE.RUNTIME_CLI_COMMAND,
            "release_binding": "source_merge",
        }
        current_contract = {
            "goal": current_runtime["goal"],
            "scope": current_runtime["scope"],
            "acceptance": current_runtime["acceptance"],
            "required_checks": current_runtime["required_checks"],
            "runtime_requirement": current_runtime["runtime_requirement"],
        }
        current_runtime["catalog_contract_sha256"] = hashlib.sha256(
            json.dumps(
                current_contract, sort_keys=True, separators=(",", ":")
            ).encode()
        ).hexdigest()
        current_runtime["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(current_runtime)
        )
        current_ready = copy.deepcopy(ready())
        current_ready["task_contract"]["runtime_requirement"] = current_runtime[
            "runtime_requirement"
        ]
        self.assertEqual(
            "SEND",
            self.decision(
                handoff=current_runtime,
                receipt=receipt(),
                github_truth=truth(),
                selector_decision=current_ready,
            )["decision"],
        )

    def test_closeout_binds_current_identity_separately_from_previous_task(self):
        prepared = handoff()
        candidate = current_receipt()
        observed = truth()
        result = MODULE.evaluate_closeout(prepared, candidate, observed)
        self.assertEqual("TERMINAL", result["decision"])
        self.assertEqual("next-task-001", result["task_id"])

        for status in ("COMPLETED", "BLOCKED", "FAILED", "NO_CHANGE"):
            with self.subTest(status=status):
                wrong = current_receipt(status)
                wrong["handoff_id"] = "wrong-handoff"
                self.assertEqual(
                    "receipt_accepted_handoff_identity_mismatch",
                    MODULE.evaluate_closeout(prepared, wrong, observed)["blocker"],
                )
                wrong = current_receipt(status)
                wrong["payload_sha256"] = "0" * 64
                self.assertEqual(
                    "receipt_accepted_handoff_digest_mismatch",
                    MODULE.evaluate_closeout(prepared, wrong, observed)["blocker"],
                )

    def test_owner_direct_requires_existing_identity_and_current_lock_proof(self):
        candidate = handoff()
        candidate.update(
            {
                "source": "OWNER_DIRECT",
                "selection_basis": "EXPLICIT_OWNER_TASK",
                "owner_authorized_at": "2026-10-05T10:59:00Z",
                "non_overlapping_active_locks": ["LOCK-OTHER"],
            }
        )
        candidate.pop("catalog_action_id")
        candidate.pop("roadmap_task")
        candidate.pop("catalog_contract_sha256")
        candidate["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(candidate)
        )
        result = MODULE.dispatch_if_admitted(
            self.decision(
                handoff=candidate,
                owner_binding={
                    "authorized": False,
                    "reason": "owner_active_lock_conflict_or_stale_parallel_proof",
                },
            ),
            lambda _payload: self.fail("conflicting owner task must not send"),
        )
        self.assertEqual(0, result["sent"])
        self.assertEqual(
            "owner_active_lock_conflict_or_stale_parallel_proof",
            result["decision"]["blocker"],
        )

    def test_owner_direct_binding_comes_from_started_work_and_active_locks(self):
        candidate = handoff()
        candidate.update(
            {
                "source": "OWNER_DIRECT",
                "selection_basis": "EXPLICIT_OWNER_TASK",
                "owner_authorized_at": "2026-10-05T10:59:00Z",
                "non_overlapping_active_locks": ["LOCK-OTHER"],
            }
        )
        for key in ("catalog_action_id", "roadmap_task", "catalog_contract_sha256"):
            candidate.pop(key)
        candidate["payload_sha256"] = MODULE.envelope_digest(
            MODULE.canonical_task_envelope(candidate)
        )
        checks = ", ".join(sorted(candidate["required_checks"]))
        runtime = json.dumps(
            candidate["runtime_requirement"], sort_keys=True, separators=(",", ":")
        )
        started = f"""## Owner task
- Orchestrator handoff: {candidate['handoff_id']}
- Orchestrator task_id: {candidate['task_id']}
- Payload digest: {candidate['payload_sha256']}
- Previous task_id: {candidate['previous_task_id']}
- Source: explicit Owner task, not a roadmap-catalog selection.
- Status: IN_PROGRESS
- Work lock: LOCK-OWNER
- Non-overlapping active locks: LOCK-OTHER
- Required checks: {checks}
- Runtime requirement: {runtime}
"""
        locks = f"""## LOCK-OWNER
- Status: ACTIVE
- Holder: FanMind Builder task `{candidate['task_id']}`
- Non-overlapping active locks: LOCK-OTHER
- Required checks: {checks}
- Runtime requirement: {runtime}
## LOCK-OTHER
- Status: ACTIVE
"""
        self.assertTrue(
            MODULE._owner_direct_binding(candidate, started, locks)["authorized"]
        )
        stale = locks + "## LOCK-NEW\n- Status: ACTIVE\n"
        self.assertEqual(
            "owner_active_lock_conflict_or_stale_parallel_proof",
            MODULE._owner_direct_binding(candidate, started, stale)["reason"],
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
        candidate["catalog_action_id"] = "NBA-RELABELLED"
        self.assertEqual(
            "handoff_payload_digest_mismatch", self.decision(handoff=candidate)["blocker"]
        )

    def test_invalid_identity_cannot_disappear_from_run_title_parser(self):
        candidate = handoff()
        candidate["handoff_id"] = "handoff with spaces"
        self.assertEqual("invalid_identity:handoff.handoff_id", self.decision(handoff=candidate)["blocker"])

    def test_missing_or_incomplete_workflow_history_is_fail_closed(self):
        class Client:
            def __init__(self, value):
                self.value = value

            def get(self, _path):
                return self.value

        for value, blocker in (
            ({}, "github_workflow_run_history_unreadable"),
            (
                {"total_count": 2, "workflow_runs": [{"id": 1}]},
                "github_workflow_run_history_incomplete",
            ),
        ):
            with self.subTest(blocker=blocker):
                with self.assertRaisesRegex(MODULE.AdmissionError, blocker):
                    MODULE._complete_workflow_run_history(Client(value))
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
                "non_overlapping_active_locks": [],
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

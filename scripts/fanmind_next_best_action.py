#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PM = ROOT / "project-memory"
STATE_PATH = PM / "FINISHLINE_STATE.json"
CATALOG_PATH = PM / "NEXT_BEST_ACTIONS.json"
DEFERRED_PATH = PM / "DEFERRED_OWNER_ACTIONS.md"
STARTED_WORK_PATH = PM / "STARTED_WORK.md"
WORK_LOCKS_PATH = PM / "WORK_LOCKS.md"
FAILED_ATTEMPTS_PATH = PM / "FAILED_ATTEMPTS.md"
OUTPUT_PATH = PM / "NEXT_BEST_ACTION.md"

ACCEPTED_STATES = {"ACCEPTED", "PRODUCTION_CONFIRMED"}
OWNER_BLOCKING_STATES = {"DEFERRED_BY_OWNER", "OWNER_ACTION_REQUIRED"}
DEFAULT_WORKER_LIMIT = 3
HARD_MAX_WORKER_LIMIT = 5
ACTIVE_WORK_STATES = {
    "IN_PROGRESS",
    "IMPLEMENTED",
    "IMPLEMENTED_NOT_VERIFIED",
    "RECONCILIATION_REQUIRED",
    "CI_WAITING",
    "REVIEW_WAITING",
    "MERGE_READY",
}
PARALLEL_SCOPE_KEYS = (
    "files",
    "directories",
    "modules",
    "contracts",
    "database",
    "apis",
    "project_memory",
    "ci",
    "runtime",
    "provider",
    "environment",
)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def deferred_owner_ids(text: str) -> set[str]:
    ids = set()
    for block in re.split(r"(?m)^## ", text)[1:]:
        title = block.splitlines()[0].strip()
        action_id = title.split(" — ", 1)[0].strip()
        status = re.search(r"(?m)^- Status:\s*([A-Z_]+)\.?\s*$", block)
        if status and status.group(1) == "DEFERRED_BY_OWNER":
            ids.add(action_id)
    return ids


def active_task_ids(started_text: str, locks_text: str) -> set[str]:
    tasks: set[str] = set()

    for block in re.split(r"(?m)^## ", started_text)[1:]:
        lines = block.splitlines()
        heading = lines[0].strip()
        status = re.search(r"(?m)^- Status:\s*([A-Z_]+)\.?\s*$", block)
        if not status or status.group(1) not in ACTIVE_WORK_STATES:
            continue
        task_line = re.search(r"(?m)^- Task:\s*(.+?)\s*$", block)
        if task_line:
            tasks.update(re.findall(r"FM-[A-Z0-9_-]+", task_line.group(1)))
        tasks.update(re.findall(r"FM-[A-Z0-9_-]+", heading))

    for block in re.split(r"(?m)^## ", locks_text)[1:]:
        status = re.search(r"(?m)^- Status:\s*([A-Z_]+)\.?\s*$", block)
        if not status or status.group(1) not in {"ACTIVE", "IN_PROGRESS"}:
            continue
        task_line = re.search(r"(?m)^- Task:\s*(.+?)\s*$", block)
        if task_line:
            tasks.update(re.findall(r"FM-[A-Z0-9_-]+", task_line.group(1)))

    return tasks


def gate_state(state: dict, gate: str) -> str:
    entry = state.get("gates", {}).get(gate)
    return str(entry.get("state")) if isinstance(entry, dict) else "UNKNOWN"


def _action_index(catalog: dict) -> dict[str, dict]:
    return {action["id"]: action for action in catalog.get("actions", [])}


def persisted_failed_action_ids(text: str, catalog: dict, state: dict | None = None) -> set[str]:
    """Load durable worker/action failures from existing canonical state.

    Only explicit FAILED state participates. Historical BLOCKED or recorded failures do
    not become permanent manager failures unless Project Memory marks the action/task
    itself FAILED.
    """
    ids: set[str] = set()
    by_id = _action_index(catalog)
    if state is not None:
        ids.update(
            action["id"]
            for action in catalog.get("actions", [])
            if gate_state(state, action["gate"]) == "FAILED"
        )
    for block in re.split(r"(?m)^## ", text)[1:]:
        status = re.search(r"(?m)^- Status:\s*([A-Z_]+)\.?\s*$", block)
        if not status or status.group(1) != "FAILED":
            continue
        action = re.search(r"(?m)^- Action:\s*`?([A-Z0-9_-]+)`?\s*$", block)
        if action:
            if action.group(1) in by_id:
                ids.add(action.group(1))
            continue
        task_line = re.search(r"(?m)^- Task:\s*(.+?)\s*$", block)
        if task_line:
            task_ids = set(re.findall(r"FM-[A-Z0-9_-]+", task_line.group(1)))
            ids.update(
                item["id"]
                for item in catalog.get("actions", [])
                if item.get("task") in task_ids
            )
    return ids


def prerequisites_satisfied(action: dict, state: dict) -> tuple[bool, list[str]]:
    missing = []
    for gate in action.get("prerequisite_gates", []):
        current = gate_state(state, gate)
        if current not in ACCEPTED_STATES:
            missing.append(f"{gate}={current}")
    return not missing, missing


def action_complete(action: dict, state: dict) -> bool:
    return gate_state(state, action["gate"]) in set(action.get("done_states", []))


def classify(
    action: dict,
    state: dict,
    deferred: set[str],
    *,
    failed_action_ids: set[str] | None = None,
) -> tuple[str, str]:
    if action_complete(action, state):
        return "DONE", f"gate {action['gate']} is {gate_state(state, action['gate'])}"
    if action["id"] in (failed_action_ids or set()):
        return "FAILED_DO_NOT_RESTART", "failed_do_not_restart"
    prereq_ok, missing = prerequisites_satisfied(action, state)
    if not prereq_ok:
        return "WAITING_PREREQUISITE", ", ".join(missing)
    deferred_id = action.get("deferred_owner_id")
    if deferred_id and deferred_id in deferred:
        return "DEFERRED_BY_OWNER", deferred_id
    if action.get("requires_owner") is True:
        return "OWNER_ACTION_REQUIRED", "owner/platform action required"
    return "EXECUTABLE", "standing-authorized safe work"


def classified_actions(
    state: dict,
    catalog: dict,
    deferred: set[str],
    *,
    failed_action_ids: set[str] | None = None,
):
    ordered = sorted(catalog["actions"], key=lambda x: (x["priority"], x["id"]))
    return [
        (
            action,
            *classify(
                action,
                state,
                deferred,
                failed_action_ids=failed_action_ids,
            ),
        )
        for action in ordered
    ]


def owner_priority_floor(classified) -> int | None:
    for action, status, _ in classified:
        if status in OWNER_BLOCKING_STATES:
            return action["priority"]
    return None


def executable_candidates(
    state: dict,
    catalog: dict,
    deferred: set[str],
    *,
    failed_action_ids: set[str] | None = None,
):
    classified = classified_actions(
        state,
        catalog,
        deferred,
        failed_action_ids=failed_action_ids,
    )
    owner_floor = owner_priority_floor(classified)
    candidates = []
    for action, status, reason in classified:
        if status != "EXECUTABLE":
            continue
        if (
            owner_floor is not None
            and action["priority"] > owner_floor
            and action.get("parallel_safe") is not True
        ):
            continue
        candidates.append((action, reason))
    return candidates, classified


def select(
    state: dict,
    catalog: dict,
    deferred: set[str],
    *,
    failed_action_ids: set[str] | None = None,
):
    failed = failed_action_ids or set()
    candidates, classified = executable_candidates(
        state,
        catalog,
        deferred,
        failed_action_ids=failed,
    )
    for action, _ in candidates:
        dep_ok, _ = manager_dependency_status(action, state, catalog, failed)
        if dep_ok:
            return action, [(a, s, r) for a, s, r in classified]
    for action, status, _ in classified:
        if status in OWNER_BLOCKING_STATES:
            return action, [(a, s, r) for a, s, r in classified]
    return None, [(a, s, r) for a, s, r in classified]


def resolve_worker_limit(requested: int | None = None) -> int:
    if requested is None:
        return DEFAULT_WORKER_LIMIT
    if isinstance(requested, bool) or not isinstance(requested, int):
        raise ValueError("worker_limit_must_be_integer")
    if requested < 1:
        raise ValueError("worker_limit_below_one")
    if requested > HARD_MAX_WORKER_LIMIT:
        raise ValueError("worker_limit_exceeds_hard_max")
    return requested


def _scope_values(action: dict, key: str) -> tuple[str, ...] | None:
    scope = action.get("parallel_scope")
    if not isinstance(scope, dict):
        return None
    value = scope.get(key)
    if not isinstance(value, list) or any(not isinstance(item, str) or not item for item in value):
        return None
    return tuple(value)


def scope_is_complete(action: dict) -> bool:
    return all(_scope_values(action, key) is not None for key in PARALLEL_SCOPE_KEYS)


def _path_overlap(left: str, right: str) -> bool:
    a = left.rstrip("/")
    b = right.rstrip("/")
    return a == b or a.startswith(b + "/") or b.startswith(a + "/")


def scope_conflicts(left: dict, right: dict) -> list[str]:
    if left.get("task") == right.get("task"):
        return ["same_task"]

    if not scope_is_complete(left) or not scope_is_complete(right):
        return ["scope_unknown"]

    reasons: list[str] = []
    for key in PARALLEL_SCOPE_KEYS:
        left_values = _scope_values(left, key) or ()
        right_values = _scope_values(right, key) or ()
        if key in {"files", "directories", "project_memory", "ci"}:
            if any(_path_overlap(a, b) for a in left_values for b in right_values):
                reasons.append(f"{key}_overlap")
        elif set(left_values) & set(right_values):
            reasons.append(f"{key}_overlap")

    left_files = _scope_values(left, "files") or ()
    left_directories = _scope_values(left, "directories") or ()
    right_files = _scope_values(right, "files") or ()
    right_directories = _scope_values(right, "directories") or ()
    if any(_path_overlap(path, directory) for path in left_files for directory in right_directories) or any(
        _path_overlap(path, directory) for path in right_files for directory in left_directories
    ):
        reasons.append("file_directory_overlap")
    return reasons


def manager_dependency_status(
    action: dict,
    state: dict,
    catalog: dict,
    failed_action_ids: set[str],
) -> tuple[bool, str]:
    by_id = _action_index(catalog)
    for dep_id in action.get("depends_on_actions", []):
        if dep_id in failed_action_ids:
            return False, f"dependency_failed:{dep_id}"
        dep = by_id.get(dep_id)
        if dep is None:
            return False, f"dependency_unknown:{dep_id}"
        if not action_complete(dep, state):
            return False, f"dependency_not_verified:{dep_id}"
    return True, "dependencies_satisfied"


def build_safe_ready_set(
    state: dict,
    catalog: dict,
    deferred: set[str],
    *,
    requested_limit: int | None = None,
    failed_action_ids: set[str] | None = None,
    active_tasks: set[str] | None = None,
) -> dict:
    limit = resolve_worker_limit(requested_limit)
    failed = failed_action_ids or set()
    active = active_tasks or set()
    candidates, classified = executable_candidates(
        state,
        catalog,
        deferred,
        failed_action_ids=failed,
    )
    candidates = sorted(
        candidates,
        key=lambda candidate: (
            0 if candidate[0].get("task") in active else 1,
            candidate[0]["priority"],
            candidate[0]["id"],
        ),
    )

    selected: list[dict] = []
    serialized: list[dict] = [
        {"id": action["id"], "reason": "failed_do_not_restart"}
        for action, status, _ in classified
        if status == "FAILED_DO_NOT_RESTART"
    ]
    blocked_dependencies: list[dict] = []

    for action, _ in candidates:
        dep_ok, dep_reason = manager_dependency_status(action, state, catalog, failed)
        if not dep_ok:
            blocked_dependencies.append({"id": action["id"], "reason": dep_reason})
            continue

        if len(selected) >= limit:
            serialized.append({"id": action["id"], "reason": "worker_limit"})
            continue

        if not selected:
            selected.append(action)
            continue

        if action.get("parallel_safe") is not True:
            serialized.append({"id": action["id"], "reason": "parallel_safe_not_true"})
            continue

        conflicts: list[str] = []
        for running in selected:
            if running.get("parallel_safe") is not True:
                conflicts.append(f"{running['id']}:parallel_safe_not_true")
                continue
            pair = scope_conflicts(running, action)
            conflicts.extend(f"{running['id']}:{reason}" for reason in pair)

        if conflicts:
            serialized.append({"id": action["id"], "reason": ",".join(sorted(set(conflicts)))})
            continue

        selected.append(action)

    return {
        "worker_limit": limit,
        "hard_max_worker_limit": HARD_MAX_WORKER_LIMIT,
        "safe_ready_set": [action["id"] for action in selected],
        "worker_used": len(selected),
        "active_continuations": [
            action["id"] for action in selected if action.get("task") in active
        ],
        "serialized_due_to_conflict": serialized,
        "blocked_dependencies": blocked_dependencies,
    }


def select_from_manager(
    state: dict,
    catalog: dict,
    deferred: set[str],
    manager: dict,
    *,
    failed_action_ids: set[str] | None = None,
):
    classified = classified_actions(
        state,
        catalog,
        deferred,
        failed_action_ids=failed_action_ids,
    )
    by_id = _action_index(catalog)
    ready = manager.get("safe_ready_set", [])
    if ready:
        selected = by_id.get(ready[0])
        if selected is None:
            raise ValueError(f"manager_selected_unknown_action:{ready[0]}")
        return selected, classified
    for action, status, _ in classified:
        if status in OWNER_BLOCKING_STATES:
            return action, classified
    return None, classified


def _synthetic_state(action_ids: list[str], *, accepted: set[str] | None = None) -> dict:
    accepted_ids = accepted or set()
    gates = {
        "memory_v6": {"state": "ACCEPTED"},
        "staging": {"state": "ACCEPTED"},
    }
    for action_id in action_ids:
        gates[f"gate_{action_id}"] = {
            "state": "ACCEPTED" if action_id in accepted_ids else "IN_PROGRESS"
        }
    return {"sales_ready": False, "phase8_started": False, "gates": gates}


def _scope(tag: str, **overrides) -> dict:
    result = {key: [f"{key}/{tag}"] for key in PARALLEL_SCOPE_KEYS}
    result.update(overrides)
    return result


def _action(
    action_id: str,
    priority: int,
    *,
    task: str | None = None,
    parallel_safe: bool = True,
    requires_owner: bool = False,
    depends_on_actions: list[str] | None = None,
    scope: dict | None = None,
) -> dict:
    return {
        "id": action_id,
        "priority": priority,
        "task": task or f"TASK-{action_id}",
        "gate": f"gate_{action_id}",
        "title": action_id,
        "requires_owner": requires_owner,
        "parallel_safe": parallel_safe,
        "prerequisite_gates": ["memory_v6", "staging"],
        "done_states": ["ACCEPTED", "VERIFIED", "PRODUCTION_CONFIRMED"],
        "instruction": action_id,
        "depends_on_actions": depends_on_actions or [],
        "parallel_scope": scope if scope is not None else _scope(action_id),
    }


def run_manager_contract_tests() -> None:
    def manager(
        actions,
        *,
        accepted=None,
        failed=None,
        limit=None,
        deferred=None,
        active=None,
    ):
        catalog = {"actions": actions}
        state = _synthetic_state([a["id"] for a in actions], accepted=accepted)
        return build_safe_ready_set(
            state,
            catalog,
            deferred or set(),
            requested_limit=limit,
            failed_action_ids=failed or set(),
            active_tasks=active or set(),
        )

    # A) 3 independent tasks -> all parallel.
    a, b, c = (_action("A", 1), _action("B", 2), _action("C", 3))
    assert manager([a, b, c])["safe_ready_set"] == ["A", "B", "C"]

    # B) 4 independent tasks -> only 3 active.
    d = _action("D", 4)
    result = manager([a, b, c, d])
    assert result["safe_ready_set"] == ["A", "B", "C"]
    assert result["serialized_due_to_conflict"] == [{"id": "D", "reason": "worker_limit"}]

    # C) same file -> serialize.
    same_file = "src/shared.ts"
    a1 = _action("A1", 1, scope=_scope("A1", files=[same_file]))
    b1 = _action("B1", 2, scope=_scope("B1", files=[same_file]))
    result = manager([a1, b1])
    assert result["safe_ready_set"] == ["A1"]
    assert "files_overlap" in result["serialized_due_to_conflict"][0]["reason"]

    # C2) a file owned by another task's directory scope -> serialize.
    a_dir = _action("A-DIR", 1, scope=_scope("A-DIR", files=["src/pkg/a.py"]))
    b_dir = _action("B-DIR", 2, scope=_scope("B-DIR", directories=["src/pkg"]))
    result = manager([a_dir, b_dir])
    assert result["safe_ready_set"] == ["A-DIR"]
    assert "file_directory_overlap" in result["serialized_due_to_conflict"][0]["reason"]

    # D) different files but same contract/module -> serialize.
    a2 = _action(
        "A2",
        1,
        scope=_scope("A2", files=["src/a.ts"], contracts=["FM-CONTRACT-X"]),
    )
    b2 = _action(
        "B2",
        2,
        scope=_scope("B2", files=["src/b.ts"], contracts=["FM-CONTRACT-X"]),
    )
    result = manager([a2, b2])
    assert result["safe_ready_set"] == ["A2"]
    assert "contracts_overlap" in result["serialized_due_to_conflict"][0]["reason"]

    # E) B depends on A -> B only after A is verified/accepted.
    dep_a = _action("DEP-A", 1)
    dep_b = _action("DEP-B", 2, depends_on_actions=["DEP-A"])
    result = manager([dep_a, dep_b])
    assert result["safe_ready_set"] == ["DEP-A"]
    assert result["blocked_dependencies"] == [
        {"id": "DEP-B", "reason": "dependency_not_verified:DEP-A"}
    ]
    result = manager([dep_a, dep_b], accepted={"DEP-A"})
    assert result["safe_ready_set"] == ["DEP-B"]

    # E2) primary selection must obey the same dependency gate.
    primary_dep = _action("PRIMARY-DEP", 1, depends_on_actions=["PRIMARY-BASE"])
    primary_base = _action("PRIMARY-BASE", 2)
    primary_catalog = {"actions": [primary_dep, primary_base]}
    primary_state = _synthetic_state(["PRIMARY-DEP", "PRIMARY-BASE"])
    primary_selected, _ = select(primary_state, primary_catalog, set())
    assert primary_selected is not None and primary_selected["id"] == "PRIMARY-BASE"

    # F) failed A keeps dependent B blocked and is not restarted.
    fail_a = _action("FAIL-A", 1)
    fail_b = _action("FAIL-B", 2, depends_on_actions=["FAIL-A"])
    result = manager([fail_a, fail_b], failed={"FAIL-A"})
    assert result["safe_ready_set"] == []
    assert {"id": "FAIL-A", "reason": "failed_do_not_restart"} in result["serialized_due_to_conflict"]
    assert result["blocked_dependencies"] == [
        {"id": "FAIL-B", "reason": "dependency_failed:FAIL-A"}
    ]

    # F2) FAILED state is durably loaded from canonical state/failed-attempt ledger.
    failure_catalog = {"actions": [fail_a, fail_b]}
    failure_text = """## FM-FAIL-WORKER\n- Status: FAILED\n- Action: `FAIL-A`\n"""
    assert persisted_failed_action_ids(failure_text, failure_catalog) == {"FAIL-A"}
    failure_state = _synthetic_state(["FAIL-A", "FAIL-B"])
    failure_state["gates"]["gate_FAIL-A"]["state"] = "FAILED"
    assert persisted_failed_action_ids("", failure_catalog, failure_state) == {"FAIL-A"}

    # F3) an explicit failed action never expands to every action sharing its task.
    exact_a = _action("FAIL-EXACT-A", 1, task="FM-FAIL-EXACT")
    exact_b = _action("FAIL-EXACT-B", 2, task="FM-FAIL-EXACT")
    exact_catalog = {"actions": [exact_a, exact_b]}
    exact_failure_text = """## FM-FAIL-EXACT\n- Status: FAILED\n- Action: `FAIL-EXACT-A`\n- Task: `FM-FAIL-EXACT`\n"""
    assert persisted_failed_action_ids(exact_failure_text, exact_catalog) == {"FAIL-EXACT-A"}

    # F4) durable failures are classified as non-executable, not merely filtered later.
    failed_classified = classified_actions(
        _synthetic_state(["FAIL-EXACT-A", "FAIL-EXACT-B"]),
        exact_catalog,
        set(),
        failed_action_ids={"FAIL-EXACT-A"},
    )
    failed_status = {action["id"]: status for action, status, _ in failed_classified}
    assert failed_status["FAIL-EXACT-A"] == "FAILED_DO_NOT_RESTART"
    assert failed_status["FAIL-EXACT-B"] == "EXECUTABLE"

    # G) failed A does not block independent C.
    independent = _action("INDEPENDENT-C", 3)
    result = manager([fail_a, fail_b, independent], failed={"FAIL-A"})
    assert result["safe_ready_set"] == ["INDEPENDENT-C"]

    # H) owner/protected task remains gated.
    owner = _action("OWNER", 1, requires_owner=True)
    safe = _action("SAFE", 2)
    result = manager([owner, safe])
    assert result["safe_ready_set"] == ["SAFE"]

    # I) accepted/verified/deferred work is not restarted.
    done = _action("DONE", 1)
    deferred_action = _action("DEFERRED", 2)
    deferred_action["deferred_owner_id"] = "OWNER-DEFERRED"
    live = _action("LIVE", 3)
    catalog = {"actions": [done, deferred_action, live]}
    state = _synthetic_state(["DONE", "DEFERRED", "LIVE"], accepted={"DONE"})
    result = build_safe_ready_set(
        state, catalog, {"OWNER-DEFERRED"}, requested_limit=DEFAULT_WORKER_LIMIT
    )
    assert result["safe_ready_set"] == ["LIVE"]

    # J) default is 3; configuration may increase only through 5.
    assert resolve_worker_limit() == 3
    assert resolve_worker_limit(5) == 5
    try:
        resolve_worker_limit(6)
    except ValueError as exc:
        assert str(exc) == "worker_limit_exceeds_hard_max"
    else:
        raise AssertionError("worker limit above 5 must fail closed")

    # J2) rendering uses the same requested limit as manager execution/checking.
    render_catalog = {"actions": [a, b]}
    render_state = _synthetic_state(["A", "B"])
    rendered = render(render_state, render_catalog, set(), requested_limit=1)
    assert "- Effective worker limit: `1`" in rendered
    assert "- SAFE READY SET: `A`" in rendered
    assert "`B` (worker_limit)" in rendered

    # K) one safe task -> one worker, no artificial utilization.
    only = _action("ONLY", 1)
    result = manager([only])
    assert result["safe_ready_set"] == ["ONLY"]
    assert result["worker_used"] == 1

    # K2) already-active continuations reserve capacity before new work.
    active_d = _action("ACTIVE-D", 4, task="TASK-ACTIVE")
    result = manager([a, b, c, active_d], active={"TASK-ACTIVE"})
    assert result["safe_ready_set"] == ["ACTIVE-D", "A", "B"]
    assert result["active_continuations"] == ["ACTIVE-D"]
    assert {"id": "C", "reason": "worker_limit"} in result["serialized_due_to_conflict"]

    # K2b) the primary action is the first managed READY item, never a parallel selector fork.
    active_catalog = {"actions": [a, active_d]}
    active_state = _synthetic_state(["A", "ACTIVE-D"])
    active_manager = build_safe_ready_set(
        active_state,
        active_catalog,
        set(),
        requested_limit=1,
        active_tasks={"TASK-ACTIVE"},
    )
    active_primary, _ = select_from_manager(
        active_state,
        active_catalog,
        set(),
        active_manager,
    )
    assert active_manager["safe_ready_set"] == ["ACTIVE-D"]
    assert active_primary is not None and active_primary["id"] == "ACTIVE-D"

    # K3) descriptive/composite canonical entries identify every active task.
    active_started = """## FM-CREATOR-001 — crash-safe account deletion Workspace inventory\n- Status: IN_PROGRESS\n"""
    assert active_task_ids(active_started, "") == {"FM-CREATOR-001"}
    composite_started = """## FM-AI-001 / FM-RST-001 — shared active continuation\n- Status: IN_PROGRESS\n- Task: `FM-AI-001 / FM-RST-001`\n"""
    assert active_task_ids(composite_started, "") == {"FM-AI-001", "FM-RST-001"}

    # L) free slot is reused after predecessor reaches accepted state.
    steal_a = _action("STEAL-A", 1)
    steal_b = _action("STEAL-B", 2)
    result = manager([steal_a, steal_b], limit=1)
    assert result["safe_ready_set"] == ["STEAL-A"]
    result = manager([steal_a, steal_b], accepted={"STEAL-A"}, limit=1)
    assert result["safe_ready_set"] == ["STEAL-B"]

    # Unknown overlap is never treated as parallel-safe evidence.
    unknown_a = _action("UNKNOWN-A", 1)
    unknown_b = _action("UNKNOWN-B", 2)
    unknown_a.pop("parallel_scope", None)
    result = manager([unknown_a, unknown_b])
    assert result["safe_ready_set"] == ["UNKNOWN-A"]
    assert "scope_unknown" in result["serialized_due_to_conflict"][0]["reason"]


def render(
    state: dict,
    catalog: dict,
    deferred: set[str],
    *,
    active_tasks: set[str] | None = None,
    requested_limit: int | None = None,
    failed_action_ids: set[str] | None = None,
) -> str:
    manager = build_safe_ready_set(
        state,
        catalog,
        deferred,
        requested_limit=requested_limit,
        failed_action_ids=failed_action_ids,
        active_tasks=active_tasks,
    )
    selected, classified = select_from_manager(
        state,
        catalog,
        deferred,
        manager,
        failed_action_ids=failed_action_ids,
    )
    lines = [
        "# FanMind Next Best Action",
        "",
        "Generated from `FINISHLINE_STATE.json`, `NEXT_BEST_ACTIONS.json` and `DEFERRED_OWNER_ACTIONS.md`.",
        "",
        f"- Sales ready: `{str(bool(state.get('sales_ready'))).lower()}`",
        f"- Phase 8 started: `{str(bool(state.get('phase8_started'))).lower()}`",
    ]
    if selected is None:
        lines += ["- Selected action: `NONE`", "", "No unresolved action is currently selectable."]
    else:
        status, reason = classify(
            selected,
            state,
            deferred,
            failed_action_ids=failed_action_ids,
        )
        lines += [
            f"- Selected action: `{selected['id']}`",
            f"- Task: `{selected['task']}`",
            f"- Gate: `{selected['gate']}` (`{gate_state(state, selected['gate'])}`)",
            f"- Selection status: `{status}`",
            f"- Title: {selected['title']}",
            "",
            "## Instruction",
            "",
            selected["instruction"],
            "",
            "## Why this action",
            "",
            reason,
        ]

    lines += ["", "## Builder manager", ""]
    lines += [
        f"- Default worker limit: `{DEFAULT_WORKER_LIMIT}`",
        f"- Effective worker limit: `{manager['worker_limit']}`",
        f"- Hard maximum worker limit: `{HARD_MAX_WORKER_LIMIT}`",
        "- SAFE READY SET: "
        + (
            ", ".join(f"`{item}`" for item in manager["safe_ready_set"])
            if manager["safe_ready_set"]
            else "`NONE`"
        ),
        f"- Worker slots used by safe ready set: `{manager['worker_used']}`",
        "- Active task continuations in safe ready set: "
        + (
            ", ".join(f"`{item}`" for item in manager["active_continuations"])
            if manager["active_continuations"]
            else "`NONE`"
        ),
        "- Serialized due to conflict/limit: "
        + (
            "; ".join(f"`{item['id']}` ({item['reason']})" for item in manager["serialized_due_to_conflict"])
            if manager["serialized_due_to_conflict"]
            else "`NONE`"
        ),
        "- Blocked by action dependencies: "
        + (
            "; ".join(f"`{item['id']}` ({item['reason']})" for item in manager["blocked_dependencies"])
            if manager["blocked_dependencies"]
            else "`NONE`"
        ),
        "- Parallel execution is fail-closed: a second concurrent action requires `parallel_safe=true` plus complete non-overlapping scope metadata; missing/unknown scope serializes.",
        "- The manager reuses the existing action catalog and task/gate state; it does not create a second TODO/orchestration system.",
    ]

    lines += ["", "## Candidate evaluation", ""]
    for action, status, reason in classified:
        lines.append(
            f"- `{action['id']}` priority {action['priority']}: **{status}** — {reason}"
        )

    lines += [
        "",
        "## Selection safety rules",
        "",
        "- A `DEFERRED_BY_OWNER` action remains open but is skipped for current assistant execution.",
        "- Skipping a deferred action never marks its gate accepted or lowers its priority permanently.",
        "- If an earlier unresolved action is owner-required/deferred, only later `parallel_safe=true` actions may be selected.",
        "- The Builder Manager may use at most 3 workers by default; later configuration may never exceed 5.",
        "- Same task/file/directory/module/contract/database/API/Project-Memory/CI/runtime/provider/environment scope is serialized.",
        "- Action dependencies must be verified before dependents enter the safe ready set; an independent task may continue if another worker fails.",
        "- Provider, payment, destructive, legal and protected Production boundaries still require their existing approvals.",
        "- Phase 8 remains outside the current finishline.",
        "",
    ]
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--manager-check", action="store_true")
    parser.add_argument("--worker-limit", type=int)
    args = parser.parse_args()

    if args.manager_check:
        try:
            run_manager_contract_tests()
        except (AssertionError, ValueError) as exc:
            print(f"FANMIND_BUILDER_MANAGER_RESULT=failed:{exc}")
            return 1
        print("FANMIND_BUILDER_MANAGER_RESULT=passed")
        return 0

    state = load_json(STATE_PATH)
    catalog = load_json(CATALOG_PATH)
    deferred_text = DEFERRED_PATH.read_text(encoding="utf-8") if DEFERRED_PATH.exists() else ""
    deferred = deferred_owner_ids(deferred_text)
    started_text = STARTED_WORK_PATH.read_text(encoding="utf-8") if STARTED_WORK_PATH.exists() else ""
    locks_text = WORK_LOCKS_PATH.read_text(encoding="utf-8") if WORK_LOCKS_PATH.exists() else ""
    failed_text = FAILED_ATTEMPTS_PATH.read_text(encoding="utf-8") if FAILED_ATTEMPTS_PATH.exists() else ""
    active_tasks = active_task_ids(started_text, locks_text)
    failed_action_ids = persisted_failed_action_ids(failed_text, catalog, state)

    try:
        manager = build_safe_ready_set(
            state,
            catalog,
            deferred,
            requested_limit=args.worker_limit,
            failed_action_ids=failed_action_ids,
            active_tasks=active_tasks,
        )
    except ValueError as exc:
        print(f"FANMIND_BUILDER_MANAGER_RESULT=failed:{exc}")
        return 1

    selected, _ = select_from_manager(
        state,
        catalog,
        deferred,
        manager,
        failed_action_ids=failed_action_ids,
    )
    if selected:
        status, _ = classify(
            selected,
            state,
            deferred,
            failed_action_ids=failed_action_ids,
        )
        print(f"FANMIND_NEXT_ACTION={selected['id']}")
        print(f"FANMIND_NEXT_ACTION_STATUS={status}")
        print(f"FANMIND_NEXT_ACTION_TASK={selected['task']}")
    else:
        print("FANMIND_NEXT_ACTION=NONE")
        print("FANMIND_NEXT_ACTION_STATUS=NONE")

    print("FANMIND_SAFE_READY_SET=" + json.dumps(manager["safe_ready_set"], separators=(",", ":")))
    print(f"FANMIND_WORKER_LIMIT={manager['worker_limit']}")
    print(f"FANMIND_WORKER_USED={manager['worker_used']}")
    print(
        "FANMIND_SERIALIZED_DUE_TO_CONFLICT="
        + json.dumps(manager["serialized_due_to_conflict"], separators=(",", ":"))
    )
    print(
        "FANMIND_BLOCKED_ACTION_DEPENDENCIES="
        + json.dumps(manager["blocked_dependencies"], separators=(",", ":"))
    )

    rendered = render(
        state,
        catalog,
        deferred,
        active_tasks=active_tasks,
        requested_limit=args.worker_limit,
        failed_action_ids=failed_action_ids,
    )
    if args.write:
        OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    if args.check:
        current = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.exists() else ""
        if current != rendered:
            print("FANMIND_NEXT_ACTION_RESULT=stale")
            return 1
    print("FANMIND_NEXT_ACTION_RESULT=passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
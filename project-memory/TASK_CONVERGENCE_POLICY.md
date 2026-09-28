# Task Convergence Policy v1

Mandatory for every substantive FanMind Builder, Supervisor, Navigator and Manager task.

## Purpose
FanMind tasks must converge. A running task may not expand indefinitely because new improvements, adjacent defects or optional hardening opportunities are discovered.

## 1. Frozen acceptance contract
Before implementation begins, record a bounded acceptance contract containing:
- task ID and goal;
- explicit in-scope deliverables;
- explicit out-of-scope boundaries;
- measurable acceptance criteria;
- required evidence/quorum;
- applicable protected-action boundaries.

After substantive implementation begins, the acceptance contract is frozen. It may change only when:
1. the Owner explicitly changes the goal; or
2. current evidence proves an original criterion is impossible, unsafe or internally contradictory.

A change under (2) must be recorded as `RECONCILIATION_REQUIRED`; agents may not silently enlarge the scope.

## 2. No scope growth from new findings
A newly discovered item may join the active task only when it is strictly necessary to satisfy an already-frozen acceptance criterion or to prevent a verified regression/security violation caused by the task's own diff.

All other findings are classified and deferred as one of:
- `FOLLOW_UP`
- `TECH_DEBT`
- `BUG_SEPARATE`
- `ENHANCEMENT`

Deferred findings must not block completion of the current task unless they invalidate a frozen acceptance criterion.

## 3. Progress invariant
Every implementation/repair cycle must produce at least one observable delta:
- one acceptance criterion moves closer to PASS;
- failing tests/checks decrease;
- a concrete code/config/document diff is produced;
- a previously unknown blocker is reduced to a specific evidenced cause; or
- required evidence is newly produced.

If two consecutive cycles produce no material delta, set `NO_PROGRESS` and stop repeating the same strategy.

## 4. Repair-attempt limit
For the same failing criterion and materially same root-cause hypothesis:
- maximum three repair attempts;
- attempt 2 must incorporate evidence from attempt 1;
- attempt 3 must use a materially different remediation strategy.

After three failed attempts, do not retry unchanged. Transition to one of:
- `BLOCKED` with exact blocker/evidence and next admissible action;
- `RECONCILIATION_REQUIRED` if the contract/evidence conflicts;
- a separately scoped diagnostic task when diagnosis itself is the missing deliverable.

This rule does not permit bypassing security, data-integrity or protected-environment controls.

## 5. Deterministic completion
A task is DONE when and only when all frozen acceptance criteria and the required quorum are satisfied.

Equivalent logical rule:

```text
DONE =
  acceptance_criteria == 100% PASS
  AND required_tests == PASS
  AND required_countercheck == PASS
  AND unresolved_in_scope_blockers == 0
  AND required_target_evidence == PASS_OR_NOT_APPLICABLE
```

When `DONE=true`, the execution path is:
`STOP -> receipt -> memory update -> release lock -> merge/close as authorized -> next task`.

Do not perform additional exploratory hardening, refactoring, architecture cleanup or unrelated review inside the completed task.

## 6. Supervisor boundary
The Supervisor verifies the frozen contract; it does not redefine it.

Supervisor outcomes for the active task are limited to:
- `PASS`
- `FAIL:<existing criterion>`
- `BLOCKED:<existing dependency/boundary>`
- `RECONCILIATION_REQUIRED`

A Supervisor-discovered improvement outside the frozen contract is recorded as a deferred finding and must not convert a completed task back to IN_PROGRESS.

## 7. Discovery vs delivery
Use two distinct modes:
- `DISCOVERY`: determine scope, risks, acceptance contract and evidence plan.
- `DELIVERY`: implement only the frozen contract, test it, verify it and close it.

Once DELIVERY begins, broad architecture/research expansion is prohibited unless required by an existing criterion or an evidenced safety contradiction.

## 8. Repeated-state guard
Identical or materially equivalent Builder/Supervisor state across two consecutive runs must return `NO_CHANGE` unless new external evidence arrived.

Repeated preflight alone is not progress. Re-reading the same files, rerunning unchanged checks or restating the same blocker must not create new tasks, PRs, receipts or acceptance requirements.

## 9. Protected boundaries remain intact
This policy limits task expansion and repetition. It does not weaken:
- R1-R4 evidence quorum;
- security/governance/supply-chain checks;
- Staging/Production protections;
- owner/platform-only actions;
- rollback/recovery requirements;
- external/provider acceptance rules.

## 10. Required task record
Every active task must expose:
- `acceptance_contract_frozen: true|false`
- `acceptance_criteria_total`
- `acceptance_criteria_passed`
- `repair_attempt: 0..3`
- `last_material_delta`
- `no_progress_cycles: 0..2`
- `deferred_findings`
- `completion_state`

A task that cannot provide these fields may continue only long enough to reconstruct its bounded contract from the Owner goal and existing evidence; it may not invent additional scope while doing so.

# FanMind Workspace Builder

The canonical execution rules are in [Execution Policy](../../project-memory/EXECUTION_POLICY.md). This reader is not a separate policy.

Direct Owner assignments enter the [Execution Policy](../../project-memory/EXECUTION_POLICY.md) directly. For automated dispatch use the [Orchestrator result contract](../../project-memory/ORCHESTRATOR_RESULT_PROTOCOL.md) to return the matching terminal result.

For an approved same-repository PR targeting main with active auto-merge, use `node scripts/orchestration/refresh-automerge-pr.mjs <PR-number> <approved-head-SHA>` when GitHub reports the branch behind. Verify the resulting checks, merge and main on GitHub.

To inspect an open PR before reporting merge readiness, run `node scripts/orchestration/merge-readiness.mjs <PR-number> <current-head-SHA>` with authenticated GitHub CLI access. It reads the active status rules, checks their issuers and prints each result. A successful exit requires twelve successful head checks and a clean GitHub merge state at the time of the read. GitHub enforces the actual merge.

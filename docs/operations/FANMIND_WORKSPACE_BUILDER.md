# FanMind Workspace Builder

The canonical execution rules are in [Execution Policy](../../project-memory/EXECUTION_POLICY.md). This reader is not a separate policy.

Direct Owner assignments enter the [Execution Policy](../../project-memory/EXECUTION_POLICY.md) directly. For automated dispatch use the [Orchestrator result contract](../../project-memory/ORCHESTRATOR_RESULT_PROTOCOL.md) to return the matching terminal result.

For an approved same-repository PR targeting main with active auto-merge, use `node scripts/orchestration/refresh-automerge-pr.mjs <PR-number> <approved-head-SHA>` when GitHub reports the branch behind. Verify the resulting checks, merge and main on GitHub.

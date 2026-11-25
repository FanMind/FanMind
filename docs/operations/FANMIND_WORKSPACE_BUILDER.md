# FanMind Workspace Builder

The canonical execution rules are in [Execution Policy](../../project-memory/EXECUTION_POLICY.md). This reader is not a separate policy.

Direct Owner assignments enter the [Execution Policy](../../project-memory/EXECUTION_POLICY.md) directly. For automated dispatch use the [Orchestrator result contract](../../project-memory/ORCHESTRATOR_RESULT_PROTOCOL.md) to return the matching terminal result.

For an approved same-repository PR targeting main with active auto-merge, use `node scripts/orchestration/refresh-automerge-pr.mjs <PR-number> <approved-head-SHA>` when GitHub reports the branch behind. Verify the resulting checks, merge and main on GitHub.

To inspect an open PR before reporting merge readiness, run `node scripts/orchestration/merge-readiness.mjs <PR-number> <current-head-SHA>` with authenticated GitHub CLI access. It reads the active status rules, checks their issuers and prints each result. A successful exit requires twelve successful head checks and a clean GitHub merge state at the time of the read. GitHub enforces the actual merge.

The [workspace role instructions](FANMIND_WORKSPACE_ROLES.md) contain the common text, role-specific blocks and installation verification for existing agents.

The **Refresh opted-in PR branches** workflow handles pushes to main and the initial auto-merge opt-in. It reads GitHub metadata, reports conflicts per PR and submits at most one exact-head update per eligible PR per run. Its triggers exclude PR synchronization, which is reserved for the normal PR checks. Actual merge still requires native checks on the updated head.

To activate unattended refresh, an administrator must provision the `fanmind-pr-refresh` environment restricted to the protected main branch, then put a dedicated, expiring, fine-grained personal access token for FanMind/FanMind in its `FANMIND_PR_REFRESH_TOKEN` environment secret (pull requests: write, metadata: read, no bypass). Set the repository variable `FANMIND_AUTO_REFRESH_ENABLED=true` last. GitHub documents that PR synchronization with the default workflow token requires a human to approve the resulting runs. The credential must be issued independently of Actions' default token. Confirm the first update produced a pull-request CI run at its new head before treating the automation as commissioned.

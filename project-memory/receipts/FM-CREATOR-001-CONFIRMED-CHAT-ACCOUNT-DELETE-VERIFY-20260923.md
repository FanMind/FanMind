# FM-CREATOR-001 — confirmed-chat account deletion verification — 2026-09-23

- Status: IMPLEMENTED_FOR_PR
- Risk: R4
- Work lock: `LOCK-FM-CREATOR-CONFIRMED-CHAT-ACCOUNT-DELETE-20260923`
- Holder: autonomous FanMind Builder
- Baseline: exact merged `main` `c1b73de9e0b39ccbd585d24ee2409bfd1bb9ead7`; PR #1166 is merged and its contact-deletion half is closed.
- Task / NBA: `FM-CREATOR-001` / `NBA-CREATOR-INTELLIGENCE`.
- Contract / gate: `FM-CONTRACT-DISCLOSURE-DELETE-001` / `FM-IGATE-DISCLOSURE-DELETE-001`.
- Scope: repository-only account-deletion verification for `creator_confirmed_chat_learning`. For every durable `owned_workspace_ids` entry, query the exact Workspace read-only; independently query global `confirmed_by=<deleted user>` to prove anonymization of surviving Workspace evidence. Reuse the source-controlled `preinstall`/`installed` lifecycle and fail closed on residual/malformed/network/authorization/installed-missing-schema evidence.
- Negative boundary: verifier performs no DELETE/PATCH/repair; no foreign Workspace is enumerated; zero owned Workspaces still require the global `confirmed_by` check; duplicate/unknown inventory/state fails closed.
- Recovery: ordinary bounded repository revert. No target data, schema, provider or customer state is mutated by this PR.
- Forbidden in this scope: controlled schema APPLY, Staging/Production APPLY/ACCEPT/write, real account deletion, customer mutation, provider activation, Billing/Stripe/Tax, Restore writes or Mobile work.
- Current evidence: branch `feat/creator-confirmed-chat-account-delete-verify-20260923`; implementation + focused regression tests + deletion inventory reconciliation are committed. Exact-head GitHub CI and exactly one required independent review remain mandatory before merge.
- Falsifier: any surviving row for a persisted deleted Workspace, any surviving `confirmed_by` reference to the deleted user, a repair mutation, a non-read-only query, installed-state schema absence treated as success, cross-tenant enumeration, malformed success, red required CI or open P1/P2 invalidates completion.
- Exact next: publish one bounded PR, consume current-head CI and one independent review, fix findings on that same PR, then merge only under the normal convergence rule. Protected schema rollout remains a separate later owner/environment-gated action.
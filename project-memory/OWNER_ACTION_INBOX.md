# FanMind Owner Action Inbox

This is the single compact queue for actions that genuinely require the owner, an external provider, protected UI access, payment authorization, legal/tax evidence or another capability unavailable to the assistant.

## FM-RST-OWNER-001 — Restore runner-group policy + host readiness
- Status: COMPLETED
- Where: GitHub Organization `FanMind` -> Settings -> Actions -> Runner groups -> `fanmind-restore-drill`
- Result: selected repository/workflow policy, Host-1 and Host-2 were revalidated for protected read-only run `32582640853`; all three jobs succeeded and both one-job runners cleaned up.
- Risk: R4
- Duration class: short
- Evidence: run `32582640853`, jobs `97054217701`/`97054234003`/`97054248185`, runner IDs `41`/`42`, issue #944 and controller cleanup output.
- Revalidation: this mutable evidence expires and must be repeated immediately before the later protected R4 write.

## FM-RST-OWNER-002 — Exact isolated database-Restore authorization
- Status: CONSUMED_FAIL_CLOSED
- Where: workflow run `32594374666` on exact commit `8bc8855a6de928cf38ef2e8fb9e9e0860fc477db`.
- Result: the single authorized dispatch and two fresh JITs were consumed. Host-2 stopped at receipt-bound database authorization preflight before the first target write; independent read-only reconciliation proved the database remains empty and runner/private cleanup is safe.
- Risk: R4
- Evidence: jobs `97082934347`, `97082943319`, `97082992861`; issue #944 comments `5382274967` and `5382336892`.
- Do not repeat: no rerun/retry, JIT reuse or inference that the prior authorization remains available.

## FM-RST-OWNER-003 — Exact isolated extension-baseline provisioning
- Status: COMPLETED
- Where: only `fanmind-restore-01` / PostgreSQL 17.11 / database `fanmind_restore`.
- Result: exact extension-only provisioning committed successfully; full receipt and canonical ACL read-only postchecks passed at 97 records with fingerprints `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` and `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`.
- Evidence: issue #944 comment `5385843508`; final controller PASS output.
- Safety: no database Restore, target reset, JIT/workflow dispatch or Production/Supabase-Staging write. Authorization consumed; do not repeat.

## FM-RST-OWNER-004 — Exact isolated database-Restore authorization after extension closeout
- Status: CONSUMED_PRE_DISPATCH_FAIL_CLOSED
- Where: only the existing isolated `fanmind-restore-01` / PostgreSQL 17.11 / `fanmind_restore` target through the reviewed protected database-Restore workflow.
- Result: authorization comment `5385992305` and controller SHA-256 `45054c41...` were attempted on 2026-08-26. The controller stopped at its first SSH connection to `138.124.213.66:22` after local readiness/main-drift markers. No remote preflight, JIT, protected approval, workflow dispatch, PostgreSQL connection or write occurred.
- Forbidden: no automatic retry or reuse of controller `45054c41...`/authorization `5385992305`; no Production/Supabase-Staging target or write, target reset, reuse of run `32594374666`, runners `43`/`44` or unrelated R4 mutation.
- Risk: R4
- Evidence: issue #944 comments `5385992305`/`5386014235`; exact owner-supplied controller output; controller source order; absence of a later Restore run in current GitHub evidence.

## FM-RST-OWNER-005 — Restore-host SSH reachability evidence
- Status: DEFERRED_BY_OWNER
- Where: the owner's Windows PC and, only if the result proves allowlist drift, Exoscale security group for `fanmind-restore-01`.
- Required first evidence: current public IPv4 plus detailed `Test-NetConnection 138.124.213.66 -Port 22`; do not rerun the Restore controller.
- Possible later action: replace only the stale SSH source `/32` with the observed owner IPv4 after a separate exact infrastructure authorization and read-only target/scope confirmation.
- Forbidden: broad CIDR, `0.0.0.0/0`, unrelated firewall/security-group edits, VM/database changes, Restore/JIT/workflow actions or Production/Supabase-Staging access.
- Risk: R4
- Duration class: short owner-PC diagnostic; provider mutation remains separate.

## FM-RST-OWNER-006 — New exact isolated database-Restore authorization after SSH reconciliation
- Status: DEFERRED_BY_OWNER
- Where: only the existing isolated `fanmind-restore-01` / PostgreSQL 17.11 / `fanmind_restore` target through the reviewed protected database-Restore workflow.
- Resume trigger: SSH reachability and any allowlist drift are reconciled, repository evidence closeout is merged, exact new `main` is known, and all mutable runner/host/target/backup/TLS preflights are fresh.
- Required scope: one new controller and one exact protected database-Restore authorization; never reuse controller `45054c41...` or authorization `5385992305`.
- Risk: R4
- Forbidden: Production/Supabase-Staging target or write, target reset, automatic retry or unrelated R4 mutation.
## FM-GOV-OWNER-001 — Protect `main`
- Status: DEFERRED_BY_OWNER
- Where: GitHub repository/organization Rulesets or Branch Protection UI
- Why: `main` should require PRs/checks and block force-push/delete/direct routine pushes.
- Risk: R3
- Duration class: short
- Resume trigger: owner chooses to complete GitHub governance setup.
- Do not ask before: explicit owner resume.

## Rules
- `DEFERRED_BY_OWNER` means keep visible but do not repeatedly interrupt the owner.
- When an action is completed in another chat/session, reconcile GitHub/Project Memory evidence first, then mark it done here.
- Never infer provider, payment, signing, destructive, legal or protected Production acceptance from code or chat text alone.

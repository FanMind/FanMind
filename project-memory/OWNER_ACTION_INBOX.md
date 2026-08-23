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

## FM-RST-OWNER-004 — New exact isolated database-Restore authorization
- Status: DEFERRED_BY_OWNER
- Where: only the existing isolated `fanmind-restore-01` / PostgreSQL 17.11 / `fanmind_restore` target through the reviewed protected database-Restore workflow.
- Why: the five-extension receipt prerequisite is now satisfied, but the state machine remains at `TARGET_COMPATIBLE`; the database write is a separate R4 transition.
- Exact permitted scope when resumed: one new exact-main-bound database Restore using the accepted Backup/Verification/Source/reset-receipt tuple, fresh mutable policy/host/target/backup/TLS preflight, protected `restore-drill` approval and fresh sequential one-job JITs.
- Forbidden: Production/Supabase-Staging target or write, target reset, reuse of run `32594374666`, reuse of runners `43`/`44`, automatic retry or any unrelated R4 mutation.
- Risk: R4
- Duration class: protected single database-Restore run
- Resume trigger: owner grants a fresh exact authorization after this evidence closeout is merged and the new exact `main` SHA is known.
- Do not ask before: repository evidence closeout and exact new binding are ready.
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

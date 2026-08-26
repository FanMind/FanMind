# Work Locks

Prevents two agents/sessions from independently working the same task.

## Rules
- Acquire a lock before substantive implementation.
- One active lock per Task ID.
- A second worker must inspect the existing lock and continue/coordinate rather than restart.
- Locks older than 24h are STALE, not free: reconcile `STARTED_WORK.md`, PRs, commits and receipts before replacing.
- Release only after updating `STARTED_WORK.md` and the execution receipt.

## Active locks

## LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826
- Task: FM-SEC-001
- Status: ACTIVE
- Holder: ChatGPT protected Production read-only verification session 2026-08-26
- Branch/PR: `security-production-readonly-verify-20260826` / pending
- Acquired: 2026-08-26 20:02 Europe/Vienna
- Risk: R3 protected Production evidence collection; read-only database verification and repository evidence only
- Scope: bind the existing checksum-pinned Production trigger-function hardening verifier to exact deployed `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`, run exactly one `verify` action, and reconcile the preflight/action/postflight evidence.
- Safety: `apply`, SQL/Auth/RLS/ACL/provider mutations, Restore/JIT/controller retry and Production/Supabase-Staging writes are outside this lock. The expected current-state result is fail-closed `hardening_not_ready`; any other result requires reconciliation before continuation.
- Resume from: inspect the exact workflow run and all three control stages, then update the open execution receipt and issue #982 before releasing this lock.

## Released locks

## LOCK-FM-SEC-001-READONLY-REFRESH-20260826
- Task: FM-SEC-001
- Status: RELEASED
- Holder: ChatGPT read-only Supabase security refresh session 2026-08-26
- Branch/PR: `security-readonly-refresh-after-timeout-20260826` / #1006; exact head `d9408c825aa735c5062a87cfc1b927312d094ad3`, squash merge `78333aae9d075a67a2d550a266d24cb8b9f443a4`.
- Acquired: 2026-08-26 Europe/Vienna
- Released: 2026-08-26 after #1006 passed every exact-head gate, merged, and issue #982 comment `5428919200` recorded the read-only result.
- Risk: R3 evidence reconciliation; provider reads and repository documentation only
- Scope: refresh Production/Staging advisor and exact function/ACL evidence, compare it with the existing controlled hardening contract, and preserve the separate mutation boundary.
- Safety: no SQL Apply, Auth setting, grant, RLS policy, Production/Staging write or other provider mutation was authorized or performed by this lock.
- Resume from: acquire a new scoped lock for the protected exact-deployed-commit verify or any separately authorized owner/provider action; do not revive this evidence-refresh lock.

## LOCK-FM-RST-001-SSH-TIMEOUT-RECONCILIATION-20260826
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT Restore SSH-timeout reconciliation session 2026-08-26
- Branch/PR: `restore-ssh-timeout-reconciliation-20260826` / #1005; exact head `9ce6c0746fa61072eb507bce6d511f952a42b8e8`, squash merge `dd9d986c387040b213355e0ba1bf60ce31fa7b32`.
- Acquired: 2026-08-26 Europe/Vienna after exact controller SHA-256 `45054c41143e33fce4406aea30478e43ed5280a36e1b339d0cc9c38df71ae946` stopped at its first SSH call with a TCP timeout.
- Released: 2026-08-26 after #1005 passed every exact-head gate, merged, and issue #944 comment `5428771745` recorded the fail-closed result.
- Risk: R4 evidence reconciliation; repository documentation and read-only provider checks only.
- Scope: record the owner authorization, controller attempt, pre-SSH/pre-JIT/pre-dispatch failure, preserve `TARGET_COMPATIBLE`, and define the owner-only connectivity and later reauthorization boundary.
- Resume from: no Restore controller retry. First obtain the Windows public-IP/TCP-22 result, then reconcile the Exoscale `/32` allowlist through a separately authorized provider action if required.
- Safety: this lock authorized no database Restore, target reset, JIT, workflow dispatch, environment approval, Production/Supabase-Staging write or Exoscale security-group mutation.

## LOCK-FM-RST-001-EXTENSION-BASELINE-EVIDENCE-20260823
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT extension-baseline evidence closeout session 2026-08-23
- Branch/PR: `restore-extension-baseline-evidence-20260823` / #997; exact head `6642c3c95bbb33f9a4b5f5a36afa068798e252e8`, squash merge `733e2f12464f746ee5dff0be71defe22d18ce33a`.
- Acquired: 2026-08-23 13:53 Europe/Vienna after the final controller reported committed provisioning plus complete read-only postcheck PASS.
- Released: 2026-08-23 after exact-head Project Memory Guard/Status/Quality, Landing, FanMind CI, Browser E2E and CodeQL all passed and #997 merged.
- Risk: R4 evidence reconciliation; repository documentation only.
- Scope: record the exact successful isolated extension-baseline provisioning, close the prior 2-of-5 blocker and preserve the separate new-authorization boundary for any database Restore.
- Resume from: no extension evidence reconciliation remains. Runtime work is owner-deferred as `FM-RST-OWNER-004`; no database workflow/JIT or target/Production/Supabase-Staging mutation is authorized.
- Safety: this lock authorized only repository/Issue evidence closeout. No database Restore, target reset, JIT/workflow dispatch, Production write, Supabase-Staging write or other runtime mutation occurred.

## LOCK-FM-RST-001-FAILCLOSED-RECONCILIATION-20260822
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT database-Restore fail-closed reconciliation session 2026-08-22
- Branch/PR: `restore-failclosed-reconciliation-20260822` / #995; exact head `ce2b63c606ca1a9aa701d24a569e21d66cfe13ea`, squash merge `86bf2657996c45bfe03fadd4af689ffa89e7ea6e`; lock closeout PR #996.
- Acquired: 2026-08-22 after independent read-only reconciliation of run `32594374666`.
- Released: 2026-08-22 22:22 Europe/Vienna after exact-head CI/countercheck and merge.
- Risk: R4 evidence reconciliation; repository documentation only.
- Scope: record the consumed protected database-Restore run, prove the pre-write failure/cleanup/empty-target state, preserve the exact 2-of-5 extension blocker and define the separately authorized provisioning boundary.
- Resume from: no repository reconciliation resume remains. Runtime work is owner-deferred as `FM-RST-OWNER-003`; no workflow retry and no target/Production/Supabase-Staging mutation.
- Safety: this lock authorizes only repository evidence reconciliation. Extension/role/config changes, target reset, database Restore and every other R4 mutation require a new exact protected authorization.

## LOCK-FM-RST-001-CHECKOUT-CA-TRUSTSTORE-20260822
- Task: FM-RST-001
- Status: RELEASED
- Holder: ChatGPT Restore readiness evidence reconciliation session 2026-08-22
- Branch/PR: `restore-readiness-evidence-20260822` / #992; predecessor #991 merged.
- Acquired: 2026-08-22 15:52 Europe/Vienna
- Released: 2026-08-22 after exact head `53308fa43b258e4570b67d675f38f16e15e3bb69` passed Project Memory Guard/Quality/Status, FanMind CI, Landing Language CI, CodeQL and both Browser E2E jobs, then squash-merged as `cb04829c378285c24c3c53b5fab2d03177c19165`.
- Scope: reconcile PR #991 and successful protected read-only run `32582640853` into canonical docs/Project Memory, close the stale ownership/runner-policy contradiction and preserve the exact next R4 boundary; no database/runtime/provider mutation.
- Resume from: no repository evidence-reconciliation resume is required. Restore remains `TARGET_COMPATIBLE`; the exact isolated database-Restore authorization is separately owner-deferred.
- Safety: repository documentation/Project Memory only. Database Restore, isolated-target write, Production write and Supabase-Staging write remain outside this lock and require separate exact R4 authorization.

## LOCK-FM-RST-001-SCHEMA-ACL-RECOVERY-20260820
- Task: FM-RST-001
- Status: SUPERSEDED
- Holder: ChatGPT Restore schema-ACL recovery session 2026-08-20
- Branch/PR: `restore-schema-acl-recovery-20260820` / #987
- Acquired: 2026-08-20 16:10 Europe/Vienna
- Released: 2026-08-22 after reconciliation proved PR #987 merged as `b6bc368915d50dd2903b83b87c7ca25eb0ed6e18`; later target/readiness evidence superseded the implementation resume point.
- Scope: bounded recovery of the eight proven missing schema grant tuples on `graphql` and `graphql_public`; no Production or Supabase Staging mutation.
- Resume from: no repository implementation resume required. The current Restore blocker is the separately recorded checkout CA-truststore reconciliation.

## LOCK-FM-MOB-001-EAS-PROJECT-BINDING-20260821
- Task: FM-MOB-001
- Status: RELEASED
- Holder: ChatGPT Mobile EAS project-binding hardening session 2026-08-21
- Branch/PR: `mobile-eas-project-binding-hardening-20260821` / #988
- Acquired: 2026-08-21
- Released: 2026-08-21 after exact head `6f42a5897aabb3387a74149010dee2b5fb2c92cd` passed Project Memory Guard/Quality/Status, FanMind CI, Landing Language CI, Supply Chain Security, CodeQL and Browser E2E, then squash-merged as `e20efd475e475101226f266118b9cfed7972243a`.
- Scope: harden the existing read-only Mobile release and signed-build resource checks so successful `eas project:info` lookup is bound to the exact expected EAS owner, `fanmind-mobile` slug and project ID before any later build gate; no credential creation, build, submit, update, signing or provider mutation.
- Resume from: no repository implementation resume required. The next Mobile step is the existing protected read-only EAS resource-readiness run; external EAS, Supabase Auth, signing, stores and real-device acceptance remain open.

## LOCK-FM-MEM-005
- Task: FM-MEM-005
- Status: RELEASED
- Holder: ChatGPT FanMind audit/V6 session 2026-08-19
- Branch/PR: `project-memory-v4-started-work` / #975
- Acquired: 2026-08-19 12:14 Europe/Vienna
- Updated: 2026-08-19
- Scope: exhaustive FanMind-only reconciliation, Project Memory V2-V6 integration and exact-head countercheck
- Resume from: no resume required; task accepted on main
- Released: after exact head `2a62dc8337673be0b33acfd4338d0f452224e779` passed all applicable gates and PR #975 merged as `b4bef882a55e8c0dd1dd33d0ad1c1664c3078d0d`

## LOCK-FM-MEM-008
- Task: FM-MEM-008
- Status: RELEASED
- Holder: scheduled Project Memory reconciliation 2026-08-20
- Branch/PR: `project-memory-v8-crosschat-impact` / #980
- Acquired: 2026-08-20 08:22 Europe/Vienna
- Released: 2026-08-20 after final exact head `704fec4b6264dd5a0dd83cc8e0029352672485d0` passed the complete gate set including Browser E2E and PR #980 merged as `22eb6aed5da4fde47860bbe12b118d3780c8a4a0`.
- Scope: V5 bookkeeping and exact-head evidence reconciliation for V8 governance only; no product/runtime/provider mutation.
- Resume from: no resume required unless V8 evidence becomes stale or contradictory; then create a new reconciliation lock rather than reviving this one.

All product workstreams remain tracked in `STARTED_WORK.md`; new locks must be acquired before substantive continuation of their respective task IDs.

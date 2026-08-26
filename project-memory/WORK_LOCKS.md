# Work Locks

Prevents two agents/sessions from independently working the same task.

## Rules
- Acquire a lock before substantive implementation.
- One active lock per Task ID.
- A second worker must inspect the existing lock and continue/coordinate rather than restart.
- Locks older than 24h are STALE, not free: reconcile `STARTED_WORK.md`, PRs, commits and receipts before replacing.
- Release only after updating `STARTED_WORK.md` and the execution receipt.

## Active locks

## LOCK-FM-META-001-TECHNICAL-RECONCILIATION-20260826
- Task: FM-META-001
- Status: ACTIVE
- Holder: ChatGPT Meta technical read-only reconciliation session 2026-08-26
- Branch/PR: `meta-technical-reconciliation-20260826` / #1014, evidence head `5b63b1e2de8fc37daaef5f26451d4f037d9cf65f`
- Acquired: 2026-08-26 Europe/Vienna
- Risk: R3 protected Staging evidence and canonical-reader reconciliation; read-only checks only
- Scope: reconcile Pixel/no-PII/security tests and current Meta Staging foundations against exact GitHub `main` `966ffe3b105321e1350ec8c4fdb111341e99dd83`; inspect issue #714 and current readers; run at most one exact-main read-only execution each of `meta-content-staging-resource-readiness.yml`, `meta-conversation-continuation-staging-verify.yml` and `meta-catchup-queue-staging-verify.yml`; use only explicit transaction-level read-only Supabase catalog SQL. `FM-FAIL-015` records that the direct query preceded the required shared rollout-state classification; no further catalog query is allowed under this lock, and any future Meta Staging database action must first consume a fresh same-commit/same-target shared rollout-state decision.
- Safety: no Meta consent grant or PageView emission, Meta Events Manager/App Review/account/OAuth/token/provider call, SQL Apply, rollback-only acceptance, worker/queue/runtime activation, Production deploy/configuration, Supabase row/schema write, Restore/Mobile/AI/Security mutation or legal decision is authorized. Failed or stale runs are recorded without automatic retry.
- Resume from: all three bounded runs and direct catalog evidence are counterchecked in FM-EV-023, with the sequencing deviation preserved in FM-FAIL-015. Finish the #1014 reader diff, issue evidence and exact-head CI/merge; do not rerun any workflow or direct query. Release this lock only in a repository closeout after the accepted merge.

## Released locks

## LOCK-FM-AI-001-READONLY-RECONCILIATION-20260826
- Task: FM-AI-001
- Status: RELEASED
- Holder: ChatGPT AI/Billing read-only reconciliation session 2026-08-26
- Branch/PR: evidence `ai-billing-readonly-reconciliation-20260826` / #1012, final exact head `b53e000228bf99801b327c1d7b81646edce32d6f`, squash merge `d1b9d7e94b3bc78a1720e197a795a105bdcc1883`; repository-only closeout `ai-billing-readonly-reconciliation-closeout-20260826` / #1013.
- Acquired: 2026-08-26 21:01 Europe/Vienna
- Released: 2026-08-26 after the final head passed all 10 Guard/Quality/Status, Landing, FanMind CI including PostgreSQL 17, CodeQL and Browser E2E checks; issues #560/#874 were updated and #1012 merged SHA-bound.
- Risk: R3 protected Staging/Stripe evidence collection; read-only database and provider checks only
- Scope: bound the current AI entitlement ledger, all five isolated Stripe Test prices, exact Staging webhook and synthetic AI resource boundary to exact `main` `2f8d9ca989e87ad88a76a514308618a9ce5d6fbb` through exactly three read-only runs.
- Runtime result: runs `33003378162`/`98290675487`, `33003452287`/`98290922265` and `33003526741`/`98291186923` each passed once; issue #560 comment `5429960286` and issue #874 comment `5429960711` record the classification.
- Safety: no Plus/Ultra activation, product/price/webhook mutation, payment, refund, Tax registration, SQL Apply, transactional lifecycle acceptance, runtime-ledger activation, Production/Restore/Mobile/Security mutation or Supabase write occurred.
- Resume from: do not revive this lock or rerun its three jobs. Remaining AI work is owner/protected under `FM-AI-OWNER-001`/`002`; the generated parallel-safe task is `FM-META-001`.

## LOCK-FM-MOB-001-PREVIEW-READINESS-20260826
- Task: FM-MOB-001
- Status: RELEASED
- Holder: ChatGPT Mobile preview read-only readiness session 2026-08-26
- Branch/PR: `mobile-preview-readonly-readiness-20260826` / #1010; final exact head `15fca01adae6f4934c7b729512a14b8ccc926383`, squash merge `e6b3d9715726ede77ce7230cefa824edba16b2d4`
- Acquired: 2026-08-26 20:30 Europe/Vienna
- Released: 2026-08-26 after exact-head Guard/Status/Quality, Landing, FanMind CI, CodeQL and both Browser E2E jobs passed, issue #690 comment `5429569941` recorded the blocker, and #1010 merged.
- Risk: R3 external resource evidence; protected read-only Expo/EAS lookup only
- Scope: reconciled five historical fail-closed runs and exactly one current `preview` run `33000433320`/job `98280538304` on `main` `32c08ba6877d6aaaf61110c02464ee95d6bc6301`; the run failed closed on missing protected configuration.
- Safety: no EAS build, signing, submit, update, project initialization, credential creation, Supabase/Auth/DB change, Store action, Restore/JIT/controller retry or Production/Supabase-Staging data write occurred.
- Resume from: do not revive this lock or rerun `33000433320`. Mobile is owner-deferred to `FM-MOB-OWNER-001`; the generated safe task is AI/Billing read-only reconciliation.

## LOCK-FM-SEC-001-PRODUCTION-VERIFY-20260826
- Task: FM-SEC-001
- Status: RELEASED
- Holder: ChatGPT protected Production read-only verification session 2026-08-26
- Branch/PR: `security-production-readonly-verify-20260826` / #1008; final exact head `ed64255f3786eea257011778a40492d6c7c9447e`, squash merge `4efb4eeef07d850fd0fd9117244187cf94bfed41`.
- Acquired: 2026-08-26 20:02 Europe/Vienna
- Released: 2026-08-26 after exact-head Guard/Status/Quality, FanMind CI, Landing, CodeQL and Browser E2E passed, issue #982 comment `5429302086` recorded the evidence, and #1008 merged.
- Risk: R3 protected Production evidence collection; read-only database verification and repository evidence only
- Scope: bound the checksum-pinned Production trigger-function hardening verifier to exact deployed `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6`, ran exactly one `verify`, and reconciled preflight/action/postflight/provider evidence.
- Safety: no `apply`, SQL/Auth/RLS/ACL/provider mutation, Restore/JIT/controller retry or Production/Supabase-Staging write was authorized or performed.
- Resume from: do not revive this lock or rerun verify. Protected Apply and Auth/exception decisions are separately owner-deferred as `FM-SEC-OWNER-001`/`002`; the generated safe task is Mobile read-only reconciliation.

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

## FM-AUTH-CHATADMIN-MANUAL-FLOW-20260926
- Status: ACTIVE
- Risk: R4
- Source: Bernd explicitly requested fresh preflight, synthetic fixture preparation, actual Staging manual flow, negative tests, cleanup, independent countercheck and Project Memory/Finishline reconciliation on 2026-09-26.
- Scope: FM-CHATADMIN-002 / NBA-CHATADMIN-MANUAL-FLOW; necessary bounded source corrections and their tested/reviewed normal PR path, exact reviewed Staging deployment, temporary synthetic non-customer capability/runtime fixtures, actual Character -> pasted synthetic Fan message -> three bound AI suggestions -> copy/manual handoff, cleanup and independent zero-residue countercheck.
- Target: only FanMind Staging (`vshyhvgcmrlagvfnvomc`, `https://staging.fanmind.ch`), with fresh exact release/schema/identity checks before every protected action.
- Boundary: no real customer/fan fixture, OnlyFans/Social send, automatic send, Production capability/schema activation, Billing/Stripe/Tax/Restore/Mobile mutation. Prior APPLY and DB/RLS ACCEPT remain consumed; no repeat.
- Necessary deployment recovery remains bounded to preserving the already-running Staging configuration: reviewed source-copy exclusion and explicit exact-service reconstruction of a missing generated `.release.env` from its existing nonsecret values. No Billing setting may change, missing proof may not be invented, no secret file is read and no Stripe/capture action is authorized. The original `preserve` requirement remains mandatory.
- Current continuation: #1193/#1194/#1196/#1197 are merged and0a368095 deployed. Run36250479400 created the exact synthetic fixture then failed during browser execution; preserve its original recovery binding. Separate deterministic trailing-CR assertion proof reconciles that failed run beforeprovider; it is not manual acceptance. Canonical UUID normalization, nonmutating probe/enum diagnostics and fresh corrected protected acceptance after review/CI/deploy remain covered; no blind unchanged retry, invented proof, credential rotation or account mutation.

## FM-AUTH-CHATADMIN-STAGING-ACCEPT-20260926
- Status: CONSUMED
- Risk: R4
- Source: Bernd explicitly initiated the protected ChatAdmin Staging ACCEPT, then corrected the required protected Staging fixture configuration and authorized continuation of the same exact action after the first fail-closed attempt.
- Exact scope consumed: GitHub Actions run `36238536613`, successful attempt 2 / job `108396358120`, exact reviewed `7655aed2cae6ff3588207fee6f2227fd5b8db41c`, target FanMind Staging Supabase `vshyhvgcmrlagvfnvomc`, mode `ACCEPT`, confirmation `run-chat-admin-acceptance`.
- Result: same-run schema preverify returned `CHAT_ADMIN_SCHEMA_STATE=VERIFIED`; rollback-only DB/RLS acceptance returned `CHAT_ADMIN_ACCEPTANCE_DATABASE=PASS` and `CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN`; password-file cleanup passed.
- Independent postflight: Staging capability/character/conversation/message row counts are all zero, all four ChatAdmin tables retain RLS, and Production `drqkpdvtbbrrdwmtrodz` still has none of the ChatAdmin tables.
- First attempt: run attempt 1 / job `108394659516` failed before fixture mutation with `CHAT_ADMIN_ACCEPTANCE_ERROR=fixture_identity` because the protected fixture variables were empty. This was corrected by protected environment configuration, not by bypassing the workflow.
- Not authorized/consumed: no real capability grant/customer data, no real manual application-flow acceptance, no Production/provider/Billing/Stripe/Tax/Restore/Mobile mutation and no automatic send.
- Reuse: forbidden. The later manual ChatAdmin application-flow acceptance is a separate protected action.

## FM-AUTH-CHATADMIN-STAGING-APPLY-20260926
- Status: CONSUMED
- Risk: R4
- Source: Bernd explicitly authorized only the controlled ChatAdmin Staging APPLY and then manually dispatched the protected workflow after the exact inputs were checked.
- Exact scope consumed: one `FanMind ChatAdmin Staging Rollout` run `36235870895` / job `108387398410` against reviewed commit `2aaf225fec29fd91c20f822185c770f87eb3d10d`, target Supabase Staging `vshyhvgcmrlagvfnvomc`, mode `APPLY`, confirmation `apply-chat-admin-migration`.
- Pinned migration: `supabase/controlled/20260920230000_chat_admin_multi_character.sql`, SHA-256 `9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b`.
- Result: workflow APPLY and its built-in postflight succeeded with `CHAT_ADMIN_SCHEMA_STATE=VERIFIED`. Independent read-only Supabase countercheck confirms all four expected ChatAdmin tables, RLS/policies/grants, the SECURITY INVOKER helper and global uniqueness index; all four tables contain zero rows. Production `drqkpdvtbbrrdwmtrodz` has none of the four ChatAdmin tables.
- Not authorized/consumed: no ACCEPT run, real capability grant, real customer data, Production/provider/Billing/Stripe/Tax/Restore/Mobile mutation, automatic send or manual application-flow acceptance.
- Reuse: forbidden. Any later protected mutation, including ChatAdmin ACCEPT or Production apply, is a distinct exact action.

## FM-AUTH-ADMIN-CRM-PRODUCTION-APPLY-20260919
- Status: CONSUMED
- Risk: R4
- Source: Bernd explicitly authorized: “Production-DB-Rollout für Admin-CRM freigegeben”.
- Exact scope consumed: one application of `supabase/migrations/20260915221500_admin_crm_access.sql` SHA-256 `7d1201fc5b45b571d2944b301eb1f5f197ea4f25ad643c8e8010d9d0ba3c1efd` to exact Production Supabase `drqkpdvtbbrrdwmtrodz` bound to deployed release `630aef3ccb53fed9b46284cb1d4bf1825a57687e`.
- Result: migration `20260919081945 admin_crm_access` applied once; independent postflight PASS.
- Not authorized by this receipt: additional migration, rollback/drop, generic db push, user grant, Stripe/Tax/payment/provider/Mobile mutation.
- Reuse: forbidden. Any later Production DB mutation requires new exact action-time authorization.

# Project Authorizations

## FM-AUTH-CREATOR-SOCIAL-20260910
- Source: Bernd's current explicit instruction to continue Creator Intelligence and Social/AI handoff now and finish Android afterwards.
- Status: ACTIVE
- Authorized: necessary source/model/UI/route implementation, isolated synthetic local verification, branch/PR and existing normal roadmap publication workflow.
- Boundary: no automatic migration, real platform message, provider approval, payment, new Android binary or invented legal/customer evidence. FM-DEC-015 supersedes only older scheduling restrictions.

## FM-AUTH-PAID-ACTIVATION-20260910
- Source: Bernd explicitly requested "ok nun bitte Aktivieren" and then "arbeite bitte weiter und wir wollen alles nun aktivieren".
- Status: ACTIVE
- Authorized: necessary implementation, tests, reviewed branch/PR/merge/publication and technically validated controlled Production activation of the three approved plans. Do not ask for the same activation permission again.
- Factual boundary: no invented tax treatment/UID, legal review, customer acceptance, email receipt or provider evidence. Follow the target-bound rollout with verified prerequisites; preserve existing successful releases and controls.

## FM-AUTH-THREE-OFFERS-PUBLISH-20260910
- Status: ACTIVE
- Source: owner requests all three listed payment models and "alles bitte voll freigeben", while asking to close/reconcile Restore, genuine registration, AI/Billing and Security/Meta.
- Authorized: necessary implementation, relevant verification and normal reviewed FanMind/FanMind PR/merge/Production publication; reuse the existing prices and previously accepted work.
- Retained boundaries: no fabricated tax/UID/contract-consent/provider acceptance, unapproved email recipient, automatic customer charge, destructive Restore cleanup or reuse of the previously rejected Restore password-change action.

## FM-AUTH-REGISTRATION-PUBLISH-20260910
- Source: current owner instruction to finish registration and publish it now.
- Scope: implement, test, review and publish the registration correction through branch/PR, green CI and the existing normal Web deployment.
- Boundary: the instruction does not constitute external legal/tax evidence, consent by future customers, permission to send test emails to unapproved recipients, or a protected database/provider activation. Preserve those factual and operational gates.

## FM-AUTH-ROADMAP-VISIBLE-20260910
- Source: current owner follow-up reports the approved Phase-7 addition missing on fanmind.ch and asks for reliable retention plus the open points.
- Scope: complete that visible roadmap correction through existing PR #1090, green checks/review and the normal Web release path. Correct stale Staging/Android presentation only from recorded evidence.
- Boundary: no Creator implementation, migration, payment, credential/access change, provider activation, Mobile build or acceptance inferred from publication. Existing protected gates remain applicable.

## FM-AUTH-RST-SSH-20260910
- Granted by: Bernd in this session immediately after the exact prepared rule was presented; owner replied that if needed, save it.
- Scope: one ingress TCP 22/22 rule from the specifically reviewed owner IPv4 /32 to fanmind-restore-isolated, which is attached only to the existing fanmind-restore-01.
- Result: saved once and read back; rule prefix eb474b38. Source address remains private. Owner independently reached SSH authentication, but login failed after passphrase/password attempts. Network reachability is confirmed; host authentication remains open.
- Boundary: no default-group change, broad source range, extra port, new key, database Restore, new provider target/cost or Storage operation. This is a new scope and does not reuse retired FM-RST-OWNER-005.

## Protected AI run authorization reconciliation — 2026-09-10
- Run 34273836166 technically passed on 7f681d26, but a separate exact action-time protected-Staging authorization is not verified in the available record.
- FM-AUTH-FINISHLINE-PUBLISH-20260908 is publication/normal-release/Restore scope; it does not establish the independent AI fixture-write approval.
- No new or retrospective authorization is created by this documentation. Keep CTR-FM-AI-AUTH-20260910 open, retain observed technical results, and do not automatically repeat the run.

## Standing authorizations from Bernd

- Maintain and extend the Project Memory system.
- Create implementation branches and pull requests for project-memory governance changes.
- Update documentation, ledgers, open loops, dependencies, evidence, decisions and handoff files when needed.
- Continue FanMind work according to the recorded roadmap, repository rules and project-memory state.

## Not covered by standing authorization

- production database writes or restores;
- destructive infrastructure changes;
- production secrets, key rotation or secret disclosure;
- payment/billing changes;
- publishing production releases;
- bypassing failing security, supply-chain or governance checks;
- real external account integrations without available credentials/permissions.

## Operating rule

If an action is covered here and technically possible through connected tools, proceed without asking again. If the platform requires confirmation or the action is outside this file, record the blocker in project-memory/OPEN_LOOPS.md or project-memory/SESSION_HANDOFF.md.

## Current caution

FanMind has stricter governance gates than the WellFit repositories. A green Project Memory Guard alone is not enough to merge when other FanMind gates are red.

## FM-AUTH-RST-STORAGE-LOCAL-ONLY-20260907

- Granted by: Bernd in the current session after reviewing the additional-target cost and purpose.
- Initial scope: continue the Storage Restore work after the repository preparation merge.
- Final owner choice: `Nur lokal testen`; do not create a Supabase project or Preview branch and do not mutate FanMind Production or FanMind Staging.
- Authorized result: repository implementation and synthetic local verification of the fail-closed Storage write/postcheck/rollback controller.
- Not authorized/proven: real backup decryption, provider upload, remote bucket creation, external `STORAGE_RESTORED`, server-config activation or target deletion.

## FM-AUTH-MOB-REDIRECT-CLOSEOUT-20260830

- Granted by: Bernd through explicit action-time confirmation in the current session.
- Scope 1: save exactly `fanmind://reset-password` in the already confirmed FanMind Production Supabase Auth redirect list; do not change Site URL, existing redirects, Auth providers, users, database/schema/RLS or any other provider setting.
- Scope 2: transmit local closeout commit `ecaa9ec` plus the immediately resulting exact redirect evidence amendments to the existing `github.com/FanMind/FanMind` repository, create a PR, validate exact-head CI and merge only if green.
- Result: Scope 1 is consumed and verified by FM-EV-029. Scope 2 remains active only for the current closeout branch/PR and does not authorize Store submission/publication, another AAB, push activation, iOS/TestFlight or unrelated external changes.

## FM-AUTH-FINISHLINE-PUBLISH-20260908
- Granted by: Bernd in this session after the explicit public-disclosure approval question.
- Owner instruction: yes, publish and finish Restore.
- Scope: publish the reviewed correction and updated Project Memory in the existing public FanMind/FanMind repository and create its PR; complete publication through review/green CI and the normal release path. Continue the resumed Restore work from DB_POSTCHECKED.
- Boundary: no second database Restore, no Production/FanMind Staging Storage target, no inferred acceptance of a new provider target/cost, no secret or private artifact publication. Existing prices remain complete.

## FM-AUTH-OPS-BOOT-PUBLISH-20260912
- Explicit continuation: Bernd now says "ok mach das bitte" to the stated remaining PM2 startup, independent server reference and recovery checks. Existing reviewed source-publication/rollout authority continues for bounded read-only diagnosis of those measured failures; actual boot/reference and recovery gates remain necessary before the requested restart. No credential reset, gate bypass or unreviewed reference bootstrap is implied.
- Status: ACTIVE
- Granted by: Bernd in the current session, replying "ja darf er" directly to the concrete publication/rollout question for local eef3f26b.
- Authorized payload/destination: the prepared read-only boot-readiness collector, its existing-audit/deploy integration, tests and project documentation in the existing public FanMind/FanMind repository, followed by review, green current-head CI and the normal rollout.
- Transport proof: local Git lacked a GitHub credential after authorization; connected GitHub published a33eedad075d506f566ac5347fc3c0ac74f9a2ff with exactly the approved tree fb61de76fc59b65802ac2937af7d6061b4e55d8e. No code change was needed for that transport. This receipt reconciles the now resolved automatic publication block; normal bounded review corrections and evidence updates remain part of that workflow.
- Retained boundary: no secret/private payload, bypass of CI/review, source or database Restore, extra backup, provider activation or startup-state mutation. The separately owner-requested Ubuntu reboot still requires actual boot/recovery preflight and before/after proof.

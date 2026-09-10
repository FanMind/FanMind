# Project Authorizations

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

# Deferred Owner Actions

Updated: 2026-09-07 Europe/Vienna

## FM-RST-OWNER-001 — GitHub runner-group policy evidence
- Related task: `FM-RST-001`.
- Status: COMPLETED.
- Result: protected read-only run `32582640853` revalidated the exact selected repository/workflow policy and host/toolchain boundary, then advanced through `RESOURCE_READY` and `TARGET_COMPATIBLE` without writes.
- Evidence: all three jobs succeeded on exact `b75f68ecc7999a9b492051aecc2421b9b597dd18`; Host-2 runner ID `42` cleaned credentials/configuration, exited 0 and was removed.
- Revalidation rule: mutable runner policy/host evidence must be checked again immediately before any later R4 write.

## FM-RST-OWNER-002 — Exact isolated database-Restore authorization
- Related task: `FM-RST-001`.
- Status: CONSUMED_FAIL_CLOSED.
- Decision: The exact one-run authorization was consumed by `restore-drill-database.yml` run `32594374666` on reviewed `main` `8bc8855a6de928cf38ef2e8fb9e9e0860fc477db`.
- Result: Gate and Host-1 passed. Host-2 job `97082992861` stopped at `database_authorization_preflight_failed` before the first target write because the empty target exposed only 2 of the 5 receipt-bound extensions. Independent read-only reconciliation proved the target remains empty, TLS is `verify-full`, quarantine is retained and runner/JIT/credential/plaintext residue is absent.
- Resume rule: this authorization cannot be retried, rerun or reused. Any later database Restore requires a new exact authorization after the extension contract is independently satisfied.
- Safety: no database Restore was applied; Production and Supabase Staging were not written.

## FM-RST-OWNER-003 — Exact isolated extension-baseline provisioning
- Related task: `FM-RST-001`.
- Status: COMPLETED.
- Decision: The exact extension-only authorization was consumed successfully on exact `main` `c627fc2d8956768091c88e3a3baaf0b882b8d2d6`.
- Result: only `pg_stat_statements` 1.11, `supabase_vault` 0.3.1 and `uuid-ossp` 1.1 plus the proven member-owner correction were committed. The final read-only receipt checks returned the exact 97-record extension fingerprint `6704956613ca8e58a527336d67b622a043e48a568858873ca5a6fa6b8bd08012` and canonical ACL fingerprint `abedaf76740b6a7fc1e53433a41337a2f8248d79abfac4ac22c9cf835a1373e3`.
- Evidence: issue #944 comment `5385843508`; final controller `LOCAL_EXTENSION_BASELINE_CONTROLLER=PASS`.
- Safety: no database Restore, target reset, JIT/workflow dispatch, Production write, Supabase-Staging write or unrelated R4 mutation occurred. This authorization is consumed and must not be reused.

## FM-RST-OWNER-004 — Exact isolated database-Restore authorization after extension closeout
- Related task: `FM-RST-001`.
- Status: CONSUMED_PRE_DISPATCH_FAIL_CLOSED.
- Decision: owner authorization comment `5385992305` and controller SHA-256 `45054c41...` were attempted on 2026-08-26, but the controller stopped at its first SSH connection before remote preflight/JIT/approval/dispatch/database access.
- Result: no Restore workflow or database mutation occurred; highest accepted state remains `TARGET_COMPATIBLE` with side state `RECONCILIATION_REQUIRED`.
- Resume rule: never reuse this controller or authorization and never automatically retry.
- Safety: Production, Supabase Staging, target reset and every unrelated R4 mutation remain forbidden.

## FM-RST-OWNER-005 — Restore-host SSH reachability evidence
- Related task: `FM-RST-001`.
- Status: SUPERSEDED.
- Superseded by: later authorization/execution evidence in issue #944 comments `5453497602`, `5453599115`, `5453727223` and `5453857592` proved the isolated database Restore committed and its bounded ACL completion passed. SSH reachability is no longer a prerequisite for the completed database phase.
- Safety: do not revive this action to repeat the Restore or change an Exoscale allowlist. Any genuinely later infrastructure mutation requires a new, separately reviewed scope.

## FM-RST-OWNER-006 — New exact isolated database-Restore authorization after SSH reconciliation
- Related task: `FM-RST-001`.
- Status: SUPERSEDED.
- Superseded by: consumed authorization `5453497602`, committed Restore workflow `33178878764` / job `98874745740`, and bounded ACL completion authorization `5453727223`. The database phase is complete and non-repeatable.
- Resume rule: continue only with receipt/read-only reconciliation for `DB_POSTCHECKED`; never create a JIT or dispatch a new database Restore from this retired action.
- Safety: Production, Supabase Staging, target reset and every unrelated R4 mutation remain forbidden.

## FM-RST-OWNER-007 — Real isolated Supabase Storage target
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.

- Related task: `FM-RST-001`.
- Status: OWNER_ACTION_REQUIRED.
- Decision: on 2026-09-07 the owner selected `Nur lokal testen` after comparing a permanent project at 10 EUR/month with an isolated Preview branch at 0.01344 EUR/hour.
- Current result: only the repository controller and synthetic local API contract may proceed. No additional Supabase project/branch may be created and neither FanMind Production nor FanMind Staging may be used as the Restore target.
- Resume rule: a real `DB_POSTCHECKED -> STORAGE_RESTORED` transition needs a new action-time decision for a distinct disposable Supabase target plus exact current commit/artifact/project/bucket/cleanup bindings.

## FM-SEC-OWNER-001 — Exact protected Production trigger-function hardening Apply
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Related task: `FM-SEC-001`.
- Status: OWNER_ACTION_REQUIRED.
- Proven pre-state: protected read-only run `32997946812`, job `98271985321`, on exact deployed `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6` returned `hardening_not_ready`; both full Production audits passed and the fresh advisor set remained unchanged.
- Deferred action: separately authorize exactly one protected `apply` through `trigger-function-hardening-production-control.yml`, bound to the then-current reviewed and deployed commit, checksum-pinned controlled SQL, full preflight/postflight and fresh advisor re-scan.
- Safety: this read-only session does not authorize Apply. No unrelated SQL, Auth, RLS, provider, Restore or Supabase-Staging mutation may be bundled into the action.

## FM-SEC-OWNER-002 — Leaked-password protection and Staging RPC exception decision
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Related task: `FM-SEC-001`.
- Status: OWNER_ACTION_REQUIRED.
- Current classification: leaked-password protection is disabled on both exact Supabase targets and is a real Auth-control gap. Staging `ensure_current_user_workspace(...)` is technically constrained and intentionally authenticated-callable, but explicit exception acceptance is still missing.
- Deferred action: decide and separately authorize the exact provider setting change for leaked-password protection on each target; explicitly accept or reject the documented Staging RPC exception after reviewing the evidence. Keep these actions separate from trigger hardening and Restore.
- Safety: no automatic Auth-setting change, RPC revoke/grant or invented browser RLS policy.
- Current additional RPC: get_current_workspace_member_safe_dashboard() is authenticated-only, has pinned search_path and row_security=on, and returns only five safe membership fields. Full schema rollout verify passed; current body MD5 9b7e87c856d33d3ab3b97e2941faa519 matches the canonical SQL. Both RPC exceptions remain decision-required; no blind revoke.

## FM-MOB-OWNER-001 — Protected Mobile preview resource configuration
- Related task: `FM-MOB-001`.
- Status: RESOLVED.
- Prior blocker: exact read-only run `33000433320`, job `98280538304`, failed closed when the protected Preview binding was still blank.
- Resolution evidence: protected exact-merge run `33298699290`, job `99222705186`, verified the existing EAS project and Preview public environment, then completed one authorized Android internal build for merge `6a2f5b6c9bac1607ecc2ccae11c6ade3cb418522` with artifact verification, redacted receipt and cleanup. The owner accepted the bounded FM-MOB-003/FM-MOB-004 UI/runtime observation on that build. Submit, Update and Production remained disabled.
- Remaining owner action: the complete receipt-bound 19-check Android runbook/private validator and the separate Supabase Auth redirect/recovery proof remain open under their existing external controls; iOS is Phase 8 and Store/push are separate. Never expose credential or artifact values in Project Memory.
- Safety: successful Preview configuration does not authorize EAS project reinitialization, another automatic build, Submit, Update, Store action, Supabase/Auth/DB mutation or Production-target crossover.

## FM-AI-OWNER-001 — AI product, quality and financial decision pack
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Related task: `FM-AI-001`.
- Status: OWNER_ACTION_REQUIRED.
- Proven foundation: FM-EV-022 currently verifies the synthetic Staging resource, Plus/Ultra and five-price Test catalog, exact 22-event Test webhook, installed empty AI ledger and 50/100/150 context policy. These are not activation evidence.
- Deferred action: decide model classes/distinct fallbacks, request/token quotas, usage/overage, switching/proration/refund and cost/margin; provide four representative weeks of privacy-safe usage/cost evidence and the real blinded private quality result; obtain Legal/Tax acceptance separately.
- Safety: no guessing, no private raw evaluation material or provider mapping in Git/issues, no environment flag or Plus/Ultra activation from the recommendation alone.

## FM-AI-OWNER-002 — Remaining protected Staging provider/lifecycle evidence
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Related task: `FM-AI-001`.
- Status: OWNER_ACTION_REQUIRED.
- Current bounded evidence: the general Billing ledger is installed on isolated Staging; exact deploy `34058028839` and rollback-only canonical Billing acceptance `34058118450` / job `101553652111` passed on `62e6a11858e85996af03f6740819b0fc6194b4a4` with rollout `PASS`, Billing ledger `verify`, zero cutover counters, full rollback and cleanup `PASS`. Historical AI-tier rollback acceptance `34039968946` / job `101504820898` passed on older exact `49f7cbd7a1cba4bdc21bec536d3fe5992fe0d8f5`, but later isolated Staging deploy `34058028839` of `62e6a118...` invalidated its mutable current-state freshness.
- Deferred action: after a new explicit exact-commit protected Staging authorization, first require the shared read-only rollout-state on that exact deployed revision and isolated Staging target to return overall `PASS` with AI entitlement, AI Stripe ledger and general Billing ledger each classified `verify`; any absent, partial, drifted, mismatched or blocked state must stop before the fixture. Only then obtain a fresh AI-tier rollback acceptance on that same revision. Then separately close only genuinely remaining provider-side inbound webhook/current provider lifecycle, failed-payment consequences, event ordering/idempotency/conflict handling and current canonical downstream Billing -> AI/referral reconciliation through the installed ledgers. Product/private quality-cost and Legal/Tax remain separate gates.
- Safety: no automatic rerun of the invalidated AI-tier acceptance, no duplicate canonical Billing acceptance while its own evidence remains current, no live Stripe action, Production, automatic canonical projection enablement, unreviewed SQL or paid-tier activation.
- Current superseding attempt: deploy 34267819029 succeeded on a1bde387; AI acceptance 34268214078 failed at the environment gate before any fixture. Two workflow API-origin bindings are corrected locally; merge/exact-new-main deploy/fresh acceptance remain open. Webhook read-only readiness 34268317761 passed; no price setup is missing.

## FM-META-OWNER-001 — External Meta Events/App Review/legal acceptance
- Resumed: 2026-09-08 by Bernd for completion; former deferral is lifted, but exact protected/target/cost/legal boundaries remain. See FM-EV-038 for current evidence.
- Related task: `FM-META-001` / `FM-SOC3-001`.
- Status: OWNER_ACTION_REQUIRED.
- Proven foundation: FM-EV-007 Production-confirms the consent-gated parameterless PageView-only technical path. FM-EV-023 counterchecks the 2026-08-26 exact-main repository no-PII/security boundary and observed isolated Staging content/continuation/catch-up objects/metadata without writes, activation or provider events; it does not independently prove the ledger-managed continuation timestamp, while the controlled queue is intentionally ledger-free. Mutable Staging freshness is tracked by `EV-META-STAGING-FOUNDATION-20260826`.
- Deferred action: in an owner-controlled normal browser and the correct Meta Business/Dataset, capture positive and negative Events Manager/Test Events evidence: no event before consent, exact PageView-only reception after consent/safe navigation, no unexpected conversions and no PII/Advanced Matching. Obtain final privacy/legal acceptance separately. Meta Business permissions/App Review and real Facebook/Instagram provider E2E remain part of the later Social gate.
- Resume rule: do not rerun FM-EV-023 merely to close the technical reconciliation or repeat Production ENV/build/deploy. After its Staging freshness expires/invalidation or before any later Meta Staging database action, use a new lock and fresh shared rollout-state-first verification. Any real event emission, provider/account/OAuth/App Review action, credential use, SQL Apply, worker/runtime activation or Production change requires its own exact scope and current evidence.
- Safety: no CompleteRegistration/Lead/Purchase, Advanced Matching, CAPI, customer data, CRM identifiers or secret values may be introduced through this action.

## FM-GOV-OWNER-001 — Protect `main` with GitHub Ruleset / Branch Protection
- Related area: FanMind governance / Project Memory V7 hardening.
- Status: DEFERRED_BY_OWNER.
- Current remote fact: `main` is not protected as of 2026-08-19; branch API reports `protected=false` and no required status checks.
- Why deferred: the connected GitHub app can read the branch protection state but exposes no write action for Branch Protection or Rulesets.
- Required remote settings are defined in `BRANCH_PROTECTION_CONTRACT.json`.
- Deferred actions:
  1. Enable protection/ruleset for `main`.
  2. Require pull requests for changes to `main`.
  3. Require the listed FanMind/Project-Memory status checks.
  4. Block force pushes and branch deletion.
  5. Require conversation resolution.
  6. Do not allow routine direct pushes to `main`.
- Resume rule: perform this once together when convenient. Until then, agents must still follow the repository branch+PR policy even though GitHub does not technically enforce it.
- Safety: do not weaken or remove existing checks in order to make the ruleset easier to satisfy.

## General rule
When a FanMind finishline action requires owner-only UI access, external provider approval, payment authorization, legal/tax evidence or another capability unavailable to the assistant, record it here and continue with unrelated safe work. Do not repeatedly interrupt the owner with the same deferred request.

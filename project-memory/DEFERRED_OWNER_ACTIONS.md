# Deferred Owner Actions

Updated: 2026-08-26 Europe/Vienna

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
- Status: DEFERRED_BY_OWNER.
- Deferred action: on the owner's Windows PC, capture current public IPv4 and detailed TCP-22 reachability to `138.124.213.66`. Do not rerun the Restore controller.
- Provider boundary: if the evidence proves a stale Exoscale SSH allowlist, any exact `/32` security-group change requires a separate narrow authorization and read-only target/scope confirmation.
- Safety: no broad CIDR, unrelated security-group/VM/database change, Restore/JIT/workflow action or Production/Supabase-Staging access.

## FM-RST-OWNER-006 — New exact isolated database-Restore authorization after SSH reconciliation
- Related task: `FM-RST-001`.
- Status: DEFERRED_BY_OWNER.
- Deferred action: after SSH/allowlist reconciliation and merged evidence closeout, bind a new one-run authorization/controller to the then-current reviewed `main`, accepted Backup/Verification/Source/target/reset receipt tuple, fresh mutable runner-policy/host/target/backup/TLS evidence and fresh sequential one-job JITs.
- Resume rule: do not create a JIT, request environment approval or dispatch a database workflow before the new exact authorization. Never reuse controller `45054c41...`, authorization `5385992305`, run `32594374666` or runner IDs `43`/`44`.
- Safety: Production, Supabase Staging, target reset and every unrelated R4 mutation remain forbidden.

## FM-SEC-OWNER-001 — Exact protected Production trigger-function hardening Apply
- Related task: `FM-SEC-001`.
- Status: DEFERRED_BY_OWNER.
- Proven pre-state: protected read-only run `32997946812`, job `98271985321`, on exact deployed `main` `5cb9c193e262f8939b5fc0c700fce154dde616e6` returned `hardening_not_ready`; both full Production audits passed and the fresh advisor set remained unchanged.
- Deferred action: separately authorize exactly one protected `apply` through `trigger-function-hardening-production-control.yml`, bound to the then-current reviewed and deployed commit, checksum-pinned controlled SQL, full preflight/postflight and fresh advisor re-scan.
- Safety: this read-only session does not authorize Apply. No unrelated SQL, Auth, RLS, provider, Restore or Supabase-Staging mutation may be bundled into the action.

## FM-SEC-OWNER-002 — Leaked-password protection and Staging RPC exception decision
- Related task: `FM-SEC-001`.
- Status: DEFERRED_BY_OWNER.
- Current classification: leaked-password protection is disabled on both exact Supabase targets and is a real Auth-control gap. Staging `ensure_current_user_workspace(...)` is technically constrained and intentionally authenticated-callable, but explicit exception acceptance is still missing.
- Deferred action: decide and separately authorize the exact provider setting change for leaked-password protection on each target; explicitly accept or reject the documented Staging RPC exception after reviewing the evidence. Keep these actions separate from trigger hardening and Restore.
- Safety: no automatic Auth-setting change, RPC revoke/grant or invented browser RLS policy.

## FM-MOB-OWNER-001 — Protected Mobile preview resource configuration
- Related task: `FM-MOB-001`.
- Status: DEFERRED_BY_OWNER.
- Proven blocker: exact read-only run `33000433320`, job `98280538304`, on `main` `32c08ba6877d6aaaf61110c02464ee95d6bc6301` found the `mobile-preview` `EXPO_TOKEN` and all expected EAS-owner/project/Supabase/API binding variables blank, then failed closed with `eas_project_lookup_failed` before public-environment verification.
- Deferred action: establish or confirm the exact existing Expo/EAS FanMind project/account; populate only the protected `mobile-preview` GitHub Environment secret/variables defined by the runbook; separately prove the Supabase Auth redirect `fanmind://reset-password`. Never paste credential values into issues, Project Memory or chat.
- Resume rule: after owner/platform configuration, acquire a new lock and run exactly one fresh read-only `preview` resource check. Do not reuse or rerun `33000433320`.
- Safety: no EAS project initialization, build, signing, submit, update, Store action, Supabase/Auth/DB mutation or Production-target crossover is authorized by this deferred item.

## FM-AI-OWNER-001 — AI product, quality and financial decision pack
- Related task: `FM-AI-001`.
- Status: DEFERRED_BY_OWNER.
- Proven foundation: FM-EV-022 currently verifies the synthetic Staging resource, Plus/Ultra and five-price Test catalog, exact 22-event Test webhook, installed empty AI ledger and 50/100/150 context policy. These are not activation evidence.
- Deferred action: decide model classes/distinct fallbacks, request/token quotas, usage/overage, switching/proration/refund and cost/margin; provide four representative weeks of privacy-safe usage/cost evidence and the real blinded private quality result; obtain Legal/Tax acceptance separately.
- Safety: no guessing, no private raw evaluation material or provider mapping in Git/issues, no environment flag or Plus/Ultra activation from the recommendation alone.

## FM-AI-OWNER-002 — Protected Staging Billing-ledger and post-ledger lifecycle acceptance
- Related task: `FM-AI-001`.
- Status: DEFERRED_BY_OWNER.
- Proven pre-state: the AI-specific ledger is applied and empty; the general Billing ledger is absent; the last full transactional AI lifecycle run used pre-ledger legacy CRUD. Current read-only runs must not be repeated.
- Deferred action: after the Stripe conformance code review, separately authorize exact-commit Staging write freeze -> controlled general Billing ledger Apply/postflight -> capture-only cutover -> canonical/downstream reconciliation -> zero conflicts -> exactly one rollback-only AI lifecycle acceptance through the applied ledger.
- Safety: no live Stripe action, Production, automatic projection enablement, unpinned SQL, paid-tier activation or acceptance without full rollback and exact job/log countercheck.

## FM-META-OWNER-001 — External Meta Events/App Review/legal acceptance
- Related task: `FM-META-001` / `FM-SOC3-001`.
- Status: DEFERRED_BY_OWNER.
- Proven foundation: FM-EV-007 Production-confirms the consent-gated parameterless PageView-only technical path. FM-EV-023 counterchecks the current exact-main repository no-PII/security boundary and isolated Staging content/continuation/catch-up metadata without writes, activation or provider events.
- Deferred action: in an owner-controlled normal browser and the correct Meta Business/Dataset, capture positive and negative Events Manager/Test Events evidence: no event before consent, exact PageView-only reception after consent/safe navigation, no unexpected conversions and no PII/Advanced Matching. Obtain final privacy/legal acceptance separately. Meta Business permissions/App Review and real Facebook/Instagram provider E2E remain part of the later Social gate.
- Resume rule: do not rerun FM-EV-023 workflows or repeat Production ENV/build/deploy. Any real event emission, provider/account/OAuth/App Review action, credential use, SQL Apply, worker/runtime activation or Production change requires its own exact scope and current evidence.
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

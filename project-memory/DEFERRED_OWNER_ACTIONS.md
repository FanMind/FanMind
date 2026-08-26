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

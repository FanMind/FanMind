# FanMind: Main/Staging parity inventory and controlled convergence (2026-11-05)

Status: STAGING_SCHEMA_APPLIED / CODE_PARITY_CONFIRMED / SQL_ACCEPTANCE_PASS / LIVE_ACCEPTANCE_PARTIAL
Owner intent: both environments should deliver the same approved functions. Production Main and all existing records must remain untouched. Never sync real customer records, auth users, secrets or production payment identifiers into Staging.


## Current execution result — 2026-11-05 19:30 UTC (supersedes earlier pending steps)

**Actual state:** STAGING_SCHEMA_APPLIED / CODE_PARITY_CONFIRMED /
SQL_ACCEPTANCE_PASS / LIVE_ACCEPTANCE_PARTIAL. No new Supabase project, database,
server, billable resource or Restore was created. Production/Main source,
database, runtime configuration and deployment were not changed by this task.

### Source, recovery and authorization
- Reviewed source/main stays `a798d7938bb4e7e168f615f0c32d1a603dd47d4a`.
- Direct Owner authorizes safe Staging parity work and excludes new infrastructure
  and Production changes. Prior provider daily backup and accepted DB_POSTCHECKED
  tooling evidence were reused; neither was mislabeled a fresh Staging restore.
- Independent Guardian judged recovery adequate for these specific additive,
  atomic installations: current Staging provider backup, complete catalog guard
  before COMMIT, feature switches unchanged, source-first application rollback
  leaving unused schema in place. No repeated complete Restore was required.
- A failed migration would roll back atomically. No table-drop rollback,
  reset, default-privilege change, role grant or ownership change was executed.

### Actual Staging migrations
| Version | Name | Effect |
|---|---|---|
| 20261105190505 | support_centre_reviewed_main_a798d793_staging | Seven empty Support tables,20functions,2triggers,1sequence |
| 20261105190733 | chat_media_storage_policy_rollback_probe_staging_20261105 | Restrictive Storage-policy permission probe, completely rolled back; ledger only |
| 20261105190924 | chat_admin_private_media_reviewed_main_a798d793_staging | Two Media tables,3functions,8policies,3triggers and one private WebP bucket |
| 20261105192811 | media_rollback_only_database_acceptance_a798d793_staging | Synthetic database acceptance, entire fixture rolled back; ledger only |
| 20261105192918 | support_rollback_only_acceptance_a798d793_staging | Synthetic database acceptance, entire fixture and sequence restart rolled back; ledger only |

Support source SQL SHA256s remain051fa0253bb6a815820d825ca4c1c35a70405a25de59e8dc0d7e899ef5179a30
andc8bb1c8be779d0cfd64797bdc9fe2f4248abbdb201e0959bcc8e6ebe90be8633;
independent PG17 reference95083136b610c0fbe2822a3dee309038f7aacb18e4eed344654dd7d5eba60472.
Support installer payloadb523e2b1b43039f03a9a1c772775b2eee1025d64298fc244a9061c43da3aa642
is unchanged installer SQL minus the psql directive plus user/database assertion.
Media SQL source3c4fa2214b5721dd8a7bc85d9ea3ef3b6b8c592c5305315eb623cf99cf1d59fe;
wrapped payloadb7ba1a49e9c445a1da2dceae3f204f7be073567ee979e53d7a1150b182ad197c.
Wrapper preserves original body and adds target/absence/parent/data guards and
full equality to fresh Production metadata before COMMIT. Production rows were
not copied; all metadata comparison was read-only.

### Independent postflights and database acceptance
- Support complete object/function-body/ACL/column/index/constraint/policy/
  trigger/sequence catalog EXACT against pinned reference, not counts alone.
- Media complete catalog EXACT against independent fresh Production reference.
  Private bucket5MiB/WebP; existing Storage owner and both old protection triggers
  preserved. No ownership or inherited-role workaround was used.
- Media rollback acceptance payloade940fcd27dec46eabfb5671cebf3f45824cf18b6a3296e1329aa9d0daa2797b9:
  owner visibility, foreign denial, scope reassignment denial, revision updates,
  bound Storage metadata insert, unbound insert denial, replacement denial,
  tombstone and late-insert/orphan protection PASS. No image bytes uploaded.
- Support rollback acceptance payload5be24c913d369e649fd3ba34c5122e93d34abb367682bde68d1d85255ffc2347:
  cases/replay, Owner and tenant denial, safe internal decisions/check, audit,
  notifications/inbox/ack, recovery, chat replay/conflict/pagination/isolation,
  consent snapshot, stale/foreign erasure denial, bounded erasure and retention,
  browser/service/operator boundary PASS.
- First Support rollback-test attempt aborted on its recovery assertion.
  Read-only EXPLAIN confirmed status subqueries were InitPlans in the same
  expression as the mutating function. Test sequencing was corrected; no product
  assertion relaxed. Aborted attempt left no rows or ledger entry. Corrected test
  passed. Transactional ALTER SEQUENCE RESTART plus ROLLBACK preserves original
  sequence1/is_called=false; no setval repair.
- Independent Guardian19:30:09UTC confirms all7Support tables, both Media tables,
  Characters, fixture capability, Storage objects and tokenless synthetic Social
  connection0; sequence1/false, locks0; both complete catalogs remain EXACT.
- Security advisor delta: seven intentional server-only policy-free Support
  tables and the source-reviewed authenticated own-Workspace Media helper.
  Staging INFO43/WARN8; no blanket grants or policies to silence advisories.

### Application deployment and actual live versions
- Existing protected Staging deploy run42091553062/job127470608886 PASS, with
  billing_write_freeze=preserve. Existing false value remained false; no billing
  activation or write-freeze change.
- Host preflight proves separate HTTPS/Supabase target, exact URL/ref binding,
  Stripe TEST mode, safe baseline switches and shared-rate-limit readiness.
- Build/lint/Operations/release-integration checks and public14-route smoke pass.
  Seven required health components healthy. Optional email_config remains unknown.
- Fresh live /api/version: Staging19:13:56.517Z and Production19:14:05.826Z both
  exacta798d7938bb4e7e168f615f0c32d1a603dd47d4a, with their distinct runtimeEnvironment.
- No Production deploy. No credentials, accounts, customer records or files moved.

### Live ChatAdmin outcome: distinguish browser success from overall job failure
- New existing-workflow run42092700717/job127474690048 on exact main completed.
  Auth/authority probe PASS; fixture reservation/upload PASS.
- Original sanitized log at19:23:08: stagecomplete, outcomepassed, networknone,
  sessionCleanuppassed, CHAT_ADMIN_MANUAL_BROWSER=PASS. This covers the complete
  actual browser journey including invented_price. Historical run42041782472
  remains FAIL; it is not rewritten.
- CLEANUP=PASS19:23:11, ABSENCE=PASS19:23:13, then FLOW_ERROR=unexpected19:23:20.
  Final independent cleanup step=success/NOT_NEEDED; password file removed.
  **Overall run remains FAIL; no full end-to-end acceptance PASS is claimed.**
- New original Recovery artifact13446715495/digest
  b33c57aff3d2cc8aba34a555117bced399a794343b958f0082970ea817fda969
  remains unchanged. Independent receipt-bound Guardian read19:25:40UTC proves
  all exact IDs/Usage/sessions/in-flight predicates0.
- Verify SQL generation was independently reproduced offline without a
  ReferenceError. Exact failure cause is not observable from the current
  redacted unexpected error; a release-read/receipt/persistence phase failure
  must not be guessed or used to justify an unchanged blind retry.

### Compatibility decisions and remaining boundaries
- All45Production public table names now exist on Staging; Staging has77tables,
  retaining all32Staging-only tables. No extras promoted or deleted.
- Independent consumer review confirms legacy chat_character_fans.memory,
  chat_characters.pricing_config/sales_profile, conversations.external_video_id
  and social_connections.last_comment_fetch_imported_count are not required by
  the current reviewed consumers. ChatAdmin uses sales_playbook; actual active
  video metadata is on conversation_messages, where Staging already has it.
  No unnecessary legacy-column migration was executed.
- Staging-only intelligence/billing/member-hardening columns and separate
  commercial defaults remain unchanged; no price/default rewrite or blanket
  RLS synchronization. Earlier exact drift inventory remains applicable.
- Support Owner assignment, runtime activation and retention schedule remain
  untouched. Media runtime/analysis switches remain unchanged; no new activation.
- Staging has the new private media bucket; public legacy fanmind-assets remains
  absent. No customer/public Production files copied. This is not blanket Storage
  or profile-image acceptance.
- Actual Support browser/runtime, real Media file-API/UI and optional analysis
  acceptance remain unproven. No new provider/payment/email activity was enabled.
- Functional equality of all requested product behavior: **NO**.
  Code parity and the two new database contract/rollback acceptances: **PASS**.

### Prepared source diagnosis, not deployed
The same PR carries a bounded test-runner diagnostic correction: fixed
receipt/release/persistence phase enums, fixed-code redaction of unexpected
exceptions and preserved existing failures. No SQL, assertions, cleanup, retry,
target or permission boundary is weakened. Focused release/cleanup/phase tests
9/9PASS;3newphase tests are included. Independent review and exact-head CI govern
source publication. No merge, deployment or repeated live test of this correction;
it does not establish the cause or resolution of the already recorded failure.


## Historical inventory and earlier prerequisite assessments

The following sections preserve earlier observations; the current execution result above supersedes their pending/unknown statuses.

## Targets and source

- Repository: FanMind/FanMind, source baseline `a798d7938bb4e7e168f615f0c32d1a603dd47d4a` (verify HEAD before execution).
- Production Supabase: `drqkpdvtbbrrdwmtrodz` (read-only in this workstream).
- Staging Supabase: `vshyhvgcmrlagvfnvomc` (only permissible migration target, subject to existing controlled release gates).
- App deploys: `https://fanmind.ch` and `https://staging.fanmind.ch`; actual currently deployed SHAs are NOT live-confirmed. Do not mistake an old receipt for a current live version.
- No DDL, apply, drop, truncate, destructive reset, data copy, flag enablement or deploy has been carried out by this inventory.

## Actual current database evidence

Read from Supabase connectors (public base tables):
- Production 45 tables; Staging 68.
- 36 names common; 9 Production-only; 32 Staging-only.
- Production-only: `support_centre_owners`, `support_centre_cases`, `support_centre_events`, `support_centre_notifications`, `support_chat_threads`, `support_chat_turns`, `support_retention_runs`, `chat_character_media`, `chat_character_media_policies`.
- Staging-only: `content_sources`, `workspace_ai_prompt_settings`, `workspace_ai_tier_entitlements`, `mobile_push_registrations`, `workspace_analysis_settings`, `content_metric_snapshots`, `communication_analysis_reports`, `website_chat_installations`, `website_chat_allowed_origins`, `website_chat_visitor_sessions`, `website_chat_message_receipts`, `meta_conversation_catchup_jobs`, `workspace_ai_tier_stripe_reconciliations`, `workspace_ai_tier_stripe_events`, `mobile_push_delivery_attempts`, `website_chat_handoffs`, `workspace_stripe_billing_streams`, `workspace_stripe_billing_object_bindings`, `workspace_stripe_billing_reconciliations`, `workspace_stripe_billing_events`, `social_provider_connections`, `social_provider_oauth_attempts`, `creators`, `creator_voice_profiles`, `creator_sales_playbooks`, `creator_commercial_events`, `ai_capacity_admin_policy`, `ai_capacity_grants`, `ai_capacity_reservations`, `ai_capacity_reservation_allocations`, `ai_capacity_ledger_events`, `support_repair_audit`.
- Nine shared tables have different column signature (name/type/nullability/default): `chat_character_fans`, `chat_characters`, `contact_ai_profiles`, `conversations`, `fan_analysis_reports`, `referral_discount_snapshots`, `social_connections`, `workspace_voice_profiles`, `workspaces`.
- RLS policies: Production 66, Staging 89; public-schema functions: 52 vs 74; triggers: 24 vs 32. Counts are NOT policy/function equality proof.
- Storage: Production buckets `fanmind-assets` (public), `chat-character-media` (private); Staging none. Production has one stored object; Staging zero.
- Auth: Production four users, Staging five. These MUST NOT be copied or equalized.
- Production Edge Functions none; Staging has active `fanmind-staging-password-reset-temp` (do NOT silently delete or promote).
- Production latest three application backup records report `succeeded/ passed/ uploaded` at 2026-11-05 01:30 UTC; Staging `backup_runs` has no records. Supabase-managed backup availability and real restore ability have not been independently verified.
- No advisory lock was observed during read-only spot-check; must recheck immediately before any future apply.

## Verified implementation source and restrictions

- Production Support schema installation documented in `project-memory/receipts/support-production-schema-20261105.md` with exact PG17 reference and recovery checks; seven server-only tables created on Production. Staging did not receive this apply. Reuse the pinned source/reference, never copy Production rows or manually improvise RLS.
- Private Character Media controlled SQL: `supabase/controlled/chat_admin_media.sql`; `docs/CHAT_ADMIN_MEDIA_LIBRARY.md` explicitly marks it controlled/unapplied during ordinary deploy. It must be installed separately and kept with `FANMIND_CHAT_ADMIN_MEDIA_ENABLED=false` and `FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=false` initially.
- Existing Staging ChatAdmin acceptance run `42041782472` recorded `invented_price`, `inflight_reconciliation_required`; resolve evidence, cleanup and absence BEFORE new write acceptance.
- Staging documentation `docs/operations/CHAT_ADMIN_STAGING_ROLLOUT.md` requires verified current Staging backup/restore readiness before controlled apply.
- Historical Staging version in `project-memory/receipts/chatadmin-staging-checkout-validation-20261105.md`: `f353f3e1c853c6104797d4db9ab578b8695b14bd`; this is historical, not a current live observation.

## Required execution gates, in order

1. Obtain fresh, independent, target-bound Staging backup + tested recovery evidence. Treat the absent application backup rows as UNKNOWN, not proof of no Supabase backup. Do not weaken recovery policy.
2. Independently reconcile the existing `invented_price` in-flight test state; no duplicate cleanup or acceptance writes. Preserve and re-use the existing serialized harness lock.
3. Pin exact current main SHA and read both `/api/version` release SHAs from the running hosts using the authorized host/CI mechanism, plus target Supabase refs. Abort if environment identity or release provenance is ambiguous.
4. Read full preflight: required PostgreSQL 17 objects, exact Production reference signatures, Storage policies/triggers/ACL, named Staging-only objects, existing row counts and constraints, and transaction/role/lock boundary. Assess SECURITY DEFINER warnings manually; do not copy policies by counts.
5. Independently review additive Staging-only migration(s) for Production Support and media objects, including dependency resolution and no collisions. Apply using existing controlled workflow/reference under explicit Staging target, never generic app deploy. Keep flags disabled and all preexisting Staging tables/data.
6. On success, compare full relevant schema signatures, all function definitions, RLS policies, grants, triggers, bucket privacy and referential constraints, not just object counts. Verify SQL migration history and no changes to Production.
7. Deploy the approved same application commit separately to Staging with existing host/runner isolation, verifying `/api/version` and `runtimeEnvironment=staging`. Preserve distinct Supabase credentials/configuration.
8. Run synthetic target-bound functional tests on Support, Character Media, ChatAdmin, retention and privacy; verify cleanup and no residual artifacts. Investigate feature flag or provider differences; never turn on billing, provider delivery, or media analysis by default.
9. Only after equivalence is proven, issue a separate recommendation for each Staging-only feature that Production might eventually need. **Do not transfer any Staging-only table to Production merely to equalize counts.**

## Stop rules and acceptance criteria

- Stop if restore evidence is missing, tests/locks are unresolved, schema is PARTIAL, target could be Production, permissions broaden unexpectedly, or data removal is proposed.
- Main must remain bit-for-bit unchanged by this workstream; all existing customer data/accounts/chats/media remain preserved.
- Similar behavior means same reviewed software commit and same required schema/security contracts, not identical users, data rows, testing integrations or enabled providers.
- Do not claim parity PASS until live code versions, controlled database postflight and synthetic application acceptance all PASS.


## Continuation: live evidence 2026-11-05 18:27–18:31 UTC

This section supersedes the earlier UNKNOWN statements about live versions,
provider backups and the scoped recovery conclusion. No target mutation was made.

### Release binding (live browser reads)
- Current GitHub main: `a798d7938bb4e7e168f615f0c32d1a603dd47d4a`.
- Production /api/version checkedAt 18:27:09.545Z: same exact main SHA,
  runtimeEnvironment=production.
- Staging /api/version checkedAt 18:27:16.744Z:
  `1184616ddea8c1ea2fa93b8d74a19ab28eb8d35a`,
  runtimeEnvironment=staging. Its environment=production is Next.js production
  build mode, not evidence of Production target identity.
- Code parity is therefore FAIL; no Production redeployment is needed to reach
  the current main. Staging deployment is pending schema/recovery prerequisites.
- Both Supabase project IDs/names independently re-read ACTIVE_HEALTHY.
  Runtime-secret project binding still requires the protected host preflight;
  project metadata and runtimeEnvironment alone do not prove that binding.

### Provider backups: existence verified, tested restore still pending
- Authenticated Staging dashboard lists eight physical daily backups, latest
  2026-11-05 02:29:39 UTC. Restore-to-new-project list marks it COMPLETED.
- Production dashboard lists eight physical daily backups, latest
  2026-11-05 05:58:44 UTC. No restore or Production action was invoked.
- Supabase explicitly excludes Storage object bytes from database backups.
  Fresh Staging Storage object count is zero; Production objects are not copied.
- Staging Restore-to-new-project confirmation was inspected, then cancelled.
  It preserves source organization/region, creates a separate database project,
  restores schema/data/indexes/roles/permissions/users, and requires manual
  Storage, Edge Function, Auth/API-key and extension/configuration treatment.
  It quotes additional compute USD 9.68/month and disk USD 0/month.
- No project was created and no cost incurred. Source Staging was not reset.
  Cost authorization and isolated restore/postflight remain required. An offered
  restore button is NOT evidence that a restore has succeeded.
- No daily backup is represented as a current full Storage-inclusive snapshot.
  Before eventual apply, bind the tested recovery to then-current Staging state
  and check any changes after the selected snapshot.

### Fresh catalogue comparison (read-only)
Compared public tables/columns, complete public function definitions and ACLs,
RLS policy expressions including Storage, non-internal public triggers,
constraints, indexes, table grants and column privileges. No row contents read.
- Tables 45/68; common 36; Production-only 9; Staging-only 32 (unchanged).
- Public RLS policies 66/89; including storage policies 69/89.
- Public functions 52/74; non-internal public triggers 17/26.
  Earlier historical trigger counts 24/32 used a different/unspecified counting
  scope and must not be compared as though all used this same predicate.
- Public indexes 145/222; constraints 274/543; advisory locks observed 0/0.
- All listed public base tables have RLS enabled. RLS enabled alone is not an
  access-control acceptance result.
- Current security advisors: Production 17 INFO no-policy and 6 WARN
  authenticated-security-definer-executable; Staging 36 INFO and 7 WARN.
  No warning is fixed, dismissed or accepted by these counts. Intentional
  server-only policy-free tables require ACL proof, not blanket policy creation.
- Shared function signatures: 11 differ in definition and/or ACL. The
  create_chat_admin_fan difference is insertion-column ordering with equivalent
  explicit values; do not replace it merely for text equality.
- Production-only conversation_messages trim trigger/function must be evaluated
  against the reviewed retention contract before matching its behavior.
- Production admin_crm_entitlement_boundary policies/RPCs are absent on Staging.
  Staging has separate owner/member and server-owned-workspace hardening.
  Do not replace those policies wholesale or weaken either environment.

### Nine shared-table column differences
Column ordering alone is ignored in this comparison.

| Table | Production fields missing in Staging | Staging additions / changed defaults | Safe disposition |
|---|---|---|---|
| chat_character_fans | memory | none | Review source-pinned additive Staging contract; no apply yet |
| chat_characters | pricing_config, sales_profile | none | Review source-pinned additive Staging contract; no apply yet |
| contact_ai_profiles | none | source_from_at, source_to_at, review_status, reviewed_by, reviewed_at, commercial_profile | Preserve Staging additions; no automatic promotion or deletion |
| conversations | external_video_id | assigned_user_id, sales_state, sales_state_updated_at, sales_state_source | Review source-pinned additive Staging contract; no apply yet |
| fan_analysis_reports | none | source_from_at, source_to_at, confidence_score, review_status, reviewed_by, reviewed_at | Preserve Staging additions; no automatic promotion or deletion |
| referral_discount_snapshots | none | source_event_id, source_event_type, stripe_subscription_id, stripe_coupon_id, stripe_sync_status, stripe_sync_error, stripe_synced_at | Preserve Staging additions; no automatic promotion or deletion |
| social_connections | last_comment_fetch_imported_count | oauth_login_type, external_account_type, token_expires_at, permissions_verified_at, analytics_enabled, messenger_sync_continuation_after, messenger_sync_continuation_started_at | Review source-pinned additive Staging contract; no apply yet |
| workspace_voice_profiles | none | source_from_at, source_to_at, source_scope, review_status, reviewed_by, reviewed_at | Preserve Staging additions; no automatic promotion or deletion |
| workspaces | none | commercial_option: 'starter_12m_setup_waived'::text (Production) vs 'starter_no_setup_commitment'::text (Staging), monthly_fee_cents: 29900 (Production) vs 31200 (Staging) | Commercial defaults: separate reviewed decision, no silent price/default change |

### Staging-only tables: individual retention decisions
Each object below is retained in Staging. None is approved for Production by
this parity task. Classification identifies its contract family, not activation.

| Table | Contract family | Decision |
|---|---|---|
| ai_capacity_admin_policy | Capacity-v2 gated billing | Keep; independent contract/feature gate, no Production copy |
| ai_capacity_grants | Capacity-v2 gated billing | Keep; independent contract/feature gate, no Production copy |
| ai_capacity_ledger_events | Capacity-v2 gated billing | Keep; independent contract/feature gate, no Production copy |
| ai_capacity_reservation_allocations | Capacity-v2 gated billing | Keep; independent contract/feature gate, no Production copy |
| ai_capacity_reservations | Capacity-v2 gated billing | Keep; independent contract/feature gate, no Production copy |
| communication_analysis_reports | Meta/content analysis | Keep; independent contract/feature gate, no Production copy |
| content_metric_snapshots | Meta/content analysis | Keep; independent contract/feature gate, no Production copy |
| content_sources | Meta/content analysis | Keep; independent contract/feature gate, no Production copy |
| creator_commercial_events | Creator Intelligence | Keep; independent contract/feature gate, no Production copy |
| creator_sales_playbooks | Creator Intelligence | Keep; independent contract/feature gate, no Production copy |
| creator_voice_profiles | Creator Intelligence | Keep; independent contract/feature gate, no Production copy |
| creators | Creator Intelligence | Keep; independent contract/feature gate, no Production copy |
| meta_conversation_catchup_jobs | Meta/content analysis | Keep; independent contract/feature gate, no Production copy |
| mobile_push_delivery_attempts | Mobile push | Keep; independent contract/feature gate, no Production copy |
| mobile_push_registrations | Mobile push | Keep; independent contract/feature gate, no Production copy |
| social_provider_connections | Social OAuth/profile preview | Keep; independent contract/feature gate, no Production copy |
| social_provider_oauth_attempts | Social OAuth/profile preview | Keep; independent contract/feature gate, no Production copy |
| support_repair_audit | Support recovery audit | Keep; independent contract/feature gate, no Production copy |
| website_chat_allowed_origins | Customer website-chat foundation | Keep; independent contract/feature gate, no Production copy |
| website_chat_handoffs | Customer website-chat foundation | Keep; independent contract/feature gate, no Production copy |
| website_chat_installations | Customer website-chat foundation | Keep; independent contract/feature gate, no Production copy |
| website_chat_message_receipts | Customer website-chat foundation | Keep; independent contract/feature gate, no Production copy |
| website_chat_visitor_sessions | Customer website-chat foundation | Keep; independent contract/feature gate, no Production copy |
| workspace_ai_prompt_settings | Workspace prompt settings | Keep; independent contract/feature gate, no Production copy |
| workspace_ai_tier_entitlements | AI tier / Stripe ledger | Keep; independent contract/feature gate, no Production copy |
| workspace_ai_tier_stripe_events | AI tier / Stripe ledger | Keep; independent contract/feature gate, no Production copy |
| workspace_ai_tier_stripe_reconciliations | AI tier / Stripe ledger | Keep; independent contract/feature gate, no Production copy |
| workspace_analysis_settings | Meta/content analysis | Keep; independent contract/feature gate, no Production copy |
| workspace_stripe_billing_events | Stripe billing ledger | Keep; independent contract/feature gate, no Production copy |
| workspace_stripe_billing_object_bindings | Stripe billing ledger | Keep; independent contract/feature gate, no Production copy |
| workspace_stripe_billing_reconciliations | Stripe billing ledger | Keep; independent contract/feature gate, no Production copy |
| workspace_stripe_billing_streams | Stripe billing ledger | Keep; independent contract/feature gate, no Production copy |

### Recovery reconciliation: separate conclusion
Independent Guardian checked original ZIP SHA, receipt/run/target binding and all
five marker-derived UUIDs against the unchanged harness, then queried Staging in
BEGIN READ ONLY / ROLLBACK at 2026-11-05 18:30:01 UTC.
All full harness absence predicates are zero, including FOREIGN_CHARACTER_ID,
fan/creation/child relations, workspace capability and exact usage route/time/
workspace/user. All auth sessions since start, relevant active or idle-in-
transaction backends, and advisory locks are zero. Original job completed/failure,
NETWORK=none, SESSION_CLEANUP=passed and final orphan-process cleanup corroborate
termination. Conclusion: RECONCILED_ZERO_RESIDUE for the defined database/session
scope. Original acceptance remains FAIL; original receipt remains unchanged.
No new cleanup or synthetic write test was run.

### Actual disposition
No SQL write/apply, deployment, feature activation, real provider invocation,
data transfer or Production change. Existing reviewed Support/media contracts
remain the only candidate installation sources; no generic migration push or
schema copy is prepared. Current blocker is the isolated, verified Staging
recovery path (with the quoted new-project cost not yet authorized); exact
migration dependency/security postflights and Staging acceptance remain pending
after that gate. Main/Staging functional parity: NO.


## Owner correction and existing Restore discovery — 2026-11-05

Owner explicitly rejects any third Supabase database/project. No new project,
server, billable resource, target reset or repeat Restore is authorized.
The earlier statement that new-project cost approval was a prerequisite is
withdrawn: that is not the only recovery mechanism and is not the selected path.

Existing canonical evidence found:
- Decision FM-DEC-004 says Restore must not target Production/shared Supabase
  Staging and must not spawn another restore server by default.
- Existing host fanmind-restore-01 already has the isolated PostgreSQL17 recovery
  facility. Receipt:
  project-memory/receipts/FM-RST-001-ISOLATED-DATABASE-RESTORE-ACCEPTED-20260828.md.
- Run33178878764/job98874745740 committed the database Restore. Separately
  authorized ACL completion produced expected/actual fingerprint equality,
  core postcheck5|5|5|5 and plaintext cleanup PASS.
- CURRENT_STATE supersedes the historical failure and accepts DB_POSTCHECKED;
  #944 is closed/completed. Do not repeat this accepted database Restore.
- Remaining overall Storage/config/cleanup gate is distinct; it does not turn
  the accepted database Restore into a failure.
- These are historical Production-backup recovery-tooling evidence, not proof
  that today's Staging backup was restored or that current host access works.

Next recovery assessment must reuse existing approved infrastructure/evidence,
check what is actually required for the bounded additive Staging migrations,
and isolate any genuinely missing current target/backup/access evidence.
Do not substitute the old Production receipt for current Staging recovery.
Do not invent a requirement to purchase a third Supabase project, repeat a
consumed Restore, restore Production into Staging, or weaken safety checks.
No target mutation was made by this correction.


## 2026-11-05T20:22Z – regulärer Merge und eingegrenzter Abschlussfehler

- PR #1432 regulär als `4a22cec1003db80d6c3897686a3a09589ae03608` gemergt, nachdem alle 12 erforderlichen Checks für `e8cf8929a5ff6ad86a8c9b0ee1e4911c149435bb` und unabhängige Source-QA bestanden waren. Kein Branch-Schutz umgangen.
- Geschützter Staging-Deploy `42100363592` / Job `127501241035` PASS. Live-Staging-Version `4a22cec1…` um 20:09:30 UTC bestätigt; Production bleibt `a798d793…` um 20:10:10 UTC, ohne Deployment oder DB-/Einstellungsänderung. Produktlaufzeitdateien unverändert; die Commit-Differenz enthält nur Operations-/Test-/Dokumentationsänderungen.
- Der Preflight bestätigt um 20:07:28 UTC `STAGING_SUPPORT_CENTRE_RUNTIME=disabled`, `STAGING_CHAT_ADMIN_MEDIA_RUNTIME=disabled`, `STAGING_CHAT_ADMIN_MEDIA_ANALYSIS_RUNTIME=disabled`. Staging besitzt null Support-Owner-Zuordnungen. Keine Aktivierung oder Zuordnung vorgenommen. Positive Support-/Media-Datei-UI-Abnahme bleibt konkret blockiert.
- Einziger neuer tatsächlicher Acceptance-Lauf `42101152303` / Job `127504041619` auf `4a22cec1…`: Probe, Browser einschließlich `invented_price`, Session-Cleanup, Daten-Cleanup und Absence PASS. Gesamtjob FAIL: um 20:15:44 UTC erfolgreiche Receipt-Phase, anschließend `post_browser_release`; Persistenzabschluss nicht erreicht.
- Unabhängige Original-Receipt-Reconciliation um 20:17:47 UTC PASS: keine exakten Testrows, Capabilities, zugeordnete Nutzung, nachlaufende Sessions, offenen Operationen oder Locks. Recovery-Artefakt `13450121680` unverändert. Kein erneuter Cleanup notwendig. Historische FAIL-Ergebnisse bleiben FAIL.
- PR #1433 behebt ausschließlich den technischen Release-Read: pro Versionsabruf frische `node:https`-Verbindung mit `agent:false`, fester HTTPS-Zieladresse, Standard-TLS-Prüfung, keiner Weiterleitung/Proxy-/Retry-Logik, unveränderter Gesamtdeadline 15 Sekunden und 8192-Byte-Streaminggrenze. Nichtidentische Kompression, Trunkierung, ungültiges JSON und technische Fehler scheitern mit festen sicheren Codes. Application-/Staging-/SHA-Bindung sowie SQL, Browser-Assertions, Berechtigungen und Cleanup bleiben unverändert.
- Neuer Runner-SHA256 `82a18ed54624e62470d84cd8a0b2c61159e977fd6617f29460436a730a1905fc`; genau ein Current-Facts-Profilpin entsprechend aktualisiert, übrige elf Pins und vollständige Referenzen unverändert. 13 gezielte Tests PASS; unabhängig ebenfalls 13/13 und vollständige Pin-/Reference-Prüfung PASS.
- Eine Stale-Keep-Alive-Ursache ist nicht bewiesen; zwei unabhängige lokale Node-24-Proben reproduzierten sie nicht. Der historische native Ausnahmegrund kann nicht nachträglich behauptet werden. Tatsächliche Heilung erst nach erfolgreichem geschütztem Staging-Abschlusslauf bestätigen.
- Bestehende SQL-/Katalog-/RLS-/Storage-/Rollback-Nachweise weiter gültig. Keine neue Infrastruktur, Datenbank, Kosten, Produktaktivierung oder Production-Schreiboperation. Funktionale Gleichwertigkeit weiterhin NEIN, solange Abschlusslauf und benötigte deaktivierte Runtime/Owner-Zuordnung nicht abgenommen sind.

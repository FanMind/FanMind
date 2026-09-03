<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# FanMind production, product truth and Codex guardrails

## Current production environment

- Production domain: `https://fanmind.ch`
- Production server: Exoscale instance `fanmind-prod-01`
- Production SSH user: `ubuntu`
- Production path: `/var/www/fanmind`
- Process manager: one PM2 cluster worker named `fanmind`, loaded from the stable `/var/www/fanmind-current` release symlink
- Reverse proxy: nginx
- Environment file on server: `/var/www/fanmind/.env.production`
- GitHub deployment workflow: `.github/workflows/deploy-fanmind.yml`
- Deployment runner: self-hosted GitHub Actions runner on Exoscale with labels `fanmind-prod`, `exoscale`, `linux`, `x64`

The old Cloudzy path `/srv/www/fanmind` and `systemctl restart fanmind` are no longer the production deployment path. Do not reintroduce Cloudzy-specific deployment commands.

## Production deploy command sequence

The deployment workflow deploys `main` on the Exoscale server with:

```bash
cd /var/www/fanmind
git fetch --prune origin main
RELEASE_COMMIT="$(git rev-parse origin/main)"
export FANMIND_RELEASE_COMMIT="$RELEASE_COMMIT"
FANMIND_SOURCE_DIR=/var/www/fanmind \
  bash scripts/operations/deploy-isolated-release.sh "$RELEASE_COMMIT"
```

Do not commit secrets. Keep `.env.production`, `.env.local`, API keys, Supabase keys, OpenAI keys, Stripe keys, runner tokens, and snapshot URLs out of GitHub.

## Source of Truth

- Canonical product and implementation truth lives in `docs/SOURCE_OF_TRUTH.md`.
- README is the reader-friendly project overview and must match `docs/SOURCE_OF_TRUTH.md`.
- Database/RLS truth lives in `docs/database/fanmind_current_schema.md` plus the Supabase migrations under `supabase/migrations/`.
- Mobile product, architecture and beta handoff truth lives in `apps/mobile/README.md`, `docs/mobile/ARCHITECTURE.md` and `docs/mobile/BETA_RELEASE.md`; Web and Mobile share backend contracts deliberately but never UI code.
- Security/RLS/Secrets checks live in `docs/SECURITY_RLS_SECRETS_CHECK.md`.
- Legal completion, the non-signature-ready AVV working draft and the
  technical retention inventory live in `docs/LEGAL_COMPLETION_STATUS.md`,
  `docs/legal/AVV_WORKING_DRAFT.md` and
  `docs/legal/RETENTION_REGISTER.md`. Keep implemented technical boundaries
  separate from external legal, tax, provider-contract, region and transfer
  approval.
- AI usage/cost monitoring requirements live in `docs/AI_COST_MONITORING.md`.
- AI reply-quality evaluation requirements live in
  `docs/operations/AI_REPLY_QUALITY_EVAL.md`. Keep prompts, replies, reviewer
  identities and tier-to-provider-model mappings outside Git. The repository
  may process only the bounded numeric review result under the ignored private
  directory, and a structurally valid result must never activate a tier.
- Workspace company-prompt and reply-profile requirements live in `docs/AI_PROMPT_PROFILES.md`; browsers may send only a selected profile ID to reply generation, while prompt contents are loaded server-side after Workspace authorization.
- Canonical AI tier policy lives in `src/config/aiTiers.mjs`; do not duplicate prices, referral eligibility, auto-send rules or automatic-booking readiness across UI files.
- The same file owns the fail-closed Workspace AI entitlement resolver:
  missing, unknown, client-controlled, inactive, future, expired or not fully
  ready Plus/Ultra state must resolve to Standard and must not expose Stripe
  references, models or quotas.
- Paid-tier readiness must remain tier-specific and fail closed until distinct
  server-side provider/fallback models, usage enforcement, Stripe lifecycle,
  quality/cost evaluation, Staging acceptance, legal/tax approval, productive
  runtime integration and explicit Production activation are all confirmed.
  Readiness output may expose only fixed blocker codes, never the underlying
  model, Stripe, evidence or secret values.
- Persistent paid-tier state belongs only in
  `workspace_ai_tier_entitlements`. It is service-role-only, a missing row
  means Standard, and its Stripe references must be reduced to the redacted
  resolver input before use. The Stripe webhook bridge must stay dormant
  unless its dedicated persistence gate, the server-owned Workspace contract
  and two distinct allowlisted Price IDs are explicitly configured; it must
  preserve Starter-only semantics and use the controlled event-ledger RPC
  after its separate gate. Equal-second conflicts must persist
  `reconciliation_needed`, never invent Event-ID order or retry forever. Do
  not wire the storage to productive AI execution before the staged rollout in
  `docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md`.
- Its SQL is checksum-pinned by
  `scripts/operations/ai-tier-entitlement-migration-runner.mjs`. A normal
  merge or Web deploy must never apply it; use the documented offline check,
  target-bound read-only verification and separately approved apply flow.
- The Operations Monitor component constraint is separately checksum-pinned
  by `scripts/operations/operations-monitor-migration-runner.mjs`. A normal
  merge or Web deploy must only install that root-owned runner and SQL; it must
  never apply the migration. Production verify/apply must use the manual,
  `main`-, environment-, runner- and release-bound workflow, the existing
  protected backup database connection, read-only audits before and after,
  and allowlist-redacted results.
- Production already has that migration and the ten-minute monitor timer
  enabled while operations email remains disabled. Keep timer, probe and the
  fixed `operations_monitor` warning/critical/recovery acceptance on one
  exclusive host lock. The lifecycle acceptance must remain main-, release-
  and Production-bound, must never synthesize a real host component, and must
  prove email as audited `noop` before it can pass. The regular monitor may
  persist only the normalized read-only active state of `nginx.service`; it
  must not read nginx configuration or journal output. Do not add a sampled
  CPU alarm without a separate sustained-load design and acceptance.
- Server-error tracking has a separate checksum-pinned Production control
  path. A normal Web deploy may install its root-owned runner, SQL and
  hardened units but must never apply the migration or enable tracking.
  Verify/apply/accept/activate actions must stay `main`-, Production-target-
  and release-bound, use the protected backup database identity, redact all
  diagnostics, prove warning/critical/cleanup only with a reserved synthetic
  fingerprint and keep `FANMIND_SERVER_ERROR_EMAIL_ENABLED=false`. Never add
  a public error-trigger route or include messages, stacks, headers, query,
  bodies, IP addresses, CRM content or secrets in acceptance output.
- The Stripe add-on policy in `src/lib/aiTierStripeLifecycle.mjs` and its
  dormant webhook/storage bridge must keep Workspace target, exact stored
  customer/base-subscription binding, distinct Price allowlist, complete
  single-item list, event-order and idempotency checks fail-closed; never log
  its internal Stripe mutation. The controlled AI event-ledger SQL remains
  unapplied until its own Staging gate. Never sort equal-second events by
  Event ID: atomically persist `reconciliation_needed`, make the paid tier
  fail closed and require a request-ID/fingerprint/revision-bound canonical
  Stripe reconciliation. A legitimate base-subscription rotation must bind
  the exact prior entitlement subscription and persist the canonical snapshot
  second as an ordering cutoff; direct service-role table writes remain
  forbidden after ledger hardening. Keep the bridge disabled outside the isolated
  staged rollout. The general Workspace billing fields now have a separate,
  controlled and still unapplied all-event ledger with a capture-only cutover
  stage; do not activate billing or Plus/Ultra before both ledgers, their
  shared canonical downstream operator and all remaining gates are closed.
- The manual AI-tier staging acceptance in
  `scripts/operations/ai-tier-staging-acceptance.mjs` is a rollback-only
  proof. Keep its independent write gates, synthetic owner/member workspace,
  Stripe Test Mode catalog verification, redacted output and private
  `PGPASSFILE`; never turn it into an automatic migration or Production job.
- Its separate resource-readiness mode is strictly read-only and may run
  before the migration. Keep it main-only, Staging-bound and write-disabled;
  it may verify only the Stripe Test catalog plus the synthetic owner/member
  workspace and must not inspect entitlement rows or apply SQL.
- Restore resource readiness is also strictly read-only. Keep it main-only,
  bound to the separate `restore-drill` environment, organization runner group
  `fanmind-restore-drill` and exact five-label `fanmind-restore-01` routing
  contract. Labels are scheduler selectors, not an authorization or
  host-readiness boundary. Every dispatch must fail in the GitHub-hosted
  validation job unless `FANMIND_RESTORE_RUNNER_SCOPE` equals
  `organization-workflow-allowlist`. The repository is organization-owned as
  `FanMind/FanMind`; the selected repository ID and exact three-workflow
  restriction were independently revalidated for protected read-only run
  `32582640853` on 2026-08-22. That live policy evidence is mutable and expires:
  revalidate it before every later R4 write. The variable remains only the
  operator assertion of that external fact, not an API proof. A secret-free prerequisite job must execute
  the root-owned, SHA-bound host gate before the protected job; both jobs need
  separate fresh one-job JIT runners. Its first checksum-only phase must never connect
  to PostgreSQL, decrypt a backup or invoke the restore runner. Only after
  that phase passes, the separate `restore:target:compatibility` step may make
  one connection to the explicitly confirmed isolated target with a private
  mode-`0600` passfile snapshot and `sslmode=verify-full`. That exception is
  limited to fixed `pg_catalog` queries for PostgreSQL major version and the
  migration-required role/extension counts and dedicated restore-user
  superuser status, with a server-enforced read-only session and redacted
  count-only output. Hosted direct Supabase databases and shared poolers are
  unsupported database targets; the database boundary must be an isolated,
  self-controlled PostgreSQL 17 cluster. Both restore write gates stay off;
  the step must never create roles/extensions, decrypt or restore anything.
- Once that external runner-group prerequisite is proven, the separate isolated
  database restore workflow is the only reviewed GitHub path that may enable
  the two restore write gates. Keep it exact-reviewed-commit-bound, on the
  protected `restore-drill` environment and the same group, exact five labels,
  runner-identity and two-JIT-runner host-readiness contract.
  It must re-run checksum readiness and PostgreSQL 17
  compatibility first, freeze the private age identity, passfile and CA
  without following symlinks, require TLS `verify-full`, restore the
  receipt-bound dump in one transaction, preserve the exact ACL/ownership
  contract, require a receipt-bound role and database-container match before
  writing, and upload only the three private receipts with short retention.
  The Full Backup Receipt contains the bounded required database role names
  for prewrite verification and must never be treated as a public/redacted
  artifact; runner, postcheck and final evidence remain name-free.
  The bootstrap restore login must be the sole additional LOGIN/SUPERUSER
  outside the source role component. Never upload plaintext, automatically claim
  disposable-target cleanup, or count database-only success as the complete
  Restore-Drill.
- Mobile release resource readiness is strictly read-only. Keep it main-only,
  bound to the selected protected `mobile-development`, `mobile-preview` or
  `mobile-production` environment and pinned to the reviewed EAS CLI version.
  It may use only `project:info` and `env:exec` to confirm the linked project,
  app identity and public client environment; it must never build, submit,
  update, load signing credentials or imply that a signed binary exists.
- The separate signed internal Mobile build workflow may queue exactly one
  `development` or `preview` EAS build only after the same read-only resource
  verification. Keep it main-only, environment-protected, credential-frozen
  and non-interactive; it must never target `production`, submit, update,
  create credentials or print build identifiers or artifact URLs. After a
  validated queue response it may poll only `build:view --json` and may report
  completion only when the exact commit, platform, profile, internal
  distribution, terminal success and HTTPS artifact all match. Once the queue
  request starts, an invalid or missing queue/completion response is
  indeterminate and must not be presented as safely retryable before the
  protected EAS project is inspected.
- A successful signed internal Mobile build may export only a short-lived,
  redacted private receipt without build ID or artifact URL. Real Android/iOS
  device evidence stays local, mode-`0600`, exact-main-commit- and
  receipt-SHA-bound; its validator may output only fixed counters and the
  evidence SHA. Push device checks remain optional until the separate Staging
  resource, migration and rollback-only acceptance gates have passed.
- Mobile push registration has a separate checksum-pinned Staging control
  path. Keep resource readiness read-only and separate from the explicitly
  confirmed migration apply. Every workflow must remain `main`-, reviewed
  commit- and protected `staging`-environment-bound and must compare API,
  Supabase and database targets against Production. Acceptance may use only
  dedicated synthetic non-demo owner/member/device identifiers, must prove
  browser denial plus service-role-only CRUD inside a fully rolled-back
  transaction and must prove cleanup. Never send a push, use a real Expo token,
  enable delivery, expose SQL diagnostics or secrets, or let a normal Web
  deploy invoke the migration runner.
- The dormant server-side Mobile push delivery contract is documented in
  `docs/mobile/PUSH_DELIVERY.md`. Keep it route-, timer- and worker-free until
  a separately approved service-role-only atomic delivery ledger exists. It
  must remain Staging-only, require independently reviewed EAS project,
  Staging app hostname, Staging Supabase target and Production Supabase
  reference bindings plus an explicit single-reminder confirmation, send only fixed copy
  plus a one-hour TTL, `type=followup_reminder` and `followupId`, and persist
  tickets/receipts before any success claim. The server-only target loader and
  `ledger.reserve` must consume the exact same already-validated Supabase
  URL/ref/key context, never a second global environment source. The future
  ledger reserve RPC must transactionally revalidate membership, processing
  eligibility, follow-up, contact, registration and its current token
  fingerprint before it reserves, and return that fingerprint plus the bound
  Staging project ref as revalidation evidence. A `DeviceNotRegistered` result
  must atomically terminalize the attempt and disable its registration under
  the held send or receipt lease; never split those writes. Never log provider
  text, tokens or CRM content;
  an indeterminate request must not be automatically retried. Production
  delivery is structurally blocked.
- Database trigger-function hardening has its own checksum-pinned controlled
  SQL under `supabase/controlled/`. A normal Web deploy and generic
  `supabase db push` must never apply it. Keep the proven Staging control and
  any Production control fully separate. The Production Web deploy may only
  install root-owned, non-enabled control artifacts; it must never start a
  verify or apply. Bind a Production action to `main`, the exact live reviewed
  commit, the protected `production` environment, the Production runner and
  explicit action-specific confirmation. Require the full read-only Production
  audit before and after it. Postflight must prove the fixed `search_path` and
  absence of `EXECUTE` for `PUBLIC`, `anon` and `authenticated`, including the
  retired optional retention trigger when it still exists. Output only fixed
  redacted codes. A Production apply remains a separate database mutation and
  requires renewed explicit approval; preparing, merging or deploying its
  control path is not approval to execute it.
- Referral Growth Window requirements live in `docs/REFERRAL_PROGRAM.md`.
- Referral attribution integrity has a separate checksum-pinned Staging
  verify/apply path documented in
  `docs/operations/REFERRAL_ATTRIBUTION_STAGING.md`. A normal Web deploy must
  never apply it. Keep read-only verify, explicit Staging apply and the
  rollback-only lifecycle acceptance separate, exact-main-commit-bound and
  protected by the `staging` environment. The lifecycle acceptance must
  require the attribution postflight first. Never enable Referral Billing,
  call Stripe, expose SQL diagnostics or target Production from this path.
- When updating pricing, scope, demo flow, integrations, referral logic, billing or AI model behavior, update all relevant reader files in the same PR.

## Current product truth

- FanMind is not a slide demo or throwaway mockup. Build and describe it as a real AI-supported CRM and communication system that is becoming production-ready.
- Canonical channel roadmap: Phase 3 contains Facebook, Instagram and WhatsApp; Phase 7 contains TikTok, X/Twitter, Discord and a non-binding OnlyFans evaluation. Phase 8 contains the Website AI assistant, iOS/TestFlight, LinkedIn and all remaining later platform connections. Only the disabled Website AI security/widget/message-ingestion foundation has started; dialog, escalation, email return path, iOS/TestFlight and later connectors remain deferred. This bounded Phase-8 foundation does not satisfy or block the current through-Phase-7 sales finishline.
- The word `Demo` means free test access or a prepared example workspace only. The product itself must look and feel like a serious CRM system.
- Current commercial truth: the paid Pilot/Setup package is retired. Permanent public paid offers are only `Starter Flex = 990 € one-time setup + 312 €/month` and `Starter 12 Monate = 0 € setup + 312 €/month with a 12-month minimum term, then monthly renewal`. The internal `internal_daily_test` is not a third catalog offer; an exceptional public beta window must be admin-started, fail closed and expire within 24 hours. Core includes one creator/workspace, KI Standard and 10 connections. Each additional five connections are planned at +49 €/month. KI Plus is +100 €/month; KI Ultra is +200 €/month. Agency remains Coming Soon: self-paying creators are managed without double billing; agency-paid creators use a 312 €/month Hub plus 0/5/10/15 % volume tiers. Referral applies only to Core and cannot be combined with an Agency volume discount. Do not reintroduce the old Pilot or 299 €/month pricing.
- Growth, Agency and Enterprise remain Roadmap / Coming Soon / Auf Anfrage unless explicitly scoped and validated.
- Referral Growth Window truth: planned until FanMind reaches 2.000 active paying customers/workspaces. During the open window, each active referred paying customer/workspace gives the referrer 5 % discount on ongoing FanMind costs; maximum 20 active referrals count per referrer; after the 2.000 cap closes the window, existing active discounts remain but no new additional discount percentages are earned unless the window is explicitly reopened.
- The frozen sales/demo flow is: landing page -> login/demo -> dashboard -> fans/contacts -> CSV import or Sandra/demo contact -> contact detail -> existing/latest inbound message -> AI reply suggestions -> copy answer -> save memory -> save follow-up -> follow-up list / roadmap.
- Active CRM core: login, registration, protected dashboard, contacts/fans, contact detail, CSV import, server-side AI reply suggestions, contact knowledge, follow-ups, roadmap, admin/billing groundwork, Stripe test checkout, legal pages, and temporary demo workspace.
- Active Mobile Phase B repository scope: independent Expo/React-Native app with native login, PKCE password recovery, secure session persistence and local purge, dashboard, contact list/search/create/edit/detail, bounded encrypted offline contact overview, contact knowledge, server-side AI reply suggestions, user-controlled copy plus native sharing of only the selected reply text, follow-ups, an explicit opt-in push registration and a dormant Staging-only server-delivery contract without route, timer, ledger or activation, a native wordmark splashscreen, distinct high-resolution iOS/Android app-icon assets, an iOS required-reason privacy manifest and Android API 36 verification. Store privacy drafts are technical preparation only; Supabase redirect approval, signed internal builds, push migration/secret activation, delivery-ledger approval, legal/portal approval, real-device verification and store distribution remain separate external release steps.
- Mobile Store metadata, branding, native identities and EAS profiles must pass
  `cd apps/mobile && npm run store:check`. Keep EAS CLI exactly pinned to the
  reviewed version and keep Android submission internal/draft until the
  protected Store account is explicitly used.
- Position FanMind as a Copy-&-Open assistant, not as a bot. AI prepares replies; the human reviews, copies, opens the original channel if needed, and sends manually.
- Any in-app sending flow, including Telegram, must be disabled, hidden, feature-flagged, or explicitly documented as a separate validated pilot before it appears in a normal Gerhard/Sales demo.

## Active product scope

Build FanMind as a real CRM core, not as a slide/demo shell. The active product scope includes:

- Login and registration
- Protected dashboard
- Contacts/fans list
- Contact detail page
- CSV import
- Server-side AI reply suggestions
- Workspace company prompt plus up to eight bounded reply profiles, with owner/admin-only mutation and server-side prompt resolution
- Contact knowledge
- Follow-ups
- Honest roadmap with clear active/in-progress/coming-soon status
- Temporary demo workspace for safe sales testing
- Admin/billing groundwork only where explicitly shown as setup/payment status, not as a broad payment platform

## Mobile product boundary

- Mobile source lives under `apps/mobile` with its own package, navigation, UI primitives, CI and release cadence.
- Never turn the Mobile app into a WebView wrapper or import Next.js routes, Website CSS or Website UI components.
- Mobile may contain only public Supabase configuration and the FanMind API base URL; service-role, OpenAI, Stripe, webhook and backup secrets remain server-only.
- Mobile password recovery accepts only `fanmind://reset-password`, must validate PKCE/token callbacks fail-closed and must never log recovery codes, tokens or complete callback URLs.
- Mobile contact create/update is Owner-only, must include the current `workspace_id`, rely on RLS as final authorization and never use a service-role key. Member sessions remain read-only until a separately reviewed atomic DB-RPC contract exists.
- Local logout must stop and drain cache writes, purge every registered FanMind SecureStore key and clear session, recovery and workspace state.
- The Mobile offline cache is read-only, account/workspace-bound, limited to 50 contacts and 24 hours, and may retain only workspace name plus contact identity/list metadata. It must never retain summaries, contact knowledge, messages, AI content, internal notes, follow-ups or credentials, and may be shown only for transport failures—not auth, RLS or server errors.
- Mobile push registration is explicit opt-in only, accepts one active device
  per authenticated non-public-demo user including authorized Workspace
  members, binds every operation to the resolved Workspace and every new token
  to the server-approved EAS project, stores Expo tokens only encrypted in the
  service-role-only table and removes the registration best-effort before local
  logout. Keep request bodies stream-bounded. The prepared route must remain
  delivery-free until the migration, dedicated encryption key, signed-build
  test, privacy review and Staging acceptance are complete.
- The canonical completed follow-up status is `completed`; `done` remains read-compatible only for historical rows.
- Mobile does not perform billing, referral reconciliation, admin operations, webhook ingestion, external channel credential handling or automatic sending.
- A Web merge cannot publish a mobile binary. EAS builds, signing, Android internal testing and iOS TestFlight require explicit separate verification.
- The first iOS release is intentionally iPhone-only. Do not enable iPad support
  until a separate layout, real-device and screenshot acceptance is complete.

## Hard stop rules

Do not build or present as active unless explicitly requested, tested and legally/technically validated:

- No real Instagram, TikTok, WhatsApp, Facebook, X/Twitter or Discord integration as generally active functionality
- No scraping
- No automatic sending
- No hidden in-app sending behind generic `copy/open` language
- No storage of external platform login credentials
- No campaign sending automation
- No full analytics suite unless explicitly scoped
- No enterprise role/permission complexity unless explicitly scoped
- No referral discount automation until `docs/REFERRAL_PROGRAM.md` acceptance criteria, billing logic and legal/payment terms are satisfied
- No fake live integrations, fake customers, fake testimonials or fake production numbers

Social integrations, analytics, campaign logic, referral automation and automation must remain clearly marked as Roadmap, Coming Soon, Beta / in preparation, or later pilot-feedback work unless the user explicitly changes scope. The user explicitly expanded the Meta scope on 3 August 2026 to per-workspace Facebook/Instagram messaging, own-content insights and communication analysis. The canonical boundary is `docs/integrations/META_CONTENT_INTELLIGENCE.md`: implementation may be prepared, but no Meta channel or analysis may be presented as generally live until tenant isolation, Staging, Meta review and the legal activation gate are complete.
- The two Meta content migrations have a checksum-pinned, Staging-only control
  path in `docs/operations/META_CONTENT_STAGING_MIGRATION.md`. A normal Web
  deploy must never call it. Keep the workflow `main`-, exact-commit-,
  protected-environment-, Production-target-difference- and TLS-bound. A
  repeated apply may skip only after the complete read-only RLS/privilege
  postflight passes; partial or drifted schemas must fail closed. Applying the
  schema must not connect Meta, enable analysis, submit App Review or imply a
  Production activation.
- Before any AI-tier, AI-tier Stripe-ledger, general Stripe-billing-ledger,
  Mobile-push, Meta-content, Meta-continuation or optional
  trigger-hardening
  Staging database action, use the shared read-only rollout-state workflow.
  It must compare the exact Supabase migration timestamps with the reused
  object postflights and may output only verify, skip, apply or block. Never
  infer an apply from a reported migration/table count, repair the ledger,
  invoke a generic migration push or repeat a direct-psql migration from this
  read-only path.
  Both Stripe-ledger Apply workflows must consume their exact shared
  absent/complete/partial result and require `apply` plus overall `PASS` on
  the same commit, target and passfile. The general ledger must keep its exact
  in-transaction schema verifier and the separately body-bound read-only
  postflight; a committed partial schema or a marker-only response is never
  success.
- The Meta conversation continuation columns have a separate checksum-pinned
  Staging control in
  docs/operations/META_CONVERSATION_CONTINUATION_STAGING.md. Keep its normal
  deploy path disabled, require the shared read-only rollout decision before
  apply, reject partial schemas, and verify the exact pair constraint plus
  browser-denied column privileges in a rollback-only postflight. Applying
  these columns must not activate Meta, analysis, the catch-up worker or any
  provider request.
- Meta content resource readiness is a separate read-only workflow that may
  run before the schema exists. Keep writes and apply commands disabled, bind
  the database user to `postgres.<staging-project-ref>`, require the IPv4-
  compatible Supabase session pooler on port 5432, accept only an absent or a
  fully valid current schema and fail closed on partial or drifting state.
- Every Meta customer connects their own external business account to their own workspace. Never reuse a FanMind operator account, silently select the first managed page, expose an encrypted token to the browser, or allow one active external resource to bind to two workspaces.
- Do not scrape or imply access to full follower lists. Only use own-account content/insights and people who actually interact through an authorized message, comment or other supported contact point.
- User voice learning may use only confirmed manual outbound messages, never AI drafts, notes or inbound fan messages. Fan analysis must exclude protected/sensitive inferences and carry source period, sample size, confidence and review state.
- The consent-gated Meta Pixel is an explicitly scoped marketing-measurement exception, not a product analytics suite: only `PageView` is active on the reviewed public-route allowlist, protected/dynamic CRM, admin and billing URLs plus unsafe query or fragment values and protected same-origin referrers are fail-closed excluded, the script must not load before consent, and no PII, CRM data, advanced matching, Conversions API or server-side Meta tracking may be added without a separate reviewed scope.

## Security, RLS and secrets rules

- Use `OPENAI_API_KEY` only server-side.
- Workspace-authored AI prompts may shape tone and grounded business guidance only; they must never override safety, truthfulness, privacy, schema, tenant, billing or manual-send boundaries, and their full contents must never enter usage logs.
- Never expose API keys in browser code, logs, screenshots, commits, client bundles, public env vars or documentation examples.
- Supabase anon key may be public; Supabase service-role key must stay server-only.
- `FANMIND_ADMIN_EMAILS` is the only admin source. No hardcoded real admin email fallback.
- RLS must be enabled and verified for workspace-scoped tables before any pilot customer data is used.
- Member JWTs must never receive the full `workspaces` row or
  `social_connections` secrets. Keep the parameterless member-safe Workspace
  RPC, exact safe DTO and Owner-only active-processing mutation boundary in
  `docs/operations/WORKSPACE_MEMBER_DATA_BOUNDARY.md`. A successful RLS
  postflight alone must never enable Member writes. Roll out app-first, then
  use only the separate protected Staging Apply and Verify workflows, real
  Chromium acceptance and final Verify; never use a generic migration push.
- Normal Workspace-Owner may directly update only the ten documented
  organization/address/tax master-data columns. Workspace creation and
  commercial fields must follow the two-phase RPC/privilege rollout in
  `docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md`. The final contract SQL
  stays under `supabase/controlled/` and must never be folded into a generic
  migration push; never reintroduce a broad authenticated `INSERT` or
  table-level `UPDATE` grant.
- Every protected API route must authorize the current user against the workspace and resource it reads or mutates.
- Referral data must be workspace-scoped; users must not see other users' referral economics except through admin-only views.
- Keep human-in-the-loop messaging: FanMind can draft and suggest, but must not automatically send messages.
- Run `docs/SECURITY_RLS_SECRETS_CHECK.md` before production-affecting changes, pilot customer onboarding, integration activation, referral activation or billing activation.

## AI safety, cost and implementation rules

- Prefer a configurable server-side AI model such as `FANMIND_AI_MODEL` with a safe fallback. Avoid hardcoding model IDs in multiple places.
- Keep structured outputs for reply suggestions, memory suggestions and follow-up suggestions.
- Limit input length, context size and request rate. The current MVP must protect OpenAI spend.
- AI usage/cost observability is active through `ai_usage_events`, the
  workspace usage view and the admin usage view: calls, estimated input/output
  tokens, model, feature, workspace, contact, status and estimated cost.
- Every productive AI entry point must use the canonical bounded-context and
  output policy plus a shared fail-closed short-window rate limit before a
  provider request. These are operational cost controls, not contractual
  Standard/Plus/Ultra quotas.
- Do not hardcode provider prices in UI copy. Keep model prices in server config and update them when provider pricing changes.

## Development expectations for Codex

Before changing code:

1. Inspect the existing implementation and routes.
2. Read `docs/SOURCE_OF_TRUTH.md`, `README.md`, and any relevant docs under `docs/`.
3. Preserve the current production deployment workflow.
4. Keep changes small, testable and aligned with the CRM/MVP scope.
5. Run the relevant checks locally when possible, especially `npm run build`.
6. Avoid broad rewrites unless the user explicitly asks for them.

After changing code:

1. Summarize what changed.
2. Mention affected files.
3. Call out any migration, environment, security, RLS, AI-cost or production-deploy impact.
4. Update reader/source-of-truth documentation if product truth, pricing, referral logic, demo path, integrations, billing or AI behavior changed.

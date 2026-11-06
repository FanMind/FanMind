# Meta Technical Read-only Reconciliation — 2026-08-26

## Result

The bounded FM-META-001 technical reconciliation is `COUNTERCHECKED_READ_ONLY_FOUNDATION` on exact GitHub `main` `966ffe3b105321e1350ec8c4fdb111341e99dd83` as observed on 2026-08-26. PR #1014 passed all seven triggered exact-head checks at `12a479f00cce95d0031970c98c2d3933477ab804`; its tree `03155ed292ce3b7230eab2aacac1e6fc5263de70` matched the squash-merge tree and merged as `ec1f196e82ab64a3b39b69a22a7b81b0757aa7a4`. Closeout #1015 merged as `d727b53470653844b50fa6a4ca2fc98f7fb2c89b`. The mutable Staging portion is registered as `EV-META-STAGING-FOUNDATION-20260826` and must not be treated as permanently current after expiry or an invalidation trigger.

This result confirms the current repository and the observed isolated Staging objects/metadata. It does not independently prove the ledger-managed continuation timestamp; the controlled catch-up queue is intentionally ledger-free. It does not constitute Meta Events Manager/Test Events, Meta Business/App Review, real provider-account E2E or legal acceptance.

## Scope and safety boundary

- PR/lock: #1014 evidence head `5b63b1e2de8fc37daaef5f26451d4f037d9cf65f`, final exact head `12a479f00cce95d0031970c98c2d3933477ab804`, squash merge `ec1f196e82ab64a3b39b69a22a7b81b0757aa7a4`; #1015 closeout head `355f1ce580045598527c51bff49d2a52c80275df`, merge `d727b53470653844b50fa6a4ca2fc98f7fb2c89b`; #1017 canonical freshness evidence head `dd8246efe399f03180c675b245cc7277d46060ca`; released `LOCK-FM-META-001-TECHNICAL-RECONCILIATION-20260826`; issue evidence comment `5430454777`.
- Local focused Meta/privacy/RLS/webhook/security tests: 95/95 passed.
- Direct Supabase inspection used only `BEGIN; SET TRANSACTION READ ONLY; ...; ROLLBACK;` and catalog metadata.
- Each protected GitHub workflow below was dispatched exactly once, sequentially, against the exact reviewed `main`.
- No Meta consent grant, PageView, provider call, OAuth/App Review action, SQL Apply, acceptance write, worker/queue activation, Production deploy/configuration, Supabase row/schema write, Restore, Mobile, AI or Security mutation occurred.

## Sequencing finding and correction

The direct transaction-level catalog inspection occurred before the shared
read-only rollout-state workflow had returned its classification. That order
did not satisfy the `AGENTS.md` requirement to run the shared rollout-state
check before any Meta Staging database action. It is recorded as
`FM-FAIL-015`, not hidden by the later successful result.

The impact stayed bounded: the direct inspection was server-enforced
read-only, selected only catalog metadata and rolled back; the later exact-main
workflow classified the schema as current with
`STAGING_DATABASE_ROLLOUT_STATE=PASS`; no Apply, row/schema write, runtime
activation or provider action occurred. No query or workflow was repeated.

Correction: no further direct Meta Staging catalog action is permitted under
this lock. Any future lock that permits one must first run and consume a fresh
shared read-only rollout-state result for the same exact commit and target;
`block`, partial, drifted, stale or mismatched results must stop before the
direct query.

## Direct Staging catalog evidence

Target: isolated Staging Supabase project `vshyhvgcmrlagvfnvomc`.

Freshness: point-in-time observation registered as
`EV-META-STAGING-FOUNDATION-20260826` (`provider_console`, 24-hour TTL). A
schema/ACL change, target/workflow-binding change or later Meta Staging
database action requires fresh classification under a new lock.

- `transaction_read_only=on`; transaction explicitly rolled back.
- All nine expected managed tables are present and have RLS enabled.
- `meta_conversation_catchup_jobs` has forced RLS, no browser policy and no browser write privilege.
- The other eight managed tables each expose one RLS policy and no `anon`/`authenticated` table write privilege in the direct catalog result; the protected content postflight separately accepted the required select-only policy contract.
- Both continuation columns are present with the expected nullable text/timestamptz types.
- Both Meta idempotency indexes and the catch-up coalescing index are valid/present.
- All three catch-up functions are present, `SECURITY DEFINER`, fixed to `search_path=pg_catalog, public, pg_temp`, executable by `service_role` and not executable by `anon` or `authenticated`.
- No application rows, contact data, content, tokens, messages or event payloads were selected.

## Protected exact-main workflow evidence

### Meta content resources

- Workflow: `meta-content-staging-resource-readiness.yml`.
- Run/job: `33007156552` / `98303773974`.
- Result: success.
- Fixed markers: `FANMIND_ENABLE_NON_PRODUCTION_WRITES=false`, `META_CONTENT_STAGING_SCHEMA=current`, `META_CONTENT_MIGRATION_POSTFLIGHT=PASS`, `META_CONTENT_MIGRATION_APPLY=not_requested`, `META_CONTENT_STAGING_RESOURCES=PASS`, `META_CONTENT_ANALYSIS_ACTIVATION=disabled`.

### Conversation continuation

- Workflow: `meta-conversation-continuation-staging-verify.yml`.
- Run/job: `33007311870` / `98304322162`.
- Result: success.
- Fixed markers: `FANMIND_ENABLE_NON_PRODUCTION_WRITES=false`, `STAGING_DATABASE_ROLLOUT_STATE_MODE=read_only`, `STAGING_DATABASE_ROLLOUT_STATE=PASS`, `META_CONVERSATION_CONTINUATION_APPLY=not_requested`, `META_CONVERSATION_CONTINUATION_POSTFLIGHT=PASS`, `META_CONVERSATION_CONTINUATION_POSTFLIGHT_TRANSACTION=ROLLED_BACK`, `META_CONVERSATION_CONTINUATION_BROWSER_ACCESS=DENIED`, `META_CONVERSATION_CONTINUATION_ACTIVATION=disabled`.

### Catch-up queue

- Workflow: `meta-catchup-queue-staging-verify.yml`.
- Run/job: `33007481167` / `98304886826`.
- Result: success.
- Fixed markers: `FANMIND_ENABLE_NON_PRODUCTION_WRITES=false`, `META_CATCHUP_QUEUE_APPLY=not_requested`, `META_CATCHUP_QUEUE_POSTFLIGHT=PASS`, `META_CATCHUP_QUEUE_POSTFLIGHT_TRANSACTION=ROLLED_BACK`, `META_CATCHUP_QUEUE_READY=YES`.

## Reconciled capability boundary

Confirmed now:

- The consent-gated, parameterless PageView-only Production path remains the accepted technical baseline from FM-EV-007 and issue #714.
- Current repository tests enforce the no-PII/no-Advanced-Matching/no-CAPI and public-route boundaries.
- The isolated Staging content, continuation and catch-up objects/metadata were observed present and fail-closed without runtime activation; the ledger-managed continuation timestamp was not independently proven, while the controlled catch-up queue intentionally has no Supabase migration-ledger entry.
- The former pre-activation checklist in `docs/analytics/META_PIXEL.md` was stale; Production ENV/build/deploy must not be repeated as an open prerequisite.

Still open:

- normal-browser Meta Events Manager/Test Events positive and negative evidence on the correct dataset;
- provider-side confirmation of no PII/Advanced Matching and no unexpected conversion events;
- legal/privacy final acceptance;
- Meta Business/App Review and real Facebook/Instagram account, webhook and conversation E2E under the later Social gate;
- a fresh same-commit/same-target rollout-state classification before any later Staging migration action: combine the continuation ledger timestamp with its objects as `verify`, `skip`, `apply` or `block`, and classify the intentionally ledger-free catch-up queue through its complete object/ACL/index/function postflight;
- synthetic Staging acceptance, worker/runtime activation or Production/provider mutation under a separate exact authorization.

## Do not repeat

Do not rerun `33007156552`, `33007311870` or `33007481167`, and do not repeat the direct catalog query merely to close this reconciliation. After the registered evidence expires, an invalidation trigger occurs or a later protected Meta Staging action is proposed, acquire a new lock and first run the shared same-commit/same-target rollout-state classification before any fresh database query. It must combine the continuation ledger timestamp with objects and treat the controlled queue as ledger-free with a complete postflight. Do not infer a completed migration or permission to Apply/Re-Apply from bare object presence. Do not reinterpret this read-only technical evidence as external Meta acceptance, legal approval or permission to emit events, apply SQL, activate workers, change providers or redeploy Production.

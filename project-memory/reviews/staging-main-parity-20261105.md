# FanMind: Main/Staging parity inventory and controlled convergence (2026-11-05)

Status: READ-ONLY INVENTORY / APPLY BLOCKED BY RECOVERY EVIDENCE
Owner intent: both environments should deliver the same approved functions. Production Main and all existing records must remain untouched. Never sync real customer records, auth users, secrets or production payment identifiers into Staging.

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

# Support #1350: reviewed backup authorization contract

## Scope and evidence boundary

Source-only correction from Main `63e8b0d656c4d0f14eaaa500a16cac65116380ee`. PR #1500 is the unrelated Creator-balance Draft and is untouched. No worker installation, backup execution, database apply, Restore, IAM change, boot or runner registration is authorized by this change. Existing archive formats, encryption, retention, storage/config backup implementation and release implementation are unchanged.

A read-only Production catalog query on 15 November 2026 returned: public definers **39**, restricted service-only non-trigger functions **29**, new-cohort functions **19**, exact reviewed definitions installed **39**, reviewed violations **0**. The seven previous additional definitions also returned zero violations. This establishes catalog admissibility only; it is not a backup or recovery success receipt. Private catalog rows, role fingerprints, dumps and function bodies captured from the database are not repository artifacts.

## Exact security contract

The existing 13/12 and 20/13 generations remain valid only when none of the 19 newly recognized functions is present. Presence is checked regardless of SECURITY DEFINER status, so conversion to INVOKER cannot silently downgrade a partial installation. The 39/29 generation requires every exact signature, return type, owner, search_path and configuration, language, volatility, strictness, leakproof/parallel flags, routine kind, set-returning flag, argument defaults, supported implementation fields, direct EXECUTE grants/grantor/grant-option and effective browser/service privileges to match. All 39 bodies are pinned, including the previous 20. Unknown functions, replacement slots, overloads and inherited privilege exposure fail closed.

Every body hash is independently reproducible from the public SQL source listed below. Exact LF and CRLF forms are permitted, without whitespace normalization. The historical create_chat_admin_fan variant permutes the same eleven INSERT columns and values together; tests reconstruct that exact permutation and reject any extra opaque digest. The optional trigger-hardening ALTER remains required in the 39 generation.

| Function | Direct EXECUTE in addition to owner postgres | Authoritative source |
| --- | --- | --- |
| `activate_public_demo_start` | `service_role` | `supabase/migrations/20260713180000_public_demo_abuse_protection.sql` |
| `admin_crm_read_allowed` | `authenticated`, `service_role` | `supabase/migrations/20260915221500_admin_crm_access.sql` |
| `admin_set_registered_user_crm_access` | `service_role` | `supabase/migrations/20260915221500_admin_crm_access.sql` |
| `chat_admin_media_writes_allowed` | `authenticated` | `supabase/controlled/chat_admin_media.sql` |
| `claim_admin_backup_job` | `service_role` | `supabase/migrations/20260718173000_enable_safe_backup_verification.sql` |
| `claim_expired_demo_cleanup` | `service_role` | `supabase/migrations/20260713180000_public_demo_abuse_protection.sql` |
| `claim_public_demo_start` | `service_role` | `supabase/migrations/20260713180000_public_demo_abuse_protection.sql` |
| `cleanup_server_error_events` | `service_role` | `supabase/migrations/20260718203000_privacy_server_error_tracking.sql` |
| `cleanup_shared_rate_limit_buckets` | `service_role` | `supabase/migrations/20260723102000_shared_rate_limits.sql` |
| `complete_demo_cleanup` | `service_role` | `supabase/migrations/20260713180000_public_demo_abuse_protection.sql` |
| `consume_shared_rate_limit` | `service_role` | `supabase/migrations/20260723102000_shared_rate_limits.sql` |
| `create_chat_admin_fan` | `authenticated` | `supabase/controlled/20261007102000_chat_admin_customer_tier.sql` |
| `create_chat_admin_fan_conversation` | owner only | `supabase/controlled/20260927200000_chat_admin_character_fans.sql` |
| `current_admin_crm_access_state` | `authenticated`, `service_role` | `supabase/migrations/20260915221500_admin_crm_access.sql` |
| `fail_public_demo_start` | `service_role` | `supabase/migrations/20260713180000_public_demo_abuse_protection.sql` |
| `manage_meta_webhook_event_retention` | `service_role` | `supabase/migrations/20260723184500_webhook_diagnostic_retention.sql` |
| `manage_server_error_event_retention` | `service_role` | `supabase/migrations/20260723184500_webhook_diagnostic_retention.sql` |
| `persist_chat_admin_confirmed_reply` | `authenticated` | `supabase/controlled/20260927200000_chat_admin_character_fans.sql` |
| `persist_chat_admin_generation` | `authenticated` | `supabase/controlled/20260927200000_chat_admin_character_fans.sql` |
| `record_server_error_event` | `service_role` | `supabase/migrations/20260718203000_privacy_server_error_tracking.sql` |
| `support_centre_ack` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_centre_case_notification` | owner only | `supabase/controlled/support_centre.sql` |
| `support_centre_check` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_centre_decide` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_centre_finish` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_centre_inbox` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_centre_notify` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_centre_recover` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_centre_report` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_chat_delete_notification` | owner only | `supabase/controlled/support_centre.sql` |
| `support_chat_erase` | `service_role` | `supabase/controlled/support_centre_operations.sql` |
| `support_chat_handoff` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_chat_page` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_chat_privacy_state` | `service_role` | `supabase/controlled/support_centre_operations.sql` |
| `support_chat_read` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_chat_review` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_chat_send` | `service_role` | `supabase/controlled/support_centre.sql` |
| `support_retention_health` | `service_role` | `supabase/controlled/support_centre_operations.sql` |
| `trim_conversation_messages_to_latest_50` | `service_role` | `supabase/migrations/20260614120000_conversation_message_retention.sql` |

The 18 Support functions use an empty search_path and qualified application tables. Sixteen are service-role-only: their actor/workspace parameters are trusted server inputs, not browser capabilities. Owner operations validate support ownership; chat operations bind actor/workspace/thread and relevant consent/revision state. The two row-bound notification trigger helpers remain owner-only. The media helper is authenticated-only and derives its boolean from auth.uid(), canonical Workspace authority and deletion exclusion. It must not acquire service_role EXECUTE. Existing public-source functions with older public search_paths retain their exact reviewed configurations; this patch grants no new privileges.

`support_centre_purge` is an INVOKER function and is deliberately excluded. Consent helper names outside the current 39 are not substitution slots. Function-body pinning is a bounded admissibility review, not a replacement for application functional security acceptance.

## Regression proof

- Unit tests exercise all three valid generations, partial cohorts, unsupported counts, unknown/replaced functions and invalid invariant metrics. Every allowed digest must be source-derived.
- Full-backup, database, runner/postcheck and final-evidence readers preserve exact cross-receipt equality and accept restricted count 29 alongside historical 12/13. No receipt version or archive field is invented.
- The existing native PostgreSQL 17 CI roundtrip is extended with the public-source 39 definitions, actual catalog/ACL mutations, dump and restoration to another empty database in the existing CI target container. No additional infrastructure or Supabase project is used.
- The native fixture disables body checking only during definition creation against synthetic table stubs. It proves metadata/body/ACL boundaries and dump/restore, not Support execution behavior. Existing functional Support/media suites remain required. Local service-container skips are never reported as native passes.

## Minimal worker installation and rollback plan — BLOCKED

1. Resolve the reviewed source/merge commit and successful native CI. Independently inspect the installed authorization module SHA256, worker unit/entry point, current application/release.env identity, ownership/modes, queue and active backup processes under the shared Production host/resource lock. Missing old file hashes are a hard stop; none are fabricated in this plan.
2. Preserve a root-only exact rollback copy and its hash before replacement. Stage only the reviewed `database-authorization-contract.mjs` into the existing operations bundle, retaining root ownership and mode. Worker entry point, worker.env, pgpass, rclone.conf, age recipients, archive directories, retention and application files must remain unchanged.
3. The running Node process caches imports: a controlled restart of only the backupworker is necessary to load the corrected module. That service action and installation require a separately bound Owner approval. Prevent timer/queue races using the existing protected procedure; no automatic enqueue or backup execution is part of installation.
4. Verify installed hashes, service identity, heartbeat, preserved release.env, queue and read-only catalog result. Any unexpected file/application/permission change stops the procedure. Roll back only the exact saved module bytes and restart only that worker, with a postflight hash/heartbeat check. Preserve failure evidence and archives.
5. Actual database/full backup execution is a second explicitly approved operation. Require encrypted archive/checksum pair, validated dump/ACL receipt, offsite transfer proof and later isolated restore evidence before declaring recovery readiness.

The existing protected worker workflow/controller is pinned to historical worker and application commits. It must not be dispatched with forged identities or relaxed checks to install this correction. A current, reviewed source binding plus installed-controller hash/availability must be established first. This PR does not alter that historical controller or bootstrap and cannot claim a fully executable Production approval until those facts are known.

## Offsite, private media and recovery dependencies

The configured rclone remote name is not evidence of a storage provider. Existing worker uploaded receipts do not independently establish current remote bytes or delivery to the Restore host. Use the existing read-only remote retention/inventory path to confirm complete age/checksum pairs, then independently verify encrypted bytes with bounded checksum reads. Emit only redacted provider/endpoint/bucket metadata and counters; never raw rclone config, credentials, object names or private contents. No remote deletion/sync/overwrite is allowed.

The current storage backup implementation enumerates only fanmind-assets. Before storing productive private media, extend the existing archive path with a versioned per-bucket manifest for chat-character-media: bucket privacy/config, object count/size/hash, collision-free bucket-prefixed archive paths, encrypted output and per-bucket authorization/restore checks. Retain historical manifest compatibility and test denied cross-bucket access, traversal, missing objects and hash mismatch. This is a prepared addition, not an enabled backup job or a claim that the private bucket is protected.

Recovery IAM needs a separately reviewed renewal of the existing expired time condition, retaining default deny, exact existing Restore-instance/zone/template bindings, existing operation allowlist and short fixed expiry. No wildcard, group expansion, new key, actor or server is justified. An independent server-side Exoscale control channel and matching rescue profile must be proven before boot. Restore Ubuntu autostart protection, private/volatile evidence inventory and rollback-to-rescue remain prerequisites. No boot input or PostgreSQL start is allowed by this source PR.

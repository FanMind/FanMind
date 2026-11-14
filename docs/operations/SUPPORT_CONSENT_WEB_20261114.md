# Support Web completion and consent — 14 November 2026

Issue1350. Owner authorizes development, checked merge, separately protected
Staging schema control/deployment and actual Desktop acceptance. No new
Production activation or binding public legal text is approved by that scope.
Main8db6c86d/#1490 is retained; no Character/Media/Meta/Billing code is modified.

## Owner release decision

For Support1350 and Adminchat1425, actual mobile browser/device acceptance is
**VERSCHOBEN – APP-ABNAHME**, not PASS and not a Web release blocker. Existing
automated responsive/mobile regression remains mandatory. No viewport attempts
or Android/iOS feature development belong to this task. Actual Desktop Web,
security, function and privacy acceptance remain mandatory on each release target.

## Registration and existing accounts

RegisterClient currently shows a privacy-information link and creates an Auth
account; paid Workspace setup and its separately versioned payment terms occur
later. Neither establishes the optional Support-AI consent. Existing session-only
Support choices have no durable consent record and are not migrated as grants.
The legal text currently says Support consent is asked again after reopen/reload.
The review and proposed replacement are in docs/legal/SUPPORT_AI_REVIEW_DRAFT.md.
No AGB acceptance is manufactured and no compulsory registration checkbox added.

New and existing accounts follow the same first-use choice under the compact
KI & Datenschutz section or /settings/support, linked from Profile & Konto.
Checkbox starts off when no current verified record exists. Declining retains
local Help. A valid record is restored on later panel mounts, focus and sessions;
version changes fail closed. The sender is simply Senden. Detailed information,
withdrawal and privacy link remain directly accessible in the collapsed section.
There is no Model/Fan context, selection, analysis, style mutation or undo.

## Durable evidence, authority and withdrawal

One service-RPC-only row per Auth user stores granted, text version, server
clock grant/revoke times, monotonic revision and idempotency request UUID.
It is a current-decision proof, not an append-only legal history. Text v1 is
archived by this checked source; changing scope/text requires a new version.
Row absent means no consent; old AGB, user_metadata, checkbox payload or another
actor's data cannot authorize provider processing. Regrant replaces current
proof; no full historical ledger is claimed. New-account FK deletion cascades.

Server derives actor and current Workspace from authenticated Support identity.
The consent is for the user's own bounded Support questions, across their own
authorized Workspaces; it never grants access to another Workspace. Stored
history remains current-Workspace scoped. Raw Fan/Persona/media and retired
Creator records are excluded as before. Grant/revoke accepts only the fixed
version, exact scope, confirmed decision, request ID and current revision.
Database advisory/row locks serialize competing decisions; stale clients cannot
overwrite a newer revocation and replay of an old grant is denied after revoke.
Readback must independently match before UI reports a saved decision.

Every AI request on enabled targets re-reads the current server decision BEFORE
provider access. A stale client boolean never restores permission. Consent revision
is re-read after a provider result; revoked/changed results are not persisted as
successful answers. Local withdrawal aborts pending work and suppresses late UI.
A request already transmitted before withdrawal cannot be recalled from a provider;
no such guarantee is claimed. No future provider call is authorized by stale UI.
An uncertain write is shown as unconfirmed; refresh reads actual state, never
speculatively retries a write. Export includes current consent evidence; history
erasure remains separate and does not silently change account consent.

## Controlled additive schema

supabase/controlled/support_ai_consent.sql is never part of automatic migration
or normal Web deployment. Existing Support Customer Staging Acceptance workflow
has a separate default-none consent_schema_action=verify/apply path. It requires
reviewed Main=github.sha, protected staging environment, shared Staging lease,
explicit support-ai-consent-staging-only confirmation, pinned SQL SHA, exact
Staging API/project/session-pooler user/TLS identity and expected live release.
The schema path does not run customer/provider/browser acceptance and those
existing actions never install a schema. Verify distinguishes ABSENT from PASS;
apply creates once transactionally, then verifies schema/ACL/function bodies.
Drift is blocking; no table/column/role repair is attempted.

Native mandatory PG17 suite covers browser/service direct denial, own actor
proof, second actor isolation, repeat request, stale CAS, revoke/old-grant replay,
version mismatch and Auth-user-delete cascade. Route tests cover foreign fields,
scope/Origin/auth/readback, stale client AI denial and withdrawal during response.
Existing Support privacy/lifecycle/tenant, public AI and responsive fixtures remain.

Apply additive schema on Staging BEFORE deploying enabled Staging source.
Until then existing deployed source is unchanged. Runtime gate: enabled on
isolated Staging; Production stays legacy session-consent unless the exact
FANMIND_SUPPORT_PERSISTENT_CONSENT_VERSION=support-ai-20261114-v1 is explicitly
set under separately approved protected release/configuration. This variable is
not a legal approval; legal release evidence remains separately required.
Production must install/verify the reviewed schema before enabling that value.

Rollback: use existing exact-release snapshot controller; retain the additive
consent rows. Never drop a consent table or restore a shared database to roll
back a Web build. Prior Help defaults to per-session explicit opt-in, not silent
provider authorization. Current consent proof retains only the latest account
choice until account deletion; legal review must approve/narrow that criterion
before Production activation. Existing 30-day message retention is unchanged.

## Production preparation and acceptance

After checked merge/schema/deploy: actual Desktop new/missing/existing consent,
reopen/reload/session continuation, real neutral AI response, server-side revoke,
unknown result, own-history/export and exact synthetic cleanup. Reuse current
source/deployment evidence; no mobile live gate. Prepare full Main-to-live
manifest including already merged Adminchat source, current checks and expected
Production version. No schema/provider/Billing/media activation follows from
source inclusion. Legal draft/purpose/provider-transfer/retention signoff and
explicit exact-version Production authorization remain separate decisions.

This source preparation records implementation only, not completed Staging or
Production acceptance. Concrete run IDs, targets and cleanup belong in Issue1350.

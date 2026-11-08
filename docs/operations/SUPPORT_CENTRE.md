# Support assistant and KI-Support-Zentrale — #1350 / #1416

## Staging continuation, 8 November 2026

On live6d0eb20c, HTTPS same-origin Support POSTs returned403 before authentication
while the corresponding GET returned401. The legacy nextUrl.origin comparison
used the proxy-internal application URL. All seven Support mutation routes now
reuse the existing canonical configured-origin/Fetch-Metadata check, as the public
information chat already does. Foreign/missing origins and cross-site requests
remain denied; identity, consent, scope, Owner, rate and feature gates are unchanged.

The separate protected `support-customer-staging-acceptance.yml` uses existing
synthetic customer credentials for two isolated Workspaces. It binds current main
and the actual deployed release, rejects any pre-existing conversation fixture,
uses real customer cookies for every tested API, and never accepts a service key.
PostgreSQL is used only read-only to verify synthetic fixture identity, consent
and independent physical cleanup. It tests persistence, UUID replay, older-page
cursors, own export/erase, foreign scope/thread denial, direct browser-role denial,
logout and the existing desktop/mobile help launcher. No provider or email call,
schema apply, permission or credential change occurs. Logs contain fixed markers
only; no traces, screenshots, session values or conversation artifacts are uploaded.
A missing launcher is explicitly BLOCKED, never converted into API-only UI PASS.
Full Owner/Admin role acceptance and organization/privacy/retention scheduling
remain separate evidence gates; this source change alone establishes none of them.

Repository implementation; runtime defaults off. On2026-11-05 the Owner selected Production for the schema-only rollout; the seven-table Support schema is installed and verified there. No application deployment or runtime activation is implied.

## Scope and reuse

The existing public Website Chat AI, installation/session/consent/origin binding,
Widget, Inbox and handoff are reused. The existing authenticated help launcher,
connection diagnostics, customer-confirmed repair executor and repair audit are
reused. The separate Admin Chat, Builder and Open Questions PRs are unchanged.
The current continuation extends the same PR #1416, not a parallel implementation.

## Owner centre

`/admin/support` uses the existing verified login and platform Admin policy.
Platform Owner additionally requires the exact user UUID in the separately
provisioned `support_centre_owners`; workspace ownership/user metadata never grants
platform ownership. Admins can inspect a selected Workspace; only Platform Owners
receive the global coarse notification inbox and make approval decisions.

The centre contains Dashboard, case diagnoses, expiring one-shot approvals,
combined existing sync-repair audit plus central check history, append-only case
activities and customer-consented transcript review. The transcript review requires
exact Workspace/thread binding and a recorded consent snapshot, never a broad
customer-message query.

Critical/failed checks, incomplete audits, failed legacy sync repairs, authenticated
attempts to cross the Owner boundary and explicit customer handoffs create fixed,
deduplicated notifications. Pending approvals also create inbox records atomically
through the case trigger. Routine successes stay in history. The inbox prioritizes
critical open entries before applying its 100-row limit; acknowledgements are
Owner-only, recorded with actor/time, and a recurring incident reopens the entry.
No message text, raw provider error, IP, credential or free-form log enters the
notification. Anonymous/bad-Origin requests cannot flood this inbox.

Full database failure cannot be durably reported into that same database: routes
fail closed, UI shows unavailable, and incomplete started checks remain available
for reconciliation when the database returns. No notification-delivery success is
claimed on a failed write. Existing independent infrastructure monitoring remains
necessary for host/database outages; no new infrastructure is created here.

## Bounded automatic correction and recovery

- Existing automatic status refresh and safe re-probe remain read-only and are
  now rate limited. Connected status plus a synchronization error is correctly
  attention-required, not a false successful check.
- Approved central reads keep exact Owner/Workspace/connection/expiry binding,
  atomic one-time consumption and a separate fresh postcheck.
- Automatic maintenance expires stale pending approvals and marks interrupted
  running checks failed with audit, without retrying the old approval or making
  any provider call. Each pass locks at most 100 rows and is idempotent. It runs
  while the authenticated Owner centre is open; there is no hidden new worker.
- Existing explicit customer confirmation for sync restart is unchanged. No OAuth,
  permission, credential, disconnect, Production or customer-content repair is added.

## Authenticated conversation continuity

The help panel uses `/api/support/conversation`. Actor and Workspace derive from
fresh verified server auth for every read/write. A server-derived opaque scope
binds pending requests; caller-supplied Workspace/actor identifiers are rejected.
Threads and turns are private to the exact user+Workspace tuple. Browser database
roles have no direct table or RPC access; only the bounded server adapter writes.

Questions/answers persist server-side for up to 30 days, newest 100 per page with
an exact own-turn cursor for older pages. Each send uses one UUID; ambiguous
responses retry the same immutable payload, with an atomic DB duplicate check.
Changed payload under the same UUID is rejected. Per-actor/Workspace rate limiting
and a serialized 100-turn/day DB bound protect storage. No localStorage, sessionStorage
or third-party provider is used for authenticated conversation persistence.

Account/Workspace changes, logout, navigation/pagehide, auth failures and late
responses clear or invalidate private client state. Polling and focus revalidate
identity even during a pending retry. Owner transcript views likewise clear on
failed verification, lifecycle changes and superseding requests.

Answers are bounded approved FAQ guidance; prices/included connections derive
from the canonical commercial model. Unknown questions receive a transparent
fallback. The existing public AI route remains the separate provider-backed path;
this increment introduces no new provider call or claim of open-ended model reasoning.

Customer handoff requires a separate explicit click. It records a timestamp and
monotonic turn-sequence snapshot; review excludes all later messages, including
under clock changes. Newer messages require a fresh handoff. Technical diagnoses
can be handed off separately without sharing conversation text.

## Controlled storage and activation gates

`supabase/controlled/support_centre.sql` remains UNAPPLIED, outside normal migrations
and deployment. `FANMIND_SUPPORT_CENTRE_ENABLED` defaults off; existing help,
diagnostics, Website AI and repair flags retain their separate gates. No Owner is
provisioned, grant installed on a live target, migration pushed or provider enabled.

The controlled purge removes terminal cases/events after 30 days, expired pending/
running metadata after the 31-day reconciliation period, chat turns/idle threads
and notifications after 30 days. Account/Workspace deletion cascades private chat
and cases. The purge is denied to browser and app service roles; no scheduler is
installed. Before activation an approved maintenance operator, daily physical
cleanup, monitoring and deletion evidence are mandatory. Read filtering is not a
physical deletion proof. New support text is personal data, not anonymized metadata.

Runtime activation also requires updated processing/privacy information and an
operational subject-access/export process including support conversations, plus
actual Staging verification of identity/role changes, isolation, consent snapshots,
retention/cleanup and storage failure. These operational/legal gates are separate
from code merge; no legal certification or real-data permission is inferred.

## Verification

Existing Website Chat policy and native Authorization PG17 CI own the added tests;
no package, lockfile or workflow is changed. The native test uses its own synthetic
database and proves roles/RLS, tenant and actor separation, expiry, concurrent
single-claim, idempotent send, consent cutoff, global Owner-only notices, recovery
without replay, retention and database cleanup. Desktop/mobile tests use the actual
centre and actual chat/inbox components, including ambiguous retry, persisted reload,
account switch and transcript clearing after authorization failure.

Independent QA, Security and Privacy review must cover the final exact head. All
required CI and repository rules must pass before the expressly authorized merge.
Staging Readiness is checked after merge; deployment needs separately applicable
existing authorization and exclusive target ownership. Production is excluded.

## Postmerge Staging continuation (2026-11-04)

PR #1416 is merged at f8ed24bd12c3445732abcd46b9d3f42bfad55334; the
source/test acceptance above remains completed. The new operational continuation
is described in [SUPPORT_STAGING_ROLLOUT.md](SUPPORT_STAGING_ROLLOUT.md) and
[SUPPORT_PRIVACY_PROCESS.md](SUPPORT_PRIVACY_PROCESS.md). It adds an audited,
volume-guarded operator-only purge, independent full-schema reference, scope-bound
own-data export/erasure and Owner retention health. This supersedes only the older
purge/activation description, not the finished product implementation. Existing
required CI suites own new focused/native/browser tests; the established protected
Website retention workflow is extended with a separately gated Support component.
No source, workflow or document is evidence that live Staging schema, daily
scheduler, Owner binding, privacy operations or final runtime acceptance is complete.

## Owner-selected Production schema installation (2026-11-05)

The Owner replaced Staging with Production as the schema-installation target.
The exact reviewed main0a965fd49d9552326c2ff96952b37282b7dac63a SQL was applied once to Production drqkpdvtbbrrdwmtrodz through a separately reviewed, fixed-target connector path. The Staging-only runner and its Production exclusion remain unchanged.
Full catalogue/body/ACL postflight equals the independent pinned PG17 reference;7tables,20functions,2triggers,1sequence; all seven tables empty and RLS-enabled. Migration20261105115731 records this installation.
This supersedes earlier UNAPPLIED/Production-excluded statements only for these Support schema objects. Staging remains absent and was not applied. No Owner binding, runtime feature flag, deletion/retention schedule, provider action or application deploy was performed.
Operational privacy/monitoring, exact Owner approval, actual runtime and end-to-end acceptance remain separate/open. Issue1350 is not closed by the schema result.
Evidence and authorization/recovery: [Production schema receipt](../../project-memory/receipts/support-production-schema-20261105.md).


### Staging customer launcher continuation

Run 42508753887 on 60f305f17368bdd3fbd8f5cb1e9c4c389235e2ad passed both customer API sessions, tenant/privacy negatives and independent cleanup, but correctly failed browser UI acceptance because the launcher build flag was absent. The protected Staging build now explicitly enables the existing customer launcher; server-side diagnostic and repair flags are unchanged. `ui_only` retests persistence and reopen with new synthetic conversations, then own erasure and independent read-only cleanup. It does not repeat or relabel the previous full privacy/tenant suite and avoids unnecessary privacy rate-limit consumption. Production build configuration is unchanged.


### Read-only runtime prerequisites (08.11.2026 continuation)

The existing `verify-support` action now reports only booleans for the actual running process: widget session-secret readiness, diagnostic/repair flags and email configuration presence. It never returns secret values, switches flags, restarts the service or writes a fixture. The same process snapshot supplies the existing Support flags. Configured does not prove positive widget acceptance, provider repair, mail execution or delivery. Exact main/live release, Staging target, Owner binding and external-delivery-off gates remain unchanged. Existing true/false readiness is not approval to activate diagnostics/repair on real connections or create a missing secret.

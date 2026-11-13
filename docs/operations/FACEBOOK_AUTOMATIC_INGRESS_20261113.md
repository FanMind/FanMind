# Facebook automatic ingress — preparation, 13 November 2026

Existing Issue #1464; successor to merged #1465. Owner requests preparation and
safe implementation up to the next protected decision. No new merge, deployment,
Meta activation, permission, shared callback or database action is inferred.

## Fresh target and provider evidence

Browser observations at approximately 13:50–14:00 Europe/Vienna:

| Item | Actually observed |
|---|---|
| Main base | 3912461e1f88eb5cf2e621f23e4d6079409c20cc, includes PR1465 plus PR1469 media source |
| Staging runtime | d34834979cef30c9c6af567d61b3df448901bfda, runtimeEnvironment=staging |
| Production runtime | a798d7938bb4e7e168f615f0c32d1a603dd47d4a, runtimeEnvironment=production |
| Meta App | FanMind, 2214477125984114, Development / unpublished |
| Page object callback | https://fanmind.ch/api/webhooks/meta — shared Production endpoint |
| Page object fields | feed and messages subscribed, v25.0; message_echoes disabled (v27.0 default shown) |
| App Review | Not submitted; pending requests include pages_read_user_content, pages_show_list, pages_manage_metadata, pages_messaging, pages_read_engagement, public_profile and read_insights |
| Business verification | FanMind: not verified |
| Messenger permissions UI | pages_manage_metadata, pages_messaging, pages_read_engagement, pages_show_list: ready for testing, not proof of general Advanced Access |
| FanMind Staging binding | One connected Page1208778912321696; persisted webhook_subscribed=false; encrypted credentials not selected |
| Legacy DM mapping | Aggregate-only DB check:1 private history,1 thread ID,1 matching Page provenance; candidate can reuse the accepted Graph thread without exporting its original link |
| Existing persisted data | 3 conversations / 6 distinct external message IDs: 2 private DM,4 comments across2 posts |
| Operator | Actual continuation button reached authenticated Dashboard without credential export; full historical rotation/logout acceptance reused, not repeated |

The database postflight read the actual partial unique indexes on
(workspace_id, source_platform, external_message_id) and the corresponding
external_comment_id key. No database write was made. The Page's live
`subscribed_apps` response was not independently obtained in this run; the
persisted false value is an application gate, not proof the provider edge is
empty. The UI's Messenger permission button starts OAuth, so that flow was left
without consent/subscription changes. No WellFit selection or connection.

## Source changes and actual regressions

Independent execution reproduced these old-source defects with synthetic input:
recipient could override envelope Page; a Page status post could be stored as a
comment without a stable external ID; removed comments were treated as inbound;
webhook Page:sender IDs could split an existing Graph thread; equal URL fallback
could merge explicit thread boundaries. These are source reproductions, not
actual Facebook event receipt.

The existing route and processor now:

- bind Page HMAC to Facebook App secrets and Instagram HMAC to Instagram App
  secrets; explicit META aliases remain shared-App trust and must represent
  the same authorized App identity. A provider-specific secret cannot
  authenticate the other object type;
- keep challenge verification and HMAC verification; bound declared/chunked
  bodies to1MB and5seconds, cancel failed streams and redact thrown failures;
- accept Page/Instagram envelopes only, use envelope platform authority and
  require Messenger sender/recipient/Page consistency and message ID;
- import Facebook feed only for new `item=comment,verb=add`, a fan sender,
  complete comment identity and an own-Page post prefix; ignore posts, removals,
  edits and own-Page comments rather than inventing messages;
- treat inbound `messages` subscription as ready without optional outbound
  `message_echoes`; preserve an existing feed/echo subscription during explicit
  subscription, and do not request echoes by default;
- require exactly one active Page mapping before processing; duplicates fail
  closed even if only one has its subscription flag enabled. Disabled mapping
  is ignored; secret columns are unnecessary for lookup;
- reuse a verified same-contact/Page Graph DM thread or a canonical Page:sender
  thread across both manual sync and webhook ingestion. Unbound or ambiguous
  historical mappings fail explicitly instead of guessing a second thread;
- prohibit equal-URL/unthreaded fallback across explicit source/thread IDs;
- retain provider timestamps, external-ID deduplication and original comment
  targets; duplicate receipts are reported skipped, not newly saved;
- repair a failed inbox-summary update from latest persisted messages on replay,
  and use latest persisted chronology for delayed new events. Duplicate repair
  does not reopen a completed conversation or invalidate its AI workflow state.

No provider send, automatic AI analysis, history fetch in the request, catchup
worker activation, new DB/schema/permission or Operator implementation is added.
The shared persistence helper is also used by other existing import paths;
related regression checks remain required. Instagram envelope behavior is tested
synthetically only; no live Instagram acceptance is claimed.

## Evidence and remaining reliability boundaries

The executable cases run the actual parser/processor, signed HTTP route and
extracted production storage functions with synthetic adapters. They cover
malformed/unmapped/ambiguous/disabled/foreign sources; two posting histories;
verified legacy DM resolution; replay/error recovery; timestamp order; exact
comment links; chunked/oversized/stalled requests and generic retry responses.
An independent in-memory mutation of the add-comment guard makes its negative
case fail; no repository/live protection was disabled.

Local focused115/115, full Next build/TypeScript and affected ESLint passed. Independent Guardian126/126 (successor recheck; earlier89/89) and an independent guard-mutation negative passed. Governance/adversarial123/123, God Mode preflight, Project Memory quality, truth/drift and diff whitespace checks passed. Full current-head hosted CI remains required. The initial published head42eb2351 completed the inherited Mobile job with a genuine Expo Doctor failure:9 package patch mismatches. The existing PR1470 already owns exactly that repair; this Facebook PR does not duplicate it or disable the check. A green required Web gate does not erase that red shared dependency. The local
broad Operations run encountered unrelated root-mode host-policy expectations
and missing rsync, so it is not a complete Operations PASS. Its affected older
comment fixtures were corrected to contain the real required `verb=add` field;
no visibility or provenance assertion was removed. Full exact-head hosted CI
remains the authoritative full-suite gate.

Current external-ID indexes protect message rows. They do not prove atomic
first-contact/conversation creation or atomic inbox projection under concurrent
first deliveries. Read/latest/update is not a database transaction. Concurrent
new-contact and delayed-writer QA is a remaining Production gate; do not claim
strict exactly-once contact creation or universal atomic ordering. Any necessary
controlled database hardening must be separately reviewed and approved; no
constraint or migration is silently applied here.

## Next protected decision — isolated Staging only

Do not subscribe this Page on the existing app and expect Staging delivery:
its Page callback points at Production. Do not change that common callback,
forward production events to Staging, or publish the app implicitly.

Preferred next configuration is a dedicated Meta test/development app for
Staging, authorizing only FanMind Page1208778912321696, with its Page callback
`https://staging.fanmind.ch/api/webhooks/meta`, `messages` and `feed` on the
reviewed supported API version. This reuses the same FanMind integration code,
Operator and Staging database, not a second CRM implementation. Meta availability
of an appropriate test-app type must be checked during Owner-authorized setup.
No new general customer permission, app publication or WellFit connection.
A later decision must explicitly authorize the exact app/secure runtime binding
and Page subscription; secret entry stays protected and interactive consent is
Owner-assisted if required. Existing Production app/callback stays untouched.

Before Staging rollout:

1. Finish exact-source hosted checks and independent Guardian review; obtain
   regular merge/exact-target approval for this new PR.
2. PR1470 owns the pending Main session-preservation admission. Do not merge it
   from this session. Its current head7c9b932ae5ec92990ac2ea36154e8623f2043497 is still open; coordinate
   the actual approved successor rather than rebuilding that policy.
3. Refresh Main/PR head, both live versions and running deployments/host lock;
   preserve newer Support/Adminchat work. Prepare the actual resulting SHA,
   both Operator-preservation inputs and Billing preserve; never deploy a stale
   historical grant or assume a merge SHA in advance.
4. Deploy only the approved SHA via the protected controller, independently
   confirm /api/version and existing Operator continuation before subscription.
5. Configure only the approved isolated Meta app and verify challenge/signature
   and Page edge readback. Stop rather than moving the common Production URL
   if isolation is unavailable.

## Real acceptance after authorization

Owner then supplies one fresh Messenger message and one new comment on each of
the two known FanMind posts. Wait for webhook receipt without any manual sync;
correlate new provider IDs with redacted diagnostics and independent persisted
rows. Confirm correct sender/Page/workspace, one private and two distinct post
histories, exact original targets and selected AI dialogue. Do not send a reply.

Replay an explicitly authorized event without leaking body/signature/secret;
repeat manual recovery sync and verify unchanged message counts. Recheck actual
RLS/foreign-workspace denial and Operator continuation. If any item fails,
record failure and correct/retest; historical6messages and synthetic deliveries
never count as new automatic arrivals.

Recovery: disable only the new Staging app/Page subscription and its local flag,
restore the previous Staging app binding from protected rollback metadata and
use existing manual sync. Keep other tenants and the common Production callback
unchanged. Runtime rollback uses the protected prior exact release and retained
Operator state. Repository revert is sufficient before deployment; no data
rollback was needed or performed in this source run.

## Production proposal — blocked, no deployable approval candidate yet

A final Production proposal follows successful real automatic Staging acceptance.
Production remains a798d793; the base Main3912461e differs in242files, so a Main
release is not Facebook-only. It contains Support/common-release changes,
Adminchat media catalogue source (still unapplied), legal/operator/contact and
registration/catalogue preparation plus Facebook/session work. Full exact diff
and feature/schema state of the eventual combined release must be supplied;
no Support/Adminchat/Stripe/Billing activation is authorized here.

Production gates: verified Meta business, required App Review/Advanced Access
and legal approval; exact real customer/Page/workspace binding and permissions;
Page edge `messages`/`feed`; valid server-only verification/App/encryption keys;
real concurrent/idempotent/tenant QA; deploy/rollback controller readiness (the
current repository Production workflow is sealed), exact reviewed combined
source and separate Owner Production approval. Keep outbound sending and
analysis off. The Staging-only Operator must never become a Production agent.

The shared Production callback may remain the same URL for Production only;
its deployment changes implementation and therefore still needs approval and
before/after verification. A Staging test is not authority to repoint it.


## Owner-authorized test-app setup — 13 November 2026 continuation

The Owner explicitly approved an isolated Staging test/development app limited
to FanMind Page `1208778912321696`, planned webhook callback
`https://staging.fanmind.ch/api/webhooks/meta` and `messages` / `feed`.
The approval excludes publication, general permission expansion, the shared
Production webhook, Production deployment and outbound messages/comments.
It also explicitly requires stopping before an alternative if isolation is
unavailable. Source merge and deployment remain separate exact-source decisions.

### Actually completed

The existing parent app's native **Create test app** action was used. Meta
required password reauthentication; the Owner completed it directly. A fresh
dashboard inspection independently confirms **FanMind Staging**, App ID
`1637976007865045`, with Meta's explicit test-version relationship to parent
FanMind `2214477125984114`. No duplicate standalone business app was created.
Creation succeeds; credentials were not read, exported or committed.

### Provider limitation observed — stop before alternative

The test app's Page Webhooks screen explicitly states that an unpublished app
receives only dashboard test webhooks, and no production data, including from
app admins, developers or testers, unless published. This is the actual Meta
screen's statement, not a performed real-delivery experiment or a general
claim about every Messenger/product configuration. No real arrival is passed.

The new test app's Page callback and verification token are empty; `messages`
and `feed` subscriptions are disabled (UI default version v27.0). No callback
save, challenge, Page subscription, token generation, consent or real-data
processing was performed. The earlier proposed isolated-app route is therefore
not yet a demonstrated path for real FanMind events. Do not infer that the
existing manual Graph acceptance proves webhook eligibility.

Setup stopped at the Owner's explicit publication/alternative boundary.
Keep the test app for possible isolated synthetic checks; do not publish,
repoint the parent callback or route Production events to Staging.
An alternative must first establish product-specific real-event eligibility
and an isolated destination without violating those exclusions, then receive
the necessary concrete Owner decision.

### Independent runtime prerequisite

The existing `staging-meta-runtime.mjs` rejects changing an already configured
App ID through `existing_app_conflict`. Its workflow also requires exact Main
to equal the live Staging release. A new App identity therefore cannot be
silently installed using the initial-setup controller. A later approved
rebind needs its own reviewed preservation/rollback of the existing binding,
encrypted tokens and Operator state, protected secret provisioning, and fresh
live/lock checks. No guard was removed and no configuration job was started.
PR1470 is now confirmed merged; this observation is not deployment authority.

Repository checkpoint: source PR1473 remained Draft/open at a191b54f before
this documentation-only receipt. The old scratch worktree's Git metadata now
references an absent original checkout; no reset, cleanup or reconstruction
of another session's work was attempted. This receipt is saved using the
existing branch's current file SHA through GitHub, preserving all runtime code.

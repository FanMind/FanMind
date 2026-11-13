# Real automatic Facebook Staging reception — 13 November 2026, 18:33 Europe/Vienna

This receipt supersedes the older manual-Graph-only acceptance below for the
single FanMind Page. **Facebook-Staging-Empfang abgeschlossen** for the bounded
current single-Page reception scope. Production and multi-Page expansion remain
outside this acceptance.

Deployed runtime: `193eb1a96c7e3a50a11eecd7ae0d437daceb6bcb`, independently
read from /api/version again at 17:32:15 UTC. Protected Staging deployment
43470097965 SUCCESS; no duplicate rollout or new source repair in this test.

| Check | Actual evidence / result |
|---|---|
| App subscription | Dedicated published app1547928503809961; protected app rebind43463354662 and callback messages/feed registration43463518222 SUCCESS; fixed Staging callback retained. |
| Page subscription | Exact FanMind1208778912321696 subscribed_apps provider readback messages/feed active; subsequent independent UI check confirmed. Local webhook_subscribed=true only after readback. |
| Automatic receipt before sync | PASS: baseline6 ->9 messages, still3 conversations. First DB observation preceded any manual sync in this run; old manual markers still11:35:29.931Z DM /10:03:33Z comments. New last_event17:29:09.306Z. |
| New Messenger | PASS: real Owner text beginning “NAchrichtenzustellung Empfangstest…” at17:29:05.981Z; existing private thread t_1860316518311829; no post identity. |
| New comment1 | PASS: “Empfangstest Beitrag1 neu” (actual text includes spaces) at17:28:38Z; post1208778912321696_122105472693397254, comment122105472693397254_1471161521785964. |
| New comment2 | PASS: “Empfangstest Beitrag2 neu” (actual text includes spaces) at17:28:35Z; post1208778912321696_122134389027397254, comment122134389027397254_2582663822160401. |
| Page/contact/workspace | PASS: only active FanMind mapping; Operator workspace6949a853-f11a-4b29-a1b2-9f9b928b9efd; contact080464a3-05db-4b6d-83dc-68aedc75240e;0 message/conversation workspace/contact/source mismatches;0 foreign active mappings. |
| Histories and selected reply context | PASS in actual browser: private history3 messages; post1 history4; post2 history2. Each selected history excludes the others. Composer's original-channel link follows the selected latest DM/comment target; no reply generated/sent. |
| Original references | PASS: new comments point at exact post/comment IDs1471161521785964 and2582663822160401. Private history uses its existing exact business-inbox/thread context. |
| Manual recovery after automatic receipt | PASS: Messenger0 inbound/0 outbound/3 existing; comments2 posts/6 comments/0 imported. Both repeated a second time with no added rows. |
| Persisted duplicate protection | PASS:9 messages with9 distinct provider IDs,3 original conversations,0 duplicate external IDs; six historical message rows preserved. |
| Replay/isolation regression | PASS:36/36 focused cases in facebook-webhook-ingress.cases.mjs and meta-webhook-tenant-idempotency.test.mjs, including repeated delivery, partial-failure replay, per-post IDs, parallel identical inserts and cross-tenant IDs. These are synthetic adapter/source tests, not a forced second live Meta HTTP delivery. |
| Live RLS | PASS under authenticated Operator subject:3 own conversations/9 own messages;0 foreign conversations/messages. Transaction rolled back; no persistent permission/data changes. |
| Operator continuation | PASS: existing session reused across DM/post1/post2/channels navigation and repeated server actions without new login or credential entry. |

Limits retained honestly: the exact original signed Meta request was not captured
or forcibly replayed in production-like HTTP; repeated real Graph recovery and
synthetic actual-parser/storage replay are the separate evidence above. Concurrent
first-contact atomicity and general customer/Production readiness are not passed
by this single existing-contact acceptance. The earlier Page-selection POST
saved correctly but visually remained on the selection page; return through the
existing Channels link worked. That navigation issue remains separately recorded
and is not silently claimed fixed.

No message/comment was sent as the Page. No Production/app/callback/deployment,
extra database, schema, billing, Support/Adminchat activation or multi-Page work.
No secrets/signatures/request bodies were exported. Existing untracked local
Python caches and other sessions' source were preserved.

---

# Final bounded Staging receipt — 13 November 2026

This latest receipt supersedes earlier failed/pending checkpoints retained below.
Acceptance is bound to **runtime d34834979cef30c9c6af567d61b3df448901bfda**,
not to a later documentation-only closeout commit. No further runtime deployment
is part of this receipt.

| Area | Actual result |
|---|---|
| Deployment | PASS: protected run 43417498761; independent /api/version at 12:31:59 Europe/Vienna exactly d3483497/runtimeStaging. Temporary feature rule removed; original two rules restored. |
| Page connection | PASS for existing FanMind 1208778912321696 / Operator binding. No WellFit connection, permission expansion or shared Webhook change. |
| Messenger | PASS: two real messages in one private thread, exact original thread reopened, normal contact navigation shows private history only. |
| Comments | PASS: four real comments in two separate posting histories (3+1), same correct sender/contact, each original comment target retained; both latest originals reopened correctly. |
| Repeat sync/persistence | PASS after real renewal: two posts checked/four comments found/zero new; incremental DM imported zero. Independent DB: 3 conversations / 6 inbound messages / 6 unique external IDs, no parent/workspace/contact/thread/post anomaly. |
| Reply context | PASS for selected recent dialogue and per-source draft reset; two actual posting-specific AI generations already exercised. Contact knowledge/preferences remain contact-level. No draft copied or sent. |
| Workspace/security | Independent Guardian PASS: Operator: 3 own conversations / 6 own messages / foreign 0; foreign fixture owner: Operator 0, own Workspace visible; RLS enabled, correct Operator owner/marker; 4 distinct correct comment targets. |
| Actual renewal | PASS: real button-triggered continuation at 12:32:48 and 12:33:34 Europe/Vienna, both return authenticated Dashboard without new login. Provider refresh rows 3 → 4 → 5, revoked 0 → 1 → 2; sessions remain 3, last sign-in unchanged at 11:59:16. |
| Logout/revocation | PASS: actual Logout, protected/dashboard redirects/login, subsequent continuation returns sign-in-required. Independent snapshot 12:39:07 Europe/Vienna confirms 0 provider sessions / 0 refresh records. No raw token replay or universal immediate JWT revocation claim. |
| Re-login restore | PASS: secure Owner-assisted login at 12:40:27 Europe/Vienna independently confirmed by provider metadata and correct Operator/Inbox; one private and two posting original actions remain visible. |
| Production | Independent /api/version at 12:37:47 Europe/Vienna still a798d7938bb4e7e168f615f0c32d1a603dd47d4a/runtimeProduction. No Main merge, Production action or new database. |

## Exact source and evidence

- Runtime source d3483497; checked tree 375a27265a1f28f1ffe80ccc87bc90056d3645db.
- [Protected deployment 43417498761](https://github.com/FanMind/FanMind/actions/runs/43417498761) PASS.
- Exact source [CI 43413914169](https://github.com/FanMind/FanMind/actions/runs/43413914169), [Project Memory 43413922415](https://github.com/FanMind/FanMind/actions/runs/43413922415) and [God Mode 43413922436](https://github.com/FanMind/FanMind/actions/runs/43413922436) PASS.
- Focused source checks 52/52, Guardian session 17/17 and independent actual-route
  synthetic-provider tests passed before deployment. Those synthetic results are
  separate from the real provider rotations and real Facebook data reported here.
- Earlier Browser E2E 43405664594 passed 94 desktop/mobile public cases, 6 synthetic core
  journeys including two-post details and 43 component cases. Actual post-deployment
  browser checks here used the Owner's real supplied inputs.

## Scope and remaining integration boundaries

The approved manual-sync/Operator-continuation Staging acceptance is complete.
Natural access expiry was observed earlier on 13 November; the final runtime's
successful provider-backed renewals used retained valid refresh cookies. They
are user/agent-triggered, not background automatic refresh. Live multipage Graph
traversal beyond this dataset, automatic Webhook arrival, generic automatic
Messenger-link discovery, Meta publication/App Review/legal and Production
activation remain outside this bounded PASS. The Messenger target is verified
manual mapping for this conversation. All credentials remained in protected
browser/provider storage; independent Auth evidence used counts/timestamps only.

The existing PR remains open/unmerged. Reconcile/review the stacked Main
integration and its required checks separately, preserving other active work;
no Main merge or new deployment is authorized by this closeout. A logout requires
secure interactive bootstrap again; no password vault or future browser-profile
recovery is supplied by continuation.

---

## Historical preparation and earlier failures

# Facebook Staging acceptance — 13 November 2026

## Target and authorization

Existing Issue #1464 / Draft #1465, stacked on unchanged Draft #1463. Owner
explicitly authorized Staging deployment of
`aae0003c6836ef73235c0d771d6387ee0e29f81b`, the temporary exact branch admission,
the existing Operator's session-continuation flag and real integration tests.
No Main merge, Production action, new database, broader account permission,
Meta publication or change to the shared Production webhook was authorized or
performed by this run. No outbound message or public comment was sent.

## Deployment — PASS

- Protected deployment [43399615749](https://github.com/FanMind/FanMind/actions/runs/43399615749)
  completed successfully from the approved exact source. Its tests/build and
  smoke checks passed, including 14 public routes and live product truth.
- Independent browser `/api/version` at 09:16:09 UTC confirmed that exact SHA
  and `runtimeEnvironment=staging`.
- Only `feat/1464-staging-agent-access` was temporarily added to the protected
  Staging environment. After deployment its rule was removed. Independent UI
  readback again showed only `main` and `fix/facebook-page-discovery-staging`;
  no wildcard, bypass or permanent third branch admission.
- `/staging-operator` actually renders its continuation button, proving the
  deployed feature gate is enabled. This alone does NOT prove renewal works.
- Independent Production `/api/version` at 09:27:46 UTC still reported
  `a798d7938bb4e7e168f615f0c32d1a603dd47d4a`, runtime Production.

## Actual Facebook provider acceptance

The Owner explicitly confirmed one new private Messenger test and two real
comments on FanMind. Matching against the three supplied exact texts was done
privately; no raw message content, private link or credential is committed here.

| Check | Actual evidence and result |
|---|---|
| Page binding | PASS: FanMind 1208778912321696 in the existing Operator workspace; WellFit binding 0, same Page active in a foreign workspace 0 |
| New Messenger input | PASS: first full sync imported 1 inbound and skipped the previously stored message; exact new-text DB match 1 |
| Two comments | PASS: provider-backed UI result checked 1 post/found 2 comments/imported 2; independent exact DB match for each comment 1 |
| Sender and grouping | PASS: both sources map to the same correct contact; comments share one post/fan conversation, DM has its separate thread |
| Repeated sync | PASS: second full DM run imported 0/skipped 2; repeated comment run found 2/imported 0; independent counts unchanged |
| Persistence | PASS: 2 conversations, 4 messages total (including the older DM), 4 unique external message IDs; correct workspace/contact, inbound only |
| Inbox separation | PASS: fully loaded chats view contains the DM conversation only; comments view contains the post conversation only; both show in All |
| Comment originals | PASS: both distinct persisted links opened the actual corresponding comments in Facebook, with correct post and test text |
| Messenger original | PASS for this verified manual mapping; see the bounded repair below. Automatic API discovery remains unproved |
| Live pagination | NOT EXERCISED beyond this small real dataset (1 post/2 comments). Mocked multi-page/loop/deadline tests remain synthetic evidence |
| Automatic webhook ingress | NOT ACTIVE: subscription stays false; shared Production callback and app publication untouched. Accepted ingress here is explicit manual Graph sync |

### Bounded Messenger-link correction

Meta Graph imported the real messages but supplied no usable exact Inbox target.
The original fallback opened Meta Business Suite, where the correct Page, sender,
old DM and new exact test message were independently visible. The actual
Messenger navigation supplied an exact `selected_item_id` link. It was NOT
derived from a PSID, guessed from the thread ID or copied from a foreign account.

That verified link was saved through the existing contact's Chat-Link form.
Independent readback confirmed `quality=manual_exact_thread`, the correct
workspace/contact and Messenger source. Opening the saved link showed the exact
test message in the intended thread.

The existing Inbox reads conversation provenance rather than the saved contact
target, so its button still lacked this mapping. A reversible, data-only repair
copied that exact saved target into ONLY the existing, explicitly bound DM
conversation. The transaction ran under `authenticated` with the Operator's
subject/RLS, required matching workspace/contact/source/thread/manual target,
required the old conversation target to be NULL and asserted exactly one changed
row. No message content, schema, policy, role, other contact or comment was changed.
Rollback would restore that one target to its former NULL only while the exact
verified mapping still matches. Private identifiers remain in authenticated
storage, not this report.

Afterward the Inbox exposed `Antworten · Chat öffnen` with the correct Page and
selected thread. A further contact sync imported 0 and independent DB readback
confirmed the verified target persisted, with 2 DM messages/2 distinct IDs.
This is a verified manual setup for this conversation; it does not establish
general automatic direct-link discovery or automatic contact-to-Inbox propagation.

## Independent workspace isolation — PASS for database/RLS

Separate read-only transactions used the authenticated role and provider user
subjects, without exporting their tokens:

- Operator: visible conversations 2 / foreign 0; visible messages 4 / foreign 0.
- An existing different, explicitly marked synthetic Staging workspace's owner:
  Operator conversations visible 0 / Operator messages visible 0.

Both real Facebook conversations remain in the intended workspace. This is a
real-data database/RLS negative check, not a second real Facebook customer import
and not evidence of an interactive login as the foreign fixture owner.

## Staging authentication — PARTIAL / renewal FAILED

Normal Owner-assisted Operator login and independent fresh-tab reuse succeeded.
The deployed renewal page was available, but an actual `Sitzung fortsetzen`
attempt returned the generic failure state. Independent Auth metadata before
and after showed no refresh-record rotation: 5 records, 0 revoked, unchanged last
metadata update. No credential, cookie or token value was read/exported.

Consequently renewal, expired-access recovery and token rotation are NOT passed.
Real expiry/logout/revocation acceptance remains open pending a working renewal
path; earlier synthetic tests and historical normal logout cannot replace it.

Two source defects are reproducible without real credentials: the original
guard rejects the local nginx-to-Next transport URL despite a pinned public
HTTPS Origin; the route treats any non-null POST stream as a forbidden body,
even when the stream is empty. The currently deployed UI does not show its
fixed server outcome, so these reproductions alone do not identify which guard
rejected the actual request.

A successor source correction retains exact runtime/project/user/workspace and
HTTPS browser-Origin checks, accepts only the exact local Staging transport,
distinguishes empty from nonempty bodies within a bounded read/cancel and shows
only allowlisted fixed outcome codes on the internal Operator UI. Wrong public
origins, Production, wrong local ports, forwarded-header spoofing, nonempty and
stalled bodies remain blocked in negative tests. No secret/provider response is
exposed. This successor has NOT been deployed; its exact-source protected rollout
needs its own concrete Owner approval because the previous grant named only aae0003c.

## Owner-reported detail routing — successor source, not deployed

The Inbox views separate real DM and post rows, but the deployed contact-detail
route defaults to the entire person's history. The Owner correctly reported that
this mixes private messages and comments on opening that detail. The earlier
Inbox PASS is not a PASS for detail navigation.

The successor passes the private-chat source in DM row links, preserves each
comment's post-specific source, defaults detail navigation to private chat or one
post and removes the aggregate source tab. Legacy `source=all` URLs no longer merge
post comments into the timeline. Each individual comment retains its own target;
a bare post URL without any comment identity is unavailable rather than advertised
as a direct comment target. Changing source resets stale draft UI state. Contact
identity remains shared; message/post provenance is not combined or rewritten.

The existing synthetic browser fixture is extended to one fan with a DM and
comments on two distinct posts, checking scoped timelines and each original URL.
The Owner's two real comments are on ONE post, so real multi-post acceptance is
still unexercised. This source change makes no DB/schema/privilege or outbound
change. AI reply generation now receives only the selected conversation identifier;
the existing authorized workspace/contact/RLS query also filters that identifier
before its bounded fetch. A missing/foreign selected conversation returns no
accessible context and never falls back to a different posting. Contact-level
analysis/preferences remain contact-level; no real provider-generation acceptance
is claimed. Explicit missing post filters retain an empty timeline and unavailable
original action instead of silently opening another posting or private chat.

## Successor source verification

- Focused source/auth/import/fixture checks: 74 passed, 0 failed/skipped.
- Independent Guardian initially found wrong-source fallback and unscoped AI
  reply context; both were corrected and re-reviewed with no remaining blocker
  for the requested selected-thread flow. Three additional executable synthetic
  query/route regressions verify workspace/contact/conversation binding, no
  fallback for missing/foreign threads and malformed identifier rejection.
- Production-mode build and affected-file ESLint passed locally.
- Local Chromium acceptance could not start: browser binary absent; the official
  download then failed with a truncated ZIP. This is a tooling failure, not a
  passing browser test. The extended synthetic two-post browser test still needs
  the normal GitHub Browser E2E runner before protected rollout. Its first run
  43404951493 exposed a test locator mismatch (`article` instead of the actual
  labelled `main` timeline); corrected without weakening visibility/link checks.
  That first run is not a browser PASS; the corrected run remains required.
- God Mode preflight, Project Memory quality and truth-drift checks passed;
  global release decision remains its existing conservative BLOCK. Source checks
  do not override exact-commit Owner/environment authorization.

## Remaining acceptance

1. Review/check the successor source and obtain its exact-SHA Staging approval.
2. Deploy through the same protected controller, independently read the version,
   then prove actual renewal/rotation and expiry continuation without credential
   export. Fresh parallel sign-ins can reset expiry; do not infer expiry from
   elapsed chat time alone.
3. Test normal logout/provider revocation and failed continuation after logout.
   The current normal logout uses provider-wide signout and can sign out other
   Staging Operator tabs; arrange the final test accordingly. Already issued JWT
   lifetime is a separate limitation; no immediate universal JWT rejection claim.
4. Recheck the three real inputs and exact links after that rollout. Neither
   source/CI success nor this bounded real dataset authorizes Meta publication,
   an automatic Webhook activation or general Production readiness.

## Approved a49decfd rollout and real runtime QA — 13 November continuation

The Owner then explicitly approved exact `a49decfdb81ea8a16ff78c134cd28b141af4a218`.
Protected deployment [43408555294](https://github.com/FanMind/FanMind/actions/runs/43408555294)
succeeded. Independent `/api/version` at 11:23:55 Europe/Vienna confirmed that
exact Staging source. Temporary feature-branch admission was removed immediately;
independent UI readback again showed the two original branch rules only.

Actual post-rollout browser/database checks:

- Private Messenger row opens `general_chat`; the base contact URL also defaults
  to private chat with exactly its two real DM messages, no post comments.
- The two real posting scopes show respectively 3 and 1 comments, the same correct
  sender, each with its own original comment URL. Aggregate source tabs and
  Messenger helpers are absent from comment views.
- Repeated manual Graph sync: 2 posts checked / 4 comments found / 0 imported;
  DM incremental run imported 0. Independent persisted counts remain 2 DM and
  4 comments, 6 distinct external IDs, 3 distinct source conversations.
- Messenger original reopened the exact test thread. Both newly supplied comment
  originals reopened the corresponding actual comments on the correct postings.
- Actual AI drafts were generated for both selected posting conversations. The
  first referred to the upcoming start, the other to the latest logo-size comment
  and earlier comments from that same posting. On switching source, old draft-copy
  controls were cleared. No drafts were copied or sent. Current incoming/recent
  dialogue is thread-bound; contact-level analysis/preferences/voice/memories are
  intentionally shared, not advertised as post-isolated.
- Independent Guardian SQL QA: correct contact/workspace/parent/thread/post,
  4 distinct comment targets, RLS enabled on both tables; Operator 3 conversations /
  6 messages, foreign 0; foreign fixture owner sees Operator 0 conversations /
  0 messages while its own workspace remains visible. No token/content export.

Actual auth result is still NOT passed:

At 11:31 Europe/Vienna the existing session expired naturally: reloading the
protected contact page redirected to `/login`. Clicking the deployed continuation
button then returned **403 / origin_forbidden**. Auth metadata stayed at 6 refresh
records / 0 revoked / last update 10:31:22 Europe/Vienna; no provider rotation.
This is real expiry plus failed renewal, not a synthetic expiry test. Secure
interactive re-login was requested immediately; logout/revocation/re-login
acceptance remains open and must not be called PASS.

The narrower cause is independently reproducible with the installed Next.js
production request adapter: nginx forwards HTTPS, render-server defaults its
fetch hostname to localhost, and `attachRequestMeta` creates the virtual request
URL `https://localhost:3001/...` even though nginx's physical upstream is HTTP.
The a49decfd guard admitted only HTTP loopback forms. The next source correction
adds only exact HTTPS localhost/127.0.0.1 on port 3001; it does not trust arbitrary
forwarded origins, hosts, ports or paths, nor alter public Origin, runtime,
project, Operator, workspace, cookies, permissions or provider checks.

This next source has not been deployed. The Owner's a49decfd grant does not
cover a successor protected rollout. Keep #1463/#1465 Draft/open/unmerged and
obtain a concrete exact-source authorization after source/Guardian/CI checks.
Production and the shared Webhook were not changed; no new database or outbound
Facebook action occurred.

Successor source verification: 48 focused checks passed without failures/skips;
full Next build/TypeScript, affected ESLint, Project Memory and drift checks passed.
Independent Guardian's 13-case session suite includes the actual installed Next
request-adaptation chain. Its independent old/new probe rejects the exact adapted
request on deployed a49decfd and accepts it on the successor, while wrong browser
Origin, missing Origin, cross-site, host/port/path/Production cases remain denied.
These are framework/source tests without live Auth calls, not real renewal PASS.

## Approved e4465268 rollout — Origin fixed, refresh-format rejection remains

The Owner explicitly approved `e4465268f781dfd57704070b9ae60ec6d831ca5d`.
Protected deployment [43412732522](https://github.com/FanMind/FanMind/actions/runs/43412732522)
succeeded. Independent Staging `/api/version` at 11:56:19 Europe/Vienna confirmed
that exact SHA/runtime. Temporary feature-branch admission was removed again;
independent readback showed exactly the two original rules.

Actual continuation now passes the Origin/body boundary but returns the fixed
sign-in-required UI (401), without rotation. Before/after Auth metadata remains
2 refresh records / 0 revoked / latest update 11:42:14 Europe/Vienna. The existing
normal private contact view remains authenticated. Do not report renewal PASS.

A protocol-validation defect is independently evidenced: the shared validator
required 24 characters for both access JWTs and refresh credentials. Official
[Supabase Auth refresh validation](https://github.com/supabase/auth/blob/master/internal/api/token_refresh.go)
accepts the legacy 12-character refresh format (and newer opaque formats).
A protected, aggregate-only Staging query returned min/max credential length 12
for both existing Operator refresh records. No token value was selected,
exported or stored in this report. Earlier synthetic test credentials were too
long to expose this provider-format incompatibility.

The bounded successor separates refresh-credential length validation (12–4000,
no whitespace) from access-token validation. Both incoming and rotated refresh
credentials use that predicate. Actual validity is still established only by
Supabase Auth, verified user identity and exact Workspace/RLS binding; no token
length grants authorization. Runtime/project/Origin/body/route/rate/cookie bounds
are unchanged. Provider-shaped synthetic 12-character round trips and malformed
input/response negatives are required; their PASS is not real renewal evidence.

Independent exact-next-boundary preflight under authenticated Operator claims
materialized the same workspace columns/filter/limit as renewal and returned
one correct id/name/owner/marker, without exporting the complete flags. This
checks current column privileges and RLS before another proposed rollout.

Independent post-e446 Facebook/RLS QA still passes: 3 source conversations,
2 real DM + 4 real comments on 2 posts, 6 unique external IDs, no parent mismatch,
4 correct distinct comment targets; Operator foreign0, foreign fixture owner
Operator0 with own Workspace visible. Existing marker and ownership unchanged.

The successor has NOT been deployed and requires a new exact-source protected
approval after source/Guardian/CI checks. Current deployed source remains e4465268;
no full Staging-auth or background-auto-refresh claim. No Main/Production/Webhook,
new permission/database, WellFit binding or outbound Facebook action.

Refresh-format successor verification: 52 focused checks passed with zero failures
or skips; full Next build/TypeScript, affected ESLint, Project Memory and drift
checks passed. Independent Guardian session suite 17/17 passed with realistic
12-character incoming and rotated synthetic credentials, boundary/malformed
response/provider-rejection negatives and exact request-body verification.
No real token value was placed in tests. Post-e446 comment repeat again checked
2 posts/found 4/imported 0; live token rotation remains unproved.

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
  the normal GitHub Browser E2E runner before protected rollout.
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

# Facebook customer connections and post comments — 2026-11-09

Owner scope: each registered Creator connects their own Facebook Page to their
own Workspace through provider-hosted login/consent. Direct chats and public
post comments must be distinguishable. Reply opens the original platform for a
human to send manually.

## Implemented in this change

- Explicit Page selection even when Meta returns exactly one Page; the selected
  ID must occur in the current user's provider-authorized result. No operator
  account fallback. Existing session/Workspace checks, encrypted tokens and
  exclusive active account binding remain in force.
- Inbox views for chats/direct messages and messages/post comments. Search and
  status filters preserve the selected view and language. Distinct Conversations
  from one fan remain visible rather than hiding all but one per fan. Open
  follow-ups still fill uncovered fans.
- The visible Reply action opens the original channel in another tab. Facebook
  comments use their sanitized permalink or validated numeric post/comment IDs.
  Unknown provenance never substitutes an operator Page or contact profile.
  Provider cookies/session and Meta routing still determine the external result;
  synthesized links are attempted links, not certified external routing.
- The same comment-target resolver serves webhook ingestion, manual Facebook
  comment sync, existing stored comments in Inbox and the fan workbench. Facebook
  webhook post/fan thread keys now match the existing comment-sync keys.
- Opening a comment from the Inbox selects its platform and post context in the
  fan workbench timeline and original-channel action. AI drafting remains contact-
  based; selecting a post does not establish a separate post-specific AI context.
  Different comments within the same fan/post Conversation remain
  in the existing chronological timeline; this change is not a full-history
  import or one-row-per-comment feed.

## Validation

- Full Next.js build: PASS with the local synthetic fixture configuration.
- TypeScript and ESLint on affected files: PASS.
- 90 targeted Node tests: PASS. Includes actual webhook parser/processor with
  synthetic two-Workspace mappings, unmapped/blocked Page rejection, separate
  post threads, safe comment targets, explicit one/multiple-Page selection,
  invalid operator-page selection, initial import, authorization and existing
  ingress/queue regressions. Synthetic dependencies do not prove deployed RLS.
- God Mode registry preflight: PASS. All 162 adversarial tests: PASS. The
  existing release decision remains BLOCK; no attestation or activation evidence
  is fabricated.
- New Chromium regression prepared in `e2e-core-flow/meta-inbox.spec.ts`, using
  the isolated fixture's `meta-inbox` scenario with two comments, one direct chat
  for the same fan and a foreign Workspace row. It checks separation, exact
  reply hrefs, view-preserving search and mobile visibility.
- Local browser execution: BLOCKED before UI execution. No Chromium executable;
  official Playwright browser/headless downloads returned truncated/non-ZIP
  archives. The runtime's alternate Playwright download also failed. System
  package metadata/browser installation was unavailable. The existing GitHub
  `regular-user-core-flow-local` browser job includes the new test automatically;
  its result must be checked independently.

## Impact and limits

Affected boundary: `FM-CONTRACT-SOCIAL-CRM-001` /
`FM-IGATE-SOCIAL-CRM-001` (Facebook authorization, comment ingress, persisted
Conversation provenance, Inbox and fan-workbench source actions).

No database migration, secret value, provider activation, new AI request,
automatic sending, analysis/Billing switch or Production deployment is part of
this source change. Existing RLS, token storage and shared ChatAdmin consumers
are not rewritten. Existing stored comment provenance is resolved at read time;
no historical row rewrite or thread migration is performed.

## Still required for real customer operation

1. Inspect actual Meta app identity, callback URLs, secrets, Page subscriptions
   and granted Messenger/comment permissions in the selected environment.
2. Execute the browser regression, then a protected Staging acceptance with
   two independent authorized accounts/Pages, real incoming DMs/comments,
   original-channel reply navigation, disconnect/revocation and negative access
   checks. Verify current database isolation separately.
3. Complete applicable Meta App Review/Advanced Access and business checks for
   external customer accounts; test-role access alone is insufficient evidence.
4. Verify the existing external legal/customer processing activation requirements.

No supplied website registration, successful build or module test is evidence
that these external steps have completed. No general-live claim is made.

## Independent source countercheck

A separate Guardian reviewed authorization, Workspace binding, queue identity,
view filtering and comment routing. It reproduced and blocked one mixed-fallback
provenance defect: an old URL-less comment could borrow another post's URL from
the contact's default Conversation. The resolver now takes permalink, post ID
and comment ID from one tuple only; mismatched fallback and absent provenance
regressions pass. The Guardian independently reran 30 focused tests and confirmed
that removing the Facebook host allowlist makes the negative assertion fail.
Scoped source review PASS; provider activation and deployed RLS remain unproved.

GitHub browser run 42639647909 on the preceding b5c8004 source passed all six
local-provider journeys including the new Inbox regression, public desktop/mobile
flows and ChatAdmin component checks. The corrected head must pass fresh CI
before merge; no old run is substituted for that requirement.

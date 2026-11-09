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

The package manifest remains byte-identical to Main because the existing read-only
Capacity package checksum binds it. New Node regressions reside in the already
CI-owned `tests/inbox-queue-policy.test.mjs`; no protected checksum is changed.


## FM-STAGING-META-RUNTIME-20261109
- Risk/status: R4; source implementation under independent review, target configure not yet executed.
- Owner authorization: explicit approval in this thread for the existing Meta app Staging callback, protected Staging app credentials and encryption; password reauthentication completed directly at Meta. No password or secret enters Git/chat.
- Existing app: 2214477125984114; callback https://staging.fanmind.ch/api/integrations/facebook/callback saved alongside the original Production callback. Protected app-secret and webhook-token entries now exist only in the GitHub staging environment.
- Scope: main/reviewed-live-commit/repository/event-bound isolated Staging controller; pinned checkout and exact root:fanmind-staging:640 override. Modify only FACEBOOK_APP_ID, FACEBOOK_APP_SECRET, FACEBOOK_REDIRECT_URI, FANMIND_TOKEN_ENCRYPTION_KEY and FACEBOOK_WEBHOOK_VERIFY_TOKEN.
- Preservation: reject disk/runtime encryption or unrelated-field drift before mutation; reject existing other app identity. Preserve valid keys; new key only after bounded read-only empty encrypted-token inventory. No database write, Production deploy, automatic sending or general Meta publication.
- Recovery: private mode600 fsynced original-config snapshot retained on the Staging host with run ID, no artifact upload; same-process failure restores original configuration, restarts and verifies old effective values. Interrupted-job recovery requires reviewed restoration of the private snapshot; no automatic crash-recovery claim.
- Validation: 22 focused synthetic tests PASS; full Operations and final-head CI pending. Independent Guardian reproduced prewrite drift risks; added fail-closed regressions. Provider consent, real Page ownership/import/webhooks/two-tenant isolation and App Review/Advanced Access remain separately unproved.


## Facebook Page discovery repair — open PR / Staging first

Owner update 2026-11-09 supersedes the original merge authorization: keep the
PR open, deploy the reviewed task branch to Staging first, and await explicit
Owner merge approval after real acceptance. No Production deployment.

Observed baseline: Main and Staging `4488fc0ff548e2ec2fc230a0403d1826849fd233`;
Production `/api/version` reports `a798d7938bb4e7e168f615f0c32d1a603dd47d4a`.
The real Staging login currently returns `no_page` even with only FanMind
selected in the Meta dialog. FanMind is `1208778912321696`; WellFit-now
`440506919151695` must never be connected by this operator run. These are
operator acceptance targets, never hardcoded authorization in product code.

Confirmed source defects: a nonempty accounts result bypassed all alternative
lookups; both account-list methods ignored pagination; granular target selection
could discard a page authorized for fewer scopes when another page occurred in
multiple scopes. These are reproduced with synthetic Graph responses. Their
contribution to the real provider failure remains unconfirmed until runtime
acceptance; no raw Graph response or protected runtime log has been read yet.

Fix: exhaust both supported lists (10 requests / 500 entries per list), rebuild
trusted accounts continuations using the original token, reject wrong-origin,
wrong-path, repeating, malformed, failed or exhausted pagination, merge IDs and
preserve usable tokens. Granular direct lookup is restricted to valid same-app
diagnostics and the union of Page-relevant target IDs; exact returned ID must
match. Page tasks remain distinct from OAuth scopes. Before persistence, valid
same-app user and Page diagnostics must cover each required scope for the exact
selected page; the Page token's `/me?fields=id` must match that page. Missing
permission lookup now fails closed. Existing active Workspace authorization,
CSRF checks, encrypted short-lived cookie and exclusive account binding remain.

Affected contract: `FM-CONTRACT-SOCIAL-CRM-001`, gate
`FM-IGATE-SOCIAL-CRM-001`; consumers: callback, explicit selection, initial
import and existing CRM/Webhook ingress. Tests distinguish mocked provider
responses and synthetic Workspace boundaries from real provider/RLS evidence.
No schema migration or new secret is required. Package manifest is unchanged
because the existing controlled capacity source checksum binds it.

The existing Staging deployment controller has a narrowly scoped exception for
`fix/facebook-page-discovery-staging`: manual dispatch only, exact reviewed SHA,
protected Staging environment, preserved Billing state, no release-state
recovery. Main behavior remains supported. The exception does not authorize a
Main merge or Production publication and should be removed after acceptance.

Meta dashboard observed in this session: the Page callback still points at
`https://fanmind.ch/api/webhooks/meta`; it explicitly states that unpublished
apps receive dashboard test webhooks only and no real production events,
including app admins/developers/testers. Do not overwrite that callback or send
Staging tests into Production. Staging uses authorized read-only Graph import
and explicit manual sync for provider tests. Real inbound Webhook acceptance
is BLOCKED until an independently approved supported Staging route/app and
publication/permissions are available. No publication was attempted.

Staging connections deliberately skip app-global Page subscription writes while
sharing the Production callback; this is independently exercised with synthetic
connection/import dependencies. A branch-only read of the Staging service journal
outputs fixed discovery labels and numeric/boolean counters only. Tokens, Page
names, Page IDs, provider messages and arbitrary journal text are never emitted.

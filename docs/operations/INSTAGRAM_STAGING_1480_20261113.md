# Unified activation sequencing — 14 November 2026

#1504 deployed successfully in run43633998420 / release619e2a2. GET still returns
HTTP400/code100; removing field selection was not the cause or a subscription
fix. The current activation throws at that same preliminary GET, before its
POST. Unified already knows the exact two allowed fields and does not need to
read/merge previous fields. Send the documented form-body POST directly, then
retain mandatory exact-app/both-field GET readback before marking subscribed.
Legacy merging is untouched. Provider errors expose only bounded numeric
code/subcode and a fixed cause enum, never raw provider text. Unknown errors
remain unconfirmed. No fresh OAuth or test inputs are requested.

# Actual subscription readback — 14 November 2026

Diagnostic #1502 deployed successfully in run43632402637, release615b0a0.
Actual credential verification still passes; subscription GET returns HTTP400
with provider code100. The official v27 IGUser Subscribed Apps reference gives
GET /{ig-user-id}/subscribed_apps with no parameters and a list of
IGUserSubscribedAppsData nodes, not an Application field projection:
https://developers.facebook.com/docs/graph-api/reference/shadow-ig-user/subscribed_apps/
Use its default response without the fields selection in Unified mode. Retain
the exact app identity and both required field checks, safe errors and all
credential/Operator guards. Do not treat POST success or missing data as proof.
Real automatic receipt and required provider access remain unaccepted.

# Account-subscription diagnosis — 14 November 2026

After #1501 rollout, the existing Operator check verifies the actual SYSTEM_USER
credential, exact account and minimal granted scopes. Account subscription is
still unconfirmed after an activation attempt. The existing GET path collapsed
provider failures into an empty field list, and the action suppressed POST
errors, so the UI could not distinguish rejection from absent subscription.
Expose only get/post phase, HTTP status and bounded numeric provider error code
through the existing protected Operator action. Reject all raw/unrecognized
error messages at the action boundary. Request id explicitly alongside
subscribed_fields for the existing exact-app readback; never relax the app or
field checks. No token, provider body, new endpoint, OAuth or schema change.

Meta UI readback confirms the existing App callback and messages/comments v27
fields. Official reference:
https://developers.facebook.com/documentation/instagram-platform/webhooks/setup
requires Advanced Access for comments/live_comments notifications. The current
dashboard's Ready to test status is not approval for general comment receipt;
do not assume this is the cause of an unobserved subscription API error. No
fresh DM/comment test is requested while account subscription is unconfirmed.

# Staging continuation — 14 November 2026

The existing Instagram tester invitation was accepted. The authorized normal
OAuth flow returned to the existing Operator Workspace and persisted fanmind.crm
as a Professional account with Unified Login, the three intended Instagram
permissions plus public_profile, an encrypted credential and an initial empty
DM reconciliation. This is connection evidence, not real receipt acceptance.
The account webhook subscription remains false; no fresh DM/comment test was
requested while it was inactive. Production Facebook Configure 43623829681 and
subscription 43624048062 already passed and must not be repeated for this fix.

The first connected-account inspection exposed a reader defect: both connection
readers omitted oauth_login_type and expiry metadata. The browser-safe query
must remain unchanged because authenticated has no SELECT grants on those
columns. Add them only to the existing service-role projection. The channels
page exposes the existing ingress controls using exact Staging configuration,
Operator identity, Workspace and account-name eligibility; it does not claim a
valid token or subscription from that UI predicate. The server actions still
require the stored Unified mode and verify the actual app/account/token before
any subscription action. No schema, grants, credentials or second connection
are introduced. Wrong environment/identity/Workspace/account stays disabled.

The stored token expiry is not substituted for actual provider diagnostics.
After reviewed rollout, inspect the provider's token type and both expiry
fields, then activate/read back exact messages/comments before requesting real
tests. This source correction does not itself complete the Staging acceptance.
Affected boundary: FM-CONTRACT-SOCIAL-CRM-001 / FM-IGATE-SOCIAL-CRM-001.

# Unified Login implementation checkpoint — approved Staging scope

PR1481 continuation: browser control recovered after runtime renewal; the Meta
setup reload succeeds without repeating personal login. Head14771e9 passed
Truth/lint/tests/build, while native PostgreSQL remains running. CodeQL reported
alert80 on paging-host membership. Exact parsed-host equality is now explicit
for each of the two supported providers, with adversarial subdomain/path/port
tests. No alert dismissal or security-check bypass. A successor head needs its
own hosted checks before merge. No rollout or token authorization yet.

The existing Operator ingress check now returns only verified account/app/type,
minimal scope names and the two numeric debug_token expiry fields. Zero means
provider-reported no timed expiry; missing remains explicitly unknown. No raw
provider payload or token crosses the server boundary. This permits resolving
the60days/Never discrepancy from actual credentials after authorization.
Negative expiry-type and token-exclusion tests pass;75focused tests, lint and
the full Next webpack build pass. Live Staging freshly reports88898c6f.

Owner approved the concrete Unified Login route after the inspection below.
Existing App1547928503809961 now has configuration2150411132228815,
Instagram-account required asset only, exact instagram_basic,
instagram_manage_messages and instagram_manage_comments. No Ads/Publish/Page
permissions in this configuration. Actual dashboard labels it compatible.
The wizard displayed a60-day default, but the saved preview reports Never;
do not claim a verified60-day lifetime. Actual exchanged diagnostics/expiry
remain to be read; revocation is supported, and no renewal/extra management
permission is silently enabled.

Both Staging callback registrations were independently read after reload:
Facebook callback retained and /api/integrations/instagram/callback added.
The configuration's displayed login URL now selects the Instagram callback.

Source reuses existing Instagram/CRM paths. Unified mode is restricted to
Staging/App/Operator; Meta SYSTEM_USER diagnostics, exact minimal scopes,
single assigned fanmind.crm account and client_business_id are verified before
save. Existing AES-GCM store holds a versioned token+business/config/account
binding, with no schema migration. Unified API host/version is graph.facebook.com
v27; legacy Instagram Login retains graph.instagram.com/v25. No Page-token
fallback. Strict same-origin continuation retains existing user/workspace checks.

Account subscription is read back for exact current App and both fields before
local activation. The protected controller adds only reviewed Instagram keys,
reuses the same Meta App signing secret explicitly as required by Unified Login,
and preserves unrelated values/Operator/Billing/encryption and private rollback.
App-object registration now allows the existing page object plus instagram;
registering either preserves the other and rejects foreign callbacks/fields.

Existing DM manual sync uses the same account:sender thread key as webhooks;
Instagram comments require complete own-envelope account/sender/media/comment
provenance, reject own/unknown events, and use media:sender threads. A bounded
manual own-media/comment reconciliation reuses existing deduplicating storage.
It fails visibly if the25-media/100-comments bound requires pagination; it does
not silently certify a complete unlimited history. A webhook lacking a permalink
keeps no fabricated original link; available manual media permalinks do not
establish that every older stored row has been backfilled. No provider send.

Validation:102focused/regression/supply-chain casesPASS; affected ESLintPASS;
162God-Mode adversarial casesPASS; registry preflight, Project Memory quality,
truth/drift checksPASS. Full build and final hosted required checks must be
confirmed before regular merge. Baseline release evaluator remainsBLOCK for
missing protected target evidence, not changed into an inventedALLOW.

Current Main88898c6f (#1478 Adminchat) integrated in this source branch; #1479
Facebook disclosure remains separate and is neither removed nor rewritten.
No Staging rollout/token exchange/real Instagram delivery yet at this checkpoint.
Konto-ID, actual Business/Account binding, App/Account fields and fresh automatic
DM+two-post comment acceptance remain OPEN. Production unchanged.

Affected contract/gate: FM-CONTRACT-SOCIAL-CRM-001 / FM-IGATE-SOCIAL-CRM-001;
shared Operator continuation, webhook signature, encrypted provider storage,
post/DM source-context, comment/DM reconciliation and protected Staging controller.

---

# Instagram fanmind.crm — Staging inspection and concrete route decision

Issue: #1480. Date: 13 November 2026.
Status: PROVIDER_ROUTE_DECISION_REQUIRED; no Instagram reception acceptance.

## Current evidence

- Actual Main and public Staging runtime:193eb1a96c7e3a50a11eecd7ae0d437daceb6bcb.
  Prior protected deployment43470097965 succeeded. No active Staging deployment
  observed among current runs. Open#1478 (Adminchat) and#1479 (Facebook texts)
  were inspected, not edited or merged.
- Existing Facebook Page1208778912321696 remains connected/subscribed. Independent
  final Staging read:9 Operator messages;0 Instagram connections.
- Actual authenticated Instagram browser identifies fanmind.crm / FanMind CRM.
  Business-Tools screen says Unternehmen and offers change to Creator/personal:
  current type is Business, not inferred from bio. No account conversion made.
- Profile shows0 posts. Owner must publish two own posts before eventual real
  comment acceptance; no posts/messages/comments are created by this agent.
- Exact provider account ID is not yet verified. Do not infer it from username,
  Facebook Page or a hidden browser application state.
- Existing implementation uses Instagram Login: instagram_business_* permissions,
  Instagram User tokens and graph.instagram.com, with shared CRM/storage/parser.
  Historic PR#849/#1137 reused as context; no open specific Instagram work found.
- Existing App1547928503809961 now includes the authorized Instagram use case,
  read back on the actual use-case list. No other app created. No Instagram
  permissions/account authorization/token generation/webhook save yet performed.

## Actual provider boundary

The app's API setup with Unified login page explicitly says:
“Die API-Einrichtung mit Instagram-Login ist für neuere Apps nicht verfügbar”
and “Deine App verwendet stattdessen die API-Konfiguration mit Unified Login.”

No compatible configuration exists. The displayed default creation template
includes ads_management, ads_read and instagram_content_publish in addition
to basic/messages/comments. These extra permissions were not granted.
No default configuration was created. The other available Facebook Login route
would require a linked Page and is not silently substituted.

## Recommended concrete alternative, awaiting Owner decision

Reuse the same published Staging App and implement Unified Login for only
fanmind.crm in the existing Operator Workspace. Reuse the existing CRM,
OAuth authorization checks, encrypted token store and Meta webhook processor;
do not build another inbox or a parallel integration.

Unified Login requires the account's Business portfolio and a Business
Integration System User Access Token; API requests use graph.facebook.com.
No Facebook Page is required for this path. Existing Facebook Page access
tokens are not Instagram Unified tokens and must not be reused.

Minimum intended scopes:instagram_basic,instagram_manage_messages,
instagram_manage_comments. Inspect a configurable permission selection and
omit ads/content publishing/other assets. If Meta cannot express this minimum,
present the actual extra requirement rather than silently accepting the default.
Standard-role tests and real external webhook field access must be distinguished;
official setup docs require Advanced Access for comment notifications.

Concrete implementation after decision:
1. Inspect existing portfolio/account relationship, verify exact account ID
   through the supported authorized provider readback; only this account bound.
2. Create least-privilege Instagram Business Login configuration in App1547928503809961;
   register Staging Instagram callback while retaining Facebook callback.
3. Add route-specific login/config/token validation and Graph host selection,
   preserve Strict Operator same-origin return checks; no Instagram-User-token
   fallback to Unified. Verify app identity, granted permissions, exact account.
4. Bind appropriate secret/signing identity through the protected Staging controller;
   reuse existing app secret only where Unified provider documentation and actual
   app identity establish it. Never generic META fallback or old Facebook token.
5. Verify App Instagram messages/comments fields and exact-account subscribed_apps
   readback before local activation. Keep Facebook fields and app subscription.
6. Regression/negative tests, required normal PR checks/merge and protected exact
   shared Staging rollout after refreshing Main/locks and preserving#1478/#1479.
7. Only once ready request fresh other-account DM and comments on two Owner posts.
   Automatic-before-sync proof, correct three histories/context/original targets
   where supported, repeated sync/replay, RLS and Operator continuation.
8. Document actual provider restrictions and results; never infer real receipt
   from dashboard samples or source tests.

The new route uses a revocable business integration system-user credential,
with provider lifecycle and access bound to the portfolio rather than merely
the individual Instagram session. This is the material difference from existing
Instagram Login, so the Owner's explicit instruction to present an alternative
first is respected. No implementation/activation of that alternative yet.

## Sources inspected

- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/permissions
- https://developers.facebook.com/documentation/instagram-platform/webhooks/setup
- Actual App dashboard Unified Login setup and authenticated Instagram Business tools.

Limits: Production unchanged; no schema/new database/paid service/extra account,
no send/publish, no Landing/Support update. No deployment or runtime source change
in this inspection. Independent local worktree prepared on exact Main; no prior
worktree or untracked changes discarded.

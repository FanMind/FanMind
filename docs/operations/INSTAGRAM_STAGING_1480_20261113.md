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

# Instagram #1480 — authorized single-account Staging continuation

Owner explicitly approved Unified Login in App1547928503809961 for fanmind.crm
only. Current Main88898c6f incorporated; retain #1479 and other active work.
Scope: existing Instagram/social CRM contract FM-CONTRACT-SOCIAL-CRM-001 and
FM-IGATE-SOCIAL-CRM-001, Operator Strict return, provider identity and encrypted
credential bindings, exact messages/comments readback and protected controller.
No second inbox/app/database, account conversion, Ads/Publish permission,
provider sending, Production or Landing/Support update.
Config2150411132228815 created with only Instagram asset +3minimal rights;
Staging Instagram callback added alongside Facebook callback. Stored dashboard
expiry label differs from wizard default; actual token lifetime not passed.
Source local/hosted gates and exact-main deployment lease must be current before
rollout. Real automatic receipt is OPEN; do not count synthetic/module tests.

2026-11-14 continuation in PR #1501: tester invitation accepted and normal
Operator OAuth persistence confirmed. Provider receipt is still OPEN; account
subscription is false and no fresh test inputs were requested. Fix the existing
service-role connection projection (OAuth mode/account type/expiry metadata)
while preserving browser SELECT grants. Show existing ingress controls only for
the exact configured Staging Operator, Workspace and fanmind.crm. Server actions
retain stored-mode and provider token/app/account checks. Local 118 focused
regressions, 162 governance tests, lint/build/TypeScript passed. Initial CI found
this required memory checkpoint missing; no gate bypass or manual success retry.
Exact new-head CI, reviewed merge, protected Staging rollout and real ingress
acceptance remain required. Facebook Production Configure43623829681 and
subscription43624048062 are already successful and are not repeated.

Post-rollout actual provider diagnostics confirm SYSTEM_USER and intended scopes;
account subscription remains unconfirmed after one activation attempt. Existing
UI suppressed the provider failure. Continue in the same integration with only
bounded phase/HTTP/numeric-code diagnostics and explicit requested app identity
in the readback projection. No raw provider text, token or new OAuth. App-level
messages/comments v27 callback is independently present. Meta's official setup
requires Advanced Access for comment notifications; dashboard still shows Ready
to test, not an approved general comment receipt. Real input requests remain on
hold until account subscription and applicable provider access are proven.

#1502 deployed in run43632402637 / release615b0a0; actual account subscription
GET fails HTTP400/code100. Official IGUser Subscribed Apps reference documents
the default response without a fields parameter. Remove only the Unified field
selection, retaining exact-app and both-field proof; never accept a successful
POST alone. Operator workspace baseline is 0 Instagram conversations/messages.
No new OAuth, provider grants, schema, Production or unrelated runtime changes.

#1504 deployed run43633998420 / release619e2a2; GET still HTTP400/code100, so field
selection was not the cause. Unified activation currently aborts at its optional
preliminary GET and never reaches POST. Use the documented form-body POST with
the fixed two allowed fields, followed by mandatory exact-app/both-field GET.
Keep legacy merge behavior and all credential/Operator guards. Add only bounded
numeric subcode plus fixed cause enum to diagnose any remaining rejection;
never raw provider text. Real acceptance remains OPEN and no input is requested.

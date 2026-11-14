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

2026-11-14 Meta-review governance continuation (#1509), documentation only:
Owner authorizes introducing authority-request legality review, challenge,
minimization and confidential records. Exact procedure1.0 and blank case template
are prepared in existing legal governance, not legally approved or operated.
Existing approvals.legalReview/retentionDecision and private evidence boundary
remain authoritative; no new register control or runtime service. Historical
national-security disclosures remain UNKNOWN pending one responsible fact
confirmation. No new private identities/case details enter this checkpoint.
Review package has exactly the three required Instagram scopes, conditional
English drafts, API evidence matrix and real screencast/reviewer plan. Current
source proves zero returned media causes no comment-edge call, so0of1 remains
open. GET/POST400/code100/subcode33 is not explained or fixed by this source.
Existing Verified business/Tech designation is recorded in the protected dossier;
Advanced/Access Verification, correct account subscription, reviewer access and
real DM/comment acceptance remain distinct. No new provider/OAuth/config/data
action, submission, merge or deployment. Other workstreams preserved.
18/18 existing legal/evidence tests pass;27-control register remains2confirmed/
25pending and complete-readiness correctly blocks. Initial PR checks identified
the missing durable checkpoint and the reviewed SOURCE_OF_TRUTH blob update.
Only that documented drift hash is reconciled; no runtime acceptance baseline
or protected release evidence is upgraded. Existing social contract/gate remain
FM-CONTRACT-SOCIAL-CRM-001 / FM-IGATE-SOCIAL-CRM-001. Next: responsible historical
fact, qualified legal/exact operator release, secure handling/transfer/training
evidence, then genuine API/reviewer/video evidence before final Owner submission
approval. Browser content reread currently blocked by focus/CDP timeout; previous
UI findings are not represented as fresh observations.

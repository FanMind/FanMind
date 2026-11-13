> Latest runtime checkpoint, 13 November: Owner-approved a49decfd deployed in
> 43408555294 and independently version-checked. Original two deployment branch
> rules restored. Real private/post-separated details, selected-thread AI drafts,
> duplicate checks and independent RLS passed. Natural access expiry was observed;
> renewal still failed 403 origin_forbidden. Installed Next request adaptation
> reproduces HTTPS loopback URL construction. Exact HTTPS-loopback source fix is
> pending review/new exact-commit approval; real renewal/logout/revocation are OPEN.
> Detailed later checkpoint: FACEBOOK_STAGING_ACCEPTANCE_20261113.md.

> 13 November actual rollout: exact approved aae0003c was deployed in run
> 43399615749, independently version-checked, and temporary branch admission
> removed. Manual real DM/comment imports passed; actual continuation failed.
> See [bounded acceptance](FACEBOOK_STAGING_ACCEPTANCE_20261113.md). Successor
> request-handling and per-post detail-routing fixes are source preparation only;
> they are not covered by the old exact-commit deployment approval.

# Staging Operator session continuation — #1464 / Draft #1465

## 13 November continuation — prepared source, separate rollout approval

This section supersedes the earlier source-path blocker below; those prior
observations remain historical. No protected deployment has been executed.

The existing deploy workflow now prepares a second exact named branch exception,
`feat/1464-staging-agent-access`, with the same repository, manual-event,
reviewed-SHA, Billing-preserve and no-recovery guards as #1463. The `staging`
environment and its external deployment-branch restrictions remain authoritative;
no wildcard, branch move, SSH bypass, new database or Production action.

The new boolean input `staging_operator_session_enabled` defaults to false.
Only this exact feature branch can request true; main and the #1463 branch are
denied for that opt-in. The fixed boolean is written into the existing private
release environment after successful build/checks; systemd already loads that
file after the other environment files. False disables this continuation on
a later approved deployment. It does not revoke existing access JWTs or normal
login. The provider/workspace/origin checks in the route remain unchanged.

Concrete protected rollout, AFTER source checks/review and Owner approval:

- Permit only the exact existing feature branch in the Staging environment if
  its current deployment-branch policy requires it; keep all existing rules.
- Dispatch `Deploy FanMind Staging` from that branch, reviewed_commit equal to
  the exact approved final HEAD; confirmation `deploy-staging-only`,
  billing_write_freeze `preserve`, recovery inputs empty.
- Enable the boolean only after explicit acceptance of the existing Operator
  admin-account scope. It preserves current privileges; it is not a new scoped
  identity or a credential provider. No password in a workflow input.
- Read `/api/version` independently, then test the deployed renewal UI, real
  expiry/rotation, fresh tab, local signout and provider revocation. A secure
  bootstrap is still required after logout or loss of the browser profile.

The comment-sync server action previously discarded its detailed result. The
new component shows only this run's timestamp, counters and outcome;
it does not expose provider errors/scopes/tokens/content. The existing stored
comment timestamp remains the content high-water, not a run receipt. The
provider feed is bounded to 25 posts; no full historical backfill is claimed.
Graph collection parsing rejects missing/malformed data and HTTP-200 error
payloads. Comment pagination has one shared 45-second signal, loop/request
bounds and exact-edge continuation validation. These are source fixes; they
do not establish the cause of the currently empty real comment import.

Actual checks on the unchanged deployed Staging `6be52484...`:

- Owner completed interactive login in connected Chrome. Dashboard, channels
  and contact detail consistently show FanMind Staging Operator.
- Read-only DB: connected FanMind 1208778912321696, encrypted token present
  (boolean only), six stored scopes; WellFit target binding count zero, FanMind
  active in another Workspace count zero. Webhook subscription remains false.
- Full Messenger sync at 08:22:49 UTC: 0 conversations checked, 0 new messages,
  no persisted error. The earlier real Owner test remains visible; independent
  DB readback: 1 conversation, 1 message, 1 unique external ID, correct workspace.
  This is a stable existing import, not evidence of new-message arrival today.
- Comment sync invoked; 0 stored, null content high-water and null stored error.
  The deployed UI still discards provider result counters, so complete retrieval
  is NOT proven. Real fresh comments remain required for acceptance.
- Stored conversation reply target absent. Contact detail offers a Facebook
  Business Inbox fallback, explicitly warns it may open the last active thread;
  no working direct-thread link has been verified.
- Independent read-only authenticated-role/RLS check with the Operator subject:
  visible conversations 1 / foreign 0, messages 1 / foreign 0. This is a database
  RLS check, not a second real Facebook customer-tenant import test.
- No outbound message/comment, provider-permission change, app publication,
  Production webhook change, migration, merge or deployment performed.

Source checks and exact resulting commit are recorded in the same PR. Earlier
28/28 summaries below are historical; the current two access/session test files
contain 27 passing tests. No real renewal/expiry/replay success is inferred.

## Source implementation, not an activation receipt

The existing login creates an HttpOnly refresh cookie with a 30-day browser
lifetime, but the current server reads only the access cookie and has no refresh
consumer. Consequently a retained refresh cookie alone does not establish
unattended access after the access session expires.

The prepared implementation adds `/staging-operator` with a **Sitzung fortsetzen**
button and a bodyless POST `/api/staging-operator/session`. An authorized agent
using the same protected browser profile can navigate there and renew an existing
session without a password, including after the access cookie expires. The
password-based private-file smoke runner remains an optional separate test path;
no private credential file was created or populated in this execution.

The server reads the refresh credential only from the existing HttpOnly cookie.
It exchanges it only with the pinned Staging Auth project, verifies the renewed
user through the provider, then checks the single exact marked Operator workspace
through that user's JWT/RLS. It issues Secure/HttpOnly/SameSite=Strict cookies and
returns only fixed outcome fields, never tokens or upstream diagnostics. No
service-role key, metadata-based authorization, impersonation or privilege grant.
Wrong users/workspaces are denied and cleanup attempts local signout of the
newly rotated session. Cleanup failure cannot be represented as proven revocation.
Network requests have timeouts, reject redirects and use no-store. Concurrent
requests for the same cookie are coalesced. Bounded per-process attempt state
complements provider rate limits; it is not a distributed rate limiter.

All four conditions must hold before page/endpoint are available:

| Server setting | Exact required value |
|---|---|
| FANMIND_STAGING_OPERATOR_SESSION_ENABLED | true (default absent/off) |
| FANMIND_RUNTIME_ENVIRONMENT | staging |
| NEXT_PUBLIC_APP_URL | https://staging.fanmind.ch |
| NEXT_PUBLIC_SUPABASE_URL | https://vshyhvgcmrlagvfnvomc.supabase.co |

The existing public Supabase key must be a publishable/anon key; secret/service
keys are rejected. POST requires the exact Staging Origin and a permitted
Sec-Fetch-Site; caller-supplied bodies are rejected before provider access.
Disabled, Production or wrong-project configurations return 404 without a
provider request. The public page is likewise disabled by default. Normal Web
deployments must not silently enable the new server setting.

## Real verification in the existing Staging release

On 2026-11-10 the secure browser credential form completed successfully.
The dashboard and profile confirmed **FanMind Staging Operator**. Credentials
were transferred by the secure browser mechanism, never read by the model or
written to a repository. This was an assisted secure bootstrap, not proof of
unattended password retrieval.

Actual Messenger sync at 08:49:59 UTC checked one thread and imported one inbound
message with no provider error. The Owner's test message was visible in both
Inbox and the contact's chat. Read-only Staging database verification confirmed
one stored message, one unique external message ID and the correct workspace.
After contact-level and full repeated sync the counts remained one message and
one conversation. No outbound message was sent.

An independently opened browser tab reached the authenticated dashboard without
another login. A known contact from a different **marked synthetic Staging
workspace** returned a rendered 404 through that Operator session. The comments
view excluded the Messenger conversation. Comment sync was invoked but stored
zero comments; the nullable comment high-water remained unset, so complete real
provider comment retrieval is still unproven.

Authenticated Help returned a real answer to a synthetic support question and
displayed the current Facebook connection. No support handoff, deletion or repair
was invoked. The real direct Messenger reply link remains incomplete: Inbox has
no verified Original link and the contact page offers a fallback Facebook inbox
link, not a verified direct-thread target.

Real logout was also executed. A fresh request to `/dashboard` returned the
login form, and independent read-only Auth metadata showed zero remaining
Operator sessions. This proves normal logout/session removal, not immediate
rejection of every previously issued access JWT. Secure re-login was requested
through the protected browser form, but that request timed out without a confirmed
result. A fresh verification tab still redirected Dashboard to Login. Current
browser state is signed out; no unattended credential retrieval or successful
re-login is claimed.

## Source validation

- Preserved initial 19 checks plus 9 renewal tests: 28/28 PASS.
- Focused ESLint and full Next.js/TypeScript build: PASS.
- Broader Operations run: 2213 PASS, 59 FAIL, 9 SKIP (2281 tests). This is
  **not** a green full-suite result. Failures include existing protected-runner
  and system-command/path assumptions; `rsync` and `/usr/bin/node` are absent.
  A read-only baseline execution of the three representative unchanged suites
  on the previous clean 6be52484 checkout also failed (97 PASS / 10 FAIL). That
  establishes baseline failures. The additional Capacity failures were traced
  to the package.json checksum pin becoming stale when #1465 registered its
  new tests. Only that exact pin was updated for the reviewed CI-list change;
  protected SQL/transport/workflow pins and all apply/target guards are unchanged.
  Final committed-source rerun: **2260 PASS / 12 FAIL / 9 SKIP**, 2281 tests.
  Ten failures reproduce in the unchanged baseline runner/copy suites; the
  remaining Capacity whole-process timeout test and its parent suite are still
  red. No full-suite or independent acceptance PASS is claimed.

## Remaining protected rollout and identity decision

The prepared renewal route has **not** been deployed or enabled. Its expiry,
renewal and revocation tests are synthetic until a protected exact-source
Staging rollout and real independent QA complete.

Current `.github/workflows/deploy-staging.yml` accepts `main` or its explicitly
reviewed `fix/facebook-page-discovery-staging` exception. It does **not** admit
the #1465 feature branch. This executor also has no workflow-dispatch or general
secret-manager configuration capability. Do not bypass that policy by modifying
#1463, moving its ref, weakening the deploy guards or hand-deploying by SSH.

Next protected step: obtain a reviewed, existing-controller-compatible exact-SHA
Staging rollout for #1465, while both PRs stay Draft/unmerged, and set the above
server flag through protected Staging configuration. If the controller cannot
admit that exact source while preserving its gates, stop for that concrete
release-path decision. Then test an actually expired access cookie, fresh-tab
continuation, provider refresh rotation, local signout, replay rejection and
the existing workspace/CSRF negatives against the deployed route.

The current identity is an existing business-email **admin account**. It works
for Owner-authorized Staging tests, but renewal preserves its existing admin
rights; it is not an independently scoped technical identity. Before unattended
activation, an authorized administrator must decide whether that access is
acceptable for this test-only workspace or whether a distinct technical identity
or reviewed delegation layer is necessary. No extra identity/workspace was
created, no existing admin rights were removed, and no customer rights expanded.

Continuation cannot log in after intentional signout/revocation or recover a
lost browser profile. That requires an approved credential provider or another
secure bootstrap. No general vault or persistent credential-injection interface
is exposed in this execution environment. Browser cookie persistence across all
future ChatGPT Work environments is not established by repository code.

## Rotation, revocation and rollback

- Routine renewal rotates the provider refresh credential into protected cookies.
- Removing the server flag disables only this continuation interface. It does
  not instantly revoke already issued JWTs or remove normal product login.
- Provider signout/revocation remains authoritative; old JWTs may remain valid
  until their configured expiry. No immediate server-JWT revocation is claimed.
- Cookie/profile loss requires secure sign-in. Never export a browser profile,
  cookies or credentials into GitHub, Slack, chat or ordinary artifacts.
- Rollback: disable the Staging flag, revert the exact source if needed, and
  use authorized provider session revocation when access must be terminated.

Production, shared Meta Production callback, existing databases and #1463 remain
unchanged. The full autonomous-login/expiry/revocation acceptance remains BLOCKED;
source remains REVIEW_PENDING, and real Messenger import evidence is now PASS.

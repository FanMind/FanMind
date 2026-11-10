# Staging agent access — Issue #1464

## Actual status, 2026-11-10

**BLOCKED for autonomous authenticated use and Facebook acceptance.**
The first implementation is a bounded executable authentication smoke runner,
not a completed agent credential broker or a deployed authentication feature.
No account, credential, database, role, Meta grant or production setting was changed.
Existing PR #1463 remains open and unmerged. This source is stacked on its exact
Staging commit `6be52484b9edc2ca0b23bff06b2414fe08090f57`.

The current ChatGPT session can control a real browser: opening Staging `/login`
on 2026-11-10 showed the ordinary email/password form with no authenticated
session. No persistent Operator credential was supplied to this executor, and
no general secret-vault provisioning API is exposed here. GitHub access does not
establish browser authentication. The existing Operator workspace provisioning
flow creates neither an Auth identity nor a password.

## Executable interface

```bash
node scripts/operations/staging-agent-access.mjs --probe
node scripts/operations/staging-agent-access.mjs --check
node scripts/operations/staging-agent-access.mjs --run
```

`--probe` needs no credentials. It verifies `/api/version`, anonymous denial of
`/dashboard`, and a rejected foreign-origin request to `/api/auth/session`.
It exits 2 with an explicit login blocker even when all three checks pass.
`--check` validates the private binding without contacting an authentication
provider. `--run` repeats the public checks, starts a fresh isolated Playwright
browser, uses the regular login form, checks the returned Auth identity and
the exact marked Operator workspace through its normal user JWT, checks the
rendered dashboard, revokes that run's local refresh session, tests refresh
replay rejection, removes application cookies, and checks anonymous denial again.

There is no privileged Auth API, service-role key, magic-link generator,
impersonation, exported cookie jar, persistent browser profile or new login
endpoint. The bounded runner allows only the login/dashboard/static browser
paths and password grant to the separately bound Staging Auth project.
Production, admin routes, Meta OAuth, social writes and message sending are denied.
The runner does **not yet implement Messenger or comment synchronization**.
Its receipt always reports those, session expiry, independent revocation and
cross-tenant acceptance as NOT_TESTED. Operator identity verification is not a
two-tenant isolation test.

## Required protected binding

Set `FANMIND_STAGING_AGENT_BINDING_FILE` to an absolute, non-symlink JSON file
mounted by the approved execution environment's secret manager. It must be
outside repositories, owned by the executing OS user, mode 0600, in a private
directory (0700), single-linked and at most 8192 bytes. Do not put the password
in CLI arguments, Git, Slack, issues, screenshots or chat. No sample containing
a real credential is committed. Debug-output environment options are rejected.
The secret manager, not the model, must inject the values.

Required fields:

| Field | Required binding |
|---|---|
| origin | Exactly `https://staging.fanmind.ch` |
| workspaceId | Exactly `6949a853-f11a-4b29-a1b2-9f9b928b9efd` |
| userId / email / password | Existing dedicated Staging Operator's verified identity and credential |
| supabaseOrigin | Independently verified Staging project origin, HTTPS `PROJECTREF.supabase.co` |
| productionSupabaseOrigin | Independently verified different Production project origin; no requests sent there |
| releaseCommit | Exact reviewed and independently observed 40-character Staging SHA |
| expiresAt | Secret-manager lease expiry, at most 24 hours ahead |
| dedicatedStagingIdentityVerified | `true` only after verifying the identity is dedicated to Staging agent use |

The verification flag is an operator assertion, not remote attestation. The
existing Operator is documented as an admin identity. Its suitability and
ownership have **not** been independently checked in this execution. Do not
mount personal Owner credentials or claim the browser request guard reduces
the underlying account's server-side privileges. Reusing that account safely
may require a separately reviewed server-side delegation design if it is shared
or too privileged; do not silently create another account.

The short secret-file lease limits future runner starts; it is not a new
server-side session expiry policy. Each run signs in afresh. Normal cleanup
uses Supabase local signout to avoid revoking other sessions. Existing JWTs
can remain valid until their server-configured expiry after signout; this runner
does not claim immediate server-side access-token revocation. A crash or SIGKILL
can prevent cleanup. Runtime revocation/expiry guarantees remain unaccepted.

Removing the mounted binding prevents new starts. For emergency containment,
the authorized Staging administrator must revoke the affected Auth sessions and
rotate/disable the dedicated credential in the protected provider controls;
then verify expired-token and replay behavior. Never log the raw response or token.
Rollback of this source preparation is removal of the runner and its CI test;
there is no deployed state or schema to undo.

## Evidence and remaining acceptance

Real public probe run `21c49699-5bd2-4375-9b21-049e93ebc2b9`,
2026-11-10 08:00:11–08:00:31 UTC:

- Staging runtime plus release SHA: PASS.
- Anonymous dashboard: HTTP 307 to `/login`, PASS.
- Cross-origin session mutation: HTTP 403 / `origin_forbidden`, PASS.
- Authenticated Operator login, Messenger, comments: BLOCKED / not executed.

The 18 offline tests cover wrong origins, Production/Meta/admin/write rejection,
workspace/identity mismatch, duplicate workspace rows, lease rejection, unsafe
secret file handling and a fresh process with no binding. These are synthetic
policy proofs, not live authentication, provider import or independent QA.

Additional read-only Staging check: exactly 1 FanMind Page binding and 0 WellFit
bindings in the target workspace, with **0 persisted conversations**. This is
not evidence that the Owner's test message arrived; it confirms the real-message
acceptance is still open. No message contents or tokens were read.

Offline validation: 18 policy tests plus CI ownership test PASS; 123 God Mode
adversarial tests PASS; focused ESLint and full Next.js/TypeScript build PASS.
The first build attempt with a cross-worktree dependency symlink could not
resolve Next.js; a worktree-local dependency copy resolved it without code changes.
A bounded mutation removing the exact-origin guard made all 3 targeted negative
tests fail, then the guard was restored. God Mode preflight passes while the
release evaluator correctly stays BLOCK with missing protected evidence.
No independent QA or authenticated E2E is claimed.

Affected acceptance boundary: `FM-CONTRACT-SOCIAL-CRM-001` /
`FM-IGATE-SOCIAL-CRM-001` (Social acceptance remains open; no product contract
or server Auth/RLS implementation changes). No merge/release ALLOW is claimed.

Next: independently verify the existing Operator and supply its protected
Staging-only binding to the actual ChatGPT execution environment. Then complete
the browser auth flow, scope/expiry/revocation/CSRF/two-tenant negatives and a
bounded Messenger/comment automation. Match the Owner's already sent real
test message to its persisted Staging conversation and visible chat, verify
duplicate synchronization and original reply links, and obtain independent QA.
Never label empty sync results or synthetic fixtures as that real-message proof.

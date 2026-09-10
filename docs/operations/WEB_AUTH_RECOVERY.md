# Web password recovery — FM-REG-001

The Web recovery flow keeps the environment that requested the email. It no
longer redirects every non-local request to Production. English requests keep
`?lang=en`; other language values use the German callback.

| Request origin | Callback path on the same origin |
| --- | --- |
| `https://fanmind.ch` | `/reset-password` |
| `https://www.fanmind.ch` | `/reset-password` |
| `https://staging.fanmind.ch` | `/reset-password` |
| HTTP(S) localhost, 127.0.0.1 or [::1], with optional port | `/reset-password` |

Unknown origins, public HTTP origins and nonstandard public ports are rejected.
There is no fallback to another environment. The respective Supabase project's
redirect allowlist must permit the exact DE/EN callbacks used in that environment.
This change does not edit provider settings or send email.

The existing implicit-flow callback must contain one access token and
`type=recovery` in its fragment. Provider errors, duplicate parameters, malformed
tokens, wrong link types and credential-bearing query parameters are rejected.
The page removes the query and fragment before contacting Auth, retaining only
the language in the address. Only the access token is held in component memory;
the refresh token is not retained or installed as a browser/server session.
An authenticated `/user` response with a user ID is required before the password
form appears. GET/PUT user requests have a 15-second transport timeout. Successful
password updates clear the local recovery token and password fields.
Opening another fragment link in the same page clears the previous form/token
and validates the new link. Outdated validation and save responses cannot replace
the new flow's result.

This parser validates callback shape; the provider validates the credential.
The `type` field is not proof of token provenance. PKCE/code and token-hash
callbacks are unsupported by this Web flow. Mobile has its separate PKCE policy.

## Verification and remaining release evidence

- `node --test tests/web-recovery-policy.test.mjs`: executable origin, language,
  malformed, duplicate, wrong-type and provider-error cases.
- `e2e/public-critical.spec.ts`: synthetic provider interception for immediate
  address cleanup, pending user validation, valid password update, expired token,
  missing user, network error and invalid callbacks without Auth requests.
- Required CI runs the policy and browser tests on desktop/mobile Chromium.
  Test credentials and responses are synthetic; no real account is mutated.
- Still required separately: exact-head CI, publication evidence, current
  Supabase allowlist verification, and an explicitly started real email flow on
  the intended environment. Repository tests alone do not prove email delivery.

Recovery from a release regression is a revert of this bounded application
change and redeploy of the prior reviewed release. No schema, provider or account
data migration is involved; this rollback has been reviewed, not executed.

## Registration boundary

Existing prices remain complete. Paid registration is still blocked by
`payment_terms_version_unresolved` until the authoritative payment-terms version
is confirmed. This recovery fix does not activate registration, Billing, social
providers or change the Restore VM password. Real signup/email confirmation,
workspace provisioning and payment acceptance remain separate release evidence.

Provider contract: [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
and [implicit flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow).

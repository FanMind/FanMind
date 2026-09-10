# Web registration and activation

Task FM-REG-002 / FM-CR-026, 10 September 2026.

## Implemented account flow

1. `/register` offers a free login account in DE/EN. Existing Starter prices and option links remain visible. Paid activation readiness is stated before submission. The retired Pilot, permanent Daily catalog entry and Growth/Agency activation remain unavailable.
2. Signup submits only bounded personal profile data and non-authoritative package/referral preferences. No `plan_id`, `commercial_option`, billing state, payment-terms version or acceptance timestamp is written. It creates no Workspace and invokes no Stripe operation.
3. The custom Supabase Auth client supplies an explicit same-environment `emailRedirectTo`. Success explains email confirmation, existing-account login and recovery without claiming that an obfuscated existing-account response represents a new account. Resend uses the existing provider signup-resend endpoint with a 60-second UI cooldown; provider rate limits remain authoritative.
4. `/register/confirm` requires one bounded `type=signup` implicit session, rejects errors/mixed/query/duplicate credentials, scrubs callback material before async work and checks the confirmed email through authenticated Supabase `/user`. It displays the verified address; the user explicitly continues before cookies are synchronized. Invalid, expired or used links offer a direct confirmation resend form, login and password recovery.
5. A valid signup callback returning to the provider's existing `/` or `/login` Site URL is forwarded to the confirmation page. This handles a provider fallback without silently changing the Auth redirect allowlist or Site URL.
6. An immediate signup session and later normal login both reach the existing authenticated `/workspace/setup`. That path still requires fresh explicit package selection and current payment terms before its trusted server-owned Workspace RPC. Existing members and owners retain their existing Workspace route. New accounts cannot access CRM or create paid workspaces while activation is blocked.

## Production publication scope

The owner explicitly requested registration completion and normal Web publication.
This release may publish the account flow; it does not claim a completed paid
onboarding or provide missing legal/tax evidence. All existing protected SQL,
commercial pricing, activation flag, terms evidence and billing gates remain
unchanged. No provider settings, actual test email or payment is changed/sent.

## Remaining full-activation requirements

- Payment terms: the code/SQL currently records `2026-06-v1`, while the public document says July 2026 and its changes have no accepted version decision. Confirm the exact reviewed current document/version. A new version requires the matching separately reviewed controlled function migration; never relabel old acceptances.
- Tax: read-only Stripe Live observation on 2026-09-10 returned zero Tax registrations (`has_more=false`). Settings were active, which is insufficient. The actual approved tax facts, applicable registration and account evidence must be supplied before the existing Tax gate can pass. Do not invent a UID or create a tax registration from an assumption.
- Billing: preserve both existing ledger/canonical runtime controls and the remaining Production acceptance/activation requirements. Publishing this Web change does not apply their SQL or enable canonical billing/Plus/Ultra.
- Real account acceptance: verify the received confirmation email, final callback, existing-account and expired-link recovery with an explicitly approved controlled recipient. Check the exact Production/Staging redirect configuration as part of that proof. Synthetic tests are code evidence only.
- On paid activation, re-confirm the chosen package/terms and complete Workspace, recorded referral preference, checkout, webhook/payment and recovery acceptance. A stored referral preference is not an accepted attribution or a discount.
- Preserve the external legal/tax/AVV/provider/retention controls in `docs/LEGAL_COMPLETION_STATUS.md`. No external control is marked accepted by this implementation.

## Verification and recovery

Existing policy tests cover malformed and wrong-purpose callbacks, foreign origins,
metadata authority exclusion, unchanged protected Workspace/Checkout boundaries
and error redaction. The existing public Chromium suite intercepts every signup
and resend call with synthetic responses or aborts it. It covers DE/EN layout,
account-only signup, resend, verified-email continuation, provider rejection and
absence of session writes for invalid links. No real account or email is created
by those tests.

Use the existing isolated Web release rollback or revert the bounded code change.
No migration or commercial data backfill accompanies this release. Any real user
accounts created after publication remain ordinary Supabase Auth accounts; never
delete them as part of an application rollback.

> Aktualisierung 14.09.2026 (FM-DEC-020): Daily-Sichtbarkeit und neue Buchungen werden dauerhaft unter `/admin/settings` ein-/ausgeschaltet. Aus blendet das öffentliche Angebot seitenweit aus; bestehende Abos und Vertragsdaten bleiben erhalten. Frühere Aussagen zur bedingungslosen Sichtbarkeit sind dadurch ersetzt. Technische Workspace-/Stripe-/Tax-/Billing-Freigaben bleiben erforderlich.

# Web registration and activation

Task FM-REG-002 / FM-CR-026, 10 September 2026.

## Implemented account flow

1. `/register` offers a free login account in DE/EN. Existing Starter prices and option links remain visible. Paid activation readiness is stated before submission. FM-DEC-014 adds the permanent public Daily choice at `/register?plan=daily` (EUR 0 setup + EUR 1/day); legacy `plan=pilot&test_plan=daily` URLs remain compatible. The retired paid Pilot and Growth/Agency activation remain unavailable.
2. Signup submits only bounded personal profile data and non-authoritative package/referral preferences. No `plan_id`, `commercial_option`, billing state, payment-terms version or acceptance timestamp is written. It creates no Workspace and invokes no Stripe operation.
3. The custom Supabase Auth client supplies an explicit same-environment `emailRedirectTo`. Success explains email confirmation, existing-account login and recovery without claiming that an obfuscated existing-account response represents a new account. Resend uses the existing provider signup-resend endpoint with a 60-second UI cooldown; provider rate limits remain authoritative.
4. `/register/confirm` requires one bounded `type=signup` implicit session, accepts and discards Supabase's optional single empty `sb` marker, rejects errors/mixed/query/duplicate credentials, scrubs callback material before async work and checks the confirmed email through authenticated Supabase `/user`. After verification it automatically synchronizes the existing server session and continues to localized `/workspace/setup`. A failed session handoff retains the verified identity and offers an explicit retry or login; it does not automatically resend. Invalid, expired or used links offer a direct confirmation resend form, login and password recovery.
5. A valid signup callback returning to the provider's existing `/` or `/login` Site URL is forwarded to the confirmation page. This handles a provider fallback without silently changing the Auth redirect allowlist or Site URL.
6. An immediate signup session and later normal login both reach the existing authenticated `/workspace/setup`. That path still requires fresh explicit package selection and current payment terms before its trusted server-owned Workspace RPC. Existing members and owners retain their existing Workspace route. New accounts cannot access CRM or create paid workspaces while activation is blocked.

## Production publication scope

The owner explicitly requested registration completion and normal Web publication.
This release may publish the account flow; it does not claim a completed paid
onboarding or provide missing legal/tax evidence. All existing protected SQL,
commercial pricing, activation flag, terms evidence and billing gates remain
unchanged. No provider settings, actual test email or payment is changed/sent.

Read-only Auth readiness on 10 September 2026 also confirms that the FanMind Production project permits signups, has email login enabled and requires email confirmation (`disable_signup=false`, `external.email=true`, `mailer_autoconfirm=false`). This does not prove delivery of a real message.

## Three-offer follow-up (FM-BILL-002 / PR #1096)

FM-DEC-014 separately authorizes permanent Daily selection and publication.
The former 24-hour admission window is superseded; existing server-side
provisioning, consent, Tax and Billing controls still apply. Current missing
Production RPC/contract and ledger rollout, provider naming, tax and exact
versioned-contract prerequisites are recorded individually in
`docs/operations/RELEASE_ACCEPTANCE_20260910.md`. The source publication
scope above describes the already completed #1095 account release.

## Remaining full-activation requirements

- Payment terms: the code/SQL currently records `2026-06-v1`, while the public document now includes the owner-approved third offer dated 10 September 2026 and its changes have no accepted version decision. Confirm the exact reviewed current document/version. A new version requires the matching separately reviewed controlled function migration; never relabel old acceptances.
- Tax: read-only Stripe Live observation on 2026-09-10 returned zero Tax registrations (`has_more=false`). Settings were active, which is insufficient. The actual approved tax facts, applicable registration and account evidence must be supplied before the existing Tax gate can pass. Do not invent a UID or create a tax registration from an assumption.
- Billing: preserve both existing ledger/canonical runtime controls and the remaining Production acceptance/activation requirements. Publishing this Web change does not apply their SQL or enable canonical billing/Plus/Ultra.
- Real account acceptance: verify the received confirmation email, final callback, existing-account and expired-link recovery with an explicitly approved controlled recipient. Check the exact Production/Staging redirect configuration as part of that proof. Synthetic tests are code evidence only.
- On paid activation, re-confirm the chosen package/terms and complete Workspace, recorded referral preference, checkout, webhook/payment and recovery acceptance. A stored referral preference is not an accepted attribution or a discount.
- Preserve the external legal/tax/AVV/provider/retention controls in `docs/LEGAL_COMPLETION_STATUS.md`. No external control is marked accepted by this implementation.

## Verification and recovery

Existing policy tests cover malformed and wrong-purpose callbacks, foreign origins,
metadata authority exclusion, unchanged protected Workspace/Checkout boundaries
and error redaction. The public Chromium suites intercept signup/resend requests
with synthetic responses or abort them. They cover DE/EN layout, account-only
signup, resend, verified-email automatic continuation, legacy and current `sb`
redirects, the existing HttpOnly session endpoint, provider rejection, late
responses, explicit retry after a failed handoff and no session write for invalid
links. No real account or email is created by those tests.

Use the existing isolated Web release rollback or revert the bounded code change.
No migration or commercial data backfill accompanies this release. Any real user
accounts created after publication remain ordinary Supabase Auth accounts; never
delete them as part of an application rollback.

## 14 September 2026 callback correction

The previous strict parser rejected Supabase Auth's empty `sb` identifier before
calling `/user`. The exact original source reproduced this rejection while the
older synthetic fragment without the marker passed. The correction allows only
that one empty marker; it does not permit arbitrary provider tokens or remove the
expiry requirement. The owner's automatic email-to-setup criterion replaces the
former redundant continuation click. Receipt:
`project-memory/receipts/FM-REG-002-SUPABASE-MARKER-20260914.md`.
The separately deployed #1123 payment-terms switch stays enabled; this correction
does not reconfigure Stripe, install provisioning SQL or accept the entire paid
customer flow. The owner-controlled real email-to-setup result remains required.

## Owner walkthrough after #1124 — 14 September 2026

The owner supplied the real selected-Daily registration screen, delivered confirmation email and authenticated /workspace/setup result; ordinary login reaches the same setup page. This accepts that bounded real account/email/session path for the shown test. Do not repeat signup, delete the account or reopen the corrected callback/template. Setup still displayed only the two Starter options; the current consolidated #1125 candidate preserves Daily visibility and preference while keeping actual admission gated. Complete Workspace/checkout/webhook and recovery-negative acceptance remain separate.

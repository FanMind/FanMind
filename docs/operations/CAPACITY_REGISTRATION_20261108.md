# Capacity-v2 registration and price alignment — 8 November 2026

Status: SOURCE_PREPARED / runtime acceptance OPEN. No deployment or payment activation.
Baseline: main `4e6d422d0f556d193f7dde082d2942e3b982867d` (includes #1442).
Existing uncommitted public-pricing work was inspected and selectively reused;
unrelated Admin/SQL/provider changes were not copied.

## Contract and implemented changes

Uses accepted FM-DEC-026 / `AI_CAPACITY_BILLING_V2.md`, not a new pricing decision.
The central public package catalog owns EUR 99/199/312 monthly, zero setup.
Existing AI policy and sandbox catalog validation consume that source. One-time
EUR 14.99/37.49/74.99/149.00 data prices reuse `stripeAiTopupPolicy.mjs`.
Registration offers all three packages with native radio semantics, visible
selection and separate non-authoritative Auth preferences. The DE/EN language
links retain package/referral. No Workspace/terms acceptance/Stripe call is
created by signup. Legacy URLs resolve to the current package preferences.
Landing, authenticated setup/onboarding/package selection and Admin catalog
use the same packages. Data purchases are explicitly one-time and in preparation.
Authenticated selection is local and never changes the existing subscription.
Public AGB/payment readers distinguish new package information from historical
Starter terms. No old consent is relabelled and no new minimum term is invented.
The bounded Support FAQ reads the same prices; public LLM Support retains its
existing guard that sends monetary/contract questions to the pricing section.

New public provisioning rejects legacy Starter offers and unsupported Capacity
admission through both the API and server action. Daily's existing manual gate
and separate consent path remain unchanged. Historical billing/contract readers,
cancellation, individual contracts and existing Stripe subscriptions remain.
Prior read-only Staging evidence records two historical Starter Workspaces;
no inference that these are newly sellable or authorization to convert them.

## Application-wide audit

- Registration, landing, setup, onboarding, package/upgrade display, Admin catalog,
  Support FAQ and current legal offer cards reconciled.
- Existing dashboard, billing/start summary, legacy AI add-ons and cancellation
  resolve existing Workspace contracts and intentionally retain historical terms.
  Public setup can no longer create one of those legacy Starter contracts.
- No new Capacity Checkout endpoint, entitlement writer or upgrade engine is
  represented as active. Existing legacy Checkout remains for existing contracts.
- No old tariff literals found in application email-template files; old translation
  dictionary entries and legacy/referral contract records are retained for their
  existing readers. Supabase/Stripe hosted mail templates were not modified.
- Prices are net. Tax registration, reviewed terms revision, invoice treatment,
  package entitlements and paid lifecycle remain prerequisites before selling.

## Price mapping and environment boundaries

The existing protected sandbox workflow binds each `STRIPE_PRICE_CAPACITY_*`
from the corresponding `FANMIND_STAGING_STRIPE_PRICE_CAPACITY_*` variable.
Its read-only validator requires a Test key, Staging target, distinct IDs, active
Test products/prices, exact EUR amounts, exclusive tax, monthly licensed billing
for base packages and `one_time`/no recurring fields for all data packages.
Missing mappings or Live objects fail closed. No Live ID fallback was introduced.
This change tests that the public package IDs, amounts and verifier slots agree;
it does not claim that a future Checkout already consumes those IDs.
The connected Stripe tool exposes only the Live account in this session. It was
not used to fabricate a sandbox context or modify any account/subscription.

## Verification

- Full optimized Next.js build including TypeScript: PASS (synthetic public env).
- Initial focused set: 75/75 PASS, including Daily regression, forged/stale consent,
  rejected legacy/Capacity provisioning, metadata authority and catalog negatives.
  Additional public-projection regression is included in the full Operations suite.
- Rendered production build: HTTP 200 and product-truth PASS on /, /?lang=en,
  /register and 199/312 direct selections; AGB/payment pages render all three plans.
- Product/referral/legal-schema/pinned-Actions checks: PASS. External legal readiness
  remains false, as before; that is not overridden by structural verification.
- Focused lint: PASS. Governance preflight and fail-closed adversarial suite: PASS;
  the conservative release decision remains BLOCK, not an activation permit.
- Desktop/mobile Chromium suite added: all three radio choices, both languages,
  no overflow, synthetic signup, exact metadata and no payment/provisioning calls.
  Local execution BLOCKED: Playwright Chromium download returns a non-ZIP/truncated
  archive; no browser PASS or screenshot is claimed. PR CI must execute it.
- An initial broad Operations run had one stale old-price assertion (updated)
  plus three `checkout_dirty` failures from tests requiring a committed clean tree.
  Final clean-tree run is authoritative and reported separately in the PR.

## Open runtime acceptance / release order

The existing deploy-staging workflow runs only for `refs/heads/main` and an exact
reviewed main commit. Consequently it cannot deploy this PR before a main merge.
No workflow or target boundary was weakened and no main merge was performed.
A reviewed preview-release path or an explicitly agreed main-first integration
sequence is needed to perform the requested Staging-before-merge order.
Actual Staging display, mobile/desktop browser acceptance, exact runtime Price-ID
readback, sandbox Checkout/tax total, webhook credit/idempotency/refund and no-setup
line-item evidence remain OPEN. Existing activation gates must stay closed.
The pre-existing top-up lifecycle limitations in STAGING_STRIPE_CATALOG_READINESS
remain open; a catalog match alone proves neither the correct credit amount nor
the checkout/webhook binding. No paid admission was enabled to bypass them.

Affected contracts: FM-CONTRACT-REG-ENTITLEMENT-001 (R3),
FM-CONTRACT-AI-BILLING-001 (R4); boundaries FM-IGATE-REG-ENTITLEMENT-001 and
FM-IGATE-AI-BILLING-001. No runtime gate marked verified by module tests.
Recovery: revert this bounded source change. No database, provider, subscription,
secret, permission or Production rollback is needed because none was changed.

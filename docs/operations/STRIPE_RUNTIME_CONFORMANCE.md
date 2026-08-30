# Stripe runtime conformance

## Accepted repository boundary

FanMind production server modules use Stripe Node SDK `22.4.0` through the
single client factory in `src/lib/stripeClient.ts`. Outbound SDK requests are
pinned to API version `2026-07-29.dahlia`, use bounded network retries and a
12-second timeout. Checkout leaves eligible payment-method selection to the
Stripe Dashboard and sends a `fanmind_checkout_` integration identifier with
a fresh eight-letter suffix for every Session creation.

This dynamic-method rule also applies to `internal_daily_test`; it has no
code-side card-only exception. The existing workspace value
`payment_collection_method=card` remains a schema-compatibility marker for
Stripe-hosted collection and must not be interpreted as the method offered or
selected in Checkout.

Automatic Tax remains fail-closed. Checkout is unavailable unless
`FANMIND_TAX_MODE=stripe_tax` and
`FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED=true` are both explicitly present.
This repository contract does not claim that a registration exists.

## Deliberately separate inbound webhook boundary

The isolated Staging webhook endpoint was last read-only verified at inbound
API version `2026-06-24.dahlia`. That observed endpoint version is intentionally
not rewritten by this code change: changing it requires an authorized
provider-side migration followed by a new signed webhook and lifecycle
acceptance. Until then, the Staging verifier stays pinned to the observed
version and the newer outbound SDK version does not imply webhook migration.

This work performs no provider mutation, payment, refund, price/coupon change,
webhook endpoint update, database write, tax-registration claim, Plus/Ultra
activation or Production configuration change.

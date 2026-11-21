# Capacity-v2 monthly Checkout source

Task evidence: FanMind #1512, comment 7069808685. Existing package and writer:
#1503. Scope affects FM-CONTRACT-REG-ENTITLEMENT-001 /
FM-IGATE-REG-ENTITLEMENT-001 and FM-CONTRACT-AI-BILLING-001 /
FM-IGATE-AI-BILLING-001.

Source adds an owner-bound monthly Checkout for preapproved Staging workspaces,
matching the existing protected Price mapping, package catalogue and Stripe
test Price. Existing commercial terms, billing and spend freeze, signed event,
entitlement/grant and checkout retry boundaries continue to apply. Initial
workspace admission is separately controlled and the new SQL is unapplied.
Public registration, payment activation, Live top-ups and Production delivery
remain gated. Checkout session creation does not prove subscription binding,
entitlement projection, credit or invoice access.

The module and the native PostgreSQL suite exercise package/price agreement,
owner boundaries, pending state and retry behavior. Target recovery and
admission remain open. A normal web deploy cannot apply the SQL. Revert
source if needed before target installation. See AI_CAPACITY_BILLING_V2.md
for the scope and next prerequisites.

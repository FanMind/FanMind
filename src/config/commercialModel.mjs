import { getAiTierConfig } from "./aiTiers.mjs";

export const CORE_MONTHLY_FEE_CENTS = 31_200;
export const CORE_INCLUDED_CONNECTIONS = 10;
export const CONNECTION_PACK_SIZE = 5;
export const CONNECTION_PACK_MONTHLY_FEE_CENTS = 4_900;
export const AGENCY_HUB_MONTHLY_FEE_CENTS = 31_200;

export const AGENCY_CREATOR_DISCOUNT_TIERS = Object.freeze([
  Object.freeze({ minimumCreators: 20, discountPercent: 15 }),
  Object.freeze({ minimumCreators: 10, discountPercent: 10 }),
  Object.freeze({ minimumCreators: 5, discountPercent: 5 }),
  Object.freeze({ minimumCreators: 1, discountPercent: 0 }),
]);

function nonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative integer`);
  }
  return value;
}

export function connectionPackCount(connectionCount) {
  nonNegativeInteger(connectionCount, "connectionCount");
  return Math.ceil(
    Math.max(0, connectionCount - CORE_INCLUDED_CONNECTIONS) /
      CONNECTION_PACK_SIZE,
  );
}

export function getAgencyCreatorDiscountPercent(creatorCount) {
  nonNegativeInteger(creatorCount, "creatorCount");
  if (creatorCount === 0) return 0;
  return AGENCY_CREATOR_DISCOUNT_TIERS.find(
    ({ minimumCreators }) => creatorCount >= minimumCreators,
  ).discountPercent;
}

export function calculateCommercialMonthlyAmounts({
  aiTierId = "standard",
  connectionCount = CORE_INCLUDED_CONNECTIONS,
  referralDiscountPercent = 0,
  agencyCreatorCount = 0,
  creatorPaysDirectly = false,
} = {}) {
  nonNegativeInteger(connectionCount, "connectionCount");
  nonNegativeInteger(agencyCreatorCount, "agencyCreatorCount");
  if (
    !Number.isInteger(referralDiscountPercent) ||
    referralDiscountPercent < 0 ||
    referralDiscountPercent > 100
  ) {
    throw new TypeError("referralDiscountPercent must be an integer from 0 to 100");
  }

  const aiAddOnCents = getAiTierConfig(aiTierId).monthlyAddOnCents;
  const packs = connectionPackCount(connectionCount);
  const connectionAddOnCents =
    packs * CONNECTION_PACK_MONTHLY_FEE_CENTS;
  const agencyDiscountPercent = creatorPaysDirectly
    ? 0
    : getAgencyCreatorDiscountPercent(agencyCreatorCount);
  const agencyBilled = !creatorPaysDirectly && agencyCreatorCount > 0;

  if (referralDiscountPercent > 0 && agencyCreatorCount > 0) {
    throw new Error(
      "Referral discount and agency volume discount cannot be combined",
    );
  }

  const coreReferralDiscountCents = Math.round(
    (CORE_MONTHLY_FEE_CENTS * referralDiscountPercent) / 100,
  );
  const discountedCoreCents = agencyBilled
    ? 0
    : CORE_MONTHLY_FEE_CENTS - coreReferralDiscountCents;
  const agencyHubCents = agencyBilled
    ? AGENCY_HUB_MONTHLY_FEE_CENTS
    : 0;
  const agencyCreatorGrossCents =
    agencyBilled ? agencyCreatorCount * CORE_MONTHLY_FEE_CENTS : 0;
  const agencyCreatorDiscountCents = Math.round(
    (agencyCreatorGrossCents * agencyDiscountPercent) / 100,
  );

  return Object.freeze({
    coreMonthlyFeeCents: CORE_MONTHLY_FEE_CENTS,
    coreReferralDiscountCents,
    discountedCoreCents,
    aiAddOnCents,
    includedConnections: CORE_INCLUDED_CONNECTIONS,
    connectionPackCount: packs,
    connectionAddOnCents,
    agencyHubCents,
    agencyCreatorGrossCents,
    agencyCreatorDiscountPercent: agencyDiscountPercent,
    agencyCreatorDiscountCents,
    totalMonthlyCents:
      discountedCoreCents +
      aiAddOnCents +
      connectionAddOnCents +
      agencyHubCents +
      agencyCreatorGrossCents -
      agencyCreatorDiscountCents,
  });
}

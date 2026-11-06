import { CORE_MONTHLY_FEE_CENTS } from "../config/commercialModel.mjs";

export const REFERRAL_DISCOUNT_STEP_PERCENT = 5;
export const REFERRAL_MAX_ACTIVE_COUNT = 20;
export const REFERRAL_GROWTH_WINDOW_CAP = 2000;

/**
 * @param {unknown} value
 * @param {number} [fallback]
 * @returns {number}
 */
function finiteInteger(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.trunc(numeric);
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function normalizeReferralCount(value) {
  return Math.max(0, finiteInteger(value));
}

/**
 * @param {unknown} value
 * @returns {number}
 */
export function clampReferralDiscountPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(Math.round(numeric), 100));
}

/**
 * @param {number} activeReferralCount
 * @param {number | null | undefined} overrideDiscountPercent
 * @returns {{
 *   activeReferralCount: number;
 *   billableActiveReferralCount: number;
 *   discountPercent: number;
 * }}
 */
export function calculateReferralPercent(
  activeReferralCount,
  overrideDiscountPercent = null,
) {
  const normalizedActiveCount = normalizeReferralCount(activeReferralCount);
  const billableActiveReferralCount = Math.min(
    normalizedActiveCount,
    REFERRAL_MAX_ACTIVE_COUNT,
  );
  const calculatedPercent =
    billableActiveReferralCount * REFERRAL_DISCOUNT_STEP_PERCENT;
  const discountPercent =
    overrideDiscountPercent == null
      ? clampReferralDiscountPercent(calculatedPercent)
      : clampReferralDiscountPercent(overrideDiscountPercent);

  return {
    activeReferralCount: normalizedActiveCount,
    billableActiveReferralCount,
    discountPercent,
  };
}

/**
 * @param {number} coreMonthlyFeeCents
 * @param {number} activeReferralCount
 * @param {number | null | undefined} overrideDiscountPercent
 * @returns {{
 *   activeReferralCount: number;
 *   billableActiveReferralCount: number;
 *   discountPercent: number;
 *   monthlyFeeCentsBeforeDiscount: number;
 *   monthlyDiscountCents: number;
 *   monthlyFeeCentsAfterDiscount: number;
 * }}
 */
export function calculateReferralMonthlyAmounts(
  coreMonthlyFeeCents,
  activeReferralCount,
  overrideDiscountPercent = null,
) {
  const monthlyFeeCentsBeforeDiscount = Math.min(
    CORE_MONTHLY_FEE_CENTS,
    Math.max(
      0,
      finiteInteger(coreMonthlyFeeCents),
    ),
  );
  const referral = calculateReferralPercent(
    activeReferralCount,
    overrideDiscountPercent,
  );
  const monthlyDiscountCents = Math.min(
    monthlyFeeCentsBeforeDiscount,
    Math.round(
      (monthlyFeeCentsBeforeDiscount * referral.discountPercent) / 100,
    ),
  );

  return {
    ...referral,
    monthlyFeeCentsBeforeDiscount,
    monthlyDiscountCents,
    monthlyFeeCentsAfterDiscount:
      monthlyFeeCentsBeforeDiscount - monthlyDiscountCents,
  };
}

/**
 * @param {string | null | undefined} status
 * @param {number} activePaidWorkspaceCount
 * @param {number} [activePaidWorkspaceCap]
 * @returns {boolean}
 */
export function isReferralGrowthWindowOpen(
  status,
  activePaidWorkspaceCount,
  activePaidWorkspaceCap = REFERRAL_GROWTH_WINDOW_CAP,
) {
  const normalizedStatus = String(status ?? "").trim().toLowerCase();
  const count = normalizeReferralCount(activePaidWorkspaceCount);
  const cap = Math.max(1, normalizeReferralCount(activePaidWorkspaceCap));

  return ["open", "reopened"].includes(normalizedStatus) && count < cap;
}

/**
 * @typedef {object} ReferralEligibilityWorkspace
 * @property {string | null | undefined} [billing_status]
 * @property {string | null | undefined} [commercial_option]
 * @property {number | null | undefined} [setup_fee_cents]
 * @property {number | null | undefined} [monthly_fee_cents]
 * @property {string | null | undefined} [name]
 */

/**
 * @param {ReferralEligibilityWorkspace | null | undefined} workspace
 * @returns {{ eligible: boolean; reason: string | null }}
 */
export function evaluateReferralWorkspaceEligibility(workspace) {
  if (!workspace) {
    return {
      eligible: false,
      reason:
        "Workspace konnte für das Empfehlungsprogramm nicht geprüft werden.",
    };
  }

  const billingStatus = String(workspace.billing_status ?? "")
    .trim()
    .toLowerCase();
  const commercialOption = String(workspace.commercial_option ?? "")
    .trim()
    .toLowerCase();
  const name = String(workspace.name ?? "");
  const isDemo =
    billingStatus === "demo_free" ||
    /demo/i.test(name) ||
    commercialOption === "internal_daily_test";

  if (isDemo) {
    return {
      eligible: false,
      reason:
        "Demo- und interne Test-Workspaces nehmen nicht am Empfehlungsprogramm teil.",
    };
  }

  const setupFeeCents = Math.max(0, finiteInteger(workspace.setup_fee_cents));
  const monthlyFeeCents = Math.max(
    0,
    finiteInteger(workspace.monthly_fee_cents),
  );
  if (setupFeeCents <= 0 && monthlyFeeCents <= 0) {
    return {
      eligible: false,
      reason:
        "Für diesen Workspace ist noch kein zahlungspflichtiges Paket hinterlegt.",
    };
  }

  if (billingStatus !== "active") {
    return {
      eligible: false,
      reason:
        "Der Workspace wird nach erfolgreicher Zahlung für Empfehlungen freigeschaltet.",
    };
  }

  return { eligible: true, reason: null };
}

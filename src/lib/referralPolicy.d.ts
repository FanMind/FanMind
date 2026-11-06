export const REFERRAL_DISCOUNT_STEP_PERCENT: 5;
export const REFERRAL_MAX_ACTIVE_COUNT: 20;
export const REFERRAL_GROWTH_WINDOW_CAP: 2000;

export type ReferralPercentage = {
  activeReferralCount: number;
  billableActiveReferralCount: number;
  discountPercent: number;
};

export type ReferralMonthlyAmounts = ReferralPercentage & {
  monthlyFeeCentsBeforeDiscount: number;
  monthlyDiscountCents: number;
  monthlyFeeCentsAfterDiscount: number;
};

export type ReferralEligibilityWorkspace = {
  billing_status?: string | null;
  commercial_option?: string | null;
  setup_fee_cents?: number | null;
  monthly_fee_cents?: number | null;
  name?: string | null;
};

export type ReferralEligibilityResult = {
  eligible: boolean;
  reason: string | null;
};

export function normalizeReferralCount(value: unknown): number;
export function clampReferralDiscountPercent(value: unknown): number;
export function calculateReferralPercent(
  activeReferralCount: number,
  overrideDiscountPercent?: number | null,
): ReferralPercentage;
export function calculateReferralMonthlyAmounts(
  monthlyFeeCents: number,
  activeReferralCount: number,
  overrideDiscountPercent?: number | null,
): ReferralMonthlyAmounts;
export function isReferralGrowthWindowOpen(
  status: string | null | undefined,
  activePaidWorkspaceCount: number,
  activePaidWorkspaceCap?: number,
): boolean;
export function evaluateReferralWorkspaceEligibility(
  workspace: ReferralEligibilityWorkspace | null | undefined,
): ReferralEligibilityResult;

export type RegistrationPlanId = "pilot" | "starter" | "growth" | "agency";
export type StarterOfferOption =
  | "starter_paid_setup"
  | "starter_no_setup_commitment";

export function normalizeStarterOfferOption(
  value: unknown,
): StarterOfferOption;

export function isDailyTestRegistration(input: {
  enabled?: unknown;
  planId?: unknown;
  testPlan?: unknown;
}): boolean;

export function isProductiveRegistrationEntry(input: {
  enabled?: unknown;
  planId?: unknown;
  testPlan?: unknown;
}): boolean;

export function buildRegistrationHref(input: {
  language?: "de" | "en";
  planId: RegistrationPlanId;
  starterOption?: unknown;
  referralCode?: unknown;
  testPlan?: unknown;
}): string;

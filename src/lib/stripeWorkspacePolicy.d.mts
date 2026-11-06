export type StripeBillingWorkspacePolicyInput = {
  workspace:
    | {
        owner_user_id?: string | null;
      }
    | null
    | undefined;
  ownerEmail?: string | null;
  hasTemporaryDemoSession: boolean;
};

export const FIXED_DEMO_EMAIL: string;
export const STRIPE_BILLING_ALLOWED: "allowed";
export const STRIPE_BILLING_BLOCKED: "blocked";
export const STRIPE_BILLING_RETRYABLE_ERROR: "retryable_error";
export const STRIPE_BILLING_UPDATED: "updated";
export const STRIPE_BILLING_ZERO_ROWS: "zero_rows";

export type StripeBillingWorkspaceDecision =
  | typeof STRIPE_BILLING_ALLOWED
  | typeof STRIPE_BILLING_BLOCKED
  | typeof STRIPE_BILLING_RETRYABLE_ERROR;

export type StripeBillingUpdateDecision =
  | typeof STRIPE_BILLING_BLOCKED
  | typeof STRIPE_BILLING_RETRYABLE_ERROR
  | typeof STRIPE_BILLING_UPDATED;

export type StripeBillingPatchDecision =
  | typeof STRIPE_BILLING_RETRYABLE_ERROR
  | typeof STRIPE_BILLING_UPDATED
  | typeof STRIPE_BILLING_ZERO_ROWS;

export type StripeWorkspaceResolution =
  | { status: "found"; workspaceId: string }
  | { status: "not_found" }
  | { status: "retryable_error" };

export function resolveStripeWebhookWorkspaceCandidates(input: {
  directCandidates: readonly unknown[];
  referenceResolution: StripeWorkspaceResolution;
  allowDirectBootstrap?: boolean;
}): StripeWorkspaceResolution;

export function stripeWebhookReferenceContractDecision(input: {
  eventType?: string;
  customerId?: string;
  subscriptionId?: string;
  paymentIntentId?: string;
}): StripeBillingWorkspaceDecision;

export function stripeWebhookReferenceLookupValues(input: {
  eventType?: string;
  customerId?: string;
  subscriptionId?: string;
  paymentIntentId?: string;
}):
  | {
      customerId?: string;
      subscriptionId?: string;
      paymentIntentId?: string;
    }
  | null;

export function stripeSubscriptionWorkspaceBindingDecision(input: {
  responseOk: boolean;
  bodyParsed: boolean;
  rows: unknown;
  workspaceId: string;
  customerId?: string;
  subscriptionId?: string;
}): StripeBillingWorkspaceDecision;

export function stripeBillingWorkspaceDecision(
  input: StripeBillingWorkspacePolicyInput,
): StripeBillingWorkspaceDecision;

export function isStripeBillingWorkspaceEligible(
  input: StripeBillingWorkspacePolicyInput,
): boolean;

export function stripeBillingPatchDecision(input: {
  responseOk: boolean;
  bodyParsed: boolean;
  rows: unknown;
  workspaceId: string;
}): StripeBillingPatchDecision;

export function stripeBillingManualSuspensionDecision(input: {
  responseOk: boolean;
  bodyParsed: boolean;
  rows: unknown;
  workspaceId: string;
}): StripeBillingUpdateDecision;

export type InternalDailyTestStripeConfig = {
  hasSecretKey?: boolean;
  hasWebhookSecret?: boolean;
  hasAppUrl?: boolean;
  hasInternalDailyTestPrice?: boolean;
  readyForWebhook?: boolean;
  readyForTax?: boolean;
};

export function isInternalDailyTestStripeReady(
  config: InternalDailyTestStripeConfig | null | undefined,
): boolean;

export function isInternalDailyTestAdmissionReady(input: {
  windowEnabled?: boolean;
  workspaceProvisioningReady?: boolean;
  billingRuntimeReady?: boolean;
  stripeConfig?: InternalDailyTestStripeConfig | null;
} | null | undefined): boolean;
export function isInternalDailyTestBillingRuntimeReady(environment?: NodeJS.ProcessEnv): boolean;

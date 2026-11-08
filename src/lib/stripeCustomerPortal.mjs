import { isStripeTestSecretKey } from "./stripeKeyPolicy.mjs";
import { isStripeBillingWriteFrozen } from "./stripeBillingWriteFreeze.mjs";

const origin = "https://staging.fanmind.ch";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const id = (value, prefix) => typeof value === "string" && new RegExp(`^${prefix}_[A-Za-z0-9]+$`, "u").test(value);
const reference = value => typeof value === "string" ? value : value?.id;
const fail = () => { throw new Error("stripe_portal_unavailable"); };

export function stripeCustomerPortalConfigured(env = process.env) {
  return env.FANMIND_RUNTIME_ENVIRONMENT === "staging" &&
    env.NEXT_PUBLIC_APP_URL?.replace(/\/$/u, "") === origin &&
    isStripeTestSecretKey(env.STRIPE_SECRET_KEY) && !isStripeBillingWriteFrozen(env) &&
    id(env.STRIPE_BILLING_PORTAL_CONFIGURATION, "bpc");
}

function validConfiguration(config, expectedId) {
  const features = config?.features;
  return config?.object === "billing_portal.configuration" && config.id === expectedId &&
    config.active === true && config.livemode === false && config.application === null &&
    config.login_page?.enabled === false && features?.invoice_history?.enabled === true &&
    Object.keys(features).sort().join(",") ===
      "customer_update,invoice_history,payment_method_update,subscription_cancel,subscription_update" &&
    ["customer_update", "payment_method_update", "subscription_cancel", "subscription_update"]
      .every(name => features[name]?.enabled === false);
}

// Existing test Customer and explicitly reviewed test configuration only.
// Never create/change a configuration, Customer, Subscription or entitlement.
export async function createWorkspaceStripePortal(input, deps, env = process.env) {
  if (!stripeCustomerPortalConfigured(env) || !uuid.test(input?.workspaceId ?? "") ||
      !id(input?.customerId, "cus")) fail();
  const configurationId = env.STRIPE_BILLING_PORTAL_CONFIGURATION;
  const binding = await deps.findWorkspace({ customerId: input.customerId });
  if (binding.status !== "found" || binding.workspaceId !== input.workspaceId) fail();
  const customer = await deps.stripe.customers.retrieve(input.customerId);
  if (customer?.object !== "customer" || customer.id !== input.customerId || customer.deleted === true ||
      customer.livemode !== false || customer.metadata?.workspace_id !== input.workspaceId) fail();
  const configuration = await deps.stripe.billingPortal.configurations.retrieve(configurationId);
  if (!validConfiguration(configuration, configurationId) || !stripeCustomerPortalConfigured(env) ||
      env.STRIPE_BILLING_PORTAL_CONFIGURATION !== configurationId) fail();
  const returnUrl = `${origin}/settings/invoices`;
  const session = await deps.stripe.billingPortal.sessions.create({
    configuration: configurationId, customer: customer.id, return_url: returnUrl,
  });
  if (session?.object !== "billing_portal.session" || !id(session.id, "bps") ||
      session.customer !== customer.id || reference(session.configuration) !== configurationId ||
      session.return_url !== returnUrl || typeof session.url !== "string") fail();
  const url = new URL(session.url);
  if (url.origin !== "https://billing.stripe.com" || url.username || url.password) fail();
  return { url: session.url };
}

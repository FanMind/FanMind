#!/usr/bin/env node
import { createHmac } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { runStagingStripeWebhookSmoke } from "../../src/lib/stagingStripeWebhookSmokePolicy.mjs";
import { verifyStagingBillingFreeze } from "./staging-billing-freeze-control.mjs";

const ORIGIN = "https://staging.fanmind.ch";
// Deliberately not a valid Stripe event ID: even an already enabled ledger
// rejects this before a database RPC. No workspace/provider references exist.
export function buildSignedFreezeProbe(now) {
  return JSON.stringify({ id: "fanmind-freeze-probe", created: now,
    type: "checkout.session.completed", livemode: false,
    data: { object: { object: "checkout.session" } } });
}
export async function runSignedBillingFreezeProbe(environment = process.env, fetchImpl = fetch) {
  if (environment.GITHUB_REF !== "refs/heads/main" ||
      environment.GITHUB_SHA !== environment.FANMIND_EXPECTED_RELEASE_COMMIT ||
      environment.FANMIND_SIGNED_BILLING_FREEZE_CONFIRM !== "verify-signed-billing-freeze") {
    throw new Error("probe_rejected");
  }
  const binding = await runStagingStripeWebhookSmoke(environment, { fetchImplementation: fetchImpl });
  if (!binding.ok) throw new Error("probe_rejected");
  const commit = environment.FANMIND_EXPECTED_RELEASE_COMMIT;
  await verifyStagingBillingFreeze({ origin: ORIGIN, commit, fetchImpl });
  const now = Math.floor(Date.now() / 1000);
  const body = buildSignedFreezeProbe(now);
  const signature = createHmac("sha256", environment.STRIPE_WEBHOOK_SECRET)
    .update(`${now}.${body}`).digest("hex");
  const response = await fetchImpl(`${ORIGIN}/api/stripe/webhook`, {
    method: "POST", body, redirect: "error", cache: "no-store",
    signal: AbortSignal.timeout(12000),
    headers: { "Content-Type": "application/json", "Stripe-Signature": `t=${now},v1=${signature}` },
  });
  if (response.status !== 503 || response.headers.get("Retry-After") !== "60") throw new Error("probe_rejected");
  const text = await response.text();
  if (text.length > 8192) throw new Error("probe_rejected");
  const receipt = JSON.parse(text);
  if (receipt?.code !== "stripe_billing_write_frozen") throw new Error("probe_rejected");
  await verifyStagingBillingFreeze({ origin: ORIGIN, commit, fetchImpl });
  return true;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runSignedBillingFreezeProbe().then(() => console.log("STAGING_SIGNED_BILLING_FREEZE=PASS"))
    .catch(() => { console.error("STAGING_SIGNED_BILLING_FREEZE=FAIL"); process.exitCode = 1; });
}

import {
  buildStripeBillingLedgerCommand,
  buildStripeBillingLedgerRpcBody,
  isStripeBillingEventLedgerCaptureEnabled,
  isStripeBillingEventLedgerEnabled,
  normalizeStripeBillingLedgerRpcResult,
} from "./stripeBillingEventLedger.mjs";
import { buildSupabaseApiKeyHeaders } from "./supabase/apiKeyPolicy.mjs";

const RPC = "apply_workspace_stripe_billing_event";

function result(status, reason = null, workspaceId = null, revision = null) {
  return Object.freeze({ status, reason, workspaceId, revision });
}

function normalizedBaseUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    const loopbackHost =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]";
    if (
      url.username ||
      url.password ||
      (url.protocol !== "https:" &&
        !(url.protocol === "http:" && loopbackHost))
    ) {
      return null;
    }
    url.pathname = url.pathname.replace(/\/$/u, "");
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/u, "");
  } catch {
    return null;
  }
}

function serviceConfiguration(environment) {
  const baseUrl = normalizedBaseUrl(environment?.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKey =
    typeof environment?.SUPABASE_SERVICE_ROLE_KEY === "string"
      ? environment.SUPABASE_SERVICE_ROLE_KEY.trim()
      : "";
  return baseUrl && serviceKey ? { baseUrl, serviceKey } : null;
}

export async function syncStripeBillingEvent({
  event,
  projection,
  referralBillingStatus = null,
  signedEventVerified = false,
  environment = process.env,
  fetchImplementation = fetch,
} = {}) {
  if (!isStripeBillingEventLedgerCaptureEnabled(environment)) {
    return result("disabled");
  }
  if (typeof fetchImplementation !== "function") {
    return result("retry", "storage_configuration");
  }

  const prepared = buildStripeBillingLedgerCommand({
    event,
    projection,
    referralBillingStatus,
    signedEventVerified,
  });
  if (prepared.status !== "record" || !prepared.command) {
    return result("retry", prepared.reason ?? "event_payload");
  }

  const configuration = serviceConfiguration(environment);
  if (!configuration) return result("retry", "storage_configuration");
  const headers = buildSupabaseApiKeyHeaders(configuration.serviceKey);

  try {
    const rpcUrl = new URL(`${configuration.baseUrl}/rest/v1/rpc/${RPC}`);
    const response = await fetchImplementation(rpcUrl, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(
        buildStripeBillingLedgerRpcBody(prepared.command, {
          projectionEnabled: isStripeBillingEventLedgerEnabled(environment),
        }),
      ),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return result("retry", "storage_write");
    const rpcResult = normalizeStripeBillingLedgerRpcResult(
      await response.json().catch(() => null),
    );
    if (!rpcResult) return result("retry", "storage_state");
    return result(
      rpcResult.status,
      rpcResult.reason,
      rpcResult.workspaceId,
      rpcResult.revision,
    );
  } catch {
    return result("retry", "storage_unavailable");
  }
}

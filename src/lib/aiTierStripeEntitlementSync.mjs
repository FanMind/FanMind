import {
  buildAiTierStripeLedgerCommand,
  buildAiTierStripeLedgerRpcBody,
  normalizeAiTierStripeLedgerRpcResult,
} from "./aiTierStripeEventLedger.mjs";
import { getAiTierStripePriceAllowlistStatus } from "./aiTierStripeLifecycle.mjs";
import { buildSupabaseApiKeyHeaders } from "./supabase/apiKeyPolicy.mjs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RPC = "apply_workspace_ai_tier_stripe_event";

function result(status, reason = null) {
  return Object.freeze({ status, reason });
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

function lifecycleEnabled(environment) {
  return (
    environment?.FANMIND_AI_TIER_STRIPE_PERSISTENCE_ENABLED === "true" &&
    environment?.FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_ENABLED === "true" &&
    environment?.FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED === "true" &&
    getAiTierStripePriceAllowlistStatus(environment).ready
  );
}

export async function syncWorkspaceAiTierStripeEntitlement({
  workspaceId,
  event,
  signedEventVerified = false,
  environment = process.env,
  fetchImplementation = fetch,
} = {}) {
  // Deploy-before-control: the old persistence gate is no longer sufficient.
  // The ledger gate must stay off until its controlled SQL and postflight are
  // complete on the exact target.
  if (!lifecycleEnabled(environment)) return result("disabled");
  if (
    typeof workspaceId !== "string" ||
    !UUID_PATTERN.test(workspaceId) ||
    typeof fetchImplementation !== "function"
  ) {
    return result("retry", "workspace_target");
  }

  const prepared = buildAiTierStripeLedgerCommand({
    workspaceId,
    event,
    signedEventVerified,
    environment,
  });
  if (prepared.status === "ignored") {
    return result("ignored", prepared.reason);
  }
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
        buildAiTierStripeLedgerRpcBody(prepared.command),
      ),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return result("retry", "storage_write");
    const rpcResult = normalizeAiTierStripeLedgerRpcResult(
      await response.json().catch(() => null),
    );
    if (!rpcResult) return result("retry", "storage_state");
    if (rpcResult.status === "applied") return result("applied");
    if (rpcResult.status === "ignored") {
      return result("ignored", rpcResult.reason);
    }
    return result("reconciliation_needed", rpcResult.reason);
  } catch {
    return result("retry", "storage_unavailable");
  }
}

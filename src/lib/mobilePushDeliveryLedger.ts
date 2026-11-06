import "server-only";

import { validateMobilePushDeliveryTargetBinding } from "./mobilePushDeliveryPolicy.mjs";

type TargetBinding = Readonly<{
  supabaseUrl: string;
  supabaseProjectRef: string;
  serviceRoleKey: string;
}>;

const RESPONSE_MAX_BYTES = 16_384;
const TRANSITIONS = Object.freeze([
  "markTicket",
  "markRetry",
  "markIndeterminate",
  "markTerminal",
  "markReceiptAccepted",
  "markReceiptPending",
  "markDeviceNotRegistered",
] as const);

export class MobilePushDeliveryLedgerError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MobilePushDeliveryLedgerError";
  }
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) {
    throw new MobilePushDeliveryLedgerError("ledger_response_invalid");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > RESPONSE_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MobilePushDeliveryLedgerError("ledger_response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) {
    throw new MobilePushDeliveryLedgerError("ledger_response_invalid");
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    throw new MobilePushDeliveryLedgerError("ledger_response_invalid");
  }
}

function headers(binding: TargetBinding): HeadersInit {
  return {
    Accept: "application/json",
    apikey: binding.serviceRoleKey,
    Authorization: `Bearer ${binding.serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export function createMobilePushDeliveryLedger(
  rawBinding: TargetBinding,
  options: { fetchImpl?: typeof fetch; nodeEnvironment?: string } = {},
) {
  let binding: TargetBinding;
  try {
    binding = validateMobilePushDeliveryTargetBinding(rawBinding);
  } catch {
    throw new MobilePushDeliveryLedgerError("ledger_target_binding_invalid");
  }
  const nodeEnvironment = options.nodeEnvironment ?? process.env.NODE_ENV;
  if (options.fetchImpl && nodeEnvironment !== "test") {
    throw new MobilePushDeliveryLedgerError("ledger_fetch_override_forbidden");
  }
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new MobilePushDeliveryLedgerError("ledger_provider_unavailable");
  }

  async function rpc(name: string, body: Record<string, unknown>) {
    const response = await fetchImpl(`${binding.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: headers(binding),
      body: JSON.stringify(body),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    if (!response?.ok) {
      await response?.body?.cancel().catch(() => undefined);
      throw new MobilePushDeliveryLedgerError("ledger_rpc_failed");
    }
    const value = await readBoundedJson(response);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new MobilePushDeliveryLedgerError("ledger_response_invalid");
    }
    return value;
  }

  const ledger = {
    reserve(input: Record<string, unknown>, callBinding: TargetBinding) {
      let validatedCallBinding: TargetBinding;
      try {
        validatedCallBinding = validateMobilePushDeliveryTargetBinding(callBinding);
      } catch {
        throw new MobilePushDeliveryLedgerError("ledger_target_binding_invalid");
      }
      if (
        validatedCallBinding.supabaseUrl !== binding.supabaseUrl ||
        validatedCallBinding.supabaseProjectRef !== binding.supabaseProjectRef ||
        validatedCallBinding.serviceRoleKey !== binding.serviceRoleKey
      ) {
        throw new MobilePushDeliveryLedgerError("ledger_target_binding_mismatch");
      }
      return rpc("mobile_push_delivery_reserve", { p_input: input });
    },
    reserveReceiptCheck(input: Record<string, unknown>) {
      return rpc("mobile_push_delivery_reserve_receipt", { p_input: input });
    },
  } as Record<string, (input: Record<string, unknown>, binding?: TargetBinding) => Promise<unknown>>;

  for (const action of TRANSITIONS) {
    ledger[action] = (input: Record<string, unknown>) =>
      rpc("mobile_push_delivery_transition", { p_action: action, p_input: input });
  }
  return Object.freeze(ledger);
}

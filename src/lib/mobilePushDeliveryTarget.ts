import "server-only";

import {
  decryptMobilePushToken,
  hashMobilePushToken,
} from "@/lib/mobilePushTokenCrypto.mjs";
import {
  canonicalizeMobilePushDatabaseTimestamp,
  validateMobilePushDeliveryTargetBinding,
} from "@/lib/mobilePushDeliveryPolicy.mjs";
import { getSupabaseApiKeyHeaders } from "@/lib/supabase/config";

type WorkspaceRow = {
  id: string;
  billing_status: string | null;
  billing_suspended_at: string | null;
  billing_manual_override: boolean | null;
  billing_grace_until: string | null;
  subscription_effective_end_at: string | null;
  workspace_access_mode: string | null;
  test_access_flags: Record<string, unknown> | null;
};

type MembershipRow = {
  user_id: string;
  workspace_id: string;
  role: string;
};

type FollowupRow = {
  id: string;
  workspace_id: string;
  contact_id: string;
  due_date: string | null;
  status: string | null;
};

type ContactBoundaryRow = {
  id: string;
  workspace_id: string;
};

type RegistrationRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  expo_token_ciphertext: string;
  expo_token_hash: string;
  expo_project_id: string;
  platform: string;
  status: string;
  expires_at: string;
};

export class MobilePushDeliveryTargetError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MobilePushDeliveryTargetError";
  }
}

const TARGET_RESPONSE_MAX_BYTES = 32_768;

type MobilePushDeliveryTargetBinding = Readonly<{
  supabaseUrl: string;
  supabaseProjectRef: string;
  serviceRoleKey: string;
}>;

function serviceHeaders(binding: MobilePushDeliveryTargetBinding): HeadersInit {
  return {
    ...getSupabaseApiKeyHeaders(binding.serviceRoleKey),
    Accept: "application/json",
  };
}

function restUrl(table: string, binding: MobilePushDeliveryTargetBinding) {
  return `${binding.supabaseUrl}/rest/v1/${table}`;
}

async function readBoundedTargetJson(response: Response): Promise<unknown> {
  if (!response.body) {
    throw new MobilePushDeliveryTargetError("target_response_invalid");
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > TARGET_RESPONSE_MAX_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new MobilePushDeliveryTargetError("target_response_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (size === 0) {
    throw new MobilePushDeliveryTargetError("target_response_invalid");
  }
  const payload = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(payload),
    ) as unknown;
  } catch (error) {
    if (error instanceof MobilePushDeliveryTargetError) throw error;
    throw new MobilePushDeliveryTargetError("target_response_invalid");
  }
}

async function loadExactlyOne<T>(
  table: string,
  query: URLSearchParams,
  binding: MobilePushDeliveryTargetBinding,
): Promise<T> {
  query.set("limit", "2");
  const response = await fetch(`${restUrl(table, binding)}?${query}`, {
    headers: serviceHeaders(binding),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response?.ok) {
    await response?.body?.cancel().catch(() => undefined);
    throw new MobilePushDeliveryTargetError("target_lookup_failed");
  }
  const payload = await readBoundedTargetJson(response);
  if (!Array.isArray(payload) || payload.length !== 1) {
    throw new MobilePushDeliveryTargetError("target_not_unique");
  }
  return payload[0] as T;
}

function query(
  select: string,
  filters: ReadonlyArray<readonly [string, string]>,
): URLSearchParams {
  const params = new URLSearchParams({ select });
  for (const [key, value] of filters) params.set(key, `eq.${value}`);
  return params;
}

export async function loadAuthorizedMobilePushDeliveryTarget(input: {
  workspaceId: string;
  userId: string;
  followupId: string;
  targetBinding: MobilePushDeliveryTargetBinding;
}) {
  let targetBinding: MobilePushDeliveryTargetBinding;
  try {
    targetBinding = validateMobilePushDeliveryTargetBinding(
      input.targetBinding,
    );
  } catch {
    throw new MobilePushDeliveryTargetError("target_binding_invalid");
  }
  const workspaceFilter = [["id", input.workspaceId]] as const;
  const membershipFilter = [
    ["workspace_id", input.workspaceId],
    ["user_id", input.userId],
  ] as const;
  const followupFilter = [
    ["id", input.followupId],
    ["workspace_id", input.workspaceId],
  ] as const;
  const registrationFilter = [
    ["workspace_id", input.workspaceId],
    ["user_id", input.userId],
  ] as const;

  const [workspace, membership, followup, registration] = await Promise.all([
    loadExactlyOne<WorkspaceRow>(
      "workspaces",
      query(
        "id,billing_status,billing_suspended_at,billing_manual_override,billing_grace_until,subscription_effective_end_at,workspace_access_mode,test_access_flags",
        workspaceFilter,
      ),
      targetBinding,
    ),
    loadExactlyOne<MembershipRow>(
      "workspace_members",
      query("user_id,workspace_id,role", membershipFilter),
      targetBinding,
    ),
    loadExactlyOne<FollowupRow>(
      "followups",
      query("id,workspace_id,contact_id,due_date,status", followupFilter),
      targetBinding,
    ),
    loadExactlyOne<RegistrationRow>(
      "mobile_push_registrations",
      query(
        "id,user_id,workspace_id,expo_token_ciphertext,expo_token_hash,expo_project_id,platform,status,expires_at",
        registrationFilter,
      ),
      targetBinding,
    ),
  ]);

  const contact = await loadExactlyOne<ContactBoundaryRow>(
    "contacts",
    query("id,workspace_id", [
      ["id", followup.contact_id],
      ["workspace_id", input.workspaceId],
    ]),
    targetBinding,
  );

  let token: string;
  let tokenFingerprint: string;
  try {
    token = decryptMobilePushToken(registration.expo_token_ciphertext);
    tokenFingerprint = registration.expo_token_hash;
    if (
      !/^[0-9a-f]{64}$/u.test(tokenFingerprint) ||
      hashMobilePushToken(token) !== tokenFingerprint
    ) {
      throw new Error("registration_token_fingerprint_mismatch");
    }
  } catch {
    throw new MobilePushDeliveryTargetError("registration_decryption_failed");
  }
  const expiresAt = canonicalizeMobilePushDatabaseTimestamp(
    registration.expires_at,
  );
  if (!expiresAt) {
    throw new MobilePushDeliveryTargetError("registration_expiry_invalid");
  }

  return {
    workspace,
    membership,
    followup,
    contact,
    registration: {
      id: registration.id,
      user_id: registration.user_id,
      workspace_id: registration.workspace_id,
      expo_project_id: registration.expo_project_id,
      platform: registration.platform,
      status: registration.status,
      expires_at: expiresAt,
      token,
      token_fingerprint: tokenFingerprint,
    },
  };
}

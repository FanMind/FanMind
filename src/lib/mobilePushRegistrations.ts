import {
  MOBILE_PUSH_REGISTRATION_DAYS,
  publicMobilePushStatus,
} from "@/lib/mobilePushRegistrationPolicy.mjs";
import {
  encryptMobilePushToken,
  hashMobilePushToken,
  MobilePushTokenCryptoError,
} from "@/lib/mobilePushTokenCrypto.mjs";
import {
  getSupabaseApiKeyHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";

type MobilePushRegistrationRow = {
  id: string;
  user_id: string;
  workspace_id: string;
  platform: "android" | "ios";
  expo_project_id: string;
  status: "active";
  expires_at: string;
};
type MobilePushRegistrationScope = {
  userId: string;
  workspaceId: string;
};

const COLUMNS =
  "id,user_id,workspace_id,platform,expo_project_id,status,expires_at";

export class MobilePushRegistrationServiceError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "MobilePushRegistrationServiceError";
  }
}

function serviceKey() {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!value) {
    throw new MobilePushRegistrationServiceError("service_role_not_configured");
  }
  return value;
}

function serviceHeaders(prefer?: string): HeadersInit {
  const key = serviceKey();
  return {
    ...getSupabaseApiKeyHeaders(key),
    Accept: "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function serviceFetch(
  url: string,
  init: RequestInit,
  code: string,
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response) throw new MobilePushRegistrationServiceError(code);
  return response;
}

function rowsFromPayload(value: unknown): MobilePushRegistrationRow[] {
  return Array.isArray(value) ? (value as MobilePushRegistrationRow[]) : [];
}

async function removeExpiredTokenHash(tokenHash: string, nowIso: string) {
  const url = `${getSupabaseRestUrl(
    "mobile_push_registrations",
  )}?expo_token_hash=eq.${encodeURIComponent(
    tokenHash,
  )}&expires_at=lte.${encodeURIComponent(nowIso)}`;
  const response = await serviceFetch(
    url,
    {
      method: "DELETE",
      headers: serviceHeaders("return=minimal"),
    },
    "registration_cleanup_failed",
  );
  if (!response.ok) {
    throw new MobilePushRegistrationServiceError("registration_cleanup_failed");
  }
}

async function removeExpiredUserRegistration(
  scope: MobilePushRegistrationScope,
  nowIso: string,
) {
  const url = `${getSupabaseRestUrl(
    "mobile_push_registrations",
  )}?user_id=eq.${encodeURIComponent(
    scope.userId,
  )}&workspace_id=eq.${encodeURIComponent(
    scope.workspaceId,
  )}&expires_at=lte.${encodeURIComponent(nowIso)}`;
  const response = await serviceFetch(
    url,
    {
      method: "DELETE",
      headers: serviceHeaders("return=minimal"),
    },
    "registration_cleanup_failed",
  );
  if (!response.ok) {
    throw new MobilePushRegistrationServiceError("registration_cleanup_failed");
  }
}

async function removeStaleUserRegistrations(
  scope: MobilePushRegistrationScope,
) {
  const url = `${getSupabaseRestUrl(
    "mobile_push_registrations",
  )}?user_id=eq.${encodeURIComponent(
    scope.userId,
  )}&workspace_id=neq.${encodeURIComponent(scope.workspaceId)}`;
  const response = await serviceFetch(
    url,
    {
      method: "DELETE",
      headers: serviceHeaders("return=minimal"),
    },
    "registration_cleanup_failed",
  );
  if (!response.ok) {
    throw new MobilePushRegistrationServiceError("registration_cleanup_failed");
  }
}

export async function getMobilePushRegistrationStatus(
  scope: MobilePushRegistrationScope,
) {
  await removeStaleUserRegistrations(scope);
  const url = `${getSupabaseRestUrl(
    "mobile_push_registrations",
  )}?select=${encodeURIComponent(COLUMNS)}&user_id=eq.${encodeURIComponent(
    scope.userId,
  )}&workspace_id=eq.${encodeURIComponent(scope.workspaceId)}&limit=1`;
  const response = await serviceFetch(
    url,
    { headers: serviceHeaders() },
    "registration_status_unavailable",
  );
  if (!response.ok) {
    throw new MobilePushRegistrationServiceError(
      "registration_status_unavailable",
    );
  }
  const rows = rowsFromPayload(await response.json().catch(() => null));
  const row = rows[0] ?? null;
  const now = new Date();
  const status = publicMobilePushStatus(row, now);
  if (row && !status.enabled) {
    await removeExpiredUserRegistration(scope, now.toISOString());
  }
  return status;
}

export async function registerMobilePushToken(input: {
  userId: string;
  workspaceId: string;
  token: string;
  projectId: string;
  platform: "android" | "ios";
}) {
  let tokenHash: string;
  let tokenCiphertext: string;
  try {
    tokenHash = hashMobilePushToken(input.token);
    tokenCiphertext = encryptMobilePushToken(input.token);
  } catch (error) {
    if (error instanceof MobilePushTokenCryptoError) {
      throw new MobilePushRegistrationServiceError(error.code);
    }
    throw error;
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + MOBILE_PUSH_REGISTRATION_DAYS * 24 * 60 * 60 * 1000,
  );
  await removeExpiredTokenHash(tokenHash, now.toISOString());

  const url = `${getSupabaseRestUrl(
    "mobile_push_registrations",
  )}?on_conflict=user_id&select=${encodeURIComponent(COLUMNS)}`;
  const response = await serviceFetch(
    url,
    {
      method: "POST",
      headers: serviceHeaders("resolution=merge-duplicates,return=representation"),
      body: JSON.stringify({
        user_id: input.userId,
        workspace_id: input.workspaceId,
        expo_token_ciphertext: tokenCiphertext,
        expo_token_hash: tokenHash,
        expo_project_id: input.projectId,
        platform: input.platform,
        status: "active",
        registered_at: now.toISOString(),
        last_seen_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
      }),
    },
    "registration_failed",
  );
  if (!response.ok) {
    throw new MobilePushRegistrationServiceError(
      response.status === 409 ? "push_token_conflict" : "registration_failed",
    );
  }
  const rows = rowsFromPayload(await response.json().catch(() => null));
  if (!rows[0]) {
    throw new MobilePushRegistrationServiceError("registration_failed");
  }
  return publicMobilePushStatus(rows[0]);
}

export async function unregisterMobilePushToken(
  scope: MobilePushRegistrationScope,
) {
  await removeStaleUserRegistrations(scope);
  const url = `${getSupabaseRestUrl(
    "mobile_push_registrations",
  )}?user_id=eq.${encodeURIComponent(
    scope.userId,
  )}&workspace_id=eq.${encodeURIComponent(scope.workspaceId)}`;
  const response = await serviceFetch(
    url,
    {
      method: "DELETE",
      headers: serviceHeaders("return=minimal"),
    },
    "unregister_failed",
  );
  if (!response.ok) {
    throw new MobilePushRegistrationServiceError("unregister_failed");
  }
  return publicMobilePushStatus(null);
}

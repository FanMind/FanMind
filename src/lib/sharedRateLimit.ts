import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import {
  buildSharedRateLimitRequest,
  parseSharedRateLimitResponse,
  SharedRateLimitPolicyError,
} from "@/lib/sharedRateLimitPolicy.mjs";

export type SharedRateLimitInput = {
  scope: string;
  subject: string;
  maxRequests: number;
  windowMs: number;
};

export type SharedRateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  currentCount: number;
};

type SharedRateLimitRpcBody = {
  p_scope: string;
  p_subject_hash: string;
  p_window_seconds: number;
  p_max_requests: number;
};

type SharedRateLimitRunner = (
  body: SharedRateLimitRpcBody,
) => Promise<unknown>;

export class SharedRateLimitUnavailableError extends Error {
  readonly code: "configuration" | "rpc_unavailable" | "invalid_response";

  constructor(
    code: "configuration" | "rpc_unavailable" | "invalid_response",
  ) {
    super("Shared rate limit is unavailable.");
    this.name = "SharedRateLimitUnavailableError";
    this.code = code;
  }
}

function sharedRateLimitSecret(): string | null {
  const secret = process.env.FANMIND_SHARED_RATE_LIMIT_SECRET?.trim() ?? "";
  return secret.length >= 32 ? secret : null;
}

async function runSharedRateLimitRpc(
  body: SharedRateLimitRpcBody,
): Promise<unknown> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new SharedRateLimitUnavailableError("configuration");
  }

  let response: Response;
  try {
    response = await fetch(
      getSupabaseRestUrl("rpc/consume_shared_rate_limit"),
      {
        method: "POST",
        headers: getSupabaseHeaders(serviceKey),
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      },
    );
  } catch {
    throw new SharedRateLimitUnavailableError("rpc_unavailable");
  }

  if (!response.ok) {
    throw new SharedRateLimitUnavailableError("rpc_unavailable");
  }

  return response.json().catch(() => {
    throw new SharedRateLimitUnavailableError("invalid_response");
  });
}

export async function consumeSharedRateLimit(
  input: SharedRateLimitInput,
  options: {
    runner?: SharedRateLimitRunner;
    secret?: string;
  } = {},
): Promise<SharedRateLimitResult> {
  const secret = options.secret ?? sharedRateLimitSecret();
  if (!secret) {
    throw new SharedRateLimitUnavailableError("configuration");
  }

  let body: SharedRateLimitRpcBody;
  try {
    body = buildSharedRateLimitRequest({
      ...input,
      secret,
    });
  } catch (error) {
    if (error instanceof SharedRateLimitPolicyError) {
      throw new SharedRateLimitUnavailableError("configuration");
    }
    throw error;
  }

  let payload: unknown;
  try {
    payload = await (options.runner ?? runSharedRateLimitRpc)(body);
  } catch (error) {
    if (error instanceof SharedRateLimitUnavailableError) throw error;
    throw new SharedRateLimitUnavailableError("rpc_unavailable");
  }

  try {
    return parseSharedRateLimitResponse(payload);
  } catch (error) {
    if (error instanceof SharedRateLimitPolicyError) {
      throw new SharedRateLimitUnavailableError("invalid_response");
    }
    throw error;
  }
}

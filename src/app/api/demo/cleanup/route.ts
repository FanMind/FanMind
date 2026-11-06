import { NextRequest, NextResponse } from "next/server";
import { readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import {
  claimExpiredDemoCleanup,
  completeDemoCleanup,
  demoCleanupAuthorized,
  type DemoCleanupCandidate,
} from "@/lib/demoProtection";
import {
  getSupabaseAuthUrl,
  getSupabaseHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";
import {
  finishClaimedTemporaryDemoCleanup,
  type SupabaseServerUser,
  type WorkspaceBackfillRow,
} from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_DEMO_CLEANUP_BODY_BYTES = 2_000;

type CleanupRequestBody = {
  limit?: number;
};

type WorkspaceIdentity = Pick<
  WorkspaceBackfillRow,
  "id" | "name" | "owner_user_id" | "billing_status" | "test_access_flags"
>;

type AdminUserPayload = SupabaseServerUser & {
  user?: SupabaseServerUser;
};

type FetchRecordResult<T> = {
  value: T | null;
  missing: boolean;
  error: string | null;
};

function serviceRoleKey(): string | null {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || null;
}

function normalizeLimit(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(Math.floor(value), MAX_LIMIT));
}

async function fetchAdminUser(
  userId: string,
  key: string,
): Promise<FetchRecordResult<SupabaseServerUser>> {
  try {
    const response = await fetch(
      getSupabaseAuthUrl(`/admin/users/${encodeURIComponent(userId)}`),
      {
        headers: getSupabaseHeaders(key),
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      },
    );
    if (response.status === 404) {
      return { value: null, missing: true, error: null };
    }
    if (!response.ok) {
      return {
        value: null,
        missing: false,
        error: `Auth-User konnte nicht geladen werden (${response.status}).`,
      };
    }

    const payload = (await response.json()) as AdminUserPayload;
    const user = payload.user ?? payload;
    if (!user?.id) {
      return {
        value: null,
        missing: false,
        error: "Auth-User wurde ohne ID zurückgegeben.",
      };
    }
    return { value: user, missing: false, error: null };
  } catch (error) {
    return {
      value: null,
      missing: false,
      error: error instanceof Error ? error.message : "Auth-User-Abfrage fehlgeschlagen.",
    };
  }
}

async function fetchWorkspaceIdentity(
  workspaceId: string,
  key: string,
): Promise<FetchRecordResult<WorkspaceIdentity>> {
  try {
    const url = new URL(getSupabaseRestUrl("workspaces"));
    url.searchParams.set(
      "select",
      "id,name,owner_user_id,billing_status,test_access_flags",
    );
    url.searchParams.set("id", `eq.${workspaceId}`);
    url.searchParams.set("limit", "1");

    const response = await fetch(url, {
      headers: getSupabaseHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) {
      return {
        value: null,
        missing: false,
        error: `Workspace konnte nicht geladen werden (${response.status}).`,
      };
    }

    const rows = (await response.json()) as WorkspaceIdentity[];
    const workspace = rows[0] ?? null;
    return {
      value: workspace,
      missing: !workspace,
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      missing: false,
      error: error instanceof Error ? error.message : "Workspace-Abfrage fehlgeschlagen.",
    };
  }
}

async function finalizeCandidate(
  candidate: DemoCleanupCandidate,
  success: boolean,
  errorCode?: string | null,
): Promise<{ success: boolean; error: string | null }> {
  const completed = await completeDemoCleanup({
    sessionId: candidate.sessionId,
    success,
    errorCode,
  });
  return {
    success: success && completed.ok,
    error: completed.error ?? (success ? null : errorCode ?? "cleanup_failed"),
  };
}

async function cleanupCandidate(
  candidate: DemoCleanupCandidate,
  key: string,
): Promise<{ success: boolean; error: string | null }> {
  if (!candidate.authUserId && !candidate.workspaceId) {
    return finalizeCandidate(candidate, true);
  }

  const [userResult, workspaceResult] = await Promise.all([
    candidate.authUserId
      ? fetchAdminUser(candidate.authUserId, key)
      : Promise.resolve({
          value: null,
          missing: true,
          error: null,
        } satisfies FetchRecordResult<SupabaseServerUser>),
    candidate.workspaceId
      ? fetchWorkspaceIdentity(candidate.workspaceId, key)
      : Promise.resolve({
          value: null,
          missing: true,
          error: null,
        } satisfies FetchRecordResult<WorkspaceIdentity>),
  ]);

  if (userResult.error || workspaceResult.error) {
    return finalizeCandidate(
      candidate,
      false,
      userResult.error ? "auth_user_lookup_failed" : "workspace_lookup_failed",
    );
  }

  if (userResult.missing && workspaceResult.missing) {
    return finalizeCandidate(candidate, true);
  }

  const deletion = await finishClaimedTemporaryDemoCleanup(
    userResult.value,
    workspaceResult.value as WorkspaceBackfillRow | null,
    {
      authUserId: candidate.authUserId,
      workspaceId: candidate.workspaceId,
    },
  );
  if (!deletion.deleted || deletion.error) {
    return finalizeCandidate(
      candidate,
      false,
      deletion.errorCode ?? "demo_delete_failed",
    );
  }

  return finalizeCandidate(candidate, true);
}

export async function POST(request: NextRequest) {
  if (!demoCleanupAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json(
      { error: "Nicht autorisiert.", code: "cleanup_unauthorized" },
      { status: 401 },
    );
  }

  const key = serviceRoleKey();
  if (!key) {
    return NextResponse.json(
      {
        error: "Demo-Cleanup ist serverseitig nicht vollständig konfiguriert.",
        code: "cleanup_not_configured",
      },
      { status: 503 },
    );
  }

  const parsedBody = await readBoundedJsonRequest(
    request,
    MAX_DEMO_CLEANUP_BODY_BYTES,
  );
  if (!parsedBody.ok) {
    return NextResponse.json(
      {
        error: parsedBody.reason === "payload_too_large"
          ? "Anfrage zu groß."
          : "Ungültige Anfrage.",
        code: parsedBody.reason === "payload_too_large" ? "payload_too_large" : "invalid_request",
      },
      { status: parsedBody.reason === "payload_too_large" ? 413 : 400 },
    );
  }
  const body = parsedBody.value as CleanupRequestBody | null;
  const limit = normalizeLimit(body?.limit);
  const claim = await claimExpiredDemoCleanup(limit);
  if (claim.error) {
    return NextResponse.json(
      {
        error: "Abgelaufene Demos konnten nicht reserviert werden.",
        code: "cleanup_claim_failed",
      },
      { status: 503 },
    );
  }

  let deleted = 0;
  let failed = 0;
  const errorCodes: string[] = [];

  for (const candidate of claim.candidates) {
    const result = await cleanupCandidate(candidate, key);
    if (result.success) {
      deleted += 1;
    } else {
      failed += 1;
      if (result.error) errorCodes.push(result.error);
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    claimed: claim.candidates.length,
    deleted,
    failed,
    errorCodes: [...new Set(errorCodes)].slice(0, 10),
    checkedAt: new Date().toISOString(),
  });
}

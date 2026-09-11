import { creatorIntelligenceEnabled } from "@/lib/creatorIntelligence";
import { NextResponse } from "next/server";
import { isPlatformAdminEmail } from "@/lib/admin";
import {
  AiPromptPolicyError,
} from "@/lib/aiPromptPolicy.mjs";
import {
  BearerAccessTokenError,
  getOptionalBearerAccessToken,
} from "@/lib/requestAccessToken";
import {
  requireAuthorizedWorkspaceMember,
  WorkspaceAuthorizationError,
} from "@/lib/workspaceAuthorization";
import { evaluateWorkspaceProcessingEntitlement } from "@/lib/workspaceProcessingPolicy.mjs";
import { readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import {
  getWorkspaceAiPromptSettings,
  saveWorkspaceAiPromptSettings,
} from "@/lib/workspaceAiPrompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_PROMPT_SETTINGS_BODY_BYTES = 32_000;

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function addAllowedOrigin(origins: Set<string>, value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      origins.add(parsed.origin);
    }
  } catch {
    // Deployment preflights own invalid optional URL configuration.
  }
}

function assertTrustedMutationOrigin(
  request: Request,
  accessToken: string | undefined,
) {
  if (accessToken) return;
  const originHeader = request.headers.get("origin")?.trim();
  if (!originHeader) throw new Error("invalid_request_origin");

  let origin: string;
  try {
    const parsed = new URL(originHeader);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }
    origin = parsed.origin;
  } catch {
    throw new Error("invalid_request_origin");
  }

  const allowedOrigins = new Set<string>();
  addAllowedOrigin(allowedOrigins, new URL(request.url).origin);
  addAllowedOrigin(allowedOrigins, process.env.NEXT_PUBLIC_APP_URL);
  addAllowedOrigin(allowedOrigins, process.env.NEXT_PUBLIC_SITE_URL);
  addAllowedOrigin(allowedOrigins, process.env.FANMIND_APP_URL);
  if (!allowedOrigins.has(origin)) throw new Error("invalid_request_origin");

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new Error("invalid_request_origin");
  }
}

async function authenticate(request: Request) {
  let accessToken: string | undefined;
  try {
    accessToken = getOptionalBearerAccessToken(request);
  } catch (error) {
    if (error instanceof BearerAccessTokenError) {
      throw new WorkspaceAuthorizationError(
        "Ungültige Sitzung.",
        "unauthenticated",
      );
    }
    throw error;
  }
  const context = await requireAuthorizedWorkspaceMember(accessToken);
  return { ...context, accessToken };
}

function canManage(context: Awaited<ReturnType<typeof authenticate>>) {
  return (
    context.workspace.owner_user_id === context.user.id ||
    isPlatformAdminEmail(context.user.email)
  );
}

function assertActivePromptManagement(
  context: Awaited<ReturnType<typeof authenticate>>,
) {
  const processing = evaluateWorkspaceProcessingEntitlement(context.workspace);
  if (!processing.allowed) {
    throw new WorkspaceAuthorizationError(
      "KI-Prompt-Einstellungen dürfen nur in einem aktiv verarbeitenden Workspace geändert werden.",
      "workspace_inactive",
    );
  }
}

type PromptSettingsPayload = {
  companyPrompt: string;
  profiles: unknown[];
};

function isPromptSettingsPayload(
  value: unknown,
): value is PromptSettingsPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    Object.hasOwn(candidate, "companyPrompt") &&
    Object.hasOwn(candidate, "profiles") &&
    typeof candidate.companyPrompt === "string" &&
    Array.isArray(candidate.profiles)
  );
}

function mapError(error: unknown) {
  if (error instanceof AiPromptPolicyError) {
    return response(
      {
        ok: false,
        code: error.code,
        error:
          "Bitte prüfe Länge, Namen, Standardprofil und Anzahl der KI-Prompts.",
      },
      400,
    );
  }
  if (
    error instanceof WorkspaceAuthorizationError &&
    error.code === "unauthenticated"
  ) {
    return response(
      { ok: false, code: "unauthenticated", error: "Bitte melde dich erneut an." },
      401,
    );
  }
  if (
    error instanceof WorkspaceAuthorizationError &&
    error.code === "workspace_inactive"
  ) {
    return response(
      {
        ok: false,
        code: "workspace_inactive",
        error:
          "KI-Prompt-Einstellungen können in einem pausierten Workspace nicht geändert werden.",
      },
      403,
    );
  }
  if (
    error instanceof Error &&
    error.message === "invalid_request_origin"
  ) {
    return response(
      {
        ok: false,
        code: "invalid_request_origin",
        error: "Die Änderung muss aus dem angemeldeten FanMind-Bereich erfolgen.",
      },
      403,
    );
  }
  return response(
    {
      ok: false,
      code: "ai_prompt_settings_unavailable",
      error: "KI-Prompt-Einstellungen sind momentan nicht verfügbar.",
    },
    503,
  );
}

export async function GET(request: Request) {
  try {
    const context = await authenticate(request);
    const result = await getWorkspaceAiPromptSettings(context.workspace.id);
    if (result.error) {
      return response(
        {
          ok: false,
          code: "ai_prompt_settings_unavailable",
          error: "KI-Prompt-Einstellungen sind momentan nicht verfügbar.",
        },
        503,
      );
    }
    return response({
      ok: true,
      settings: result.settings,
      canManage: canManage(context),
      singleWritingStyle: creatorIntelligenceEnabled(),
    });
  } catch (error) {
    return mapError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const context = await authenticate(request);
    assertTrustedMutationOrigin(request, context.accessToken);
    if (!canManage(context)) {
      return response(
        {
          ok: false,
          code: "workspace_owner_required",
          error:
            "Nur der Workspace-Owner oder ein FanMind-Admin darf KI-Prompts ändern.",
        },
        403,
      );
    }
    assertActivePromptManagement(context);

    const parsedBody = await readBoundedJsonRequest(
      request,
      MAX_PROMPT_SETTINGS_BODY_BYTES,
    );
    if (!parsedBody.ok) {
      return response(
        {
          ok: false,
          code:
            parsedBody.reason === "payload_too_large"
              ? "payload_too_large"
              : "invalid_payload",
          error:
            parsedBody.reason === "payload_too_large"
              ? "Die KI-Prompt-Einstellungen sind zu groß."
              : "Ungültige Eingabe.",
        },
        parsedBody.reason === "payload_too_large" ? 413 : 400,
      );
    }
    const payload = parsedBody.value;
    if (!isPromptSettingsPayload(payload)) {
      return response(
        { ok: false, code: "invalid_payload", error: "Ungültige Eingabe." },
        400,
      );
    }

    const result = await saveWorkspaceAiPromptSettings({
      workspaceId: context.workspace.id,
      userId: context.user.id,
      companyPrompt: payload.companyPrompt,
      profiles: payload.profiles,
    });
    if (!result.settings) {
      return response(
        {
          ok: false,
          code: "save_failed",
          error: "KI-Prompt-Einstellungen konnten nicht gespeichert werden.",
        },
        503,
      );
    }
    return response({ ok: true, settings: result.settings, canManage: true });
  } catch (error) {
    return mapError(error);
  }
}

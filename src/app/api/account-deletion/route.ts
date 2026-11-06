import { NextResponse } from "next/server";
import {
  AccountDeletionPolicyError,
  publicAccountDeletionStatus,
  validateAccountDeletionCancellation,
  validateAccountDeletionRequest,
} from "@/lib/accountDeletionPolicy.mjs";
import {
  AccountDeletionServiceError,
  cancelAccountDeletionRequest,
  createAccountDeletionRequest,
  getActiveAccountDeletionRequest,
} from "@/lib/accountDeletionRequests";
import { isTemporaryDemoUser } from "@/lib/demoMode";
import {
  BearerAccessTokenError,
  getOptionalBearerAccessToken,
} from "@/lib/requestAccessToken";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
} from "@/lib/supabase/server";
import { readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_ACCOUNT_DELETION_BODY_BYTES = 4_000;

function response(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function errorResponse(code: string, status: number, message: string) {
  return response({ ok: false, code, error: message }, status);
}

function addHttpOrigin(origins: Set<string>, value: string | undefined) {
  const candidate = value?.trim();
  if (!candidate) return;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      origins.add(parsed.origin);
    }
  } catch {
    // Invalid optional configuration is ignored here; deployment preflights own it.
  }
}

function assertTrustedMutationOrigin(
  request: Request,
  accessToken: string | undefined,
) {
  // Mobile sends an explicit bearer token and does not rely on browser cookies.
  if (accessToken) return;

  const originHeader = request.headers.get("origin")?.trim();
  if (!originHeader) {
    throw new AccountDeletionServiceError("invalid_request_origin");
  }

  let origin: string;
  try {
    const parsed = new URL(originHeader);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("invalid_protocol");
    }
    origin = parsed.origin;
  } catch {
    throw new AccountDeletionServiceError("invalid_request_origin");
  }

  const allowedOrigins = new Set<string>();
  addHttpOrigin(allowedOrigins, new URL(request.url).origin);
  addHttpOrigin(allowedOrigins, process.env.NEXT_PUBLIC_APP_URL);
  addHttpOrigin(allowedOrigins, process.env.NEXT_PUBLIC_SITE_URL);
  addHttpOrigin(allowedOrigins, process.env.FANMIND_APP_URL);
  if (!allowedOrigins.has(origin)) {
    throw new AccountDeletionServiceError("invalid_request_origin");
  }

  const fetchSite = request.headers.get("sec-fetch-site")?.trim().toLowerCase();
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    throw new AccountDeletionServiceError("invalid_request_origin");
  }
}

async function authenticate(request: Request) {
  let accessToken: string | undefined;
  try {
    accessToken = getOptionalBearerAccessToken(request);
  } catch (error) {
    if (error instanceof BearerAccessTokenError) {
      throw new AccountDeletionServiceError("unauthenticated");
    }
    throw error;
  }

  const { data } = await getSupabaseServerUser(accessToken);
  if (!data.user) throw new AccountDeletionServiceError("unauthenticated");
  const workspaceResult = await getUserWorkspaceDashboard(data.user, accessToken);
  return {
    accessToken,
    user: data.user,
    workspace: workspaceResult.workspace,
    source: accessToken ? ("mobile" as const) : ("web" as const),
  };
}

function mapError(error: unknown) {
  if (error instanceof AccountDeletionPolicyError) {
    if (error.code === "email_confirmation_mismatch") {
      return errorResponse(
        error.code,
        400,
        "Die bestätigte E-Mail-Adresse stimmt nicht mit der aktiven Sitzung überein.",
      );
    }
    if (
      error.code === "confirmation_phrase_invalid" ||
      error.code === "cancel_confirmation_invalid"
    ) {
      return errorResponse(
        error.code,
        400,
        "Bitte gib die angezeigte Bestätigungsphrase exakt ein.",
      );
    }
    return errorResponse("request_invalid", 400, "Bitte prüfe die Angaben.");
  }

  if (error instanceof AccountDeletionServiceError) {
    if (error.code === "unauthenticated") {
      return errorResponse(
        "unauthenticated",
        401,
        "Bitte melde dich erneut an, um die Account-Löschung zu verwalten.",
      );
    }
    if (error.code === "invalid_request_origin") {
      return errorResponse(
        "invalid_request_origin",
        403,
        "Die Löschanfrage muss aus dem angemeldeten FanMind-Bereich gestartet werden.",
      );
    }
    if (error.code === "request_not_found") {
      return errorResponse(
        "request_not_found",
        404,
        "Es wurde keine aktive Löschanfrage gefunden.",
      );
    }
    if (error.code === "request_already_processing") {
      return errorResponse(
        "request_already_processing",
        409,
        "Die Bearbeitung hat bereits begonnen und kann nicht mehr automatisch widerrufen werden.",
      );
    }
    return errorResponse(
      "account_deletion_unavailable",
      503,
      "Die Löschanfrage konnte gerade nicht sicher verarbeitet werden. Bitte versuche es später erneut.",
    );
  }

  return errorResponse(
    "account_deletion_unavailable",
    503,
    "Die Löschanfrage konnte gerade nicht sicher verarbeitet werden. Bitte versuche es später erneut.",
  );
}

export async function GET(request: Request) {
  try {
    const { user } = await authenticate(request);
    const active = await getActiveAccountDeletionRequest(user.id);
    return response({ ok: true, request: publicAccountDeletionStatus(active) });
  } catch (error) {
    return mapError(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await authenticate(request);
    assertTrustedMutationOrigin(request, context.accessToken);
    if (isTemporaryDemoUser(context.user)) {
      return errorResponse(
        "temporary_demo_managed_automatically",
        409,
        "Temporäre Demo-Accounts werden nach Ablauf automatisch und vollständig entfernt.",
      );
    }
    if (!context.user.email) {
      return errorResponse(
        "account_email_missing",
        409,
        "Für diesen Account ist keine bestätigbare E-Mail-Adresse verfügbar.",
      );
    }

    const parsedBody = await readBoundedJsonRequest(
      request,
      MAX_ACCOUNT_DELETION_BODY_BYTES,
    );
    if (!parsedBody.ok) {
      return errorResponse(
        parsedBody.reason === "payload_too_large"
          ? "payload_too_large"
          : "request_invalid",
        parsedBody.reason === "payload_too_large" ? 413 : 400,
        parsedBody.reason === "payload_too_large"
          ? "Die Löschanfrage ist zu groß."
          : "Bitte prüfe die Angaben.",
      );
    }
    const payload = parsedBody.value as
      | {
          emailConfirmation?: unknown;
          confirmation?: unknown;
        }
      | null;
    const validated = validateAccountDeletionRequest(
      payload,
      context.user.email,
      context.source,
    );
    const deletionRequest = await createAccountDeletionRequest({
      user: context.user,
      workspace: context.workspace,
      email: validated.email,
      source: context.source,
      confirmationVersion: validated.confirmationVersion,
    });

    return response(
      {
        ok: true,
        request: deletionRequest,
        message:
          "Die vollständige Account-Löschung wurde aufgenommen. Die Bearbeitung erfolgt spätestens innerhalb von 30 Tagen.",
      },
      202,
    );
  } catch (error) {
    return mapError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await authenticate(request);
    assertTrustedMutationOrigin(request, context.accessToken);
    const parsedBody = await readBoundedJsonRequest(
      request,
      MAX_ACCOUNT_DELETION_BODY_BYTES,
    );
    if (!parsedBody.ok) {
      return errorResponse(
        parsedBody.reason === "payload_too_large"
          ? "payload_too_large"
          : "request_invalid",
        parsedBody.reason === "payload_too_large" ? 413 : 400,
        parsedBody.reason === "payload_too_large"
          ? "Die Widerrufsanfrage ist zu groß."
          : "Bitte prüfe die Angaben.",
      );
    }
    const payload = parsedBody.value as
      | { requestId?: unknown; confirmation?: unknown }
      | null;
    const validated = validateAccountDeletionCancellation(payload);
    const deletionRequest = await cancelAccountDeletionRequest({
      userId: context.user.id,
      requestId: validated.requestId,
    });
    return response({
      ok: true,
      request: deletionRequest,
      message: "Die Löschanfrage wurde widerrufen.",
    });
  } catch (error) {
    return mapError(error);
  }
}

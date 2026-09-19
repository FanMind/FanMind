import { NextResponse } from "next/server";

import { isPublicDemoWorkspace } from "@/lib/demoMode";
import {
  MOBILE_PUSH_CLIENT_HEADER,
  MobilePushRegistrationPolicyError,
  readBoundedMobilePushJson,
  validateExpectedMobilePushProjectId,
  validateMobilePushAction,
} from "@/lib/mobilePushRegistrationPolicy.mjs";
import {
  getMobilePushRegistrationStatus,
  MobilePushRegistrationServiceError,
  registerMobilePushToken,
  unregisterMobilePushToken,
} from "@/lib/mobilePushRegistrations";
import {
  BearerAccessTokenError,
  getOptionalBearerAccessToken,
} from "@/lib/requestAccessToken";
import {
  requireAuthorizedWorkspaceMember,
  WorkspaceAuthorizationError,
} from "@/lib/workspaceAuthorization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function authenticateMobile(request: Request) {
  if (
    request.headers.get("x-fanmind-client")?.trim().toLowerCase() !==
    MOBILE_PUSH_CLIENT_HEADER
  ) {
    throw new MobilePushRegistrationServiceError("mobile_client_required");
  }

  let accessToken: string | undefined;
  try {
    accessToken = getOptionalBearerAccessToken(request);
  } catch (error) {
    if (error instanceof BearerAccessTokenError) {
      throw new MobilePushRegistrationServiceError("unauthenticated");
    }
    throw error;
  }
  if (!accessToken) {
    throw new MobilePushRegistrationServiceError("unauthenticated");
  }

  let context;
  try {
    context = await requireAuthorizedWorkspaceMember(accessToken);
  } catch (error) {
    if (error instanceof WorkspaceAuthorizationError) {
      throw new MobilePushRegistrationServiceError(
        error.code === "unauthenticated"
          ? "unauthenticated"
          : "workspace_required",
      );
    }
    throw error;
  }
  if (
    isPublicDemoWorkspace({
      userEmail: context.user.email,
      workspaceBillingStatus: context.workspace.billing_status,
      workspaceTestAccessFlags: context.workspace.test_access_flags,
      user: context.user,
    })
  ) {
    throw new MobilePushRegistrationServiceError("public_demo_not_allowed");
  }

  return context;
}

function mapError(error: unknown) {
  if (error instanceof MobilePushRegistrationPolicyError) {
    if (error.code === "push_project_not_configured") {
      return errorResponse(
        error.code,
        503,
        "Die Push-Vorbereitung ist serverseitig noch nicht freigegeben.",
      );
    }
    if (error.code === "push_project_mismatch") {
      return errorResponse(
        error.code,
        403,
        "Dieser FanMind-Build ist für Push-Erinnerungen nicht freigegeben.",
      );
    }
    return errorResponse(
      error.code,
      400,
      "Bitte prüfe die Push-Einstellungen.",
    );
  }
  if (error instanceof SyntaxError) {
    return errorResponse(
      "invalid_request",
      400,
      "Bitte prüfe die Push-Einstellungen.",
    );
  }
  if (error instanceof MobilePushRegistrationServiceError) {
    if (error.code === "unauthenticated") {
      return errorResponse(
        error.code,
        401,
        "Bitte melde dich erneut an, um Push-Erinnerungen zu verwalten.",
      );
    }
    if (error.code === "mobile_client_required") {
      return errorResponse(error.code, 403, "Diese Funktion ist nur in der FanMind-App verfügbar.");
    }
    if (
      error.code === "workspace_required" ||
      error.code === "public_demo_not_allowed"
    ) {
      return errorResponse(
        error.code,
        409,
        "Push-Erinnerungen benötigen einen bestätigten, nicht temporären Workspace.",
      );
    }
    if (error.code === "push_token_conflict") {
      return errorResponse(
        error.code,
        409,
        "Dieses Gerät ist noch sicher an ein anderes FanMind-Konto gebunden.",
      );
    }
  }
  return errorResponse(
    "push_registration_unavailable",
    503,
    "Die Push-Vorbereitung ist serverseitig noch nicht freigegeben.",
  );
}

export async function POST(request: Request) {
  try {
    const { user, workspace } = await authenticateMobile(request);
    const input = validateMobilePushAction(
      await readBoundedMobilePushJson(request),
    );
    const scope = { userId: user.id, workspaceId: workspace.id };

    if (input.action === "status") {
      const status = await getMobilePushRegistrationStatus(scope);
      return response({ ok: true, status });
    }
    if (input.action === "unregister") {
      const status = await unregisterMobilePushToken(scope);
      return response({ ok: true, status });
    }
    validateExpectedMobilePushProjectId(input.projectId);

    const status = await registerMobilePushToken({
      userId: user.id,
      workspaceId: workspace.id,
      token: input.token,
      projectId: input.projectId,
      platform: input.platform,
    });
    return response({ ok: true, status }, 201);
  } catch (error) {
    return mapError(error);
  }
}

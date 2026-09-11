import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { completeFacebookOAuthConnection } from "@/lib/facebookConnectionFlow";
import { verifyPendingFacebookPageSelection } from "@/lib/facebookIntegration";
import {
  FACEBOOK_PAGE_SELECTION_COOKIE,
  normalizeFacebookPageSelectionId,
} from "@/lib/facebookPageSelectionPolicy.mjs";
import { isTrustedFanMindMutationRequest } from "@/lib/httpMutationPolicy.mjs";
import { canManageMetaConnections } from "@/lib/metaIntegrationPolicy.mjs";
import {
  getSupabaseServerUser,
} from "@/lib/supabase/server";
import { requireActiveAuthorizedWorkspace } from "@/lib/workspaceAuthorization";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) {
    return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  }

  const { data } = await getSupabaseServerUser();
  if (!data.user) return redirectResponse(request, "/login");

  let activeContext;
  try {
    activeContext = await requireActiveAuthorizedWorkspace();
  } catch {
    return clearAndRedirect(
      request,
      "/channels?facebook_error=workspace_inactive",
    );
  }
  const workspace = activeContext.workspace;
  if (activeContext.user.id !== data.user.id)
    return clearAndRedirect(request, "/channels?facebook_error=workspace");
  if (!canManageMetaConnections(workspace.role))
    return clearAndRedirect(request, "/channels?facebook_error=role");
  if (areDemoConnectionsDisabled(data.user, workspace))
    return clearAndRedirect(request, "/channels?facebook_error=demo_disabled");

  const pending = verifyPendingFacebookPageSelection(
    request.cookies.get(FACEBOOK_PAGE_SELECTION_COOKIE)?.value,
  );
  if (
    !pending ||
    pending.userId !== data.user.id ||
    pending.workspaceId !== workspace.id
  ) {
    return clearAndRedirect(
      request,
      "/channels?facebook_error=page_selection_expired",
    );
  }

  const formData = await request.formData();
  const selectedPageId = normalizeFacebookPageSelectionId(
    formData.get("page_id"),
  );
  if (!selectedPageId) {
    return redirectResponse(request, "/channels/facebook/select?error=invalid");
  }

  try {
    const result = await completeFacebookOAuthConnection({
      workspaceId: workspace.id,
      connectedBy: data.user.id,
      connectionType: pending.connectionType,
      userAccessToken: pending.userAccessToken,
      selectedPageId,
    });
    if (!result.ok) {
      if (result.errorCode === "page_selection_invalid") {
        return redirectResponse(
          request,
          "/channels/facebook/select?error=invalid",
        );
      }
      return clearAndRedirect(
        request,
        `/channels?facebook_error=${result.errorCode}&type=${pending.connectionType}`,
      );
    }

    revalidatePath("/channels");
    return clearAndRedirect(
      request,
      `/channels?connected=${result.connectedType}&meta_import=${result.initialImport}`,
    );
  } catch {
    return clearAndRedirect(
      request,
      "/channels?facebook_error=callback",
    );
  }
}

function redirectResponse(request: NextRequest, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), 303);
}

function clearAndRedirect(request: NextRequest, path: string): NextResponse {
  const response = redirectResponse(request, path);
  response.cookies.set(FACEBOOK_PAGE_SELECTION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 0,
  });
  return response;
}

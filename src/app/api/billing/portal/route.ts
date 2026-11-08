import { NextRequest, NextResponse } from "next/server";
import { isTrustedMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";
import { isDemoWorkspace, isTemporaryDemoUser } from "@/lib/demoMode";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { stripeCustomerPortalConfigured, createWorkspaceStripePortal } from "@/lib/stripeCustomerPortal.mjs";
import { getStripeClient } from "@/lib/stripeClient";
import { findWorkspaceIdByStripeReferences } from "@/lib/stripeBilling";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";

const reply = (code: string, status: number) => NextResponse.json({ code,
  error: "Das Rechnungsportal ist derzeit nicht verfügbar. Bitte erneut versuchen oder FanMind kontaktieren." },
{ status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!isTrustedMutationRequest(request, [process.env.NEXT_PUBLIC_APP_URL])) return reply("origin_forbidden", 403);
  if (!stripeCustomerPortalConfigured()) return reply("portal_unavailable", 503);
  try {
    const { data } = await getSupabaseServerUser();
    if (!data.user) return reply("unauthenticated", 401);
    if (isTemporaryDemoUser(data.user)) return reply("portal_forbidden", 403);
    const parsed = await readBoundedJsonRequest(request, 1024);
    if (!parsed.ok) return reply("invalid_request", parsed.reason === "payload_too_large" ? 413 : 400);
    if (!parsed.value || typeof parsed.value !== "object" || Array.isArray(parsed.value) ||
        Object.keys(parsed.value).length) return reply("invalid_request", 400);
    const { workspace } = await getUserWorkspaceDashboard(data.user);
    if (!workspace || workspace.owner_user_id !== data.user.id || !workspace.stripe_customer_id ||
        isDemoWorkspace(workspace) || isAdminCrmAccessWorkspace(workspace)) return reply("portal_forbidden", 403);
    const limit = await consumeSharedRateLimit({ scope: "stripe_customer_portal", subject: workspace.id,
      maxRequests: 5, windowMs: 60000 });
    if (!limit.allowed) return reply("rate_limited", 429);
    const stripe = getStripeClient();
    if (!stripe) return reply("portal_unavailable", 503);
    const session = await createWorkspaceStripePortal({ workspaceId: workspace.id,
      customerId: workspace.stripe_customer_id }, { stripe, findWorkspace: findWorkspaceIdByStripeReferences });
    return NextResponse.json(session, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply("portal_unavailable", 503); }
}

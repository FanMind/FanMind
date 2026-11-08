import { NextRequest, NextResponse } from "next/server";
import { isTrustedMutationRequest, readBoundedJsonRequest } from "@/lib/httpMutationPolicy.mjs";
import { getSupabaseServerUser, getUserWorkspaceDashboard } from "@/lib/supabase/server";
import { isDemoWorkspace, isTemporaryDemoUser } from "@/lib/demoMode";
import { isAdminCrmAccessWorkspace } from "@/lib/adminCrmAccessPolicy.mjs";
import { hasCurrentWorkspacePaymentTermsEvidence } from "@/lib/paymentTermsServerEvidence";
import { isStripeBillingWriteFrozen } from "@/lib/stripeBillingWriteFreeze.mjs";
import { stripeTopupContract, stripeTopupSandboxReady } from "@/lib/stripeAiTopupLifecycle.mjs";
import { startWorkspaceTopup } from "@/lib/stripeAiTopup";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";

const reply = (code: string, status: number) => NextResponse.json({ code,
  error: "Der Datenpaketkauf ist derzeit nicht verfügbar. Es wurde kein Guthaben gebucht." },
{ status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  if (!isTrustedMutationRequest(request, [process.env.NEXT_PUBLIC_APP_URL])) return reply("origin_forbidden", 403);
  if (!stripeTopupSandboxReady() || isStripeBillingWriteFrozen()) return reply("topup_unavailable", 503);
  const { data } = await getSupabaseServerUser();
  if (!data.user) return reply("unauthenticated", 401);
  if (isTemporaryDemoUser(data.user)) return reply("topup_forbidden", 403);
  const parsed = await readBoundedJsonRequest(request, 1024);
  if (!parsed.ok) return reply("invalid_request", parsed.reason === "payload_too_large" ? 413 : 400);
  const body = parsed.value as { topupKey?: unknown; requestId?: unknown } | null;
  if (!body || typeof body.topupKey !== "string" || !stripeTopupContract(body.topupKey) ||
      typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(body.requestId)) return reply("invalid_request", 400);
  const { workspace } = await getUserWorkspaceDashboard(data.user);
  if (!workspace || workspace.owner_user_id !== data.user.id || isDemoWorkspace(workspace) ||
      isAdminCrmAccessWorkspace(workspace)) return reply("topup_forbidden", 403);
  if (!(await hasCurrentWorkspacePaymentTermsEvidence(workspace.id, data.user.id))) return reply("payment_terms_required", 409);
  try {
    const limit = await consumeSharedRateLimit({ scope: "stripe_topup_checkout", subject: workspace.id, maxRequests: 5, windowMs: 60000 });
    if (!limit.allowed) return reply("rate_limited", 429);
    const session = await startWorkspaceTopup({ workspace, topupKey: body.topupKey, requestId: body.requestId });
    return NextResponse.json({ url: session.url, sessionId: session.id }, { headers: { "Cache-Control": "no-store" } });
  } catch { return reply("topup_unavailable", 503); }
}

import { areDemoConnectionsDisabled } from "@/lib/demoMode";
import { requireActiveAuthorizedWorkspace, requireAuthorizedWorkspace } from "@/lib/workspaceAuthorization";
import { handleSocialRequest } from "@/lib/socialProviderFlow.mjs";
import { socialProviderStore } from "@/lib/socialProviderStore.mjs";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function handle(request: Request, context: { params: Promise<{ provider: string; action: string }> }) {
  const { provider, action } = await context.params;
  return handleSocialRequest({ request, provider, action, store: socialProviderStore(),
    authorize: async (mode: string) => {
      const authorized = await (mode === "active" ? requireActiveAuthorizedWorkspace() : requireAuthorizedWorkspace());
      return { ...authorized, demo: areDemoConnectionsDisabled(authorized.user, authorized.workspace) };
    },
  });
}
export const GET = handle;
export const POST = handle;

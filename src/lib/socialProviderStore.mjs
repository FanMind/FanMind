import { buildSupabaseApiKeyHeaders } from "./supabase/apiKeyPolicy.mjs";
import { SocialProviderError } from "./socialProviderPolicy.mjs";

// Service-only module. Consumers must authorize the current user first.
export function socialProviderStore(env = process.env, fetcher = fetch) {
  async function request(path, body) {
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key || !env.NEXT_PUBLIC_SUPABASE_URL) throw new SocialProviderError("storage_unavailable");
    try {
      const response = await fetcher(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`, {
        method: body === undefined ? "GET" : "POST", headers: { ...buildSupabaseApiKeyHeaders(key), "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new SocialProviderError("storage_unavailable");
      return await response.json();
    } catch { throw new SocialProviderError("storage_unavailable"); }
  }
  return {
    rpc: (name, params) => request(`rpc/fanmind_social_${name}`, params),
    async read(workspaceId, provider) {
      const query = new URLSearchParams({ workspace_id: `eq.${workspaceId}`, provider: `eq.${provider}`, select: "workspace_id,provider,external_account_id,display_name,encrypted_token,expires_at,revision,connected_at,next_read_at", limit: "1" });
      const rows = await request(`social_provider_connections?${query}`);
      if (!Array.isArray(rows) || rows.length > 1) throw new SocialProviderError("storage_unavailable");
      return rows[0] ?? null;
    },
  };
}

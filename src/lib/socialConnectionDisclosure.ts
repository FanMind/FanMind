import "server-only";
import { requireAuthorizedWorkspace } from "@/lib/workspaceAuthorization";
import { getSupabaseApiKeyHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import { DataDisclosureExportError } from "@/lib/dataDisclosurePagination";

const FIELDS = ["workspace_id", "provider", "external_account_id", "display_name", "expires_at", "connected_at"] as const;
type ConnectionMetadata = { workspace_id: string } & Record<(typeof FIELDS)[number], string | null>;
function unavailable(): never {
  throw new DataDisclosureExportError("Die Kontoverbindungen konnten nicht vollständig für die Datenauskunft geladen werden.");
}

async function readMetadata(response: Response): Promise<unknown> {
  if (!response.body) unavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 32768) unavailable();
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes)));
  } finally { await reader.cancel().catch(() => {}); }
}

// The encrypted connection table is service-role-only. Its owner may export
// these six metadata fields, without changing any table grant or runtime flag.
export async function getSocialConnectionMetadataForDisclosure(
  workspaceId: string,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionMetadata[]> {
  async function assertOwner() {
    const context = await requireAuthorizedWorkspace(accessToken);
    if (context.workspace.id !== workspaceId || context.workspace.owner_user_id !== context.user.id) unavailable();
  }
  await assertOwner();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) unavailable();
  const url = new URL(getSupabaseRestUrl("social_provider_connections"));
  url.searchParams.set("workspace_id", `eq.${workspaceId}`);
  url.searchParams.set("select", FIELDS.join(","));
  url.searchParams.set("order", "provider.asc");
  url.searchParams.set("limit", "3"); // At most one X and one TikTok connection.
  const response = await fetchImpl(url, {
    headers: getSupabaseApiKeyHeaders(key), cache: "no-store", redirect: "error",
    signal: AbortSignal.timeout(15000),
  }).catch(() => null);
  if (!response) unavailable();
  const data: unknown = await readMetadata(response).catch(() => null);
  if (!response.ok) {
    // Missing optional schema is different from denied access or a failed read.
    if (response.status === 404 && typeof data === "object" && data !== null &&
      "code" in data && ["42P01", "PGRST205"].includes(String(data.code))) return [];
    unavailable();
  }
  if (!Array.isArray(data) || data.length > 2) unavailable();
  const seen = new Set<string>();
  const rows: ConnectionMetadata[] = data.map(row => {
    if (!row || typeof row !== "object" || row.workspace_id !== workspaceId ||
      !["x", "tiktok"].includes(row.provider) || seen.has(row.provider) ||
      FIELDS.some(field => typeof row[field] !== "string" && row[field] !== null) ||
      typeof row.external_account_id !== "string" || !row.external_account_id) unavailable();
    seen.add(row.provider);
    // Copy only the projection even if a backend response unexpectedly includes
    // additional internal columns. No token ever reaches the PDF builder.
    return Object.fromEntries(FIELDS.map(field => [field, row[field]])) as ConnectionMetadata;
  });
  await assertOwner();
  return rows;
}

import { cookies } from "next/headers";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
} from "@/lib/supabase/config";
import { DataDisclosureExportError } from "@/lib/dataDisclosurePagination";

const PAGE_SIZE = 500;
const MAX_ROWS_PER_DATASET = 50_000;

export type DisclosureMetaRow = Record<string, unknown> & {
  id?: string;
  user_id?: string;
  workspace_id?: string;
};

export type DisclosureMetaDataset = {
  key:
    | "profile_record"
    | "membership_record"
    | "workspace_record"
    | "contacts_full"
    | "memories"
    | "followups"
    | "conversations"
    | "messages"
    | "conversation_summaries"
    | "reply_targets"
    | "fan_reports"
    | "contact_profiles"
    | "voice_profiles"
    | "ai_usage"
    | "connections"
    | "meta_webhook_events"
    | "pilot_inquiries"
    | "referral_membership"
    | "referrals_given"
    | "referrals_received"
    | "referral_discount_snapshots"
    | "account_deletion_requests";
  rows: DisclosureMetaRow[];
};

type DatasetScope = "user" | "membership" | "workspace-row" | "workspace";

type DatasetDefinition = {
  key: DisclosureMetaDataset["key"];
  table: string;
  order: string;
  scope: DatasetScope;
};

// Complete browser-readable Production data families that can hold data for the
// signed-in Creator account or its Workspace. Service-role-only account data is
// collected separately by dataDisclosurePrivateExport.ts after a second owner
// authorization check. Staging-only/not-yet-installed feature tables are added
// only in the same release that makes them Production storage. A missing active
// table is an export error; a successful PDF never silently omits a data family.
const DATASETS: DatasetDefinition[] = [
  { key: "profile_record", table: "profiles", scope: "user", order: "id.asc" },
  { key: "membership_record", table: "workspace_members", scope: "membership", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "workspace_record", table: "workspaces", scope: "workspace-row", order: "id.asc" },
  { key: "contacts_full", table: "contacts", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "memories", table: "memories", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "followups", table: "followups", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "conversations", table: "conversations", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "messages", table: "conversation_messages", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "conversation_summaries", table: "conversation_summaries", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "reply_targets", table: "contact_reply_targets", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "fan_reports", table: "fan_analysis_reports", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "contact_profiles", table: "contact_ai_profiles", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "voice_profiles", table: "workspace_voice_profiles", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "ai_usage", table: "ai_usage_events", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "connections", table: "social_connections", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "meta_webhook_events", table: "meta_webhook_events", scope: "workspace", order: "created_at.asc.nullsfirst,id.asc" },
];

type PageResult =
  | { ok: true; rows: DisclosureMetaRow[] }
  | { ok: false; message: string };

function isSecretOrProviderCredentialField(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.startsWith("stripe_") ||
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("ciphertext") ||
    normalized.includes("encrypted_token") ||
    normalized.includes("access_token") ||
    normalized.includes("refresh_token") ||
    normalized.includes("api_key") ||
    /(^|_)token($|_)/u.test(normalized)
  );
}

function sanitizeRow(row: DisclosureMetaRow): DisclosureMetaRow {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !isSecretOrProviderCredentialField(key)),
  ) as DisclosureMetaRow;
}

function bindScope(url: URL, definition: DatasetDefinition, workspaceId: string, userId: string): void {
  if (definition.scope === "user") {
    url.searchParams.set("id", `eq.${userId}`);
    return;
  }
  if (definition.scope === "membership") {
    url.searchParams.set("workspace_id", `eq.${workspaceId}`);
    url.searchParams.set("user_id", `eq.${userId}`);
    return;
  }
  if (definition.scope === "workspace-row") {
    url.searchParams.set("id", `eq.${workspaceId}`);
    return;
  }
  url.searchParams.set("workspace_id", `eq.${workspaceId}`);
}

function rowMatchesScope(
  row: DisclosureMetaRow,
  definition: DatasetDefinition,
  workspaceId: string,
  userId: string,
): boolean {
  if (definition.scope === "user") return row.id === userId;
  if (definition.scope === "membership") {
    return row.workspace_id === workspaceId && row.user_id === userId;
  }
  if (definition.scope === "workspace-row") return row.id === workspaceId;
  return row.workspace_id === workspaceId;
}

async function fetchPage(input: {
  definition: DatasetDefinition;
  workspaceId: string;
  userId: string;
  accessToken: string;
  offset: number;
  fetchImpl: typeof fetch;
}): Promise<PageResult> {
  const url = new URL(getSupabaseRestUrl(input.definition.table));
  url.searchParams.set("select", "*");
  bindScope(url, input.definition, input.workspaceId, input.userId);
  url.searchParams.set("order", input.definition.order);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(input.offset));

  const response = await input.fetchImpl(url, {
    headers: getSupabaseHeaders(input.accessToken),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);

  if (!response) {
    return { ok: false, message: `${input.definition.table}: Netzwerkfehler` };
  }
  if (!response.ok) {
    return {
      ok: false,
      message: `${input.definition.table}: HTTP ${response.status}`,
    };
  }

  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload)) {
    return {
      ok: false,
      message: `${input.definition.table}: ungültige Serverantwort`,
    };
  }

  const rows = payload as DisclosureMetaRow[];
  if (
    rows.some(
      (row) =>
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        !rowMatchesScope(row, input.definition, input.workspaceId, input.userId),
    )
  ) {
    return {
      ok: false,
      message: `${input.definition.table}: fremder Nutzer oder Workspace in Exportantwort`,
    };
  }
  return { ok: true, rows: rows.map(sanitizeRow) };
}

async function fetchDataset(input: {
  definition: DatasetDefinition;
  workspaceId: string;
  userId: string;
  accessToken: string;
  fetchImpl: typeof fetch;
}): Promise<DisclosureMetaDataset> {
  const rows: DisclosureMetaRow[] = [];

  for (;;) {
    if (rows.length >= MAX_ROWS_PER_DATASET) {
      throw new DataDisclosureExportError(
        `${input.definition.table} enthält mehr als ${MAX_ROWS_PER_DATASET} Zeilen; Export ohne Abschneidung wurde abgebrochen.`,
      );
    }

    const result = await fetchPage({
      ...input,
      offset: rows.length,
    });
    if (!result.ok) {
      throw new DataDisclosureExportError(
        `Gespeicherte FanMind-Daten konnten nicht vollständig exportiert werden (${result.message}).`,
      );
    }

    rows.push(...result.rows);
    if (result.rows.length < PAGE_SIZE) break;
  }

  return { key: input.definition.key, rows };
}

export async function getWorkspaceMetaDataForDisclosure(
  workspaceId: string,
  userId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DisclosureMetaDataset[]> {
  const normalizedWorkspaceId = workspaceId.trim();
  const normalizedUserId = userId.trim();
  const cookieStore = await cookies();
  const accessToken = cookieStore
    .get(SUPABASE_ACCESS_TOKEN_COOKIE)
    ?.value?.trim();

  if (!normalizedWorkspaceId || !normalizedUserId || !accessToken) {
    throw new DataDisclosureExportError(
      "Autorisierter Nutzer, Workspace oder Sitzung fehlt für die Datenauskunft.",
    );
  }

  return Promise.all(
    DATASETS.map((definition) =>
      fetchDataset({
        definition,
        workspaceId: normalizedWorkspaceId,
        userId: normalizedUserId,
        accessToken,
        fetchImpl,
      }),
    ),
  );
}

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
  workspace_id?: string;
};

export type DisclosureMetaDataset = {
  key:
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
    | "prompt_settings"
    | "ai_usage"
    | "connections"
    | "meta_webhook_events";
  rows: DisclosureMetaRow[];
};

type DatasetDefinition = {
  key: DisclosureMetaDataset["key"];
  table: string;
  order: string;
  filterColumn?: "workspace_id" | "id";
};

// Complete active Production data families that can hold data for the signed-in
// Creator account or its Workspace. Staging-only/not-yet-installed feature
// tables are added here in the same release that makes them Production storage.
// A missing active table is always an export error; a successful PDF never
// silently omits an active data family.
const DATASETS: DatasetDefinition[] = [
  { key: "workspace_record", table: "workspaces", filterColumn: "id", order: "id.asc" },
  { key: "contacts_full", table: "contacts", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "memories", table: "memories", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "followups", table: "followups", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "conversations", table: "conversations", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "messages", table: "conversation_messages", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "conversation_summaries", table: "conversation_summaries", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "reply_targets", table: "contact_reply_targets", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "fan_reports", table: "fan_analysis_reports", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "contact_profiles", table: "contact_ai_profiles", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "voice_profiles", table: "workspace_voice_profiles", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "prompt_settings", table: "workspace_ai_prompt_settings", order: "workspace_id.asc" },
  { key: "ai_usage", table: "ai_usage_events", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "connections", table: "social_connections", order: "created_at.asc.nullsfirst,id.asc" },
  { key: "meta_webhook_events", table: "meta_webhook_events", order: "created_at.asc.nullsfirst,id.asc" },
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

async function fetchPage(input: {
  definition: DatasetDefinition;
  workspaceId: string;
  accessToken: string;
  offset: number;
  fetchImpl: typeof fetch;
}): Promise<PageResult> {
  const filterColumn = input.definition.filterColumn ?? "workspace_id";
  const url = new URL(getSupabaseRestUrl(input.definition.table));
  url.searchParams.set("select", "*");
  url.searchParams.set(filterColumn, `eq.${input.workspaceId}`);
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
    rows.some((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return true;
      return filterColumn === "id"
        ? row.id !== input.workspaceId
        : row.workspace_id !== input.workspaceId;
    })
  ) {
    return {
      ok: false,
      message: `${input.definition.table}: fremder Workspace in Exportantwort`,
    };
  }
  return { ok: true, rows: rows.map(sanitizeRow) };
}

async function fetchDataset(input: {
  definition: DatasetDefinition;
  workspaceId: string;
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
  fetchImpl: typeof fetch = fetch,
): Promise<DisclosureMetaDataset[]> {
  const normalizedWorkspaceId = workspaceId.trim();
  const cookieStore = await cookies();
  const accessToken = cookieStore
    .get(SUPABASE_ACCESS_TOKEN_COOKIE)
    ?.value?.trim();

  if (!normalizedWorkspaceId || !accessToken) {
    throw new DataDisclosureExportError(
      "Autorisierter Workspace oder Sitzung fehlt für die Datenauskunft.",
    );
  }

  return Promise.all(
    DATASETS.map((definition) =>
      fetchDataset({
        definition,
        workspaceId: normalizedWorkspaceId,
        accessToken,
        fetchImpl,
      }),
    ),
  );
}

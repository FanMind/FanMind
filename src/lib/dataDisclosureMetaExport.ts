import { cookies } from "next/headers";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
} from "@/lib/supabase/config";
import { DataDisclosureExportError } from "@/lib/dataDisclosurePagination";

const PAGE_SIZE = 500;
const MAX_ROWS_PER_DATASET = 20_000;

export type DisclosureMetaRow = Record<string, unknown> & {
  workspace_id: string;
};

export type DisclosureMetaDataset = {
  key:
    | "connections"
    | "social_provider_connections"
    | "messages"
    | "content"
    | "metrics"
    | "fan_reports"
    | "contact_profiles"
    | "voice_profiles"
    | "conversation_reports"
    | "analysis_settings"
    | "creators"
    | "creator_voices"
    | "creator_playbooks"
    | "creator_commercial_events";
  rows: DisclosureMetaRow[];
};

type DatasetDefinition = {
  key: DisclosureMetaDataset["key"];
  table: string;
  selectVariants: string[];
  optional?: boolean;
  order: string;
  extraFilters?: Array<[string, string]>;
};

const DATASETS: DatasetDefinition[] = [
  { key: "social_provider_connections", table: "social_provider_connections", selectVariants: ["workspace_id,provider,external_account_id,display_name,expires_at,connected_at"], optional: true, order: "provider.asc" },
  { key: "creators", table: "creators", selectVariants: ["id,workspace_id,display_name,bio,public_age,location,languages,platforms,status,internal_notes,revision,created_at,updated_at"], optional: true, order: "id.asc" },
  { key: "creator_voices", table: "creator_voice_profiles", selectVariants: ["workspace_id,creator_id,fingerprint,revision,approved_by,approved_at"], optional: true, order: "creator_id.asc" },
  { key: "creator_playbooks", table: "creator_sales_playbooks", selectVariants: ["workspace_id,creator_id,rules,revision,approved_by,approved_at"], optional: true, order: "creator_id.asc" },
  { key: "creator_commercial_events", table: "creator_commercial_events", selectVariants: ["id,workspace_id,creator_id,contact_id,conversation_id,kind,occurred_at,amount_minor,currency,category,evidence_reference,confirmed_by,confirmed_at"], optional: true, order: "occurred_at.asc,id.asc" },
  {
    key: "connections",
    table: "social_connections",
    selectVariants: [
      "id,workspace_id,platform,provider,status,external_account_id,external_account_name,page_id,page_name,scopes,webhook_subscribed,connected_at,disconnected_at,last_event_at,created_at,updated_at",
    ],
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "messages",
    table: "conversation_messages",
    selectVariants: [
      "id,workspace_id,conversation_id,contact_id,direction,message_type,source_platform,source_type,source_url,reply_target_url,external_thread_id,external_message_id,external_post_id,external_comment_id,original_author_label,original_text_excerpt,author_label,content,attachments,message_kind,created_at",
    ],
    order: "created_at.asc.nullsfirst,id.asc",
    extraFilters: [["source_platform", "in.(facebook,instagram)"]],
  },
  {
    key: "content",
    table: "content_sources",
    selectVariants: [
      "id,workspace_id,social_connection_id,source_platform,source_type,external_account_id,external_source_id,external_post_id,external_video_id,media_type,content_format,campaign_label,title,summary,caption_excerpt,permalink_url,published_at,metadata,created_at,updated_at",
      "id,workspace_id,source_platform,source_type,external_source_id,external_post_id,external_video_id,title,summary,caption_excerpt,permalink_url,published_at,metadata,created_at,updated_at",
    ],
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "metrics",
    table: "content_metric_snapshots",
    selectVariants: ["*"],
    optional: true,
    order: "captured_at.asc.nullsfirst,id.asc",
  },
  {
    key: "fan_reports",
    table: "fan_analysis_reports",
    selectVariants: [
      "id,workspace_id,contact_id,report_json,summary,model,source_message_count,source_from_at,source_to_at,confidence_score,review_status,reviewed_at,generated_at,created_at,updated_at",
      "id,workspace_id,contact_id,report_json,summary,model,source_message_count,generated_at,created_at,updated_at",
    ],
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "contact_profiles",
    table: "contact_ai_profiles",
    selectVariants: [
      "id,workspace_id,contact_id,commercial_profile,language,tone,sentiment,interests,buying_signals,no_gos,preferred_style,response_triggers,risk_notes,confidence_score,source_message_count,source_from_at,source_to_at,review_status,reviewed_at,created_at,updated_at",
      "id,workspace_id,contact_id,language,tone,sentiment,interests,buying_signals,no_gos,preferred_style,response_triggers,risk_notes,confidence_score,source_message_count,source_from_at,source_to_at,review_status,reviewed_at,created_at,updated_at",
      "id,workspace_id,contact_id,language,tone,sentiment,interests,buying_signals,no_gos,preferred_style,response_triggers,risk_notes,confidence_score,source_message_count,created_at,updated_at",
    ],
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "voice_profiles",
    table: "workspace_voice_profiles",
    selectVariants: [
      "id,workspace_id,user_id,owner_label,language,tone,sentence_length,emoji_style,greeting_style,closing_style,common_phrases,avoided_phrases,sales_style,examples_count,confidence_score,source_from_at,source_to_at,source_scope,review_status,reviewed_at,created_at,updated_at",
      "id,workspace_id,user_id,owner_label,language,tone,sentence_length,emoji_style,greeting_style,closing_style,common_phrases,avoided_phrases,sales_style,examples_count,confidence_score,created_at,updated_at",
    ],
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "conversation_reports",
    table: "communication_analysis_reports",
    selectVariants: ["*"],
    optional: true,
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "analysis_settings",
    table: "workspace_analysis_settings",
    selectVariants: [
      "workspace_id,fan_analysis_enabled,conversation_analysis_enabled,user_voice_analysis_enabled,content_insights_enabled,meta_sync_mode,personal_content_retention_days,legal_basis_status,transparency_status,data_processing_agreement_status,retention_status,data_subject_rights_status,message_retention_days,content_cache_retention_days,analysis_retention_days,confirmed_at,created_at,updated_at",
    ],
    optional: true,
    order: "workspace_id.asc",
  },
];

type PageResult =
  | { ok: true; rows: DisclosureMetaRow[] }
  | { ok: false; missingSchema: boolean; message: string };

async function fetchPage(input: {
  definition: DatasetDefinition;
  select: string;
  workspaceId: string;
  accessToken: string;
  offset: number;
  fetchImpl: typeof fetch;
}): Promise<PageResult> {
  const url = new URL(getSupabaseRestUrl(input.definition.table));
  url.searchParams.set("select", input.select);
  url.searchParams.set("workspace_id", `eq.${input.workspaceId}`);
  url.searchParams.set("order", input.definition.order);
  url.searchParams.set("limit", String(PAGE_SIZE));
  url.searchParams.set("offset", String(input.offset));
  for (const [key, value] of input.definition.extraFilters ?? []) {
    url.searchParams.set(key, value);
  }

  const response = await input.fetchImpl(url, {
    headers: getSupabaseHeaders(input.accessToken),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!response) {
    return {
      ok: false,
      missingSchema: false,
      message: `${input.definition.table}: Netzwerkfehler`,
    };
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const normalized = body.toLowerCase();
    return {
      ok: false,
      missingSchema:
        response.status === 404 ||
        normalized.includes("schema cache") ||
        normalized.includes("does not exist") ||
        normalized.includes("could not find"),
      message: `${input.definition.table}: HTTP ${response.status}`,
    };
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!Array.isArray(payload)) {
    return {
      ok: false,
      missingSchema: false,
      message: `${input.definition.table}: ungültige Serverantwort`,
    };
  }
  const rows = payload as DisclosureMetaRow[];
  if (rows.some((row) => row.workspace_id !== input.workspaceId)) {
    return {
      ok: false,
      missingSchema: false,
      message: `${input.definition.table}: fremder Workspace in Exportantwort`,
    };
  }
  return { ok: true, rows };
}

async function fetchDataset(input: {
  definition: DatasetDefinition;
  workspaceId: string;
  accessToken: string;
  fetchImpl: typeof fetch;
}): Promise<DisclosureMetaDataset> {
  let firstPage: DisclosureMetaRow[] | null = null;
  let selectedColumns: string | null = null;
  let lastError = "unbekannter Exportfehler";

  for (const select of input.definition.selectVariants) {
    const result = await fetchPage({
      ...input,
      select,
      offset: 0,
    });
    if (result.ok) {
      firstPage = result.rows;
      selectedColumns = select;
      break;
    }
    lastError = result.message;
    if (!result.missingSchema) break;
  }

  if (!firstPage || !selectedColumns) {
    if (input.definition.optional && lastError) {
      const optionalProbe = await fetchPage({
        ...input,
        select: input.definition.selectVariants[0],
        offset: 0,
      });
      if (!optionalProbe.ok && optionalProbe.missingSchema) {
        return { key: input.definition.key, rows: [] };
      }
    }
    throw new DataDisclosureExportError(
      `Gespeicherte Meta-Daten konnten nicht vollständig exportiert werden (${lastError}).`,
    );
  }

  const rows = [...firstPage];
  while (rows.length && rows.length % PAGE_SIZE === 0) {
    if (rows.length >= MAX_ROWS_PER_DATASET) {
      throw new DataDisclosureExportError(
        `${input.definition.table} enthält mehr als ${MAX_ROWS_PER_DATASET} Zeilen; Export ohne Abschneidung wurde abgebrochen.`,
      );
    }
    const result = await fetchPage({
      ...input,
      select: selectedColumns,
      offset: rows.length,
    });
    if (!result.ok) {
      throw new DataDisclosureExportError(
        `Gespeicherte Meta-Daten konnten nicht vollständig exportiert werden (${result.message}).`,
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
      "Autorisierter Workspace oder Sitzung fehlt für die Meta-Datenauskunft.",
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

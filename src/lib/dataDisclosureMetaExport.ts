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
  select: string;
  order: string;
  filterColumn?: "workspace_id" | "id";
};

// Complete active Production data families that can hold data for the signed-in
// Creator account or its Workspace. Staging-only/not-yet-installed feature
// tables are added here in the same release that makes them Production storage.
// A missing table in this active list is an export error; data is never silently
// omitted or reported as a successful partial disclosure.
const DATASETS: DatasetDefinition[] = [
  {
    key: "workspace_record",
    table: "workspaces",
    filterColumn: "id",
    select: [
      "id",
      "name",
      "owner_user_id",
      "plan_id",
      "commercial_option",
      "setup_fee_cents",
      "monthly_fee_cents",
      "commitment_months",
      "billing_status",
      "billing_provider",
      "payment_collection_method",
      "payment_terms_version",
      "payment_terms_accepted_at",
      "payment_terms_accepted_by_user_id",
      "billing_suspended_at",
      "billing_suspended_reason",
      "billing_manual_override",
      "billing_last_payment_failed_at",
      "billing_last_payment_at",
      "billing_retry_count",
      "billing_next_retry_at",
      "billing_grace_until",
      "billing_admin_note",
      "billing_contract_started_at",
      "billing_current_period_end_at",
      "billing_next_invoice_at",
      "billing_minimum_term_ends_at",
      "subscription_cancel_requested_at",
      "subscription_cancel_requested_by_user_id",
      "subscription_cancel_at_period_end",
      "subscription_effective_end_at",
      "subscription_cancellation_revoked_at",
      "workspace_access_mode",
      "billing_updated_at",
      "billing_updated_by_user_id",
      "billing_note",
      "last_invoice_status",
      "last_invoice_amount_due_cents",
      "last_invoice_amount_paid_cents",
      "organization_name",
      "street_address",
      "postal_code",
      "city",
      "country",
      "vat_id",
      "tax_number",
      "company_register_number",
      "company_register_court",
    ].join(","),
    order: "id.asc",
  },
  {
    key: "contacts_full",
    table: "contacts",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "memories",
    table: "memories",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "followups",
    table: "followups",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "conversations",
    table: "conversations",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "messages",
    table: "conversation_messages",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "conversation_summaries",
    table: "conversation_summaries",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "reply_targets",
    table: "contact_reply_targets",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "fan_reports",
    table: "fan_analysis_reports",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "contact_profiles",
    table: "contact_ai_profiles",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "voice_profiles",
    table: "workspace_voice_profiles",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "prompt_settings",
    table: "workspace_ai_prompt_settings",
    select: "*",
    order: "workspace_id.asc",
  },
  {
    key: "ai_usage",
    table: "ai_usage_events",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "connections",
    table: "social_connections",
    select: [
      "id",
      "workspace_id",
      "platform",
      "provider",
      "status",
      "external_account_id",
      "external_account_name",
      "page_id",
      "page_name",
      "scopes",
      "webhook_subscribed",
      "connected_by",
      "connected_at",
      "disconnected_at",
      "last_event_at",
      "last_comment_fetch_at",
      "last_comment_fetch_count",
      "last_comment_fetch_error",
      "last_messenger_sync_at",
      "last_messenger_sync_checked_count",
      "last_messenger_sync_imported_inbound_count",
      "last_messenger_sync_imported_outbound_count",
      "last_messenger_sync_imported_media_count",
      "last_messenger_sync_skipped_count",
      "last_messenger_sync_error",
      "last_messenger_sync_outbound_at",
      "messenger_sync_continuation_after",
      "messenger_sync_continuation_started_at",
      "oauth_login_type",
      "external_account_type",
      "token_expires_at",
      "permissions_verified_at",
      "analytics_enabled",
      "created_at",
      "updated_at",
    ].join(","),
    order: "created_at.asc.nullsfirst,id.asc",
  },
  {
    key: "meta_webhook_events",
    table: "meta_webhook_events",
    select: "*",
    order: "created_at.asc.nullsfirst,id.asc",
  },
];

type PageResult =
  | { ok: true; rows: DisclosureMetaRow[] }
  | { ok: false; message: string };

async function fetchPage(input: {
  definition: DatasetDefinition;
  workspaceId: string;
  accessToken: string;
  offset: number;
  fetchImpl: typeof fetch;
}): Promise<PageResult> {
  const filterColumn = input.definition.filterColumn ?? "workspace_id";
  const url = new URL(getSupabaseRestUrl(input.definition.table));
  url.searchParams.set("select", input.definition.select);
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
  return { ok: true, rows };
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

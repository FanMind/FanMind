import "server-only";
import { cookies } from "next/headers";
import {
  getSupabaseApiKeyHeaders,
  getSupabaseRestUrl,
  SUPABASE_ACCESS_TOKEN_COOKIE,
} from "@/lib/supabase/config";
import { requireAuthorizedWorkspace } from "@/lib/workspaceAuthorization";
import { DataDisclosureExportError } from "@/lib/dataDisclosurePagination";
import type {
  DisclosureMetaDataset,
  DisclosureMetaRow,
} from "@/lib/dataDisclosureMetaExport";

const PAGE_SIZE = 500;
const MAX_ROWS = 50_000;

type PrivateDefinition = {
  key: Extract<
    DisclosureMetaDataset["key"],
    | "pilot_inquiries"
    | "referral_membership"
    | "referrals_given"
    | "referrals_received"
    | "referral_discount_snapshots"
    | "account_deletion_requests"
  >;
  table: string;
  select: string;
  order: string;
  filters: (input: PrivateDisclosureIdentity) => Array<[string, string]>;
  validate: (row: DisclosureMetaRow, input: PrivateDisclosureIdentity) => boolean;
  transform?: (row: DisclosureMetaRow) => DisclosureMetaRow;
};

type PrivateDisclosureIdentity = {
  workspaceId: string;
  userId: string;
  email: string;
};

const REFERRAL_SELECT = [
  "id",
  "referrer_workspace_id",
  "referrer_user_id",
  "referred_workspace_id",
  "referred_user_id",
  "referral_code",
  "status",
  "created_during_program_status",
  "first_seen_at",
  "qualified_at",
  "activated_at",
  "deactivated_at",
  "deactivation_reason",
  "billing_status_snapshot",
  "locked_reason",
  "created_at",
  "updated_at",
].join(",");

function publicReferralRow(
  row: DisclosureMetaRow,
  relationshipRole: "referrer" | "referred",
): DisclosureMetaRow {
  const hiddenIdentityFields = new Set([
    "referrer_workspace_id",
    "referrer_user_id",
    "referred_workspace_id",
    "referred_user_id",
  ]);
  const rest = Object.fromEntries(
    Object.entries(row).filter(([key]) => !hiddenIdentityFields.has(key)),
  );
  return { ...rest, relationship_role: relationshipRole };
}

const DEFINITIONS: PrivateDefinition[] = [
  {
    key: "pilot_inquiries",
    table: "pilot_inquiries",
    select: "id,email,name,message,source,status,created_at,updated_at,handled_at",
    order: "created_at.asc.nullsfirst,id.asc",
    filters: ({ email }) => [["email", `eq.${email}`]],
    validate: (row, { email }) => row.email === email,
  },
  {
    key: "referral_membership",
    table: "referral_program_members",
    select: "id,workspace_id,user_id,referral_code,eligible,status,override_active_referral_count,override_discount_percent,override_reason,joined_at,created_at,updated_at",
    order: "created_at.asc.nullsfirst,id.asc",
    filters: ({ workspaceId, userId }) => [
      ["workspace_id", `eq.${workspaceId}`],
      ["user_id", `eq.${userId}`],
    ],
    validate: (row, { workspaceId, userId }) =>
      row.workspace_id === workspaceId && row.user_id === userId,
  },
  {
    key: "referrals_given",
    table: "referrals",
    select: REFERRAL_SELECT,
    order: "created_at.asc.nullsfirst,id.asc",
    filters: ({ workspaceId, userId }) => [
      ["referrer_workspace_id", `eq.${workspaceId}`],
      ["referrer_user_id", `eq.${userId}`],
    ],
    validate: (row, { workspaceId, userId }) =>
      row.referrer_workspace_id === workspaceId && row.referrer_user_id === userId,
    transform: (row) => publicReferralRow(row, "referrer"),
  },
  {
    key: "referrals_received",
    table: "referrals",
    select: REFERRAL_SELECT,
    order: "created_at.asc.nullsfirst,id.asc",
    filters: ({ workspaceId, userId }) => [
      ["referred_workspace_id", `eq.${workspaceId}`],
      ["referred_user_id", `eq.${userId}`],
    ],
    validate: (row, { workspaceId, userId }) =>
      row.referred_workspace_id === workspaceId && row.referred_user_id === userId,
    transform: (row) => publicReferralRow(row, "referred"),
  },
  {
    key: "referral_discount_snapshots",
    table: "referral_discount_snapshots",
    select: "id,workspace_id,active_referral_count,discount_percent,monthly_fee_cents_before_discount,monthly_discount_cents,monthly_fee_cents_after_discount,program_status_snapshot,calculated_at",
    order: "calculated_at.asc.nullsfirst,id.asc",
    filters: ({ workspaceId }) => [["workspace_id", `eq.${workspaceId}`]],
    validate: (row, { workspaceId }) => row.workspace_id === workspaceId,
  },
  {
    key: "account_deletion_requests",
    table: "account_deletion_requests",
    select: "id,user_id,workspace_id,notification_email,request_source,confirmation_version,status,requires_ownership_transfer,requires_subscription_resolution,requested_at,processing_deadline_at,cancelled_at,processing_started_at,completed_at,acknowledgement_sent_at,completion_notification_sent_at,created_at,updated_at",
    order: "created_at.asc.nullsfirst,id.asc",
    filters: ({ workspaceId, userId }) => [
      ["workspace_id", `eq.${workspaceId}`],
      ["user_id", `eq.${userId}`],
    ],
    validate: (row, { workspaceId, userId }) =>
      row.workspace_id === workspaceId && row.user_id === userId,
  },
];

async function readDefinition(input: {
  definition: PrivateDefinition;
  identity: PrivateDisclosureIdentity;
  serviceKey: string;
  fetchImpl: typeof fetch;
}): Promise<DisclosureMetaDataset> {
  const rows: DisclosureMetaRow[] = [];
  for (;;) {
    if (rows.length >= MAX_ROWS) {
      throw new DataDisclosureExportError(
        `${input.definition.table} enthält mehr als ${MAX_ROWS} relevante Zeilen; Export ohne Abschneidung wurde abgebrochen.`,
      );
    }
    const url = new URL(getSupabaseRestUrl(input.definition.table));
    url.searchParams.set("select", input.definition.select);
    for (const [key, value] of input.definition.filters(input.identity)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("order", input.definition.order);
    url.searchParams.set("limit", String(PAGE_SIZE));
    url.searchParams.set("offset", String(rows.length));

    const response = await input.fetchImpl(url, {
      headers: getSupabaseApiKeyHeaders(input.serviceKey),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    }).catch(() => null);
    if (!response || !response.ok) {
      throw new DataDisclosureExportError(
        `${input.definition.table} konnte für die vollständige Datenauskunft nicht geladen werden.`,
      );
    }
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!Array.isArray(payload)) {
      throw new DataDisclosureExportError(
        `${input.definition.table} lieferte eine ungültige Exportantwort.`,
      );
    }
    const page = payload as DisclosureMetaRow[];
    if (
      page.some(
        (row) =>
          !row ||
          typeof row !== "object" ||
          Array.isArray(row) ||
          !input.definition.validate(row, input.identity),
      )
    ) {
      throw new DataDisclosureExportError(
        `${input.definition.table} enthielt Daten außerhalb des autorisierten Creator-Kontexts.`,
      );
    }
    rows.push(
      ...page.map((row) =>
        input.definition.transform ? input.definition.transform(row) : row,
      ),
    );
    if (page.length < PAGE_SIZE) break;
  }
  return { key: input.definition.key, rows };
}

export async function getPrivateAccountDataForDisclosure(
  workspaceId: string,
  userId: string,
  email: string,
  fetchImpl: typeof fetch = fetch,
): Promise<DisclosureMetaDataset[]> {
  const identity = {
    workspaceId: workspaceId.trim(),
    userId: userId.trim(),
    email: email.trim(),
  };
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SUPABASE_ACCESS_TOKEN_COOKIE)?.value?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!identity.workspaceId || !identity.userId || !identity.email || !accessToken || !serviceKey) {
    throw new DataDisclosureExportError(
      "Die serverseitige Autorisierung für die vollständige Datenauskunft fehlt.",
    );
  }

  const assertOwner = async () => {
    const context = await requireAuthorizedWorkspace(accessToken);
    if (
      context.user.id !== identity.userId ||
      context.workspace.id !== identity.workspaceId ||
      context.workspace.owner_user_id !== identity.userId
    ) {
      throw new DataDisclosureExportError(
        "Die Datenauskunft ist nur für das eigene Creator-Konto verfügbar.",
      );
    }
  };

  await assertOwner();
  const datasets = await Promise.all(
    DEFINITIONS.map((definition) =>
      readDefinition({ definition, identity, serviceKey, fetchImpl }),
    ),
  );
  await assertOwner();
  return datasets;
}

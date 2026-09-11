import { NextResponse } from "next/server";
import { getCommercialOptionLabel } from "@/lib/dashboardFeatures";
import {
  DataDisclosureExportError,
  getAllWorkspaceContactsForDisclosure,
} from "@/lib/dataDisclosureExport";
import {
  getWorkspaceMetaDataForDisclosure,
  type DisclosureMetaDataset,
  type DisclosureMetaRow,
} from "@/lib/dataDisclosureMetaExport";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
} from "@/lib/supabase/server";
import { createDataDisclosurePdf } from "@/lib/dataDisclosurePdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getUserDisplayName(
  metadata: Record<string, unknown> | undefined,
): string | undefined {
  const displayName = metadata?.display_name ?? metadata?.full_name;
  return typeof displayName === "string" && displayName.trim()
    ? displayName.trim()
    : undefined;
}

export async function GET(request: Request) {
  const { data } = await getSupabaseServerUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", request.url));

  const workspaceResult = await getUserWorkspaceDashboard(data.user);
  const workspace = workspaceResult.workspace;
  if (!workspace) {
    return new NextResponse("Workspace nicht gefunden.", { status: 404 });
  }

  let contacts: Awaited<ReturnType<typeof getAllWorkspaceContactsForDisclosure>>;
  let storedMetaData: DisclosureMetaDataset[];
  try {
    [contacts, storedMetaData] = await Promise.all([
      getAllWorkspaceContactsForDisclosure(workspace.id),
      getWorkspaceMetaDataForDisclosure(workspace.id),
    ]);
  } catch (error) {
    const message =
      error instanceof DataDisclosureExportError
        ? error.message
        : "Datenauskunft konnte nicht vollständig erstellt werden.";
    return new NextResponse(message, {
      status: error instanceof DataDisclosureExportError ? 409 : 500,
      headers: {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "de";
  const pdf = await createDataDisclosurePdf({
    generatedAt: new Date(),
    locale,
    user: {
      id: data.user.id,
      email: data.user.email,
      displayName: getUserDisplayName(data.user.user_metadata),
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      planId: workspace.plan_id,
      commercialOption: getCommercialOptionLabel(workspace.commercial_option),
      billingStatus: workspace.billing_status,
      setupFeeCents: workspace.setup_fee_cents,
      monthlyFeeCents: workspace.monthly_fee_cents,
      commitmentMonths: workspace.commitment_months,
      organizationName: workspace.organization_name,
      streetAddress: workspace.street_address,
      postalCode: workspace.postal_code,
      city: workspace.city,
      country: workspace.country,
      vatId: workspace.vat_id,
      taxNumber: workspace.tax_number,
      companyRegisterNumber: workspace.company_register_number,
      companyRegisterCourt: workspace.company_register_court,
      billingCurrentPeriodEndAt: workspace.billing_current_period_end_at,
      billingMinimumTermEndsAt: workspace.billing_minimum_term_ends_at,
      subscriptionCancelRequestedAt: workspace.subscription_cancel_requested_at,
      subscriptionEffectiveEndAt: workspace.subscription_effective_end_at,
      workspaceAccessMode: workspace.workspace_access_mode,
    },
    contacts: contacts.map((contact) => ({
      displayName: contact.display_name,
      handle: contact.handle,
      sourcePlatform: contact.source_platform,
      language: contact.language,
      status: contact.status,
      tags: contact.tags,
      summary: contact.summary,
      internalNotes: contact.internal_notes,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at,
    })),
    storedDataSections: buildStoredDataSections(storedMetaData, locale),
  });

  const body = new ArrayBuffer(pdf.byteLength);
  new Uint8Array(body).set(pdf);
  const filename =
    locale === "en" ? "fanmind-data-disclosure.pdf" : "fanmind-datenauskunft.pdf";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

const SECTION_LABELS: Record<
  DisclosureMetaDataset["key"],
  { de: string; en: string }
> = {
  social_provider_connections: { de: "TikTok- und X-Kontoverbindungen (ohne Tokens)", en: "TikTok and X account connections (without tokens)" },
  creators: { de: "Creator-Persona", en: "Creator persona" },
  creator_voices: { de: "Creator-Stimme", en: "Creator voice" },
  creator_playbooks: { de: "Creator-Angebote und Grenzen", en: "Creator offers and boundaries" },
  creator_commercial_events: { de: "Bestätigte Kauf- und Angebotsereignisse", en: "Confirmed purchase and offer events" },
  connections: { de: "Meta-Verbindungen (ohne Tokens)", en: "Meta connections (without tokens)" },
  messages: { de: "Gespeicherte Meta-Chats und Kommentare", en: "Stored Meta chats and comments" },
  content: { de: "Eigener Post-/Medien-Cache", en: "Owned post and media cache" },
  metrics: { de: "Reichweiten- und Metrik-Snapshots", en: "Reach and metric snapshots" },
  fan_reports: { de: "Fan-Analyseberichte", en: "Fan analysis reports" },
  contact_profiles: { de: "Abgeleitete Fanprofile", en: "Derived fan profiles" },
  voice_profiles: { de: "Nutzer-Schreibstilprofile", en: "User voice profiles" },
  conversation_reports: { de: "Gesprächsanalysen", en: "Conversation analyses" },
  analysis_settings: { de: "Analyse- und Aufbewahrungssteuerung", en: "Analysis and retention controls" },
};

function buildStoredDataSections(
  datasets: DisclosureMetaDataset[],
  locale: "de" | "en",
) {
  return datasets.map((dataset) => ({
    title: SECTION_LABELS[dataset.key][locale],
    countLabel: locale === "en" ? "Stored records" : "Gespeicherte Datensätze",
    emptyMessage:
      locale === "en"
        ? "No records are stored in this category."
        : "In diesem Bereich sind keine Datensätze gespeichert.",
    entries: dataset.rows.map((row, index) => ({
      title: disclosureRowTitle(row, index, locale),
      fields: Object.entries(row).map(
        ([key, value]) => `${key}: ${formatDisclosureValue(value, locale)}`,
      ),
    })),
  }));
}

function disclosureRowTitle(
  row: DisclosureMetaRow,
  index: number,
  locale: "de" | "en",
): string {
  for (const key of [
    "external_account_name",
    "title",
    "author_label",
    "owner_label",
    "external_content_id",
    "contact_id",
    "id",
  ]) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return `${locale === "en" ? "Record" : "Datensatz"} ${index + 1}`;
}

function formatDisclosureValue(value: unknown, locale: "de" | "en"): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") {
    return value ? (locale === "en" ? "yes" : "ja") : locale === "en" ? "no" : "nein";
  }
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return locale === "en" ? "[not representable]" : "[nicht darstellbar]";
    }
  }
  return String(value);
}

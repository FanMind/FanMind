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
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "de";
  try {
    const { data } = await getSupabaseServerUser();
    if (!data.user) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const workspaceResult = await getUserWorkspaceDashboard(data.user);
    const workspace = workspaceResult.workspace;
    if (!workspace) return disclosureFailure(locale, 404);

    const [contacts, storedMetaData] = await Promise.all([
      getAllWorkspaceContactsForDisclosure(workspace.id),
      getWorkspaceMetaDataForDisclosure(workspace.id),
    ]);
    const partial = storedMetaData.some(dataset => dataset.unavailable);
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
    const filename = partial
      ? (locale === "en" ? "fanmind-data-disclosure-partial.pdf" : "fanmind-datenauskunft-teilweise.pdf")
      : (locale === "en" ? "fanmind-data-disclosure.pdf" : "fanmind-datenauskunft.pdf");

    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-FanMind-Disclosure-Status": partial ? "partial" : "available-data",
      },
    });
  } catch (error) {
    // Never expose database diagnostics, personal content or PDF/font exceptions.
    return disclosureFailure(locale, error instanceof DataDisclosureExportError ? 409 : 500);
  }
}

function disclosureFailure(locale: "de" | "en", status: number): NextResponse {
  const text = locale === "en" ? {
    title: "Data disclosure is currently unavailable",
    section: "Profile & account / Data disclosure",
    body: "Not all required data could be loaded or the PDF could not be created. No PDF was downloaded. Your stored data has not been changed.",
    retry: "Try again", back: "Back to profile",
    help: "If the problem persists, please contact FanMind support to request your data disclosure.",
  } : {
    title: "Datenauskunft derzeit nicht verfügbar",
    section: "Profil & Konto / Datenauskunft",
    body: "Nicht alle erforderlichen Daten konnten geladen werden oder die PDF konnte nicht erstellt werden. Es wurde keine PDF heruntergeladen. Deine gespeicherten Daten wurden nicht verändert.",
    retry: "Erneut versuchen", back: "Zurück zum Profil",
    help: "Besteht das Problem weiterhin, wende dich bitte für deine Datenauskunft an den FanMind-Support.",
  };
  // All interpolations are fixed localized copy or an allowlisted locale.
  // No request URL, query value, exception or account field is rendered here.
  return new NextResponse(`<!doctype html>
<html lang="${locale}"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text.title} | FanMind</title>
<link rel="stylesheet" href="/data-disclosure-error.css"></head>
<body><main>
<a class="brand" href="/settings/profile" aria-label="FanMind">Fan<span>Mind</span></a>
<p class="breadcrumb">${text.section}</p>
<section aria-labelledby="export-heading">
<p class="eyebrow">${locale === "en" ? "DATA EXPORT" : "DATENEXPORT"}</p>
<h1 id="export-heading">${text.title}</h1>
<p class="message">${text.body}</p>
<nav aria-label="${locale === "en" ? "Next steps" : "Nächste Schritte"}">
<a class="primary" href="/settings/profile/data-export?lang=${locale}">${text.retry}</a>
<a class="secondary" href="/settings/profile?lang=${locale}">${text.back}</a>
</nav><p class="help">${text.help}</p>
</section></main></body></html>`, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
    },
  });
}

const SECTION_LABELS: Record<
  DisclosureMetaDataset["key"],
  { de: string; en: string }
> = {
  social_provider_connections: { de: "TikTok- und X-Kontoverbindungen (ohne Tokens)", en: "TikTok and X account connections (without tokens)" },
  creators: { de: "Creator-Persona", en: "Creator persona" },
  creator_voices: { de: "Creator-Schreibstil", en: "Creator writing style" },
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
    unavailableMessage: dataset.unavailable
      ? (locale === "en"
        ? "Not included: this optional data category is currently unavailable. Whether it contains stored data could not be verified. This is not a zero-record result."
        : "Nicht enthalten: Dieser optionale Datenbereich ist derzeit nicht abrufbar. Ob dort Daten gespeichert sind, konnte nicht geprüft werden. Dies ist kein Nachweis für null gespeicherte Datensätze.")
      : undefined,
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

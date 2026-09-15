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

function isSensitiveMetadataKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return (
    normalized.includes("password") ||
    normalized.includes("secret") ||
    normalized.includes("access_token") ||
    normalized.includes("refresh_token") ||
    normalized.includes("api_key")
  );
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

    const [contacts, storedData] = await Promise.all([
      getAllWorkspaceContactsForDisclosure(workspace.id),
      getWorkspaceMetaDataForDisclosure(workspace.id),
    ]);

    const accountMetadataSection = buildAccountMetadataSection(
      data.user.user_metadata,
      workspace.role,
      locale,
    );

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
      storedDataSections: [
        accountMetadataSection,
        ...buildStoredDataSections(storedData, locale),
      ],
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
        "X-FanMind-Disclosure-Status": "complete",
      },
    });
  } catch (error) {
    // A complete disclosure is fail-closed. Never return a successful PDF after
    // an active data family, page, authorization check or PDF build has failed.
    // Never expose database diagnostics, personal content or PDF/font errors.
    return disclosureFailure(locale, error instanceof DataDisclosureExportError ? 409 : 500);
  }
}

function buildAccountMetadataSection(
  metadata: Record<string, unknown> | undefined,
  workspaceRole: string,
  locale: "de" | "en",
) {
  const fields = Object.entries(metadata ?? {})
    .filter(([key]) => !isSensitiveMetadataKey(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}: ${formatDisclosureValue(value, locale)}`);
  fields.push(`workspace_role: ${formatDisclosureValue(workspaceRole, locale)}`);

  return {
    title: locale === "en" ? "Account profile and saved preferences" : "Kontoprofil und gespeicherte Präferenzen",
    countLabel: locale === "en" ? "Account records" : "Kontodatensätze",
    emptyMessage: locale === "en" ? "No additional account metadata is stored." : "Keine zusätzlichen Kontometadaten gespeichert.",
    entries: [
      {
        title: locale === "en" ? "Signed-in Creator account" : "Angemeldetes Creator-Konto",
        fields,
      },
    ],
  };
}

function disclosureFailure(locale: "de" | "en", status: number): NextResponse {
  const text = locale === "en" ? {
    title: "Complete data disclosure is currently unavailable",
    section: "Profile & account / Data disclosure",
    body: "Not all data stored for your FanMind account and Workspace could be loaded or the PDF could not be created. No incomplete PDF was downloaded. Your stored data has not been changed.",
    retry: "Try again", back: "Back to profile",
    help: "If the problem persists, please contact FanMind support to request the complete data disclosure.",
  } : {
    title: "Vollständige Datenauskunft derzeit nicht verfügbar",
    section: "Profil & Konto / Datenauskunft",
    body: "Nicht alle für dein FanMind-Konto und deinen Workspace gespeicherten Daten konnten geladen werden oder die PDF konnte nicht erstellt werden. Es wurde keine unvollständige PDF heruntergeladen. Deine gespeicherten Daten wurden nicht verändert.",
    retry: "Erneut versuchen", back: "Zurück zum Profil",
    help: "Besteht das Problem weiterhin, wende dich bitte für die vollständige Datenauskunft an den FanMind-Support.",
  };
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
  workspace_record: { de: "Workspace-, Vertrags- und Abrechnungsdaten", en: "Workspace, contract and billing data" },
  contacts_full: { de: "Kontakte – vollständige Datensätze", en: "Contacts - complete records" },
  memories: { de: "Fan-Gedächtnis / Memories", en: "Fan memory / memories" },
  followups: { de: "Follow-ups", en: "Follow-ups" },
  conversations: { de: "Conversations", en: "Conversations" },
  messages: { de: "Gespeicherte Nachrichten aller Kanäle", en: "Stored messages from all channels" },
  conversation_summaries: { de: "Conversation Summaries", en: "Conversation summaries" },
  reply_targets: { de: "Gespeicherte Originalkanal-/Antwortziele", en: "Stored original-channel and reply targets" },
  fan_reports: { de: "Fan-Analyseberichte", en: "Fan analysis reports" },
  contact_profiles: { de: "Abgeleitete Fanprofile", en: "Derived fan profiles" },
  voice_profiles: { de: "Nutzer-/Creator-Schreibstilprofile", en: "User/Creator writing style profiles" },
  prompt_settings: { de: "KI-/Prompt-Einstellungen und Antwortprofile", en: "AI/prompt settings and reply profiles" },
  ai_usage: { de: "KI-Nutzungs- und Kostenereignisse", en: "AI usage and cost events" },
  connections: { de: "Social-Verbindungen ohne Tokens", en: "Social connections without tokens" },
  meta_webhook_events: { de: "Gespeicherte Meta-Webhook-Ereignisse", en: "Stored Meta webhook events" },
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
    "display_name",
    "external_account_name",
    "title",
    "author_label",
    "owner_label",
    "external_content_id",
    "contact_id",
    "conversation_id",
    "id",
    "workspace_id",
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

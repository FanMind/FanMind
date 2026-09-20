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
import { getPrivateAccountDataForDisclosure } from "@/lib/dataDisclosurePrivateExport";
import {
  getSupabaseServerUser,
  getUserWorkspaceDashboard,
} from "@/lib/supabase/server";
import { createDataDisclosurePdf } from "@/lib/dataDisclosurePdf";
import { projectAuthAccountForDisclosure } from "@/lib/dataDisclosureAuthProjection";

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
    normalized.includes("token") ||
    normalized.includes("credential") ||
    normalized.includes("authorization") ||
    normalized.includes("api_key") ||
    normalized === "code"
  );
}

function sanitizeAccountMetadata(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[bounded]";
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => sanitizeAccountMetadata(entry, depth + 1));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isSensitiveMetadataKey(key))
        .slice(0, 50)
        .map(([key, entry]) => [key, sanitizeAccountMetadata(entry, depth + 1)]),
    );
  }
  return typeof value === "string" ? value.slice(0, 2_000) : value;
}

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get("lang") === "en" ? "en" : "de";
  try {
    const { data, error: authError } = await getSupabaseServerUser();
    if (authError) return disclosureFailure(locale, 500);
    if (!data.user) {
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    }

    const workspaceResult = await getUserWorkspaceDashboard(data.user);
    const workspace = workspaceResult.workspace;
    if (!workspace) return disclosureFailure(locale, 404);
    if (
      workspace.role !== "owner" ||
      workspace.owner_user_id !== data.user.id ||
      !data.user.email?.trim()
    ) {
      return disclosureFailure(locale, 403);
    }

    const [contacts, storedData, privateData] = await Promise.all([
      getAllWorkspaceContactsForDisclosure(workspace.id),
      getWorkspaceMetaDataForDisclosure(workspace.id, data.user.id),
      getPrivateAccountDataForDisclosure(
        workspace.id,
        data.user.id,
        data.user.email,
      ),
    ]);

    const accountMetadataSection = buildAccountMetadataSection(
      data.user,
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
        ...buildStoredDataSections([...storedData, ...privateData], locale),
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
  authUser: unknown,
  metadata: Record<string, unknown> | undefined,
  workspaceRole: string,
  locale: "de" | "en",
) {
  const authProjection = projectAuthAccountForDisclosure(authUser);
  const fields = Object.entries(metadata ?? {})
    .filter(([key]) => !isSensitiveMetadataKey(key))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) =>
      `${key}: ${formatDisclosureValue(sanitizeAccountMetadata(value), locale)}`,
    );
  for (const [key, value] of Object.entries(authProjection)) {
    fields.push(`auth_${key}: ${formatDisclosureValue(value, locale)}`);
  }
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
  profile_record: { de: "Gespeichertes Nutzerprofil", en: "Stored user profile" },
  membership_record: { de: "Eigene Workspace-Mitgliedschaft", en: "Own Workspace membership" },
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
  ai_usage: { de: "KI-Nutzungs- und Kostenereignisse", en: "AI usage and cost events" },
  connections: { de: "Social-Verbindungen ohne Tokens", en: "Social connections without tokens" },
  meta_webhook_events: { de: "Gespeicherte Meta-Webhook-Ereignisse", en: "Stored Meta webhook events" },
  content_sources: { de: "Eigene Social-Inhalte und Metadaten", en: "Own social content and metadata" },
  content_metrics: { de: "Social-Metrik-Snapshots", en: "Social metric snapshots" },
  conversation_reports: { de: "Kommunikationsanalysen", en: "Communication analyses" },
  analysis_settings: { de: "Analyse- und Aufbewahrungseinstellungen", en: "Analysis and retention settings" },
  creators: { de: "Creator-Persona", en: "Creator persona" },
  creator_voices: { de: "Freigegebener Creator-Schreibstil", en: "Approved Creator writing style" },
  creator_playbooks: { de: "Creator Sales Playbook", en: "Creator sales playbook" },
  creator_commercial_events: { de: "Bestätigte Angebots- und Kaufbelege", en: "Confirmed offer and purchase evidence" },
  pilot_inquiries: { de: "Eigene frühere Pilot-/Kontaktanfragen", en: "Own earlier pilot/contact inquiries" },
  referral_membership: { de: "Eigenes Referral-Programmprofil", en: "Own referral program profile" },
  referrals_given: { de: "Eigene Referral-Empfehlungen", en: "Own referral recommendations" },
  referrals_received: { de: "Eigene Referral-Zuordnung", en: "Own referral attribution" },
  referral_discount_snapshots: { de: "Referral-Rabattberechnungen", en: "Referral discount calculations" },
  account_deletion_requests: { de: "Eigene Konto-Löschanfragen", en: "Own account deletion requests" },
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
    "name",
    "external_account_name",
    "title",
    "author_label",
    "owner_label",
    "referral_code",
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

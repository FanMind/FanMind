import {
  buildDocumentPDFBytes,
  detectFallbackLangs,
  initNodeCompression,
  loadFontData,
  registerFonts,
  type DocumentBlock,
  type FontEntry,
  type FontLoader,
} from "pdfnative";

export type DataDisclosureLocale = "de" | "en";

export type DataDisclosurePdfInput = {
  generatedAt: Date;
  locale?: DataDisclosureLocale;
  user: { id: string; email?: string; displayName?: string };
  workspace: {
    id: string;
    name: string;
    planId?: string | null;
    commercialOption?: string | null;
    billingStatus?: string | null;
    setupFeeCents?: number | null;
    monthlyFeeCents?: number | null;
    commitmentMonths?: number | null;
    organizationName?: string | null;
    streetAddress?: string | null;
    postalCode?: string | null;
    city?: string | null;
    country?: string | null;
    vatId?: string | null;
    taxNumber?: string | null;
    companyRegisterNumber?: string | null;
    companyRegisterCourt?: string | null;
    billingCurrentPeriodEndAt?: string | null;
    billingMinimumTermEndsAt?: string | null;
    subscriptionCancelRequestedAt?: string | null;
    subscriptionEffectiveEndAt?: string | null;
    workspaceAccessMode?: string | null;
  };
  contacts: Array<{
    displayName: string;
    handle?: string | null;
    sourcePlatform?: string | null;
    language?: string | null;
    status?: string | null;
    tags?: string[] | null;
    summary?: string | null;
    internalNotes?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
  storedDataSections?: Array<{
    title: string;
    countLabel: string;
    emptyMessage: string;
    unavailableMessage?: string;
    entries: Array<{
      title: string;
      fields: string[];
    }>;
  }>;
};

const copy = {
  de: {
    title: "FanMind PDF-Datenauskunft",
    partialTitle: "FanMind PDF-Datenauskunft - Teilauskunft",
    partialHeading: "Vollständigkeit nicht bestätigt",
    partialNotice: "Diese PDF enthält die erfolgreich abgerufenen Daten. Mindestens ein optionaler Datenbereich ist derzeit nicht abrufbar und ausdrücklich als nicht enthalten gekennzeichnet. Daraus folgt nicht, dass dort keine Daten gespeichert sind. Für eine vollständige Auskunft bitte den Export nach Behebung erneut anfordern oder den FanMind-Support kontaktieren.",
    partialNote: "Hinweis: Nicht abrufbare Bereiche sind in dieser Teilauskunft ausgewiesen. Es werden nur autorisierte Daten exportiert; Secrets, Tokens, Sitzungsdaten, Stripe-IDs und Daten anderer Workspaces sind ausgeschlossen.",
    generated: "Erstellt",
    account: "Konto",
    userId: "Nutzer-ID",
    email: "E-Mail",
    name: "Name",
    workspace: "Workspace",
    workspaceId: "Workspace-ID",
    plan: "Paket",
    commercialOption: "Vertragsoption",
    billingStatus: "Billing-Status",
    setupFee: "Einrichtung",
    monthlyFee: "Monatlich",
    commitment: "Mindestlaufzeit",
    organization: "Organisation",
    address: "Adresse",
    vatId: "UID / VAT ID",
    taxNumber: "Steuernummer",
    registerNumber: "Firmenbuchnummer",
    registerCourt: "Firmenbuchgericht",
    currentPeriodEnd: "Aktuelles Periodenende",
    minimumTermEnd: "Ende Mindestlaufzeit",
    cancellationRequested: "Kündigung vorgemerkt am",
    effectiveEnd: "Wirksames Vertragsende",
    accessMode: "Workspace-Zugriffsmodus",
    contacts: "CRM-Kontakte",
    activeContacts: "Exportierte Kontakte",
    handle: "Handle",
    source: "Quelle",
    language: "Sprache",
    status: "Status",
    tags: "Tags",
    summary: "Zusammenfassung",
    notes: "Interne Notizen",
    created: "Angelegt",
    updated: "Aktualisiert",
    noContacts: "Keine Kontakte im Workspace vorhanden.",
    note: "Hinweis: Enthalten sind die in FanMind gespeicherten autorisierten Chats/Kommentare, eigenen Post-Caches, Metrik-Snapshots und Analyseprofile. Persönliche fremde Posts werden nicht gespiegelt. Secrets, Tokens, Sitzungsdaten, Stripe-IDs und Daten anderer Workspaces werden nicht exportiert.",
    page: "Seite",
    months: "Monate",
    subject: "Authentifizierte Datenauskunft für das eigene FanMind-Konto und den autorisierten Workspace.",
  },
  en: {
    title: "FanMind PDF data disclosure",
    partialTitle: "FanMind PDF data disclosure - Partial export",
    partialHeading: "Completeness not confirmed",
    partialNotice: "This PDF contains the data successfully retrieved. At least one optional data category is currently unavailable and is explicitly marked as not included. This does not mean that no data is stored there. For a complete disclosure, request the export again after the issue is resolved or contact FanMind support.",
    partialNote: "Note: Unavailable categories are identified in this partial export. Only authorized data is exported; secrets, tokens, session data, Stripe IDs and data from other workspaces are excluded.",
    generated: "Generated",
    account: "Account",
    userId: "User ID",
    email: "Email",
    name: "Name",
    workspace: "Workspace",
    workspaceId: "Workspace ID",
    plan: "Plan",
    commercialOption: "Contract option",
    billingStatus: "Billing status",
    setupFee: "Setup fee",
    monthlyFee: "Monthly fee",
    commitment: "Minimum term",
    organization: "Organization",
    address: "Address",
    vatId: "VAT ID",
    taxNumber: "Tax number",
    registerNumber: "Company register number",
    registerCourt: "Company register court",
    currentPeriodEnd: "Current period end",
    minimumTermEnd: "Minimum term end",
    cancellationRequested: "Cancellation requested on",
    effectiveEnd: "Effective contract end",
    accessMode: "Workspace access mode",
    contacts: "CRM contacts",
    activeContacts: "Exported contacts",
    handle: "Handle",
    source: "Source",
    language: "Language",
    status: "Status",
    tags: "Tags",
    summary: "Summary",
    notes: "Internal notes",
    created: "Created",
    updated: "Updated",
    noContacts: "No contacts are stored in this workspace.",
    note: "Note: This export includes authorized chats/comments, owned post caches, metric snapshots and analysis profiles stored in FanMind. Third-party personal posts are not mirrored. Secrets, tokens, session data, Stripe IDs and data from other workspaces are excluded.",
    page: "Page",
    months: "months",
    subject: "Authenticated data disclosure for the user's own FanMind account and authorized workspace.",
  },
} as const;

type DisclosureCopy = (typeof copy)[DataDisclosureLocale];
type DisclosureContact = DataDisclosurePdfInput["contacts"][number];

function isPartialDisclosure(input: DataDisclosurePdfInput): boolean {
  return (input.storedDataSections ?? []).some(section => Boolean(section.unavailableMessage));
}


function normalizeLine(value: string | null | undefined, fallback = "-"): string {
  const normalized = (value ?? "")
    .normalize("NFC")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function formatDate(
  value: Date | string | null | undefined,
  locale: DataDisclosureLocale,
): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return normalizeLine(String(value));
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "de-AT", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatMoney(
  cents: number | null | undefined,
  locale: DataDisclosureLocale,
): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "-";
  return new Intl.NumberFormat(locale === "en" ? "en-GB" : "de-AT", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function fieldLine(
  label: string,
  value: string | null | undefined,
  fallback = "-",
): string {
  return `${label}: ${normalizeLine(value, fallback)}`;
}

function optionalFieldLine(
  label: string,
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  return fieldLine(label, value);
}

function compact(values: Array<string | null>): string[] {
  return values.filter((value): value is string => Boolean(value));
}

function buildAccountFieldLines(
  input: DataDisclosurePdfInput,
  text: DisclosureCopy,
): string[] {
  return [
    fieldLine(text.userId, input.user.id),
    fieldLine(text.email, input.user.email),
    fieldLine(text.name, input.user.displayName),
  ];
}

function buildWorkspaceFieldLines(
  input: DataDisclosurePdfInput,
  text: DisclosureCopy,
  locale: DataDisclosureLocale,
): string[] {
  const address = [
    input.workspace.streetAddress,
    [input.workspace.postalCode, input.workspace.city].filter(Boolean).join(" "),
    input.workspace.country,
  ]
    .filter((value) => typeof value === "string" && value.trim())
    .join(", ");

  return compact([
    fieldLine(text.workspaceId, input.workspace.id),
    fieldLine(text.name, input.workspace.name),
    fieldLine(text.plan, input.workspace.planId),
    fieldLine(text.commercialOption, input.workspace.commercialOption),
    fieldLine(text.billingStatus, input.workspace.billingStatus),
    fieldLine(text.setupFee, formatMoney(input.workspace.setupFeeCents, locale)),
    fieldLine(text.monthlyFee, formatMoney(input.workspace.monthlyFeeCents, locale)),
    fieldLine(
      text.commitment,
      typeof input.workspace.commitmentMonths === "number"
        ? `${input.workspace.commitmentMonths} ${text.months}`
        : "-",
    ),
    optionalFieldLine(text.organization, input.workspace.organizationName),
    optionalFieldLine(text.address, address),
    optionalFieldLine(text.vatId, input.workspace.vatId),
    optionalFieldLine(text.taxNumber, input.workspace.taxNumber),
    optionalFieldLine(text.registerNumber, input.workspace.companyRegisterNumber),
    optionalFieldLine(text.registerCourt, input.workspace.companyRegisterCourt),
    optionalFieldLine(
      text.currentPeriodEnd,
      input.workspace.billingCurrentPeriodEndAt
        ? formatDate(input.workspace.billingCurrentPeriodEndAt, locale)
        : null,
    ),
    optionalFieldLine(
      text.minimumTermEnd,
      input.workspace.billingMinimumTermEndsAt
        ? formatDate(input.workspace.billingMinimumTermEndsAt, locale)
        : null,
    ),
    optionalFieldLine(
      text.cancellationRequested,
      input.workspace.subscriptionCancelRequestedAt
        ? formatDate(input.workspace.subscriptionCancelRequestedAt, locale)
        : null,
    ),
    optionalFieldLine(
      text.effectiveEnd,
      input.workspace.subscriptionEffectiveEndAt
        ? formatDate(input.workspace.subscriptionEffectiveEndAt, locale)
        : null,
    ),
    optionalFieldLine(text.accessMode, input.workspace.workspaceAccessMode),
  ]);
}

function buildContactFieldLines(
  contact: DisclosureContact,
  text: DisclosureCopy,
  locale: DataDisclosureLocale,
): string[] {
  return compact([
    optionalFieldLine(text.handle, contact.handle),
    optionalFieldLine(text.source, contact.sourcePlatform),
    optionalFieldLine(text.language, contact.language),
    optionalFieldLine(text.status, contact.status),
    contact.tags?.length ? fieldLine(text.tags, contact.tags.join(", ")) : null,
    optionalFieldLine(text.summary, contact.summary),
    optionalFieldLine(text.notes, contact.internalNotes),
    contact.createdAt
      ? fieldLine(text.created, formatDate(contact.createdAt, locale))
      : null,
    contact.updatedAt
      ? fieldLine(text.updated, formatDate(contact.updatedAt, locale))
      : null,
  ]);
}

export function buildDataDisclosurePdfLines(
  input: DataDisclosurePdfInput,
): string[] {
  const locale: DataDisclosureLocale = input.locale === "en" ? "en" : "de";
  const text = copy[locale];
  const lines = [
    isPartialDisclosure(input) ? text.partialTitle : text.title,
    `${text.generated}: ${formatDate(input.generatedAt, locale)}`,
    ...(isPartialDisclosure(input) ? [text.partialHeading, text.partialNotice] : []),
    "",
    text.account,
    ...buildAccountFieldLines(input, text),
    "",
    text.workspace,
    ...buildWorkspaceFieldLines(input, text, locale),
    "",
    text.contacts,
    `${text.activeContacts}: ${input.contacts.length}`,
  ];

  if (!input.contacts.length) lines.push(text.noContacts);

  input.contacts.forEach((contact, index) => {
    lines.push(
      "",
      `${index + 1}. ${normalizeLine(contact.displayName)}`,
      ...buildContactFieldLines(contact, text, locale),
    );
  });

  for (const section of input.storedDataSections ?? []) {
    lines.push("", normalizeLine(section.title));
    if (section.unavailableMessage) {
      if (section.entries.length) throw new Error("Conflicting disclosure section status");
      lines.push(normalizeLine(section.unavailableMessage));
      continue;
    }
    lines.push(`${normalizeLine(section.countLabel)}: ${section.entries.length}`);
    if (!section.entries.length) lines.push(normalizeLine(section.emptyMessage));
    section.entries.forEach((entry, index) => {
      lines.push(
        "",
        `${index + 1}. ${normalizeLine(entry.title)}`,
        ...entry.fields.map((field) => normalizeLine(field)),
      );
    });
  }

  lines.push("", isPartialDisclosure(input) ? text.partialNote : text.note);
  return lines;
}

function buildDataDisclosureBlocks(
  input: DataDisclosurePdfInput,
  locale: DataDisclosureLocale,
  text: DisclosureCopy,
): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];
  if (isPartialDisclosure(input)) {
    blocks.push(
      { type: "heading", text: text.partialHeading, level: 2 },
      { type: "paragraph", text: text.partialNotice, fontSize: 10, lineHeight: 14 },
      { type: "spacer", height: 8 },
    );
  }
  blocks.push(
    {
      type: "paragraph",
      text: `${text.generated}: ${formatDate(input.generatedAt, locale)}`,
      fontSize: 9,
      lineHeight: 12,
    },
    { type: "spacer", height: 8 },
    { type: "heading", text: text.account, level: 2 },
    {
      type: "list",
      items: buildAccountFieldLines(input, text),
      style: "bullet",
      fontSize: 9,
    },
    { type: "spacer", height: 6 },
    { type: "heading", text: text.workspace, level: 2 },
    {
      type: "list",
      items: buildWorkspaceFieldLines(input, text, locale),
      style: "bullet",
      fontSize: 9,
    },
    { type: "spacer", height: 6 },
    { type: "heading", text: text.contacts, level: 2 },
    {
      type: "paragraph",
      text: `${text.activeContacts}: ${input.contacts.length}`,
      fontSize: 9,
      lineHeight: 12,
    },
  );

  if (!input.contacts.length) {
    blocks.push({
      type: "paragraph",
      text: text.noContacts,
      fontSize: 9,
      lineHeight: 12,
    });
  }

  input.contacts.forEach((contact, index) => {
    blocks.push({
      type: "heading",
      text: `${index + 1}. ${normalizeLine(contact.displayName)}`,
      level: 3,
    });
    const contactFields = buildContactFieldLines(contact, text, locale);
    if (contactFields.length) {
      blocks.push({
        type: "list",
        items: contactFields,
        style: "bullet",
        fontSize: 9,
      });
    }
  });

  for (const section of input.storedDataSections ?? []) {
    blocks.push(
      { type: "spacer", height: 6 },
      { type: "heading", text: normalizeLine(section.title), level: 2 },
    );
    if (section.unavailableMessage) {
      if (section.entries.length) throw new Error("Conflicting disclosure section status");
      blocks.push({
        type: "paragraph", text: normalizeLine(section.unavailableMessage),
        fontSize: 9, lineHeight: 12,
      });
      continue;
    }
    blocks.push({
        type: "paragraph",
        text: `${normalizeLine(section.countLabel)}: ${section.entries.length}`,
        fontSize: 9,
        lineHeight: 12,
      },
    );
    if (!section.entries.length) {
      blocks.push({
        type: "paragraph",
        text: normalizeLine(section.emptyMessage),
        fontSize: 9,
        lineHeight: 12,
      });
    }
    section.entries.forEach((entry, index) => {
      blocks.push({
        type: "heading",
        text: `${index + 1}. ${normalizeLine(entry.title)}`,
        level: 3,
      });
      if (entry.fields.length) {
        blocks.push({
          type: "list",
          items: entry.fields.map((field) => normalizeLine(field)),
          style: "bullet",
          fontSize: 9,
        });
      }
    });
  }

  blocks.push(
    { type: "spacer", height: 8 },
    {
      type: "paragraph",
      text: isPartialDisclosure(input) ? text.partialNote : text.note,
      fontSize: 8,
      lineHeight: 11,
    },
  );
  return blocks;
}

const asFontLoader = (loader: () => Promise<unknown>): FontLoader =>
  loader as FontLoader;

const DATA_DISCLOSURE_FONT_LOADERS = {
  latin: asFontLoader(() => import("pdfnative/fonts/noto-sans-data.js")),
  th: asFontLoader(() => import("pdfnative/fonts/noto-thai-data.js")),
  ja: asFontLoader(() => import("pdfnative/fonts/noto-jp-data.js")),
  zh: asFontLoader(() => import("pdfnative/fonts/noto-sc-data.js")),
  ko: asFontLoader(() => import("pdfnative/fonts/noto-kr-data.js")),
  el: asFontLoader(() => import("pdfnative/fonts/noto-greek-data.js")),
  hi: asFontLoader(() => import("pdfnative/fonts/noto-devanagari-data.js")),
  tr: asFontLoader(() => import("pdfnative/fonts/noto-turkish-data.js")),
  vi: asFontLoader(() => import("pdfnative/fonts/noto-vietnamese-data.js")),
  pl: asFontLoader(() => import("pdfnative/fonts/noto-polish-data.js")),
  ar: asFontLoader(() => import("pdfnative/fonts/noto-arabic-data.js")),
  he: asFontLoader(() => import("pdfnative/fonts/noto-hebrew-data.js")),
  ru: asFontLoader(() => import("pdfnative/fonts/noto-cyrillic-data.js")),
  ka: asFontLoader(() => import("pdfnative/fonts/noto-georgian-data.js")),
  hy: asFontLoader(() => import("pdfnative/fonts/noto-armenian-data.js")),
  bn: asFontLoader(() => import("pdfnative/fonts/noto-bengali-data.js")),
  ta: asFontLoader(() => import("pdfnative/fonts/noto-tamil-data.js")),
  te: asFontLoader(() => import("pdfnative/fonts/noto-telugu-data.js")),
  am: asFontLoader(() => import("pdfnative/fonts/noto-ethiopic-data.js")),
  si: asFontLoader(() => import("pdfnative/fonts/noto-sinhala-data.js")),
  bo: asFontLoader(() => import("pdfnative/fonts/noto-tibetan-data.js")),
  km: asFontLoader(() => import("pdfnative/fonts/noto-khmer-data.js")),
  my: asFontLoader(() => import("pdfnative/fonts/noto-myanmar-data.js")),
  math: asFontLoader(() => import("pdfnative/fonts/noto-sans-math-data.js")),
  emoji: asFontLoader(() => import("pdfnative/fonts/noto-emoji-data.js")),
} satisfies Record<string, FontLoader>;

type DataDisclosureFontLanguage = keyof typeof DATA_DISCLOSURE_FONT_LOADERS;

const DATA_DISCLOSURE_FONT_ORDER: DataDisclosureFontLanguage[] = [
  "latin",
  "th",
  "ja",
  "zh",
  "ko",
  "el",
  "hi",
  "tr",
  "vi",
  "pl",
  "ar",
  "he",
  "ru",
  "ka",
  "hy",
  "bn",
  "ta",
  "te",
  "am",
  "si",
  "bo",
  "km",
  "my",
  "math",
  "emoji",
];

const SCRIPT_PATTERNS: Partial<
  Record<DataDisclosureFontLanguage, RegExp>
> = {
  th: /[\u0E00-\u0E7F]/u,
  ja: /[\u3040-\u30FF]/u,
  zh: /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/u,
  ko: /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/u,
  el: /[\u0370-\u03FF\u1F00-\u1FFF]/u,
  hi: /[\u0900-\u097F\uA8E0-\uA8FF]/u,
  tr: /[ĞğİıŞş₺]/u,
  vi: /[\u1E00-\u1EFFĂăÂâĐđÊêÔôƠơƯư]/u,
  pl: /[ĄąĆćĘęŁłŃńŚśŹźŻż]/u,
  ar: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/u,
  he: /[\u0590-\u05FF]/u,
  ru: /[\u0400-\u052F]/u,
  ka: /[\u10A0-\u10FF\u2D00-\u2D2F]/u,
  hy: /[\u0530-\u058F\uFB13-\uFB17]/u,
  bn: /[\u0980-\u09FF]/u,
  ta: /[\u0B80-\u0BFF]/u,
  te: /[\u0C00-\u0C7F]/u,
  am: /[\u1200-\u137F\u1380-\u139F\u2D80-\u2DDF]/u,
  si: /[\u0D80-\u0DFF]/u,
  bo: /[\u0F00-\u0FFF]/u,
  km: /[\u1780-\u17FF\u19E0-\u19FF]/u,
  my: /[\u1000-\u109F\uAA60-\uAA7F\uA9E0-\uA9FF]/u,
  math: /[\u2200-\u22FF\u27C0-\u27EF\u2980-\u29FF\u2A00-\u2AFF]/u,
  emoji: /\p{Extended_Pictographic}/u,
};

let disclosureFontsRegistered = false;

function registerDataDisclosureFonts(): void {
  if (disclosureFontsRegistered) return;
  registerFonts(DATA_DISCLOSURE_FONT_LOADERS);
  disclosureFontsRegistered = true;
}

function detectDataDisclosureLanguages(
  texts: string[],
): DataDisclosureFontLanguage[] {
  const detected = detectFallbackLangs(texts, "latin");
  const combined = texts.join("\n");

  for (const [language, pattern] of Object.entries(SCRIPT_PATTERNS) as Array<
    [DataDisclosureFontLanguage, RegExp]
  >) {
    if (pattern.test(combined)) detected.add(language);
  }

  return DATA_DISCLOSURE_FONT_ORDER.filter(
    (language) => language === "latin" || detected.has(language),
  );
}

async function loadDataDisclosureFontEntries(
  texts: string[],
): Promise<FontEntry[]> {
  registerDataDisclosureFonts();
  const languages = detectDataDisclosureLanguages(texts);
  const entries: FontEntry[] = [];

  for (const language of languages) {
    const fontData = await loadFontData(language);
    if (!fontData) {
      throw new Error(
        `PDF-Datenauskunft konnte nicht erstellt werden: Unicode-Schrift ${language} fehlt.`,
      );
    }
    entries.push({
      fontData,
      fontRef: `/F${3 + entries.length}`,
      lang: language,
    });
  }

  return entries;
}

export async function createDataDisclosurePdf(
  input: DataDisclosurePdfInput,
): Promise<Uint8Array> {
  const locale: DataDisclosureLocale = input.locale === "en" ? "en" : "de";
  const text = copy[locale];
  const lines = buildDataDisclosurePdfLines(input);
  const blocks = buildDataDisclosureBlocks(input, locale, text);
  const fontEntries = await loadDataDisclosureFontEntries(lines);

  await initNodeCompression();

  return buildDocumentPDFBytes(
    {
      title: isPartialDisclosure(input) ? text.partialTitle : text.title,
      blocks,
      fontEntries,
      metadata: {
        author: "FanMind",
        subject: text.subject,
        keywords: "FanMind, data disclosure, GDPR, DSGVO, CRM",
      },
    },
    {
      tagged: "pdfa2u",
      normalize: "NFC",
      compress: true,
      creationDate: input.generatedAt,
      margins: { t: 50, r: 50, b: 58, l: 50 },
      maxBlocks: Math.max(100_000, blocks.length + 100),
      footerTemplate: {
        left: "FanMind",
        right: `${text.page} {page} / {pages}`,
        fontSize: 8,
      },
      viewerPreferences: {
        pageLayout: "oneColumn",
        displayDocTitle: true,
      },
    },
  );
}

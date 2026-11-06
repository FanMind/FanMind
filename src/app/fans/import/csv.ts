export type PlatformValue =
  | "whatsapp"
  | "instagram"
  | "tiktok"
  | "facebook"
  | "x"
  | "discord"
  | "telegram"
  | "email"
  | "onlyfans"
  | "manual";

export const PLATFORM_OPTIONS: Array<{
  value: PlatformValue;
  label: string;
  shortLabel: string;
}> = [
  { value: "whatsapp", label: "WhatsApp", shortLabel: "WA" },
  { value: "instagram", label: "Instagram", shortLabel: "IG" },
  { value: "tiktok", label: "TikTok", shortLabel: "TT" },
  { value: "facebook", label: "Facebook", shortLabel: "FB" },
  { value: "x", label: "X / Twitter", shortLabel: "X" },
  { value: "discord", label: "Discord", shortLabel: "DC" },
  { value: "telegram", label: "Telegram", shortLabel: "TG" },
  { value: "email", label: "E-Mail", shortLabel: "@" },
  { value: "onlyfans", label: "OnlyFans", shortLabel: "OF" },
  { value: "manual", label: "Manuell", shortLabel: "M" },
];

const PLATFORM_ALIAS_MAP: Record<string, PlatformValue> = {
  whatsapp: "whatsapp",
  whats_app: "whatsapp",
  instagram: "instagram",
  instagram_messages: "instagram",
  instagram_comments: "instagram",
  insta: "instagram",
  ig: "instagram",
  tiktok: "tiktok",
  tik_tok: "tiktok",
  facebook: "facebook",
  fb: "facebook",
  twitter: "x",
  x: "x",
  x_com: "x",
  discord: "discord",
  telegram: "telegram",
  tg: "telegram",
  telegram_messages: "telegram",
  mail: "email",
  e_mail: "email",
  email: "email",
  onlyfans: "onlyfans",
  only_fans: "onlyfans",
  manual: "manual",
  manuell: "manual",
  other: "manual",
  sonstiges: "manual",
};

export const CSV_IMPORT_LIMITS = Object.freeze({
  maxBytes: 1_000_000,
  maxDataRows: 1_000,
  maxColumns: 32,
  maxFieldCharacters: 8_000,
});

const ALLOWED_LANGUAGES = new Set(["de", "en", "fr"]);
const ALLOWED_CONTACT_STATUSES = new Set([
  "new",
  "active",
  "warm",
  "follow_up",
  "paused",
  "vip",
  "buyer",
  "inactive",
  "do_not_push",
]);

function getPlatformKey(value: string | null | undefined): string {
  return (
    value
      ?.trim()
      .toLowerCase()
      .replace(/@/g, "email")
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") ?? ""
  );
}

function normalizeKnownPlatform(
  value: string | null | undefined,
): PlatformValue | null {
  const key = getPlatformKey(value);
  return key ? (PLATFORM_ALIAS_MAP[key] ?? null) : null;
}

export function normalizePlatform(
  value: string | null | undefined,
): PlatformValue {
  return normalizeKnownPlatform(value) ?? "manual";
}

export function formatPlatformLabel(value: string | null | undefined): string {
  const platform = normalizePlatform(value);

  return (
    PLATFORM_OPTIONS.find((option) => option.value === platform)?.label ??
    "Manuell"
  );
}

export function getPlatformShortLabel(
  value: string | null | undefined,
): string {
  const platform = normalizePlatform(value);

  return (
    PLATFORM_OPTIONS.find((option) => option.value === platform)?.shortLabel ??
    "M"
  );
}

export type CsvContactDraft = {
  displayName: string;
  handle: string;
  sourcePlatform: string;
  language: string;
  status: string;
  tags: string[];
  summary: string;
};

export type CsvParseResult = {
  contacts: CsvContactDraft[];
  errors: string[];
  delimiter: "," | ";";
};

const HEADER_ALIASES: Record<string, keyof CsvContactDraft> = {
  name: "displayName",
  display_name: "displayName",
  handle: "handle",
  platform: "sourcePlatform",
  source_platform: "sourcePlatform",
  language: "language",
  status: "status",
  tags: "tags",
  summary: "summary",
};

export function parseCsvContacts(
  csvText: string,
  defaultSourcePlatform: string = "manual",
): CsvParseResult {
  if (exceedsUtf8ByteLimit(csvText, CSV_IMPORT_LIMITS.maxBytes)) {
    return {
      contacts: [],
      errors: [
        `CSV überschreitet die maximale Größe von ${CSV_IMPORT_LIMITS.maxBytes.toLocaleString("de-DE")} Bytes.`,
      ],
      delimiter: ",",
    };
  }

  const normalizedText = csvText.replace(/^\uFEFF/, "").trim();
  const delimiter = detectDelimiter(normalizedText);

  if (!normalizedText) {
    return { contacts: [], errors: ["CSV-Text ist leer."], delimiter };
  }

  const parsedRows = parseRows(normalizedText, delimiter);
  if (parsedRows.error) {
    return { contacts: [], errors: [parsedRows.error], delimiter };
  }

  const rows = parsedRows.rows.filter((row) =>
    row.some((cell) => cell.trim().length > 0),
  );

  if (rows.length < 2) {
    return {
      contacts: [],
      errors: ["CSV benötigt eine Kopfzeile und mindestens eine Kontaktzeile."],
      delimiter,
    };
  }

  const headers = rows[0].map((header) => normalizeHeader(header));
  const mappedHeaders = headers.map((header) => HEADER_ALIASES[header] ?? null);
  const errors: string[] = [];

  if (!mappedHeaders.includes("displayName")) {
    errors.push("Spalte name oder display_name fehlt.");
  }

  const defaultPlatform = normalizeKnownPlatform(defaultSourcePlatform);
  if (!mappedHeaders.includes("sourcePlatform") && !defaultPlatform) {
    return {
      contacts: [],
      errors: ["Die Standardplattform wird nicht unterstützt."],
      delimiter,
    };
  }

  const contacts = rows.slice(1).flatMap((row, rowIndex) => {
    const raw: Partial<CsvContactDraft> = {};

    row.forEach((cell, cellIndex) => {
      const target = mappedHeaders[cellIndex];

      if (!target) {
        return;
      }

      if (target === "tags") {
        raw.tags = parseTags(cell);
      } else {
        raw[target] = cell.trim() as never;
      }
    });

    const displayName = (raw.displayName ?? "").trim();

    if (!displayName) {
      errors.push(`Zeile ${rowIndex + 2}: Name fehlt, Zeile übersprungen.`);
      return [];
    }

    const platformInput = raw.sourcePlatform?.trim() || defaultSourcePlatform;
    const sourcePlatform = normalizeKnownPlatform(platformInput);
    if (!sourcePlatform) {
      errors.push(
        `Zeile ${rowIndex + 2}: Plattform "${platformInput}" wird nicht unterstützt, Zeile übersprungen.`,
      );
      return [];
    }

    const language = normalizeAllowedValue(raw.language, "de");
    if (!ALLOWED_LANGUAGES.has(language)) {
      errors.push(
        `Zeile ${rowIndex + 2}: Sprache "${language}" wird nicht unterstützt, Zeile übersprungen.`,
      );
      return [];
    }

    const status = normalizeAllowedValue(raw.status, "new");
    if (!ALLOWED_CONTACT_STATUSES.has(status)) {
      errors.push(
        `Zeile ${rowIndex + 2}: Status "${status}" wird nicht unterstützt, Zeile übersprungen.`,
      );
      return [];
    }

    return [
      {
        displayName,
        handle: (raw.handle ?? "").trim(),
        sourcePlatform,
        language,
        status,
        tags: raw.tags ?? [],
        summary: (raw.summary ?? "").trim(),
      },
    ];
  });

  return { contacts, errors, delimiter };
}

function exceedsUtf8ByteLimit(value: string, maxBytes: number): boolean {
  if (value.length > maxBytes) {
    return true;
  }

  return new TextEncoder().encode(value).byteLength > maxBytes;
}

export function getDuplicateKey(
  handle: string | null | undefined,
  sourcePlatform: string | null | undefined,
): string | null {
  const normalizedHandle = handle?.trim().toLowerCase();

  if (!normalizedHandle) {
    return null;
  }

  return `${normalizePlatform(sourcePlatform)}::${normalizedHandle}`;
}

function detectDelimiter(csvText: string): "," | ";" {
  const firstLine = csvText.split(/\r?\n/, 1)[0] ?? "";
  const semicolonCount = countOutsideQuotes(firstLine, ";");
  const commaCount = countOutsideQuotes(firstLine, ",");

  return semicolonCount > commaCount ? ";" : ",";
}

type ParsedRows = { rows: string[][]; error: string | null };

function parseRows(csvText: string, delimiter: "," | ";"): ParsedRows {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let quotedFieldClosed = false;

  const appendToCell = (value: string): string | null => {
    cell += value;
    return cell.length > CSV_IMPORT_LIMITS.maxFieldCharacters
      ? `CSV-Feld überschreitet maximal ${CSV_IMPORT_LIMITS.maxFieldCharacters.toLocaleString("de-DE")} Zeichen.`
      : null;
  };

  const pushCell = (): string | null => {
    if (row.length >= CSV_IMPORT_LIMITS.maxColumns) {
      return `CSV-Zeile überschreitet maximal ${CSV_IMPORT_LIMITS.maxColumns} Spalten.`;
    }
    row.push(cell);
    cell = "";
    quotedFieldClosed = false;
    return null;
  };

  const pushRow = (): string | null => {
    const cellError = pushCell();
    if (cellError) return cellError;
    rows.push(row);
    row = [];
    return rows.length > CSV_IMPORT_LIMITS.maxDataRows + 1
      ? `CSV überschreitet maximal ${CSV_IMPORT_LIMITS.maxDataRows.toLocaleString("de-DE")} Kontaktzeilen.`
      : null;
  };

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const nextChar = csvText[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        const fieldError = appendToCell('"');
        if (fieldError) return { rows: [], error: fieldError };
        index += 1;
      } else if (inQuotes) {
        inQuotes = false;
        quotedFieldClosed = true;
      } else if (cell.length === 0 && !quotedFieldClosed) {
        inQuotes = true;
      } else {
        return {
          rows: [],
          error: `CSV enthält ein ungültiges Anführungszeichen an Zeichen ${index + 1}.`,
        };
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      const cellError = pushCell();
      if (cellError) return { rows: [], error: cellError };
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      const rowError = pushRow();
      if (rowError) return { rows: [], error: rowError };
      continue;
    }

    if (quotedFieldClosed) {
      return {
        rows: [],
        error: `CSV enthält unerwartete Zeichen nach einem geschlossenen Feld an Zeichen ${index + 1}.`,
      };
    }

    const fieldError = appendToCell(char);
    if (fieldError) return { rows: [], error: fieldError };
  }

  if (inQuotes) {
    return {
      rows: [],
      error: "CSV enthält ein nicht geschlossenes Anführungszeichen.",
    };
  }

  if (cell.length > 0 || row.length > 0 || rows.length === 0) {
    const rowError = pushRow();
    if (rowError) return { rows: [], error: rowError };
  }

  return { rows, error: null };
}

function normalizeHeader(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function normalizeAllowedValue(
  value: string | null | undefined,
  fallback: string,
): string {
  const normalized = value?.trim().toLowerCase();

  return normalized ? normalized : fallback;
}

function parseTags(value: string): string[] {
  return value
    .split(";")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function countOutsideQuotes(value: string, needle: "," | ";"): number {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const nextChar = value[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === needle && !inQuotes) {
      count += 1;
    }
  }

  return count;
}

export function csvHasPlatformColumn(csvText: string): boolean {
  const normalizedText = csvText.replace(/^\uFEFF/, "").trim();

  if (!normalizedText) {
    return false;
  }

  const delimiter = detectDelimiter(normalizedText);
  const parsedRows = parseRows(normalizedText, delimiter);
  if (parsedRows.error) {
    return false;
  }
  const [headerRow] = parsedRows.rows;

  return headerRow
    .map((header) => normalizeHeader(header))
    .some((header) => header === "platform" || header === "source_platform");
}

export function withDefaultSourcePlatform(
  csvText: string,
  defaultSourcePlatform: string,
): string {
  const normalizedText = csvText.replace(/^\uFEFF/, "").trim();

  if (!normalizedText || csvHasPlatformColumn(normalizedText)) {
    return csvText;
  }

  const delimiter = detectDelimiter(normalizedText);
  const parsedRows = parseRows(normalizedText, delimiter);
  if (parsedRows.error) {
    return csvText;
  }
  const rows = parsedRows.rows;
  const normalizedPlatform = normalizePlatform(defaultSourcePlatform);
  const serializedRows = rows.map((row, index) => [
    ...row,
    index === 0 ? "source_platform" : normalizedPlatform,
  ]);

  return serializedRows
    .map((row) =>
      row.map((cell) => serializeCell(cell, delimiter)).join(delimiter),
    )
    .join("\n");
}

function serializeCell(value: string, delimiter: "," | ";"): string {
  if (!value.includes(delimiter) && !/["\r\n]/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

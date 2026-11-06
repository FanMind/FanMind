const CONTACT_STATUS_VALUES = Object.freeze([
  "new",
  "warm",
  "buyer",
  "vip",
  "inactive",
]);
const CONTACT_LANGUAGE_PATTERN = /^[a-z]{2}(?:-[a-z0-9]{2,8})?$/u;
const MAX_CONTACT_NAME_LENGTH = 160;
const MAX_CONTACT_HANDLE_LENGTH = 160;
const MAX_CONTACT_PLATFORM_LENGTH = 80;
const MAX_CONTACT_LANGUAGE_LENGTH = 12;
const MAX_CONTACT_TAGS = 20;
const MAX_CONTACT_TAG_LENGTH = 50;
const MAX_CONTACT_SUMMARY_LENGTH = 2000;
const MAX_CONTACT_NOTES_LENGTH = 4000;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value) {
  const normalized = clean(value);
  return normalized || null;
}

function normalizeHandle(value) {
  const normalized = clean(value).replace(/\s+/g, "");
  return normalized || null;
}

function normalizeTags(value) {
  const source = Array.isArray(value) ? value.join(";") : clean(value);
  const tags = source
    .split(/[;,]/u)
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(tags)];
}

function normalizeContactDraft(input = {}) {
  const displayName = clean(input.displayName ?? input.display_name);
  const handle = normalizeHandle(input.handle);
  const sourcePlatform = clean(input.sourcePlatform ?? input.source_platform).toLowerCase() || "manual";
  const language = clean(input.language).toLowerCase() || "de";
  const status = clean(input.status).toLowerCase() || "new";
  const tags = normalizeTags(input.tags);
  const summary = nullable(input.summary);
  const internalNotes = nullable(input.internalNotes ?? input.internal_notes);
  const errors = [];

  if (!displayName || displayName.length > MAX_CONTACT_NAME_LENGTH) {
    errors.push("display_name");
  }
  if (handle && handle.length > MAX_CONTACT_HANDLE_LENGTH) {
    errors.push("handle");
  }
  if (
    sourcePlatform.length > MAX_CONTACT_PLATFORM_LENGTH ||
    !/^[a-z0-9][a-z0-9_. -]*$/u.test(sourcePlatform)
  ) {
    errors.push("source_platform");
  }
  if (
    language.length > MAX_CONTACT_LANGUAGE_LENGTH ||
    !CONTACT_LANGUAGE_PATTERN.test(language)
  ) {
    errors.push("language");
  }
  if (!CONTACT_STATUS_VALUES.includes(status)) {
    errors.push("status");
  }
  if (
    tags.length > MAX_CONTACT_TAGS ||
    tags.some((tag) => tag.length > MAX_CONTACT_TAG_LENGTH)
  ) {
    errors.push("tags");
  }
  if (summary && summary.length > MAX_CONTACT_SUMMARY_LENGTH) {
    errors.push("summary");
  }
  if (internalNotes && internalNotes.length > MAX_CONTACT_NOTES_LENGTH) {
    errors.push("internal_notes");
  }

  return {
    ok: errors.length === 0,
    errors,
    value:
      errors.length === 0
        ? {
            display_name: displayName,
            handle,
            source_platform: sourcePlatform,
            language,
            status,
            tags,
            summary,
            internal_notes: internalNotes,
          }
        : null,
  };
}

function contactToDraft(contact = {}) {
  return {
    displayName: clean(contact.display_name),
    handle: clean(contact.handle),
    sourcePlatform: clean(contact.source_platform) || "manual",
    language: clean(contact.language) || "de",
    status: clean(contact.status) || "new",
    tags: Array.isArray(contact.tags) ? contact.tags.join("; ") : "",
    summary: clean(contact.summary),
    internalNotes: clean(contact.internal_notes),
  };
}

function emptyContactDraft() {
  return {
    displayName: "",
    handle: "",
    sourcePlatform: "manual",
    language: "de",
    status: "new",
    tags: "",
    summary: "",
    internalNotes: "",
  };
}

export {
  CONTACT_STATUS_VALUES,
  MAX_CONTACT_HANDLE_LENGTH,
  MAX_CONTACT_LANGUAGE_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_CONTACT_NOTES_LENGTH,
  MAX_CONTACT_PLATFORM_LENGTH,
  MAX_CONTACT_SUMMARY_LENGTH,
  MAX_CONTACT_TAG_LENGTH,
  MAX_CONTACT_TAGS,
  contactToDraft,
  emptyContactDraft,
  normalizeContactDraft,
  normalizeTags,
};

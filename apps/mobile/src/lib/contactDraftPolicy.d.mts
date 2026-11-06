export const CONTACT_STATUS_VALUES: readonly [
  "new",
  "warm",
  "buyer",
  "vip",
  "inactive",
];

export type ContactDraft = {
  displayName: string;
  handle: string;
  sourcePlatform: string;
  language: string;
  status: string;
  tags: string;
  summary: string;
  internalNotes: string;
};

export type NormalizedContactDraft = {
  display_name: string;
  handle: string | null;
  source_platform: string;
  language: string;
  status: string;
  tags: string[];
  summary: string | null;
  internal_notes: string | null;
};

export const MAX_CONTACT_NAME_LENGTH: number;
export const MAX_CONTACT_HANDLE_LENGTH: number;
export const MAX_CONTACT_PLATFORM_LENGTH: number;
export const MAX_CONTACT_LANGUAGE_LENGTH: number;
export const MAX_CONTACT_TAGS: number;
export const MAX_CONTACT_TAG_LENGTH: number;
export const MAX_CONTACT_SUMMARY_LENGTH: number;
export const MAX_CONTACT_NOTES_LENGTH: number;

export function normalizeContactDraft(input: Partial<ContactDraft> | Record<string, unknown>): {
  ok: boolean;
  errors: string[];
  value: NormalizedContactDraft | null;
};
export function contactToDraft(contact: Record<string, unknown>): ContactDraft;
export function emptyContactDraft(): ContactDraft;
export function normalizeTags(value: unknown): string[];

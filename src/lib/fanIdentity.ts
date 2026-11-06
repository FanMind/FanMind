import { type ContactRow } from "@/lib/supabase/server";

export function normalizeFanIdentity(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function getContactGroupIdentity(contact: ContactRow): string | null {
  const value = (contact as ContactRow & { group_identity?: string | null }).group_identity;
  const normalized = normalizeFanIdentity(value);

  return normalized ? `group:${normalized}` : null;
}

export function getFanGroupKey(contact: ContactRow): string {
  const groupIdentity = getContactGroupIdentity(contact);

  if (groupIdentity) {
    return groupIdentity;
  }

  const nameKey = normalizeFanIdentity(contact.display_name);
  const handleKey = normalizeFanIdentity(contact.handle);

  if (nameKey && handleKey) {
    return `name-handle:${nameKey}:${handleKey}`;
  }

  if (handleKey) {
    return `handle:${handleKey}`;
  }

  if (nameKey) {
    return `name:${nameKey}`;
  }

  return `contact:${contact.id}`;
}

export function countUniqueFans(contacts: ContactRow[]): number {
  return new Set(contacts.map(getFanGroupKey)).size;
}

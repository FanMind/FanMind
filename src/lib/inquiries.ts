import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import type { SupabaseServerUser } from "@/lib/supabase/server";

export type InquiryStatus = "new" | "contacted" | "archived";

export type PilotInquiry = {
  id: string;
  email: string;
  name: string | null;
  message: string | null;
  source: string;
  status: InquiryStatus;
  created_at: string | null;
  updated_at: string | null;
  handled_at: string | null;
  handled_by: string | null;
};

export type CreateInquiryInput = {
  email: string;
  name?: string | null;
  message?: string | null;
  source?: string;
};

const INQUIRY_COLUMNS = "id,email,name,message,source,status,created_at,updated_at,handled_at,handled_by";
const VALID_STATUSES = new Set<InquiryStatus>(["new", "contacted", "archived"]);

function serviceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function normalizeInquiryText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function isValidInquiryEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
}

export async function createPilotInquiry(input: CreateInquiryInput): Promise<{ inquiry: PilotInquiry | null; error: string | null }> {
  const key = serviceKey();
  if (!key) return { inquiry: null, error: "Anfrage konnte nicht gespeichert werden." };

  const email = input.email.trim().toLowerCase();
  if (!isValidInquiryEmail(email)) return { inquiry: null, error: "Ungültige E-Mail-Adresse." };

  const body = {
    email,
    name: normalizeInquiryText(input.name, 120),
    message: normalizeInquiryText(input.message, 2000),
    source: normalizeInquiryText(input.source, 80) ?? "landing_footer",
    status: "new" satisfies InquiryStatus,
  };

  const url = new URL(getSupabaseRestUrl("pilot_inquiries"));
  url.searchParams.set("select", INQUIRY_COLUMNS);
  const response = await fetch(url, {
    method: "POST",
    headers: { ...getSupabaseHeaders(key), Prefer: "return=representation" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) return { inquiry: null, error: "Anfrage konnte nicht gespeichert werden." };
  const rows = (await response.json()) as PilotInquiry[];
  return { inquiry: rows[0] ?? null, error: null };
}

export async function listPilotInquiries(): Promise<{ inquiries: PilotInquiry[]; error: string | null }> {
  const key = serviceKey();
  if (!key) return { inquiries: [], error: "FanMind-Anfragen sind momentan nicht verfügbar." };

  const url = new URL(getSupabaseRestUrl("pilot_inquiries"));
  url.searchParams.set("select", INQUIRY_COLUMNS);
  url.searchParams.set("order", "created_at.desc.nullslast");
  url.searchParams.set("limit", "200");
  const response = await fetch(url, { headers: getSupabaseHeaders(key), cache: "no-store" });
  if (!response.ok) return { inquiries: [], error: "FanMind-Anfragen konnten nicht geladen werden." };
  return { inquiries: (await response.json()) as PilotInquiry[], error: null };
}

export async function updatePilotInquiryStatus(inquiryId: string, status: string, admin: SupabaseServerUser): Promise<{ ok: boolean; statusCode: number; error: string | null }> {
  const key = serviceKey();
  if (!key) return { ok: false, statusCode: 503, error: "Anfragestatus ist momentan nicht verfügbar." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(inquiryId)) {
    return { ok: false, statusCode: 400, error: "Ungültige Anfrage-ID." };
  }
  if (!VALID_STATUSES.has(status as InquiryStatus)) return { ok: false, statusCode: 400, error: "Ungültiger Status." };

  const now = new Date().toISOString();
  const body = {
    status,
    updated_at: now,
    handled_at: status === "new" ? null : now,
    handled_by: status === "new" ? null : admin.id,
  };
  const url = new URL(getSupabaseRestUrl("pilot_inquiries"));
  url.searchParams.set("id", `eq.${inquiryId}`);
  const response = await fetch(url, {
    method: "PATCH",
    headers: { ...getSupabaseHeaders(key), Prefer: "return=minimal" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!response.ok) return { ok: false, statusCode: response.status, error: "Anfragestatus konnte nicht gespeichert werden." };
  return { ok: true, statusCode: 200, error: null };
}

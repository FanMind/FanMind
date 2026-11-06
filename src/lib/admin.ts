import { redirect } from "next/navigation";
import { getSupabaseServerUser, type SupabaseServerUser } from "@/lib/supabase/server";

function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

export function getAdminEmails(): string[] {
  // Admins are configured via `FANMIND_ADMIN_EMAILS` only.
  const configured = process.env.FANMIND_ADMIN_EMAILS?.trim();
  if (!configured) return [];

  return configured.split(",").map(normalizeEmail).filter(Boolean);
}

export function isPlatformAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = normalizeEmail(email);
  return Boolean(normalizedEmail && getAdminEmails().includes(normalizedEmail));
}

export async function requirePlatformAdmin(): Promise<SupabaseServerUser> {
  const { data } = await getSupabaseServerUser();

  if (!data.user) redirect("/login");
  if (!isPlatformAdminEmail(data.user.email)) redirect("/dashboard");

  return data.user;
}

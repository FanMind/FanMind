import { cookies } from "next/headers";
import type { SupabaseServerUser } from "@/lib/supabase/server";
import type { FanMindLanguage } from "@/lib/fanmindCopy";

export const FANMIND_LOCALE_COOKIE = "fanmind_locale";

export function normalizeWorkspaceLocale(value: unknown): FanMindLanguage {
  return value === "en" ? "en" : "de";
}

export function getUserMetadataLocale(user?: Pick<SupabaseServerUser, "user_metadata"> | null): FanMindLanguage | null {
  const metadata = user?.user_metadata;
  const value = metadata?.fanmind_locale ?? metadata?.locale;
  return value === "en" || value === "de" ? value : null;
}

export async function resolveWorkspaceLocale(input?: {
  lang?: string | string[] | null;
  user?: Pick<SupabaseServerUser, "user_metadata"> | null;
}): Promise<FanMindLanguage> {
  const urlLocale = Array.isArray(input?.lang) ? input?.lang[0] : input?.lang;
  if (urlLocale === "en" || urlLocale === "de") return urlLocale;

  const metadataLocale = getUserMetadataLocale(input?.user);
  if (metadataLocale) return metadataLocale;

  const cookieLocale = (await cookies()).get(FANMIND_LOCALE_COOKIE)?.value;
  if (cookieLocale === "en" || cookieLocale === "de") return cookieLocale;

  return "de";
}

export function localeCookieOptions(maxAge = 60 * 60 * 24 * 365) {
  return {
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

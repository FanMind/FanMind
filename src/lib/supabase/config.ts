import { buildSupabaseApiKeyHeaders } from "@/lib/supabase/apiKeyPolicy.mjs";

export type SupabasePublicConfig = {
  url: string;
  anonKey: string;
};

export const SUPABASE_ACCESS_TOKEN_COOKIE = "fanmind_sb_access_token";
export const SUPABASE_REFRESH_TOKEN_COOKIE = "fanmind_sb_refresh_token";

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ""),
    anonKey,
  };
}

export const SUPABASE_CONFIG_ERROR_MESSAGE =
  "Supabase ist noch nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und NEXT_PUBLIC_SUPABASE_ANON_KEY setzen.";

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicConfig() !== null;
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();

  if (!config) {
    throw new Error(SUPABASE_CONFIG_ERROR_MESSAGE);
  }

  return config;
}

export function getSupabaseAuthUrl(path: string): string {
  const { url } = requireSupabasePublicConfig();

  return `${url}/auth/v1${path}`;
}

export function getSupabaseApiKeyHeaders(
  apiKey: string,
  accessToken?: string,
): HeadersInit {
  return buildSupabaseApiKeyHeaders(apiKey, accessToken);
}

export function getSupabaseHeaders(accessToken?: string): HeadersInit {
  const { anonKey } = requireSupabasePublicConfig();
  return getSupabaseApiKeyHeaders(anonKey, accessToken);
}

export function getSupabaseRestUrl(table: string): string {
  const { url } = requireSupabasePublicConfig();

  return `${url}/rest/v1/${table}`;
}

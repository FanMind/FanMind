type MobileEnvironment = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiUrl: string;
};

function requireHttpsUrl(value: string | undefined, name: string): string {
  const raw = value?.trim();
  if (!raw) throw new Error(`${name} ist nicht gesetzt.`);
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`${name} ist keine gültige URL.`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`${name} muss HTTPS verwenden.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function requirePublicKey(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw || raw.length < 20) {
    throw new Error("EXPO_PUBLIC_SUPABASE_ANON_KEY ist nicht gesetzt.");
  }
  if (raw.startsWith("sb_secret_")) {
    throw new Error("In der Mobile-App ist nur ein öffentlicher Supabase-Schlüssel erlaubt.");
  }
  return raw;
}

export function getMobileEnvironment(): MobileEnvironment {
  return {
    supabaseUrl: requireHttpsUrl(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      "EXPO_PUBLIC_SUPABASE_URL",
    ),
    supabaseAnonKey: requirePublicKey(
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    ),
    apiUrl: requireHttpsUrl(
      process.env.EXPO_PUBLIC_FANMIND_API_URL ?? "https://fanmind.ch",
      "EXPO_PUBLIC_FANMIND_API_URL",
    ),
  };
}

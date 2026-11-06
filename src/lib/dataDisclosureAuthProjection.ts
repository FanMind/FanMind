const MAX_IDENTITIES = 20;
const MAX_METADATA_FIELDS = 20;
const MAX_TEXT_LENGTH = 500;

const IDENTITY_METADATA_ALLOWLIST = new Set([
  "avatar_url",
  "email",
  "full_name",
  "name",
  "picture",
  "preferred_username",
  "provider_id",
  "user_name",
]);

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function boundedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, MAX_TEXT_LENGTH) : null;
}

function safeIdentityMetadata(value: unknown): UnknownRecord {
  const source = record(value);
  if (!source) return {};
  return Object.fromEntries(
    Object.entries(source)
      .filter(([key, entry]) =>
        IDENTITY_METADATA_ALLOWLIST.has(key) &&
        ["string", "number", "boolean"].includes(typeof entry),
      )
      .slice(0, MAX_METADATA_FIELDS)
      .map(([key, entry]) => [
        key,
        typeof entry === "string" ? entry.slice(0, MAX_TEXT_LENGTH) : entry,
      ]),
  );
}

/** A deliberately small, credential-free projection of Supabase Auth data. */
export function projectAuthAccountForDisclosure(user: unknown): UnknownRecord {
  const source = record(user);
  if (!source) throw new Error("auth_account_unavailable");
  const appMetadata = record(source.app_metadata);
  const providers = Array.isArray(appMetadata?.providers)
    ? appMetadata.providers
        .map(boundedText)
        .filter((value): value is string => Boolean(value))
        .slice(0, MAX_IDENTITIES)
    : [];
  const identities = Array.isArray(source.identities)
    ? source.identities.slice(0, MAX_IDENTITIES).map((identity) => {
        const item = record(identity) ?? {};
        return {
          provider: boundedText(item.provider),
          identity_id: boundedText(item.identity_id ?? item.id),
          created_at: boundedText(item.created_at),
          updated_at: boundedText(item.updated_at),
          last_sign_in_at: boundedText(item.last_sign_in_at),
          identity_metadata: safeIdentityMetadata(item.identity_data),
        };
      })
    : [];

  return {
    created_at: boundedText(source.created_at),
    updated_at: boundedText(source.updated_at),
    confirmed_at: boundedText(source.confirmed_at),
    email_confirmed_at: boundedText(source.email_confirmed_at),
    last_sign_in_at: boundedText(source.last_sign_in_at),
    primary_provider: boundedText(appMetadata?.provider),
    providers,
    identities,
  };
}


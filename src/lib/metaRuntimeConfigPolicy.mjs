const PLACEHOLDER_PREFIX = /^(?:replace_with_|your_)/iu;
const PLACEHOLDER_HOST = /(?:^|\.)example(?:\.|$)|(?:^|\.)fanmind\.example$/iu;

export function normalizeMetaRuntimeValue(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || PLACEHOLDER_PREFIX.test(trimmed)) return null;
  if (/replace_with_/iu.test(trimmed)) return null;
  return trimmed;
}

export function isUsableMetaRuntimeValue(value) {
  return normalizeMetaRuntimeValue(value) !== null;
}

export function isUsableMetaAppId(value) {
  const normalized = normalizeMetaRuntimeValue(value);
  return Boolean(normalized && /^\d{5,32}$/u.test(normalized));
}

export function isUsableMetaAppSecret(value) {
  const normalized = normalizeMetaRuntimeValue(value);
  return Boolean(normalized && normalized.length >= 16);
}

export function normalizeMetaCallbackUrl(value, expectedPath) {
  const normalized = normalizeMetaRuntimeValue(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    const loopbackHttp =
      url.protocol === "http:" &&
      ["127.0.0.1", "localhost", "::1"].includes(url.hostname);
    if (url.protocol !== "https:" && !loopbackHttp) return null;
    if (PLACEHOLDER_HOST.test(url.hostname)) return null;
    if (url.pathname !== expectedPath) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function isUsableMetaCallbackUrl(value, expectedPath) {
  return normalizeMetaCallbackUrl(value, expectedPath) !== null;
}

const PLACEHOLDER_PREFIX = /^(?:replace_with_|your_)/iu;
const RESERVED_HOST_SUFFIX = /(?:^|\.)(?:example|test|invalid)$/iu;
const CORE_FLOW_ACK = "fanmind-local-synthetic-core-flow";
const CORE_FLOW_APP_URL = "http://localhost:3100";
const CORE_FLOW_SUPABASE_URL = "http://127.0.0.1:54321";

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

function isLoopbackHostname(hostname) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]" ||
    /^127\./u.test(normalized)
  );
}

function coreFlowLoopbackAllowed(url) {
  return (
    isLoopbackHostname(url.hostname) &&
    process.env.FANMIND_CORE_FLOW_FIXTURE_ACK === CORE_FLOW_ACK &&
    process.env.NEXT_PUBLIC_APP_URL === CORE_FLOW_APP_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL === CORE_FLOW_SUPABASE_URL
  );
}

function configuredAppOrigin() {
  const candidate =
    normalizeMetaRuntimeValue(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeMetaRuntimeValue(process.env.FANMIND_APP_URL);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return null;
    if (isLoopbackHostname(url.hostname)) return null;
    if (RESERVED_HOST_SUFFIX.test(url.hostname)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function normalizeMetaCallbackUrl(value, expectedPath) {
  const normalized = normalizeMetaRuntimeValue(value);
  if (!normalized) return null;
  try {
    const url = new URL(normalized);
    const loopback = isLoopbackHostname(url.hostname);
    const loopbackAllowed = loopback && coreFlowLoopbackAllowed(url);
    if (loopback && !loopbackAllowed) return null;
    if (url.protocol !== "https:" && !loopbackAllowed) return null;
    if (RESERVED_HOST_SUFFIX.test(url.hostname)) return null;
    if (url.pathname !== expectedPath) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (!loopbackAllowed) {
      const appOrigin = configuredAppOrigin();
      if (!appOrigin || url.origin !== appOrigin) return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export function isUsableMetaCallbackUrl(value, expectedPath) {
  return normalizeMetaCallbackUrl(value, expectedPath) !== null;
}

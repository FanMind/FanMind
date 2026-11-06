import { isIP } from "node:net";

const MAX_SINGLE_IP_HEADER_LENGTH = 128;
const MAX_FORWARDED_FOR_HEADER_LENGTH = 2048;
const MAX_FORWARDED_FOR_HOPS = 32;

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Normalize a single IP literal without accepting lists, hostnames or arbitrary
 * proxy metadata. IPv4-mapped IPv6 literals are reduced to their IPv4 form so
 * the same client cannot create two rate-limit identities.
 */
export function normalizeClientIp(value) {
  let candidate = clean(value);
  if (!candidate || candidate.length > MAX_SINGLE_IP_HEADER_LENGTH) return null;

  const bracketed = candidate.match(/^\[([^\]]+)\](?::\d{1,5})?$/);
  if (bracketed) candidate = bracketed[1];

  const mappedIpv4 = candidate.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4 && isIP(mappedIpv4[1]) === 4) return mappedIpv4[1];

  const version = isIP(candidate);
  if (version === 4) return candidate;
  if (version === 6) return candidate.toLowerCase();
  return null;
}

/**
 * nginx uses `$proxy_add_x_forwarded_for`, which appends `$remote_addr` to the
 * right-hand side of any incoming chain. We therefore only accept a fully
 * valid, bounded chain and use its final hop. The client-controlled first hop
 * is never treated as canonical.
 */
export function getLastForwardedForIp(value) {
  const raw = clean(value);
  if (!raw || raw.length > MAX_FORWARDED_FOR_HEADER_LENGTH) return null;

  const parts = raw.split(",").map((part) => part.trim());
  if (!parts.length || parts.length > MAX_FORWARDED_FOR_HOPS) return null;

  const normalized = parts.map(normalizeClientIp);
  if (normalized.some((part) => part === null)) return null;
  return normalized.at(-1) ?? null;
}

function headerValue(headers, name) {
  try {
    return headers?.get?.(name) ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve the client identity for FanMind's verified direct-nginx topology.
 *
 * Production nginx overwrites X-Real-IP with `$remote_addr`, while
 * CF-Connecting-IP is not a trusted or rewritten header. Consequently:
 *   1. valid X-Real-IP is canonical;
 *   2. a bounded X-Forwarded-For chain may only fall back to its final hop;
 *   3. CF-Connecting-IP and all other client-supplied headers are ignored.
 */
export function resolveTrustedClientIp(headers) {
  const realIp = normalizeClientIp(headerValue(headers, "x-real-ip"));
  if (realIp) return { ip: realIp, source: "x-real-ip" };

  const forwardedIp = getLastForwardedForIp(
    headerValue(headers, "x-forwarded-for"),
  );
  if (forwardedIp) return { ip: forwardedIp, source: "x-forwarded-for-last" };

  return { ip: null, source: "none" };
}

export function getTrustedClientIpValue(headers, fallback = "anonymous") {
  return resolveTrustedClientIp(headers).ip ?? fallback;
}

export {
  MAX_FORWARDED_FOR_HEADER_LENGTH,
  MAX_FORWARDED_FOR_HOPS,
  MAX_SINGLE_IP_HEADER_LENGTH,
};

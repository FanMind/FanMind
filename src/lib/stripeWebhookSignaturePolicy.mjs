import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

const MAX_SIGNATURE_HEADER_BYTES = 4_096;
const TIMESTAMP_PATTERN = /^[0-9]{1,12}$/u;
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/u;

function byteLength(value) {
  return Buffer.byteLength(value, "utf8");
}

function parseStripeSignatureHeader(signatureHeader) {
  if (
    typeof signatureHeader !== "string" ||
    !signatureHeader ||
    byteLength(signatureHeader) > MAX_SIGNATURE_HEADER_BYTES
  ) {
    return null;
  }

  const timestamps = [];
  const signatures = [];
  for (const rawPart of signatureHeader.split(",")) {
    const part = rawPart.trim();
    const separator = part.indexOf("=");
    if (separator <= 0) continue;
    const key = part.slice(0, separator);
    const value = part.slice(separator + 1);
    if (key === "t") timestamps.push(value);
    if (key === "v1" && SIGNATURE_PATTERN.test(value)) {
      signatures.push(value);
    }
  }

  if (
    timestamps.length !== 1 ||
    !TIMESTAMP_PATTERN.test(timestamps[0]) ||
    signatures.length === 0
  ) {
    return null;
  }
  const timestamp = Number(timestamps[0]);
  if (!Number.isSafeInteger(timestamp)) return null;

  return Object.freeze({
    timestamp,
    timestampText: timestamps[0],
    signatures: Object.freeze(signatures),
  });
}

export function verifyStripeWebhookSignature({
  rawBody,
  signatureHeader,
  configuredSecret,
  nowSeconds = Math.floor(Date.now() / 1_000),
} = {}) {
  if (
    typeof rawBody !== "string" ||
    typeof configuredSecret !== "string" ||
    configuredSecret.length === 0 ||
    !Number.isSafeInteger(nowSeconds) ||
    nowSeconds < 0
  ) {
    return false;
  }

  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed) return false;
  if (
    Math.abs(nowSeconds - parsed.timestamp) >
    STRIPE_WEBHOOK_SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const expected = createHmac("sha256", configuredSecret)
    .update(`${parsed.timestampText}.${rawBody}`)
    .digest();

  return parsed.signatures.some((signature) => {
    const received = Buffer.from(signature, "hex");
    return received.length === expected.length && timingSafeEqual(expected, received);
  });
}

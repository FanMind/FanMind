import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

export class MobilePushTokenCryptoError extends Error {
  constructor(code) {
    super(code);
    this.name = "MobilePushTokenCryptoError";
    this.code = code;
  }
}
function encryptionKey() {
  const raw = process.env.FANMIND_PUSH_TOKEN_ENCRYPTION_KEY?.trim() ?? "";
  if (!raw) {
    throw new MobilePushTokenCryptoError("push_encryption_not_configured");
  }
  const decoded = Buffer.from(
    raw,
    raw.length === 64 && /^[a-f0-9]+$/i.test(raw) ? "hex" : "base64",
  );
  if (decoded.length !== 32) {
    throw new MobilePushTokenCryptoError("push_encryption_not_configured");
  }
  return decoded;
}

export function hashMobilePushToken(token) {
  return createHmac("sha256", encryptionKey())
    .update("fanmind-mobile-push-token-v1\0")
    .update(token)
    .digest("hex");
}

export function encryptMobilePushToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptMobilePushToken(value) {
  const parts = typeof value === "string" ? value.split(":") : [];
  if (
    parts.length !== 4 ||
    parts[0] !== "v1" ||
    parts.slice(1).some((part) => !/^[A-Za-z0-9_-]+$/u.test(part))
  ) {
    throw new MobilePushTokenCryptoError("push_token_ciphertext_invalid");
  }
  try {
    const iv = Buffer.from(parts[1], "base64url");
    const tag = Buffer.from(parts[2], "base64url");
    const ciphertext = Buffer.from(parts[3], "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error("invalid_ciphertext");
    }
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof MobilePushTokenCryptoError) throw error;
    throw new MobilePushTokenCryptoError("push_token_ciphertext_invalid");
  }
}

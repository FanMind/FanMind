import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Official, deliberately narrow capabilities. A TikTok login does not grant DMs.
export const SOCIAL_PROVIDERS = Object.freeze({
  tiktok: Object.freeze({ name: "TikTok", scopes: ["user.info.basic"], messages: false,
    authorize: "https://www.tiktok.com/v2/auth/authorize/", token: "https://open.tiktokapis.com/v2/oauth/token/",
    revoke: "https://open.tiktokapis.com/v2/oauth/revoke/", profile: "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name" }),
  x: Object.freeze({ name: "X / Twitter", scopes: ["tweet.read", "users.read", "dm.read", "offline.access"], messages: true,
    authorize: "https://x.com/i/oauth2/authorize", token: "https://api.x.com/2/oauth2/token",
    revoke: "https://api.x.com/2/oauth2/revoke", profile: "https://api.x.com/2/users/me" }),
});
export class SocialProviderError extends Error {
  constructor(code) { super(code); this.name = "SocialProviderError"; this.code = code; }
}
export function providerPolicy(provider) {
  if (!Object.hasOwn(SOCIAL_PROVIDERS, provider)) throw new SocialProviderError("unsupported_provider");
  return SOCIAL_PROVIDERS[provider];
}
export function socialConfig(provider, workspaceId, env = process.env) {
  providerPolicy(provider);
  const prefix = provider === "x" ? "FANMIND_X" : "FANMIND_TIKTOK";
  let origin, target;
  try { origin = new URL(env.FANMIND_APP_URL); target = new URL(env.NEXT_PUBLIC_SUPABASE_URL); } catch { throw new SocialProviderError("pilot_unavailable"); }
  const workspaceIds = (env.FANMIND_SOCIAL_PILOT_WORKSPACE_IDS ?? "").split(",").map(v => v.trim()).filter(Boolean);
  if (env.FANMIND_SOCIAL_PILOT_ENABLED !== "true" || env.FANMIND_RUNTIME_ENVIRONMENT !== "staging"
    || !workspaceIds.includes(workspaceId) || origin.protocol !== "https:" || origin.username || origin.password
    || origin.hostname === "fanmind.ch" || origin.hostname.endsWith(".fanmind.ch") && origin.hostname !== "staging.fanmind.ch"
    || origin.pathname !== "/" || origin.search || origin.hash
    || !/^[a-z]{20}$/.test(env.FANMIND_SOCIAL_STAGING_PROJECT_REF ?? "")
    || env.FANMIND_SOCIAL_STAGING_PROJECT_REF === "drqkpdvtbbrrdwmtrodz"
    || target.origin !== `https://${env.FANMIND_SOCIAL_STAGING_PROJECT_REF}.supabase.co`
    || target.username || target.password || target.pathname !== "/" || target.search || target.hash
    || !env[`${prefix}_CLIENT_ID`] || !env[`${prefix}_CLIENT_SECRET`]
    || !/^[a-f0-9]{64}$/i.test(env.FANMIND_SOCIAL_TOKEN_KEY ?? "")
    || env[`${prefix}_PILOT_APPROVED`] !== "true") throw new SocialProviderError("pilot_unavailable");
  return { provider, origin: origin.origin, clientId: env[`${prefix}_CLIENT_ID`], clientSecret: env[`${prefix}_CLIENT_SECRET`],
    key: env.FANMIND_SOCIAL_TOKEN_KEY, redirectUri: `${origin.origin}/api/integrations/social/${provider}/callback` };
}
export function randomSecret() { return randomBytes(32).toString("base64url"); }
export function stateDigest(state) {
  if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new SocialProviderError("oauth_invalid");
  return createHash("sha256").update(state).digest("hex");
}
export function sealSocialSecret(value, binding, key) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "hex"), iv);
  cipher.setAAD(Buffer.from(binding));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(":");
}
export function openSocialSecret(value, binding, key) {
  try {
    if (typeof value !== "string" || value.length > 32768) throw new Error();
    const parts = value.split(":");
    if (parts.length !== 4 || parts[0] !== "v1") throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(key, "hex"), Buffer.from(parts[1], "base64url"));
    decipher.setAAD(Buffer.from(binding)); decipher.setAuthTag(Buffer.from(parts[2], "base64url"));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[3], "base64url")), decipher.final()]).toString("utf8"));
  } catch { throw new SocialProviderError("credential_invalid"); }
}
export function socialAuthorizeUrl(config, state, verifier) {
  stateDigest(state);
  const policy = providerPolicy(config.provider); const url = new URL(policy.authorize);
  url.searchParams.set(config.provider === "x" ? "client_id" : "client_key", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri); url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state); url.searchParams.set("scope", policy.scopes.join(config.provider === "x" ? " " : ","));
  if (config.provider === "x") {
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  }
  return url.toString();
}
export function socialErrorCode(error) {
  return error instanceof SocialProviderError ? error.code : "connection_failed";
}

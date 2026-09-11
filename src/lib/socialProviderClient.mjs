import { providerPolicy, SocialProviderError } from "./socialProviderPolicy.mjs";

// Fixed provider endpoints, no redirects, bounded response/timeout, no raw diagnostics.
export async function boundedProviderJson(url, init, fetcher = fetch) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetcher(url, { ...init, cache: "no-store", redirect: "error", signal: controller.signal });
    if (!response.ok) throw new SocialProviderError(response.status === 429 ? "rate_limited" : response.status === 401 ? "reconnect_required" : response.status === 402 || response.status === 403 ? "provider_access_required" : "provider_failed");
    if (!response.body) throw new SocialProviderError("provider_invalid");
    const reader = response.body.getReader(); const chunks = []; let bytes = 0;
    try {
      for (;;) { const { done, value } = await reader.read(); if (done) break;
        bytes += value.byteLength; if (bytes > 256000) throw new SocialProviderError("provider_invalid"); chunks.push(value); }
    } finally { await reader.cancel().catch(() => {}); }
    const text = Buffer.concat(chunks).toString("utf8");
    const value = text ? JSON.parse(text) : {};
    if (!value || typeof value !== "object" || Array.isArray(value) || value.error && value.error.code !== "ok" || value.errors?.length) throw new SocialProviderError("provider_invalid");
    return value;
  } catch (error) { if (error instanceof SocialProviderError) throw error; throw new SocialProviderError("provider_failed"); }
  finally { clearTimeout(timer); }
}
function tokenForm(config, params) {
  const body = new URLSearchParams(params);
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  if (config.provider === "x") headers.Authorization = `Basic ${Buffer.from(`${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`).toString("base64")}`;
  else { body.set("client_key", config.clientId); body.set("client_secret", config.clientSecret); }
  return { method: "POST", headers, body: body.toString() };
}
export async function exchangeSocialToken(config, code, verifier, fetcher = fetch) {
  if (typeof code !== "string" || !code || code.length > 4096) throw new SocialProviderError("oauth_invalid");
  const params = { grant_type: "authorization_code", code, redirect_uri: config.redirectUri };
  if (config.provider === "x") params.code_verifier = verifier;
  const value = await boundedProviderJson(providerPolicy(config.provider).token, tokenForm(config, params), fetcher);
  return normalizeToken(config.provider, value);
}
export async function refreshSocialToken(config, token, fetcher = fetch) {
  if (!token.refreshToken || token.refreshExpiresAt && Date.parse(token.refreshExpiresAt) <= Date.now()) throw new SocialProviderError("reconnect_required");
  const value = await boundedProviderJson(providerPolicy(config.provider).token, tokenForm(config, { grant_type: "refresh_token", refresh_token: token.refreshToken }), fetcher);
  // Do not guess scope, identity or refresh rotation after an incomplete response.
  return normalizeToken(config.provider, value);
}
function normalizeToken(provider, value) {
  const scopes = typeof value.scope === "string" ? value.scope.split(/[ ,]+/).filter(Boolean) : [];
  if (typeof value.access_token !== "string" || !value.access_token || value.access_token.length > 8192
    || typeof value.refresh_token !== "string" || !value.refresh_token || value.refresh_token.length > 8192
    || value.token_type?.toLowerCase() !== "bearer" || !Number.isInteger(value.expires_in) || value.expires_in < 60 || value.expires_in > 31622400
    || !providerPolicy(provider).scopes.every(scope => scopes.includes(scope))
    || scopes.some(scope => !providerPolicy(provider).scopes.includes(scope))
    || provider === "tiktok" && (typeof value.open_id !== "string" || !value.open_id || !Number.isInteger(value.refresh_expires_in) || value.refresh_expires_in <= 0)) throw new SocialProviderError("provider_scope_invalid");
  return { accessToken: value.access_token, refreshToken: value.refresh_token, scopes, openId: value.open_id ?? null,
    expiresAt: new Date(Date.now() + value.expires_in * 1000).toISOString(),
    refreshExpiresAt: value.refresh_expires_in ? new Date(Date.now() + value.refresh_expires_in * 1000).toISOString() : null };
}
export async function readSocialProfile(config, token, fetcher = fetch) {
  const result = await boundedProviderJson(providerPolicy(config.provider).profile, { headers: { Authorization: `Bearer ${token.accessToken}` } }, fetcher);
  const user = config.provider === "x" ? result.data : result.data?.user;
  const id = config.provider === "x" ? user?.id : user?.open_id;
  const name = config.provider === "x" ? user?.username : user?.display_name;
  if (typeof id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(id) || typeof name !== "string" || !name || name.length > 200
    || config.provider === "tiktok" && id !== token.openId) throw new SocialProviderError("provider_identity_invalid");
  return { id, name };
}
export async function revokeSocialToken(config, token, fetcher = fetch) {
  await boundedProviderJson(providerPolicy(config.provider).revoke, tokenForm(config, { token: token.accessToken }), fetcher);
}
export async function readXDirectMessages(token, ownId, fetcher = fetch) {
  if (typeof ownId !== "string" || !/^[0-9]{1,32}$/.test(ownId)) throw new SocialProviderError("provider_identity_invalid");
  const url = new URL("https://api.x.com/2/dm_events");
  url.searchParams.set("max_results", "20"); url.searchParams.set("event_types", "MessageCreate");
  url.searchParams.set("dm_event.fields", "id,text,event_type,created_at,dm_conversation_id,sender_id");
  const value = await boundedProviderJson(url, { headers: { Authorization: `Bearer ${token.accessToken}` } }, fetcher);
  if (value.data !== undefined && !Array.isArray(value.data) || (value.data?.length ?? 0) > 20) throw new SocialProviderError("provider_invalid");
  const messages = []; let skipped = 0;
  for (const event of value.data ?? []) {
    // Never mix group participants or provider-observed outbound text into Creator learning.
    // X's integration guide defines one-to-one IDs as smaller-user-id/larger-user-id
    // joined by a hyphen. participant_ids belongs to membership events, not normal DMs.
    const pair = typeof event.dm_conversation_id === "string" ? /^([0-9]{1,32})-([0-9]{1,32})$/.exec(event.dm_conversation_id) : null;
    const participants = pair ? pair.slice(1) : [];
    if (event.event_type !== "MessageCreate" || !pair || BigInt(participants[0]) >= BigInt(participants[1])
      || !participants.includes(ownId) || !participants.includes(event.sender_id) || event.sender_id === ownId
      || event.participant_ids !== undefined && (!Array.isArray(event.participant_ids) || event.participant_ids.length !== 2 || !participants.every(id => event.participant_ids.includes(id)))
      || ![event.id, event.sender_id, event.dm_conversation_id].every(id => typeof id === "string" && /^[0-9-]{1,128}$/.test(id))
      || typeof event.text !== "string" || !event.text.trim() || event.text.length > 10000
      || typeof event.created_at !== "string" || !Number.isFinite(Date.parse(event.created_at))) { skipped++; continue; }
    if (messages.some(message => message.id === event.id)) { skipped++; continue; }
    messages.push({ id: event.id, senderId: event.sender_id, conversationId: event.dm_conversation_id,
      text: event.text, receivedAt: event.created_at, openUrl: "https://x.com/messages" });
  }
  return { messages, skipped, hasMore: Boolean(value.meta?.next_token) };
}

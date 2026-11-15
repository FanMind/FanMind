import { createHash } from 'node:crypto';
import { buildSupabaseApiKeyHeaders } from './supabase/apiKeyPolicy.mjs';
import { STAGING_ORIGIN, STAGING_AUTH_ORIGIN, OPERATOR_USER, OPERATOR_WORKSPACE, OPERATOR_NAME } from './stagingOperatorIdentity.mjs';

export function operatorSessionEnabled(environment) {
  return environment.FANMIND_STAGING_OPERATOR_SESSION_ENABLED === 'true' &&
    environment.FANMIND_RUNTIME_ENVIRONMENT === 'staging' &&
    environment.NEXT_PUBLIC_APP_URL === STAGING_ORIGIN &&
    environment.NEXT_PUBLIC_SUPABASE_URL === STAGING_AUTH_ORIGIN;
}
function publicKey(value) {
  if (typeof value !== 'string' || value.length > 4096) return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/u.test(value)) return true;
  try {
    return JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString()).role === 'anon';
  } catch { return false; }
}
function token(value) {
  return typeof value === 'string' && value.length >= 24 && value.length <= 16000 && !/[\s\r\n]/u.test(value);
}
// Supabase Auth supports 12-character legacy refresh credentials as well as
// newer opaque formats. They are not access JWTs; the provider validates them.
function refreshCredential(value) {
  return typeof value === 'string' && value.length >= 12 && value.length <= 4000 && !/[\s\r\n]/u.test(value);
}
const fail = (status, code) => ({ status, code });

export function operatorSessionRequestAllowed(request) {
  let url;
  try { url = new URL(request.url); } catch { return false; }
  if (url.username || url.password) return false;
  // Next.js reconstructs its local URL using nginx's forwarded TLS protocol:
  // an HTTP upstream can therefore become https://localhost:3001 here. Accept
  // only these exact loopback forms; no header establishes an allowed origin.
  // Public browser Origin and runtime/project/Operator/workspace gates remain.
  const trustedTransport = url.origin === STAGING_ORIGIN ||
    ['http://127.0.0.1:3001', 'http://localhost:3001',
      'https://127.0.0.1:3001', 'https://localhost:3001'].includes(url.origin);
  return trustedTransport && url.pathname === '/api/staging-operator/session' &&
    request.method === 'POST' && request.headers.get('origin') === STAGING_ORIGIN &&
    ['same-origin', 'none'].includes(request.headers.get('sec-fetch-site') || 'same-origin');
}

export async function operatorSessionBodyPresent(request) {
  if (request.body === null) return false;
  const reader = request.body?.getReader?.();
  if (!reader) return true;
  let timer;
  const deadline = new Promise(resolve => { timer = setTimeout(() => resolve({ timedOut: true }), 1000); });
  try {
    for (let chunks = 0; chunks < 16; chunks++) {
      const part = await Promise.race([reader.read(), deadline]);
      if (part.timedOut) return true;
      if (part.done) return false;
      if (!(part.value instanceof Uint8Array) || part.value.byteLength > 0) return true;
    }
    return true;
  } catch { return true; }
  finally {
    clearTimeout(timer);
    // Bound cancellation too: a broken caller stream cannot hold Auth open.
    void reader.cancel().catch(() => {});
  }
}

// Per-process coalescing/rate bound complements provider-side Auth controls.
// It is not a distributed limiter or an immediate JWT-revocation guarantee.
export function createOperatorSessionRenewer({ fetchImpl = fetch, now = Date.now } = {}) {
  const attempts = new Map();
  return async function renew(request, environment) {
    if (!operatorSessionEnabled(environment)) return fail(404, 'unavailable');
    if (!operatorSessionRequestAllowed(request)) return fail(403, 'origin_forbidden');
    // No client-supplied user, workspace, key, refresh token or redirect in a body.
    if (request.bodyPresent) return fail(400, 'body_forbidden');
    const refreshToken = request.refreshToken;
    if (!refreshCredential(refreshToken)) return fail(401, 'sign_in_required');
    const key = environment.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!publicKey(key)) return fail(503, 'configuration_unavailable');
    for (const [id, entry] of attempts) if (entry.expires <= now() && !entry.promise) attempts.delete(id);
    const id = createHash('sha256').update(refreshToken).digest('hex');
    let entry = attempts.get(id);
    if (entry?.promise) return entry.promise;
    if ((entry?.count || 0) >= 3 || (!entry && attempts.size >= 32)) return fail(429, 'retry_later');
    entry ||= { count: 0, expires: now() + 60000 };
    entry.count++;
    attempts.set(id, entry);

    const execute = async () => {
      let session;
      const call = (path, options = {}) => fetchImpl(`${STAGING_AUTH_ORIGIN}${path}`, { ...options, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
      const headers = buildSupabaseApiKeyHeaders(key);
      const revoke = async () => {
        if (!token(session?.access_token)) return;
        try { await call('/auth/v1/logout?scope=local', { method: 'POST', headers: buildSupabaseApiKeyHeaders(key, session.access_token) }); } catch { /* fail closed; no raw diagnostics */ }
      };
      try {
        const refreshed = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers, body: JSON.stringify({ refresh_token: refreshToken }) });
        if (!refreshed.ok) return fail([400, 401, 403].includes(refreshed.status) ? 401 : 503, [400, 401, 403].includes(refreshed.status) ? 'sign_in_required' : 'provider_unavailable');
        session = await refreshed.json();
        if (!token(session?.access_token) || !refreshCredential(session?.refresh_token) || !Number.isInteger(session.expires_in) || session.expires_in < 1 || session.expires_in > 3600 || session.user?.id !== OPERATOR_USER) {
          await revoke(); return fail(403, 'operator_required');
        }
        const authorizedHeaders = buildSupabaseApiKeyHeaders(key, session.access_token);
        // Provider validation, not user_metadata or unverified JWT decoding.
        const checked = await call('/auth/v1/user', { headers: authorizedHeaders });
        if (!checked.ok || (await checked.json()).id !== OPERATOR_USER) {
          await revoke(); return fail(403, 'operator_required');
        }
        const workspaceResponse = await call(`/rest/v1/workspaces?select=id,name,owner_user_id,test_access_flags&owner_user_id=eq.${OPERATOR_USER}&limit=2`, { headers: authorizedHeaders });
        if (!workspaceResponse.ok) { await revoke(); return fail(403, 'workspace_required'); }
        const rows = await workspaceResponse.json();
        if (!Array.isArray(rows) || rows.length !== 1 || rows[0].id !== OPERATOR_WORKSPACE || rows[0].owner_user_id !== OPERATOR_USER || rows[0].name !== OPERATOR_NAME || rows[0].test_access_flags?.staging_operator_workspace !== true) {
          await revoke(); return fail(403, 'workspace_required');
        }
        // Only the server wrapper receives tokens. It must never JSON-serialize this object.
        return { status: 200, code: 'renewed', session: { access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in } };
      } catch {
        await revoke(); return fail(503, 'provider_unavailable');
      }
    };
    entry.promise = execute();
    try { return await entry.promise; } finally { entry.promise = undefined; }
  };
}

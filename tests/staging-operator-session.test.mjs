import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOperatorSessionRenewer, operatorSessionEnabled, operatorSessionRequestAllowed, operatorSessionBodyPresent } from '../src/lib/stagingOperatorSession.mjs';
import { STAGING_ORIGIN, STAGING_AUTH_ORIGIN, OPERATOR_USER, OPERATOR_WORKSPACE, OPERATOR_NAME } from '../src/lib/stagingOperatorIdentity.mjs';

const secret = 'synthetic-refresh-token-'.repeat(2);
const access = 'synthetic-access-token-'.repeat(2);
const env = { FANMIND_STAGING_OPERATOR_SESSION_ENABLED: 'true', FANMIND_RUNTIME_ENVIRONMENT: 'staging', NEXT_PUBLIC_APP_URL: STAGING_ORIGIN, NEXT_PUBLIC_SUPABASE_URL: STAGING_AUTH_ORIGIN, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_synthetic' };
const request = (patch = {}) => ({ url: `${STAGING_ORIGIN}/api/staging-operator/session`, method: 'POST', headers: new Headers({ origin: STAGING_ORIGIN, 'sec-fetch-site': 'same-origin' }), bodyPresent: false, refreshToken: secret, ...patch });
const session = () => ({ access_token: access, refresh_token: `${secret}-rotated`, expires_in: 3600, user: { id: OPERATOR_USER } });
const row = () => ({ id: OPERATOR_WORKSPACE, owner_user_id: OPERATOR_USER, name: OPERATOR_NAME, test_access_flags: { staging_operator_workspace: true } });
const response = (data, status = 200) => new Response(JSON.stringify(data), { status });
function provider(overrides = {}) {
  const calls = [];
  return { calls, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    assert.equal(new URL(url).origin, STAGING_AUTH_ORIGIN);
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    if (url.includes('/logout')) return response({});
    if (url.includes('/token')) return overrides.token ? overrides.token() : response(session());
    if (url.endsWith('/user')) return response(overrides.user || { id: OPERATOR_USER });
    if (url.includes('/rest/v1/workspaces')) return response(overrides.rows || [row()]);
    assert.fail('unexpected provider call');
  } };
}

test('renewal is off by default and cannot activate on Production or a different project', async () => {
  for (const patch of [{ FANMIND_STAGING_OPERATOR_SESSION_ENABLED: undefined }, { FANMIND_RUNTIME_ENVIRONMENT: 'production' }, { NEXT_PUBLIC_APP_URL: 'https://fanmind.ch' }, { NEXT_PUBLIC_SUPABASE_URL: 'https://drqkpdvtbbrrdwmtrodz.supabase.co' }]) {
    const p = provider();
    assert.equal(operatorSessionEnabled({ ...env, ...patch }), false);
    assert.equal((await createOperatorSessionRenewer(p)(request(), { ...env, ...patch })).status, 404);
    assert.equal(p.calls.length, 0);
  }
});
test('foreign origin, cross-site and client-controlled body never reach Auth', async () => {
  const p = provider(); const renew = createOperatorSessionRenewer(p);
  for (const patch of [{ url: 'https://fanmind.ch/api/staging-operator/session' }, { method: 'GET' }, { headers: new Headers({ origin: 'https://attacker.invalid' }) }, { headers: new Headers({ origin: STAGING_ORIGIN, 'sec-fetch-site': 'cross-site' }) }, { bodyPresent: true }]) {
    assert.notEqual((await renew(request(patch), env)).status, 200);
  }
  assert.equal(p.calls.length, 0);
});
test('password-free renewal checks provider user and exact workspace with a user JWT', async () => {
  const p = provider(); const result = await createOperatorSessionRenewer(p)(request(), env);
  assert.equal(result.status, 200);
  assert.equal(result.session.refresh_token, `${secret}-rotated`);
  assert.equal(p.calls.length, 3);
  assert.deepEqual(JSON.parse(p.calls[0].options.body), { refresh_token: secret });
  assert.equal(p.calls[2].options.headers.Authorization, `Bearer ${access}`);
  assert.match(p.calls[2].url, /select=id,name,owner_user_id,test_access_flags/u);
  assert.equal(JSON.stringify(p.calls).includes('service_role'), false);
});
test('wrong identity, owner mismatch, duplicate rows and missing marker fail closed and revoke the rotated local session', async () => {
  for (const override of [{ user: { id: 'foreign' } }, { rows: [{ ...row(), owner_user_id: 'foreign' }] }, { rows: [row(), row()] }, { rows: [{ ...row(), test_access_flags: {} }] }]) {
    const p = provider(override); const result = await createOperatorSessionRenewer(p)(request(), env);
    assert.equal(result.status, 403);
    assert.equal('session' in result, false);
    assert.equal(p.calls.at(-1).url, `${STAGING_AUTH_ORIGIN}/auth/v1/logout?scope=local`);
    assert.equal(JSON.stringify(result).includes(secret), false);
  }
});
test('an expired/revoked refresh token cannot restore authentication', async () => {
  const p = provider({ token: () => response({ error: 'synthetic-provider-diagnostic' }, 400) });
  const result = await createOperatorSessionRenewer(p)(request(), env);
  assert.deepEqual(result, { status: 401, code: 'sign_in_required' });
  assert.equal(p.calls.length, 1);
});
test('missing cookie and a secret API key are rejected without provider requests', async () => {
  const p = provider(); const renew = createOperatorSessionRenewer(p);
  assert.equal((await renew(request({ refreshToken: undefined }), env)).status, 401);
  assert.equal((await renew(request(), { ...env, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_secret_synthetic' })).status, 503);
  assert.equal(p.calls.length, 0);
});
test('parallel refreshes coalesce and retries are bounded', async () => {
  let unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const p = provider({ token: async () => { await gate; return response(session()); } });
  const renew = createOperatorSessionRenewer(p);
  const first = renew(request(), env); const second = renew(request(), env);
  unblock();
  assert.deepEqual(await first, await second);
  assert.equal(p.calls.filter(c => c.url.includes('/token')).length, 1);
  await renew(request(), env); await renew(request(), env);
  assert.equal((await renew(request(), env)).status, 429);
});
test('a malformed or excessive-lifetime provider session is never issued to the browser', async () => {
  for (const patch of [{ user: { id: 'foreign' } }, { expires_in: 7200 }, { refresh_token: '' }]) {
    const p = provider({ token: () => response({ ...session(), ...patch }) });
    const result = await createOperatorSessionRenewer(p)(request(), env);
    assert.equal(result.status, 403);
    assert.equal('session' in result, false);
  }
});
test('route serializes only fixed outcome fields and uses secure HttpOnly cookies', async () => {
  const source = await readFile(new URL('../src/app/api/staging-operator/session/route.ts', import.meta.url), 'utf8');
  assert.match(source, /NextResponse\.json\(\{ ok: result\.status === 200, code: result\.code \}/u);
  assert.match(source, /httpOnly: true, secure: true, sameSite: 'strict'/u);
  assert.doesNotMatch(source, /json\(result\)|json\(result\.session\)/u);
  assert.match(source, /no-store, private/u);
});

test('the exact local nginx transport can renew only with the pinned HTTPS browser Origin', async () => {
  for (const url of ['http://127.0.0.1:3001/api/staging-operator/session', 'http://localhost:3001/api/staging-operator/session']) {
    const p = provider();
    assert.equal((await createOperatorSessionRenewer(p)(request({ url }), env)).status, 200);
    assert.equal(p.calls.length, 3);
  }
  for (const url of ['http://localhost:3000/api/staging-operator/session', 'http://attacker.invalid:3001/api/staging-operator/session', 'http://localhost:3001/other', 'https://fanmind.ch/api/staging-operator/session', 'http://user:pass@localhost:3001/api/staging-operator/session']) {
    assert.equal(operatorSessionRequestAllowed(request({ url })), false);
  }
  const p = provider();
  const bad = request({ url: 'http://localhost:3001/api/staging-operator/session', headers: new Headers({ origin: 'https://attacker.invalid', 'x-forwarded-host': 'staging.fanmind.ch', 'x-forwarded-proto': 'https' }) });
  assert.equal((await createOperatorSessionRenewer(p)(bad, env)).status, 403);
  assert.equal(p.calls.length, 0);
});

test('an empty POST stream is not a caller body; even one byte is rejected regardless of length headers', async () => {
  const empty = new Request(`${STAGING_ORIGIN}/api/staging-operator/session`, {
    method: 'POST', body: new ReadableStream({ start(controller) { controller.close(); } }), duplex: 'half',
  });
  assert.notEqual(empty.body, null);
  assert.equal(await operatorSessionBodyPresent(empty), false);
  assert.equal(await operatorSessionBodyPresent({ body: null }), false);
  let cancelled = false;
  const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array([123])); }, cancel() { cancelled = true; } });
  const hasBody = await operatorSessionBodyPresent({ body, headers: new Headers({ 'content-length': '0' }) });
  assert.equal(hasBody, true);
  assert.equal(cancelled, true);
  const p = provider();
  assert.equal((await createOperatorSessionRenewer(p)(request({ bodyPresent: hasBody }), env)).code, 'body_forbidden');
  assert.equal(p.calls.length, 0);
});

test('stalled body streams fail closed within a bounded wait', async () => {
  let cancelled = false;
  const body = new ReadableStream({ cancel() { cancelled = true; } });
  assert.equal(await operatorSessionBodyPresent({ body }), true);
  assert.equal(cancelled, true);
});

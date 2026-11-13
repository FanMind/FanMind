import { operatorSessionEnabled } from './stagingOperatorSession.mjs';
import { OPERATOR_USER, OPERATOR_WORKSPACE, STAGING_ORIGIN } from './stagingOperatorIdentity.mjs';
export const UNIFIED_APP = '1547928503809961';
export const UNIFIED_SCOPES = Object.freeze(['instagram_basic','instagram_manage_messages','instagram_manage_comments']);
export const UNIFIED_FIELDS = Object.freeze(['messages','comments']);
export function instagramUnifiedEnabled(env) {
  return env.INSTAGRAM_LOGIN_MODE === 'unified' && operatorSessionEnabled(env) &&
    env.INSTAGRAM_APP_ID === UNIFIED_APP && env.FACEBOOK_APP_ID === UNIFIED_APP &&
    env.INSTAGRAM_APP_SECRET === env.FACEBOOK_APP_SECRET && /^[a-f0-9]{32}$/iu.test(env.INSTAGRAM_APP_SECRET ?? '') &&
    /^\d{5,32}$/u.test(env.INSTAGRAM_UNIFIED_CONFIG_ID ?? '') &&
    env.INSTAGRAM_REDIRECT_URI === STAGING_ORIGIN + '/api/integrations/instagram/callback' &&
    !env.META_APP_ID && !env.META_APP_SECRET && !env.META_WEBHOOK_APP_SECRET;
}
export function assertUnifiedOperator(env, user, workspace) {
  if (!instagramUnifiedEnabled(env) || user !== OPERATOR_USER || workspace !== OPERATOR_WORKSPACE) throw Error('instagram_unified_target');
}
export function validateUnifiedDiagnostics(value, now = Date.now()) {
  if (value?.is_valid !== true || value.app_id !== UNIFIED_APP || value.type !== 'SYSTEM_USER' ||
      !Array.isArray(value.scopes) || !UNIFIED_SCOPES.every(s=>value.scopes.includes(s)) ||
      value.scopes.some(s=>!UNIFIED_SCOPES.includes(s) && s !== 'public_profile') ||
      (value.expires_at && value.expires_at * 1000 <= now) ||
      (value.data_access_expires_at && value.data_access_expires_at * 1000 <= now)) throw Error('instagram_unified_token');
  const expiry = name => {
    if (value[name] == null) return null;
    if (!Number.isSafeInteger(value[name]) || value[name] < 0) throw Error('instagram_unified_expiry');
    return value[name];
  };
  return {appId: UNIFIED_APP, tokenType: 'SYSTEM_USER', scopes: [...value.scopes],
    expiresAt: expiry('expires_at'), dataAccessExpiresAt: expiry('data_access_expires_at')};
}
export function selectUnifiedAccount(accounts) {
  if (!Array.isArray(accounts) || accounts.length !== 1 || accounts[0]?.username !== 'fanmind.crm' ||
      !/^\d{5,32}$/u.test(accounts[0]?.id ?? '')) throw Error('instagram_unified_account');
  return accounts[0];
}
export function readUnifiedCredential(text, env, accountId) {
  if (!instagramUnifiedEnabled(env)) throw Error('instagram_unified_disabled');
  const v = JSON.parse(text);
  if (v.version !== 1 || v.mode !== 'unified' || v.appId !== UNIFIED_APP ||
      v.configId !== env.INSTAGRAM_UNIFIED_CONFIG_ID || v.accountId !== accountId ||
      !/^\d{5,32}$/u.test(v.businessId ?? '') || typeof v.accessToken !== 'string' || !v.accessToken.trim()) throw Error('instagram_unified_binding');
  return v;
}
const escape = value => value.replace(/[&<>"']/gu,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function instagramUnifiedContinuation(request, env, state) {
  const u = new URL(request.url), code = u.searchParams.get('code'), signed = u.searchParams.get('state');
  const transport = u.origin === STAGING_ORIGIN || (['https://localhost:3001','http://localhost:3001','https://127.0.0.1:3001','http://127.0.0.1:3001'].includes(u.origin) && request.headers.get('host')==='staging.fanmind.ch' && request.headers.get('x-forwarded-proto')==='https');
  if (!instagramUnifiedEnabled(env) || state?.userId !== OPERATOR_USER || state?.workspaceId !== OPERATOR_WORKSPACE ||
      !transport || request.method !== 'GET' || u.pathname !== '/api/integrations/instagram/callback' ||
      u.searchParams.has('same_site_continue') || !code || code.length>4096 || !signed || signed.length>8192) return null;
  return new Response(`<!doctype html><html lang="de"><meta charset="utf-8"><title>Instagram-Verbindung fortsetzen</title><h1>Instagram-Verbindung fortsetzen</h1><form action="/api/integrations/instagram/callback" method="get"><input type="hidden" name="code" value="${escape(code)}"><input type="hidden" name="state" value="${escape(signed)}"><input type="hidden" name="same_site_continue" value="1"><button>Verbindung abschließen</button></form></html>`,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'}});
}

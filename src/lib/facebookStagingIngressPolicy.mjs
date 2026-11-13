import { operatorSessionEnabled } from './stagingOperatorSession.mjs';
import { OPERATOR_USER, OPERATOR_WORKSPACE, STAGING_ORIGIN } from './stagingOperatorIdentity.mjs';

export const STAGING_INGRESS_APP = '1547928503809961';
export const STAGING_INGRESS_PAGE = '1208778912321696';
export const STAGING_INGRESS_FIELDS = ['messages', 'feed'];
export function stagingFacebookIngressEnabled(env) {
  return operatorSessionEnabled(env) && env.FACEBOOK_APP_ID === STAGING_INGRESS_APP &&
    env.FACEBOOK_REDIRECT_URI === STAGING_ORIGIN + '/api/integrations/facebook/callback' &&
    !env.META_APP_ID && !env.META_APP_SECRET && !env.META_WEBHOOK_APP_SECRET;
}
export function stagingFacebookIngressTarget(env, connection) {
  return stagingFacebookIngressEnabled(env) && connection?.workspace_id === OPERATOR_WORKSPACE &&
    connection.page_id === STAGING_INGRESS_PAGE && connection.platform === 'facebook' && connection.status === 'connected';
}
const escapeHtml = value => value.replace(/[&<>"']/gu, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
// The first external navigation cannot send Strict session cookies. Render a
// bounded, same-origin continuation; keep the cookies and all callback auth checks.
export function stagingFacebookOAuthContinuation(request, env, state) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code'), signedState = url.searchParams.get('state');
  if (!stagingFacebookIngressEnabled(env) || url.origin !== STAGING_ORIGIN ||
      url.pathname !== '/api/integrations/facebook/callback' || request.method !== 'GET' ||
      state?.userId !== OPERATOR_USER || state?.workspaceId !== OPERATOR_WORKSPACE ||
      url.searchParams.has('same_site_continue') || !code || code.length > 4096 ||
      !signedState || signedState.length > 8192) return null;
  return new Response(`<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Facebook-Verbindung fortsetzen</title><h1>Facebook-Verbindung fortsetzen</h1><p>Bestätige die Rückkehr zu deinem FanMind-Workspace.</p><form action="/api/integrations/facebook/callback" method="get"><input type="hidden" name="code" value="${escapeHtml(code)}"><input type="hidden" name="state" value="${escapeHtml(signedState)}"><input type="hidden" name="same_site_continue" value="1"><button type="submit">Verbindung abschließen</button></form></html>`, {
    headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store, private',
      'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff',
      'Content-Security-Policy':"default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'" }
  });
}

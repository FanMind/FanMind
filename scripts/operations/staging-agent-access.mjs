import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { STAGING_ORIGIN, OPERATOR_WORKSPACE, OPERATOR_NAME, requireCondition, readPrivateBinding, allowBrowserRequest, verifyVersion, verifyOperator } from './staging-agent-access-policy.mjs';

const mode = process.argv[2];
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const receipt = { runId: randomUUID(), startedAt: new Date().toISOString(), target: STAGING_ORIGIN, status: 'BLOCKED', checks: {}, messenger: 'NOT_TESTED', comments: 'NOT_TESTED', revocation: 'NOT_TESTED', expiry: 'NOT_TESTED', tenantIsolation: 'NOT_TESTED' };
let browser, context, session, binding;
let cleanupFailed = false;
async function json(response, code) {
  requireCondition(response.ok(), code);
  return response.json();
}
async function fetchPublic(path, options = {}) {
  return fetch(`${STAGING_ORIGIN}${path}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(20_000) });
}
try {
  requireCondition(['--probe', '--check', '--run'].includes(mode), 'MODE_INVALID');
  requireCondition(!process.env.DEBUG && !process.env.PWDEBUG && !process.env.NODE_DEBUG && !process.env.NODE_OPTIONS, 'DEBUG_OUTPUT_REJECTED');
  if (mode !== '--probe') {
    binding = await readPrivateBinding(process.env.FANMIND_STAGING_AGENT_BINDING_FILE, root);
    receipt.checks.privateBinding = 'PASS';
  }
  if (mode === '--check') {
    receipt.status = 'REVIEW_PENDING';
  } else {
    const response = await fetchPublic('/api/version');
    requireCondition(response.ok, 'VERSION_UNAVAILABLE');
    const version = await response.json();
    verifyVersion(version, binding?.releaseCommit ?? version.releaseCommit);
    receipt.releaseCommit = version.releaseCommit;
    receipt.checks.stagingRuntime = 'PASS';
    const anonymous = await fetchPublic('/dashboard');
    const destination = new URL(anonymous.headers.get('location') || '/', STAGING_ORIGIN);
    requireCondition([302, 303, 307, 308].includes(anonymous.status) && destination.origin === STAGING_ORIGIN && destination.pathname === '/login', 'ANONYMOUS_ACCESS_REJECTED');
    receipt.checks.anonymousDenied = 'PASS';
    const csrf = await fetchPublic('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://example.invalid', 'Sec-Fetch-Site': 'cross-site' }, body: '{}' });
    requireCondition(csrf.status === 403 && (await csrf.json()).code === 'origin_forbidden', 'CSRF_REJECTED');
    receipt.checks.crossOriginDenied = 'PASS';
    if (mode === '--probe') {
      receipt.blocker = 'STAGING_AGENT_SECRET_BINDING_REQUIRED_FOR_LOGIN';
    } else {
      // Existing dependency, no persistent profile, traces, screenshots or HAR.
      const { chromium } = await import('@playwright/test');
      browser = await chromium.launch({ headless: true });
      context = await browser.newContext({ serviceWorkers: 'block', acceptDownloads: false });
      let denied = 0;
      await context.route('**/*', async route => {
        const request = route.request();
        if (allowBrowserRequest(request.url(), request.method(), binding)) await route.continue();
        else { denied++; await route.abort('blockedbyclient'); }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(20_000);
      page.setDefaultNavigationTimeout(25_000);
      await page.goto(`${STAGING_ORIGIN}/login`);
      // Standard product login only: no admin magic-link, impersonation or cookie minting.
      await page.locator('input[name="email"]').fill(binding.email);
      await page.locator('input[name="password"]').fill(binding.password);
      const tokenResponse = page.waitForResponse(r => {
        const url = new URL(r.url());
        return url.origin === binding.supabaseOrigin && url.pathname === '/auth/v1/token';
      });
      await page.getByRole('button', { name: /Einloggen/u }).click();
      const auth = await tokenResponse;
      // Capture before checking status so finally can revoke any issued session.
      session = await auth.json();
      requireCondition(auth.ok(), 'LOGIN_FAILED');
      const apikey = auth.request().headers().apikey;
      session.apikey = apikey;
      requireCondition(typeof apikey === 'string' && !!session.access_token && !!session.refresh_token, 'SESSION_MISSING');
      requireCondition(session.user?.id === binding.userId && session.user.email?.toLowerCase() === binding.email.toLowerCase(), 'IDENTITY_REJECTED');
      const rows = await json(await context.request.get(`${binding.supabaseOrigin}/rest/v1/workspaces?select=id,name,owner_user_id,test_access_flags&owner_user_id=eq.${binding.userId}`, { headers: { apikey, Authorization: `Bearer ${session.access_token}` }, maxRedirects: 0, timeout: 20_000 }), 'WORKSPACE_READ_FAILED');
      verifyOperator(session.user, rows, binding);
      receipt.checks.operatorIdentity = 'PASS';
      receipt.checks.operatorWorkspace = 'PASS';
      await page.waitForURL(`${STAGING_ORIGIN}/dashboard`);
      requireCondition(await page.getByText(OPERATOR_NAME, { exact: true }).first().isVisible(), 'BROWSER_WORKSPACE_MISSING');
      receipt.checks.browserLogin = 'PASS';
      // Never reuse this context for other work or export its cookies.
      receipt.workspaceId = OPERATOR_WORKSPACE;
      receipt.blockedBrowserRequests = denied;
      receipt.status = 'REVIEW_PENDING';
    }
  }
} catch (error) {
  receipt.status = 'BLOCKED';
  receipt.blocker = /^STAGING_AGENT_[A-Z_]+$/u.test(error?.message || '') ? error.message : 'STAGING_AGENT_EXECUTION_FAILED';
} finally {
  if (context && session?.access_token && binding) {
    try {
      // Revoke only this run's refresh token, not every Operator/Owner session.
      const logout = await context.request.post(`${binding.supabaseOrigin}/auth/v1/logout?scope=local`, { headers: { apikey: session.apikey, Authorization: `Bearer ${session.access_token}` }, maxRedirects: 0, timeout: 20_000 });
      requireCondition(logout.ok(), 'LOGOUT_FAILED');
      const replay = await context.request.post(`${binding.supabaseOrigin}/auth/v1/token?grant_type=refresh_token`, { headers: { apikey: session.apikey, 'Content-Type': 'application/json' }, data: { refresh_token: session.refresh_token }, maxRedirects: 0, timeout: 20_000 });
      requireCondition([400, 401, 403].includes(replay.status()), 'REFRESH_REPLAY_ACCEPTED');
      receipt.checks.localSessionRevoked = 'PASS';
      // Clear server cookies through the normal CSRF-protected application route.
      const cleared = await context.request.delete(`${STAGING_ORIGIN}/api/auth/session`, { headers: { Origin: STAGING_ORIGIN }, maxRedirects: 0, timeout: 20_000 });
      requireCondition(cleared.ok(), 'COOKIE_CLEAR_FAILED');
      const protectedPage = await context.request.get(`${STAGING_ORIGIN}/dashboard`, { maxRedirects: 0, timeout: 20_000 });
      const location = new URL(protectedPage.headers().location || '/', STAGING_ORIGIN);
      requireCondition([302, 303, 307, 308].includes(protectedPage.status()) && location.origin === STAGING_ORIGIN && location.pathname === '/login', 'LOGOUT_READBACK_FAILED');
      receipt.checks.logoutReadback = 'PASS';
    } catch {
      cleanupFailed = true;
      receipt.status = 'BLOCKED';
      receipt.cleanupBlocker = 'STAGING_AGENT_SESSION_CLEANUP_UNVERIFIED';
    }
  }
  await context?.close().catch(() => { cleanupFailed = true; });
  await browser?.close().catch(() => { cleanupFailed = true; });
  if (cleanupFailed) receipt.status = 'BLOCKED';
  binding = undefined;
  session = undefined;
  receipt.finishedAt = new Date().toISOString();
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
  process.exitCode = receipt.status === 'BLOCKED' ? 2 : 0;
}

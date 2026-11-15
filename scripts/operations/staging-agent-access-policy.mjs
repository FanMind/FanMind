import { constants } from 'node:fs';
import { open, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';

import { STAGING_ORIGIN, OPERATOR_WORKSPACE, OPERATOR_NAME, OPERATOR_USER, STAGING_AUTH_ORIGIN, PRODUCTION_AUTH_ORIGIN } from '../../src/lib/stagingOperatorIdentity.mjs';
export { STAGING_ORIGIN, OPERATOR_WORKSPACE, OPERATOR_NAME, OPERATOR_USER, STAGING_AUTH_ORIGIN, PRODUCTION_AUTH_ORIGIN };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export function requireCondition(value, code) {
  if (!value) throw new Error(`STAGING_AGENT_${code}`);
}

export function validateBinding(binding, now = Date.now()) {
  requireCondition(binding && typeof binding === 'object' && !Array.isArray(binding), 'BINDING_INVALID');
  requireCondition(binding.origin === STAGING_ORIGIN, 'TARGET_REJECTED');
  requireCondition(binding.workspaceId === OPERATOR_WORKSPACE, 'WORKSPACE_REJECTED');
  requireCondition(uuid.test(binding.userId) && binding.userId === OPERATOR_USER, 'IDENTITY_MISSING');
  requireCondition(typeof binding.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(binding.email), 'EMAIL_INVALID');
  requireCondition(typeof binding.password === 'string' && binding.password.length >= 12, 'CREDENTIAL_MISSING');
  requireCondition(/^[0-9a-f]{40}$/u.test(binding.releaseCommit), 'RELEASE_MISSING');
  for (const key of ['supabaseOrigin', 'productionSupabaseOrigin']) {
    requireCondition(typeof binding[key] === 'string' && /^https:\/\/[a-z0-9]{20}\.supabase\.co$/u.test(binding[key]), 'AUTH_TARGET_INVALID');
  }
  requireCondition(binding.supabaseOrigin !== binding.productionSupabaseOrigin, 'AUTH_TARGET_REJECTED');
  requireCondition(binding.supabaseOrigin === STAGING_AUTH_ORIGIN && binding.productionSupabaseOrigin === PRODUCTION_AUTH_ORIGIN, 'AUTH_TARGET_REJECTED');
  const expires = Date.parse(binding.expiresAt);
  requireCondition(Number.isFinite(expires) && expires > now && expires <= now + 24 * 60 * 60 * 1000, 'LEASE_INVALID');
  // This assertion requires an independently verified, dedicated Staging identity.
  // It does not make an existing personal/admin account agent-scoped.
  requireCondition(binding.dedicatedStagingIdentityVerified === true, 'DEDICATED_IDENTITY_UNVERIFIED');
  return Object.freeze({ ...binding });
}

export async function readPrivateBinding(path, repositoryRoot) {
  requireCondition(typeof path === 'string' && isAbsolute(path), 'SECRET_BINDING_MISSING');
  const canonical = await realpath(path).catch(() => null);
  const root = await realpath(repositoryRoot);
  requireCondition(canonical === resolve(path), 'SECRET_PATH_REJECTED');
  const fromRoot = relative(root, canonical);
  requireCondition(fromRoot.startsWith('../'), 'SECRET_IN_REPOSITORY');
  const parent = await stat(dirname(canonical));
  requireCondition(parent.uid === process.getuid() && (parent.mode & 0o077) === 0, 'SECRET_DIRECTORY_REJECTED');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    requireCondition(stat.isFile() && stat.nlink === 1 && stat.uid === process.getuid() && (stat.mode & 0o777) === 0o600 && stat.size <= 8192, 'SECRET_PERMISSIONS_REJECTED');
    const body = await handle.readFile('utf8');
    requireCondition(Buffer.byteLength(body) <= 8192, 'SECRET_SIZE_REJECTED');
    let binding;
    try { binding = JSON.parse(body); } catch { throw new Error('STAGING_AGENT_BINDING_INVALID'); }
    return validateBinding(binding);
  } finally { await handle.close(); }
}

export function allowBrowserRequest(rawUrl, method, binding) {
  let url;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.username || url.password || url.port) return false;
  if (url.origin === STAGING_ORIGIN) {
    if (['GET', 'HEAD'].includes(method)) {
      // No GET logout route (global signout); no admin, OAuth, billing or writes.
      return /^\/_next\/(?:static|image)(?:\/|$)/u.test(url.pathname) ||
        ['/login', '/dashboard', '/api/version', '/favicon.ico'].includes(url.pathname);
    }
    return method === 'POST' && url.pathname === '/api/auth/session';
  }
  return url.origin === binding.supabaseOrigin && method === 'POST' &&
    url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'password';
}

export function verifyVersion(version, releaseCommit) {
  requireCondition(version?.application === 'fanmind' && version.runtimeEnvironment === 'staging', 'RUNTIME_REJECTED');
  requireCondition(version.releaseCommit === releaseCommit, 'RELEASE_MISMATCH');
}

export function verifyOperator(user, rows, binding) {
  requireCondition(user?.id === binding.userId && user.email?.toLowerCase() === binding.email.toLowerCase(), 'IDENTITY_REJECTED');
  requireCondition(Array.isArray(rows) && rows.length === 1 && rows[0].id === OPERATOR_WORKSPACE && rows[0].owner_user_id === binding.userId && rows[0].name === OPERATOR_NAME && rows[0].test_access_flags?.staging_operator_workspace === true, 'WORKSPACE_REJECTED');
}

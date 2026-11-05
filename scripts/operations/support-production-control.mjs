#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { constants, openSync, closeSync, fstatSync, readFileSync, writeFileSync, mkdtempSync, rmSync, renameSync, chownSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertReference, catalogueSql, roleBoundarySql, classify, REFERENCE_PATH } from './support-centre-schema.mjs';

export const PRODUCTION = 'drqkpdvtbbrrdwmtrodz';
export const ACTIONS = ['verify', 'owner', 'retention', 'monitor', 'activate'];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const EMAIL = /^[a-z0-9.!#$%&*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
const SHA = /^[a-f0-9]{40}$/;
const ENV_FILE = '/var/www/fanmind/.env.production';
const CURRENT = '/var/www/fanmind-current';
const literal = value => "'" + value.replaceAll("'", "''") + "'";
function fail(code) { throw new Error(code); }
export function readProductionFile(path, owners, modes, maxBytes) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || !owners.includes(stat.uid) || !modes.includes(stat.mode & 0o777) || stat.size < 1 || stat.size > maxBytes) fail('protected_file_invalid');
    const content = readFileSync(fd, 'utf8');
    const after = fstatSync(fd);
    if (after.dev !== stat.dev || after.ino !== stat.ino || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) fail('protected_file_changed');
    return { content, stat };
  } finally { closeSync(fd); }
}

export function targetFor(env, action, email) {
  if (!ACTIONS.includes(action) || !EMAIL.test(email ?? '')) fail('action_or_owner_invalid');
  if (env.GITHUB_REPOSITORY !== 'FanMind/FanMind' || env.GITHUB_REF !== 'refs/heads/main') fail('workflow_identity_invalid');
  if (!SHA.test(env.FANMIND_SUPPORT_REVIEWED_COMMIT ?? '') || (env.GITHUB_EVENT_NAME !== 'schedule' && env.FANMIND_SUPPORT_REVIEWED_COMMIT !== env.GITHUB_SHA)) fail('source_binding_invalid');
  if (env.FANMIND_RUNTIME_ENVIRONMENT !== 'production' || env.NEXT_PUBLIC_SUPABASE_URL !== `https://${PRODUCTION}.supabase.co` || env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') !== 'https://fanmind.ch') fail('production_target_invalid');
  if (env.GITHUB_EVENT_NAME === 'schedule') {
    if (!['retention', 'monitor'].includes(action) || env.FANMIND_SUPPORT_SCHEDULE_ENABLED !== 'true') fail('schedule_not_authorized');
  } else if (env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_ACTOR_ID !== '270165082' || env.FANMIND_SUPPORT_CONFIRM !== `support-production-${action}`) fail('confirmation_invalid');
  for (const key of ['PGPASSWORD', 'PGOPTIONS', 'PGHOSTADDR', 'PGSERVICE', 'PGSERVICEFILE', 'PGSYSCONFDIR']) if (env[key]) fail('database_redirect_invalid');
  const host = env.FANMIND_BACKUP_DB_HOST;
  const user = env.FANMIND_BACKUP_DB_USER;
  const direct = host === `db.${PRODUCTION}.supabase.co` && user === 'postgres';
  const pooler = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(host ?? '') && user === `postgres.${PRODUCTION}`;
  if ((!direct && !pooler) || (env.FANMIND_BACKUP_DB_PORT || '5432') !== '5432' || env.FANMIND_BACKUP_DB_NAME !== 'postgres') fail('database_binding_invalid');
  if (!/^\/etc\/fanmind-backup\/[a-zA-Z0-9_.-]+$/.test(env.FANMIND_BACKUP_PGPASSFILE ?? '')) fail('passfile_path_invalid');
  const emails = (env.FANMIND_ADMIN_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!emails.length || emails.some(s => !EMAIL.test(s))) fail('admin_allowlist_invalid');
  if (!emails.includes(email)) fail('owner_not_platform_admin');
  return { host, user, emails, email, commit: env.FANMIND_SUPPORT_REVIEWED_COMMIT };
}

export function ownerSql(target, write = false) {
  if (!UUID.test(target.uuid ?? '') || !target.emails?.length) fail('owner_input_invalid');
  const predicate = `id=${literal(target.uuid)}::uuid AND lower(email)=${literal(target.email)} AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<clock_timestamp()) AND lower(email) IN (${target.emails.map(literal).join(',')})`;
  const guard = `DO $owner_guard$ BEGIN IF NOT EXISTS(SELECT 1 FROM auth.users WHERE ${predicate}) OR EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id<>${literal(target.uuid)}::uuid) THEN RAISE EXCEPTION 'owner_binding_rejected'; END IF; END $owner_guard$;`;
  if (!write) return `BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; ${guard} SELECT EXISTS(SELECT 1 FROM public.support_centre_owners WHERE user_id=${literal(target.uuid)}::uuid); ROLLBACK;`;
  return `BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s'; SELECT pg_advisory_xact_lock(1350,1417); LOCK TABLE public.support_centre_owners IN SHARE ROW EXCLUSIVE MODE; ${guard} INSERT INTO public.support_centre_owners(user_id) VALUES (${literal(target.uuid)}::uuid) ON CONFLICT DO NOTHING; SELECT 1/(CASE WHEN (SELECT count(*) FROM public.support_centre_owners)=1 THEN 1 ELSE 0 END); COMMIT;`;
}

export function replaceSupportFlag(text, enabled) {
  const pattern = /^[ \t]*FANMIND_SUPPORT_CENTRE_ENABLED[ \t]*=.*$/gm;
  const matches = [...text.matchAll(pattern)];
  if (matches.length > 1 || matches.some(m => !/=[ \t]*(?:true|false)[ \t]*$/.test(m[0]))) fail('support_flag_ambiguous');
  const line = `FANMIND_SUPPORT_CENTRE_ENABLED=${enabled ? 'true' : 'false'}`;
  return matches.length ? text.replace(pattern, line) : text + (text.endsWith('\n') ? '' : '\n') + line + '\n';
}

function execute(bin, args, options = {}) {
  const result = spawnSync(bin, args, { encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'], ...options });
  if (result.error || result.status !== 0) fail('operation_failed');
  return result.stdout.trim();
}
function version() {
  return JSON.parse(execute('/usr/bin/curl', ['-fsS', '--max-time', '15', '--max-filesize', '16384', 'https://fanmind.ch/api/version']));
}
function requireLive(commit) {
  const live = version();
  if (live.application !== 'fanmind' || live.runtimeEnvironment !== 'production' || live.releaseCommit !== commit) fail('live_release_mismatch');
}
export function withActivationRollback(perform, verify, restore) {
  try { perform(); verify(); }
  catch {
    try { restore(); } catch { fail('activation_rollback_failed'); }
    fail('activation_failed_rolled_back');
  }
}
function activate(target, env) {
  if (env.FANMIND_SUPPORT_PRIVACY_READY !== 'true' || env.FANMIND_SUPPORT_SCHEDULE_ENABLED !== 'true') fail('operational_readiness_missing');
  if (env.FANMIND_SUPPORT_SCHEDULE_SOURCE !== target.commit || env.FANMIND_SUPPORT_SCHEDULE_OWNER !== target.email) fail('schedule_binding_missing');
  if (env.FANMIND_SUPPORT_ACCEPTANCE_COMMIT !== target.commit) fail('runtime_acceptance_required');
  requireLive(target.commit);
  const { stat, content: before } = readProductionFile(ENV_FILE, [0, Number(execute('/usr/bin/id', ['-u', 'ubuntu']))], [0o600, 0o640], 1048576);
  const after = replaceSupportFlag(before, true);
  const pm2 = ['/usr/bin/pm2', '/usr/local/bin/pm2'].find(p => { try { return lstatSync(p).isFile() || lstatSync(p).isSymbolicLink(); } catch { return false; } });
  if (!pm2) fail('pm2_missing');
  const reload = enabled => execute('/usr/bin/sudo', ['-n', '-u', 'ubuntu', '-H', '/usr/bin/env', `FANMIND_SUPPORT_CENTRE_ENABLED=${enabled ? 'true' : 'false'}`, `FANMIND_RELEASE_COMMIT=${target.commit}`, `FANMIND_CURRENT_RELEASE_LINK=${CURRENT}`, 'FANMIND_PM2_APP_NAME=fanmind', pm2, 'reload', `${CURRENT}/ops/pm2/fanmind.production.config.cjs`, '--only', 'fanmind', '--update-env']);
  const write = text => {
    const temp = `${ENV_FILE}.support-${process.pid}`;
    try { writeFileSync(temp, text, { mode: stat.mode & 0o777, flag: 'wx' }); chownSync(temp, stat.uid, stat.gid); renameSync(temp, ENV_FILE); }
    finally { rmSync(temp, { force: true }); }
  };
  withActivationRollback(() => { write(after); reload(true); }, () => {
    const processes = JSON.parse(execute('/usr/bin/sudo', ['-n', '-u', 'ubuntu', '-H', pm2, 'jlist'])).filter(p => p.name === 'fanmind');
    const app = processes[0]?.pm2_env;
    if (processes.length !== 1 || app?.status !== 'online' || app.exec_mode !== 'cluster_mode' || app.pm_cwd !== CURRENT || app.FANMIND_RELEASE_COMMIT !== target.commit || app.FANMIND_RUNTIME_ENVIRONMENT !== 'production' || app.FANMIND_SUPPORT_CENTRE_ENABLED !== 'true') fail('process_contract_failed');
    requireLive(target.commit);
    const health = JSON.parse(execute('/usr/bin/curl', ['-fsS', '--max-time', '15', '--max-filesize', '65536', 'https://fanmind.ch/api/health']));
    if (health.status !== 'healthy' || !Array.isArray(health.checks) || health.checks.length !== 8 || health.checks.some(c => c.status !== 'healthy')) fail('health_failed');
  }, () => { write(before); reload(env.FANMIND_SUPPORT_CENTRE_ENABLED === 'true'); });
}

export function runProductionControl(action, email, env = process.env) {
  const target = targetFor(env, action, email);
  if (typeof process.getuid !== 'function' || process.getuid() !== 0) fail('root_required');
  const checkout = readProductionFile('.support-reviewed-source', [0], [0o600], 41).content.trim();
  if (checkout !== target.commit) fail('checkout_mismatch');
  const reference = JSON.parse(readFileSync(REFERENCE_PATH, 'utf8')); assertReference(reference);
  const directory = mkdtempSync(join(tmpdir(), 'fanmind-support-production-'));
  let descriptor;
  try {
    descriptor = openSync(env.FANMIND_BACKUP_PGPASSFILE, constants.O_RDONLY | constants.O_NOFOLLOW);
    const original = fstatSync(descriptor);
    if (!original.isFile() || original.uid !== 0 || (original.mode & 0o777) !== 0o600 || original.size < 1 || original.size > 65536) fail('passfile_invalid');
    const passfile = join(directory, 'pgpass');
    writeFileSync(passfile, readFileSync(descriptor), { mode: 0o600, flag: 'wx' });
    const current = fstatSync(descriptor);
    if (current.ino !== original.ino || current.size !== original.size || current.mtimeMs !== original.mtimeMs || current.ctimeMs !== original.ctimeMs) fail('passfile_changed');
    const db = sql => execute('/usr/bin/psql', ['--no-password', '--no-psqlrc', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], { input: sql, env: { PATH: '/usr/bin:/bin', LANG: 'C', PGHOST: target.host, PGPORT: '5432', PGDATABASE: 'postgres', PGUSER: target.user, PGPASSFILE: passfile, PGSSLMODE: 'verify-full', PGSSLROOTCERT: resolve('config/certificates/supabase-root-2021-ca.crt'), PGCONNECT_TIMEOUT: '10', PGAPPNAME: 'fanmind-support-production' } });
    if (db(`BEGIN READ ONLY; ${roleBoundarySql()} ROLLBACK;`) !== 't') fail('role_boundary_invalid');
    const catalogue = JSON.parse(db(`BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; ${catalogueSql()} ROLLBACK;`));
    if (classify(catalogue, reference) !== 'EXACT') fail('schema_not_exact');
    const owners = JSON.parse(db(`BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; SELECT coalesce(jsonb_agg(id),'[]'::jsonb) FROM auth.users WHERE lower(email)=${literal(target.email)} AND email_confirmed_at IS NOT NULL AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<clock_timestamp()); ROLLBACK;`));
    if (!Array.isArray(owners) || owners.length !== 1 || !UUID.test(owners[0])) fail('owner_identity_invalid');
    target.uuid = owners[0];
    let bound = db(ownerSql(target)) === 't';
    if (action === 'owner') { db(ownerSql(target, true)); bound = db(ownerSql(target)) === 't'; }
    if (action !== 'verify' && !bound) fail('owner_not_bound');
    if (action === 'retention') {
      const live = version();
      if (live.application !== 'fanmind' || live.runtimeEnvironment !== 'production' || !SHA.test(live.releaseCommit ?? '')) fail('live_version_invalid');
      if (!/^[0-9]+$/.test(env.GITHUB_RUN_ID ?? '') || Number(env.GITHUB_RUN_ATTEMPT ?? 1) > 3) fail('run_identity_invalid');
      const hash = createHash('sha256').update(`support-production:${env.GITHUB_RUN_ID}`).digest('hex');
      const id = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
      const result = JSON.parse(db(`SELECT public.run_support_retention('${id}'::uuid,'${target.commit}',${Number(env.GITHUB_RUN_ATTEMPT ?? 1)>1});`));
      if (!['succeeded', 'already_completed'].includes(result.status)) fail('retention_failed');
    }
    if (['monitor', 'activate'].includes(action)) {
      if (db(`BEGIN READ ONLY; SELECT coalesce((SELECT status='succeeded' AND source_commit=${literal(target.commit)} AND completed_at>clock_timestamp()-interval '30 hours' FROM public.support_retention_runs ORDER BY started_at DESC LIMIT 1),false); ROLLBACK;`) !== 't') fail('retention_unhealthy');
    }
    if (action === 'activate') activate(target, env);
    console.log(`SUPPORT_PRODUCTION_${action.toUpperCase()}=PASS`);
    console.log(`SUPPORT_PRODUCTION_OWNER_BOUND=${bound}`);
  } finally { if (descriptor !== undefined) closeSync(descriptor); rmSync(directory, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { if (process.argv.length !== 4) fail('arguments_invalid'); runProductionControl(process.argv[2], process.argv[3]); }
  catch (error) { const code = error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : 'operation_failed'; console.error(`SUPPORT_PRODUCTION_ERROR=${code}`); process.exitCode = 1; }
}

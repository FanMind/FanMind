#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { access, constants, mkdir, mkdtemp, open, readFile, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { hostname, tmpdir } from 'node:os';
import { join, basename, dirname, isAbsolute, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { pipeline } from 'node:stream/promises';
import { pathToFileURL } from 'node:url';
import { verifyBackupArtifact } from './verify-backup-artifact.mjs';
import {
  analyzeAuthorizationToc,
  openDatabaseAuthorizationSnapshot,
  validateAuthorizationContract,
} from './database-authorization-contract.mjs';

const VERSION = 'phase5-backup-worker-6';
const JOBS = new Set(['backup_server_config','backup_database','backup_storage','backup_full','verify_backup']);
const SAFE_BACKUP_WORKER_ERROR_CODES = new Set([
  'archive_entry_escape_after_extract',
  'archive_entry_missing_after_extract',
  'archive_listing_mismatch',
  'authorization_container_recovery_invariant_invalid',
  'authorization_core_grant_matrix_invalid',
  'authorization_extension_class_unsupported',
  'authorization_extension_contract_invariant_invalid',
  'authorization_extension_recovery_invariant_invalid',
  'authorization_psql_start_failed',
  'authorization_query_failed',
  'authorization_query_output_invalid',
  'authorization_query_timeout',
  'authorization_security_definer_boundary_invalid',
  'authorization_snapshot_close_failed',
  'authorization_snapshot_closed',
  'authorization_snapshot_id_invalid',
  'backup_database_ca_changed_during_read',
  'backup_database_ca_invalid',
  'backup_database_ca_path_invalid',
  'backup_database_ca_read_failed',
  'backup_database_passfile_changed_during_read',
  'backup_database_passfile_invalid',
  'backup_database_passfile_path_invalid',
  'backup_database_passfile_read_failed',
  'database_authorization_toc_missing',
  'backup_artifact_outside_root',
  'backup_checksum_outside_root',
  'backup_checksum_pair_mismatch',
  'backup_destination_exists',
  'backup_run_sha256_mismatch',
  'backup_run_size_mismatch',
  'checksum_filename_mismatch',
  'checksum_mismatch',
  'duplicate_full_backup_part_type',
  'duplicate_storage_manifest_path',
  'file_changed_during_read',
  'file_not_readable',
  'file_not_regular',
  'file_read_failed',
  'file_size_invalid',
  'full_manifest_missing',
  'full_manifest_part_count_mismatch',
  'full_manifest_part_mismatch',
  'full_manifest_required_part_missing',
  'invalid_backup_type',
  'invalid_checksum_file',
  'invalid_full_manifest_part',
  'invalid_production_commit',
  'invalid_storage_manifest_entry',
  'job_type_not_allowed',
  'manifest_file_missing',
  'manifest_file_not_regular',
  'manifest_path_escape',
  'nested_full_backup_not_allowed',
  'offsite_checksum_upload_failed_cleanup_failed',
  'pm2_dump_file_unreadable',
  'sha256_mismatch_after_copy',
  'storage_bucket_mismatch',
  'storage_download_failed',
  'storage_downloaded_count_mismatch',
  'storage_duplicate_object_path',
  'storage_file_checksum_mismatch',
  'storage_file_size_mismatch',
  'storage_listed_count_mismatch',
  'storage_manifest_files_missing',
  'storage_manifest_missing',
  'storage_object_count_mismatch',
  'storage_pagination_guard_exceeded',
  'storage_total_size_mismatch',
  'stream_unavailable',
  'unknown_backup_type',
  'unsafe_archive_entry',
  'unsafe_archive_entry_type',
  'unsafe_extracted_entry_type',
  'unsafe_extracted_link_count',
  'unsupported_backup_type',
  'verifiable_backup_not_found',
  'verification_command_failed',
]);
const SAFE_BACKUP_WORKER_FALLBACK_CODES = new Set([
  'backup_claim_failed',
  'backup_worker_failed',
  'notification_persist_failed',
]);
const STORAGE_PAGE_SIZE = Math.min(Math.max(Number(process.env.FANMIND_STORAGE_BACKUP_PAGE_SIZE || 1000), 1), 1000);
const MAX_CAPTURED_COMMAND_STDOUT_BYTES = 32 * 1024 * 1024;
const MAX_BACKUP_DATABASE_PASSFILE_BYTES = 64 * 1024;
const MAX_BACKUP_DATABASE_CA_BYTES = 1024 * 1024;
const DEFAULT_BACKUP_DB_CA_CERT_PATH = '/usr/local/lib/fanmind-ops/supabase-root-2021-ca.crt';
function normalizeWorkerId(value) {
  const candidate = typeof value === 'string' ? value.trim() : '';
  if (/^fanmind-[a-z0-9-]{1,64}-backup-worker$/u.test(candidate)) return candidate;
  const host = String(hostname() || 'worker').toLowerCase().replace(/[^a-z0-9-]/gu, '-').slice(0, 48) || 'worker';
  return `fanmind-${host}-${process.pid}-backup-worker`;
}
const WORKER_ID = normalizeWorkerId(process.env.FANMIND_BACKUP_WORKER_ID);
const DEFAULT_BACKUP_POLL_MS = 30000;
const DEFAULT_BACKUP_HEARTBEAT_MS = 300000;
let stopping = false;
process.on('SIGTERM', () => { stopping = true; log('info', 'sigterm_received'); });
process.on('SIGINT', () => { stopping = true; log('info', 'sigint_received'); });

function required(name) { const value = process.env[name]; if (!value) throw new Error(`${name}_missing`); return value; }
function requireSupabaseUrl() { return required('NEXT_PUBLIC_SUPABASE_URL').replace(/\/$/,''); }
function requireServiceKey() { return required('SUPABASE_SERVICE_ROLE_KEY'); }
function backupWorkerErrorCode(error, fallback='backup_worker_failed') {
  const code = typeof error?.code === 'string' ? error.code : '';
  const message = error instanceof Error ? error.message : '';
  for (const candidate of [code, message]) {
    if (SAFE_BACKUP_WORKER_ERROR_CODES.has(candidate)) return candidate;
  }
  if (/^supabase_\d{3}$/u.test(message)) return 'supabase_request_failed';
  if (/^[A-Z][A-Z0-9_]{1,100}_missing$/u.test(message)) return 'backup_configuration_missing';
  if (/^[^\s]+_exit_-?\d+$/u.test(message)) return 'backup_process_failed';
  if (/^(?:EACCES|EEXIST|EIO|EISDIR|ELOOP|EMFILE|ENOENT|ENOSPC|ENOTDIR|EPERM|EROFS|EXDEV)$/u.test(code)) return 'backup_filesystem_failed';
  return SAFE_BACKUP_WORKER_FALLBACK_CODES.has(fallback)
    ? fallback
    : 'backup_worker_failed';
}
function log(level, event, meta = {}) { console.log(JSON.stringify({ ts:new Date().toISOString(), level, event, worker_id:WORKER_ID, ...redact(meta) })); }
function redact(value) { return JSON.parse(JSON.stringify(value, (k, v) => /key|secret|password|token|pgpass|authorization|dump/i.test(k) ? '[redacted]' : v)); }
function restUrl(table, query='') { return `${requireSupabaseUrl()}/rest/v1/${table}${query}`; }
function headers(extra={}) { const key = requireServiceKey(); return { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json', Prefer:'return=representation', ...extra }; }
async function api(path, init={}) { const r = await fetch(path, { ...init, headers: headers(init.headers || {}) }); if (!r.ok) throw new Error(`supabase_${r.status}`); return r.status === 204 ? null : r.json(); }
async function rpc(name, body) { return api(`${requireSupabaseUrl()}/rest/v1/rpc/${name}`, { method:'POST', body:JSON.stringify(body) }); }
function run(bin, args, opts={}) {
  return new Promise((resolvePromise, reject) => {
    const p = spawn(bin, args, {
      shell:false,
      stdio:['ignore','pipe','pipe'],
      env:opts.replaceEnv ? opts.env : {...process.env, ...(opts.env || {})},
      cwd:opts.cwd,
    });
    const stdoutChunks=[];
    let stdoutBytes=0;
    let settled=false;
    const finish=(error, value) => {
      if (settled) return;
      settled=true;
      if (error) reject(error);
      else resolvePromise(value);
    };
    p.stdout.on('data', chunk => {
      if (!opts.captureStdout || settled) return;
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_CAPTURED_COMMAND_STDOUT_BYTES) {
        finish(new Error(`${basename(bin)}_stdout_too_large`));
        p.kill('SIGTERM');
        return;
      }
      stdoutChunks.push(Buffer.from(chunk));
    });
    p.stderr.on('data', () => {});
    p.once('error', error => finish(error));
    p.once('close', code => {
      if (settled) return;
      if (code !== 0) {
        finish(new Error(`${basename(bin)}_exit_${code}`));
        return;
      }
      if (!opts.captureStdout) {
        finish(null, { stdout:'' });
        return;
      }
      try {
        const bytes=Buffer.concat(stdoutChunks, stdoutBytes);
        const stdout=new TextDecoder('utf-8', { fatal:true }).decode(bytes);
        bytes.fill(0);
        finish(null, { stdout });
      } catch {
        finish(new Error(`${basename(bin)}_stdout_invalid`));
      }
    });
  });
}
async function sha256(file) { const h = createHash('sha256'); await new Promise((res, rej) => createReadStream(file).on('data', d=>h.update(d)).on('error', rej).on('end', res)); return h.digest('hex'); }
async function size(file) { return (await stat(file)).size; }
function backupRoot() { return process.env.FANMIND_BACKUP_ROOT || '/var/backups/fanmind'; }
let fsHooks = { rename };
function __setBackupWorkerTestHooks(hooks = {}) { fsHooks = { rename, ...hooks }; }
async function pathExists(file) { try { await access(file, constants.F_OK); return true; } catch { return false; } }
async function assertNoFinalCollision(...files) { for (const file of files) { if (await pathExists(file)) throw new Error('backup_destination_exists'); } }
async function copyToPrivateTemp(source, target) {
  await pipeline(
    createReadStream(source),
    createWriteStream(target, { flags:'wx', mode:0o600 }),
  );
}
async function existsReadable(file) { await access(file, constants.R_OK); return file; }
async function insert(table, row) { return (await api(restUrl(table), { method:'POST', body:JSON.stringify(row) }))[0]; }
async function patch(table, id, row) { return api(restUrl(table, `?id=eq.${encodeURIComponent(id)}`), { method:'PATCH', body:JSON.stringify(row) }); }
async function notify(severity, title, message, source, technical_reference) { await insert('admin_notifications', { category:severity, severity, title, message, source, technical_reference, metadata:{ worker_id:WORKER_ID } }).catch(e => log('warn','notification_failed',{error_code:backupWorkerErrorCode(e, 'notification_persist_failed')})); }
async function audit(action, outcome, metadata={}) { await insert('operations_audit_log', { action, outcome, target_table:'admin_operation_jobs', severity: outcome === 'success' ? 'info' : 'warning', metadata }).catch(()=>{}); }
async function heartbeat(status='healthy') { await insert('system_health_events', { component:'backup_worker', status, severity:status==='healthy'?'info':'warning', summary:`Backup worker heartbeat: ${status}`, technical_reference:WORKER_ID, metadata:{ version:VERSION } }).catch(()=>{}); }
function parsePositiveInt(value, fallback) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function backupPollMs() { return parsePositiveInt(process.env.FANMIND_BACKUP_POLL_MS, DEFAULT_BACKUP_POLL_MS); }
function backupHeartbeatMs() { return parsePositiveInt(process.env.FANMIND_BACKUP_HEARTBEAT_MS, DEFAULT_BACKUP_HEARTBEAT_MS); }
function sleep(ms) { return new Promise(r=>setTimeout(r, ms)); }
function firstClaimResponseRow(response) { return Array.isArray(response) ? response[0] : response; }
function normalizeClaimedJob(response) { const job = firstClaimResponseRow(response); if (!job || typeof job !== 'object') return null; if (typeof job.id !== 'string' || job.id.trim() === '') return null; if (typeof job.job_type !== 'string') return null; if (!JOBS.has(job.job_type)) return null; return job; }
function isUnsupportedClaimedJob(response) { const job = firstClaimResponseRow(response); return Boolean(job && typeof job === 'object' && typeof job.id === 'string' && job.id.trim() !== '' && typeof job.job_type === 'string' && !JOBS.has(job.job_type)); }

async function encryptedFinalize(clearFile, type, manifest) { const recipientFile = required('FANMIND_BACKUP_PUBLIC_KEY_FILE'); const encrypted = `${clearFile}.age`; await run(process.env.FANMIND_AGE_BIN || 'age', ['-R', recipientFile, '-o', encrypted, clearFile]); await rm(clearFile, { force:true }); const checksum = await sha256(encrypted); const checksumFile = `${encrypted}.sha256`; await writeFile(checksumFile, `${checksum}  ${basename(encrypted)}\n`, { mode:0o600 }); const s = await size(encrypted); const formatVersion = manifest.format_version ?? 1; return { path:encrypted, checksum_path:checksumFile, sha256:checksum, size_bytes:s, manifest:{...manifest, encrypted:true, format_version:formatVersion, worker_version:VERSION, backup_type:type} }; }
async function tarValidate(file) { await run('tar', ['-tzf', file]); }
async function createServerConfig(tmp) { const out = join(tmp, `fanmind-server-config-${Date.now()}.tar.gz`); const pm2Dump = process.env.FANMIND_PM2_DUMP_FILE || '/home/ubuntu/.pm2/dump.pm2'; try { await existsReadable(pm2Dump); } catch { throw new Error('pm2_dump_file_unreadable'); } const paths = ['/var/www/fanmind/.env.production', pm2Dump, '/etc/nginx','/etc/systemd/system','/etc/fanmind-backup']; await run('tar', ['--ignore-failed-read','--warning=no-file-changed','-czf', out, ...paths]); await tarValidate(out); return encryptedFinalize(out, 'server_config', { included:['env_production','pm2_dump','nginx','systemd_units','sensitive_encrypted_config'], sensitive_encrypted_config:true }); }
async function readStableDatabaseConnectionFile(path, kind) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw new Error(`backup_database_${kind}_read_failed`);
  }
  try {
    const before = await handle.stat({ bigint:true });
    const currentUid = typeof process.getuid === 'function'
      ? BigInt(process.getuid())
      : -1n;
    const maximumBytes = kind === 'passfile'
      ? MAX_BACKUP_DATABASE_PASSFILE_BYTES
      : MAX_BACKUP_DATABASE_CA_BYTES;
    if (
      !before.isFile() ||
      before.nlink !== 1n ||
      before.uid !== currentUid ||
      before.size <= 0n ||
      before.size > BigInt(maximumBytes) ||
      (kind === 'passfile'
        ? (before.mode & 0o777n) !== 0o600n
        : (before.mode & 0o022n) !== 0n)
    ) {
      throw new Error(`backup_database_${kind}_invalid`);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint:true });
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.mode !== after.mode ||
      before.nlink !== after.nlink ||
      before.uid !== after.uid ||
      before.size !== after.size ||
      before.mtimeNs !== after.mtimeNs ||
      before.ctimeNs !== after.ctimeNs ||
      BigInt(bytes.length) !== before.size
    ) {
      bytes.fill(0);
      throw new Error(`backup_database_${kind}_changed_during_read`);
    }
    return bytes;
  } finally {
    await handle.close();
  }
}
async function databaseConnectionEnvironment(tmp) {
  const passfile = required('FANMIND_BACKUP_PGPASSFILE').trim();
  const caCertificate = (
    process.env.FANMIND_BACKUP_DB_CA_CERT_PATH ||
    DEFAULT_BACKUP_DB_CA_CERT_PATH
  ).trim();
  if (!isAbsolute(passfile)) throw new Error('backup_database_passfile_path_invalid');
  if (!isAbsolute(caCertificate)) throw new Error('backup_database_ca_path_invalid');
  const [passfileBytes, caBytes] = await Promise.all([
    readStableDatabaseConnectionFile(passfile, 'passfile'),
    readStableDatabaseConnectionFile(caCertificate, 'ca'),
  ]);
  const snapshotPassfile = join(tmp, '.fanmind-backup-database.pgpass');
  const snapshotCaCertificate = join(tmp, '.fanmind-backup-database-ca.pem');
  try {
    await Promise.all([
      writeFile(snapshotPassfile, passfileBytes, { flag:'wx', mode:0o600 }),
      writeFile(snapshotCaCertificate, caBytes, { flag:'wx', mode:0o600 }),
    ]);
  } finally {
    passfileBytes.fill(0);
    caBytes.fill(0);
  }
  const environment = {
    PATH: process.env.PATH || '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
    LANG: 'C',
    LC_ALL: 'C',
    PGAPPNAME: 'fanmind-backup-database',
    PGCONNECT_TIMEOUT: '10',
    PGGSSENCMODE: 'disable',
    PGPASSFILE: snapshotPassfile,
    PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: snapshotCaCertificate,
  };
  for (const [name, value] of Object.entries(process.env)) {
    if (name.startsWith('FANMIND_TEST_')) environment[name] = value;
  }
  return environment;
}
async function createDatabase(tmp) {
  const out = join(tmp, `fanmind-database-${Date.now()}.dump`);
  const env = await databaseConnectionEnvironment(tmp);
  const host = required('FANMIND_BACKUP_DB_HOST');
  const port = process.env.FANMIND_BACKUP_DB_PORT || '5432';
  const username = required('FANMIND_BACKUP_DB_USER');
  const database = required('FANMIND_BACKUP_DB_NAME');
  const authorizationSnapshot = await openDatabaseAuthorizationSnapshot({
    psqlBin: process.env.FANMIND_PSQL_BIN || '/usr/lib/postgresql/17/bin/psql',
    host,
    port,
    username,
    database,
    env,
  });
  try {
    await run(
      process.env.FANMIND_PG_DUMP_BIN || '/usr/lib/postgresql/17/bin/pg_dump',
      [
        '--format=custom',
        `--snapshot=${authorizationSnapshot.snapshotId}`,
        '--no-password',
        '--file',
        out,
        '--host',
        host,
        '--port',
        port,
        '--username',
        username,
        database,
      ],
      { env, replaceEnv:true },
    );
  } finally {
    await authorizationSnapshot.close();
  }

  const tocResult = await run(
    process.env.FANMIND_PG_RESTORE_BIN || '/usr/lib/postgresql/17/bin/pg_restore',
    ['--list', out],
    { env, captureStdout:true, replaceEnv:true },
  );
  const toc = analyzeAuthorizationToc(tocResult.stdout);
  if (toc.aclEntryCount <= 0 || toc.defaultAclEntryCount <= 0) {
    throw new Error('database_authorization_toc_missing');
  }
  const contract = validateAuthorizationContract(authorizationSnapshot.contract);
  const authorizationContract = {
    schema_version: contract.schemaVersion,
    canonicalization: contract.canonicalization,
    fingerprint_sha256: contract.fingerprintSha256,
    record_count: contract.recordCount,
    grant_tuple_count: contract.grantTupleCount,
    required_roles: contract.requiredRoles,
    required_roles_sha256: contract.requiredRolesSha256,
    role_fingerprint_sha256: contract.roleFingerprintSha256,
    role_record_count: contract.roleRecordCount,
    database_container_fingerprint_sha256:
      contract.databaseContainerFingerprintSha256,
    database_container_record_count: contract.databaseContainerRecordCount,
    required_extensions: contract.requiredExtensions,
    required_extensions_sha256: contract.requiredExtensionsSha256,
    extension_fingerprint_sha256: contract.extensionFingerprintSha256,
    extension_record_count: contract.extensionRecordCount,
    core_table_app_grant_tuple_count: contract.coreTableAppGrantTupleCount,
    restricted_security_definer_function_count:
      contract.restrictedSecurityDefinerFunctionCount,
    archive_acl_toc_entry_count: toc.aclEntryCount,
    archive_default_acl_toc_entry_count: toc.defaultAclEntryCount,
    archive_acl_toc_sha256: toc.sha256,
  };
  return encryptedFinalize(out, 'database', {
    pg_format:'custom',
    validated_with:'pg_restore --list',
    format_version:2,
    privileges_archived:true,
    ownership_archived:true,
    authorization_contract:authorizationContract,
  });
}
async function listStorage(prefix='', offset=0) { const body = { prefix, limit:STORAGE_PAGE_SIZE, offset, sortBy:{ column:'name', order:'asc' } }; const rows = await api(`${requireSupabaseUrl()}/storage/v1/object/list/fanmind-assets`, { method:'POST', body:JSON.stringify(body), headers:{ Authorization:`Bearer ${requireServiceKey()}`, apikey:requireServiceKey() } }); return rows || []; }
async function walkStorage(prefix='', acc=[], seen=new Set()) { for (let offset=0, guard=0;; offset += STORAGE_PAGE_SIZE, guard++) { if (guard > 10000) throw new Error('storage_pagination_guard_exceeded'); const page = (await listStorage(prefix, offset)).filter(item => item.name !== '.emptyFolderPlaceholder'); for (const item of page) { const path = prefix ? `${prefix}/${item.name}` : item.name; const isFolder = !item.id && !item.metadata?.size; if (isFolder) await walkStorage(path, acc, seen); else { if (seen.has(path)) throw new Error('storage_duplicate_object_path'); seen.add(path); acc.push({ path, ...item }); } } if (page.length < STORAGE_PAGE_SIZE) break; } return acc; }
async function createStorage(tmp) { const root = join(tmp, 'storage'); await mkdir(root, { recursive:true, mode:0o700 }); const objects = await walkStorage(); const files=[]; for (const obj of objects) { const r = await fetch(`${requireSupabaseUrl()}/storage/v1/object/fanmind-assets/${encodeURI(obj.path)}`, { headers:{ Authorization:`Bearer ${requireServiceKey()}`, apikey:requireServiceKey() } }); if (!r.ok) throw new Error('storage_download_failed'); const target = join(root, obj.path); await mkdir(dirname(target), { recursive:true, mode:0o700 }); await new Promise((res, rej) => { const w = createWriteStream(target, { mode:0o600 }); if (!r.body?.pipeTo) { rej(new Error('stream_unavailable')); return; } r.body.pipeTo(new WritableStream({ write(c){ w.write(Buffer.from(c)); }, close(){ w.end(); res(); }, abort:rej })).catch(rej); }); files.push({ path:obj.path, size:await size(target), content_type:obj.metadata?.mimetype || null, created_at:obj.created_at, updated_at:obj.updated_at, sha256:await sha256(target) }); }
 if (files.length !== objects.length) throw new Error('storage_object_count_mismatch'); const manifest = { bucket:'fanmind-assets', listed_object_count:objects.length, downloaded_object_count:files.length, object_count:files.length, total_size_bytes:files.reduce((a,f)=>a+f.size,0), files }; await writeFile(join(root,'manifest.json'), JSON.stringify(manifest,null,2), { mode:0o600 }); const out = join(tmp, `fanmind-storage-${Date.now()}.tar.gz`); await run('tar', ['-czf', out, '-C', root, '.']); await tarValidate(out); return encryptedFinalize(out, 'storage', manifest); }
async function createFull(tmp) { const fullDir = join(tmp, `fanmind-full-${Date.now()}`); await mkdir(fullDir, { recursive:true, mode:0o700 }); const parts=[]; for (const part of [await createServerConfig(tmp), await createDatabase(tmp), await createStorage(tmp)]) { const dest = join(fullDir, basename(part.path)); const sumDest = `${dest}.sha256`; await rename(part.path, dest); await rename(part.checksum_path, sumDest); parts.push({ ...part, path:dest, checksum_path:sumDest }); }
 const manifest = { created_at:new Date().toISOString(), production_commit:process.env.FANMIND_RELEASE_COMMIT || process.env.GITHUB_SHA || 'unknown', worker_version:VERSION, parts:parts.map(p=>({ file:basename(p.path), checksum_file:basename(p.checksum_path), sha256:p.sha256, size_bytes:p.size_bytes, manifest:p.manifest })) }; await writeFile(join(fullDir,'manifest.json'), JSON.stringify(manifest,null,2), { mode:0o600 }); const clear = join(tmp, `fanmind-full-${Date.now()}.tar.gz`); await run('tar', ['-czf', clear, '-C', fullDir, '.']); await tarValidate(clear); return encryptedFinalize(clear, 'full', manifest); }
async function placeBackupPair(result) {
  const root = backupRoot();
  await mkdir(root, { recursive:true, mode:0o700 });
  const final = join(root, basename(result.path));
  const checksumFinal = `${final}.sha256`;
  await assertNoFinalCollision(final, checksumFinal);

  const nonce = randomBytes(12).toString('hex');
  const tempArtifact = join(root, `.${basename(result.path)}.${nonce}.part`);
  const tempChecksum = join(root, `.${basename(result.checksum_path)}.${nonce}.part`);
  let checksumRenamed = false;
  let artifactRenamed = false;
  try {
    await copyToPrivateTemp(result.path, tempArtifact);
    await copyToPrivateTemp(result.checksum_path, tempChecksum);
    await existsReadable(tempArtifact);
    await existsReadable(tempChecksum);
    const actual = await sha256(tempArtifact);
    const expected = (await readFile(tempChecksum, 'utf8')).trim().split(/\s+/)[0];
    if (actual !== result.sha256 || actual !== expected) throw new Error('sha256_mismatch_after_copy');
    await assertNoFinalCollision(final, checksumFinal);
    await fsHooks.rename(tempChecksum, checksumFinal);
    checksumRenamed = true;
    await fsHooks.rename(tempArtifact, final);
    artifactRenamed = true;
    await existsReadable(final);
    await existsReadable(checksumFinal);
    await unlink(result.checksum_path);
    await unlink(result.path);
    return { final, checksumFinal };
  } catch (error) {
    await rm(tempArtifact, { force:true }).catch(()=>{});
    await rm(tempChecksum, { force:true }).catch(()=>{});
    if (checksumRenamed) await rm(checksumFinal, { force:true }).catch(()=>{});
    if (artifactRenamed) await rm(final, { force:true }).catch(()=>{});
    throw error;
  }
}
async function moveAndValidate(result) { return placeBackupPair(result); }
async function latestVerifiableBackupRun() {
  const rows = await api(restUrl('backup_runs', '?select=id,backup_type,status,storage_reference,checksum_reference,sha256,size_bytes,started_at&backup_type=neq.verification&status=in.(succeeded,offsite_pending,degraded,completed)&storage_reference=not.is.null&checksum_reference=not.is.null&order=started_at.desc&limit=1'));
  return Array.isArray(rows) ? rows[0] ?? null : null;
}
async function validatedLocalBackupPair(runRow) {
  if (!runRow || typeof runRow.storage_reference !== 'string' || typeof runRow.checksum_reference !== 'string') throw new Error('verifiable_backup_not_found');
  const root = await realpath(backupRoot());
  const artifact = await realpath(resolve(runRow.storage_reference));
  const checksum = await realpath(resolve(runRow.checksum_reference));
  const artifactRelative = relative(root, artifact);
  const checksumRelative = relative(root, checksum);
  if (!artifactRelative || artifactRelative.startsWith('..') || resolve(root, artifactRelative) !== artifact) throw new Error('backup_artifact_outside_root');
  if (!checksumRelative || checksumRelative.startsWith('..') || resolve(root, checksumRelative) !== checksum) throw new Error('backup_checksum_outside_root');
  if (checksum !== `${artifact}.sha256`) throw new Error('backup_checksum_pair_mismatch');
  return { artifact, checksum };
}
async function verifyLatestBackup(job) {
  const start = Date.now();
  const sourceRun = await latestVerifiableBackupRun();
  if (!sourceRun) throw new Error('verifiable_backup_not_found');
  let result;
  try {
    const pair = await validatedLocalBackupPair(sourceRun);
    result = await verifyBackupArtifact({ artifactPath:pair.artifact, checksumPath:pair.checksum });
    if (sourceRun.sha256 && sourceRun.sha256 !== result.checksum) throw new Error('backup_run_sha256_mismatch');
    if (sourceRun.size_bytes != null && Number(sourceRun.size_bytes) !== result.sizeBytes) throw new Error('backup_run_size_mismatch');
  } catch (error) {
    await patch('backup_runs', sourceRun.id, { validation_status:'failed' }).catch(()=>{});
    throw error;
  }
  const verificationRun = await insert('backup_runs', {
    backup_type:'verification', status:'succeeded', severity:'info', finished_at:new Date().toISOString(),
    validation_status:'passed', storage_reference:null, checksum_reference:null, sha256:result.checksum,
    size_bytes:result.sizeBytes, offsite_status:'skipped', job_id:job.id, worker_id:WORKER_ID,
    duration_ms:Date.now()-start, technical_reference:sourceRun.id,
    manifest:{ source_backup_run_id:sourceRun.id, source_backup_type:sourceRun.backup_type, mode:result.mode, artifact:result.artifact },
  });
  await patch('backup_runs', sourceRun.id, { validation_status:'passed' });
  await patch('admin_operation_jobs', job.id, { status:'succeeded', finished_at:new Date().toISOString(), result_reference:verificationRun.id, lease_until:null });
  await notify('info', 'Backup-Prüfung erfolgreich', `${sourceRun.backup_type} wurde checksum-only geprüft.`, 'backup_worker', verificationRun.id);
  await audit(job.job_type, 'success', { source_backup_run_id:sourceRun.id, verification_run_id:verificationRun.id, mode:result.mode });
  return verificationRun;
}

async function offsite(file) {
  if (process.env.FANMIND_BACKUP_OFFSITE_ENABLED !== 'true') return { status:'not_configured' };
  const remote = required('FANMIND_BACKUP_RCLONE_REMOTE');
  const remotePath = process.env.FANMIND_BACKUP_REMOTE_PATH || 'fanmind';
  const config = process.env.FANMIND_BACKUP_RCLONE_CONFIG;
  const rcloneBin = process.env.FANMIND_RCLONE_BIN || 'rclone';
  const reference = `${remote}:${remotePath}/${basename(file)}`;
  const mkArgs = (src) => [...(config ? ['--config', config] : []), 'copyto', src, `${remote}:${remotePath}/${basename(src)}`];

  await run(process.env.FANMIND_RCLONE_BIN || 'rclone', mkArgs(file));

  try {
    await run(process.env.FANMIND_RCLONE_BIN || 'rclone', mkArgs(`${file}.sha256`));
  } catch (error) {
    const cleanupArgs = [...(config ? ['--config', config] : []), 'deletefile', reference];
    try {
      await run(rcloneBin, cleanupArgs);
    } catch (cleanupError) {
      throw new AggregateError(
        [error, cleanupError],
        'offsite_checksum_upload_failed_cleanup_failed',
      );
    }
    throw error;
  }

  return {
    status:'uploaded',
    reference,
    checksum_reference:`${remote}:${remotePath}/${basename(file)}.sha256`,
  };
}
async function handle(job) { if (!JOBS.has(job.job_type)) throw new Error('job_type_not_allowed'); await patch('admin_operation_jobs', job.id, { status:'running', started_at:new Date().toISOString(), lease_until:new Date(Date.now()+900000).toISOString() }); if (job.job_type === 'verify_backup') { await verifyLatestBackup(job); return; } const tmp = await mkdtemp(join(tmpdir(), 'fanmind-backup-')); try { const start = Date.now(); let result; if (job.job_type === 'backup_server_config') result = await createServerConfig(tmp); else if (job.job_type === 'backup_database') result = await createDatabase(tmp); else if (job.job_type === 'backup_storage') result = await createStorage(tmp); else result = await createFull(tmp); const { final, checksumFinal } = await moveAndValidate(result); const off = await offsite(final).catch(() => ({ status:'failed' })); const status = off.status === 'not_configured' ? 'offsite_pending' : off.status === 'failed' ? 'degraded' : 'succeeded'; const runRow = await insert('backup_runs', { backup_type: result.manifest.backup_type, status, severity: status === 'succeeded' ? 'info':'warning', finished_at:new Date().toISOString(), storage_reference:final, checksum_reference:checksumFinal, sha256:result.sha256, size_bytes:result.size_bytes, validation_status:'passed', offsite_status:off.status, offsite_reference:off.reference || null, job_id:job.id, worker_id:WORKER_ID, duration_ms:Date.now()-start, manifest:{...result.manifest, checksum_reference:checksumFinal, offsite_checksum_reference:off.checksum_reference || null} }); await patch('admin_operation_jobs', job.id, { status:'succeeded', finished_at:new Date().toISOString(), result_reference:runRow.id, lease_until:null }); await notify(status === 'succeeded' ? 'info':'warning', status === 'succeeded' ? 'Backup erfolgreich' : 'Backup lokal erfolgreich, Offsite ausstehend', `${job.job_type} wurde verarbeitet.`, 'backup_worker', runRow.id); await audit(job.job_type, 'success', { backup_run_id:runRow.id, offsite_status:off.status }); } finally { await rm(tmp, { recursive:true, force:true }); } }
async function loop() { log('info','worker_start',{version:VERSION}); let lastHeartbeatAt = 0; while (!stopping) { const now = Date.now(); if (now - lastHeartbeatAt >= backupHeartbeatMs()) { await heartbeat(); lastHeartbeatAt = now; } const claimResponse = await rpc('claim_admin_backup_job', { p_worker_id:WORKER_ID, p_lease_seconds:900 }).catch(e => { log('warn','claim_failed',{error_code:backupWorkerErrorCode(e, 'backup_claim_failed')}); return null; }); const job = normalizeClaimedJob(claimResponse); if (!job) { if (isUnsupportedClaimedJob(claimResponse)) { const unsupportedJob = firstClaimResponseRow(claimResponse); const msg = 'job_type_not_allowed'; await patch('admin_operation_jobs', unsupportedJob.id, { status:'failed', finished_at:new Date().toISOString(), error_code:msg, error_message:msg, lease_until:null }).catch(()=>{}); log('warn','job_rejected',{job_id:unsupportedJob.id,error_code:msg}); } await sleep(backupPollMs()); continue; } log('info','job_claimed',{job_id:job.id, job_type:job.job_type}); try { await handle(job); } catch(e) { const errorCode = backupWorkerErrorCode(e); await patch('admin_operation_jobs', job.id, { status:'failed', finished_at:new Date().toISOString(), error_code:errorCode, error_message:errorCode, lease_until:null }).catch(()=>{}); await notify('critical','Backup fehlgeschlagen', `${job.job_type} ist fehlgeschlagen.`, 'backup_worker', job.id); await audit(job.job_type, 'failure', { error_code:errorCode }); log('error','job_failed',{job_id:job.id,error_code:errorCode}); } } log('info','worker_stop'); }
export { encryptedFinalize, createDatabase, createFull, createStorage, walkStorage, listStorage, placeBackupPair, moveAndValidate, offsite, createServerConfig, normalizeClaimedJob, normalizeWorkerId, backupPollMs, backupHeartbeatMs, backupWorkerErrorCode, validatedLocalBackupPair, verifyLatestBackup, __setBackupWorkerTestHooks, JOBS };
if (import.meta.url === pathToFileURL(process.argv[1]).href) loop().catch(e => { log('error','fatal',{error_code:backupWorkerErrorCode(e)}); process.exit(2); });

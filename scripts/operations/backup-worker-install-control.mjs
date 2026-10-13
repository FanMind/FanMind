#!/usr/bin/env node
import { constants } from 'node:fs';
import { open, lstat, realpath, mkdir, rename, chmod, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { APP_COMMIT, WORKER_COMMIT, FILES, request, authorization, connection,
  parseSelectedEnvironment, digest, fail, transition } from './backup-worker-install-policy.mjs';

const OPS = '/usr/local/lib/fanmind-ops';
const ROOT = '/var/lib/fanmind-backup-install';
const BUNDLE = `${ROOT}/bundles/${WORKER_COMMIT}`;
const RECORD = `${ROOT}/rollback/${WORKER_COMMIT}`;
const RELEASE = '/etc/fanmind-backup/release.env';
const UNIT = 'fanmind-backup-worker.service';
const ENV = { PATH:'/usr/lib/postgresql/17/bin:/usr/bin:/bin', LANG:'C', LC_ALL:'C' };
async function directory(path) {
  for (let p = path;; p = dirname(p)) {
    const s = await lstat(p);
    if (!s.isDirectory() || s.isSymbolicLink() || s.uid !== 0 || s.gid !== 0 ||
        (s.mode & 0o022) !== 0 || await realpath(p) !== p) fail('directory_untrusted');
    if (p === '/') break;
  }
}
async function bytes(path, mode, max = 2 * 1024 * 1024) {
  await directory(dirname(path));
  const fd = await open(path,constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const a = await fd.stat({bigint:true});
    if (!a.isFile() || a.nlink !== 1n || a.uid !== 0n || a.gid !== 0n ||
        (a.mode & 0o777n) !== BigInt(mode) || a.size <= 0n || a.size > BigInt(max)) fail('file_untrusted');
    const data = await fd.readFile(); const b = await fd.stat({bigint:true});
    if (a.dev !== b.dev || a.ino !== b.ino || a.size !== b.size || a.mtimeNs !== b.mtimeNs ||
        a.ctimeNs !== b.ctimeNs || BigInt(data.length) !== a.size) fail('file_changed');
    return data;
  } finally { await fd.close(); }
}
async function flushDirectory(path) { const fd = await open(path,constants.O_RDONLY); try { await fd.sync(); } finally { await fd.close(); } }
async function exclusive(path,data,mode=0o600) {
  const fd = await open(path,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,mode);
  try { await fd.writeFile(data); await fd.sync(); } finally { await fd.close(); }
}
async function atomic(path,data,mode) {
  await directory(dirname(path)); const temp = join(dirname(path),`.worker-install-${randomUUID()}`);
  try { await exclusive(temp,data); await chmod(temp,mode); await rename(temp,path); await flushDirectory(dirname(path)); }
  finally { try { await unlink(temp); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
}
function command(bin,args,input,env=ENV) {
  const r = spawnSync(bin,args,{input,env,encoding:'utf8',timeout:60000,maxBuffer:256*1024});
  if (r.error || r.status !== 0) fail('command_failed'); return r.stdout.trim();
}
async function live() {
  const r = await fetch('https://fanmind.ch/api/version',{signal:AbortSignal.timeout(15000),redirect:'error'});
  if (!r.ok) fail('application_unavailable'); const text = await r.text();
  if (text.length > 4096) fail('application_invalid'); const j = JSON.parse(text);
  if (j.application !== 'fanmind' || j.runtimeEnvironment !== 'production' || j.releaseCommit !== APP_COMMIT) fail('application_commit_changed');
}
async function main() {
  if (process.getuid?.() !== 0 || process.argv.length !== 6) fail('invocation_invalid');
  const input = request(...process.argv.slice(2)); // action, controller, worker, app
  const approved = authorization(JSON.parse((await bytes(`${ROOT}/authorization.json`,0o600,16384)).toString()),input);
  const controls = {
    'backup-worker-install-control.mjs': `${OPS}/backup-worker-install-control.mjs`,
    'backup-worker-install-policy.mjs': `${OPS}/backup-worker-install-policy.mjs`,
    'fanmind-backup-worker-control': '/usr/local/sbin/fanmind-backup-worker-control',
  };
  if (fileURLToPath(import.meta.url) !== controls['backup-worker-install-control.mjs']) fail('controller_location_invalid');
  for (const [name,path] of Object.entries(controls))
    if (digest(await bytes(path,0o750)) !== approved.controllerHashes[name]) fail('controller_hash_mismatch');
  await directory(ROOT); await directory(BUNDLE); await directory(`${ROOT}/rollback`);
  const newBytes = {};
  for (const [name,hash] of Object.entries(FILES)) {
    newBytes[name] = await bytes(join(BUNDLE,name),0o750);
    if (digest(newBytes[name]) !== hash) fail('bundle_hash_mismatch');
    command('/usr/bin/node',['--check',join(BUNDLE,name)]);
  }
  const releaseBytes = await bytes(RELEASE,0o600,4096);
  if (releaseBytes.toString() !== `FANMIND_RELEASE_COMMIT=${APP_COMMIT}\n`) fail('backup_application_binding_invalid');
  const configBytes = await bytes('/etc/fanmind-backup/worker.env',0o600,65536);
  const config = parseSelectedEnvironment(configBytes.toString()); configBytes.fill(0);
  const db = connection(config);
  // Freeze approved credentials and CA into a root-only private directory.
  // A connection-file rotation cannot split source observations across targets.
  const temp = `${ROOT}/.preflight-${randomUUID()}`;
  await mkdir(temp,{mode:0o700});
  try {
    const pass = await bytes(config.FANMIND_BACKUP_PGPASSFILE,0o600,65536);
    try { await exclusive(`${temp}/pgpass`,pass); } finally { pass.fill(0); }
    const ca = await bytes(config.FANMIND_BACKUP_DB_CA_CERT_PATH,0o644,131072);
    try { await exclusive(`${temp}/ca.pem`,ca); } finally { ca.fill(0); }
  const pgEnv = {...ENV,PGPASSFILE:`${temp}/pgpass`,PGSSLROOTCERT:`${temp}/ca.pem`,PGSSLMODE:'verify-full',
    PGGSSENCMODE:'disable',PGCONNECT_TIMEOUT:'10',PGAPPNAME:'fanmind-backup-worker-install-readonly'};
  let record;
  const recordPath = `${RECORD}/receipt.json`;
  async function state() {
    try {
      const value = JSON.parse((await bytes(recordPath,0o600,16384)).toString());
      if (value.schemaVersion !== 1 || value.workerCommit !== WORKER_COMMIT || value.applicationCommit !== APP_COMMIT ||
          value.controllerCommit !== input.controllerCommit || Object.keys(value.previousHashes ?? {}).sort().join('|') !== Object.keys(FILES).sort().join('|') ||
          Object.entries(approved.previousHashes).some(([k,v])=>value.previousHashes[k] !== v) ||
          value.releaseHash !== digest(releaseBytes) || !['PREPARED','APPLYING','INSTALLED','RECONCILIATION_REQUIRED','ROLLED_BACK'].includes(value.status)) fail('receipt_invalid');
      record = value; return record;
    } catch(e) { if (e.code === 'ENOENT') return null; throw e; }
  }
  async function queueEmpty() {
    const n = command('/usr/lib/postgresql/17/bin/psql',['--no-psqlrc','--no-password','--quiet','--tuples-only','--no-align',
      '--set=ON_ERROR_STOP=1','--host',db.host,'--port',db.port,'--username',db.username,'--dbname',db.database],
      "begin read only;set local statement_timeout='15s';select count(*) from public.admin_operation_jobs where job_type in ('backup_database','backup_full','backup_storage','backup_server_config','verify_backup') and status in ('queued','running');rollback;",pgEnv);
    if (n !== '0') fail('backup_jobs_active');
  }
  async function stableRelease() { if (digest(await bytes(RELEASE,0o600,4096)) !== digest(releaseBytes)) fail('backup_application_binding_changed'); }
  const module = await import(pathToFileURL(`${BUNDLE}/database-authorization-contract.mjs`).href);
  async function contract() {
    const c = await module.captureDatabaseAuthorizationContract({psqlBin:'/usr/lib/postgresql/17/bin/psql',...db,env:pgEnv});
    if (c.restrictedSecurityDefinerFunctionCount !== 13) fail('current_contract_required');
  }
  async function persist(status) {
    record = {...record,status,updatedAt:new Date().toISOString()};
    await atomic(recordPath,Buffer.from(JSON.stringify(record)),0o600);
  }
  async function checkSaved() {
    await state();
    for (const [name,hash] of Object.entries(approved.previousHashes))
      if (digest(await bytes(`${RECORD}/${name}`,0o600)) !== hash) fail('rollback_hash_mismatch');
    if (digest(await bytes(`${RECORD}/release.env`,0o600,4096)) !== digest(releaseBytes)) fail('rollback_release_mismatch');
  }
  async function checkFiles(version) {
    const hashes = version === 'new' ? FILES : approved.previousHashes;
    for (const [name,hash] of Object.entries(hashes)) if (digest(await bytes(`${OPS}/${name}`,0o750)) !== hash) fail('installed_hash_mismatch');
    await stableRelease();
  }
  async function service(allowInactive=false) {
    if (digest(await bytes('/etc/systemd/system/fanmind-backup-worker.service',0o644,65536)) !== approved.unitHash) fail('unit_hash_mismatch');
    command('/usr/bin/systemd-analyze',['verify','/etc/systemd/system/fanmind-backup-worker.service']);
    const props = command('/usr/bin/systemctl',['show',UNIT,'--property=FragmentPath,DropInPaths,WorkingDirectory,ExecStart,ActiveState,MainPID']);
    const entries = Object.fromEntries(props.split('\n').map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
    if (entries.FragmentPath !== '/etc/systemd/system/fanmind-backup-worker.service' || entries.DropInPaths !== '' ||
        entries.WorkingDirectory !== OPS || !entries.ExecStart?.includes(`argv[]=/usr/bin/node ${OPS}/backup-worker.mjs ;`) ||
        !entries.ExecStart.startsWith('{ path=/usr/bin/node ;')) fail('loaded_unit_invalid');
    if (entries.ActiveState === 'inactive' && allowInactive && entries.MainPID === '0') return;
    if (entries.ActiveState !== 'active' || !/^[1-9][0-9]*$/.test(entries.MainPID)) fail('worker_not_active');
    const cmd = await open(`/proc/${entries.MainPID}/cmdline`,constants.O_RDONLY | constants.O_NOFOLLOW);
    try { if ((await cmd.readFile()).toString() !== `/usr/bin/node\0${OPS}/backup-worker.mjs\0`) fail('worker_process_invalid'); }
    finally { await cmd.close(); }
  }
  const io = {
    state, persist, checkSaved, queueEmpty, checkFiles,
    authorize:async()=>{authorization(approved,input);},
    preflight:async()=>{ await live(); await contract(); await queueEmpty(); await service(input.action === 'rollback'); },
    snapshot:async()=>{
      await mkdir(RECORD,{mode:0o700});
      for (const name of Object.keys(FILES)) await exclusive(`${RECORD}/${name}`,await bytes(`${OPS}/${name}`,0o750));
      await exclusive(`${RECORD}/release.env`,releaseBytes);
      record = {schemaVersion:1,controllerCommit:input.controllerCommit,workerCommit:WORKER_COMMIT,applicationCommit:APP_COMMIT,
        previousHashes:approved.previousHashes,newHashes:FILES,releaseHash:digest(releaseBytes),createdAt:new Date().toISOString()};
      await persist('PREPARED'); await flushDirectory(`${ROOT}/rollback`);
    },
    stop:async()=>{command('/usr/bin/systemctl',['stop',UNIT]);},
    start:async()=>{command('/usr/bin/systemctl',['start',UNIT]);},
    checkKnownFiles:async()=>{ for (const [name,hash] of Object.entries(FILES)) {
      const current = digest(await bytes(`${OPS}/${name}`,0o750));
      if (current !== hash && current !== approved.previousHashes[name]) fail('unknown_partial_state');
    } await stableRelease(); },
    replace:async version=>{
      if (version === 'old') await checkSaved();
      for (const name of Object.keys(FILES)) {
        const data = version === 'new' ? newBytes[name] : await bytes(`${RECORD}/${name}`,0o600);
        await atomic(`${OPS}/${name}`,data,0o750);
      }
      // release.env is deliberately never written: App truth is not Worker source.
    },
    postflight:async()=>{await live();await stableRelease();await contract();
      await service();},
  };
    const result = await transition(input,io);
    console.log(`BACKUP_WORKER_CONTROL=${result}`);
    console.log(`BACKUP_WORKER_SOURCE_COMMIT=${WORKER_COMMIT}`);
    console.log(`BACKUP_APPLICATION_COMMIT=${APP_COMMIT}`);
  } finally {
    // Only this invocation's frozen secret copies are removed, never backups.
    for (const path of [`${temp}/pgpass`,`${temp}/ca.pem`]) { try {await unlink(path);} catch(e) {if(e.code!=='ENOENT')throw e;} }
    const { rmdir } = await import('node:fs/promises'); await rmdir(temp);
  }
}
try { await main(); } catch(e) {
  const safe = new Set(['reconciliation_required','installation_failed_rolled_back','backup_jobs_active','authorization_invalid',
    'application_commit_changed','current_contract_required','receipt_already_exists','rollback_receipt_missing']);
  console.error(`BACKUP_WORKER_CONTROL=BLOCK:${safe.has(e.code)?e.code:'preflight_or_io_failed'}`); process.exitCode=1;
}

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile, stat, readdir, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const fixtureRoot = await mkdtemp(join(tmpdir(), 'fanmind-backup-worker-fixture-'));
const requiredExtensions = [
  {
    name:'pgcrypto', version:'1.3', schema:'extensions', owner:'postgres',
    relocatable:true, schemaOwner:'postgres', schemaDefinitionArchived:true,
  },
  {
    name:'plpgsql', version:'1.0', schema:'pg_catalog', owner:'postgres',
    relocatable:false, schemaOwner:'postgres', schemaDefinitionArchived:false,
  },
];
const authorizationContractFrame = Buffer.from(JSON.stringify({
  server_version_num: 170006,
  fingerprint_sha256: 'a'.repeat(64),
  record_count: 500,
  grant_tuple_count: 420,
  required_roles: ['anon', 'authenticated', 'postgres', 'service_role'],
  role_fingerprint_sha256: 'c'.repeat(64),
  role_record_count: 5,
  database_container_fingerprint_sha256: 'd'.repeat(64),
  database_container_record_count: 11,
  required_extensions: requiredExtensions,
  extension_fingerprint_sha256: 'e'.repeat(64),
  extension_record_count: 84,
  extension_contract_invariant_violation_count: 0,
  extension_contract_unsupported_class_count: 0,
  core_table_app_grant_tuple_count: 120,
  core_table_app_grant_option_count: 0,
  core_table_app_grant_row_count: 120,
  container_recovery_invariant_violation_count: 0,
  extension_recovery_invariant_violation_count: 0,
  public_security_definer_function_count: 13,
  restricted_security_definer_function_count: 12,
  exposed_security_definer_exception_count: 1,
  hardened_security_definer_exception_count: 0,
  unsupported_default_acl_type_count: 0,
  unresolved_role_oid_count: 0,
}), 'utf8').toString('hex');
const authorizationToc = `${[
  '; Archive created by PostgreSQL 17',
  '10; 0 0 ACL public TABLE contacts postgres',
  '11; 826 20000 DEFAULT ACL public DEFAULT PRIVILEGES FOR TABLES postgres',
].join('\n')}\n`;
const snapshotCloseMarkerPath = join(fixtureRoot, 'snapshot-close.txt');

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://supabase.test';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
process.env.FANMIND_BACKUP_PUBLIC_KEY_FILE = join(fixtureRoot, 'recipient.txt');
process.env.FANMIND_AGE_BIN = join(fixtureRoot, 'age.sh');
process.env.FANMIND_PG_DUMP_BIN = join(fixtureRoot, 'pgdump.sh');
process.env.FANMIND_PG_RESTORE_BIN = join(fixtureRoot, 'pgrestore.sh');
process.env.FANMIND_PSQL_BIN = join(fixtureRoot, 'psql.sh');
process.env.FANMIND_BACKUP_PGPASSFILE = join(fixtureRoot, 'pgpass');
process.env.FANMIND_BACKUP_DB_CA_CERT_PATH = join(fixtureRoot, 'database-ca.pem');
process.env.FANMIND_TEST_EXPECTED_CA = process.env.FANMIND_BACKUP_DB_CA_CERT_PATH;
process.env.FANMIND_TEST_EXPECTED_PASSFILE = process.env.FANMIND_BACKUP_PGPASSFILE;
process.env.FANMIND_BACKUP_DB_HOST = 'db.test';
process.env.FANMIND_BACKUP_DB_USER = 'postgres';
process.env.FANMIND_BACKUP_DB_NAME = 'postgres';
process.env.FANMIND_STORAGE_BACKUP_PAGE_SIZE = '2';

await writeFile(process.env.FANMIND_BACKUP_PUBLIC_KEY_FILE, 'age1test');
await writeFile(process.env.FANMIND_BACKUP_PGPASSFILE, 'localhost:*:*:*:x', { mode:0o600 });
await writeFile(process.env.FANMIND_BACKUP_DB_CA_CERT_PATH, 'synthetic-ca\n', { mode:0o644 });
await writeFile(process.env.FANMIND_AGE_BIN, '#!/usr/bin/env bash\nout=""\nwhile [[ $# -gt 0 ]]; do if [[ "$1" == "-o" ]]; then out="$2"; shift 2; else last="$1"; shift; fi; done\nprintf "AGE-ENCRYPTED\\n" > "$out"\ncat "$last" >> "$out"\n', { mode:0o755 });
await writeFile(process.env.FANMIND_PG_DUMP_BIN, '#!/usr/bin/env bash\nset -Eeuo pipefail\n[[ "${PGSSLMODE:-}" == "verify-full" ]]\n[[ "${PGGSSENCMODE:-}" == "disable" ]]\n[[ "${PGSSLROOTCERT:-}" != "${FANMIND_TEST_EXPECTED_CA:-}" ]]\n[[ "${PGPASSFILE:-}" != "${FANMIND_TEST_EXPECTED_PASSFILE:-}" ]]\n[[ "$(stat -c %a "$PGSSLROOTCERT")" == "600" ]]\n[[ "$(stat -c %a "$PGPASSFILE")" == "600" ]]\ncmp -s "$PGSSLROOTCERT" "$FANMIND_TEST_EXPECTED_CA"\ncmp -s "$PGPASSFILE" "$FANMIND_TEST_EXPECTED_PASSFILE"\n[[ -z "${PGHOSTADDR+x}" && -z "${PGSERVICE+x}" && -z "${PGPASSWORD+x}" ]]\nif [[ -n "${FANMIND_TEST_PG_DUMP_CAPTURE:-}" ]]; then printf "%q " "$@" > "$FANMIND_TEST_PG_DUMP_CAPTURE"; fi\nfor ((i=1;i<=$#;i++)); do if [[ "${!i}" == "--file" ]]; then j=$((i+1)); printf "PGDUMP" > "${!j}"; fi; done\n', { mode:0o755 });
await writeFile(process.env.FANMIND_PG_RESTORE_BIN, `#!/usr/bin/env bash
set -Eeuo pipefail
[[ "\${1:-}" == "--list" ]]
[[ "\${PGSSLROOTCERT:-}" != "\${FANMIND_TEST_EXPECTED_CA:-}" ]]
[[ "\${PGPASSFILE:-}" != "\${FANMIND_TEST_EXPECTED_PASSFILE:-}" ]]
cmp -s "\$PGSSLROOTCERT" "\$FANMIND_TEST_EXPECTED_CA"
cmp -s "\$PGPASSFILE" "\$FANMIND_TEST_EXPECTED_PASSFILE"
if [[ "\${FANMIND_TEST_AUTHORIZATION_TOC_MODE:-}" == "missing" ]]; then
  printf '; Archive created by PostgreSQL 17\\n'
  exit 0
fi
cat <<'FANMIND_AUTHORIZATION_TOC'
${authorizationToc}FANMIND_AUTHORIZATION_TOC
`, { mode:0o755 });
await writeFile(process.env.FANMIND_PSQL_BIN, `#!/usr/bin/env bash
set -Eeuo pipefail
[[ "\${PGSSLMODE:-}" == "verify-full" ]]
[[ "\${PGGSSENCMODE:-}" == "disable" ]]
[[ "\${PGSSLROOTCERT:-}" != "\${FANMIND_TEST_EXPECTED_CA:-}" ]]
[[ "\${PGPASSFILE:-}" != "\${FANMIND_TEST_EXPECTED_PASSFILE:-}" ]]
[[ "$(stat -c %a "\$PGSSLROOTCERT")" == "600" ]]
[[ "$(stat -c %a "\$PGPASSFILE")" == "600" ]]
cmp -s "\$PGSSLROOTCERT" "\$FANMIND_TEST_EXPECTED_CA"
cmp -s "\$PGPASSFILE" "\$FANMIND_TEST_EXPECTED_PASSFILE"
[[ -z "\${PGHOSTADDR+x}" && -z "\${PGSERVICE+x}" && -z "\${PGPASSWORD+x}" ]]
while IFS= read -r line; do
  case "$line" in
    *pg_export_snapshot*) printf 'FANMIND_SNAPSHOT|00000001-00000002-1\\n' ;;
    *FANMIND_AUTHORIZATION_FRAME*) printf 'FANMIND_AUTHORIZATION|${authorizationContractFrame}\\n' ;;
    *FANMIND_READY*) printf 'FANMIND_READY\\n' ;;
    *[Rr][Oo][Ll][Ll][Bb][Aa][Cc][Kk]*) printf 'closed\\n' >> '${snapshotCloseMarkerPath}'; exit 0 ;;
  esac
done
`, { mode:0o755 });

after(async () => {
  await rm(fixtureRoot, { recursive:true, force:true });
});

const execFileAsync = promisify(execFile);

const worker = await import('../scripts/operations/backup-worker.mjs');
const workerSource = await readFile(new URL('../scripts/operations/backup-worker.mjs', import.meta.url), 'utf8');
const releaseEnvHelper = new URL('../scripts/operations/write-backup-release-env.sh', import.meta.url);
const backupWorkerUnit = await readFile(new URL('../ops/systemd/fanmind-backup-worker.service', import.meta.url), 'utf8');
const deployWorkflow = await readFile(new URL('../.github/workflows/deploy-fanmind.yml', import.meta.url), 'utf8');

async function makePlacedPairFixture(tmp, name = 'artifact.dump.age', payload = 'payload') {
  const src = join(tmp, 'src');
  const root = join(tmp, 'dest');
  await import('node:fs/promises').then(fs => fs.mkdir(src, { recursive:true, mode:0o700 }));
  process.env.FANMIND_BACKUP_ROOT = root;
  const artifact = join(src, name);
  await writeFile(artifact, payload, { mode:0o600 });
  const sha = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const checksum = [...new Uint8Array(sha)].map(b => b.toString(16).padStart(2, '0')).join('');
  const checksumPath = `${artifact}.sha256`;
  await writeFile(checksumPath, `${checksum}  ${basename(artifact)}\n`, { mode:0o600 });
  return { root, result:{ path:artifact, checksum_path:checksumPath, sha256:checksum, size_bytes:payload.length, manifest:{ backup_type:'database' } } };
}

async function listRoot(root) {
  try { return (await readdir(root)).sort(); } catch { return []; }
}

const migration = await readFile(new URL('../supabase/migrations/20260711161500_disable_verify_backup_until_safe_validation.sql', import.meta.url), 'utf8');

const serviceRoleGrantMigration = await readFile(new URL('../supabase/migrations/20260711170000_grant_backup_worker_rpc_service_role.sql', import.meta.url), 'utf8');
const enableVerificationMigration = await readFile(new URL('../supabase/migrations/20260718173000_enable_safe_backup_verification.sql', import.meta.url), 'utf8');
const rpcPermissionProof = await readFile(new URL('./backup-worker-rpc-permissions.sql', import.meta.url), 'utf8');

test('database backup archives ownership and privileges from one frozen snapshot', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-database-contract-'));
  const capturePath = join(tmp, 'pg-dump-args.txt');
  const previousCapture = process.env.FANMIND_TEST_PG_DUMP_CAPTURE;
  const inheritedLibpq = new Map([
    ['PGHOSTADDR', process.env.PGHOSTADDR],
    ['PGSERVICE', process.env.PGSERVICE],
    ['PGPASSWORD', process.env.PGPASSWORD],
    ['PGSSLMODE', process.env.PGSSLMODE],
  ]);
  process.env.FANMIND_TEST_PG_DUMP_CAPTURE = capturePath;
  process.env.PGHOSTADDR = '203.0.113.77';
  process.env.PGSERVICE = 'redirected-source';
  process.env.PGPASSWORD = 'must-not-reach-libpq';
  process.env.PGSSLMODE = 'disable';
  await writeFile(snapshotCloseMarkerPath, '');
  try {
    const result = await worker.createDatabase(tmp);
    const args = await readFile(capturePath, 'utf8');
    assert.match(args, /--format=custom/u);
    assert.match(args, /--snapshot=00000001-00000002-1/u);
    assert.match(args, /--no-password/u);
    assert.doesNotMatch(args, /--no-owner|--no-privileges/u);
    assert.equal(result.manifest.format_version, 2);
    assert.equal(result.manifest.worker_version, 'phase5-backup-worker-6');
    assert.equal(result.manifest.privileges_archived, true);
    assert.equal(result.manifest.ownership_archived, true);
    assert.deepEqual(result.manifest.authorization_contract, {
      schema_version: 2,
      canonicalization: 'postgresql-17-acl-json-array-hex-v2',
      fingerprint_sha256: 'a'.repeat(64),
      record_count: 500,
      grant_tuple_count: 420,
      required_roles: ['anon', 'authenticated', 'postgres', 'service_role'],
      required_roles_sha256:
        result.manifest.authorization_contract.required_roles_sha256,
      role_fingerprint_sha256: 'c'.repeat(64),
      role_record_count: 5,
      database_container_fingerprint_sha256: 'd'.repeat(64),
      database_container_record_count: 11,
      required_extensions: requiredExtensions,
      required_extensions_sha256:
        result.manifest.authorization_contract.required_extensions_sha256,
      extension_fingerprint_sha256: 'e'.repeat(64),
      extension_record_count: 84,
      core_table_app_grant_tuple_count: 120,
      restricted_security_definer_function_count: 12,
      archive_acl_toc_entry_count: 1,
      archive_default_acl_toc_entry_count: 1,
      archive_acl_toc_sha256:
        result.manifest.authorization_contract.archive_acl_toc_sha256,
    });
    assert.match(
      result.manifest.authorization_contract.required_roles_sha256,
      /^[0-9a-f]{64}$/u,
    );
    assert.match(
      result.manifest.authorization_contract.archive_acl_toc_sha256,
      /^[0-9a-f]{64}$/u,
    );
    assert.match(
      result.manifest.authorization_contract.role_fingerprint_sha256,
      /^[0-9a-f]{64}$/u,
    );
    assert.equal(await readFile(snapshotCloseMarkerPath, 'utf8'), 'closed\n');
  } finally {
    if (previousCapture === undefined) delete process.env.FANMIND_TEST_PG_DUMP_CAPTURE;
    else process.env.FANMIND_TEST_PG_DUMP_CAPTURE = previousCapture;
    for (const [name, value] of inheritedLibpq) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await rm(tmp, { recursive:true, force:true });
  }
});

test('database backup source contains no privilege or ownership omission flags', () => {
  assert.doesNotMatch(
    workerSource.match(/async function createDatabase[\s\S]*?async function listStorage/u)?.[0] ?? '',
    /--no-owner|--no-privileges/u,
  );
});

test('database backup fails before encryption without ACL and default-ACL TOC evidence', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-database-no-acl-'));
  const previousMode = process.env.FANMIND_TEST_AUTHORIZATION_TOC_MODE;
  process.env.FANMIND_TEST_AUTHORIZATION_TOC_MODE = 'missing';
  try {
    await assert.rejects(
      () => worker.createDatabase(tmp),
      /database_authorization_toc_missing/u,
    );
    assert.deepEqual(
      (await readdir(tmp)).filter(name => name.endsWith('.age')),
      [],
    );
  } finally {
    if (previousMode === undefined) delete process.env.FANMIND_TEST_AUTHORIZATION_TOC_MODE;
    else process.env.FANMIND_TEST_AUTHORIZATION_TOC_MODE = previousMode;
    await rm(tmp, { recursive:true, force:true });
  }
});

test('backup worker persists and logs only fixed error codes', () => {
  assert.equal(
    worker.normalizeWorkerId('fanmind-prod-01-backup-worker'),
    'fanmind-prod-01-backup-worker',
  );
  assert.match(
    worker.normalizeWorkerId('token=live-secret'),
    /^fanmind-[a-z0-9-]+-backup-worker$/u,
  );
  assert.doesNotMatch(
    worker.normalizeWorkerId('token=live-secret'),
    /token|live-secret/u,
  );
  assert.equal(
    worker.backupWorkerErrorCode(new Error('invalid_checksum_file')),
    'invalid_checksum_file',
  );
  assert.equal(
    worker.backupWorkerErrorCode(new Error('supabase_503')),
    'supabase_request_failed',
  );
  assert.equal(
    worker.backupWorkerErrorCode(new Error('SUPABASE_SERVICE_ROLE_KEY_missing')),
    'backup_configuration_missing',
  );
  assert.equal(
    worker.backupWorkerErrorCode(new Error('/private/bin/secret-tool_exit_9')),
    'backup_process_failed',
  );
  assert.equal(
    worker.backupWorkerErrorCode(
      Object.assign(new Error('/private/backups/customer.dump.age'), { code:'EACCES' }),
    ),
    'backup_filesystem_failed',
  );
  const sensitive = 'token=live-secret\nurl=https://private.example/customer';
  assert.equal(
    worker.backupWorkerErrorCode(new Error(sensitive)),
    'backup_worker_failed',
  );
  assert.equal(
    worker.backupWorkerErrorCode(new Error(sensitive), 'backup_claim_failed'),
    'backup_claim_failed',
  );
  assert.equal(
    worker.backupWorkerErrorCode(new Error(sensitive), sensitive),
    'backup_worker_failed',
  );
  assert.doesNotMatch(workerSource, /error\s*:\s*e\.message/u);
  assert.doesNotMatch(workerSource, /error_message\s*:\s*e\.message/u);
});



test('backup release env helper writes one root-only release commit line atomically', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-release-env-'));
  const target = join(tmp, 'release.env');
  const first = '0123456789abcdef0123456789abcdef01234567';
  const second = 'fedcba9876543210fedcba9876543210fedcba98';

  const firstRun = await execFileAsync('bash', [releaseEnvHelper.pathname, first, target]);
  assert.match(firstRun.stdout, /Backup release commit recorded: 0123456789ab/);
  assert.equal(await readFile(target, 'utf8'), `FANMIND_RELEASE_COMMIT=${first}\n`);
  assert.equal((await stat(target)).mode & 0o777, 0o600);
  assert.deepEqual((await readdir(tmp)).filter(name => name.includes('.tmp.')), []);

  await execFileAsync('bash', [releaseEnvHelper.pathname, second, target]);
  assert.equal(await readFile(target, 'utf8'), `FANMIND_RELEASE_COMMIT=${second}\n`);
  assert.deepEqual((await readdir(tmp)).filter(name => name.includes('.tmp.')), []);
});

test('backup release env helper rejects invalid release commit values without temp files', async () => {
  const invalidValues = ['', 'abc1234', 'ABCDEF0123456789ABCDEF0123456789ABCDEF01', '0123456789abcdef0123456789abcdef01234567x', '0123456789abcdef0123456789abcdef0123456;', '0123456789abcdef0123\n456789abcdef01234567'];

  for (const value of invalidValues) {
    const tmp = await mkdtemp(join(tmpdir(), 'fanmind-release-env-bad-'));
    const target = join(tmp, 'release.env');
    await assert.rejects(() => execFileAsync('bash', [releaseEnvHelper.pathname, value, target]), /release commit must be a full 40-character lowercase git SHA/);
    await assert.rejects(() => access(target), /ENOENT/);
    assert.deepEqual((await readdir(tmp)).filter(name => name.includes('.tmp.')), []);
  }
});

test('systemd unit loads optional release env after required worker env and keeps hardening', () => {
  const workerEnvIndex = backupWorkerUnit.indexOf('EnvironmentFile=/etc/fanmind-backup/worker.env');
  const releaseEnvIndex = backupWorkerUnit.indexOf('EnvironmentFile=-/etc/fanmind-backup/release.env');
  assert.ok(workerEnvIndex >= 0);
  assert.ok(releaseEnvIndex > workerEnvIndex);
  assert.match(backupWorkerUnit, /PrivateTmp=true/);
  assert.match(backupWorkerUnit, /ProtectSystem=strict/);
  assert.match(backupWorkerUnit, /NoNewPrivileges=true/);
});

test('deployment workflow records a verified release only after either deployment path succeeds', () => {
  const indexOfRequired = (needle) => {
    const index = deployWorkflow.indexOf(needle);
    assert.notEqual(index, -1, `Missing workflow command: ${needle}`);
    return index;
  };

  const expectedCommitIndex = indexOfRequired(
    'EXPECTED_RELEASE_COMMIT: ${{ github.sha }}',
  );
  const commitValidationIndex = indexOfRequired('^[0-9a-f]{40}$');
  const fetchIndex = indexOfRequired('git fetch --prune origin main');
  const ancestryIndex = indexOfRequired(
    'git merge-base --is-ancestor "$EXPECTED_RELEASE_COMMIT" origin/main',
  );
  const releaseCommitIndex = indexOfRequired(
    'RELEASE_COMMIT="$EXPECTED_RELEASE_COMMIT"',
  );
  const isolatedGateIndex = indexOfRequired('ISOLATED_DEPLOY_ENABLED="false"');
  const isolatedDeployIndex = indexOfRequired('bash "$DEPLOY_SCRIPT" "$RELEASE_COMMIT"');
  const resetIndex = indexOfRequired('git reset --hard "$RELEASE_COMMIT"');
  const npmCiIndex = indexOfRequired('npm ci --no-audit --no-fund');
  const buildIndex = indexOfRequired('npm run build');
  const pm2StartIndex = indexOfRequired('pm2 start npm --name fanmind --cwd "$SOURCE_DIR" -- start');
  const nginxIndex = indexOfRequired('sudo nginx -t');
  const healthcheckIndex = indexOfRequired('Health check passed.');
  const sourceSyncCheckIndex = indexOfRequired('Source checkout is not synchronized after deployment.');
  const helperInstallIndex = indexOfRequired('sudo install -o root -g root -m 0755 scripts/operations/write-backup-release-env.sh /usr/local/lib/fanmind-ops/write-backup-release-env.sh');
  const caInstallIndex = indexOfRequired('sudo install -o root -g root -m 0644 config/certificates/supabase-root-2021-ca.crt /usr/local/lib/fanmind-ops/supabase-root-2021-ca.crt');
  const authorizationHelperInstallIndex = indexOfRequired('sudo install -o root -g root -m 0750 scripts/operations/database-authorization-contract.mjs /usr/local/lib/fanmind-ops/database-authorization-contract.mjs');
  const backupWorkerInstallIndex = indexOfRequired('sudo install -o root -g root -m 0750 scripts/operations/backup-worker.mjs /usr/local/lib/fanmind-ops/backup-worker.mjs');
  const unitInstallIndex = indexOfRequired('sudo install -o root -g root -m 0644 ops/systemd/fanmind-backup-worker.service /etc/systemd/system/fanmind-backup-worker.service');
  const daemonReloadIndex = indexOfRequired('sudo systemctl daemon-reload');
  const releaseWriteIndex = indexOfRequired('sudo /usr/local/lib/fanmind-ops/write-backup-release-env.sh "$RELEASE_COMMIT"');
  const workerActiveCheckIndex = indexOfRequired('sudo systemctl is-active --quiet fanmind-backup-worker.service');
  const workerRestartIndex = indexOfRequired('sudo systemctl restart fanmind-backup-worker.service');
  const inactiveWorkerMessageIndex = indexOfRequired('Backup worker is not active; not starting it.');

  assert.ok(expectedCommitIndex < commitValidationIndex);
  assert.ok(commitValidationIndex < fetchIndex);
  assert.ok(fetchIndex < ancestryIndex);
  assert.ok(ancestryIndex < releaseCommitIndex);
  assert.ok(releaseCommitIndex < isolatedGateIndex, 'deployment mode is selected only after exact commit binding');
  assert.ok(isolatedGateIndex < isolatedDeployIndex, 'isolated deployment remains behind its explicit gate');
  assert.ok(isolatedGateIndex < resetIndex, 'legacy reset remains in the disabled branch');
  assert.ok(resetIndex < npmCiIndex);
  assert.ok(npmCiIndex < buildIndex);
  assert.ok(buildIndex < pm2StartIndex);
  assert.ok(pm2StartIndex < nginxIndex);
  assert.ok(nginxIndex < healthcheckIndex);
  assert.ok(isolatedDeployIndex < sourceSyncCheckIndex, 'the isolated script must return successfully before common post-deploy work');
  assert.ok(healthcheckIndex < sourceSyncCheckIndex, 'legacy healthcheck must pass before common post-deploy work');
  assert.ok(sourceSyncCheckIndex < helperInstallIndex);
  assert.ok(helperInstallIndex < caInstallIndex);
  assert.ok(caInstallIndex < authorizationHelperInstallIndex);
  assert.ok(authorizationHelperInstallIndex < backupWorkerInstallIndex);
  assert.ok(backupWorkerInstallIndex < unitInstallIndex);
  assert.ok(unitInstallIndex < daemonReloadIndex);
  assert.ok(daemonReloadIndex < releaseWriteIndex);
  assert.ok(releaseWriteIndex < workerActiveCheckIndex, 'release.env is written before an active worker is restarted');
  assert.ok(workerActiveCheckIndex < workerRestartIndex);
  assert.ok(workerRestartIndex < inactiveWorkerMessageIndex);

  assert.match(deployWorkflow, /systemctl is-active --quiet fanmind-backup-worker\.service[\s\S]*systemctl restart fanmind-backup-worker\.service/);
  assert.match(deployWorkflow, /Backup worker is not active; not starting it\./);
  assert.doesNotMatch(deployWorkflow, /systemctl enable/);
  assert.doesNotMatch(deployWorkflow, /systemctl start fanmind-backup-worker\.service/);
});

test('verify_backup is re-enabled only by the safe follow-up migration', () => {
  assert.equal(worker.JOBS.has('verify_backup'), true);
  assert.doesNotMatch(migration.match(/job_type in \(([^)]*)\)/)?.[1] ?? '', /verify_backup/);
  assert.match(migration, /verify_backup disabled/);
  assert.match(enableVerificationMigration, /job_type in \([^)]*verify_backup/s);
  assert.match(enableVerificationMigration, /backup_type in \([^)]*verification/s);
  assert.match(enableVerificationMigration, /grant execute on function public\.claim_admin_backup_job\(text, integer\) to service_role;/i);
  assert.doesNotMatch(enableVerificationMigration, /grant execute .* to (public|anon|authenticated)/i);
});

test('encrypted artifact and sha256 move together and validate after move', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-unit-'));
  const root = join(tmp, 'dest');
  process.env.FANMIND_BACKUP_ROOT = root;
  const clear = join(tmp, 'artifact.txt');
  await writeFile(clear, 'payload');
  const result = await worker.encryptedFinalize(clear, 'database', {});
  assert.ok(result.checksum_path.endsWith('.age.sha256'));
  const moved = await worker.moveAndValidate(result);
  assert.equal(basename(moved.checksumFinal), `${basename(moved.final)}.sha256`);
  assert.equal((await stat(moved.final)).isFile(), true);
  assert.equal((await stat(moved.checksumFinal)).isFile(), true);
  assert.match(await readFile(moved.checksumFinal, 'utf8'), new RegExp(result.sha256));
});


test('cross-device rename failure is avoided by copy/verify/finalize placement', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-cross-device-'));
  const { root, result } = await makePlacedPairFixture(tmp, 'fanmind-database-test.dump.age', 'database-payload');
  worker.__setBackupWorkerTestHooks({ rename: async (from, to) => {
    if (!from.startsWith(root) || !to.startsWith(root)) {
      throw Object.assign(new Error('EXDEV: cross-device link not permitted'), { code:'EXDEV' });
    }
    return (await import('node:fs/promises')).rename(from, to);
  }});
  const placed = await worker.moveAndValidate(result);
  worker.__setBackupWorkerTestHooks();
  assert.equal(await readFile(placed.final, 'utf8'), 'database-payload');
  assert.match(await readFile(placed.checksumFinal, 'utf8'), new RegExp(result.sha256));
});

test('repeated exclusive copies keep exact destination content, mode and sha256', async () => {
  for (let index = 0; index < 20; index += 1) {
    const tmp = await mkdtemp(join(tmpdir(), 'fanmind-copy-ok-'));
    const payload = `exact-payload-${index}`;
    const { result } = await makePlacedPairFixture(tmp, `ok-${index}.dump.age`, payload);
    const placed = await worker.placeBackupPair(result);
    assert.equal(await readFile(placed.final, 'utf8'), payload);
    assert.equal((await readFile(placed.checksumFinal, 'utf8')).trim().split(/\s+/)[0], result.sha256);
    assert.equal((await stat(placed.final)).mode & 0o777, 0o600);
    assert.equal((await stat(placed.checksumFinal)).mode & 0o777, 0o600);
  }
});

test('checksum mismatch cleans temporary destination files', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-copy-bad-sha-'));
  const { root, result } = await makePlacedPairFixture(tmp, 'bad.dump.age', 'payload');
  result.sha256 = '0'.repeat(64);
  await assert.rejects(() => worker.placeBackupPair(result), /sha256_mismatch_after_copy/);
  assert.deepEqual(await listRoot(root), []);
});

test('copy failure on checksum file leaves no final age artifact', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-second-copy-fails-'));
  const { root, result } = await makePlacedPairFixture(tmp, 'second.dump.age', 'payload');
  result.checksum_path = join(tmp, 'missing.sha256');
  await assert.rejects(() => worker.placeBackupPair(result), /ENOENT/);
  assert.equal((await listRoot(root)).some(name => name.endsWith('.age')), false);
});

test('final rename failure cleans misleading finalized files', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-final-rename-fails-'));
  const { root, result } = await makePlacedPairFixture(tmp, 'rename.dump.age', 'payload');
  let count = 0;
  worker.__setBackupWorkerTestHooks({ rename: async (from, to) => {
    count += 1;
    if (count === 2) throw Object.assign(new Error('rename_failed'), { code:'EIO' });
    return (await import('node:fs/promises')).rename(from, to);
  }});
  await assert.rejects(() => worker.placeBackupPair(result), /rename_failed/);
  worker.__setBackupWorkerTestHooks();
  assert.deepEqual(await listRoot(root), []);
});

test('existing final destination is not silently overwritten', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-collision-'));
  const { root, result } = await makePlacedPairFixture(tmp, 'collision.dump.age', 'payload');
  await import('node:fs/promises').then(fs => fs.mkdir(root, { recursive:true, mode:0o700 }));
  await writeFile(join(root, basename(result.path)), 'existing', { mode:0o600 });
  await assert.rejects(() => worker.placeBackupPair(result), /backup_destination_exists/);
  assert.equal(await readFile(join(root, basename(result.path)), 'utf8'), 'existing');
});

test('successful placement removes encrypted source pair only after finalization', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-source-remove-'));
  const { result } = await makePlacedPairFixture(tmp, 'remove.dump.age', 'payload');
  const source = result.path;
  const checksumSource = result.checksum_path;
  const placed = await worker.placeBackupPair(result);
  await assert.rejects(() => access(source), /ENOENT/);
  await assert.rejects(() => access(checksumSource), /ENOENT/);
  assert.equal(basename(placed.checksumFinal), `${basename(placed.final)}.sha256`);
});

test('storage pagination walks multiple pages, nested folders and ignores placeholders', async () => {
  const listCalls = [];
  global.fetch = async (url, init={}) => {
    if (String(url).includes('/object/list/')) {
      const body = JSON.parse(init.body);
      listCalls.push(body);
      const key = `${body.prefix}:${body.offset}`;
      const pages = {
        ':0': [{ name:'a.txt', id:'1', metadata:{ size:1 } }, { name:'folder', metadata:{} }],
        ':2': [{ name:'.emptyFolderPlaceholder', id:'empty', metadata:{ size:0 } }],
        'folder:0': [{ name:'b.txt', id:'2', metadata:{ size:1 } }, { name:'deep', metadata:{} }],
        'folder:2': [{ name:'odd name.txt', id:'3', metadata:{ size:1 } }],
        'folder:4': [],
        'folder/deep:0': [{ name:'c.txt', id:'4', metadata:{ size:1 } }],
        'folder/deep:2': [],
      };
      return { ok:true, json: async () => pages[key] ?? [] };
    }
    return { ok:true, body: new Response('x').body };
  };
  const objects = await worker.walkStorage();
  assert.deepEqual(objects.map(o => o.path).sort(), ['a.txt','folder/b.txt','folder/deep/c.txt','folder/odd name.txt']);
  assert.ok(listCalls.some(c => c.offset === 2));
});

test('storage duplicate object paths fail the backup', async () => {
  global.fetch = async (url) => {
    if (String(url).includes('/object/list/')) return { ok:true, json: async () => [{ name:'dup.txt', id:'1', metadata:{ size:1 } }, { name:'dup.txt', id:'2', metadata:{ size:1 } }] };
    return { ok:true, body: new Response('x').body };
  };
  await assert.rejects(() => worker.walkStorage('', [], new Set()), /storage_duplicate_object_path/);
});

test('full backup artifact contains encrypted parts and central manifest before cleanup', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-full-'));
  const pm2 = join(tmp, 'dump.pm2');
  process.env.FANMIND_PM2_DUMP_FILE = pm2;
  await writeFile(pm2, 'module.exports = {}');
  global.fetch = async (url) => {
    if (String(url).includes('/object/list/')) return { ok:true, json: async () => [] };
    return { ok:true, body: new Response('x').body };
  };
  const previousReleaseCommit = process.env.FANMIND_RELEASE_COMMIT;
  const previousGithubSha = process.env.GITHUB_SHA;
  process.env.FANMIND_RELEASE_COMMIT = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
  process.env.GITHUB_SHA = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
  const result = await worker.createFull(tmp);
  if (previousReleaseCommit === undefined) delete process.env.FANMIND_RELEASE_COMMIT;
  else process.env.FANMIND_RELEASE_COMMIT = previousReleaseCommit;
  if (previousGithubSha === undefined) delete process.env.GITHUB_SHA;
  else process.env.GITHUB_SHA = previousGithubSha;
  assert.equal(result.manifest.production_commit, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.ok(result.path.endsWith('.tar.gz.age'));
  assert.ok(result.checksum_path.endsWith('.age.sha256'));
  assert.equal(result.manifest.parts.length, 3);
  for (const part of result.manifest.parts) {
    assert.match(part.file, /\.age$/);
    assert.match(part.checksum_file, /\.age\.sha256$/);
    assert.ok(part.sha256);
  }
});



test('full backup manifest keeps controlled unknown fallback when no release commit exists', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-full-no-release-'));
  const pm2 = join(tmp, 'dump.pm2');
  const previousReleaseCommit = process.env.FANMIND_RELEASE_COMMIT;
  const previousGithubSha = process.env.GITHUB_SHA;
  delete process.env.FANMIND_RELEASE_COMMIT;
  delete process.env.GITHUB_SHA;
  process.env.FANMIND_PM2_DUMP_FILE = pm2;
  await writeFile(pm2, 'module.exports = {}');
  global.fetch = async (url) => {
    if (String(url).includes('/object/list/')) return { ok:true, json: async () => [] };
    return { ok:true, body: new Response('x').body };
  };
  const result = await worker.createFull(tmp);
  if (previousReleaseCommit === undefined) delete process.env.FANMIND_RELEASE_COMMIT;
  else process.env.FANMIND_RELEASE_COMMIT = previousReleaseCommit;
  if (previousGithubSha === undefined) delete process.env.GITHUB_SHA;
  else process.env.GITHUB_SHA = previousGithubSha;
  assert.equal(result.manifest.production_commit, 'unknown');
});

test('missing PM2 dump path fails with data-sparse error', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'fanmind-pm2-'));
  process.env.FANMIND_PM2_DUMP_FILE = join(tmp, 'missing.pm2');
  await assert.rejects(() => worker.createServerConfig(tmp), /pm2_dump_file_unreadable/);
});



test('claim migration keeps one active backup job and lease expiry retry semantics', async () => {
  const baseMigration = await readFile(new URL('../supabase/migrations/20260711143000_phase_5_backup_worker.sql', import.meta.url), 'utf8');
  assert.match(baseMigration, /for update skip locked/i);
  assert.match(baseMigration, /lease_until <= now\(\)/i);
  assert.match(baseMigration, /attempt_count = j\.attempt_count \+ 1/i);
  assert.match(baseMigration, /where job_type in \('backup_server_config','backup_database','backup_storage','backup_full','verify_backup'\)/);
  assert.match(migration, /where job_type in \('backup_server_config','backup_database','backup_storage','backup_full'\)/);
});

test('offsite source treats artifact and checksum uploads as required transfer pair', () => {
  assert.match(workerSource, /await run\(process\.env\.FANMIND_RCLONE_BIN \|\| 'rclone', mkArgs\(file\)\)/);
  assert.match(workerSource, /await run\(process\.env\.FANMIND_RCLONE_BIN \|\| 'rclone', mkArgs\(`\$\{file\}\.sha256`\)\)/);
  assert.match(workerSource, /checksum_reference:`\$\{remote}:\$\{remotePath}\/\$\{basename\(file\)}\.sha256`/);
});

test('worker source keeps checksum offsite upload and no root pm2 path', () => {
  assert.match(workerSource, /copyto.*`\$\{file\}\.sha256`/s);
  assert.doesNotMatch(workerSource, /\/root\/\.pm2\/dump\.pm2/);
  assert.match(workerSource, /sensitive_encrypted_config/);
});


test('service_role follow-up migration grants only the server-side worker role', () => {
  assert.match(serviceRoleGrantMigration, /to_regprocedure\('public\.claim_admin_backup_job\(text, integer\)'\) is null/i);
  assert.match(serviceRoleGrantMigration, /raise exception 'required function public\.claim_admin_backup_job\(text, integer\) does not exist'/i);
  assert.match(serviceRoleGrantMigration, /revoke all on function public\.claim_admin_backup_job\(text, integer\) from public, anon, authenticated;/i);
  assert.match(serviceRoleGrantMigration, /grant execute on function public\.claim_admin_backup_job\(text, integer\) to service_role;/i);
  assert.doesNotMatch(serviceRoleGrantMigration, /grant execute on function public\.claim_admin_backup_job\(text, integer\) to (public|anon|authenticated)/i);
  assert.doesNotMatch(serviceRoleGrantMigration, /alter table|update public\.|insert into public\.|delete from public\./i);
});

test('documented SQL proof checks RPC privileges and service-role claim path without secrets', () => {
  assert.match(rpcPermissionProof, /has_schema_privilege\('service_role', 'public', 'USAGE'\)/i);
  assert.match(rpcPermissionProof, /has_function_privilege\('service_role', 'public\.claim_admin_backup_job\(text, integer\)', 'EXECUTE'\)/i);
  assert.match(rpcPermissionProof, /not has_function_privilege\('anon', 'public\.claim_admin_backup_job\(text, integer\)', 'EXECUTE'\)/i);
  assert.match(rpcPermissionProof, /not has_function_privilege\('authenticated', 'public\.claim_admin_backup_job\(text, integer\)', 'EXECUTE'\)/i);
  assert.match(rpcPermissionProof, /not has_function_privilege\('public', 'public\.claim_admin_backup_job\(text, integer\)', 'EXECUTE'\)/i);
  assert.match(rpcPermissionProof, /set local role service_role;/i);
  assert.match(rpcPermissionProof, /public\.claim_admin_backup_job\('rpc-permission-fixture-worker', 900\)/i);
  assert.match(rpcPermissionProof, /'claimed'/i);
  assert.doesNotMatch(rpcPermissionProof, /SUPABASE_SERVICE_ROLE_KEY|service-role-test|Bearer\s+[A-Za-z0-9._-]+|apikey\s*[:=]|password\s*[:=]|secret\s*[:=]/i);
});

test('claim response normalization treats nullish and empty responses as no job', () => {
  assert.equal(worker.normalizeClaimedJob(null), null);
  assert.equal(worker.normalizeClaimedJob(undefined), null);
  assert.equal(worker.normalizeClaimedJob([]), null);
});

test('claim response normalization treats empty composite rows as no job', () => {
  assert.equal(worker.normalizeClaimedJob([{ id: null, job_type: null }]), null);
  assert.equal(worker.normalizeClaimedJob({ id: null, job_type: null }), null);
});

test('claim response normalization accepts a valid direct job object', () => {
  const job = { id: 'job-1', job_type: 'backup_database', extra: 'kept' };
  assert.equal(worker.normalizeClaimedJob(job), job);
});

test('claim response normalization accepts a valid single-row array job', () => {
  const job = { id: 'job-2', job_type: 'backup_storage' };
  assert.equal(worker.normalizeClaimedJob([job]), job);
});

test('claim response normalization accepts verification and rejects unknown job types', () => {
  const verificationJob = { id: 'job-3', job_type: 'verify_backup' };
  assert.equal(worker.normalizeClaimedJob(verificationJob), verificationJob);
  assert.equal(worker.normalizeClaimedJob([{ id: 'job-4', job_type: 'not_allowed' }]), null);
});

test('no-job path uses the configured backup poll sleep interval', () => {
  const previous = process.env.FANMIND_BACKUP_POLL_MS;
  process.env.FANMIND_BACKUP_POLL_MS = '1234';
  assert.equal(worker.backupPollMs(), 1234);
  process.env.FANMIND_BACKUP_POLL_MS = '0';
  assert.equal(worker.backupPollMs(), 30000);
  if (previous === undefined) delete process.env.FANMIND_BACKUP_POLL_MS;
  else process.env.FANMIND_BACKUP_POLL_MS = previous;
});

test('heartbeat interval is decoupled from the job poll interval and configurable', () => {
  const previousHeartbeat = process.env.FANMIND_BACKUP_HEARTBEAT_MS;
  const previousPoll = process.env.FANMIND_BACKUP_POLL_MS;
  delete process.env.FANMIND_BACKUP_HEARTBEAT_MS;
  delete process.env.FANMIND_BACKUP_POLL_MS;
  assert.equal(worker.backupPollMs(), 30000);
  assert.equal(worker.backupHeartbeatMs(), 300000);
  process.env.FANMIND_BACKUP_POLL_MS = '30000';
  process.env.FANMIND_BACKUP_HEARTBEAT_MS = '600000';
  assert.equal(worker.backupPollMs(), 30000);
  assert.equal(worker.backupHeartbeatMs(), 600000);
  if (previousHeartbeat === undefined) delete process.env.FANMIND_BACKUP_HEARTBEAT_MS;
  else process.env.FANMIND_BACKUP_HEARTBEAT_MS = previousHeartbeat;
  if (previousPoll === undefined) delete process.env.FANMIND_BACKUP_POLL_MS;
  else process.env.FANMIND_BACKUP_POLL_MS = previousPoll;
});

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const fixtureRoot = await mkdtemp(join(tmpdir(), "fanmind-verification-fixture-"));

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.test";
process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-test";
process.env.FANMIND_BACKUP_PUBLIC_KEY_FILE = join(fixtureRoot, "recipient.txt");
process.env.FANMIND_BACKUP_PGPASSFILE = join(fixtureRoot, "pgpass");
process.env.FANMIND_BACKUP_DB_HOST = "db.test";
process.env.FANMIND_BACKUP_DB_USER = "postgres";
process.env.FANMIND_BACKUP_DB_NAME = "postgres";
await writeFile(process.env.FANMIND_BACKUP_PUBLIC_KEY_FILE, "age1test");
await writeFile(process.env.FANMIND_BACKUP_PGPASSFILE, "localhost:*:*:*:x");

after(async () => {
  await rm(fixtureRoot, { recursive:true, force:true });
});

const worker = await import("../scripts/operations/backup-worker.mjs");
const workerSource = await readFile(new URL("../scripts/operations/backup-worker.mjs", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260718173000_enable_safe_backup_verification.sql", import.meta.url), "utf8");
const migrationRunner = await import("../scripts/operations/backup-verification-migration-runner.mjs");
const migrationLogVerifier = await import("../scripts/operations/verify-backup-verification-migration-log.mjs");
const operationsSource = await readFile(new URL("../src/lib/backupOperations.ts", import.meta.url), "utf8");
const routeSource = await readFile(new URL("../src/app/api/admin/operations/backup-jobs/route.ts", import.meta.url), "utf8");
const uiSource = await readFile(new URL("../src/app/admin/operations/BackupJobActions.tsx", import.meta.url), "utf8");
const pageSource = await readFile(new URL("../src/app/admin/operations/page.tsx", import.meta.url), "utf8");
const autoRefreshSource = await readFile(new URL("../src/app/admin/operations/OperationsAutoRefresh.tsx", import.meta.url), "utf8");
const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const deployment = await readFile(new URL("../.github/workflows/deploy-fanmind.yml", import.meta.url), "utf8");
const migrationWorkflow = await readFile(new URL("../.github/workflows/backup-verification-production-migration.yml", import.meta.url), "utf8");
const migrationService = await readFile(new URL("../ops/systemd/fanmind-backup-verification-migration@.service", import.meta.url), "utf8");

test("safe verification job is allowlisted end to end", () => {
  assert.equal(worker.JOBS.has("verify_backup"), true);
  assert.match(operationsSource, /"verify_backup"/);
  assert.match(uiSource, /Letztes Backup prüfen/);
  assert.match(uiSource, /checksum-only/);
});

test("each manual verification can enqueue a fresh latest-backup check", () => {
  assert.match(uiSource, /verify_backup[\s\S]*crypto\.randomUUID\(\)/);
  assert.match(uiSource, /Idempotency-Key/);
});

test("every manual backup action is confirmed and atomically rate limited", () => {
  assert.doesNotMatch(uiSource, /(?:window\.)?confirm\(/u);
  assert.match(uiSource, /role="dialog"/u);
  assert.match(uiSource, /aria-modal="true"/u);
  assert.match(uiSource, /aria-labelledby="backup-job-confirm-title"/u);
  assert.match(uiSource, /aria-describedby="backup-job-confirm-description"/u);
  assert.match(uiSource, /aria-busy=\{Boolean\(busy\)\}/u);
  assert.match(uiSource, /event\.key === "Escape"/u);
  assert.match(uiSource, /event\.key === "Tab"/u);
  assert.match(uiSource, /dialogRef\.current/u);
  assert.match(uiSource, /querySelectorAll<HTMLElement>/u);
  assert.match(uiSource, /event\.shiftKey/u);
  assert.match(uiSource, /lastFocusable\.focus\(\)/u);
  assert.match(uiSource, /firstFocusable\.focus\(\)/u);
  assert.match(uiSource, /confirmButtonRef\.current\?\.focus\(\)/u);
  assert.match(uiSource, /onClick=\{closeConfirmation\}/u);
  assert.match(uiSource, /Prüfung starten/u);
  assert.match(uiSource, /kein Restore und keine Entschlüsselung/u);
  assert.match(uiSource, /if \(!pendingAction \|\| submitLockRef\.current\) return/u);
  assert.match(uiSource, /submitLockRef\.current = true/u);
  assert.match(uiSource, /finally \{[\s\S]*submitLockRef\.current = false/u);
  assert.match(operationsSource, /import \{ consumeSharedRateLimit \} from "@\/lib\/sharedRateLimit"/u);
  assert.match(operationsSource, /scope: "admin_backup_user"[\s\S]*subject: user\.id/u);
  assert.match(operationsSource, /MANUAL_BACKUP_RATE_LIMIT_MAX = 5/u);
  assert.match(operationsSource, /MANUAL_BACKUP_RATE_LIMIT_WINDOW_MS = 10 \* 60 \* 1000/u);
  assert.ok(
    operationsSource.indexOf("await consumeSharedRateLimit")
      < operationsSource.indexOf("const active = await rest"),
  );
  assert.match(operationsSource, /operations_rate_limit_unavailable/u);
  assert.match(operationsSource, /backup_job_rate_limited/u);
  assert.match(operationsSource, /status:429[\s\S]*Retry-After/u);
  assert.match(routeSource, /"headers" in result \? result\.headers : undefined/u);
  assert.match(uiSource, /Es wurde kein Job eingereiht/u);
});

test("cancelling the in-page confirmation never calls the backup API", () => {
  const closeBody = uiSource.match(
    /const closeConfirmation = useCallback\(\(\) => \{(?<body>[\s\S]*?)\n  \}, \[\]\);/u,
  )?.groups?.body ?? "";

  assert.ok(closeBody, "Missing closeConfirmation callback.");
  assert.doesNotMatch(closeBody, /fetch\(/u);
  assert.doesNotMatch(closeBody, /if \(busy\) return/u);
  assert.match(closeBody, /setPendingAction\(null\)/u);
  assert.match(uiSource, /aria-label=\{busy \? "Dialog schließen" : "Backup-Aktion abbrechen"\}/u);
  assert.match(uiSource, /\{busy \? "Dialog schließen" : "Abbrechen"\}/u);
  assert.doesNotMatch(
    uiSource,
    /aria-label=\{busy \? "Dialog schließen"[\s\S]{0,160}disabled=\{Boolean\(busy\)\}/u,
  );
});

test("active operations jobs refresh server data without background or idle polling", () => {
  assert.match(uiSource, /useRouter/);
  assert.match(uiSource, /if \(response\.ok\) router\.refresh\(\)/);
  assert.match(uiSource, /catch \{[\s\S]*finally \{[\s\S]*setBusy\(""\)/);
  assert.match(pageSource, /\["queued", "claimed", "running"\]/);
  assert.match(pageSource, /OperationsAutoRefresh enabled=\{hasActiveJobs\}/);
  assert.match(autoRefreshSource, /if \(!enabled\) return/);
  assert.match(autoRefreshSource, /document\.visibilityState === "visible"/);
  assert.match(autoRefreshSource, /setInterval\(refreshWhenVisible, REFRESH_INTERVAL_MS\)/);
  assert.match(autoRefreshSource, /REFRESH_INTERVAL_MS = 15_000/);
  assert.match(autoRefreshSource, /visibilitychange/);
  assert.match(autoRefreshSource, /router\.refresh\(\)/);
  assert.doesNotMatch(autoRefreshSource, /fetch\(/);
});

test("verification migration grants only service_role claim access", () => {
  assert.match(migration, /verify_backup/);
  assert.match(migration, /backup_type in \([^)]*'verification'/s);
  assert.match(migration, /revoke all on function public\.claim_admin_backup_job\(text, integer\) from public, anon, authenticated;/i);
  assert.match(migration, /grant execute on function public\.claim_admin_backup_job\(text, integer\) to service_role;/i);
  assert.doesNotMatch(migration, /grant execute .* to (public|anon|authenticated)/i);
});

test("backup verification migration is checksum-pinned and wrapped transactionally", () => {
  const checkedMigration = migrationRunner.verifyBackupVerificationMigrationSource();
  const transaction = migrationRunner.wrapBackupVerificationMigration(checkedMigration);

  assert.equal(checkedMigration, migration);
  assert.equal(
    packageJson.scripts["db:backup-verification:check"],
    "node scripts/operations/backup-verification-migration-runner.mjs",
  );
  assert.match(transaction, /^\\set ON_ERROR_STOP on\nbegin;/u);
  assert.match(transaction, /set local lock_timeout = '5s'/u);
  assert.match(transaction, /set local statement_timeout = '60s'/u);
  assert.match(transaction, /commit;\s*$/u);
  assert.doesNotMatch(migration, /(?:insert|delete)\s+(?:into|from)?\s*public\./iu);
  assert.doesNotMatch(migration, /drop\s+(?:table|schema|database)/iu);
});

test("Production backup verification migration has a separate guarded control path", () => {
  assert.match(migrationWorkflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(migrationWorkflow, /environment: production/u);
  assert.match(migrationWorkflow, /runs-on: \[self-hosted, fanmind-prod, exoscale, linux, x64\]/u);
  assert.match(migrationWorkflow, /backup-verification-production-verify/u);
  assert.match(migrationWorkflow, /backup-verification-production-apply/u);
  assert.match(migrationWorkflow, /EXPECTED_COMMIT[\s\S]*REVIEWED_COMMIT/u);
  assert.match(migrationWorkflow, /read-only-production-audit\.sh/u);
  assert.match(migrationWorkflow, /fanmind-backup-verification-migration@\$\{MIGRATION_ACTION\}\.service/u);
  assert.match(migrationWorkflow, /verify-backup-verification-migration-log\.mjs/u);
  assert.doesNotMatch(migrationWorkflow, /actions\/checkout|source .*\.env\.production|cat .*\.env\.production|printenv/u);

  assert.match(migrationService, /User=root/u);
  assert.match(migrationService, /EnvironmentFile=\/var\/www\/fanmind\/\.env\.production/u);
  assert.match(migrationService, /EnvironmentFile=\/etc\/fanmind-backup\/worker\.env/u);
  assert.match(migrationService, /EnvironmentFile=\/etc\/fanmind-backup\/release\.env/u);
  assert.match(migrationService, /backup-verification-migration-runner\.mjs --%i backup-verification-production-%i/u);
  assert.match(migrationService, /NoNewPrivileges=true/u);
  assert.match(migrationService, /ProtectSystem=strict/u);
  assert.match(migrationService, /CapabilityBoundingSet=/u);
  assert.doesNotMatch(migrationService, /\[Install\]/u);

  assert.match(deployment, /backup-verification-migration-runner\.mjs \/usr\/local\/lib\/fanmind-ops\/backup-verification-migration-runner\.mjs/u);
  assert.match(deployment, /-m 0600 supabase\/migrations\/20260718173000_enable_safe_backup_verification\.sql \/usr\/local\/lib\/fanmind-ops\/20260718173000_enable_safe_backup_verification\.sql/u);
  assert.match(deployment, /verify-backup-verification-migration-log\.mjs \/usr\/local\/lib\/fanmind-audit\/verify-backup-verification-migration-log\.mjs/u);
  assert.match(deployment, /fanmind-backup-verification-migration@\.service \/etc\/systemd\/system\/fanmind-backup-verification-migration@\.service/u);
});

test("migration diagnostics are allowlisted and action-bound", () => {
  const now = new Date().toISOString();
  const source = `${JSON.stringify({
    ts: now,
    version: "fanmind-backup-verification-migration-1",
    level: "info",
    event: "migration_status",
    action: "apply",
    status: "applied",
  })}\n`;
  const result = migrationLogVerifier.verifyBackupVerificationMigrationLog(source, now, "apply");
  assert.deepEqual(result, { action:"apply", status:"applied", errorCode:null });
  assert.match(
    migrationLogVerifier.formatBackupVerificationMigrationDiagnostic(result),
    /BACKUP_VERIFICATION_MIGRATION_RESULT=applied/u,
  );
  assert.throws(
    () => migrationLogVerifier.verifyBackupVerificationMigrationLog(source, now, "verify"),
    /diagnostic_missing/u,
  );
});

test("local backup pair must remain inside configured backup root", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-verification-root-"));
  const artifact = join(root, "fanmind-database-safe.dump.age");
  const checksum = `${artifact}.sha256`;
  await writeFile(artifact, "payload");
  await writeFile(checksum, "0".repeat(64) + "  fanmind-database-safe.dump.age\n");
  process.env.FANMIND_BACKUP_ROOT = root;
  const pair = await worker.validatedLocalBackupPair({ storage_reference:artifact, checksum_reference:checksum });
  assert.equal(pair.artifact, artifact);
  assert.equal(pair.checksum, checksum);
});

test("outside-root and mismatched checksum paths are rejected", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-verification-root-"));
  const outside = await mkdtemp(join(tmpdir(), "fanmind-verification-outside-"));
  const outsideArtifact = join(outside, "fanmind-database-outside.dump.age");
  const outsideChecksum = `${outsideArtifact}.sha256`;
  await writeFile(outsideArtifact, "payload");
  await writeFile(outsideChecksum, "0".repeat(64) + "  fanmind-database-outside.dump.age\n");
  process.env.FANMIND_BACKUP_ROOT = root;
  await assert.rejects(
    () => worker.validatedLocalBackupPair({ storage_reference:outsideArtifact, checksum_reference:outsideChecksum }),
    /backup_artifact_outside_root/,
  );

  const localArtifact = join(root, "fanmind-database-local.dump.age");
  const otherChecksum = join(root, "other.sha256");
  await writeFile(localArtifact, "payload");
  await writeFile(otherChecksum, "0".repeat(64) + "  other\n");
  await assert.rejects(
    () => worker.validatedLocalBackupPair({ storage_reference:localArtifact, checksum_reference:otherChecksum }),
    /backup_checksum_pair_mismatch/,
  );
});

test("failed verification marks the source backup invalid before rethrow", () => {
  assert.match(
    workerSource,
    /catch \(error\) \{[\s\S]*patch\('backup_runs', sourceRun\.id, \{ validation_status:'failed' \}\)[\s\S]*throw error;/,
  );
});

test("worker never accepts a browser supplied artifact path", () => {
  assert.match(workerSource, /latestVerifiableBackupRun/);
  assert.match(workerSource, /source_backup_run_id/);
  assert.doesNotMatch(operationsSource, /artifactPath|checksumPath|storage_reference/);
});

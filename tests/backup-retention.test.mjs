import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  DEFAULT_POLICY,
  discoverBackupPairs,
  executeRetention,
  parseArtifactName,
  resolvePolicy,
  retentionErrorCode,
  selectRetention,
} from '../scripts/operations/backup-retention.mjs';

const retentionService = await readFile(
  new URL('../ops/systemd/fanmind-backup-retention.service', import.meta.url),
  'utf8',
);

function pair(type, iso, suffix = 'tar.gz') {
  const timestampMs = Date.parse(iso);
  const prefix = type === 'server_config' ? 'server-config' : type;
  const artifactName = `fanmind-${prefix}-${timestampMs}.${suffix}.age`;
  return {
    type,
    timestampMs,
    date: new Date(timestampMs),
    artifactName,
    artifactPath: `/backups/${artifactName}`,
    checksumName: `${artifactName}.sha256`,
    checksumPath: `/backups/${artifactName}.sha256`,
  };
}

async function writePair(root, type, timestampMs, payload = 'payload') {
  const prefix = type === 'server_config' ? 'server-config' : type;
  const suffix = type === 'database' ? 'dump' : 'tar.gz';
  const artifactName = `fanmind-${prefix}-${timestampMs}.${suffix}.age`;
  const artifactPath = join(root, artifactName);
  const checksumPath = `${artifactPath}.sha256`;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  const sha = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  await writeFile(artifactPath, payload, { mode: 0o600 });
  await writeFile(checksumPath, `${sha}  ${artifactName}\n`, { mode: 0o600 });
  return { artifactName, artifactPath, checksumPath };
}

test('recognized backup names parse exact worker artifact formats', () => {
  const db = parseArtifactName('fanmind-database-1783881096964.dump.age');
  const full = parseArtifactName('fanmind-full-1783881096964.tar.gz.age');
  assert.equal(db.type, 'database');
  assert.equal(full.type, 'full');
  assert.equal(parseArtifactName('fanmind-full-old.tar.gz.age'), null);
  assert.equal(parseArtifactName('unrelated-1783881096964.tar.gz.age'), null);
});

test('default MVP policy is 1 daily, 1 weekly and 1 monthly, with no daily full backup slot', () => {
  assert.deepEqual(DEFAULT_POLICY.database, { daily: 1, weekly: 1, monthly: 1 });
  assert.deepEqual(DEFAULT_POLICY.storage, { daily: 1, weekly: 1, monthly: 1 });
  assert.deepEqual(DEFAULT_POLICY.server_config, { daily: 1, weekly: 1, monthly: 1 });
  assert.deepEqual(DEFAULT_POLICY.full, { daily: 0, weekly: 1, monthly: 1 });

  const resolved = resolvePolicy({});
  assert.deepEqual(resolved, DEFAULT_POLICY);
});

test('systemd retention service pins the agreed MVP policy', () => {
  assert.match(retentionService, /FANMIND_BACKUP_RETENTION_DAILY=1/);
  assert.match(retentionService, /FANMIND_BACKUP_RETENTION_WEEKLY=1/);
  assert.match(retentionService, /FANMIND_BACKUP_RETENTION_MONTHLY=1/);
  assert.match(retentionService, /FANMIND_BACKUP_RETENTION_FULL_DAILY=0/);
  assert.match(retentionService, /FANMIND_BACKUP_RETENTION_FULL_WEEKLY=1/);
  assert.match(retentionService, /FANMIND_BACKUP_RETENTION_FULL_MONTHLY=1/);
});

test('retention journal output reduces unexpected details to fixed error codes', () => {
  assert.equal(
    retentionErrorCode(new Error('daily_must_be_non_negative_integer')),
    'retention_configuration_invalid',
  );
  assert.equal(
    retentionErrorCode(new Error('exactly_one_of_dry_run_or_execute_required')),
    'exactly_one_of_dry_run_or_execute_required',
  );
  assert.equal(
    retentionErrorCode(
      Object.assign(new Error('/private/backups/customer.age'), { code:'EACCES' }),
    ),
    'retention_filesystem_failed',
  );
  assert.equal(
    retentionErrorCode(new Error('token=live-secret\nhttps://private.example')),
    'retention_failed',
  );
});

test('database policy keeps three distinct restore points across day, week and month', () => {
  const pairs = [
    pair('database', '2026-07-12T20:00:00Z', 'dump'),
    pair('database', '2026-07-11T20:00:00Z', 'dump'),
    pair('database', '2026-07-05T20:00:00Z', 'dump'),
    pair('database', '2026-06-28T20:00:00Z', 'dump'),
    pair('database', '2026-05-31T20:00:00Z', 'dump'),
  ];

  const result = selectRetention(pairs);
  const kept = result.keep
    .map((item) => new Date(item.timestampMs).toISOString())
    .sort();

  assert.deepEqual(kept, [
    '2026-06-28T20:00:00.000Z',
    '2026-07-05T20:00:00.000Z',
    '2026-07-12T20:00:00.000Z',
  ]);
  assert.equal(result.remove.length, 2);
});

test('full backup policy keeps one weekly and one distinct monthly restore point', () => {
  const pairs = [
    pair('full', '2026-07-12T20:00:00Z'),
    pair('full', '2026-07-05T20:00:00Z'),
    pair('full', '2026-06-28T20:00:00Z'),
    pair('full', '2026-05-31T20:00:00Z'),
  ];

  const result = selectRetention(pairs);
  const kept = result.keep
    .map((item) => new Date(item.timestampMs).toISOString())
    .sort();

  assert.deepEqual(kept, [
    '2026-06-28T20:00:00.000Z',
    '2026-07-12T20:00:00.000Z',
  ]);
  assert.equal(result.remove.length, 2);
});

test('latest pair remains protected even when all configured tiers are zero', () => {
  const pairs = [
    pair('full', '2026-07-12T20:00:00Z'),
    pair('full', '2026-07-05T20:00:00Z'),
  ];

  const result = selectRetention(pairs, {
    fullDaily: 0,
    fullWeekly: 0,
    fullMonthly: 0,
  });

  assert.equal(result.keep.length, 1);
  assert.equal(result.keep[0].timestampMs, Date.parse('2026-07-12T20:00:00Z'));
  assert.deepEqual(result.reasons.get(result.keep[0].artifactName), ['safety_latest']);
});

test('incomplete or invalid pairs are reported and never selected for deletion', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fanmind-retention-incomplete-'));
  const timestamp = Date.parse('2026-07-12T12:00:00Z');
  const artifactName = `fanmind-full-${timestamp}.tar.gz.age`;
  await writeFile(join(root, artifactName), 'payload');
  const invalidName = `fanmind-database-${timestamp}.dump.age`;
  await writeFile(join(root, invalidName), 'payload');
  await writeFile(
    join(root, `${invalidName}.sha256`),
    `not-a-valid-checksum  ${invalidName}\n`,
  );
  const orphanName = `fanmind-storage-${timestamp}.tar.gz.age.sha256`;
  await writeFile(
    join(root, orphanName),
    `${'0'.repeat(64)}  ${orphanName.slice(0, -7)}\n`,
  );

  const discovered = await discoverBackupPairs(root);
  assert.equal(discovered.pairs.length, 0);
  assert.deepEqual(
    discovered.incomplete.map((item) => item.reason).sort(),
    ['artifact_missing', 'checksum_invalid', 'checksum_missing'],
  );
});

test('dry run reports pair deletion candidates without removing either file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fanmind-retention-dry-'));
  const newest = await writePair(
    root,
    'full',
    Date.parse('2026-07-12T12:00:00Z'),
    'newest',
  );
  const monthly = await writePair(
    root,
    'full',
    Date.parse('2026-06-01T12:00:00Z'),
    'monthly',
  );
  const obsolete = await writePair(
    root,
    'full',
    Date.parse('2026-05-01T12:00:00Z'),
    'obsolete',
  );
  const lines = [];

  const summary = await executeRetention({
    root,
    dryRun: true,
    logger: (line) => lines.push(JSON.parse(line)),
  });

  assert.equal(summary.deletion_candidates, 1);
  assert.equal(
    lines.some(
      (line) =>
        line.action === 'would_delete_pair'
        && line.artifact === obsolete.artifactPath
        && line.checksum === obsolete.checksumPath,
    ),
    true,
  );
  await access(newest.artifactPath);
  await access(newest.checksumPath);
  await access(monthly.artifactPath);
  await access(monthly.checksumPath);
  await access(obsolete.artifactPath);
  await access(obsolete.checksumPath);
});

test('execute mode removes artifact and checksum as one retention decision', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fanmind-retention-execute-'));
  const newest = await writePair(
    root,
    'database',
    Date.parse('2026-07-12T12:00:00Z'),
    'newest',
  );
  const weekly = await writePair(
    root,
    'database',
    Date.parse('2026-07-05T12:00:00Z'),
    'weekly',
  );
  const monthly = await writePair(
    root,
    'database',
    Date.parse('2026-06-01T12:00:00Z'),
    'monthly',
  );
  const obsolete = await writePair(
    root,
    'database',
    Date.parse('2026-05-01T12:00:00Z'),
    'obsolete',
  );

  const summary = await executeRetention({
    root,
    dryRun: false,
    logger: () => {},
  });

  assert.equal(summary.deleted_pairs, 1);
  await access(newest.artifactPath);
  await access(newest.checksumPath);
  await access(weekly.artifactPath);
  await access(weekly.checksumPath);
  await access(monthly.artifactPath);
  await access(monthly.checksumPath);
  await assert.rejects(() => access(obsolete.artifactPath), /ENOENT/);
  await assert.rejects(() => access(obsolete.checksumPath), /ENOENT/);
  assert.match(await readFile(newest.checksumPath, 'utf8'), /^[0-9a-f]{64}/);
});

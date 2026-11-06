import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

import {
  buildOffsiteInventory,
  buildOffsiteRetentionPlan,
  formatPlanLines,
  parseEnvText,
  planOffsiteRetention,
  safeErrorCode,
} from '../scripts/operations/offsite-backup-retention-plan.mjs';

const execFileAsync = promisify(execFile);
const scriptPath = 'scripts/operations/offsite-backup-retention-plan.mjs';

function timestamp(year, month, day, hour = 2) {
  return Date.UTC(year, month - 1, day, hour, 0, 0, 0);
}

function artifactName(type, timestampMs) {
  if (type === 'database') return `fanmind-database-${timestampMs}.dump.age`;
  if (type === 'storage') return `fanmind-storage-${timestampMs}.tar.gz.age`;
  if (type === 'server_config') return `fanmind-server-config-${timestampMs}.tar.gz.age`;
  return `fanmind-full-${timestampMs}.tar.gz.age`;
}

function pairEntries(type, timestampMs, prefix = '') {
  const name = artifactName(type, timestampMs);
  const path = prefix ? `${prefix}/${name}` : name;
  return [
    { Path: path, Name: name, IsDir: false },
    { Path: `${path}.sha256`, Name: `${name}.sha256`, IsDir: false },
  ];
}

function healthyListing() {
  return [
    ...pairEntries('database', timestamp(2026, 7, 23), 'nested'),
    ...pairEntries('database', timestamp(2026, 7, 15), 'nested'),
    ...pairEntries('database', timestamp(2026, 6, 1), 'nested'),
    ...pairEntries('storage', timestamp(2026, 7, 23)),
    ...pairEntries('storage', timestamp(2026, 7, 8)),
    ...pairEntries('server_config', timestamp(2026, 7, 23)),
    ...pairEntries('server_config', timestamp(2026, 6, 1)),
    ...pairEntries('full', timestamp(2026, 7, 20)),
    ...pairEntries('full', timestamp(2026, 6, 1)),
    { Path: 'unrelated.txt', Name: 'unrelated.txt', IsDir: false },
  ];
}

test('parseEnvText reads only configured values without shell evaluation', () => {
  const values = parseEnvText(`
# comment
FANMIND_BACKUP_OFFSITE_ENABLED=true
FANMIND_BACKUP_RCLONE_REMOTE="remote-name"
FANMIND_BACKUP_REMOTE_PATH='fanmind/production'
UNRELATED=$(echo must-not-run)
`);

  assert.equal(values.get('FANMIND_BACKUP_OFFSITE_ENABLED'), 'true');
  assert.equal(values.get('FANMIND_BACKUP_RCLONE_REMOTE'), 'remote-name');
  assert.equal(values.get('FANMIND_BACKUP_REMOTE_PATH'), 'fanmind/production');
  assert.equal(values.get('UNRELATED'), '$(echo must-not-run)');
});

test('buildOffsiteInventory separates complete, orphaned and unrecognized pairs', () => {
  const listing = [
    ...pairEntries('database', timestamp(2026, 7, 23)),
    { Path: artifactName('storage', timestamp(2026, 7, 23)), IsDir: false },
    { Path: 'fanmind-custom-1234567890123.tar.gz.age', IsDir: false },
    { Path: 'fanmind-custom-1234567890123.tar.gz.age.sha256', IsDir: false },
  ];

  const inventory = buildOffsiteInventory(listing);
  assert.equal(inventory.relevantObjectCount, 5);
  assert.equal(inventory.completePairs.length, 1);
  assert.equal(inventory.incompletePairs.length, 1);
  assert.equal(inventory.unrecognizedPairs.length, 1);
});

test('buildOffsiteRetentionPlan protects the latest pair of every available type', () => {
  const plan = buildOffsiteRetentionPlan(healthyListing());

  assert.equal(plan.completePairCount, 9);
  assert.equal(plan.orphanPairCount, 0);
  assert.equal(plan.unrecognizedPairCount, 0);
  assert.equal(plan.latestPerTypeProtected, true);
  assert.equal(plan.structurallySafe, true);
  assert.ok(plan.keepPairCount >= 4);
  assert.equal(
    plan.keepPairCount + plan.deletionCandidatePairCount,
    plan.completePairCount,
  );
  assert.equal(
    plan.typeSummaries.every((summary) => summary.latestProtected),
    true,
  );
});

test('formatPlanLines never emits remote identifiers, object paths or filenames', () => {
  const plan = buildOffsiteRetentionPlan(healthyListing());
  const output = formatPlanLines(plan, new Date('2026-07-23T07:00:00Z')).join('\n');

  assert.match(output, /OFFSITE_RETENTION_MODE=read_only_dry_run/u);
  assert.match(output, /OFFSITE_REMOTE_IDENTIFIER_REDACTED=true/u);
  assert.match(output, /OFFSITE_REMOTE_DELETE_EXECUTED=false/u);
  assert.match(output, /OFFSITE_RETENTION_EXECUTION_AVAILABLE=false/u);
  assert.doesNotMatch(output, /remote-name|fanmind\/production|fanmind-database-/u);
});

test('planOffsiteRetention invokes only rclone lsjson and returns redacted counts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fanmind-offsite-plan-'));
  const envFile = join(directory, 'worker.env');
  const logs = [];
  const calls = [];
  await writeFile(
    envFile,
    [
      'FANMIND_BACKUP_OFFSITE_ENABLED=true',
      'FANMIND_BACKUP_RCLONE_REMOTE=private-remote',
      'FANMIND_BACKUP_REMOTE_PATH=private/path',
      'FANMIND_BACKUP_RCLONE_CONFIG=/private/rclone.conf',
      'FANMIND_RCLONE_BIN=/usr/bin/rclone-test',
    ].join('\n'),
    'utf8',
  );

  try {
    const plan = await planOffsiteRetention({
      envFile,
      now: new Date('2026-07-23T07:00:00Z'),
      logger: (line) => logs.push(line),
      runner: async (binary, args) => {
        calls.push({ binary, args });
        return { stdout: JSON.stringify(healthyListing()) };
      },
    });

    assert.equal(plan.structurallySafe, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].binary, '/usr/bin/rclone-test');
    assert.deepEqual(calls[0].args.slice(2, 4), ['lsjson', 'private-remote:private/path']);
    assert.deepEqual(calls[0].args.slice(4), ['--files-only', '--recursive']);
    assert.equal(
      calls[0].args.some((value) =>
        /^(delete|deletefile|purge|sync|move|moveto|copy|copyto)$/u.test(value),
      ),
      false,
    );

    const output = logs.join('\n');
    assert.match(output, /OFFSITE_COMPLETE_PAIR_COUNT=9/u);
    assert.doesNotMatch(output, /private-remote|private\/path|rclone\.conf/u);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('planOffsiteRetention fails closed when an orphan pair exists', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'fanmind-offsite-plan-'));
  const envFile = join(directory, 'worker.env');
  await writeFile(
    envFile,
    'FANMIND_BACKUP_OFFSITE_ENABLED=true\nFANMIND_BACKUP_RCLONE_REMOTE=remote\n',
    'utf8',
  );

  try {
    const listing = [
      ...healthyListing(),
      { Path: artifactName('database', timestamp(2026, 5, 1)), IsDir: false },
    ];
    await assert.rejects(
      planOffsiteRetention({
        envFile,
        logger: () => undefined,
        runner: async () => ({ stdout: JSON.stringify(listing) }),
      }),
      /offsite_incomplete_pairs_present/u,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('CLI rejects execute mode without touching rclone', async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [scriptPath, '--execute']),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(error.stderr, /OFFSITE_RETENTION_DRY_RUN_REASON=execute_mode_not_implemented/u);
      assert.match(error.stderr, /OFFSITE_REMOTE_DELETE_EXECUTED=false/u);
      return true;
    },
  );
});

test('source contains no remote mutation command', async () => {
  const source = await readFile(scriptPath, 'utf8');
  assert.doesNotMatch(
    source,
    /['"](?:delete|deletefile|purge|sync|move|moveto|copy|copyto)['"]/u,
  );
  assert.equal(safeErrorCode(new Error('secret=/private/path')), 'offsite_retention_plan_failed');
});

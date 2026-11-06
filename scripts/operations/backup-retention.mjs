#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readdir, readFile, rename, rm, stat } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_POLICY = Object.freeze({
  server_config: Object.freeze({ daily: 1, weekly: 1, monthly: 1 }),
  database: Object.freeze({ daily: 1, weekly: 1, monthly: 1 }),
  storage: Object.freeze({ daily: 1, weekly: 1, monthly: 1 }),
  full: Object.freeze({ daily: 0, weekly: 1, monthly: 1 }),
});

const ARTIFACT_PATTERNS = Object.freeze([
  { type: 'server_config', regex: /^fanmind-server-config-(\d{13})\.tar\.gz\.age$/ },
  { type: 'database', regex: /^fanmind-database-(\d{13})\.dump\.age$/ },
  { type: 'storage', regex: /^fanmind-storage-(\d{13})\.tar\.gz\.age$/ },
  { type: 'full', regex: /^fanmind-full-(\d{13})\.tar\.gz\.age$/ },
]);

function parseNonNegativeInt(value, fallback, name) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${name}_must_be_non_negative_integer`);
  }
  return parsed;
}

function retentionErrorCode(error) {
  const message = error instanceof Error ? error.message : '';
  if (message === 'exactly_one_of_dry_run_or_execute_required') {
    return message;
  }
  if (/^(?:daily|weekly|monthly|full_daily|full_weekly|full_monthly)_must_be_non_negative_integer$/u.test(message)) {
    return 'retention_configuration_invalid';
  }
  const code = typeof error?.code === 'string' ? error.code : '';
  if (/^(?:EACCES|EEXIST|EIO|EISDIR|ELOOP|EMFILE|ENOENT|ENOSPC|ENOTDIR|EPERM|EROFS|EXDEV)$/u.test(code)) {
    return 'retention_filesystem_failed';
  }
  return 'retention_failed';
}

function parseArtifactName(name) {
  for (const pattern of ARTIFACT_PATTERNS) {
    const match = name.match(pattern.regex);
    if (!match) continue;
    const timestampMs = Number(match[1]);
    const date = new Date(timestampMs);
    if (!Number.isFinite(timestampMs) || Number.isNaN(date.getTime())) return null;
    return { type: pattern.type, timestampMs, date };
  }
  return null;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}

function isoWeekKey(date) {
  const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const weekday = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((utc - yearStart) / 86400000) + 1) / 7);
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function resolvePolicy(options = {}) {
  const shared = {
    daily: parseNonNegativeInt(options.daily, DEFAULT_POLICY.database.daily, 'daily'),
    weekly: parseNonNegativeInt(options.weekly, DEFAULT_POLICY.database.weekly, 'weekly'),
    monthly: parseNonNegativeInt(options.monthly, DEFAULT_POLICY.database.monthly, 'monthly'),
  };
  const full = {
    daily: parseNonNegativeInt(options.fullDaily, DEFAULT_POLICY.full.daily, 'full_daily'),
    weekly: parseNonNegativeInt(options.fullWeekly, DEFAULT_POLICY.full.weekly, 'full_weekly'),
    monthly: parseNonNegativeInt(options.fullMonthly, DEFAULT_POLICY.full.monthly, 'full_monthly'),
  };
  return {
    server_config: { ...shared },
    database: { ...shared },
    storage: { ...shared },
    full,
  };
}

function selectTier({
  sortedPairs,
  limit,
  keyFn,
  blockedKeys,
  keepNames,
  reasons,
  label,
}) {
  if (limit <= 0) return;
  const selectedKeys = new Set();

  for (const pair of sortedPairs) {
    const key = keyFn(pair.date);
    if (blockedKeys.has(key) || selectedKeys.has(key)) continue;

    selectedKeys.add(key);
    keepNames.add(pair.artifactName);
    const pairReasons = reasons.get(pair.artifactName) ?? [];
    pairReasons.push(`${label}:${key}`);
    reasons.set(pair.artifactName, pairReasons);

    if (selectedKeys.size >= limit) break;
  }
}

function selectRetention(pairs, options = {}) {
  const policy = resolvePolicy(options);
  const byType = new Map();

  for (const pair of pairs) {
    const list = byType.get(pair.type) ?? [];
    list.push(pair);
    byType.set(pair.type, list);
  }

  const keepNames = new Set();
  const reasons = new Map();

  for (const [type, typePairs] of byType.entries()) {
    const sorted = [...typePairs].sort(
      (a, b) => b.timestampMs - a.timestampMs || a.artifactName.localeCompare(b.artifactName),
    );
    const typePolicy = policy[type] ?? policy.database;
    const selectedForType = new Set();

    selectTier({
      sortedPairs: sorted,
      limit: typePolicy.daily,
      keyFn: dayKey,
      blockedKeys: new Set(),
      keepNames: selectedForType,
      reasons,
      label: 'daily',
    });

    const blockedWeeks = new Set(
      sorted
        .filter((pair) => selectedForType.has(pair.artifactName))
        .map((pair) => isoWeekKey(pair.date)),
    );

    selectTier({
      sortedPairs: sorted,
      limit: typePolicy.weekly,
      keyFn: isoWeekKey,
      blockedKeys: blockedWeeks,
      keepNames: selectedForType,
      reasons,
      label: 'weekly',
    });

    const blockedMonths = new Set(
      sorted
        .filter((pair) => selectedForType.has(pair.artifactName))
        .map((pair) => monthKey(pair.date)),
    );

    selectTier({
      sortedPairs: sorted,
      limit: typePolicy.monthly,
      keyFn: monthKey,
      blockedKeys: blockedMonths,
      keepNames: selectedForType,
      reasons,
      label: 'monthly',
    });

    if (selectedForType.size === 0 && sorted.length > 0) {
      const latest = sorted[0];
      selectedForType.add(latest.artifactName);
      reasons.set(latest.artifactName, ['safety_latest']);
    }

    for (const artifactName of selectedForType) keepNames.add(artifactName);
  }

  return {
    keep: pairs.filter((pair) => keepNames.has(pair.artifactName)),
    remove: pairs.filter((pair) => !keepNames.has(pair.artifactName)),
    reasons,
    policy,
  };
}

async function checksumLooksValid(checksumPath, artifactName) {
  try {
    const content = (await readFile(checksumPath, 'utf8')).trim();
    const match = content.match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (!match) return false;
    return basename(match[2]) === artifactName;
  } catch {
    return false;
  }
}

async function discoverBackupPairs(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch((error) => {
    if (error?.code === 'ENOENT') return [];
    throw error;
  });
  const fileNames = new Set(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
  const pairs = [];
  const incomplete = [];

  for (const artifactName of [...fileNames].sort()) {
    const parsed = parseArtifactName(artifactName);
    if (!parsed) continue;
    const checksumName = `${artifactName}.sha256`;
    const artifactPath = join(root, artifactName);
    const checksumPath = join(root, checksumName);

    if (!fileNames.has(checksumName)) {
      incomplete.push({
        type: parsed.type,
        artifactName,
        artifactPath,
        checksumName,
        checksumPath,
        reason: 'checksum_missing',
      });
      continue;
    }

    const [artifactStat, checksumStat, checksumValid] = await Promise.all([
      stat(artifactPath),
      stat(checksumPath),
      checksumLooksValid(checksumPath, artifactName),
    ]);

    if (!checksumValid) {
      incomplete.push({
        type: parsed.type,
        artifactName,
        artifactPath,
        checksumName,
        checksumPath,
        reason: 'checksum_invalid',
      });
      continue;
    }

    pairs.push({
      ...parsed,
      artifactName,
      artifactPath,
      checksumName,
      checksumPath,
      artifactSize: artifactStat.size,
      checksumSize: checksumStat.size,
    });
  }

  for (const checksumName of [...fileNames].filter((name) => name.endsWith('.age.sha256')).sort()) {
    const artifactName = checksumName.slice(0, -'.sha256'.length);
    if (fileNames.has(artifactName)) continue;
    const parsed = parseArtifactName(artifactName);
    if (!parsed) continue;
    incomplete.push({
      type: parsed.type,
      artifactName,
      artifactPath: join(root, artifactName),
      checksumName,
      checksumPath: join(root, checksumName),
      reason: 'artifact_missing',
    });
  }

  return { pairs, incomplete };
}

async function removePair(pair) {
  const nonce = randomBytes(12).toString('hex');
  const artifactQuarantine = join(
    dirname(pair.artifactPath),
    `.${pair.artifactName}.${nonce}.retention-delete`,
  );
  const checksumQuarantine = join(
    dirname(pair.checksumPath),
    `.${pair.checksumName}.${nonce}.retention-delete`,
  );

  let artifactMoved = false;
  let checksumMoved = false;

  try {
    await rename(pair.artifactPath, artifactQuarantine);
    artifactMoved = true;
    await rename(pair.checksumPath, checksumQuarantine);
    checksumMoved = true;
  } catch (error) {
    if (checksumMoved) {
      await rename(checksumQuarantine, pair.checksumPath).catch(() => {});
    }
    if (artifactMoved) {
      await rename(artifactQuarantine, pair.artifactPath).catch(() => {});
    }
    throw error;
  }

  await rm(checksumQuarantine, { force: true });
  await rm(artifactQuarantine, { force: true });
}

async function executeRetention({ root, dryRun, options = {}, logger = console.log }) {
  const { pairs, incomplete } = await discoverBackupPairs(root);
  const selection = selectRetention(pairs, options);

  for (const item of incomplete) {
    logger(JSON.stringify({
      action: 'skip_incomplete_pair',
      type: item.type,
      artifact: item.artifactPath,
      checksum: item.checksumPath,
      reason: item.reason,
    }));
  }

  for (const pair of [...selection.keep].sort((a, b) => b.timestampMs - a.timestampMs)) {
    logger(JSON.stringify({
      action: 'keep_pair',
      type: pair.type,
      artifact: pair.artifactPath,
      checksum: pair.checksumPath,
      created_at: pair.date.toISOString(),
      reasons: selection.reasons.get(pair.artifactName) ?? [],
    }));
  }

  const removePairs = [...selection.remove].sort((a, b) => a.timestampMs - b.timestampMs);
  for (const pair of removePairs) {
    logger(JSON.stringify({
      action: dryRun ? 'would_delete_pair' : 'delete_pair',
      type: pair.type,
      artifact: pair.artifactPath,
      checksum: pair.checksumPath,
      created_at: pair.date.toISOString(),
    }));
    if (!dryRun) await removePair(pair);
  }

  const summary = {
    action: 'retention_summary',
    dry_run: dryRun,
    complete_pairs: pairs.length,
    kept_pairs: selection.keep.length,
    deletion_candidates: selection.remove.length,
    incomplete_pairs: incomplete.length,
    deleted_pairs: dryRun ? 0 : selection.remove.length,
    policy: selection.policy,
  };
  logger(JSON.stringify(summary));
  return summary;
}

async function main() {
  const root = process.env.FANMIND_BACKUP_ROOT || '/var/backups/fanmind';
  const dryRun = process.argv.includes('--dry-run');
  const execute = process.argv.includes('--execute');
  if (dryRun === execute) throw new Error('exactly_one_of_dry_run_or_execute_required');

  await executeRetention({
    root,
    dryRun,
    options: {
      daily: process.env.FANMIND_BACKUP_RETENTION_DAILY,
      weekly: process.env.FANMIND_BACKUP_RETENTION_WEEKLY,
      monthly: process.env.FANMIND_BACKUP_RETENTION_MONTHLY,
      fullDaily: process.env.FANMIND_BACKUP_RETENTION_FULL_DAILY,
      fullWeekly: process.env.FANMIND_BACKUP_RETENTION_FULL_WEEKLY,
      fullMonthly: process.env.FANMIND_BACKUP_RETENTION_FULL_MONTHLY,
    },
  });
}

export {
  ARTIFACT_PATTERNS,
  DEFAULT_POLICY,
  dayKey,
  discoverBackupPairs,
  executeRetention,
  isoWeekKey,
  monthKey,
  parseArtifactName,
  resolvePolicy,
  retentionErrorCode,
  selectRetention,
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`BACKUP_RETENTION_ERROR=${retentionErrorCode(error)}`);
    process.exit(1);
  });
}

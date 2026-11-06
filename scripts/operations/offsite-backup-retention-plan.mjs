#!/usr/bin/env node

import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';

import {
  DEFAULT_POLICY,
  parseArtifactName,
  selectRetention,
} from './backup-retention.mjs';

const execFileAsync = promisify(execFile);
const DEFAULT_ENV_FILE = '/etc/fanmind-backup/worker.env';
const DEFAULT_REMOTE_PATH = 'fanmind/production';
const BACKUP_TYPES = Object.freeze([
  'database',
  'storage',
  'server_config',
  'full',
]);
const SAFE_ERROR_CODES = new Set([
  'dry_run_flag_required',
  'execute_mode_not_implemented',
  'offsite_not_enabled',
  'offsite_remote_missing',
  'offsite_config_unreadable',
  'rclone_inventory_failed',
  'rclone_inventory_invalid',
  'offsite_no_complete_pairs',
  'offsite_incomplete_pairs_present',
  'offsite_unrecognized_pairs_present',
  'offsite_latest_pair_not_protected',
]);

function parseEnvText(text) {
  const values = new Map();
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const separator = line.indexOf('=');
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function retentionOptionsFromConfig(config) {
  return {
    daily: config.get('FANMIND_BACKUP_RETENTION_DAILY'),
    weekly: config.get('FANMIND_BACKUP_RETENTION_WEEKLY'),
    monthly: config.get('FANMIND_BACKUP_RETENTION_MONTHLY'),
    fullDaily: config.get('FANMIND_BACKUP_RETENTION_FULL_DAILY'),
    fullWeekly: config.get('FANMIND_BACKUP_RETENTION_FULL_WEEKLY'),
    fullMonthly: config.get('FANMIND_BACKUP_RETENTION_FULL_MONTHLY'),
  };
}

function parseRcloneListing(listingText) {
  let entries;
  try {
    entries = JSON.parse(String(listingText));
  } catch {
    throw new Error('rclone_inventory_invalid');
  }
  if (!Array.isArray(entries)) throw new Error('rclone_inventory_invalid');
  return entries;
}

function buildOffsiteInventory(entries) {
  const names = entries
    .map((entry) => String(entry?.Path || entry?.Name || '').trim())
    .filter(Boolean)
    .filter((name) => /(^|\/)fanmind-.*\.age(?:\.sha256)?$/.test(name));

  const groups = new Map();
  for (const path of names) {
    const key = path.endsWith('.sha256') ? path.slice(0, -7) : path;
    const group = groups.get(key) || { artifact: null, checksum: null };
    if (path.endsWith('.sha256')) group.checksum = path;
    else group.artifact = path;
    groups.set(key, group);
  }

  const completePairs = [];
  const incompletePairs = [];
  const unrecognizedPairs = [];

  for (const group of groups.values()) {
    if (!group.artifact || !group.checksum) {
      incompletePairs.push({
        artifactPresent: Boolean(group.artifact),
        checksumPresent: Boolean(group.checksum),
      });
      continue;
    }

    const artifactName = basename(group.artifact);
    const parsed = parseArtifactName(artifactName);
    if (!parsed) {
      unrecognizedPairs.push({ complete: true });
      continue;
    }

    completePairs.push({
      ...parsed,
      artifactName,
      artifactPath: group.artifact,
      checksumName: basename(group.checksum),
      checksumPath: group.checksum,
    });
  }

  return {
    relevantObjectCount: names.length,
    completePairs,
    incompletePairs,
    unrecognizedPairs,
  };
}

function buildOffsiteRetentionPlan(entries, options = {}) {
  const inventory = buildOffsiteInventory(entries);
  const selection = selectRetention(inventory.completePairs, options);
  const typeSummaries = [];
  let latestPerTypeProtected = true;

  for (const type of BACKUP_TYPES) {
    const pairs = inventory.completePairs.filter((pair) => pair.type === type);
    const kept = selection.keep.filter((pair) => pair.type === type);
    const candidates = selection.remove.filter((pair) => pair.type === type);
    const latest = [...pairs].sort((a, b) => b.timestampMs - a.timestampMs)[0] || null;
    const latestProtected =
      !latest || kept.some((pair) => pair.artifactName === latest.artifactName);
    latestPerTypeProtected = latestPerTypeProtected && latestProtected;
    typeSummaries.push({
      type,
      complete: pairs.length,
      keep: kept.length,
      candidate: candidates.length,
      latestProtected,
    });
  }

  const structurallySafe =
    inventory.completePairs.length > 0 &&
    inventory.incompletePairs.length === 0 &&
    inventory.unrecognizedPairs.length === 0 &&
    latestPerTypeProtected;

  return {
    mode: 'read_only_dry_run',
    relevantObjectCount: inventory.relevantObjectCount,
    completePairCount: inventory.completePairs.length,
    orphanPairCount: inventory.incompletePairs.length,
    unrecognizedPairCount: inventory.unrecognizedPairs.length,
    keepPairCount: selection.keep.length,
    deletionCandidatePairCount: selection.remove.length,
    latestPerTypeProtected,
    structurallySafe,
    typeSummaries,
    policy: selection.policy,
  };
}

function formatPolicy(policy) {
  return BACKUP_TYPES.map((type) => {
    const current = policy[type] || DEFAULT_POLICY[type];
    return `${type}:${current.daily}-${current.weekly}-${current.monthly}`;
  }).join('|');
}

function formatPlanLines(plan, now = new Date()) {
  const lines = [
    `DRY_RUN_UTC=${now.toISOString()}`,
    'OFFSITE_RETENTION_MODE=read_only_dry_run',
    'OFFSITE_REMOTE_IDENTIFIER_REDACTED=true',
    `OFFSITE_RELEVANT_OBJECT_COUNT=${plan.relevantObjectCount}`,
    `OFFSITE_COMPLETE_PAIR_COUNT=${plan.completePairCount}`,
    `OFFSITE_ORPHAN_PAIR_COUNT=${plan.orphanPairCount}`,
    `OFFSITE_UNRECOGNIZED_PAIR_COUNT=${plan.unrecognizedPairCount}`,
    `OFFSITE_KEEP_PAIR_COUNT=${plan.keepPairCount}`,
    `OFFSITE_DELETION_CANDIDATE_PAIR_COUNT=${plan.deletionCandidatePairCount}`,
  ];

  for (const summary of plan.typeSummaries) {
    lines.push(
      `OFFSITE_RETENTION_TYPE=${summary.type}|complete:${summary.complete}|keep:${summary.keep}|candidate:${summary.candidate}|latest_protected:${summary.latestProtected}`,
    );
  }

  lines.push(`OFFSITE_LATEST_PER_TYPE_PROTECTED=${plan.latestPerTypeProtected}`);
  lines.push(`OFFSITE_RETENTION_PLAN_STRUCTURALLY_SAFE=${plan.structurallySafe}`);
  lines.push(`OFFSITE_POLICY=${formatPolicy(plan.policy)}`);
  lines.push('OFFSITE_RETENTION_EXECUTION_AVAILABLE=false');
  lines.push('OFFSITE_REMOTE_DELETE_EXECUTED=false');
  lines.push('OFFSITE_RETENTION_DRY_RUN_RESULT=success');
  return lines;
}

async function defaultRunner(binary, args) {
  try {
    return await execFileAsync(binary, args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    throw new Error('rclone_inventory_failed');
  }
}

async function planOffsiteRetention({
  envFile = process.env.FANMIND_BACKUP_ENV_FILE || DEFAULT_ENV_FILE,
  runner = defaultRunner,
  logger = console.log,
  now = new Date(),
} = {}) {
  let configText;
  try {
    configText = await readFile(envFile, 'utf8');
  } catch {
    throw new Error('offsite_config_unreadable');
  }

  const config = parseEnvText(configText);
  if (config.get('FANMIND_BACKUP_OFFSITE_ENABLED') !== 'true') {
    throw new Error('offsite_not_enabled');
  }

  const remote = config.get('FANMIND_BACKUP_RCLONE_REMOTE') || '';
  if (!remote) throw new Error('offsite_remote_missing');
  const remotePath =
    config.get('FANMIND_BACKUP_REMOTE_PATH') || DEFAULT_REMOTE_PATH;
  const rcloneConfig =
    config.get('FANMIND_BACKUP_RCLONE_CONFIG') ||
    '/etc/fanmind-backup/rclone.conf';
  const rcloneBinary = config.get('FANMIND_RCLONE_BIN') || 'rclone';

  const result = await runner(rcloneBinary, [
    '--config',
    rcloneConfig,
    'lsjson',
    `${remote}:${remotePath}`,
    '--files-only',
    '--recursive',
  ]);
  const entries = parseRcloneListing(result?.stdout ?? result);
  const plan = buildOffsiteRetentionPlan(
    entries,
    retentionOptionsFromConfig(config),
  );

  if (plan.completePairCount === 0) {
    throw new Error('offsite_no_complete_pairs');
  }
  if (plan.orphanPairCount > 0) {
    throw new Error('offsite_incomplete_pairs_present');
  }
  if (plan.unrecognizedPairCount > 0) {
    throw new Error('offsite_unrecognized_pairs_present');
  }
  if (!plan.latestPerTypeProtected) {
    throw new Error('offsite_latest_pair_not_protected');
  }

  for (const line of formatPlanLines(plan, now)) logger(line);
  return plan;
}

function safeErrorCode(error) {
  const message = error instanceof Error ? error.message : '';
  return SAFE_ERROR_CODES.has(message)
    ? message
    : 'offsite_retention_plan_failed';
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const execute = process.argv.includes('--execute');
  if (execute) throw new Error('execute_mode_not_implemented');
  if (!dryRun) throw new Error('dry_run_flag_required');
  await planOffsiteRetention();
}

export {
  BACKUP_TYPES,
  buildOffsiteInventory,
  buildOffsiteRetentionPlan,
  formatPlanLines,
  parseEnvText,
  parseRcloneListing,
  planOffsiteRetention,
  retentionOptionsFromConfig,
  safeErrorCode,
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error('OFFSITE_RETENTION_DRY_RUN_RESULT=failed');
    console.error(`OFFSITE_RETENTION_DRY_RUN_REASON=${safeErrorCode(error)}`);
    console.error('OFFSITE_REMOTE_DELETE_EXECUTED=false');
    process.exit(1);
  });
}

#!/usr/bin/env node
// Observation only: no install, service/config change, media, DB or provider call.
import { spawnSync } from 'node:child_process';
import { accessSync, constants, openSync, readSync, closeSync, readlinkSync, statSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ORIGIN = 'https://staging.fanmind.ch';
const UNIT = 'fanmind-staging.service';
const SHA = /^[a-f0-9]{40}$/u;
const FLAGS = ['FANMIND_SUPPORT_CENTRE_ENABLED', 'FANMIND_CHAT_ADMIN_MEDIA_ENABLED', 'FANMIND_CHAT_ADMIN_MEDIA_CATALOGUE_ENABLED', 'FANMIND_CHAT_ADMIN_MEDIA_VIDEO_ENABLED', 'FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED', 'FANMIND_STAGING_OPERATOR_SESSION_ENABLED', 'FANMIND_STRIPE_BILLING_WRITE_FREEZE'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
const CODES = new Set(['inspection_boundary', 'inspection_source', 'inspection_target', 'inspection_live_changed', 'inspection_service', 'inspection_identity', 'inspection_process_changed', 'inspection_unit', 'inspection_flags', 'inspection_private_tmp', 'inspection_failed']);

export function assertInspectionBoundary(env) {
  if (env.GITHUB_REPOSITORY !== 'FanMind/FanMind' || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.CONFIRMATION !== 'inspect-staging-media-host') fail('inspection_boundary');
  if (!SHA.test(env.GITHUB_SHA ?? '') || env.REVIEWED_COMMIT !== env.GITHUB_SHA || !SHA.test(env.EXPECTED_LIVE_COMMIT ?? '')) fail('inspection_source');
  if (env.FANMIND_TARGET_SUPABASE_PROJECT_REF !== 'vshyhvgcmrlagvfnvomc' || env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF !== 'drqkpdvtbbrrdwmtrodz') fail('inspection_target');
}

export function projectInspectionFlags(text) {
  if (typeof text !== 'string' || text.length > 1048576) fail('inspection_flags');
  const result = Object.fromEntries(FLAGS.map(key => [key, 'unset']));
  for (const entry of text.split('\0')) {
    const index = entry.indexOf('=');
    const key = entry.slice(0, index);
    if (!FLAGS.includes(key)) continue;
    const value = entry.slice(index + 1);
    if (!['true', 'false'].includes(value) || result[key] !== 'unset') fail('inspection_flags');
    result[key] = value;
  }
  return result;
}

export function assertProcessTarget(text, env) {
  if (typeof text !== 'string' || text.length > 1048576) fail('inspection_target');
  const expected = { FANMIND_RELEASE_COMMIT: env.EXPECTED_LIVE_COMMIT, FANMIND_RUNTIME_ENVIRONMENT: 'staging', NEXT_PUBLIC_APP_URL: ORIGIN, NEXT_PUBLIC_SUPABASE_URL: 'https://vshyhvgcmrlagvfnvomc.supabase.co' };
  for (const [key, value] of Object.entries(expected)) {
    const rows = text.split('\0').filter(line => line.startsWith(`${key}=`));
    if (rows.length !== 1 || rows[0] !== `${key}=${value}`) fail('inspection_target');
  }
}

export function codecObservation(encoders, decoders, demuxers) {
  const names = text => new Set(text.split('\n').map(line => /^\s*[A-Z.]{1,6}\s+(\S+)/u.exec(line)?.[1]).filter(Boolean).flatMap(name => name.split(',')));
  const e = names(encoders), d = names(decoders), m = names(demuxers);
  return { h264_encoder: e.has('libx264'), aac_encoder: e.has('aac'), h264_decoder: d.has('h264'), hevc_decoder: d.has('hevc'), av1_decoder: ['av1', 'libdav1d', 'libaom-av1'].some(name => d.has(name)), vp8_decoder: ['vp8', 'libvpx'].some(name => d.has(name)), vp9_decoder: ['vp9', 'libvpx-vp9'].some(name => d.has(name)), mp4_demuxer: m.has('mov'), webm_demuxer: m.has('webm') && m.has('matroska') };
}

function command(executable, args) {
  const r = spawnSync(executable, args, { encoding: 'utf8', timeout: 5000, maxBuffer: 131072, env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' }, stdio: ['ignore', 'pipe', 'pipe'] });
  if (r.error || r.status !== 0) fail('inspection_failed');
  return r.stdout;
}

function boundedRead(path) {
  const fd = openSync(path, constants.O_RDONLY);
  try { const buffer = Buffer.alloc(1048577); let size = 0; while (size < buffer.length) { const n = readSync(fd, buffer, size, buffer.length - size); if (!n) break; size += n; } if (size > 1048576) fail('inspection_failed'); return buffer.subarray(0, size).toString('utf8'); }
  finally { closeSync(fd); }
}

function service() {
  const text = command('/usr/bin/systemctl', ['show', UNIT, '--no-pager', '--property=MainPID,ActiveState,User,PrivateTmp,UMask,NoNewPrivileges,ProtectSystem,MemoryMax,MemoryCurrent,CPUQuotaPerSecUSec,TasksMax']);
  const values = Object.fromEntries(text.trim().split('\n').map(line => { const i = line.indexOf('='); return [line.slice(0, i), line.slice(i + 1)]; }));
  if (values.ActiveState !== 'active' || !/^[1-9][0-9]{0,9}$/u.test(values.MainPID ?? '') || values.User !== 'fanmind-staging') fail('inspection_service');
  if (!['yes', 'true'].includes(values.PrivateTmp) || values.UMask !== '0077' || values.NoNewPrivileges !== 'yes' || values.ProtectSystem !== 'strict') fail('inspection_unit');
  const pid = values.MainPID;
  if (!process.getuid || process.getuid() === 0 || statSync(`/proc/${pid}`).uid !== process.getuid()) fail('inspection_identity');
  if (!boundedRead(`/proc/${pid}/cgroup`).split('\n').some(line => /^0::\/[^\n]*\/fanmind-staging\.service$/u.test(line))) fail('inspection_identity');
  // comm may contain spaces or parentheses; starttime is field22 after its last ).
  const stat = boundedRead(`/proc/${pid}/stat`);
  const start = stat.slice(stat.lastIndexOf(')') + 2).split(' ')[19];
  if (!/^\d+$/u.test(start ?? '')) fail('inspection_process_changed');
  return { pid, identity: `${pid}:${start}:${readlinkSync(`/proc/${pid}/ns/mnt`)}`, values };
}

async function live(env) {
  const r = await fetch(`${ORIGIN}/api/version`, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!r.ok || !r.body) fail('inspection_live_changed');
  const reader = r.body.getReader(); let text = '', size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 8192) fail('inspection_live_changed'); text += Buffer.from(part.value).toString('utf8'); } }
  finally { await reader.cancel().catch(() => {}); }
  const data = JSON.parse(text);
  if (data.application !== 'fanmind' || data.runtimeEnvironment !== 'staging' || data.releaseCommit !== env.EXPECTED_LIVE_COMMIT) fail('inspection_live_changed');
}

function binaries() {
  const result = {};
  for (const name of ['ffmpeg', 'ffprobe']) {
    const path = `/usr/bin/${name}`;
    try {
      const stat = statSync(path); accessSync(path, constants.X_OK);
      if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o022)) { result[name] = false; continue; }
      const output = command(path, ['-version']);
      result[name] = new RegExp(`^${name} version [A-Za-z0-9.+~:_-]{1,80}(?:\\s|$)`, 'u').test(output);
    } catch { result[name] = false; }
  }
  return { ...result, codecs: result.ffmpeg ? codecObservation(command('/usr/bin/ffmpeg', ['-hide_banner', '-encoders']), command('/usr/bin/ffmpeg', ['-hide_banner', '-decoders']), command('/usr/bin/ffmpeg', ['-hide_banner', '-demuxers'])) : null };
}

function tmp(snapshot) {
  // Kernel-provided root reaches this running service's actual PrivateTmp mount.
  const path = `/proc/${snapshot.pid}/root/tmp`;
  try {
    const stat = statSync(path); if (!stat.isDirectory() || !(stat.mode & 0o1000)) fail('inspection_private_tmp');
    accessSync(path, constants.W_OK | constants.X_OK);
    const fs = statfsSync(path, { bigint: true });
    return { writable_by_service_identity: true, sticky: true, available_bytes: String(fs.bavail * fs.bsize), cleanup_acceptance: 'not_run', media_conversion: 'not_run' };
  } catch { fail('inspection_private_tmp'); }
}

const resource = value => /^(?:[0-9]{1,20}|infinity|\[not set\])$/u.test(value ?? '') ? value : 'unknown';
export async function inspectMediaHost(env, adapters = { live, service, binaries, tmp, flags: (s, target) => { const text = boundedRead(`/proc/${s.pid}/environ`); assertProcessTarget(text, target); return projectInspectionFlags(text); } }) {
  assertInspectionBoundary(env);
  await adapters.live(env);
  const before = adapters.service();
  const flags = adapters.flags(before, env), tools = adapters.binaries(), temporary = adapters.tmp(before);
  const after = adapters.service();
  await adapters.live(env);
  if (before.identity !== after.identity) fail('inspection_process_changed');
  return { status: 'observed', reviewed_commit: env.GITHUB_SHA, live_commit: env.EXPECTED_LIVE_COMMIT, flags, tools, temporary, resources: { memory_max: resource(after.values.MemoryMax), memory_current: resource(after.values.MemoryCurrent), cpu_quota_per_second_us: resource(after.values.CPUQuotaPerSecUSec), tasks_max: resource(after.values.TasksMax) }, video_activation_ready: false, reason: 'actual_conversion_cleanup_and_schema_acceptance_still_required' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { console.log(JSON.stringify(await inspectMediaHost(process.env))); }
  catch (error) { console.error(JSON.stringify({ status: 'blocked', code: CODES.has(error?.code) ? error.code : 'inspection_failed' })); process.exitCode = 1; }
}

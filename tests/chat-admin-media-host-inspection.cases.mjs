import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { assertInspectionBoundary, assertProcessTarget, codecObservation, inspectMediaHost, projectInspectionFlags } from '../scripts/operations/chat-admin-media-host-inspection.mjs';

const env = { GITHUB_REPOSITORY: 'FanMind/FanMind', GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_SHA: 'a'.repeat(40), REVIEWED_COMMIT: 'a'.repeat(40), EXPECTED_LIVE_COMMIT: 'b'.repeat(40), CONFIRMATION: 'inspect-staging-media-host', FANMIND_TARGET_SUPABASE_PROJECT_REF: 'vshyhvgcmrlagvfnvomc', FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: 'drqkpdvtbbrrdwmtrodz' };
test('host observation denies wrong source, event, branch and targets before any host call', async () => {
  assert.doesNotThrow(() => assertInspectionBoundary(env));
  for (const patch of [{ GITHUB_REPOSITORY: 'foreign/repo' }, { GITHUB_REF: 'refs/heads/feature' }, { GITHUB_EVENT_NAME: 'push' }, { REVIEWED_COMMIT: 'c'.repeat(40) }, { EXPECTED_LIVE_COMMIT: 'main' }, { CONFIRMATION: 'activate' }, { FANMIND_TARGET_SUPABASE_PROJECT_REF: 'drqkpdvtbbrrdwmtrodz' }, { FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: '' }]) {
    let calls = 0;
    await assert.rejects(inspectMediaHost({ ...env, ...patch }, { live: () => { calls++; } }), /inspection_/u);
    assert.equal(calls, 0);
  }
});
test('process flags expose only exact allowlisted booleans and reject ambiguity', () => {
  const projected = projectInspectionFlags('SECRET_KEY=synthetic-private\0FANMIND_SUPPORT_CENTRE_ENABLED=true\0FANMIND_CHAT_ADMIN_MEDIA_ENABLED=false\0');
  assert.equal(projected.FANMIND_SUPPORT_CENTRE_ENABLED, 'true');
  assert.equal(projected.FANMIND_CHAT_ADMIN_MEDIA_ENABLED, 'false');
  assert.equal(projected.FANMIND_CHAT_ADMIN_MEDIA_VIDEO_ENABLED, 'unset');
  assert.doesNotMatch(JSON.stringify(projected), /synthetic-private|SECRET_KEY/u);
  for (const value of ['FANMIND_SUPPORT_CENTRE_ENABLED=true\0FANMIND_SUPPORT_CENTRE_ENABLED=false', 'FANMIND_SUPPORT_CENTRE_ENABLED=TRUE', 'FANMIND_SUPPORT_CENTRE_ENABLED=unsafe-value', 'x'.repeat(1048577)]) assert.throws(() => projectInspectionFlags(value), /inspection_flags/u);
});
test('codec observations distinguish absent encoders and formats without claiming conversion', () => {
  const result = codecObservation(' V....D libx264 description\n A..... aac description', ' VFS..D h264 desc\n VFS..D hevc desc\n V..... libdav1d desc\n V..... vp8 desc\n V..... vp9 desc', ' D  mov,mp4,m4a,3gp,3g2,mj2 desc\n D  matroska,webm desc');
  assert.ok(Object.values(result).every(Boolean));
  assert.equal(codecObservation('', '', '').h264_encoder, false);
  assert.equal(codecObservation('', '', ' D  mov desc').webm_demuxer, false);
});
test('the actual service process must bind exact live release, Staging origin and database without exposing private values', () => {
  const entries = [`FANMIND_RELEASE_COMMIT=${env.EXPECTED_LIVE_COMMIT}`, 'FANMIND_RUNTIME_ENVIRONMENT=staging', 'NEXT_PUBLIC_APP_URL=https://staging.fanmind.ch', 'NEXT_PUBLIC_SUPABASE_URL=https://vshyhvgcmrlagvfnvomc.supabase.co'];
  assert.doesNotThrow(() => assertProcessTarget(entries.join('\0') + '\0SECRET_KEY=synthetic-private', env));
  for (let i = 0; i < entries.length; i++) {
    assert.throws(() => assertProcessTarget(entries.filter((_, j) => j !== i).join('\0'), env), /inspection_target/u);
    assert.throws(() => assertProcessTarget([...entries, entries[i]].join('\0'), env), /inspection_target/u);
  }
  assert.throws(() => assertProcessTarget(entries.join('\0').replace('vshyhvgcmrlagvfnvomc', 'drqkpdvtbbrrdwmtrodz'), env), /inspection_target/u);
});
function harness({ changed = false, liveError = false, cleanupError = false } = {}) {
  let calls = 0, services = 0;
  return { get calls() { return calls; }, adapters: {
    live: async () => { calls++; if (liveError) throw new Error('synthetic-live-mismatch'); },
    service: () => { services++; return { identity: changed && services > 1 ? 'new-process' : 'stable-process', values: { MemoryMax: 'infinity', MemoryCurrent: '42', CPUQuotaPerSecUSec: 'private-unexpected', TasksMax: '100' } }; },
    flags: () => projectInspectionFlags('FANMIND_STAGING_OPERATOR_SESSION_ENABLED=true\0'),
    binaries: () => ({ ffmpeg: false, ffprobe: false, codecs: null }),
    tmp: () => { if (cleanupError) throw new Error('synthetic-permission-denied'); return { writable_by_service_identity: true, cleanup_acceptance: 'not_run' }; },
  } };
}
test('host inspection checks live source twice and never upgrades observations to activation PASS', async () => {
  const h = harness(); const result = await inspectMediaHost(env, h.adapters);
  assert.equal(h.calls, 2); assert.equal(result.status, 'observed');
  assert.equal(result.video_activation_ready, false); assert.equal(result.tools.ffmpeg, false);
  assert.equal(result.resources.memory_max, 'infinity'); assert.equal(result.resources.cpu_quota_per_second_us, 'unknown');
  assert.equal(result.temporary.cleanup_acceptance, 'not_run');
  assert.equal(result.flags.FANMIND_STAGING_OPERATOR_SESSION_ENABLED, 'true');
});
test('host observation refuses changed live/process state and unreadable private temporary space', async () => {
  for (const options of [{ changed: true }, { liveError: true }, { cleanupError: true }]) {
    const h = harness(options); await assert.rejects(inspectMediaHost(env, h.adapters));
  }
});
test('CLI denies an unapproved invocation and emits no inherited sensitive value', () => {
  const child = spawnSync(process.execPath, ['scripts/operations/chat-admin-media-host-inspection.mjs'], { encoding: 'utf8', env: { GITHUB_REPOSITORY: 'foreign/repo', SECRET_KEY: 'synthetic-private-never-log' } });
  assert.equal(child.status, 1);
  assert.equal(child.stdout, '');
  assert.deepEqual(JSON.parse(child.stderr), { status: 'blocked', code: 'inspection_boundary' });
  assert.doesNotMatch(child.stderr, /synthetic-private-never-log|SECRET_KEY/u);
});

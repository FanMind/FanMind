import { ENVIRONMENT, OWNER_ID, environmentPolicy, request } from './backup-worker-install-policy.mjs';
const env = process.env;
try {
  const input = request(env.REQUESTED_ACTION,env.REVIEWED_CONTROLLER_COMMIT,env.WORKER_SOURCE_COMMIT,env.EXPECTED_APPLICATION_COMMIT);
  if (env.GITHUB_REPOSITORY !== 'FanMind/FanMind' || env.GITHUB_REPOSITORY_ID !== '1259448985' ||
      env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_REF !== 'refs/heads/main' ||
      env.GITHUB_SHA !== input.controllerCommit || env.GITHUB_ACTOR_ID !== String(OWNER_ID) ||
      env.CONFIRMATION !== `backup-worker-${input.action}`) throw new Error();
  async function get(path) {
    const response = await fetch(`https://api.github.com/repos/FanMind/FanMind/${path}`, {
      headers:{ Accept:'application/vnd.github+json',Authorization:`Bearer ${env.GITHUB_TOKEN}`, 'X-GitHub-Api-Version':'2026-03-10' },
      signal:AbortSignal.timeout(15000),redirect:'error',
    });
    if (!response.ok) throw new Error();
    const text = await response.text();
    if (text.length > 256000) throw new Error();
    return JSON.parse(text);
  }
  const branch = await get('branches/main');
  if (branch.commit?.sha !== input.controllerCommit || branch.protected !== true) throw new Error();
  const value = await get(`environments/${ENVIRONMENT}`);
  const branches = await get(`environments/${ENVIRONMENT}/deployment-branch-policies?per_page=100`);
  environmentPolicy(value,branches);
  console.log('BACKUP_WORKER_GITHUB_PREFLIGHT=PASS');
} catch {
  console.error('BACKUP_WORKER_GITHUB_PREFLIGHT=BLOCK'); process.exitCode = 1;
}

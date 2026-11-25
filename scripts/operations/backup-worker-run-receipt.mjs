// Read-only reconciliation for the two existing production recovery workflows.
import { pathToFileURL } from 'node:url';

const repo = 'FanMind/FanMind';
const actions = new Map([
  ['backup-worker-production-control.yml', ['verify', 'install', 'rollback']],
  ['backup-worker-root-bootstrap.yml', ['inspect', 'bootstrap', 'prepare-contract-repair', 'update-prepared-controllers']],
]);

export async function readReceipt(workflow, action, commit, get) {
  if (!actions.get(workflow)?.includes(action) || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('Expected a recovery workflow, matching action and full commit SHA');
  }
  const order = [repo, workflow, 'main', commit, action].join('/');
  const query = new URLSearchParams({ branch: 'main', event: 'workflow_dispatch', head_sha: commit, per_page: '100' });
  const path = '/actions/workflows/' + workflow + '/runs?' + query;
  const { total_count: total, workflow_runs: runs } = await get(path);
  if (!Array.isArray(runs) || total !== runs.length || runs.length > 100) {
    throw new Error('Incomplete run inventory');
  }
  const matches = [];
  let unknown = false;
  for (const run of runs) {
    if (run.path !== '.github/workflows/' + workflow || run.head_sha !== commit ||
        run.event !== 'workflow_dispatch' || run.head_branch !== 'main' || !Number.isSafeInteger(run.id)) {
      throw new Error('Unexpected run identity');
    }
    const expected = candidate => 'Recovery ' + candidate + ' · ' + commit + ' · run ' + run.run_number;
    if (run.display_title === expected(action)) matches.push(run);
    else if (!actions.get(workflow).some(candidate => run.display_title === expected(candidate))) unknown = true;
  }
  const ids = matches.map(run => run.id);
  if (unknown || matches.length > 1) return { order, state: 'ambiguous', ids };
  if (!matches.length) return { order, state: 'unobserved', ids };
  const [run] = matches;
  if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) throw new Error('Missing attempt');
  const receipt = { order, id: run.id, attempt: run.run_attempt, state: run.status, conclusion: run.conclusion, url: 'https://github.com/' + repo + '/actions/runs/' + run.id };
  if (run.status === 'completed') {
    const result = await get('/actions/runs/' + run.id + '/attempts/' + run.run_attempt + '/jobs?per_page=100');
    if (!Array.isArray(result.jobs) || !result.jobs.length || result.total_count !== result.jobs.length) throw new Error('Incomplete job inventory');
    receipt.jobs = result.jobs.map(({ id, name, conclusion }) => ({ id, name, conclusion }));
  }
  return receipt;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const get = async path => {
    const response = await fetch('https://api.github.com/repos/' + repo + path, { redirect: 'error', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('GitHub HTTP ' + response.status);
    return response.json();
  };
  try {
    console.log(JSON.stringify(await readReceipt(...process.argv.slice(2, 5), get)));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

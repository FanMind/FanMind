// The protected caller reserves each slot on a dedicated ledger branch before POST.
import { pathToFileURL } from 'node:url';
const repo = 'FanMind/FanMind';
const ledger = 'ops/pilot-receipts';
const workflow = 'fanmind-dispatch-probe.yml';
const day = 86400000;

export async function operate({ issue, slot, activation, commit, bot, now, api }) {
  if (!Number.isSafeInteger(issue) || issue < 1 || !Number.isInteger(slot) || slot < 1 || slot > 10 ||
      !/^[a-f0-9]{40}$/.test(commit) || !/^[1-9][0-9]*$/.test(bot)) throw Error('Invalid binding');
  const start = Date.parse(activation);
  if (!Number.isFinite(start) || now() < start || now() >= start + 7 * day) throw Error('Inactive pilot');
  const order = n => 'fm-pilot-' + issue + '-' + n;
  const locate = async n => {
    const result = await api('GET', '/actions/workflows/' + workflow + '/runs?branch=main&event=workflow_dispatch&head_sha=' + commit + '&per_page=100');
    if (!Array.isArray(result.workflow_runs) || result.total_count !== result.workflow_runs.length) throw Error('Incomplete run inventory');
    const hits = result.workflow_runs.filter(r => r.display_title === order(n));
    if (hits.length > 1) throw Error('Duplicate receipts');
    const run = hits[0];
    if (!run) return null;
    if (run.path !== '.github/workflows/' + workflow || run.head_sha !== commit || run.event !== 'workflow_dispatch' ||
        run.head_branch !== 'main' || String(run.actor?.id) !== bot || run.run_attempt !== 1 || !Number.isSafeInteger(run.id)) throw Error('Run identity mismatch');
    if (run.status === 'completed' && run.conclusion === 'success') {
      const result = await api('GET', '/actions/runs/' + run.id + '/attempts/1/jobs');
      if (result.total_count !== 1 || result.jobs?.length !== 1 || result.jobs[0].name !== 'probe' ||
          result.jobs[0].conclusion !== 'success' || !result.jobs[0].steps?.some(s => s.name === 'Verify bounded order' && s.conclusion === 'success')) throw Error('Missing probe evidence');
    }
    return { id: run.id, status: run.status, conclusion: run.conclusion };
  };
  const existing = await locate(slot);
  const key = order(slot);
  const save = async (suffix, data) => {
    const path = '/contents/' + key + '.' + suffix + '.json';
    const content = Buffer.from(JSON.stringify(data)).toString('base64');
    const previous = await api('GET', path + '?ref=' + encodeURIComponent(ledger), null, [404]);
    if (previous) {
      if (previous.content?.replace(/\s/g, '') !== content) throw Error('Ledger mismatch');
      return false;
    }
    await api('PUT', path, { branch: ledger, message: key + ' ' + suffix, content });
    return true;
  };
  if (existing) {
    const claim = await api('GET', '/contents/' + key + '.claim.json?ref=' + encodeURIComponent(ledger));
    if (!claim || Buffer.from(claim.content, 'base64').toString() !== JSON.stringify({ key, commit, issue, slot })) throw Error('Missing matching claim');
    if (existing.status === 'completed') await save('result', { key, commit, ...existing });
    return existing;
  }
  if (slot > 1) {
    const prev = await locate(slot - 1);
    if (prev?.status !== 'completed' || prev.conclusion !== 'success') throw Error('Previous slot incomplete');
    await savePrevious(slot - 1, prev);
  }
  async function savePrevious(n, result) {
    // Completion is persisted by the previous order before admitting its successor.
    const record = await api('GET', '/contents/' + order(n) + '.result.json?ref=' + encodeURIComponent(ledger));
    const expected = JSON.stringify({ key: order(n), commit, ...result });
    if (Buffer.from(record.content, 'base64').toString() !== expected) throw Error('Previous receipt mismatch');
  }
  const reserved = await save('claim', { key, commit, issue, slot });
  if (!reserved) return { status: 'reserved-awaiting-reconciliation' };
  if (now() >= start + 7 * day) throw Error('Pilot expired');
  await api('POST', '/actions/workflows/' + workflow + '/dispatches', {ref:'main',inputs:{order:key,commit}});
  return { status: 'accepted-awaiting-run' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  const api = async (method, path, body, allowed = []) => {
    const token = path.startsWith('/contents/') ? env.LEDGER_TOKEN : env.APP_TOKEN;
    const response = await fetch('https://api.github.com/repos/' + repo + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(20000),
      headers: { authorization:'Bearer ' + token,'content-type':'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (allowed.includes(response.status)) return null;
    if (!response.ok) throw Error('GitHub HTTP ' + response.status);
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  };
  const match = /^\/fanmind-pilot (10|[1-9])$/.exec(env.COMMAND || '');
  if (!match) throw Error('Invalid command');
  const args = {issue:Number(env.ISSUE),slot:Number(match[1]),activation:env.ACTIVATED_AT,commit:env.GITHUB_SHA,bot:env.BOT_ID,now:Date.now,api};
  let result = await operate(args);
  for (let i=0; i<12 && result.status !== 'completed'; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    result = await operate(args);
  }
  console.log(JSON.stringify(result));
  if (result.status !== 'completed' || result.conclusion !== 'success') process.exitCode=1;
}

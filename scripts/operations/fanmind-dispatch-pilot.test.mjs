import test from 'node:test';
import assert from 'node:assert/strict';
import { operate } from './fanmind-dispatch-pilot.mjs';

function fixture() {
  const files = new Map(), runs = [];
  let sends = 0;
  const commit = 'a'.repeat(40);
  const args = { issue: 22, slot: 1, commit, bot: '21', activation: '2026-11-27T00:00:00Z', now: () => Date.parse('2026-11-28T12:00:00Z') };
  const api = async (method, path, body) => {
    if (path.startsWith('/contents/')) {
      const name = path.split('?')[0];
      if (method === 'GET') return files.get(name) || null;
      if (files.has(name)) throw Error('Already claimed');
      files.set(name, body);
      return {};
    }
    if (method === 'POST') { sends++; throw Error('Lost response'); }
    if (path.includes('/jobs')) return {total_count:1,jobs:[{name:'probe',conclusion:'success',steps:[{name:'Verify bounded order',conclusion:'success'}]}]};
    return { total_count: runs.length, workflow_runs: runs };
  };
  const row = { id:42, actor:{id:21}, path:'.github/workflows/fanmind-dispatch-probe.yml',event:'workflow_dispatch',head_branch:'main',head_sha:commit,run_attempt:1,display_title:'fm-pilot-22-1',status:'completed',conclusion:'success' };
  return {call: (override={})=>operate({...args,api,...override}),runs,row,sends:()=>sends,files};
}
test('lost response survives a fresh invocation and a later receipt', async()=>{
  const f=fixture();
  assert.equal((await f.call()).status,'reserved-awaiting-reconciliation');
  assert.equal((await f.call()).status,'reserved-awaiting-reconciliation');
  f.runs.push(f.row);
  assert.equal((await f.call()).id,42);
  assert.equal((await f.call()).id,42);
  assert.equal(f.sends(),1);
  assert.equal(f.files.size,2);
});
test('concurrent admissions cannot both dispatch',async()=>{
  const f=fixture();
  await Promise.allSettled([f.call(),f.call()]);
  assert.equal(f.sends(),1);
});
test('time, quota, predecessor, actor and duplicates fail closed',async()=>{
  const f=fixture();
  for(const invalid of [{slot:11},{slot:0},{slot:2},{activation:'invalid'},{now:()=>Date.parse('2026-12-04T00:00:00Z')}]) await assert.rejects(f.call(invalid));
  f.runs.push({...f.row,actor:{id:33}});
  await assert.rejects(f.call(),/identity/);
  f.runs.push(f.row);
  await assert.rejects(f.call(),/Duplicate/);
  assert.equal(f.sends(),0);
});

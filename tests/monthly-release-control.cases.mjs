import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer, request } from 'node:http';
import { writeFileSync, readFileSync, mkdirSync, openSync, closeSync, fstatSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, execFile, spawnSync, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { withIsolatedReleaseHarness } from './fixtures/isolated-release-harness.mjs';
import { monthlyAuditFixture } from './fixtures/monthly-audit.mjs';
import { REQUIRED_MAIN_CHECKS, REQUIRED_PR_CHECKS } from '../scripts/operations/production-release-preflight.mjs';
import { performance } from 'node:perf_hooks';
import { sourcePlan, collectEvidence } from '../scripts/operations/monthly-release-package.mjs';
import { validateAdmission, sha256, runRelease, extractProductionBody, createProductionAdapter, runMonthlyCommand, validatePrivateProof, validateSqlReceipt, verifySqlProvenance, VERIFIER_FILES } from '../scripts/operations/monthly-release-control.mjs';

const candidate = 'b'.repeat(40), base = 'a'.repeat(40);
// Test-only routing: a missing/restarting process must never select a default
// HTTP port or crash the fixture server while PM2 changes its synthetic state.
function monthlyFixtureCommit(state) {
  const processes = Array.isArray(state?.processes)
    ? state.processes.filter(process => process?.name === 'fanmind') : [];
  const env = processes.length === 1 ? processes[0]?.pm2_env : null;
  return env?.status === 'online' && /^[a-f0-9]{40}$/u.test(env.FANMIND_RELEASE_COMMIT ?? '')
    ? env.FANMIND_RELEASE_COMMIT : null;
}
function monthlyFixtureProxy(readState, ports, unavailable = () => false) {
  return createServer((req, res) => {
    let port;
    try { if (!unavailable()) port = ports.get(monthlyFixtureCommit(readState())); }
    catch { /* Missing/unreadable synthetic PM2 state is unavailable. */ }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      res.writeHead(503); res.end(); return;
    }
    const proxy = request({ host: '127.0.0.1', port, path: '/api/version' }, upstream => {
      res.writeHead(upstream.statusCode, upstream.headers); upstream.pipe(res);
    });
    proxy.on('error', () => { res.writeHead(502); res.end(); }); req.pipe(proxy);
  });
}

test('monthly HTTP fixture survives missing PM2 state and resumes only its registered application', async t => {
  const app = createServer((req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ releaseCommit: base })); });
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { app.closeAllConnections(); app.close(resolve); }));
  const online = { name: 'fanmind', pm2_env: { status: 'online', FANMIND_RELEASE_COMMIT: base } };
  let state = { processes: [online] }, readError = false, unavailable = false;
  const proxy = monthlyFixtureProxy(() => { if (readError) throw new Error('synthetic_state_unreadable'); return state; }, new Map([[base, app.address().port]]), () => unavailable);
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => { proxy.closeAllConnections(); proxy.close(resolve); }));
  const get = () => fetch(`http://127.0.0.1:${proxy.address().port}/api/version`, { signal: AbortSignal.timeout(5000) });
  for (state of [null, {}, { processes: null }, { processes: [] }, { processes: [null] },
    { processes: [{ name: 'fanmind' }] }, { processes: [{ ...online, name: 'foreign' }] },
    { processes: [online, online] }, { processes: [{ ...online, pm2_env: { ...online.pm2_env, status: 'stopped' } }] },
    { processes: [{ ...online, pm2_env: { ...online.pm2_env, FANMIND_RELEASE_COMMIT: candidate } }] }]) {
    assert.equal((await get()).status, 503);
  }
  state = { processes: [online] }; readError = true; assert.equal((await get()).status, 503);
  readError = false; unavailable = true; assert.equal((await get()).status, 503);
  unavailable = false;
  const recovered = await get(); assert.equal(recovered.status, 200); assert.equal((await recovered.json()).releaseCommit, base);
});

function admission(source = { base, candidate, tree: 'c'.repeat(40), changes: [], sql: [], evidence: { acceptances: [] } }) {
  return { version: 1, source, target: 'production', controller: '.github/workflows/deploy-fanmind.yml', ownerId: '270165082',
    issuedAt: new Date(Date.now() - 10000).toISOString(), expiresAt: new Date(Date.now() + 7200000).toISOString(),
    coverage: source.changes.map(x => ({ path: x.path, kind: 'source_ci' })), sql: [],
    restore: { productionCommit: source.base, schemaFingerprint: 'a'.repeat(64), receipts: Array(4).fill('c'.repeat(64)) },
    rehearsal: { result: 'PASS', candidate: source.candidate, reportSha256: 'd'.repeat(64), elapsedMs: 1000, pg17: true, sourceTree: source.tree, sourceCommit: source.candidate, runId: 3 },
    configuration: { supportDisabled: false, supportHelp: false } };
}
const hash = a => sha256(JSON.stringify(a.source, null, 2) + '\n');

test('monthly admission binds all changes, SQL, safety evidence, expiry and configuration', () => {
  const a = admission(); validateAdmission(a, hash(a), base, candidate);
  for (const alter of [
    x => { x.source.candidate = base; }, x => { x.ownerId = 'other'; },
    x => { x.expiresAt = '2000-01-01T00:00:00Z'; }, x => { x.restore.productionCommit = candidate; },
    x => { x.rehearsal.elapsedMs = 3600001; }, x => { x.rehearsal.result = 'PARTIAL'; },
    x => { x.source.changes.push({ path: 'src/app/page.tsx' }); x.coverage.push({ path: 'src/app/page.tsx', kind: 'source_ci' }); },
    x => { x.source.sql.push({ path: 'supabase/controlled/fixture.sql', sha256: 'a'.repeat(64) }); },
  ]) { const b = structuredClone(a); alter(b); assert.throws(() => validateAdmission(b, hash(b), base, candidate)); }
});

test('one existing Production body remains canonical; optional monthly mode preserves Owner/environment/lock', () => {
  const workflow = readFileSync('.github/workflows/deploy-fanmind.yml', 'utf8');
  const body = extractProductionBody(workflow);
  assert.match(body, /deploy-isolated-release\.sh/u); assert.match(body, /sudo systemctl daemon-reload/u);
  assert.equal(spawnSync('bash', ['-n'], { input: body }).status, 0);
  assert.match(workflow, /group: fanmind-production-deploy/u); assert.match(workflow, /environment: production/u);
  assert.match(workflow, /flock -n \/var\/www\/fanmind\/\.monthly-release.lock/u);
  assert.throws(() => extractProductionBody(workflow.replace('END_REVIEWED_PRODUCTION_BODY', 'BROKEN')));
  const shell = readFileSync('scripts/operations/deploy-isolated-release.sh', 'utf8');
  assert.match(shell, /monthly_boundary switch/u); assert.match(shell, /timeout --foreground --signal=TERM/u);
  const control = readFileSync('scripts/operations/monthly-release-control.mjs', 'utf8');
  assert.match(control, /delete childEnv\.GITHUB_TOKEN/u);
  assert.doesNotMatch(control, /child\.kill|pg_restore|supabase db push/u);
});

test('phase timeout, failure and interrupted-state recovery never reuse journal as authority', async () => {
  let now = 0, deploys = 0, saved;
  const a = admission(), packageHash = hash(a);
  const deps = { packageHash, clock: () => now, save: async s => { saved = s; }, preflight: async () => {},
    deploy: async () => { deploys++; now += 1200001; }, tests: async () => assert.fail('tests after timeout'), closeout: async () => {} };
  const failed = await runRelease(a, deps);
  assert.equal(failed.state, 'BUDGET_EXCEEDED_NOT_COMPLETE'); assert.equal(deploys, 1);
  assert.equal(saved.state, failed.state);
  now = 0;
  const blocked = await runRelease(a, { ...deps, deploy: async () => assert.fail('blind retry') }, failed);
  assert.equal(blocked.failure, 'resume_inspection_approval_required');
  assert.equal(saved.attempt, failed.attempt, 'rejected resume must preserve interrupted evidence');
  a.resumeAfterAttempt = failed.attempt; a.issuedAt = failed.updatedAt;
  now = 0;
  const resumed = await runRelease(a, { ...deps, deploy: async () => { deploys++; }, tests: async () => {}, closeout: async () => {} }, failed);
  assert.equal(resumed.state, 'COMPLETE'); assert.equal(deploys, 2);
  const wrong = await runRelease(a, { ...deps, packageHash: 'e'.repeat(64) }, failed);
  assert.equal(wrong.failure, 'resume_identity');
  now = 0;
  const late = await runRelease(a, { ...deps, preflight: async () => {}, deploy: async () => {}, tests: async () => {}, closeout: async () => {}, save: async value => { if (value.state === 'COMPLETE') now = 3600001; } });
  assert.equal(late.state, 'BUDGET_EXCEEDED_NOT_COMPLETE');
});

// Same Production adapter + extracted workflow body + existing isolated shell.
// Only external GitHub/root evidence, sudo/systemd and process-manager transports
// are simulated. Git archives, HTTP application processes, shell/checkpoints and
// (required hosted job) PostgreSQL17 transactions execute for real.
test('full integrated monthly adapter rehearsal with safe transport fixtures', { timeout: 120000 }, async t => withIsolatedReleaseHarness(t, async ctx => {
  const started = performance.now(), { root, seed, source, fakeBin, pm2State, baseEnv, operationsHeads } = ctx;
  const reviewedWorkflow = readFileSync('.github/workflows/deploy-fanmind.yml', 'utf8');
  const body = extractProductionBody(reviewedWorkflow), execAsync = promisify(execFile);
  const put = (p, text, mode = 0o644) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, text, { mode }); };
  const git = (where, ...args) => execFileSync('git', ['-C', where, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const paths = [...VERIFIER_FILES, '.github/workflows/deploy-fanmind.yml'];
  for (const match of body.matchAll(/sudo install[^\n]*? ([A-Za-z0-9_./@-]+) (\/[A-Za-z0-9_./@-]+)\n/gu)) if (/^(scripts|config|ops|src|supabase)\//u.test(match[1])) paths.push(match[1]);
  for (const path of new Set(paths)) if (!path.endsWith('20260806203023_harden_trigger_function_privileges.sql')) put(join(seed, path), readFileSync(path));
  put(join(seed, 'fixture.json'), '{"version":1}\n');
  git(seed, 'add', '.'); git(seed, 'commit', '-qm', 'synthetic complete base'); const old = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'push', 'origin', 'main'); git(source, 'fetch', 'origin'); git(source, 'reset', '--hard', old);
  const sqlPath = 'supabase/controlled/20260806203023_harden_trigger_function_privileges.sql';
  const sql = 'CREATE TABLE IF NOT EXISTS monthly_release_fixture (id integer PRIMARY KEY, value text NOT NULL);';
  const sourceSql=readFileSync(sqlPath);
  put(join(seed, sqlPath), sourceSql); put(join(seed, 'fixture.json'), '{"version":2}\n');
  git(seed, 'add', '.'); git(seed, 'commit', '-qm', 'synthetic candidate'); const target = git(seed, 'rev-parse', 'HEAD');
  git(seed, 'push', 'origin', 'main'); git(source, 'fetch', 'origin');
  put(join(source, '.env.production'), 'FANMIND_ENABLE_ISOLATED_RELEASE_DEPLOY=true\nFANMIND_SUPPORT_CENTRE_ENABLED=true\n', 0o600);
  // Monthly releases start from the already installed cluster/current-link
  // contract. The shared harness and its original legacy migration tests stay unchanged.
  const state0 = JSON.parse(readFileSync(pm2State));
  Object.assign(state0.processes[0].pm2_env, { FANMIND_RELEASE_COMMIT: old, exec_mode: 'cluster_mode', pm_cwd: ctx.currentLink });
  put(pm2State, JSON.stringify(state0));
  const container = process.env.FANMIND_MONTHLY_PG17_CONTAINER_ID, schema = `monthly_fixture_${process.pid}_${Date.now()}`;
  assert.ok(!process.env.FANMIND_MONTHLY_PG17_REQUIRED || /^[a-f0-9]{12,64}$/u.test(container ?? ''), 'required PG17 service missing');
  const query = text => execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres', '-At'], { input: text, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  let schemaPresent=false;
  if (container) {
    assert.equal(process.env.FANMIND_MONTHLY_PG17_REQUIRED,'true');
    assert.equal(process.env.GITHUB_ACTIONS,'true');
    assert.equal(process.env.GITHUB_REPOSITORY,'FanMind/FanMind');
    assert.equal(process.env.GITHUB_WORKFLOW,'FanMind CI');
    assert.ok(['pull_request','push'].includes(process.env.GITHUB_EVENT_NAME));
    assert.match(execFileSync('docker',['inspect','--format','{{.Config.Image}}',container],{encoding:'utf8'}), /^postgres:17\.11-trixie@sha256:e38411452a464af89e5adadb8d223bf53b898d47d6ef918b2d58c08707350449\s*$/u);
    assert.match(query('SHOW server_version;'), /^17\./u);
    query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}; BEGIN; ${sql} INSERT INTO monthly_release_fixture VALUES (1,'preserved') ON CONFLICT DO NOTHING; COMMIT; BEGIN; ${sql} COMMIT; BEGIN; INSERT INTO monthly_release_fixture VALUES (2,'rollback'); ROLLBACK;`);
    assert.equal(query(`SELECT count(*) FROM ${schema}.monthly_release_fixture;`), '1');
    schemaPresent=true;t.after(() => {if(schemaPresent)query(`DROP SCHEMA ${schema} CASCADE;`);});
  }
  const ports = new Map(), children = [];
  t.after(async () => { for (const child of children) { if (child.exitCode === null) { const done = new Promise(yes => child.once('exit', yes)); child.kill('SIGTERM'); const timer=setTimeout(()=>child.kill('SIGKILL'),1000); await done;clearTimeout(timer); } } });
  for (const commit of [old, target]) {
    const dir = join(root, 'http-app', commit); mkdirSync(dir, { recursive: true });
    execFileSync('tar', ['-xf', '-', '-C', dir], { input: execFileSync('git', ['-C', seed, 'archive', commit]) });
    const child = spawn(process.execPath, ['-e', `const http=require('node:http'),fs=require('node:fs');const version=JSON.parse(fs.readFileSync('fixture.json')).version;const s=http.createServer((q,r)=>{r.setHeader('Content-Type','application/json');r.end(JSON.stringify({releaseCommit:process.argv[1],featureVersion:version}));});s.listen(0,'127.0.0.1',()=>process.send(s.address().port));process.on('SIGTERM',()=>s.close(()=>process.exit(0)));`, commit], { cwd: dir, stdio: ['ignore','ignore','ignore','ipc'] });
    children.push(child); ports.set(commit, await new Promise((yes,no) => { child.once('message',yes); child.once('error',no); }));
  }
  let failSmoke = false, healthyBackup = true, injectTimeout = false, injectSmoke = false;
  const live = () => monthlyFixtureCommit(JSON.parse(readFileSync(pm2State)));
  const server = monthlyFixtureProxy(() => JSON.parse(readFileSync(pm2State)), ports, () => failSmoke);
  await new Promise(yes=>server.listen(0,'127.0.0.1',yes));t.after(()=>new Promise(yes=>{server.closeAllConnections();server.close(yes);}));
  const origin = `http://127.0.0.1:${server.address().port}`;
  mkdirSync(join(root,'host/etc/systemd/system'),{recursive:true});
  const realGit = execFileSync('which',['git'],{encoding:'utf8'}).trim();
  put(join(fakeBin,'git'), `#!/usr/bin/env bash\nif [[ "$*" == 'remote get-url origin' ]]; then echo https://github.com/FanMind/FanMind.git;else exec '${realGit}' "$@";fi\n`,0o755);
  put(join(fakeBin,'curl'), `#!/usr/bin/env python3
import os,sys
os.execv('/usr/bin/curl',['curl']+[a.replace('https://fanmind.ch',os.environ['MONTHLY_FIXTURE_ORIGIN']) for a in sys.argv[1:]])
`,0o755);
  put(join(fakeBin,'sudo'), `#!/usr/bin/env python3
import os,sys,subprocess
args=sys.argv[1:];cmd=args.pop(0);root=os.environ['MONTHLY_FIXTURE_ROOT'];host=root+'/host'
if cmd=='systemctl': sys.exit(0 if args and args[0]=='daemon-reload' else 1)
if cmd=='nginx': sys.exit(0)
if cmd.endswith('/write-backup-release-env.sh'):
 os.makedirs(host+'/etc/fanmind-backup',exist_ok=True);open(host+'/etc/fanmind-backup/release.env','w').write(args[0]);sys.exit(0)
if cmd=='install':
 clean=[];i=0
 while i<len(args):
  if args[i] in ['-o','-g']: i+=2;continue
  a=args[i];clean.append(host+a if a.startswith(('/usr/','/etc/')) else a);i+=1
 sys.exit(subprocess.call(['/usr/bin/install']+clean))
if cmd in ['mv','ln','rm'] and all(a.startswith(root) or a in ['--','-f','-s','-T','-n','-sfn','-Tf'] for a in args): sys.exit(subprocess.call(['/usr/bin/'+cmd]+args))
raise SystemExit('unapproved fixture command: '+cmd)
`,0o755);
  const npm = readFileSync(join(fakeBin,'npm'),'utf8');
  put(join(fakeBin,'npm'), npm + `\nif [[ "\${1:-}" == run && "\${2:-}" == smoke:public ]]; then\n [[ -z "\${GITHUB_TOKEN:-}" ]]\n node -e 'fetch(process.env.MONTHLY_FIXTURE_ORIGIN+"/api/version").then(async r=>{const b=await r.json();if(r.status!==200||b.releaseCommit!==process.env.FANMIND_EXPECTED_RELEASE_COMMIT||b.featureVersion!==2)process.exit(1)}).catch(()=>process.exit(1))'\nfi\n`,0o755);
  const env = { ...baseEnv, EXPECTED_RELEASE_COMMIT:target, EXPECTED_CURRENT_RELEASE:old, GITHUB_REF:'refs/heads/main', GITHUB_SHA:target, FANMIND_DEPLOY_BASE_URL:'https://fanmind.ch', MONTHLY_FIXTURE_ROOT:root, MONTHLY_FIXTURE_ORIGIN:origin, GITHUB_TOKEN:'synthetic-token-must-not-reach-runtime' };
  const stamp = Date.now(), iso = delta => new Date(stamp + delta).toISOString();
  const checkPayload = names => ({ total_count:names.length,check_runs:names.map((name,id)=>({id:id+1,name,status:'completed',conclusion:'success',app:{slug:'github-actions'}})) });
  const repo = {full_name:'FanMind/FanMind'};
  const run = (id,path,begin,end) => ({id,path,repository:repo,head_sha:target,head_branch:'main',event:'workflow_dispatch',status:'completed',conclusion:'success',run_attempt:1,run_started_at:iso(begin),updated_at:iso(end)});
  const api = {
    'branches/main':{protected:true,commit:{sha:target}}, [`commits/${target}/check-runs?per_page=100`]:checkPayload([...new Set([...REQUIRED_MAIN_CHECKS,...REQUIRED_PR_CHECKS])]),
    [`commits/${target}/pulls?per_page=100`]:[{merge_commit_sha:target,merged_at:iso(-600000),base:{ref:'main'},head:{sha:target,repo}}],
    'actions/runs/1':run(1,'.github/workflows/deploy-staging.yml',-500000,-400000),
    'actions/runs/2':run(2,'.github/workflows/browser-e2e-staging.yml',-300000,-200000),
    'actions/runs/1/attempts/1/jobs?per_page=100':{total_count:1,jobs:[{name:'Deploy exact reviewed commit to isolated staging',status:'completed',conclusion:'success'}]},
    'actions/runs/2/attempts/1/jobs?per_page=100':{total_count:1,jobs:[{name:'Synthetic login and contact read-only flow',status:'completed',conclusion:'success'}]},
    'actions/runs/99':{...run(99,'.github/workflows/deploy-fanmind.yml',0,0),check_suite_id:999},
    'actions/runs/3':run(3,'.github/workflows/ci-fanmind.yml',-600000,-500000),
    [`commits/${target}`]:{commit:{tree:{sha:git(seed,'rev-parse',target+'^{tree}')}}},
    'actions/runs/3/attempts/1/jobs?per_page=100':{total_count:1,jobs:[{conclusion:'success',steps:[{name:'Prove full monthly release rehearsal with PostgreSQL 17',conclusion:'success'}]}]},
    'actions/runs/4':run(4,'.github/workflows/trigger-function-hardening-production-control.yml',-90000,-60000),
    'actions/runs/4/attempts/1/jobs?per_page=100':{total_count:1,jobs:[{id:44,conclusion:'success',completed_at:iso(-60000)}]},
  };
  const get = async path => { assert.ok(api[path], 'unexpected API: '+path);return api[path]; };
  const manifest = sourcePlan(source,old,target);manifest.evidence=await collectEvidence(target,1,[2],get,999);
  const a = admission(manifest);a.coverage=manifest.changes.map(x=>({path:x.path,kind:'staging',runId:2}));
  const receipt={target:'production',base:old,candidate:target,path:sqlPath,sqlSha256:sha256(sourceSql),action:'verify',result:'PASS',runId:4,jobId:44,runAttempt:1,verifiedAt:iso(-60000)};
  a.sql=[{path:sqlPath,sha256:sha256(sourceSql),decision:'verified_applied',backwardCompatible:true,controller:api['actions/runs/4'].path,postflightSha256:sha256(JSON.stringify(receipt))}];
  const packageHash=hash(a), proof={admission:a,restoreVerified:true,rehearsalVerified:true,sqlReceipts:[receipt],codeSha256:Object.fromEntries(VERIFIER_FILES.map(p=>[p,sha256(readFileSync(join(source,p)))]))};
  assert.equal(validatePrivateProof(proof,source),a);
  assert.throws(()=>validateSqlReceipt({...receipt,sqlSha256:'f'.repeat(64)},a.sql[0],a));
  await assert.rejects(verifySqlProvenance(a,[receipt],get,async()=>iso(-60000)+' TRIGGER_FUNCTION_HARDENING_PRODUCTION_ACTION=apply\n'+iso(-60000)+' TRIGGER_FUNCTION_HARDENING_PRODUCTION_RESULT=applied\n'));
  assert.throws(()=>validatePrivateProof({...proof,restoreVerified:false},source));
  const command=async(file,args)=>{
    if(file.endsWith('read-only-production-audit.sh')) {if(container)assert.equal(query(`SELECT count(*) FROM ${schema}.monthly_release_fixture;`),'1');return {stdout:monthlyAuditFixture(live(),target,healthyBackup)};}
    if(file==='/usr/bin/git')return execAsync(file,args);
    assert.equal(file,'curl');return execAsync('/usr/bin/curl',args.map(x=>x.replace('https://fanmind.ch',origin)));
  };
  const phaseCommand=async(file,args,ms,options={})=>{
    if(file==='bash') options={...options,input:options.input.replaceAll('/var/www/fanmind',source)};
    if(file==='/usr/bin/timeout') {args=[...args];args[2]='10';if(injectSmoke)failSmoke=true;}
    if(process.env.MONTHLY_REHEARSAL_DEBUG)console.error('FIXTURE_PHASE_START',file);
    const debugPath=join(root,'command.log'), fd=openSync(debugPath,'a+',0o600);
    try { const result=await runMonthlyCommand(file,args,injectTimeout&&file==='bash'?1:ms,source,{...options,stdio:['pipe',fd,fd],env:{...env,...options.env}},env);if(process.env.MONTHLY_REHEARSAL_DEBUG)console.error('FIXTURE_PHASE_END',file);return result; }
    catch(e){ if(process.env.MONTHLY_REHEARSAL_DEBUG){const bytes=Buffer.alloc(Math.min(fstatSync(fd).size,131072));const count=readSync(fd,bytes,0,bytes.length,0);console.error(bytes.subarray(0,count).toString('utf8'));}throw e; }
    finally{closeSync(fd);}
  };
  let saved;const save=async value=>{saved=value;put(join(root,'monthly-state.json'),JSON.stringify(value),0o600);};
  const invoke=async previous=>runRelease(a,{...createProductionAdapter({admission:a,proof,packageHash,reviewed:source,root:source,base:old,candidate:target,previous,command,phaseCommand,get,getLog:async()=>iso(-60000)+' TRIGGER_FUNCTION_HARDENING_PRODUCTION_ACTION=verify\n'+iso(-60000)+' TRIGGER_FUNCTION_HARDENING_PRODUCTION_RESULT=verified\n',env:{GITHUB_RUN_ID:'99'}}),packageHash,save},previous);
  healthyBackup=false;const denied=await invoke();assert.equal(denied.state,'STOPPED_BEFORE_DEPLOY');assert.equal(live(),old);
  healthyBackup=true;injectTimeout=true;const timed=await invoke();assert.equal(timed.state,'INSPECTION_REQUIRED');assert.equal(live(),old);
  injectTimeout=false;a.resumeAfterAttempt=timed.attempt;a.issuedAt=timed.updatedAt;injectSmoke=true;
  const failed=await invoke(timed);assert.equal(failed.state,'INSPECTION_REQUIRED');assert.equal(live(),target);assert.equal(saved.attempt,failed.attempt);
  const preserved=JSON.stringify(saved);await invoke(failed);assert.equal(JSON.stringify(saved),preserved,'blind retry must not overwrite recovery journal');
  failSmoke=false;injectSmoke=false;a.resumeAfterAttempt=failed.attempt;a.issuedAt=failed.updatedAt;
  const recovered=await invoke(failed);assert.equal(recovered.state,'COMPLETE',JSON.stringify(recovered));assert.equal(live(),target);
  assert.equal(readFileSync(operationsHeads,'utf8').trim().split('\n').length,1,'resume must not repeat successful build/Operations');
  const processActions = readFileSync(ctx.pm2Actions, 'utf8');
  assert.match(processActions, /^reload$/mu, 'monthly rehearsal must exercise the installed rolling cluster');
  assert.doesNotMatch(processActions, /^delete$/mu, 'monthly rehearsal must not migrate a legacy process');
  if(container){query(`DROP SCHEMA ${schema} CASCADE;`);schemaPresent=false;assert.equal(query(`SELECT count(*) FROM pg_namespace WHERE nspname='${schema}';`),'0');}
  // Offline proposal creation must never delete an existing operator directory.
  const proposal=join(root,'existing-proposal');mkdirSync(proposal);put(join(proposal,'preserve.txt'),'preserved');
  const input=join(root,'proposal-input');mkdirSync(input);
  put(join(input,'source.json'),JSON.stringify(a.source));
  const fakeEvidence={productionCommit:old,databaseAuthorizationFingerprintSha256:'a'.repeat(64)};
  const restoreFiles={};for(const name of ['evidence','full','runner','postcheck']){const file=join(input,name+'.json');put(file,JSON.stringify(name==='evidence'?fakeEvidence:{}),0o600);restoreFiles[name]=file;}
  const rehearsalFile=join(input,'rehearsal.json');put(rehearsalFile,JSON.stringify({result:'PASS',pg17:true,sourceTree:a.source.tree,sourceCommit:target,runId:3,elapsedMs:1}));
  const receiptFile=join(input,'sql.json');put(receiptFile,JSON.stringify(receipt));
  put(join(input,'plan.json'),JSON.stringify({coverage:a.coverage,configuration:a.configuration,restoreFiles,rehearsalFile,sql:[{path:sqlPath,controller:a.sql[0].controller,backwardCompatible:true,receiptFile}]}));
  const generator=new URL('../scripts/operations/monthly-release-admission.mjs',import.meta.url).pathname;
  const rejected=spawnSync(process.execPath,[generator,join(input,'source.json'),join(input,'plan.json'),proposal],{cwd:source,encoding:'utf8'});
  assert.equal(rejected.status,1);assert.equal(readFileSync(join(proposal,'preserve.txt'),'utf8'),'preserved');
  const elapsedMs=Math.ceil(performance.now()-started);assert.ok(elapsedMs<3600000);
  const report={result:'PASS',scope:'INTEGRATED_PRODUCTION_ADAPTER_SYNTHETIC_GATES_REAL_HTTP_GIT_SHELL',elapsedMs,pg17:!!container,sourceCommit:process.env.MONTHLY_REHEARSAL_SOURCE_COMMIT||process.env.GITHUB_SHA||'',runId:process.env.GITHUB_RUN_ID||'',sourceTree:execFileSync('git',['rev-parse','HEAD^{tree}'],{encoding:'utf8'}).trim(),packageHash,gateFailure:true,deadlineAbort:true,postDeployFailure:true,resume:true,cleanup:true};
  if(process.env.FANMIND_MONTHLY_REHEARSAL_REPORT)put(process.env.FANMIND_MONTHLY_REHEARSAL_REPORT,JSON.stringify(report)+'\n',0o600);
  console.log('MONTHLY_REHEARSAL='+JSON.stringify(report));
}).catch(e=>{if(process.env.MONTHLY_REHEARSAL_DEBUG)console.error(e.stack);throw e;}));

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { psqlEnvironment, verifyCapacityIntegration, writeCapacityBlock } from "../scripts/operations/staging-database-rollout-state.mjs";

const root=resolve(import.meta.dirname,"..");
const git=(cwd,args)=>execFileSync("git",["-C",cwd,...args],{encoding:"utf8",stdio:["ignore","pipe","pipe"]}).trim();
const read=path=>readFileSync(path,"utf8");
const hash=path=>createHash("sha256").update(readFileSync(path)).digest("hex");

test("unclassified and forged exceptions expose only UNKNOWN_BLOCK, never exception properties",()=>{
  for (const error of [new Error("secret-exception-canary"),
    Object.assign(new Error("STAGING_DATABASE_ROLLOUT_STATE_ERROR=passfile_invalid"), {
      stage:"SOURCE_CHECK",reason:"secret-reason-canary",fields:["secret-field-canary"],
    }), null, "secret-string-canary"]) {
    const lines=[];writeCapacityBlock(error,line=>lines.push(line));
    assert.deepEqual(lines,["STAGING_DATABASE_ROLLOUT_CAPACITY=BLOCK",
      "STAGING_DATABASE_ROLLOUT_CAPACITY_DIAGNOSTIC=UNKNOWN_BLOCK:UNCLASSIFIED"]);
  }
});

test("Capacity integration is explicitly selected inside the existing protected read-only workflow",()=>{
  const workflow=read(join(root,".github/workflows/staging-database-rollout-state.yml"));
  for (const part of ["environment: staging","scope:","- capacity","inputs.reviewed_commit == github.sha",
    "github.ref == 'refs/heads/main'","inputs.capacity_confirmation", "PGSSLMODE: verify-full",
    "PGPORT: '5432'","FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'",
    "npm run db:staging-rollout-state:run","if: ${{ always() }}", "git fetch --no-tags origin +refs/heads/main:refs/remotes/origin/main"])
    assert.ok(workflow.includes(part),part);
  assert.ok(workflow.indexOf("Validate requested read-only scope") < workflow.indexOf("Prepare dedicated private database password file"));
  assert.ok(workflow.indexOf("Verify every reused control offline") < workflow.indexOf("Prepare dedicated private database password file"));
  assert.doesNotMatch(workflow,/--apply|db:.*:apply|continue-on-error:/u);
  const control=verifyCapacityIntegration(root);
  assert.equal(control.applyMode,"disabled");
});

test("Capacity child environment removes inherited process/libpq overrides and forces read-only limits",()=>{
  const env=psqlEnvironment({PATH:"/usr/bin",PGHOST:"target",PGPORT:"5432",PGUSER:"postgres.target",PGDATABASE:"postgres",
    PGSSLROOTCERT:"/pinned/ca",PGPASSWORD:"private",PGOPTIONS:"-c row_security=on",LD_PRELOAD:"private",NODE_OPTIONS:"private",
    HOME:"/private",PGSERVICE:"redirect",DATABASE_URL:"private",UNRELATED_SECRET:"private"},"/private/snapshot",true);
  for (const key of ["PGPASSWORD","LD_PRELOAD","NODE_OPTIONS","HOME","PGSERVICE","DATABASE_URL","UNRELATED_SECRET"]) assert.equal(env[key],undefined);
  assert.equal(env.PGSSLMODE,"verify-full"); assert.equal(env.PGCONNECT_TIMEOUT,"10");
  assert.match(env.PGOPTIONS,/default_transaction_read_only=on/u);
  assert.match(env.PGOPTIONS,/statement_timeout=10000/u);
});

test("Capacity CLI uses committed source and the shared private transport; faults fail closed",async t=>{
  const scratch=mkdtempSync(join(tmpdir(),"capacity-integration-test-"));
  const repo=join(scratch,"repo"), bin=join(scratch,"bin"), passfile=join(scratch,"pgpass"), capture=join(scratch,"capture.json"), versionCapture=join(scratch,"version.json");
  execFileSync("mkdir",[bin]);
  execFileSync("git",["clone","--shared","--no-checkout","--quiet",root,repo],{stdio:"pipe"});
  git(repo,["checkout","--quiet","--detach",git(root,["rev-parse","HEAD"])]);
  // New root commit proves that source binding does not require e9 ancestry.
  git(repo,["checkout","--quiet","--orphan","capacity-squash-source"]);
  git(repo,["-c","user.name=Capacity isolated test","-c","user.email=capacity-ci@example.invalid","commit","--quiet","-m","isolated squash source"]);
  const head=git(repo,["rev-parse","HEAD"]);
  git(repo,["update-ref","refs/heads/main",head]); git(repo,["remote","set-url","origin",repo]);
  const prepared=JSON.parse(read(join(repo,"docs/operations/ai-capacity-staging-preparation.json")));
  const observation={...prepared.expectedObservation,policy:prepared.expectedPolicy,
    requested_main_commit:head,requested_target_project:prepared.targetProject,
    reviewed_lifecycle_commit:prepared.reviewedLifecycleHead,recovery_sha256:prepared.sha256[prepared.recoveryPath]};
  const env={PATH:`${bin}:${process.env.PATH}`,LANG:"C.UTF-8",GITHUB_REF:"refs/heads/main",GITHUB_SHA:head,
    FANMIND_STAGING_DATABASE_ROLLOUT_REVIEWED_COMMIT:head,
    FANMIND_STAGING_DATABASE_ROLLOUT_STATE_CONFIRM:"verify-staging-database-rollout-state",
    FANMIND_STAGING_DATABASE_ROLLOUT_SCOPE:"capacity",FANMIND_CAPACITY_PREFLIGHT_CONFIRM:"prepare-readonly-capacity-preflight",
    FANMIND_RUNTIME_ENVIRONMENT:"staging",FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false",FANMIND_NON_PRODUCTION_WRITE_ACK:"",
    FANMIND_TARGET_SUPABASE_PROJECT_REF:prepared.targetProject,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:prepared.productionProject,
    NEXT_PUBLIC_SUPABASE_URL:`https://${prepared.targetProject}.supabase.co`,NEXT_PUBLIC_APP_URL:"https://staging.example.test",
    FANMIND_TARGET_API_ORIGIN:"https://staging.example.test",FANMIND_PRODUCTION_API_ORIGIN:"https://fanmind.ch",
    PGHOST:"aws-0-eu-central-1.pooler.supabase.com",FANMIND_TARGET_DB_HOST:"aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST:`db.${prepared.productionProject}.supabase.co`,PGPORT:"5432",PGDATABASE:"postgres",
    PGUSER:`postgres.${prepared.targetProject}`,PGSSLROOTCERT:join(repo,"config/certificates/supabase-root-2021-ca.crt"),
    PGSSLMODE:"verify-full",PGPASSFILE:passfile,PGPASSWORD:"must-not-inherit"};
  const entry=`${env.PGHOST}:5432:postgres:${env.PGUSER}:synthetic-password\n`;
  function fake(mode="match",value=observation) {
    rmSync(capture,{force:true});
    rmSync(versionCapture,{force:true});
    const body=`#!${process.execPath}\nconst fs=require('node:fs');
if(process.argv.includes('--version')){fs.writeFileSync(${JSON.stringify(versionCapture)},JSON.stringify(Object.keys(process.env)));process.stdout.write('psql 17.11');process.exit(${mode==="version-error"?1:0});}
const sql=fs.readFileSync(0,'utf8');
fs.writeFileSync(${JSON.stringify(capture)},JSON.stringify({sql,args:process.argv.slice(2),passfile:process.env.PGPASSFILE,environment:Object.keys(process.env),options:process.env.PGOPTIONS}));
if(${JSON.stringify(mode)}==='hang'){setInterval(()=>{},1000);}
else if(${JSON.stringify(mode)}==='oversize'){process.stdout.write('x'.repeat(100000));}
else if(${JSON.stringify(mode)}==='error'){process.stderr.write('private-diagnostic-and-password');process.exitCode=1;}
else if(${JSON.stringify(mode)}==='connection'){process.stdout.write('secret-stdout-canary');process.stderr.write('secret-stderr-canary TLS password auth detail');process.exitCode=2;}
else if(${JSON.stringify(mode)}==='sql-error'){process.stdout.write('secret-stdout-canary');process.stderr.write('ERROR: secret-SQLSTATE-and-customer-canary');process.exitCode=3;}
else {process.stderr.write('secret-stderr-canary');process.stdout.write(${JSON.stringify(mode==="raw"?value:JSON.stringify(value))});}
`;
    writeFileSync(join(bin,"psql"),body,{mode:0o700}); chmodSync(join(bin,"psql"),0o700);
  }
  function run(change={},timeout=false) {
    const args=timeout ? ["--input-type=module","-e",`import {inspectCapacityDatabase,writeCapacityBlock} from './scripts/operations/staging-database-rollout-state.mjs'; try {const s=inspectCapacityDatabase(process.env,process.cwd(),{timeoutMs:100}); console.log('STAGING_DATABASE_ROLLOUT_CAPACITY='+s);process.exitCode=s==='READONLY_BASELINE_MATCH'?0:1;}catch(error){writeCapacityBlock(error);process.exitCode=1;}`]
      : ["scripts/operations/staging-database-rollout-state.mjs","--run"];
    return spawnSync(process.execPath,args,{cwd:repo,env:{...env,...change},encoding:"utf8",timeout:10000,maxBuffer:200000});
  }
  function blocked(r,queryExpected=false,diagnostic="ENVIRONMENT_MAIN:ENVIRONMENT_REJECTED",fields=[]) {
    const expected=["STAGING_DATABASE_ROLLOUT_CAPACITY=BLOCK",`STAGING_DATABASE_ROLLOUT_CAPACITY_DIAGNOSTIC=${diagnostic}`];
    if(fields.length)expected.push(`STAGING_DATABASE_ROLLOUT_CAPACITY_FIELDS=${fields.join(",")}`);
    assert.equal(r.status,1,r.stderr); assert.deepEqual(r.stdout.trim().split("\n"),expected);
    assert.equal(r.stderr,""); assert.equal(existsSync(capture),queryExpected);
    if(queryExpected)assert.equal(existsSync(JSON.parse(read(capture)).passfile),false,"private snapshot must be removed");
  }
  writeFileSync(passfile,entry,{mode:0o600}); chmodSync(passfile,0o600);
  try {
    await t.test("squashed root source matches with one enum, readonly stdin and finally-cleaned snapshot",()=>{
      fake(); const r=run(); assert.equal(r.status,0,r.stderr); assert.equal(r.stdout.trim(),"STAGING_DATABASE_ROLLOUT_CAPACITY=READONLY_BASELINE_MATCH"); assert.equal(r.stderr,"");
      const c=JSON.parse(read(capture)); assert.notEqual(c.passfile,passfile); assert.equal(existsSync(c.passfile),false);
      assert.ok(c.args.includes("--no-psqlrc")); assert.ok(c.args.includes("--set=ON_ERROR_STOP=1"));
      assert.match(c.sql,/repeatable read read only/u); assert.match(c.sql,/row_security = off/u); assert.match(c.sql,/rollback;/u);
      assert.ok(!c.environment.includes("PGPASSWORD"));assert.match(c.options,/default_transaction_read_only=on/u);
      const versionKeys=JSON.parse(read(versionCapture));
      for(const key of ["PGPASSWORD","HOME","LD_PRELOAD","NODE_OPTIONS","GITHUB_TOKEN"])
        assert.ok(!versionKeys.includes(key),`version probe inherited ${key}`);
    });
    for(const [name,change] of Object.entries({
      production:{FANMIND_TARGET_SUPABASE_PROJECT_REF:prepared.productionProject},
      wrongUser:{PGUSER:`postgres.${prepared.productionProject}`},wrongSha:{GITHUB_SHA:"b".repeat(40)},
      missingConfirmation:{FANMIND_CAPACITY_PREFLIGHT_CONFIRM:""},wrongScope:{FANMIND_STAGING_DATABASE_ROLLOUT_SCOPE:"unknown"},
      weakTls:{PGSSLMODE:"require"},otherCa:{PGSSLROOTCERT:"/some/other/ca"},
      redirect:{PGHOSTADDR:"127.0.0.1"},writes:{FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true"},
    }))await t.test(`blocks ${name} before query`,()=>{fake();blocked(run(change),false,
      name==="otherCa"?"ENVIRONMENT_MAIN:CA_BINDING_REJECTED":
        ["wrongSha","missingConfirmation"].includes(name)?"ENVIRONMENT_MAIN:MAIN_OR_CHECKOUT_REJECTED":"ENVIRONMENT_MAIN:ENVIRONMENT_REJECTED");});
    await t.test("fetch detects live-main advance, not stale origin/main",()=>{
      fake();const advanced=git(repo,["-c","user.name=CI","-c","user.email=ci@example.invalid","commit-tree",git(repo,["rev-parse","HEAD^{tree}"]),"-p",head,"-m","advanced main"]);
      git(repo,["update-ref","refs/heads/main",advanced]);try{blocked(run(),false,"ENVIRONMENT_MAIN:MAIN_OR_CHECKOUT_REJECTED");}finally{git(repo,["update-ref","refs/heads/main",head]);}
    });
    await t.test("query checksum drift blocks before credentials/query",()=>{
      fake();const path=join(repo,prepared.sqlPath),before=read(path);writeFileSync(path,before+"\n-- drift\n");
      try{blocked(run(),false,"SOURCE_CHECK:SOURCE_REJECTED");}finally{writeFileSync(path,before);}
    });
    await t.test("joint dirty query and manifest edits cannot impersonate committed source",()=>{
      fake();const queryPath=join(repo,prepared.sqlPath),controlPath=join(repo,"docs/operations/ai-capacity-staging-preparation.json"),integrationPath=join(repo,"docs/operations/ai-capacity-staging-integration.json");
      const saved=[queryPath,controlPath,integrationPath].map(p=>[p,read(p)]);
      writeFileSync(queryPath,read(queryPath)+"\n-- joint drift\n");
      const c=JSON.parse(read(controlPath));c.sha256[prepared.sqlPath]=hash(queryPath);writeFileSync(controlPath,JSON.stringify(c,null,2)+"\n");
      const i=JSON.parse(read(integrationPath));for(const p of [prepared.sqlPath,"docs/operations/ai-capacity-staging-preparation.json"])i.sha256[p]=hash(join(repo,p));writeFileSync(integrationPath,JSON.stringify(i,null,2)+"\n");
      try{blocked(run(),false,"SOURCE_CHECK:SOURCE_REJECTED");}finally{for(const [p,s] of saved)writeFileSync(p,s);}
    });
    for(const [name,mode,value] of [
      ["empty","raw",""],["malformed","raw","not-json"],["multiline","raw",JSON.stringify(observation)+"\n"+JSON.stringify(observation)],
      ["wrong-main-label","match",{...observation,requested_main_commit:"b".repeat(40)}],
      ["wrong-target-label","match",{...observation,requested_target_project:prepared.productionProject}],
      ["wrong-recovery-label","match",{...observation,recovery_sha256:"0".repeat(64)}],
      ["extra-fields","match",{...observation,extra:true}],["schema-drift","match",{...observation,schema_md5:"0".repeat(32)}],
      ["error","error",null],["oversize","oversize",null],
      ["connection","connection",null],["sql-error","sql-error",null],
      ["null","raw","null"],["secret-value","match",{...observation,policy:{...observation.policy,revision:"secret-policy-canary"}}],
    ])await t.test(`blocks ${name} output and removes snapshot`,()=>{
      const expected={empty:"RESPONSE_PARSING:RESPONSE_CARDINALITY",multiline:"RESPONSE_PARSING:RESPONSE_CARDINALITY",
        malformed:"RESPONSE_PARSING:INVALID_JSON","extra-fields":"RESPONSE_PARSING:RESPONSE_SHAPE",null:"RESPONSE_PARSING:RESPONSE_SHAPE",
        "schema-drift":"BASELINE_COMPARISON:BASELINE_MISMATCH","secret-value":"BASELINE_COMPARISON:BASELINE_MISMATCH",
        error:"UNKNOWN_BLOCK:UNCLASSIFIED",oversize:"QUERY_EXECUTION:OUTPUT_LIMIT",connection:"CONNECTION_TLS:CONNECTION_FAILED",
        "sql-error":"QUERY_EXECUTION:SQL_SCRIPT_FAILED"}[name]??"RESPONSE_BINDING:LABEL_MISMATCH";
      const fields=name==="schema-drift"?["schema_md5"]:name==="secret-value"?["policy_revision"]:[];
      fake(mode,value);blocked(run(),true,expected,fields);
    });
    await t.test("unclassified manifest exception with secret canary stays unknown before credentials",()=>{
      fake();const path=join(repo,"docs/operations/ai-capacity-staging-integration.json"),before=read(path);
      writeFileSync(path,"secret-exception-canary-invalid-json");
      try{blocked(run(),false,"UNKNOWN_BLOCK:UNCLASSIFIED");}finally{writeFileSync(path,before);}
    });
    await t.test("failed client version probe is bounded and never exposes child output",()=>{
      fake("version-error");blocked(run(),false,"CLIENT_PASSFILE:CLIENT_UNAVAILABLE");
    });
    await t.test("failed live-main fetch has its own verified checkpoint",()=>{
      fake();git(repo,["remote","set-url","origin",join(scratch,"absent-local-origin")]);
      try{blocked(run(),false,"ENVIRONMENT_MAIN:MAIN_FETCH_FAILED");}finally{git(repo,["remote","set-url","origin",repo]);}
    });
    await t.test("whole-process timeout kills client and still removes private snapshot",()=>{fake("hang");blocked(run({},true),true,"QUERY_EXECUTION:CLIENT_DEADLINE");});
    for(const [name,entryValue,mode] of [
      ["wildcard","*:5432:postgres:*:password\n",0o600],["multiple entries",entry+entry,0o600],
      ["wrong target",entry.replace(env.PGHOST,"wrong.pooler.supabase.com"),0o600],["public mode",entry,0o644],
    ])await t.test(`blocks passfile ${name}`,()=>{
      fake();writeFileSync(passfile,entryValue);chmodSync(passfile,mode);try{blocked(run(),false,"CLIENT_PASSFILE:PASSFILE_REJECTED");}finally{writeFileSync(passfile,entry);chmodSync(passfile,0o600);}
    });
  }finally{rmSync(scratch,{recursive:true,force:true});}
});

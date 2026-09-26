import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readlinkSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validateRecoveryEnvironment, projectLiveReleaseState, publishMissingReleaseState,
  inspectProcess, recoverLiveReleaseState, verifyRecoveryVersion, validateServiceProperties,
} from "../scripts/operations/staging-release-state-recovery.mjs";

const env={GITHUB_REF:"refs/heads/main",GITHUB_SHA:"b".repeat(40),
  FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM:"recover-live-staging-release-state",
  FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT:"a".repeat(40),
  FANMIND_TARGET_SUPABASE_PROJECT_REF:"s".repeat(20),FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:"p".repeat(20),BILLING_WRITE_FREEZE:"preserve"};
const binding=()=>validateRecoveryEnvironment(env);
const entries={FANMIND_RELEASE_COMMIT:"a".repeat(40),FANMIND_RUNTIME_ENVIRONMENT:"staging",NODE_ENV:"production",
  FANMIND_STRIPE_BILLING_WRITE_FREEZE:"false",FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED:"true",
  FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED:"20260816210000",FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED:"false",
  FANMIND_STAGING_BILLING_CAPTURE_ACTIVATION:`${"c".repeat(40)}:123456:1`,FANMIND_STAGING_BILLING_CAPTURE_RECEIPT:`${"c".repeat(40)}:123456`,
  NEXT_PUBLIC_APP_URL:"https://staging.fanmind.ch",NEXT_PUBLIC_SUPABASE_URL:`https://${"s".repeat(20)}.supabase.co`,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:"p".repeat(20),PORT:"3001"};
const raw=(changes={})=>Buffer.from(Object.entries({...entries,...changes}).filter(([,value])=>value!==undefined).map(([key,value])=>`${key}=${value}\0`).join("")+"STRIPE_SECRET_KEY=must-never-be-persisted\0");

test("recovery requires explicit protected preserve authorization and distinct exact target refs",()=>{
  assert.doesNotThrow(binding);
  for(const change of [{GITHUB_REF:"refs/heads/topic"},{GITHUB_SHA:"bad"},{FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM:""},{FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT:""},{BILLING_WRITE_FREEZE:"true"},{BILLING_WRITE_FREEZE:"false"},{FANMIND_TARGET_SUPABASE_PROJECT_REF:env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF}]) assert.throws(()=>validateRecoveryEnvironment({...env,...change}));
});

test("live metadata projection preserves only nine exact fields and wipes the complete input buffer",()=>{
  const bytes=raw();const result=projectLiveReleaseState(bytes,binding());
  assert.equal(result.trim().split("\n").length,9);assert.ok(bytes.every(byte=>byte===0));
  assert.match(result,/FANMIND_STRIPE_BILLING_WRITE_FREEZE=false/u);
  assert.doesNotMatch(result,/STRIPE_SECRET_KEY|must-never|NEXT_PUBLIC|PORT=/u);
  assert.equal(projectLiveReleaseState(raw({FANMIND_STRIPE_BILLING_WRITE_FREEZE:"true"}),binding()).trim().split("\n").length,9);
  for(const change of [{PORT:"3000"},{NEXT_PUBLIC_APP_URL:"https://fanmind.ch"},{FANMIND_RELEASE_COMMIT:"d".repeat(40)},{FANMIND_RUNTIME_ENVIRONMENT:"production"},{FANMIND_STRIPE_BILLING_WRITE_FREEZE:undefined},{FANMIND_STAGING_BILLING_CAPTURE_RECEIPT:undefined},{FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED:undefined},{FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED:"true"},{FANMIND_STAGING_BILLING_CAPTURE_EXTRA:"unknown"},
    {FANMIND_STRIPE_BILLING_WRITE_FREEZE:"true",FANMIND_STAGING_BILLING_CAPTURE_RECEIPT:undefined},
    {FANMIND_STRIPE_BILLING_WRITE_FREEZE:"true",FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED:undefined,FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED:undefined,FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED:undefined,FANMIND_STAGING_BILLING_CAPTURE_ACTIVATION:undefined,FANMIND_STAGING_BILLING_CAPTURE_RECEIPT:undefined},
  ]) {
    const rejected=raw(change);assert.throws(()=>projectLiveReleaseState(rejected,binding()));assert.ok(rejected.every(byte=>byte===0));
  }
  const duplicate=Buffer.concat([raw(),Buffer.from("FANMIND_STRIPE_BILLING_WRITE_FREEZE=false\0")]);
  assert.throws(()=>projectLiveReleaseState(duplicate,binding()));assert.ok(duplicate.every(byte=>byte===0));
});

test("missing file publication is private and cannot overwrite an existing file or symlink",()=>{
  const directory=mkdtempSync(join(tmpdir(),"fanmind-release-recovery-test-"));
  try {
    const content=projectLiveReleaseState(raw(),binding());
    publishMissingReleaseState(directory,content);
    const path=join(directory,".release.env");assert.equal(readFileSync(path,"utf8"),content);assert.equal(statSync(path).mode&0o777,0o600);assert.equal(statSync(path).nlink,1);
    assert.throws(()=>publishMissingReleaseState(directory,"replacement"));assert.equal(readFileSync(path,"utf8"),content);
    rmSync(path);writeFileSync(join(directory,"sentinel"),"unchanged");symlinkSync(join(directory,"sentinel"),path);
    assert.throws(()=>publishMissingReleaseState(directory,"replacement"));assert.equal(readFileSync(join(directory,"sentinel"),"utf8"),"unchanged");
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test("live process seam binds the actual PID, UID, cwd, cgroup and start time",()=>{
    // Some execution workspaces virtualize process.pid while exposing host procfs.
    const pid=readlinkSync("/proc/self");
    const group=readFileSync(`/proc/${pid}/cgroup`,"utf8").trim().split("\n").find(line=>line.startsWith("0::")).slice(3);
    const current=inspectProcess(pid,{uid:process.getuid(),directory:process.cwd(),controlGroup:group});
    assert.match(current.startTime,/^[1-9]\d*$/u);
    assert.throws(()=>inspectProcess(pid,{uid:process.getuid(),directory:process.cwd(),controlGroup:"/wrong-service"}));
    assert.throws(()=>inspectProcess(pid,{uid:process.getuid()+1,directory:process.cwd(),controlGroup:group}));
});

test("loaded service identity rejects drop-ins, stale daemon state and foreign service ownership",()=>{
  const service={Id:"fanmind-staging.service",LoadState:"loaded",ActiveState:"active",SubState:"running",User:"fanmind-staging",Group:"fanmind-staging",WorkingDirectory:"/var/www/fanmind-staging",MainPID:"123",InvocationID:"d".repeat(32),ControlGroup:"/system.slice/fanmind-staging.service",FragmentPath:"/etc/systemd/system/fanmind-staging.service",DropInPaths:"",NeedDaemonReload:"no"};
  assert.doesNotThrow(()=>validateServiceProperties(service));
  for(const change of [{DropInPaths:"/tmp/override.conf"},{NeedDaemonReload:"yes"},{ControlGroup:"/system.slice/fanmind.service"},{MainPID:"0"},{User:"root"},{ActiveState:"failed"},{InvocationID:"0".repeat(32)}])assert.throws(()=>validateServiceProperties({...service,...change}));
});

test("public version requests stay read-only, forbid redirects and require the old live SHA",async()=>{
  const payload={application:"fanmind",runtimeEnvironment:"staging",releaseCommit:env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT};
  await verifyRecoveryVersion(binding(),async(url,options)=>{assert.equal(url,"https://staging.fanmind.ch/api/version");assert.equal(options.redirect,"error");assert.equal(options.method,undefined);return new Response(JSON.stringify(payload),{headers:{"Cache-Control":"no-store"}});});
  for(const change of [{releaseCommit:env.GITHUB_SHA},{runtimeEnvironment:"production"}])await assert.rejects(verifyRecoveryVersion(binding(),async()=>new Response(JSON.stringify({...payload,...change}),{headers:{"Cache-Control":"no-store"}})));
});

test("changed PID or public version failure prevents publication after the process read",async()=>{
  const service={MainPID:"123",InvocationID:"d".repeat(32),ControlGroup:"/system.slice/fanmind-staging.service"};
  for(const failure of ["pid","start","version",""]) {
    let serviceReads=0,processReads=0,versionReads=0,published=0;const bytes=raw();
    const operations={assertMissing(){},verifyCheckout(){},inspectService(){serviceReads++;return {...service,MainPID:failure==="pid"&&serviceReads>1?"456":"123"};},inspectProcess(){processReads++;return {startTime:failure==="start"&&processReads>1?"2":"1"};},readEnvironment(){return bytes;},async verifyVersion(){versionReads++;if(failure==="version"&&versionReads===2)throw Error("fixed-version-failure");},publish(){published++;}};
    if(failure)await assert.rejects(recoverLiveReleaseState(binding(),operations));else await recoverLiveReleaseState(binding(),operations);
    assert.equal(published,failure?0:1);assert.ok(bytes.every(byte=>byte===0));
  }
});

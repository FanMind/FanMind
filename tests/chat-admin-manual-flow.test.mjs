import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validateManualFlowEnvironment, verifyManualFlowRelease,
  buildManualFlowSql, runWithGuaranteedCleanup,
  completeManualFlowCleanup,
  reserveManualFlowReceipt, authorizeReservedManualFlow,
  runManualBrowser, runManualFlowProbe,
} from "../scripts/operations/chat-admin-manual-flow-staging.mjs";
import { initializeBrowserDiagnostic, readBrowserDiagnostic, updateBrowserDiagnostic, requireSuccessfulProbe, formatBrowserDiagnostic } from "../e2e-chatadmin-staging/browser-diagnostic.mjs";
import { canonicalChatAdminFixtureId } from "../e2e-chatadmin-staging/fixture-identity.mjs";
import { installChatAdminNetworkBoundary, chatAdminRequestAllowed } from "../e2e-chatadmin-staging/network-boundary.mjs";

const ids = Array.from({length:10}, (_, index) => `${String(index+1).repeat(8)}-1111-4111-8111-${String(index+1).repeat(12)}`);
const keys = ["STAGING_WORKSPACE_ID","SECOND_WORKSPACE_ID","OWNER_ID","MEMBER_ID","FOREIGN_OWNER_ID","PLATFORM_ADMIN_ID","CHARACTER_A_ID","CHARACTER_B_ID","CONVERSATION_A_ID","CONVERSATION_B_ID"];
const env = {
  GITHUB_REF:"refs/heads/main", GITHUB_SHA:"a".repeat(40),
  FANMIND_CHAT_ADMIN_REVIEWED_COMMIT:"a".repeat(40),
  FANMIND_RUNTIME_ENVIRONMENT:"staging", NEXT_PUBLIC_APP_URL:"https://staging.fanmind.ch",
  FANMIND_TARGET_API_ORIGIN:"https://staging.fanmind.ch", FANMIND_PRODUCTION_API_ORIGIN:"https://fanmind.ch",
  NEXT_PUBLIC_SUPABASE_URL:"https://stagingref123.supabase.co",
  FANMIND_TARGET_SUPABASE_PROJECT_REF:"stagingref123", FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:"productionref123",
  PGHOST:"aws-0-eu.pooler.supabase.com", FANMIND_TARGET_DB_HOST:"aws-0-eu.pooler.supabase.com",
  FANMIND_PRODUCTION_DB_HOST:"db.productionref123.supabase.co", PGUSER:"postgres.stagingref123",
  PGPORT:"5432", PGDATABASE:"postgres", PGSSLMODE:"verify-full",
  PGSSLROOTCERT:"/repo/config/certificates/supabase-root-2021-ca.crt",
  FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true", FANMIND_NON_PRODUCTION_WRITE_ACK:"I_UNDERSTAND_NON_PRODUCTION_ONLY",
  FANMIND_CHAT_ADMIN_MANUAL_CONFIRM:"run-chat-admin-manual-flow",
  FANMIND_STAGING_E2E_EMAIL:"primary-staging@example.invalid", FANMIND_STAGING_E2E_PASSWORD:"synthetic-pass-primary",
  FANMIND_STAGING_E2E_SECONDARY_EMAIL:"secondary-staging@example.invalid", FANMIND_STAGING_E2E_SECONDARY_PASSWORD:"synthetic-pass-secondary",
  FANMIND_ADMIN_EMAILS:"admin-staging@example.invalid", FANMIND_STAGING_ADMIN_E2E_EMAIL:"admin-staging@example.invalid", FANMIND_STAGING_ADMIN_E2E_PASSWORD:"synthetic-pass-admin",
  ...Object.fromEntries(keys.map((key,index)=>[`FANMIND_CHAT_ADMIN_${key}`,ids[index]])),
};
// The tenth test UUID uses a hexadecimal digit too.
env.FANMIND_CHAT_ADMIN_CONVERSATION_B_ID="aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

test("actual Playwright CLI collects the protected probe and imports its ESM diagnostics without contacting a target",()=>{
  const root=fileURLToPath(new URL("../",import.meta.url));
  const cli=fileURLToPath(new URL("../node_modules/@playwright/test/cli.js",import.meta.url));
  const result=spawnSync(process.execPath,[cli,"test","--config=playwright.chatadmin-staging.config.mts","--list"],{
    cwd:root,env:{...env,PATH:process.env.PATH,HOME:process.env.HOME,CI:"1",FANMIND_CHAT_ADMIN_BROWSER_MODE:"probe"},encoding:"utf8",timeout:30_000,maxBuffer:128*1024,
  });
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/manual-flow\.spec\.mts/u);
  assert.match(result.stdout,/Total: 1 test in 1 file/u);
});

test("browser and SQL share strict fixture UUID normalization for the observed trailing carriage return",()=>{
  const rawOwner=`${env.FANMIND_CHAT_ADMIN_OWNER_ID}\r`;
  const validated=validateManualFlowEnvironment({...env,FANMIND_CHAT_ADMIN_OWNER_ID:rawOwner});
  assert.equal(canonicalChatAdminFixtureId(rawOwner),validated.OWNER_ID);
  assert.equal(canonicalChatAdminFixtureId("ABCDEFAB-1111-4111-8111-ABCDEFABCDEF\r"),"abcdefab-1111-4111-8111-abcdefabcdef");
  for(const invalid of [undefined,"",`${rawOwner}x`,"not-a-uuid","abcdefab-1111-0111-8111-abcdefabcdef"])assert.throws(()=>canonicalChatAdminFixtureId(invalid),/fixture_identity/u);
  assert.throws(()=>validateManualFlowEnvironment({...env,FANMIND_CHAT_ADMIN_OWNER_ID:`${env.FANMIND_CHAT_ADMIN_FOREIGN_OWNER_ID}\r`}),/fixture_identity/u);
});

test("browser diagnostics reject private payloads and the parent never forwards raw Playwright output",()=>{
  const directory=mkdtempSync(join(tmpdir(),"chatadmin-diagnostic-test-"));
  const current={...env,RUNNER_TEMP:directory,GITHUB_RUN_ID:"12345",GITHUB_RUN_ATTEMPT:"1"};
  try {
    initializeBrowserDiagnostic(current,"probe");
    assert.throws(()=>requireSuccessfulProbe(current));
    for(const patch of [{stage:"private-password"},{url:"https://private.invalid"},{status:"private-token"},{sessionCleanup:"private-response"}])assert.throws(()=>updateBrowserDiagnostic(current,"probe",patch));
    updateBrowserDiagnostic(current,"probe",{stage:"admin_token",status:"4xx"});
    assert.deepEqual(formatBrowserDiagnostic(current,"probe"),["CHAT_ADMIN_MANUAL_MODE=probe","CHAT_ADMIN_MANUAL_STAGE=admin_token","CHAT_ADMIN_MANUAL_OUTCOME=running","CHAT_ADMIN_MANUAL_HTTP=4xx","CHAT_ADMIN_MANUAL_NETWORK=none","CHAT_ADMIN_MANUAL_SESSION_CLEANUP=not_started"]);
    updateBrowserDiagnostic(current,"probe",{stage:"complete",outcome:"passed",sessionCleanup:"passed"});
    assert.doesNotThrow(()=>requireSuccessfulProbe(current));
    for(const changed of [{GITHUB_RUN_ATTEMPT:"2"},{GITHUB_RUN_ID:"99"},{GITHUB_SHA:"b".repeat(40)},{FANMIND_TARGET_SUPABASE_PROJECT_REF:"otherstagingref"}])assert.throws(()=>requireSuccessfulProbe({...current,...changed}));
    const probePath=join(directory,"fanmind-chat-admin-probe-diagnostic.json"),saved=readFileSync(probePath,"utf8");
    writeFileSync(probePath,JSON.stringify({...JSON.parse(saved),source:"d".repeat(64)}));assert.throws(()=>requireSuccessfulProbe(current));
    writeFileSync(probePath,JSON.stringify({...JSON.parse(saved),response:"private-token"}));assert.throws(()=>formatBrowserDiagnostic(current,"probe"));writeFileSync(probePath,saved);
    const output=[];
    assert.throws(()=>runManualBrowser(current,"acceptance",()=>{
      updateBrowserDiagnostic(current,"acceptance",{stage:"owner_token",status:"4xx",outcome:"failed",sessionCleanup:"passed"});
      return {status:1,stdout:"CHAT_ADMIN_MANUAL_BROWSER=PASS\nprivate-token private-response",stderr:"private-password",error:undefined};
    },line=>output.push(line)),/browser/u);
    assert.ok(output.includes("CHAT_ADMIN_MANUAL_STAGE=owner_token"));
    assert.doesNotMatch(output.join("\n"),/private-token|private-response|private-password/u);
    assert.equal(readBrowserDiagnostic(current,"acceptance").outcome,"failed");
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test("probe network policy blocks fixture and provider writes before route transport",async()=>{
  const targets={appOrigin:"https://staging.fanmind.ch",supabaseOrigin:"https://synthetic.supabase.co",mode:"probe"};
  let handler,transport=0,aborted=0;const reasons=[];
  await installChatAdminNetworkBoundary({route:async(_pattern,callback)=>{handler=callback;}},{...targets,onViolation:reason=>reasons.push(reason)});
  for(const [path,method] of [["/api/chatadmin/reply-suggestions","POST"],["/api/chatadmin/characters","PATCH"],["/api/chatadmin/characters","POST"]]) {
    const url=new URL(path,targets.appOrigin);assert.equal(chatAdminRequestAllowed(url,method,targets),false);
    await handler({request:()=>({url:()=>url.href,method:()=>method}),abort:async()=>{aborted++;},fetch:async()=>{transport++;}});
  }
  assert.equal(transport,0);assert.equal(aborted,3);assert.deepEqual(reasons,["write","write","write"]);
  assert.equal(chatAdminRequestAllowed(new URL("/auth/v1/logout",targets.supabaseOrigin),"POST",targets),true);
  assert.equal(chatAdminRequestAllowed(new URL("/api/auth/session",targets.appOrigin),"POST",targets),true);
});

test("teardown never hides writes that acceptance mode would normally allow",async()=>{
  const targets={appOrigin:"https://staging.fanmind.ch",supabaseOrigin:"https://synthetic.supabase.co",mode:"acceptance"};
  let handler,fetches=0,aborts=0;const reasons=[];
  const boundary=await installChatAdminNetworkBoundary({route:async(_pattern,callback)=>{handler=callback;}},{...targets,onViolation:reason=>reasons.push(reason)});
  await boundary.stop();
  for(const [path,method] of [["/api/chatadmin/reply-suggestions","POST"],["/api/chatadmin/characters","PATCH"]])await handler({
    request:()=>({url:()=>`${targets.appOrigin}${path}`,method:()=>method}),
    fetch:async()=>{fetches++;},abort:async()=>{aborts++;},
  });
  assert.equal(fetches,0,"teardown must never forward a write");
  assert.equal(aborts,2);
  assert.equal(boundary(),2,"acceptance-authorized writes remain violations once teardown starts");
  assert.deepEqual(reasons,["write","write"]);
});

test("probe dispatch calls only release verification and the browser probe without preparing fixtures",async()=>{
  const observed=[];
  await runManualFlowProbe(env,{verifyRelease:async()=>observed.push("version"),runBrowser:(_env,mode)=>observed.push(mode)});
  assert.deepEqual(observed,["version","probe"]);
  const workflow=readFileSync(new URL("../.github/workflows/chat-admin-manual-flow-staging.yml",import.meta.url),"utf8");
  assert.match(workflow,/default: probe/u);
  assert.ok(workflow.indexOf(" --probe")<workflow.indexOf("id: passfile"));
  assert.match(workflow,/inputs.mode == 'acceptance'/u);
});

test("manual flow accepts only its exact protected Staging request", () => {
  assert.doesNotThrow(()=>validateManualFlowEnvironment(env));
  for (const change of [
    {GITHUB_REF:"refs/heads/feature"}, {GITHUB_SHA:"b".repeat(40)},
    {FANMIND_RUNTIME_ENVIRONMENT:"production"}, {NEXT_PUBLIC_APP_URL:"https://fanmind.ch"},
    {FANMIND_TARGET_SUPABASE_PROJECT_REF:"productionref123"},
    {FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false"}, {FANMIND_NON_PRODUCTION_WRITE_ACK:""},
    {FANMIND_CHAT_ADMIN_MANUAL_CONFIRM:"run-chat-admin-acceptance"},
    {FANMIND_CHAT_ADMIN_CHARACTER_B_ID:ids[6]}, {PGSSLMODE:"require"}, {PGPASSWORD:"secret"},
    {FANMIND_ADMIN_EMAILS:"stale-admin@example.invalid"}, {FANMIND_STAGING_ADMIN_E2E_EMAIL:env.FANMIND_STAGING_E2E_EMAIL},
    {FANMIND_STAGING_ADMIN_E2E_PASSWORD:""},
  ]) assert.throws(()=>validateManualFlowEnvironment({...env,...change}));
});

test("existing admin login accepts a shorter configured password while synthetic owner passwords retain their contract", () => {
  const existingAdmin={...env,FANMIND_STAGING_ADMIN_E2E_PASSWORD:"existing-pass"};
  assert.doesNotThrow(()=>validateManualFlowEnvironment(existingAdmin));
  for(const [key,code,invalid] of [
    ["FANMIND_STAGING_E2E_PASSWORD","fixture_primary_credential",[undefined,"", "short", "valid-length-password\n"]],
    ["FANMIND_STAGING_E2E_SECONDARY_PASSWORD","fixture_secondary_credential",[undefined,"", "short", "valid-length-password\r"]],
    ["FANMIND_STAGING_ADMIN_E2E_PASSWORD","fixture_admin_credential",[undefined,"", "existing\npass", "existing\rpass"]],
  ]) for(const password of invalid) assert.throws(()=>validateManualFlowEnvironment({...existingAdmin,[key]:password}),{message:`CHAT_ADMIN_MANUAL_FLOW_ERROR=${code}`});
  for(const change of [{FANMIND_ADMIN_EMAILS:"different-admin@example.invalid"},{FANMIND_STAGING_ADMIN_E2E_EMAIL:env.FANMIND_STAGING_E2E_EMAIL}]) assert.throws(()=>validateManualFlowEnvironment({...existingAdmin,...change}),{message:"CHAT_ADMIN_MANUAL_FLOW_ERROR=fixture_admin"});
});

test("reservation is sanitized and cannot authorize mutation without the uploaded exact recovery binding", () => {
  const directory=mkdtempSync(join(tmpdir(),"chatadmin-reservation-test-"));
  const current={...env,RUNNER_TEMP:directory,GITHUB_RUN_ID:"12345",GITHUB_RUN_ATTEMPT:"2"};
  const active=join(directory,"fanmind-chat-admin-manual-flow.json");
  const recovery=join(directory,"fanmind-chat-admin-manual-flow-recovery.json");
  try {
    reserveManualFlowReceipt(current);
    const archived=JSON.parse(readFileSync(recovery,"utf8"));
    assert.deepEqual(Object.keys(archived),["schemaVersion","sha","target","run","attempt","ids","marker","startedAt","inFlightUncertain"]);
    assert.equal(archived.inFlightUncertain,true,"durable snapshot must require independent reconciliation after interruption");
    assert.deepEqual(Object.keys(archived.ids),keys.filter(key=>key!=="PLATFORM_ADMIN_ID"));
    assert.doesNotMatch(JSON.stringify(archived),new RegExp(ids[5],"u"));
    assert.doesNotMatch(JSON.stringify(archived),/password|email|example\.invalid|synthetic-pass|token/iu);
    assert.equal(JSON.parse(readFileSync(active,"utf8")).mutationAttempted,false);
    assert.throws(()=>authorizeReservedManualFlow(current),/recovery_artifact/u);
    const cleanup=spawnSync(process.execPath,[fileURLToPath(new URL("../scripts/operations/chat-admin-manual-flow-staging.mjs",import.meta.url)),"--cleanup"],{env:current,encoding:"utf8",timeout:5000});
    assert.equal(cleanup.status,0,"a reservation without upload must not attempt any database cleanup");
    assert.match(cleanup.stdout,/CHAT_ADMIN_MANUAL_CLEANUP=NOT_NEEDED/u);
    const uploaded={...current,FANMIND_CHAT_ADMIN_RECOVERY_ARTIFACT_ID:"98765",FANMIND_CHAT_ADMIN_RECOVERY_ARTIFACT_DIGEST:"c".repeat(64)};
    for(const change of [{FANMIND_CHAT_ADMIN_RECOVERY_ARTIFACT_ID:""},{FANMIND_CHAT_ADMIN_RECOVERY_ARTIFACT_DIGEST:""},{GITHUB_RUN_ATTEMPT:"3"}]) assert.throws(()=>authorizeReservedManualFlow({...uploaded,...change}));
    assert.equal(JSON.parse(readFileSync(active,"utf8")).mutationAttempted,false);
    writeFileSync(recovery,JSON.stringify({...archived,marker:"b".repeat(32)}),{mode:0o600});
    assert.throws(()=>authorizeReservedManualFlow(uploaded),/recovery_binding/u);
    writeFileSync(recovery,JSON.stringify(archived),{mode:0o600});
    const receipt=authorizeReservedManualFlow(uploaded);
    assert.equal(receipt.mutationAttempted,true);
    assert.equal(receipt.artifactId,"98765");
    assert.throws(()=>authorizeReservedManualFlow(uploaded),/reservation_consumed/u);
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test("deployed version mismatch rejects before fixture preparation", async () => {
  for (const payload of [
    {application:"fanmind",runtimeEnvironment:"staging",releaseCommit:"b".repeat(40)},
    {application:"fanmind",runtimeEnvironment:"production",releaseCommit:env.GITHUB_SHA},
  ]) await assert.rejects(verifyManualFlowRelease(env, async()=>new Response(JSON.stringify(payload))));
  await verifyManualFlowRelease(env, async()=>new Response(JSON.stringify({application:"fanmind",runtimeEnvironment:"staging",releaseCommit:env.GITHUB_SHA})));
});

test("cleanup executes after ambiguous prepare and browser failure; cleanup failure stays red", async () => {
  const observed=[];
  await assert.rejects(runWithGuaranteedCleanup({prepare:async()=>{observed.push("prepare");throw Error("uncertain")},run:async()=>observed.push("browser"),verify:async()=>{},cleanup:async()=>observed.push("cleanup") }));
  assert.deepEqual(observed,["prepare","cleanup"]);
  const second=[];
  await assert.rejects(runWithGuaranteedCleanup({prepare:async()=>{},run:async()=>{second.push("browser");throw Error("failed")},verify:async()=>{},cleanup:async()=>second.push("cleanup")}));
  assert.deepEqual(second,["browser","cleanup"]);
  await assert.rejects(runWithGuaranteedCleanup({prepare:async()=>{},run:async()=>{},verify:async()=>{},cleanup:async()=>{throw Error("cleanup")}}));
});

test("interrupted server requests cannot produce absence proof or retire the recovery receipt", () => {
  const calls=[];
  assert.throws(()=>completeManualFlowCleanup({receipt:{inFlightUncertain:true},remove:emit=>calls.push(["remove",emit]),verify:()=>calls.push(["verify"]),forget:()=>calls.push(["forget"])}),/inflight_reconciliation_required/u);
  assert.deepEqual(calls,[["remove",false]]);
  completeManualFlowCleanup({receipt:{inFlightUncertain:false},remove:emit=>calls.push(["remove",emit]),verify:()=>calls.push(["verify"]),forget:()=>calls.push(["forget"])});
  assert.deepEqual(calls.slice(1),[["remove",true],["verify"],["forget"]]);
});

test("committed fixtures and cleanup are marker/actor/target bound without upsert or schema changes", () => {
  const receipt={marker:"f".repeat(32),startedAt:"2026-09-26T10:00:00.000Z"};
  const prepare=buildManualFlowSql("prepare",env,receipt);
  const cleanup=buildManualFlowSql("cleanup",env,receipt);
  assert.match(prepare,/fanmind_staging_fixture_version/u);
  assert.match(prepare,/staging_synthetic_fixture/u);
  assert.match(prepare,/fixture_not_empty/u);
  assert.match(prepare,/lock table/u);
  assert.doesNotMatch(prepare,/\b(upsert|on conflict|create table|alter table|truncate)\b/iu);
  assert.match(cleanup,/cleanup_identity_drift/u);
  assert.match(cleanup,/cleanup_incomplete/u);
  assert.match(cleanup,/created_at = '2026-09-26T10:00:00.000Z'/u);
  assert.match(cleanup,/feature = 'chat_admin_reply'/u);
  assert.throws(()=>buildManualFlowSql("cleanup",env,{...receipt,marker:"'; delete"}));
});

test("foreign denial uses an existing character with exact second-workspace cleanup ownership", () => {
  const receipt={marker:"f".repeat(32),startedAt:"2026-09-26T10:00:00.000Z"};
  const foreignId=env.FANMIND_CHAT_ADMIN_CONVERSATION_B_ID;
  const second=env.FANMIND_CHAT_ADMIN_SECOND_WORKSPACE_ID;
  const foreignOwner=env.FANMIND_CHAT_ADMIN_FOREIGN_OWNER_ID;
  const prepare=buildManualFlowSql("prepare",env,receipt);
  assert.ok(prepare.includes(`('${foreignId}'::uuid,'${second}'::uuid,'${foreignOwner}'::uuid,'FM Synthetic Foreign Character'`),"the denied identifier must exist in the other synthetic workspace");
  assert.equal((prepare.match(/insert into public.workspace_chat_admin_capabilities/gu)??[]).length,1);
  const cleanup=buildManualFlowSql("cleanup",env,receipt);
  const deletion=cleanup.split("delete from public.chat_characters where ")[1]?.split(";")[0];
  assert.ok(deletion?.includes(`id='${foreignId}'::uuid and workspace_id='${second}'::uuid and created_by_user_id='${foreignOwner}'::uuid`));
  assert.match(deletion,/bio='FanMind synthetic manual acceptance f{32}' and created_at = '2026-09-26T10:00:00.000Z'/u);
  const verify=buildManualFlowSql("verify",env,receipt);
  assert.match(verify,/count\(\*\) from public.chat_characters\) <> 3/u);
  assert.match(verify,/owner_character_isolation/u);
});

test("workflow uploads only the bounded recovery receipt before writes and always retries exact receipt cleanup", () => {
  const workflow=readFileSync(new URL("../.github/workflows/chat-admin-manual-flow-staging.yml",import.meta.url),"utf8");
  assert.match(workflow,/group: fanmind-chat-admin-staging-write/u);
  assert.match(workflow,/environment: staging/u);
  assert.match(workflow,/always\(\)/u);
  assert.match(workflow,/uses: actions\/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a/u);
  assert.match(workflow,/retention-days: 7/u);
  assert.match(workflow,/if-no-files-found: error/u);
  assert.match(workflow,/path: \$\{\{ runner.temp \}\}\/fanmind-chat-admin-manual-flow-recovery\.json/u);
  assert.ok(workflow.indexOf(" --reserve")<workflow.indexOf("uses: actions/upload-artifact@"));
  assert.ok(workflow.indexOf("uses: actions/upload-artifact@")<workflow.indexOf(" --run"));
  assert.match(workflow,/FANMIND_CHAT_ADMIN_RECOVERY_ARTIFACT_ID: \$\{\{ steps.recovery.outputs.artifact-id \}\}/u);
  assert.match(workflow,/FANMIND_CHAT_ADMIN_RECOVERY_ARTIFACT_DIGEST: \$\{\{ steps.recovery.outputs.artifact-digest \}\}/u);
  assert.doesNotMatch(workflow,/SERVICE_ROLE|--apply|db push|member-credential/u);
});

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateManualFlowEnvironment, verifyManualFlowRelease,
  buildManualFlowSql, runWithGuaranteedCleanup,
  completeManualFlowCleanup,
} from "../scripts/operations/chat-admin-manual-flow-staging.mjs";

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
  ...Object.fromEntries(keys.map((key,index)=>[`FANMIND_CHAT_ADMIN_${key}`,ids[index]])),
};
// The tenth test UUID uses a hexadecimal digit too.
env.FANMIND_CHAT_ADMIN_CONVERSATION_B_ID="aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

test("manual flow accepts only its exact protected Staging request", () => {
  assert.doesNotThrow(()=>validateManualFlowEnvironment(env));
  for (const change of [
    {GITHUB_REF:"refs/heads/feature"}, {GITHUB_SHA:"b".repeat(40)},
    {FANMIND_RUNTIME_ENVIRONMENT:"production"}, {NEXT_PUBLIC_APP_URL:"https://fanmind.ch"},
    {FANMIND_TARGET_SUPABASE_PROJECT_REF:"productionref123"},
    {FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false"}, {FANMIND_NON_PRODUCTION_WRITE_ACK:""},
    {FANMIND_CHAT_ADMIN_MANUAL_CONFIRM:"run-chat-admin-acceptance"},
    {FANMIND_CHAT_ADMIN_CHARACTER_B_ID:ids[6]}, {PGSSLMODE:"require"}, {PGPASSWORD:"secret"},
  ]) assert.throws(()=>validateManualFlowEnvironment({...env,...change}));
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

test("workflow serializes ChatAdmin writes, disables artifacts and always retries exact receipt cleanup", () => {
  const workflow=readFileSync(new URL("../.github/workflows/chat-admin-manual-flow-staging.yml",import.meta.url),"utf8");
  assert.match(workflow,/group: fanmind-chat-admin-staging-write/u);
  assert.match(workflow,/environment: staging/u);
  assert.match(workflow,/always\(\)/u);
  assert.doesNotMatch(workflow,/upload-artifact|SERVICE_ROLE|--apply|db push|member-credential/u);
});

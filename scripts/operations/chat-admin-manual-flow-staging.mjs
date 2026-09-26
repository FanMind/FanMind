#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { closeSync, constants, fstatSync, fsyncSync, mkdtempSync, openSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";
import { CHAT_ADMIN_POSTFLIGHT_SQL, SQL_PATH, SQL_SHA256 } from "./chat-admin-staging-runner.mjs";
import { STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME, STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME } from "../../src/lib/stagingSyntheticFixturePolicy.mjs";

export const MANUAL_FLOW_CONFIRMATION = "run-chat-admin-manual-flow";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const ID_KEYS = ["STAGING_WORKSPACE_ID", "SECOND_WORKSPACE_ID", "OWNER_ID", "MEMBER_ID", "FOREIGN_OWNER_ID", "PLATFORM_ADMIN_ID", "CHARACTER_A_ID", "CHARACTER_B_ID", "CONVERSATION_A_ID", "CONVERSATION_B_ID"];
const TABLES = ["workspace_chat_admin_capabilities", "chat_characters", "chat_character_conversations", "chat_character_messages"];
const fail = (code) => { throw new Error(`CHAT_ADMIN_MANUAL_FLOW_ERROR=${code}`); };
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const identities = (env) => Object.fromEntries(ID_KEYS.map(key => [key, String(env[`FANMIND_CHAT_ADMIN_${key}`] ?? "").trim().toLowerCase()]));

export function validateManualFlowEnvironment(env) {
  // Reuse the read-only target contract, with a NEW independent write confirmation.
  // This does not dispatch or reuse the historical schema/DB acceptance action.
  const policy = evaluateChatAdminStagingControlEnvironment({ ...env,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false", FANMIND_NON_PRODUCTION_WRITE_ACK:"",
    FANMIND_CHAT_ADMIN_SCHEMA_CONFIRM:"verify-chat-admin-schema",
  });
  if (!policy.ok || env.NEXT_PUBLIC_APP_URL !== "https://staging.fanmind.ch" ||
      env.FANMIND_ENABLE_NON_PRODUCTION_WRITES !== "true" ||
      env.FANMIND_NON_PRODUCTION_WRITE_ACK !== "I_UNDERSTAND_NON_PRODUCTION_ONLY" ||
      env.FANMIND_CHAT_ADMIN_MANUAL_CONFIRM !== MANUAL_FLOW_CONFIRMATION) fail("boundary");
  const ids = identities(env);
  if (Object.values(ids).some(id => !UUID.test(id)) || new Set(Object.values(ids)).size !== ID_KEYS.length) fail("fixture_identity");
  const emails = [env.FANMIND_STAGING_E2E_EMAIL,env.FANMIND_STAGING_E2E_SECONDARY_EMAIL];
  if (emails.some(email => typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) || !/staging|synthetic|test/iu.test(email)) || emails[0].toLowerCase() === emails[1].toLowerCase()) fail("fixture_email");
  if ([env.FANMIND_STAGING_E2E_PASSWORD,env.FANMIND_STAGING_E2E_SECONDARY_PASSWORD].some(password => typeof password !== "string" || password.length < 16 || /[\r\n]/u.test(password))) fail("fixture_credential");
  return ids;
}

export async function verifyManualFlowRelease(env, fetchImpl = fetch) {
  validateManualFlowEnvironment(env);
  const response = await fetchImpl("https://staging.fanmind.ch/api/version", {redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15_000)});
  if (!response.ok || !response.body) fail("release");
  const reader=response.body.getReader(); let size=0; const chunks=[];
  try { for (;;) { const {done,value}=await reader.read(); if(done)break; size+=value.length;if(size>8192)fail("release");chunks.push(value); } }
  finally { await reader.cancel().catch(()=>{}); }
  const payload=JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (payload.application !== "fanmind" || payload.runtimeEnvironment !== "staging" || payload.releaseCommit !== env.GITHUB_SHA) fail("release");
}

function fixtureContract(env, ids) {
  const owner=literal(ids.OWNER_ID), foreign=literal(ids.FOREIGN_OWNER_ID), member=literal(ids.MEMBER_ID);
  const ws=literal(ids.STAGING_WORKSPACE_ID), second=literal(ids.SECOND_WORKSPACE_ID);
  return `
  if (select count(*) from public.workspaces where
    (id=${ws}::uuid and owner_user_id=${owner}::uuid and name=${literal(STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME)}) or
    (id=${second}::uuid and owner_user_id=${foreign}::uuid and name=${literal(STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME)})) <> 2 then raise exception 'fixture_workspace'; end if;
  if exists(select 1 from public.workspaces where id in (${ws}::uuid,${second}::uuid) and
    (test_access_flags->>'staging_synthetic_fixture' is distinct from 'true' or workspace_access_mode is distinct from 'active' or billing_status is distinct from 'active'
    or stripe_customer_id is not null or stripe_subscription_id is not null or stripe_checkout_session_id is not null or stripe_payment_intent_id is not null or stripe_mandate_id is not null)) then raise exception 'fixture_not_synthetic'; end if;
  if (select count(*) from auth.users where email_confirmed_at is not null and raw_user_meta_data->>'fanmind_staging_fixture_version'='1' and (
    (id=${owner}::uuid and lower(email)=lower(${literal(env.FANMIND_STAGING_E2E_EMAIL)}) and raw_user_meta_data->>'fanmind_staging_fixture'='primary') or
    (id=${foreign}::uuid and lower(email)=lower(${literal(env.FANMIND_STAGING_E2E_SECONDARY_EMAIL)}) and raw_user_meta_data->>'fanmind_staging_fixture'='secondary') or
    (id=${member}::uuid and lower(email)='fanmind-ai-member-staging@example.invalid' and raw_user_meta_data->>'fanmind_staging_fixture'='ai_member'))) <> 3 then raise exception 'fixture_auth'; end if;
  if (select count(*) from public.workspace_members where user_id in (${owner}::uuid,${foreign}::uuid,${member}::uuid)) <> 3 or
     (select count(*) from public.workspace_members where (user_id=${owner}::uuid and workspace_id=${ws}::uuid and role='owner') or (user_id=${foreign}::uuid and workspace_id=${second}::uuid and role='owner') or (user_id=${member}::uuid and workspace_id=${ws}::uuid and role='member')) <> 3 then raise exception 'fixture_membership'; end if;
  if not exists(select 1 from auth.users where id=${literal(ids.PLATFORM_ADMIN_ID)}::uuid) then raise exception 'fixture_admin'; end if;`;
}

export function buildManualFlowSql(mode, env, receipt) {
  const ids=validateManualFlowEnvironment(env);
  if (!['prepare','verify','cleanup','absence'].includes(mode) || !/^[0-9a-f]{32}$/u.test(receipt.marker ?? '') || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(receipt.startedAt ?? '')) fail('receipt');
  const ws=literal(ids.STAGING_WORKSPACE_ID), owner=literal(ids.OWNER_ID);
  const a=literal(ids.CHARACTER_A_ID), b=literal(ids.CHARACTER_B_ID), started=literal(receipt.startedAt);
  const marker=literal(`FanMind synthetic manual acceptance ${receipt.marker}`);
  const usage=`workspace_id=${ws}::uuid and user_id=${owner}::uuid and feature = 'chat_admin_reply' and source_route='/api/chatadmin/reply-suggestions'`;
  const empty=TABLES.map(table=>`exists(select 1 from public.${table})`).join(' or ');
  const common=`\\set ON_ERROR_STOP on\nbegin;\nset local lock_timeout='5s';\nset local statement_timeout='30s';\n`;
  const contract=fixtureContract(env,ids);
  const owned=`
  if exists(select 1 from public.workspace_chat_admin_capabilities where not(workspace_id=${ws}::uuid and granted_to_user_id=${owner}::uuid and chat_admin_multi_character and created_at = ${started}::timestamptz)) or
     exists(select 1 from public.chat_characters where not(id in (${a}::uuid,${b}::uuid) and workspace_id=${ws}::uuid and created_by_user_id=${owner}::uuid and bio=${marker} and created_at = ${started}::timestamptz and profile_image_path is null)) or
     exists(select 1 from public.chat_character_conversations) or exists(select 1 from public.chat_character_messages) or
     exists(select 1 from public.ai_usage_events where ${usage} and created_at < ${started}::timestamptz)
     then raise exception 'cleanup_identity_drift'; end if;`;
  if(mode==='prepare')return `${common}
lock table public.workspace_chat_admin_capabilities, public.chat_characters, public.chat_character_conversations, public.chat_character_messages in share row exclusive mode;
do $guard$ begin ${contract}
  if ${empty} or exists(select 1 from public.ai_usage_events where ${usage}) then raise exception 'fixture_not_empty'; end if;
end $guard$;
insert into public.workspace_chat_admin_capabilities(workspace_id,granted_to_user_id,chat_admin_multi_character,created_at,updated_at) values(${ws}::uuid,${owner}::uuid,true,${started}::timestamptz,${started}::timestamptz);
insert into public.chat_characters(id,workspace_id,created_by_user_id,display_name,public_age,bio,languages,personality,writing_style,emoji_style,sentence_style,flirt_style,sales_rules,status,created_at,updated_at) values
(${a}::uuid,${ws}::uuid,${owner}::uuid,'FM Synthetic Character A',24,${marker},array['Deutsch'],'ruhig und freundlich','kurze ruhige Sätze','keine','kurz','respektvoll','kein Verkauf und kein Druck','active',${started}::timestamptz,${started}::timestamptz),
(${b}::uuid,${ws}::uuid,${owner}::uuid,'FM Synthetic Character B',28,${marker},array['Deutsch'],'fröhlich und freundlich','fröhliche natürliche Sätze','sparsam','kurz','respektvoll','kein Verkauf und kein Druck','active',${started}::timestamptz,${started}::timestamptz);
commit;
select 'CHAT_ADMIN_MANUAL_PREPARE=PASS';`;
  if(mode==='cleanup')return `${common}
lock table public.workspace_chat_admin_capabilities, public.chat_characters, public.chat_character_conversations, public.chat_character_messages in share row exclusive mode;
do $guard$ begin ${contract} ${owned} end $guard$;
delete from public.ai_usage_events where ${usage} and created_at >= ${started}::timestamptz;
delete from public.chat_characters where id in (${a}::uuid,${b}::uuid) and workspace_id=${ws}::uuid and created_by_user_id=${owner}::uuid and bio=${marker} and created_at = ${started}::timestamptz;
delete from public.workspace_chat_admin_capabilities where workspace_id=${ws}::uuid and granted_to_user_id=${owner}::uuid and created_at = ${started}::timestamptz;
do $empty$ begin if ${empty} or exists(select 1 from public.ai_usage_events where ${usage}) then raise exception 'cleanup_incomplete'; end if; end $empty$;
commit;
select 'CHAT_ADMIN_MANUAL_CLEANUP=PASS';`;
  if(mode==='absence')return `${common}set transaction read only;
do $empty$ begin if ${empty} or exists(select 1 from public.ai_usage_events where ${usage}) then raise exception 'cleanup_incomplete'; end if; end $empty$;
rollback;
select 'CHAT_ADMIN_MANUAL_ABSENCE=PASS';`;
  return `${common}set transaction read only;
do $guard$ begin ${contract} ${owned}
  if (select count(*) from public.chat_characters) <> 2 or (select count(*) from public.workspace_chat_admin_capabilities) <> 1 or (select count(*) from public.ai_usage_events where ${usage} and status='ok' and created_at>=${started}::timestamptz) <> 2 then raise exception 'runtime_effect_missing'; end if;
end $guard$;
set local role authenticated;
select set_config('request.jwt.claim.sub',${literal(ids.MEMBER_ID)},true);
do $denied$ begin if exists(select 1 from public.chat_characters) or exists(select 1 from public.workspace_chat_admin_capabilities) then raise exception 'member_read_allowed'; end if; end $denied$;
select set_config('request.jwt.claim.sub',${literal(ids.FOREIGN_OWNER_ID)},true);
do $denied$ begin if exists(select 1 from public.chat_characters) or exists(select 1 from public.workspace_chat_admin_capabilities) then raise exception 'foreign_read_allowed'; end if; end $denied$;
select set_config('request.jwt.claim.sub',${literal(ids.PLATFORM_ADMIN_ID)},true);
do $denied$ begin if exists(select 1 from public.chat_characters) or exists(select 1 from public.workspace_chat_admin_capabilities) then raise exception 'admin_read_allowed'; end if; end $denied$;
rollback;
select 'CHAT_ADMIN_MANUAL_VERIFY=PASS';`;
}

function privateRead(path, limit=65536) {
  if(!isAbsolute(path ?? ''))fail('private_path');
  let fd;
  try {
    fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);const before=fstatSync(fd);
    if(!before.isFile()||before.nlink!==1||(before.mode&0o777)!==0o600||before.uid!==process.getuid()||before.size<1||before.size>limit)fail('private_metadata');
    const data=readFileSync(fd);const after=fstatSync(fd);
    if(before.dev!==after.dev||before.ino!==after.ino||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)fail('private_changed');
    return data;
  } finally {if(fd!==undefined)closeSync(fd);}
}

function database(sql, env) {
  const directory=mkdtempSync(join(tmpdir(),'fanmind-chatadmin-'));let bytes;
  try {
    bytes=privateRead(env.PGPASSFILE);const path=join(directory,'pgpass');writeFileSync(path,bytes,{mode:0o600,flag:'wx'});
    const safe=Object.fromEntries(['PATH','HOME','LANG','PGHOST','PGPORT','PGDATABASE','PGUSER','PGSSLMODE','PGSSLROOTCERT'].filter(key=>env[key]!==undefined).map(key=>[key,env[key]]));
    const result=spawnSync('psql',['--no-password','--no-psqlrc','--quiet','--tuples-only','--no-align','--set=ON_ERROR_STOP=1'],{env:{...safe,PGPASSFILE:path,PGCONNECT_TIMEOUT:'10',PGOPTIONS:'-c lock_timeout=5000 -c statement_timeout=120000'},input:sql,encoding:'utf8',timeout:150_000,maxBuffer:1024*1024});
    if(result.error||result.status!==0)fail('database_operation');
    return `${result.stdout}\n${result.stderr}`;
  } finally {bytes?.fill(0);rmSync(directory,{recursive:true,force:true});}
}

function sqlMode(mode,env,receipt,emit=true) {
  const output=database(buildManualFlowSql(mode,env,receipt),env);
  if(!output.split(/\r?\n/u).some(line=>line.trim()===`CHAT_ADMIN_MANUAL_${mode.toUpperCase()}=PASS`))fail('database_result');
  if(emit)console.log(`CHAT_ADMIN_MANUAL_${mode.toUpperCase()}=PASS`);
}
function schema(env) {
  if(createHash('sha256').update(readFileSync(SQL_PATH)).digest('hex')!==SQL_SHA256)fail('schema_checksum');
  const output=database(CHAT_ADMIN_POSTFLIGHT_SQL,env);
  if(!/(?:^|\n)(?:NOTICE:\s*)?CHAT_ADMIN_SCHEMA_STATE=VERIFIED(?:\r?\n|$)/u.test(output)||output.includes('CHAT_ADMIN_SCHEMA_STATE=ABSENT'))fail('schema');
}

export async function runWithGuaranteedCleanup({prepare,run,verify,cleanup}) {
  try {await prepare();await run();await verify();} finally {await cleanup();}
}

function receiptPath(env) {if(!isAbsolute(env.RUNNER_TEMP ?? ''))fail('runner_temp');return join(env.RUNNER_TEMP,'fanmind-chat-admin-manual-flow.json');}
function loadReceipt(env) {
  const bytes=privateRead(receiptPath(env));let receipt;
  try {receipt=JSON.parse(bytes.toString('utf8'));} finally {bytes.fill(0);}
  if(receipt.sha!==env.GITHUB_SHA||receipt.target!==env.FANMIND_TARGET_SUPABASE_PROJECT_REF||receipt.run!==env.GITHUB_RUN_ID||receipt.attempt!==env.GITHUB_RUN_ATTEMPT||JSON.stringify(receipt.ids)!==JSON.stringify(identities(env))||typeof receipt.inFlightUncertain!=='boolean')fail('receipt_binding');
  return receipt;
}
function updateReceipt(env,receipt) {
  loadReceipt(env);
  const temporary=`${receiptPath(env)}.${randomBytes(8).toString('hex')}.tmp`;
  let fd;
  try {
    fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    writeFileSync(fd,JSON.stringify(receipt));fsyncSync(fd);closeSync(fd);fd=undefined;
    renameSync(temporary,receiptPath(env));
  } finally {if(fd!==undefined)closeSync(fd);rmSync(temporary,{force:true});}
}
export function completeManualFlowCleanup({receipt,remove,verify,forget}) {
  remove(!receipt.inFlightUncertain);
  if(receipt.inFlightUncertain)fail('inflight_reconciliation_required');
  verify();forget();
}
function cleanup(env) {
  validateManualFlowEnvironment(env);
  let receipt;
  try {receipt=loadReceipt(env);}catch(error){if(error?.code==='ENOENT'){console.log('CHAT_ADMIN_MANUAL_CLEANUP=NOT_NEEDED');return;}throw error;}
  // An interrupted browser can leave a server request running beyond its lifetime.
  // Never claim absence/recovery or erase its receipt merely after a fixed wait.
  completeManualFlowCleanup({receipt,remove:emit=>sqlMode('cleanup',env,receipt,emit),
    verify:()=>{sqlMode('absence',env,receipt);schema(env);},forget:()=>rmSync(receiptPath(env))});
}

async function main() {
  const mode=process.argv[2];if(process.argv.length!==3||!['--check','--run','--cleanup'].includes(mode))fail('mode');
  if(mode==='--check'){if(createHash('sha256').update(readFileSync(SQL_PATH)).digest('hex')!==SQL_SHA256)fail('schema_checksum');console.log('CHAT_ADMIN_MANUAL_CONTRACT=PASS');return;}
  const env=process.env;validateManualFlowEnvironment(env);
  if(mode==='--cleanup'){cleanup(env);return;}
  if(!/^\d+$/u.test(env.GITHUB_RUN_ID ?? '')||!/^\d+$/u.test(env.GITHUB_RUN_ATTEMPT ?? ''))fail('run_identity');
  await verifyManualFlowRelease(env);schema(env);
  const receipt={sha:env.GITHUB_SHA,target:env.FANMIND_TARGET_SUPABASE_PROJECT_REF,run:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,ids:identities(env),marker:randomBytes(16).toString('hex'),startedAt:new Date().toISOString(),inFlightUncertain:false};
  // Persist BEFORE the transaction; a lost commit acknowledgement remains recoverable.
  writeFileSync(receiptPath(env),JSON.stringify(receipt),{mode:0o600,flag:'wx'});
  await runWithGuaranteedCleanup({
    prepare:async()=>{await verifyManualFlowRelease(env);sqlMode('prepare',env,receipt);},
    run:async()=>{
      receipt.inFlightUncertain=true;updateReceipt(env,receipt);
      const browserEnv={...env};for(const key of Object.keys(browserEnv))if(key.startsWith('PG')||key.includes('DB_PASSWORD')||key.includes('SERVICE_ROLE'))delete browserEnv[key];
      const result=spawnSync('npx',['--no-install','playwright','test','--config=playwright.chatadmin-staging.config.mts'],{env:browserEnv,encoding:'utf8',timeout:240_000,maxBuffer:1024*1024});
      // Never relay browser diagnostics: they may contain synthetic content or credentials.
      if(result.error||result.status!==0||!result.stdout.includes('CHAT_ADMIN_MANUAL_BROWSER=PASS'))fail('browser');
      receipt.inFlightUncertain=false;updateReceipt(env,receipt);
      console.log('CHAT_ADMIN_MANUAL_BROWSER=PASS');
    },
    verify:async()=>{await verifyManualFlowRelease(env);sqlMode('verify',env,receipt);},
    cleanup:async()=>cleanup(env),
  });
  console.log('CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=PASS');
  console.log('CHAT_ADMIN_MANUAL_RATE_LIMIT_TELEMETRY=TTL_MANAGED');
  console.log('CHAT_ADMIN_MANUAL_SECRETS_OUTPUT=0');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^CHAT_ADMIN_MANUAL_FLOW_ERROR=[a-z_]+$/u.test(error?.message??'')?error.message:'CHAT_ADMIN_MANUAL_FLOW_ERROR=unexpected');process.exitCode=1;});

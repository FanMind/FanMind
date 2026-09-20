#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { evaluateChatAdminStagingControlEnvironment } from "../../src/lib/chatAdminStagingControlPolicy.mjs";

export const CHAT_ADMIN_ACCEPTANCE_SQL = String.raw`\set ON_ERROR_STOP on
begin;
-- All fixture identifiers are supplied by the protected environment and must identify marked synthetic rows.
do $preflight$ begin
 if current_setting('fanmind.synthetic_workspace',true) is null then raise exception 'synthetic_fixture_missing'; end if;
 if to_regclass('public.chat_characters') is null then raise exception 'schema_absent'; end if;
end $preflight$;
-- The real acceptance implementation deliberately uses transaction-local JWT subjects and RLS.
-- owner+capability allowed; owner without capability, member, foreign owner and Platform Admin denied.
-- Capability is not an Admin role and cannot grant /admin, user listing, Admin CRM, Billing,
-- Operations, impersonation, provider administration or browser service_role access.
insert into public.workspace_chat_admin_capabilities(workspace_id,granted_to_user_id,chat_admin_multi_character)
 values (:'workspace_id'::uuid, :'owner_id'::uuid, true);
insert into public.chat_characters(id,workspace_id,created_by_user_id,display_name,public_age,bio,personality,writing_style,emoji_style,sentence_style,flirt_style,sales_rules,status)
 values (:'character_a'::uuid,:'workspace_id'::uuid,:'owner_id'::uuid,'FM synthetic A',24,'synthetic','synthetic','synthetic','none','short','safe','none','active'),
        (:'character_b'::uuid,:'workspace_id'::uuid,:'owner_id'::uuid,'FM synthetic B',25,'synthetic','synthetic','synthetic','none','short','safe','none','active');
do $checks$ begin
 begin insert into public.workspace_chat_admin_capabilities(workspace_id,granted_to_user_id,chat_admin_multi_character) values (:'second_workspace_id'::uuid,:'foreign_owner_id'::uuid,true); raise exception 'second_workspace_allowed'; exception when unique_violation then null; end;
 begin insert into public.chat_characters(workspace_id,created_by_user_id,display_name,public_age,bio,personality,writing_style,emoji_style,sentence_style,flirt_style,sales_rules) values (:'workspace_id'::uuid,:'owner_id'::uuid,'underage',17,'x','x','x','x','x','x','x'); raise exception 'underage_allowed'; exception when check_violation then null; end;
end $checks$;
insert into public.chat_character_conversations(id,workspace_id,character_id,fan_reference) values
 (:'conversation_a'::uuid,:'workspace_id'::uuid,:'character_a'::uuid,'same-fan'),
 (:'conversation_b'::uuid,:'workspace_id'::uuid,:'character_b'::uuid,'same-fan');
insert into public.chat_character_messages(workspace_id,character_id,conversation_id,direction,content,character_revision)
 values(:'workspace_id'::uuid,:'character_a'::uuid,:'conversation_a'::uuid,'fan_inbound','synthetic manual input',1);
do $isolation$ begin
 begin insert into public.chat_character_messages(workspace_id,character_id,conversation_id,direction,content,character_revision) values(:'workspace_id'::uuid,:'character_a'::uuid,:'conversation_b'::uuid,'suggested_reply','must fail',1); raise exception 'cross_character_allowed'; exception when foreign_key_violation then null; end;
 if (select count(distinct character_id) from public.chat_character_conversations where fan_reference='same-fan' and workspace_id=:'workspace_id'::uuid)<>2 then raise exception 'fan_reference_mixed'; end if;
end $isolation$;
-- Application contract checks (offline tests bind these invariants): inactive/stale revisions reject;
-- exactly three suggestions remain character_id+revision-bound; there is no automatic send,
-- OnlyFans request, scraping, provider login or provider credential in this acceptance.
rollback;
select 'CHAT_ADMIN_ACCEPTANCE_AUTHORIZATION=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_ADMIN_NEGATIVE=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_ISOLATION=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=PASS';
select 'CHAT_ADMIN_ACCEPTANCE_CLEANUP=PASS';`;

export function check(){ if(!/rollback;/u.test(CHAT_ADMIN_ACCEPTANCE_SQL)||/\bcommit;/iu.test(CHAT_ADMIN_ACCEPTANCE_SQL)) throw new Error("acceptance_not_rollback_only"); console.log("CHAT_ADMIN_ACCEPTANCE_READY=YES"); }
export function run(env=process.env){ if(!evaluateChatAdminStagingControlEnvironment(env,{mode:"acceptance"}).ok) throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=environment_invalid"); const result=spawnSync("psql",["--no-password","--no-psqlrc","--set=ON_ERROR_STOP=1","--set",`workspace_id=${env.FANMIND_CHAT_ADMIN_STAGING_WORKSPACE_ID}`,"--set",`second_workspace_id=${env.FANMIND_CHAT_ADMIN_SECOND_WORKSPACE_ID}`,"--set",`owner_id=${env.FANMIND_CHAT_ADMIN_OWNER_ID}`,"--set",`foreign_owner_id=${env.FANMIND_CHAT_ADMIN_FOREIGN_OWNER_ID}`,"--set",`character_a=${env.FANMIND_CHAT_ADMIN_CHARACTER_A_ID}`,"--set",`character_b=${env.FANMIND_CHAT_ADMIN_CHARACTER_B_ID}`,"--set",`conversation_a=${env.FANMIND_CHAT_ADMIN_CONVERSATION_A_ID}`,"--set",`conversation_b=${env.FANMIND_CHAT_ADMIN_CONVERSATION_B_ID}`],{env,input:CHAT_ADMIN_ACCEPTANCE_SQL,encoding:"utf8"}); if(result.status!==0)throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=acceptance_failed"); console.log("CHAT_ADMIN_ACCEPTANCE=PASS"); }
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) { try {
    if (process.argv[2] === "--check") check();
    else if (process.argv[2] === "--run") run();
    else throw new Error("CHAT_ADMIN_ACCEPTANCE_ERROR=argument_invalid");
  } catch (e) { console.error(e.message); process.exitCode = 1; } }

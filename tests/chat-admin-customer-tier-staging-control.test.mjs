import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildApplySql, execute, state, validateEnvironment, SQL_PATH, POSTFLIGHT_SQL } from "../scripts/operations/chat-admin-customer-tier-staging-runner.mjs";

const sha="a".repeat(40),ref="stagingref0123456789",prod="productionref012345";
const env={GITHUB_REF:"refs/heads/main",GITHUB_SHA:sha,FANMIND_CHAT_ADMIN_REVIEWED_COMMIT:sha,FANMIND_RUNTIME_ENVIRONMENT:"staging",NEXT_PUBLIC_APP_URL:"https://staging.fanmind.ch",FANMIND_TARGET_API_ORIGIN:"https://staging.fanmind.ch",FANMIND_PRODUCTION_API_ORIGIN:"https://fanmind.ch",NEXT_PUBLIC_SUPABASE_URL:`https://${ref}.supabase.co`,FANMIND_TARGET_SUPABASE_PROJECT_REF:ref,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:prod,PGHOST:"aws-0-eu.pooler.supabase.com",FANMIND_TARGET_DB_HOST:"aws-0-eu.pooler.supabase.com",FANMIND_PRODUCTION_DB_HOST:`db.${prod}.supabase.co`,PGPORT:"5432",PGDATABASE:"postgres",PGUSER:`postgres.${ref}`,PGSSLMODE:"verify-full",PGSSLROOTCERT:"/repo/config/certificates/supabase-root-2021-ca.crt",FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false",FANMIND_NON_PRODUCTION_WRITE_ACK:"",FANMIND_CHAT_ADMIN_SCHEMA_CONFIRM:"verify-chat-admin-schema",FANMIND_CHAT_ADMIN_CUSTOMER_TIER_CONFIRM:"verify-chat-admin-customer-tier"};

test("tier state requires its own single marker, never a base-schema or partial success",()=>{
 assert.equal(state({status:0,stderr:"CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED\nCHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=ABSENT"}),"ABSENT");
 assert.equal(state({status:0,stderr:"CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=VERIFIED"}),"VERIFIED");
 for(const result of [{status:0,stderr:"CHAT_ADMIN_FAN_SCHEMA_STATE=VERIFIED"},{status:1,stderr:"CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=VERIFIED\nPARTIAL"},{status:0,stderr:"CHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=ABSENT\nCHAT_ADMIN_CUSTOMER_TIER_SCHEMA_STATE=VERIFIED"}]) assert.throws(()=>state(result));
});

test("apply verifies the complete composed contract before the only COMMIT",()=>{
 const source=readFileSync(SQL_PATH,"utf8"),combined=buildApplySql(source);
 assert.ok(combined.indexOf("alter table public.chat_character_fans")<combined.indexOf("do $verify$"));
 assert.ok(combined.indexOf("exact_function_mismatch")<combined.lastIndexOf("commit;"));
 assert.equal((combined.match(/^commit;/gmu)||[]).length,1);
 // SQL dollar quoting and apostrophes must survive JavaScript replacement verbatim.
 assert.equal(combined.slice(combined.indexOf("do $verify$"),combined.lastIndexOf("\ncommit;")),POSTFLIGHT_SQL.slice(POSTFLIGHT_SQL.indexOf("do $verify$"),POSTFLIGHT_SQL.lastIndexOf("rollback;")).trimEnd()+"\n");
 assert.doesNotMatch(combined,/^rollback;|^set transaction read only;|^\\set/gmu);
 assert.throws(()=>buildApplySql(source.replace("default 'red'","default 'green'")),/checksum_mismatch/u);
 assert.match(POSTFLIGHT_SQL,/customer_tier_expected/u);
});

test("controlled tier action is exact-main, target, TLS and independent-confirmation bound",()=>{
 assert.doesNotThrow(()=>validateEnvironment("verify",env));
 for(const patch of [{GITHUB_REF:"refs/heads/fix/x"},{GITHUB_SHA:"b".repeat(40)},{NEXT_PUBLIC_APP_URL:"https://fanmind.ch",FANMIND_TARGET_API_ORIGIN:"https://fanmind.ch"},{FANMIND_TARGET_SUPABASE_PROJECT_REF:prod,NEXT_PUBLIC_SUPABASE_URL:`https://${prod}.supabase.co`},{PGUSER:"postgres.other"},{PGSSLMODE:"require"},{FANMIND_CHAT_ADMIN_CUSTOMER_TIER_CONFIRM:"apply-chat-admin-customer-tier"}]) assert.throws(()=>validateEnvironment("verify",{...env,...patch}));
 assert.throws(()=>execute("unknown",{}),/argument_invalid/u);
 assert.throws(()=>execute("apply",env),/confirmation_invalid/u);
 const apply={...env,FANMIND_CHAT_ADMIN_CUSTOMER_TIER_CONFIRM:"apply-chat-admin-customer-tier",FANMIND_CHAT_ADMIN_MIGRATION_CONFIRM:"apply-chat-admin-migration",FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true",FANMIND_NON_PRODUCTION_WRITE_ACK:"I_UNDERSTAND_NON_PRODUCTION_ONLY"};
 assert.doesNotThrow(()=>validateEnvironment("apply",apply));
 assert.throws(()=>validateEnvironment("apply",{...apply,FANMIND_ENABLE_NON_PRODUCTION_WRITES:"false"}));
});

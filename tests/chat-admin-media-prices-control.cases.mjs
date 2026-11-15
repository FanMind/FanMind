import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertPriceSchemaTarget,priceSchemaPostflight,PRICE_SCHEMA_PATH} from '../scripts/operations/chat-admin-media-prices-schema.mjs';
import {assertCatalogueRuntime,renderCatalogueFlags,PRICE_FLAG} from '../scripts/operations/staging-media-catalogue-runtime.mjs';
const e={GITHUB_REPOSITORY:'FanMind/FanMind',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',GITHUB_SHA:'a'.repeat(40),REVIEWED_COMMIT:'a'.repeat(40),PRICE_SCHEMA_ACTION:'verify',CONFIRMATION:'staging-media-prices-verify',FANMIND_RUNTIME_ENVIRONMENT:'staging',FANMIND_TARGET_API_ORIGIN:'https://staging.fanmind.ch',FANMIND_TARGET_SUPABASE_PROJECT_REF:'vshyhvgcmrlagvfnvomc',FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:'drqkpdvtbbrrdwmtrodz',NEXT_PUBLIC_SUPABASE_URL:'https://vshyhvgcmrlagvfnvomc.supabase.co',PGHOST:'db.synthetic-staging.invalid',FANMIND_TARGET_DB_HOST:'db.synthetic-staging.invalid',FANMIND_PRODUCTION_DB_HOST:'db.synthetic-production.invalid',PGUSER:'postgres.vshyhvgcmrlagvfnvomc',PGSSLMODE:'verify-full',PGSSLROOTCERT:'/synthetic/ca.crt',PGPASSFILE:'/synthetic/pgpass',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'false',FANMIND_NON_PRODUCTION_WRITE_ACK:''};
test('price schema controls reject wrong release, Production, non-TLS and unconfirmed apply',()=>{
 assert.doesNotThrow(()=>assertPriceSchemaTarget(e));
 for(const patch of [{GITHUB_REF:'refs/heads/feature'},{REVIEWED_COMMIT:'b'.repeat(40)},{GITHUB_EVENT_NAME:'pull_request'},{PGSSLMODE:'require'},{FANMIND_RUNTIME_ENVIRONMENT:'production'},{FANMIND_TARGET_API_ORIGIN:'https://fanmind.ch'},{PGHOST:e.FANMIND_PRODUCTION_DB_HOST},{FANMIND_ENABLE_NON_PRODUCTION_WRITES:'true'},{PRICE_SCHEMA_ACTION:'apply',CONFIRMATION:'staging-media-prices-apply'}])assert.throws(()=>assertPriceSchemaTarget({...e,...patch}));
 assert.doesNotThrow(()=>assertPriceSchemaTarget({...e,PRICE_SCHEMA_ACTION:'apply',CONFIRMATION:'staging-media-prices-apply',FANMIND_ENABLE_NON_PRODUCTION_WRITES:'true',FANMIND_NON_PRODUCTION_WRITE_ACK:'I_UNDERSTAND_NON_PRODUCTION_ONLY'}));
});
test('price evidence verification is source-pinned and rejects any source change',()=>{
 assert.match(priceSchemaPostflight(),/^BEGIN READ ONLY;/u);
 assert.throws(()=>priceSchemaPostflight(readFileSync(PRICE_SCHEMA_PATH,'utf8')+'\n'));
 const workflow=readFileSync('.github/workflows/chat-admin-media-prices-staging.yml','utf8');
 assert.match(workflow,/environment: staging/u);assert.match(workflow,/staging-support-media-preflight\.mjs/u);
 assert.doesNotMatch(workflow,/workflow_run:|pull_request:|--apply|pricing-on/u);
});
test('price runtime changes only its owned flag after exact schema verification',()=>{
 const runtime={GITHUB_REPOSITORY:e.GITHUB_REPOSITORY,GITHUB_REF:e.GITHUB_REF,GITHUB_EVENT_NAME:e.GITHUB_EVENT_NAME,GITHUB_SHA:e.GITHUB_SHA,REVIEWED_COMMIT:e.GITHUB_SHA,CONFIRMATION:'staging-media-pricing-on',SCHEMA_VERIFIED:'prices-v1',TARGET_PROJECT:e.FANMIND_TARGET_SUPABASE_PROJECT_REF,PRODUCTION_PROJECT:e.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF};
 assert.doesNotThrow(()=>assertCatalogueRuntime(runtime,'pricing-on'));
 assert.throws(()=>assertCatalogueRuntime({...runtime,SCHEMA_VERIFIED:'extended'},'pricing-on'));
 const original='FANMIND_CHAT_ADMIN_MEDIA_CATALOGUE_ENABLED=true\nFANMIND_CHAT_ADMIN_MEDIA_VIDEO_ENABLED=true\nFANMIND_SUPPORT_PERSISTENCE_ENABLED=true\n';
 assert.equal(renderCatalogueFlags(original,[],'pricing-on'),original+`${PRICE_FLAG}=true\n`);
 assert.equal(renderCatalogueFlags(original+`${PRICE_FLAG}=true\n`,[],'pricing-off'),original+`${PRICE_FLAG}=false\n`);
 assert.throws(()=>renderCatalogueFlags(original,[`${PRICE_FLAG}=true`],'pricing-on'));
 assert.throws(()=>renderCatalogueFlags(original+`${PRICE_FLAG}=maybe\n`,[],'pricing-on'));
});

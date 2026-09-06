import assert from "node:assert/strict";
import test from "node:test";
import {buildStagingBillingCanonicalAcceptanceSql as build} from "../scripts/operations/staging-billing-canonical-acceptance-sql.mjs";
const input={workspaceId:"58a18c7e-4af0-459d-b44d-7d924ee7ffe9",runId:"123",now:1788710400000};
test("fixture input cannot inject identifiers or replace the fixed rollback script",()=>{
  for(const bad of [{workspaceId:"x';commit;--"},{runId:"123';--"},{runId:""},{now:NaN}]) assert.throws(()=>build({...input,...bad}));
});
test("synthetic CAS proof denies browser roles, proves projection, tests replay and compares the rolled-back workspace",()=>{
  const sql=build(input);
  assert.doesNotMatch(sql,/^commit;/mu);
  assert.match(sql,/set local role anon;[\s\S]*set local role authenticated;/u);
  assert.match(sql,/exception when insufficient_privilege then null/u);
  assert.match(sql,/billing_status='suspended',[\s\S]*workspace_access_mode='archived_readonly'/u);
  assert.match(sql,/billing_status='active' and workspace_access_mode='active' and billing_suspended_at is null and billing_suspended_reason is null/u);
  assert.match(sql,/exception when serialization_failure then null/u);
  assert.match(sql,/duplicate_reconciliation/u);
  assert.match(sql,/rollback;\nbegin;\nset transaction read only;/u);
  assert.match(sql,/is distinct from \(select original from canonical_original_workspace\)/u);
  assert.match(sql,/STAGING_CANONICAL_BILLING_CLEANUP=PASS/u);
  assert.doesNotMatch(sql,/api\.stripe|sk_test_|sk_live_/u);
});

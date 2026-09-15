import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DAILY_PRODUCTION_APPLY_CONFIRMATION,
  DAILY_PRODUCTION_VERIFY_CONFIRMATION,
  evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment,
} from "../src/lib/internalDailyTestWorkspaceProvisioningProductionPolicy.mjs";

const sha = "a".repeat(40);
const ref = "prodref0123456789012";
const base = {
  GITHUB_REF: "refs/heads/main", GITHUB_SHA: sha,
  FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_REVIEWED_COMMIT: sha,
  FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_PRODUCTION_CONFIRM: DAILY_PRODUCTION_VERIFY_CONFIRMATION,
  FANMIND_RUNTIME_ENVIRONMENT: "production", NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
  FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
  NEXT_PUBLIC_SUPABASE_URL: `https://${ref}.supabase.co`,
  FANMIND_TARGET_SUPABASE_PROJECT_REF: ref, FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: ref,
  PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
  FANMIND_PRODUCTION_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
  PGPORT: "5432", PGDATABASE: "postgres", PGUSER: `postgres.${ref}`,
  PGSSLMODE: "verify-full", PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
};

test("Production verify is exact-main, target and TLS bound", () => {
  assert.equal(evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment(base).ok, true);
  for (const mutation of [{GITHUB_REF:"refs/heads/work"},{GITHUB_SHA:"b".repeat(40)},{PGSSLMODE:"require"},{NEXT_PUBLIC_APP_URL:"https://staging.fanmind.ch"},{PGPASSWORD:"secret"}]) {
    assert.equal(evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment({...base,...mutation}).ok, false);
  }
});

test("Production apply requires independent explicit write gates", () => {
  const apply = {...base,
    FANMIND_INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_PRODUCTION_CONFIRM: DAILY_PRODUCTION_APPLY_CONFIRMATION,
    FANMIND_ENABLE_PRODUCTION_WRITES:"true", FANMIND_PRODUCTION_WRITE_ACK:"I_UNDERSTAND_THIS_MUTATES_PRODUCTION",
    FANMIND_DAILY_PRODUCTION_READINESS_DECISION:"APPLY"};
  assert.equal(evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment(apply,{mode:"apply"}).ok,true);
  assert.equal(evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment({...apply,FANMIND_ENABLE_PRODUCTION_WRITES:"false"},{mode:"apply"}).ok,false);
  assert.equal(evaluateInternalDailyTestWorkspaceProvisioningProductionEnvironment({...apply,FANMIND_DAILY_PRODUCTION_READINESS_DECISION:"BLOCK"},{mode:"apply"}).ok,false);
});

test("Production workflow is manual, protected, pinned and has no automatic trigger", async () => {
  const workflow = await readFile(".github/workflows/internal-daily-test-workspace-provisioning-production-control.yml","utf8");
  assert.match(workflow,/workflow_dispatch:/u); assert.doesNotMatch(workflow,/\bschedule:/u);
  assert.match(workflow,/environment: production/u); assert.match(workflow,/fanmind-prod/u);
  assert.match(workflow,/REVIEWED_COMMIT: \$\{\{ inputs\.reviewed_commit \}\}[\s\S]*DISPATCH_COMMIT: \$\{\{ github\.sha \}\}/u);
  assert.match(workflow,/"\$REVIEWED_COMMIT" == "\$DISPATCH_COMMIT"/u);
  assert.match(workflow,/PGSSLMODE: verify-full/u); assert.match(workflow,/chmod 600/u);
  assert.match(workflow,/options: \[verify\]/u);
  assert.match(workflow,/--verify/u);
  assert.match(workflow,/DAILY_PRODUCTION_VERIFY_INPUT=confirmation_invalid/u);
  assert.match(workflow,/DAILY_PRODUCTION_VERIFY_INPUT=commit_invalid/u);
  assert.match(workflow,/needs: validate/u);
  assert.doesNotMatch(workflow,/control:\n\s+if:/u);
  assert.doesNotMatch(workflow,/FANMIND_PRODUCTION_WRITE_ACK/u);
  assert.doesNotMatch(workflow,/--apply/u);
});

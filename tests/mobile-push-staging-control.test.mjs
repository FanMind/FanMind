import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MOBILE_PUSH_DELIVERY_LEDGER_MIGRATION_CONFIRMATION,
  MOBILE_PUSH_DELIVERY_LEDGER_SCHEMA_CONFIRMATION,
  MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRMATION,
  MOBILE_PUSH_STAGING_MIGRATION_CONFIRMATION,
  MOBILE_PUSH_STAGING_RESOURCE_CONFIRMATION,
  MOBILE_PUSH_STAGING_SCHEMA_CONFIRMATION,
  evaluateMobilePushStagingControlEnvironment,
} from "../src/lib/mobilePushStagingControlPolicy.mjs";
import {
  EXPECTED_MIGRATION_SHA256,
  POSTFLIGHT_SQL,
  evaluateMobilePushMigrationSql,
} from "../scripts/operations/mobile-push-registration-migration-runner.mjs";
import {
  browserProbeSql,
  buildSyntheticMobilePushMaterial,
  resourceSql,
  roleCapabilitySql,
  serviceRoleCrudSql,
} from "../scripts/operations/mobile-push-staging-acceptance.mjs";

const REVIEWED_COMMIT = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";
const SYNTHETIC = Object.freeze({
  workspaceId: "11111111-1111-4111-8111-111111111111",
  ownerUserId: "22222222-2222-4222-8222-222222222222",
  memberUserId: "33333333-3333-4333-8333-333333333333",
  easProjectId: "44444444-4444-4444-8444-444444444444",
  deviceId: "55555555-5555-4555-8555-555555555555",
});

function baseEnvironment() {
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: REVIEWED_COMMIT,
    FANMIND_MOBILE_PUSH_REVIEWED_COMMIT: REVIEWED_COMMIT,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_MOBILE_PUSH_STAGING_RESOURCE_CONFIRM:
      MOBILE_PUSH_STAGING_RESOURCE_CONFIRMATION,
    FANMIND_MOBILE_PUSH_STAGING_SCHEMA_CONFIRM:
      MOBILE_PUSH_STAGING_SCHEMA_CONFIRMATION,
    FANMIND_MOBILE_PUSH_STAGING_WORKSPACE_ID: SYNTHETIC.workspaceId,
    FANMIND_MOBILE_PUSH_STAGING_OWNER_USER_ID: SYNTHETIC.ownerUserId,
    FANMIND_MOBILE_PUSH_STAGING_MEMBER_USER_ID: SYNTHETIC.memberUserId,
    FANMIND_MOBILE_PUSH_STAGING_EAS_PROJECT_ID: SYNTHETIC.easProjectId,
    FANMIND_MOBILE_PUSH_STAGING_DEVICE_ID: SYNTHETIC.deviceId,
    PGHOST: "staging-db.fanmind.invalid",
    FANMIND_TARGET_DB_HOST: "staging-db.fanmind.invalid",
    FANMIND_PRODUCTION_DB_HOST: "production-db.fanmind.invalid",
    PGPORT: "5432",
    PGDATABASE: "fanmind_staging",
    PGUSER: "fanmind_staging_control",
  };
}

function writeEnvironment(confirmationKey, confirmation) {
  return {
    ...baseEnvironment(),
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    [confirmationKey]: confirmation,
  };
}

test("read-only push resource and schema checks accept only bound Staging", () => {
  const resource = evaluateMobilePushStagingControlEnvironment(
    baseEnvironment(),
    { mode: "resource" },
  );
  assert.equal(resource.ok, true);
  assert.equal(resource.writeEnabled, false);
  assert.equal(resource.syntheticIdentifiers.ok, true);

  const schema = evaluateMobilePushStagingControlEnvironment(
    baseEnvironment(),
    { mode: "schema" },
  );
  assert.equal(schema.ok, true);
  assert.equal(schema.writeEnabled, false);
});

test("migration and acceptance require separate explicit write confirmations", () => {
  const migration = evaluateMobilePushStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_MOBILE_PUSH_STAGING_MIGRATION_CONFIRM",
      MOBILE_PUSH_STAGING_MIGRATION_CONFIRMATION,
    ),
    { mode: "migration" },
  );
  assert.equal(migration.ok, true);
  assert.equal(migration.writeEnabled, true);

  const acceptance = evaluateMobilePushStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRM",
      MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRMATION,
    ),
    { mode: "acceptance" },
  );
  assert.equal(acceptance.ok, true);
  assert.equal(acceptance.writeEnabled, true);

  const crossed = evaluateMobilePushStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_MOBILE_PUSH_STAGING_ACCEPTANCE_CONFIRM",
      MOBILE_PUSH_STAGING_MIGRATION_CONFIRMATION,
    ),
    { mode: "acceptance" },
  );
  assert.equal(crossed.ok, false);
  assert.ok(crossed.errors.includes("confirmation"));
});

test("delivery ledger verification and migration have separate confirmations", () => {
  const schema = evaluateMobilePushStagingControlEnvironment(
    {
      ...baseEnvironment(),
      FANMIND_MOBILE_PUSH_DELIVERY_LEDGER_SCHEMA_CONFIRM:
        MOBILE_PUSH_DELIVERY_LEDGER_SCHEMA_CONFIRMATION,
    },
    { mode: "ledger_schema" },
  );
  assert.equal(schema.ok, true);
  assert.equal(schema.writeEnabled, false);

  const migration = evaluateMobilePushStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_MOBILE_PUSH_DELIVERY_LEDGER_MIGRATION_CONFIRM",
      MOBILE_PUSH_DELIVERY_LEDGER_MIGRATION_CONFIRMATION,
    ),
    { mode: "ledger_migration" },
  );
  assert.equal(migration.ok, true);
  assert.equal(migration.writeEnabled, true);

  const crossed = evaluateMobilePushStagingControlEnvironment(
    writeEnvironment(
      "FANMIND_MOBILE_PUSH_DELIVERY_LEDGER_MIGRATION_CONFIRM",
      MOBILE_PUSH_DELIVERY_LEDGER_SCHEMA_CONFIRMATION,
    ),
    { mode: "ledger_migration" },
  );
  assert.equal(crossed.ok, false);
  assert.ok(crossed.errors.includes("confirmation"));
});

test("push staging control fails closed against every Production target", () => {
  const mutations = [
    {
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
    },
    {
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
      FANMIND_TARGET_SUPABASE_PROJECT_REF: PRODUCTION_REF,
    },
    {
      PGHOST: "production-db.fanmind.invalid",
      FANMIND_TARGET_DB_HOST: "production-db.fanmind.invalid",
    },
    { FANMIND_PRODUCTION_DB_HOST: "" },
  ];
  for (const mutation of mutations) {
    const result = evaluateMobilePushStagingControlEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "resource" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("push staging control requires main, exact reviewed commit and direct libpq target", () => {
  for (const mutation of [
    { GITHUB_REF: "refs/heads/agent/mobile-push" },
    { FANMIND_MOBILE_PUSH_REVIEWED_COMMIT: "b".repeat(40) },
    { GITHUB_SHA: "invalid" },
    { PGHOSTADDR: "127.0.0.1" },
    { PGSERVICE: "production" },
  ]) {
    const result = evaluateMobilePushStagingControlEnvironment(
      { ...baseEnvironment(), ...mutation },
      { mode: "resource" },
    );
    assert.equal(result.ok, false, JSON.stringify(mutation));
  }
});

test("synthetic owner, member, project and device identities are distinct", () => {
  const duplicate = evaluateMobilePushStagingControlEnvironment(
    {
      ...baseEnvironment(),
      FANMIND_MOBILE_PUSH_STAGING_MEMBER_USER_ID: SYNTHETIC.ownerUserId,
    },
    { mode: "resource" },
  );
  assert.equal(duplicate.ok, false);
  assert.ok(duplicate.errors.includes("synthetic_identifiers"));
});

test("synthetic device material is deterministic, distinct and never an Expo token", () => {
  const owner = buildSyntheticMobilePushMaterial(SYNTHETIC.deviceId, "owner");
  const repeated = buildSyntheticMobilePushMaterial(
    SYNTHETIC.deviceId,
    "owner",
  );
  const member = buildSyntheticMobilePushMaterial(
    SYNTHETIC.deviceId,
    "member",
  );
  assert.deepEqual(owner, repeated);
  assert.notEqual(owner.tokenHash, member.tokenHash);
  assert.match(owner.tokenHash, /^[0-9a-f]{64}$/u);
  assert.match(
    owner.tokenCiphertext,
    /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/u,
  );
  assert.doesNotMatch(owner.tokenCiphertext, /ExpoPushToken/iu);
});

test("pinned push migration validates checksum, RLS and delivery-free contract", async () => {
  const sql = await readFile(
    new URL(
      "../supabase/migrations/20260729120000_mobile_push_registrations.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const result = evaluateMobilePushMigrationSql(sql);
  assert.equal(result.digest, EXPECTED_MIGRATION_SHA256);
  assert.match(POSTFLIGHT_SQL, /relrowsecurity/u);
  assert.match(POSTFLIGHT_SQL, /browser_table_privilege_invalid/u);
  assert.match(POSTFLIGHT_SQL, /service_role_privilege_invalid/u);
  assert.match(POSTFLIGHT_SQL, /trigger_contract_invalid/u);
  assert.throws(
    () => evaluateMobilePushMigrationSql(`${sql}\n-- drift`),
    /migration_checksum_mismatch/u,
  );
});

test("acceptance SQL denies browsers and rolls service-role writes back", () => {
  const ownerMaterial = buildSyntheticMobilePushMaterial(
    SYNTHETIC.deviceId,
    "owner",
  );
  const memberMaterial = buildSyntheticMobilePushMaterial(
    SYNTHETIC.deviceId,
    "member",
  );
  const resources = resourceSql(SYNTHETIC);
  const browser = browserProbeSql({
    role: "authenticated",
    userId: SYNTHETIC.ownerUserId,
    operation: "insert",
    identifiers: SYNTHETIC,
    material: ownerMaterial,
  });
  const service = serviceRoleCrudSql(
    SYNTHETIC,
    ownerMaterial,
    memberMaterial,
  );
  assert.match(resources, /set transaction read only/iu);
  assert.match(resources, /billing_status is distinct from 'demo_free'/u);
  assert.match(resources, /fanmind_demo/iu);
  assert.match(browser, /set local role authenticated/u);
  assert.match(roleCapabilitySql("service_role"), /set local role service_role/u);
  assert.match(service, /set local role service_role/u);
  assert.match(service, /MOBILE_PUSH_STAGING_ROLLBACK_CLEANUP=PASS/u);
  assert.match(service, /rollback;/u);
  for (const sql of [resources, browser, service]) {
    assert.doesNotMatch(
      sql,
      /expo\.dev\/--\/api\/v2\/push\/send|\bfetch\b|\bhttp_request\b/iu,
    );
  }
});

test("manual workflows are main, reviewed-commit and protected-Staging bound", async () => {
  const paths = [
    "mobile-push-staging-resource-readiness.yml",
    "mobile-push-staging-migration.yml",
    "mobile-push-staging-acceptance.yml",
    "mobile-push-delivery-ledger-staging.yml",
  ];
  const workflows = await Promise.all(
    paths.map((path) =>
      readFile(new URL(`../.github/workflows/${path}`, import.meta.url), "utf8"),
    ),
  );
  for (const workflow of workflows) {
    assert.match(workflow, /workflow_dispatch:/u);
    assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
    assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
    assert.match(workflow, /environment: staging/u);
    assert.match(workflow, /FANMIND_PRODUCTION_SUPABASE_PROJECT_REF/u);
    assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST/u);
    assert.match(workflow, /FANMIND_PRODUCTION_API_ORIGIN/u);
    assert.match(workflow, /PGPASSFILE:.*fanmind-mobile-push/iu);
    assert.doesNotMatch(workflow, /\bschedule:/u);
  }

  assert.match(workflows[0], /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.doesNotMatch(workflows[0], /db:mobile-push-registrations:apply/u);
  assert.match(workflows[1], /db:mobile-push-registrations:apply/u);
  assert.match(workflows[2], /db:mobile-push-registrations:verify/u);
  assert.match(workflows[2], /mobile:push:staging:run/u);
  assert.match(workflows[3], /db:mobile-push-delivery-ledger:verify/u);
  assert.match(workflows[3], /db:mobile-push-delivery-ledger:apply/u);
  assert.doesNotMatch(
    workflows.join("\n"),
    /eas (?:build|submit|update)|ExpoPushToken|push\/send/iu,
  );
});

test("normal deploy cannot apply or accept the mobile push migration", async () => {
  const [deploy, packageJson] = await Promise.all([
    readFile(
      new URL("../scripts/operations/deploy-isolated-release.sh", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(
    deploy,
    /mobile-push-registration-migration-runner|mobile:push:staging|20260729120000_mobile_push_registrations/iu,
  );
  assert.match(packageJson, /db:mobile-push-registrations:check/u);
  assert.match(packageJson, /mobile:push:staging:preflight/u);
});

test("push control scripts redact failures and contain no delivery client", async () => {
  const scripts = await Promise.all(
    [
      "mobile-push-registration-migration-runner.mjs",
      "mobile-push-staging-acceptance.mjs",
    ].map((path) =>
      readFile(
        new URL(`../scripts/operations/${path}`, import.meta.url),
        "utf8",
      ),
    ),
  );
  for (const script of scripts) {
    assert.match(script, /SECRETS_WURDEN_NICHT_AUSGEGEBEN=true/u);
    assert.doesNotMatch(script, /console\.(?:log|error)\([^\n]*(?:stderr|tokenCiphertext|tokenHash)/u);
    assert.doesNotMatch(
      script,
      /expo\.dev\/--\/api\/v2\/push\/send|fetch\(|getExpoPushTokenAsync/iu,
    );
  }
});

test("canonical Mobile, source and security readers expose the same inactive boundary", async () => {
  const readers = await Promise.all(
    [
      "../AGENTS.md",
      "../README.md",
      "../docs/SOURCE_OF_TRUTH.md",
      "../apps/mobile/README.md",
      "../docs/mobile/ARCHITECTURE.md",
      "../docs/mobile/BETA_RELEASE.md",
      "../docs/mobile/PUSH_REGISTRATION.md",
      "../docs/SECURITY_RLS_SECRETS_CHECK.md",
      "../docs/database/fanmind_current_schema.md",
      "../docs/operations/MOBILE_PUSH_STAGING_CONTROL.md",
    ].map((path) => readFile(new URL(path, import.meta.url), "utf8")),
  );
  for (const reader of readers) {
    assert.match(reader, /Staging/iu);
    assert.match(reader, /(?:rollback|zurückgerollt|Rollback)/iu);
    assert.match(reader, /(?:Delivery|Zustellung|Versand)/iu);
  }
  const runbook = readers.at(-1);
  assert.match(runbook, /1a22d71a09427bbf0093dfc12f6fbcaf76256d61728048390b1299c526bfd0d7/u);
  assert.match(runbook, /verify-mobile-push-staging-resources/u);
  assert.match(runbook, /apply-mobile-push-registration-migration/u);
  assert.match(runbook, /run-mobile-push-staging-acceptance/u);
  assert.match(runbook, /normalen Web-Deploy nicht angewendet/iu);
});

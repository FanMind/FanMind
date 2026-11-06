import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { X509Certificate } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  STAGING_DATABASE_ROLLOUT_STATE_CONFIRMATION,
  deriveStagingDatabaseRolloutActions,
  evaluateStagingDatabaseRolloutStateEnvironment,
} from "../src/lib/stagingDatabaseRolloutStatePolicy.mjs";
import {
  AI_TIER_STRIPE_LEDGER_STATE_SQL,
  AI_TIER_STATE_SQL,
  LEDGER_STATE_SQL,
  META_CATCHUP_STATE_SQL,
  META_CONTINUATION_STATE_SQL,
  MOBILE_PUSH_STATE_SQL,
  STRIPE_BILLING_LEDGER_STATE_SQL,
  TRIGGER_HARDENING_STATE_SQL,
  WHATSAPP_CLOUD_INBOUND_STATE_SQL,
  WORKSPACE_MEMBER_BOUNDARY_STATE_SQL,
  exactAiTierStripeLedgerPostflight,
  exactControlledObjectState,
  exactStripeBillingLedgerPostflight,
  ledgerManagedMetaMigrations,
  ledgerSql,
  psqlFailureCategory,
} from "../scripts/operations/staging-database-rollout-state.mjs";

const repositoryRoot = resolve(import.meta.dirname, "..");
const workflow = readFileSync(
  resolve(
    repositoryRoot,
    ".github/workflows/staging-database-rollout-state.yml",
  ),
  "utf8",
);
const runner = readFileSync(
  resolve(
    repositoryRoot,
    "scripts/operations/staging-database-rollout-state.mjs",
  ),
  "utf8",
);
const serviceRolePrivilegeRepair = readFileSync(
  resolve(
    repositoryRoot,
    "supabase/migrations/20260812162000_restrict_service_role_table_privileges.sql",
  ),
  "utf8",
);
const controlledStagingDatabaseWorkflowPaths = [
  "ai-tier-stripe-event-ledger-staging.yml",
  "internal-daily-test-workspace-provisioning-staging-apply.yml",
  "internal-daily-test-workspace-provisioning-staging-verify.yml",
  "meta-catchup-queue-staging-apply.yml",
  "meta-catchup-queue-staging-verify.yml",
  "meta-conversation-continuation-staging-apply.yml",
  "meta-conversation-continuation-staging-verify.yml",
  "meta-content-staging-migration.yml",
  "meta-content-staging-resource-readiness.yml",
  "mobile-push-staging-acceptance.yml",
  "mobile-push-staging-migration.yml",
  "mobile-push-staging-resource-readiness.yml",
  "staging-database-rollout-state.yml",
  "stripe-billing-event-ledger-staging.yml",
  "trigger-function-hardening-staging-apply.yml",
  "trigger-function-hardening-staging-verify.yml",
  "workspace-member-data-boundary-staging-apply.yml",
  "workspace-member-data-boundary-staging-verify.yml",
  "workspace-processing-staging-acceptance.yml",
  "whatsapp-cloud-inbound-staging-apply.yml",
  "whatsapp-cloud-inbound-staging-verify.yml",
];
const tlsStagingDatabaseWorkflowPaths = [
  "ai-tier-stripe-event-ledger-staging.yml",
  "internal-daily-test-workspace-provisioning-staging-apply.yml",
  "internal-daily-test-workspace-provisioning-staging-verify.yml",
  "meta-catchup-queue-staging-apply.yml",
  "meta-catchup-queue-staging-verify.yml",
  "meta-conversation-continuation-staging-apply.yml",
  "meta-conversation-continuation-staging-verify.yml",
  "meta-content-staging-migration.yml",
  "meta-content-staging-resource-readiness.yml",
  "staging-database-rollout-state.yml",
  "stripe-billing-event-ledger-staging.yml",
  "trigger-function-hardening-staging-apply.yml",
  "trigger-function-hardening-staging-verify.yml",
  "workspace-member-data-boundary-staging-apply.yml",
  "workspace-member-data-boundary-staging-verify.yml",
  "workspace-processing-staging-acceptance.yml",
  "whatsapp-cloud-inbound-staging-apply.yml",
  "whatsapp-cloud-inbound-staging-verify.yml",
];

function validEnvironment() {
  const stagingRef = "stagingprojectref1234";
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: "a".repeat(40),
    FANMIND_STAGING_DATABASE_ROLLOUT_REVIEWED_COMMIT: "a".repeat(40),
    FANMIND_STAGING_DATABASE_ROLLOUT_STATE_CONFIRM:
      STAGING_DATABASE_ROLLOUT_STATE_CONFIRMATION,
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.ch",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: `https://${stagingRef}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF: stagingRef,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionproject12",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: `postgres.${stagingRef}`,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
  };
}

test("environment is exact-main, protected-target and strongest-TLS bound", () => {
  assert.equal(
    evaluateStagingDatabaseRolloutStateEnvironment(validEnvironment()).ok,
    true,
  );

  for (const mutation of [
    { GITHUB_REF: "refs/heads/feature" },
    { FANMIND_STAGING_DATABASE_ROLLOUT_REVIEWED_COMMIT: "b".repeat(40) },
    { FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true" },
    { FANMIND_NON_PRODUCTION_WRITE_ACK: "unexpected" },
    { PGUSER: "postgres.productionproject12" },
    { PGPORT: "6543" },
    { PGSSLMODE: "require" },
    { DATABASE_URL: "postgresql://redirect.invalid/postgres" },
  ]) {
    assert.equal(
      evaluateStagingDatabaseRolloutStateEnvironment({
        ...validEnvironment(),
        ...mutation,
      }).ok,
      false,
    );
  }
});

test("action derivation prevents every ledger and object double-apply", () => {
  assert.deepEqual(
    deriveStagingDatabaseRolloutActions({
      ledger: {
        aiTier: true,
        mobilePush: true,
        metaFoundation: false,
        metaHistory: false,
        metaContinuation: false,
        workspaceMemberPrerequisite: true,
        workspaceMemberInGenericLedger: false,
        whatsappCloudInboundInGenericLedger: false,
      },
      objects: {
        workspaceMemberBoundary: "absent",
        whatsappCloudInbound: "absent",
        aiTier: "current",
        mobilePush: "current",
        metaContent: "absent",
        metaCatchup: "absent",
        metaContinuation: "absent",
        triggerHardening: "unavailable",
      },
    }),
    {
      actions: {
        workspaceMemberBoundary: "apply",
        whatsappCloudInbound: "skip",
        aiTier: "verify",
        aiTierStripeLedger: "apply",
        stripeBillingLedger: "apply",
        mobilePush: "verify",
        metaContent: "apply",
        metaCatchup: "apply",
        metaContinuation: "apply",
        triggerHardening: "skip",
      },
      blocked: false,
    },
  );

  assert.deepEqual(
    deriveStagingDatabaseRolloutActions({
      ledger: {
        aiTier: false,
        mobilePush: false,
        metaFoundation: false,
        metaHistory: false,
        metaContinuation: false,
        workspaceMemberPrerequisite: true,
        workspaceMemberInGenericLedger: false,
        whatsappCloudInboundInGenericLedger: false,
      },
      objects: {
        workspaceMemberBoundary: "current",
        whatsappCloudInbound: "current",
        aiTier: "current",
        mobilePush: "current",
        metaContent: "current",
        metaCatchup: "current",
        metaContinuation: "current",
        triggerHardening: "current",
      },
    }).actions,
    {
      workspaceMemberBoundary: "verify",
      whatsappCloudInbound: "verify",
      aiTier: "skip",
      aiTierStripeLedger: "apply",
      stripeBillingLedger: "apply",
      mobilePush: "skip",
      metaContent: "skip",
      metaCatchup: "verify",
      metaContinuation: "skip",
      triggerHardening: "verify",
    },
  );

  assert.equal(
    deriveStagingDatabaseRolloutActions({
      ledger: {
        aiTier: true,
        mobilePush: true,
        metaFoundation: true,
        metaHistory: true,
        metaContinuation: false,
        workspaceMemberPrerequisite: true,
        workspaceMemberInGenericLedger: false,
        whatsappCloudInboundInGenericLedger: false,
      },
      objects: {
        workspaceMemberBoundary: "current",
        whatsappCloudInbound: "absent",
        aiTier: "current",
        mobilePush: "current",
        metaContent: "foundation",
        metaCatchup: "current",
        metaContinuation: "current",
        triggerHardening: "unavailable",
      },
    }).actions.metaContent,
    "apply",
  );
});

test("partial ledgers, missing applied objects and invalid metadata block", () => {
  for (const scenario of [
    {
      ledger: {
        aiTier: true,
        mobilePush: false,
        metaFoundation: false,
        metaHistory: false,
        metaContinuation: false,
        workspaceMemberPrerequisite: true,
        workspaceMemberInGenericLedger: false,
        whatsappCloudInboundInGenericLedger: false,
      },
      objects: {
        workspaceMemberBoundary: "absent",
        whatsappCloudInbound: "absent",
        aiTier: "absent",
        mobilePush: "absent",
        metaContent: "absent",
        metaCatchup: "absent",
        metaContinuation: "absent",
        triggerHardening: "unavailable",
      },
    },
    {
      ledger: {
        aiTier: true,
        mobilePush: true,
        metaFoundation: true,
        metaHistory: false,
        metaContinuation: false,
        workspaceMemberPrerequisite: true,
        workspaceMemberInGenericLedger: false,
        whatsappCloudInboundInGenericLedger: false,
      },
      objects: {
        workspaceMemberBoundary: "invalid",
        whatsappCloudInbound: "invalid",
        aiTier: "current",
        mobilePush: "current",
        metaContent: "invalid",
        metaCatchup: "current",
        metaContinuation: "invalid",
        triggerHardening: "invalid",
      },
    },
  ]) {
    assert.equal(deriveStagingDatabaseRolloutActions(scenario).blocked, true);
  }
});

test("conversation continuation combines its exact ledger timestamp with object state", () => {
  for (const [ledgerApplied, objectState, expected] of [
    [false, "absent", "apply"],
    [false, "current", "skip"],
    [true, "current", "verify"],
    [true, "absent", "block"],
    [false, "invalid", "block"],
  ]) {
    const result = deriveStagingDatabaseRolloutActions({
      ledger: { metaContinuation: ledgerApplied },
      objects: { metaContinuation: objectState },
    });
    assert.equal(result.actions.metaContinuation, expected);
  }
});

test("AI and general event ledgers expose only absent, complete or blocking partial states", () => {
  assert.match(
    AI_TIER_STRIPE_LEDGER_STATE_SQL,
    /object_count = 0 and function_count = 0 then 'absent'[\s\S]*object_count = 6 and function_count = 2 then 'present'[\s\S]*else 'invalid'/u,
  );
  assert.match(
    STRIPE_BILLING_LEDGER_STATE_SQL,
    /case object_count when 0 then 'absent' when 10 then 'present' else 'invalid'/u,
  );
  const current = deriveStagingDatabaseRolloutActions({
    objects: {
      aiTier: "current",
      aiTierStripeLedger: "current",
      stripeBillingLedger: "current",
    },
  });
  assert.equal(current.actions.aiTierStripeLedger, "verify");
  assert.equal(current.actions.stripeBillingLedger, "verify");
  const partial = deriveStagingDatabaseRolloutActions({
    objects: {
      aiTier: "current",
      aiTierStripeLedger: "invalid",
      stripeBillingLedger: "invalid",
    },
  });
  assert.equal(partial.actions.aiTierStripeLedger, "block");
  assert.equal(partial.actions.stripeBillingLedger, "block");
  assert.equal(partial.blocked, true);
});

test("ledger rollout probes reject ambiguous state and postflight transcripts", () => {
  const marker = "STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT";
  assert.equal(
    exactControlledObjectState(`${marker}=absent\n`, marker),
    "absent",
  );
  assert.equal(
    exactControlledObjectState(`${marker}=present\n`, marker),
    "present",
  );
  assert.equal(
    exactControlledObjectState(
      `${marker}=absent\n${marker}=present\n`,
      marker,
    ),
    "invalid",
  );
  assert.equal(
    exactAiTierStripeLedgerPostflight(
      "AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS\n",
    ),
    true,
  );
  assert.equal(
    exactAiTierStripeLedgerPostflight(
      "AI_TIER_STRIPE_EVENT_LEDGER_POSTFLIGHT=PASS\nspoofed\n",
    ),
    false,
  );
  assert.equal(
    exactStripeBillingLedgerPostflight(
      [
        "STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS",
        "STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING=0",
        "STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED=0",
      ].join("\n"),
    ),
    true,
  );
  assert.equal(
    exactStripeBillingLedgerPostflight(
      [
        "STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS",
        "STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING=0",
      ].join("\n"),
    ),
    false,
  );
});

test("member boundary requires the exact prerequisite and absence from generic ledger", () => {
  for (const ledgerBoundary of [
    {
      workspaceMemberPrerequisite: false,
      workspaceMemberInGenericLedger: false,
    },
    {
      workspaceMemberPrerequisite: true,
      workspaceMemberInGenericLedger: true,
    },
  ]) {
    const result = deriveStagingDatabaseRolloutActions({
      ledger: {
        aiTier: false,
        mobilePush: false,
        metaFoundation: false,
        metaHistory: false,
        metaContinuation: false,
        whatsappCloudInboundInGenericLedger: false,
        ...ledgerBoundary,
      },
      objects: {
        workspaceMemberBoundary: "absent",
        whatsappCloudInbound: "absent",
        aiTier: "absent",
        mobilePush: "absent",
        metaContent: "absent",
        metaCatchup: "absent",
        metaContinuation: "absent",
        triggerHardening: "unavailable",
      },
    });
    assert.equal(result.actions.workspaceMemberBoundary, "block");
    assert.equal(result.blocked, true);
  }
});

test("WhatsApp rollout is dormant until the Member boundary is current and blocks drift", () => {
  const base = {
    aiTier: false,
    mobilePush: false,
    metaFoundation: false,
    metaHistory: false,
    metaContinuation: false,
    workspaceMemberPrerequisite: true,
    workspaceMemberInGenericLedger: false,
    whatsappCloudInboundInGenericLedger: false,
  };
  const otherObjects = {
    aiTier: "absent",
    mobilePush: "absent",
    metaContent: "absent",
    metaCatchup: "absent",
    metaContinuation: "absent",
    triggerHardening: "unavailable",
  };
  for (const [memberState, whatsappState, expected] of [
    ["absent", "absent", "skip"],
    ["current", "absent", "apply"],
    ["current", "current", "verify"],
    ["current", "invalid", "block"],
    ["absent", "current", "block"],
  ]) {
    const result = deriveStagingDatabaseRolloutActions({
      ledger: base,
      objects: {
        ...otherObjects,
        workspaceMemberBoundary: memberState,
        whatsappCloudInbound: whatsappState,
      },
    });
    assert.equal(result.actions.whatsappCloudInbound, expected);
  }
  assert.equal(
    deriveStagingDatabaseRolloutActions({
      ledger: { ...base, whatsappCloudInboundInGenericLedger: true },
      objects: {
        ...otherObjects,
        workspaceMemberBoundary: "current",
        whatsappCloudInbound: "current",
      },
    }).actions.whatsappCloudInbound,
    "block",
  );
});

test("ledger and object probes are transactionally read-only and exact", () => {
  const ledger = ledgerSql();
  for (const migrationId of [
    "20260727090000_workspace_ai_tier_entitlements",
    "20260729120000_mobile_push_registrations",
    "20260803120000_meta_content_intelligence_foundation",
    "20260803210000_preserve_incremental_conversation_history",
    "20260811220000_meta_conversation_sync_continuation",
  ]) {
    const migrationName = migrationId.replace(/^\d{14}_/u, "");
    assert.match(ledger, new RegExp(migrationId, "u"));
    assert.match(ledger, new RegExp(migrationName, "u"));
  }
  assert.doesNotMatch(
    ledger,
    /20260811230000_meta_conversation_catchup_queue/u,
  );
  assert.match(ledger, /where version = '[0-9]{14}'[\s\S]*or name in/iu);
  assert.match(
    ledger,
    /where version = '20260809141141'\s+and name = 'workspace_server_owned_columns_controlled'/u,
  );
  assert.match(
    ledger,
    /where version = '20260816120000'[\s\S]*workspace_member_data_boundary[\s\S]*= 0 then '0' else '1'/u,
  );
  assert.match(
    ledger,
    /where version = '20260817230000'[\s\S]*whatsapp_cloud_inbound_foundation[\s\S]*= 0 then '0' else '1'/u,
  );
  assert.match(
    WORKSPACE_MEMBER_BOUNDARY_STATE_SQL,
    /function_count = 0 and policy_count = 0[\s\S]*function_count = 3 and policy_count = 42/u,
  );
  assert.match(
    WHATSAPP_CLOUD_INBOUND_STATE_SQL,
    /object_count = 0 and column_count = 0 and constraint_count = 0[\s\S]*policy_count = 0 and function_name_count = 0[\s\S]*legacy_index_count = 0 then 'absent'/u,
  );
  assert.match(
    WHATSAPP_CLOUD_INBOUND_STATE_SQL,
    /object_count = 11 and column_count = 3 and constraint_count = 2[\s\S]*policy_count = 2 and function_name_count = 4[\s\S]*legacy_index_count = 0 then 'present'/u,
  );
  for (const sql of [
    LEDGER_STATE_SQL,
    ledger,
    AI_TIER_STATE_SQL,
    AI_TIER_STRIPE_LEDGER_STATE_SQL,
    META_CATCHUP_STATE_SQL,
    META_CONTINUATION_STATE_SQL,
    MOBILE_PUSH_STATE_SQL,
    STRIPE_BILLING_LEDGER_STATE_SQL,
    TRIGGER_HARDENING_STATE_SQL,
    WORKSPACE_MEMBER_BOUNDARY_STATE_SQL,
    WHATSAPP_CLOUD_INBOUND_STATE_SQL,
  ]) {
    assert.match(sql, /begin;[\s\S]*set transaction read only;[\s\S]*rollback;/u);
    assert.doesNotMatch(
      sql,
      /\b(?:insert|update|delete|alter|create|drop|truncate|grant|revoke)\b/iu,
    );
  }
});

test("database failures are reduced to stable non-secret diagnostics", () => {
  for (const [stderr, expected] of [
    ["FATAL: Tenant or user not found", "tenant_or_user_not_found"],
    [
      "FATAL: password authentication failed for user private-user",
      "password_authentication_failed",
    ],
    ["could not translate host name private-host", "dns_resolution_failed"],
    [
      "ERROR:  42501: permission denied for schema private-schema",
      "permission_denied",
    ],
    ["ERROR:  42P01: relation private-table does not exist", "object_absent"],
    ["ERROR:  XX999: raw-private-database-error", "sqlstate_xx999"],
  ]) {
    assert.equal(psqlFailureCategory({ status: 2, stderr }), expected);
  }
  assert.equal(
    psqlFailureCategory({
      error: Object.assign(new Error("missing"), { code: "ENOENT" }),
    }),
    "client_unavailable",
  );
});

test("service-role privilege repair preserves CRUD and removes unsafe table capabilities", () => {
  assert.match(serviceRolePrivilegeRepair, /^begin;[\s\S]*commit;\s*$/u);
  for (const table of [
    "workspace_ai_tier_entitlements",
    "mobile_push_registrations",
  ]) {
    assert.match(
      serviceRolePrivilegeRepair,
      new RegExp(
        `to_regclass\\('public\\.${table}'\\)[\\s\\S]*revoke all on table public\\.${table}[\\s\\S]*from service_role;[\\s\\S]*grant select, insert, update, delete[\\s\\S]*on table public\\.${table}[\\s\\S]*to service_role;`,
        "u",
      ),
    );
  }
  assert.match(serviceRolePrivilegeRepair, /'TRUNCATE'/u);
  assert.match(serviceRolePrivilegeRepair, /'REFERENCES'/u);
  assert.match(serviceRolePrivilegeRepair, /'TRIGGER'/u);
  assert.doesNotMatch(
    serviceRolePrivilegeRepair,
    /\b(?:insert\s+into|update\s+public\.|delete\s+from|truncate\s+table|drop\s+table)\b/iu,
  );
});

test("three-step Meta manifest keeps the controlled idempotency step out of the ledger", () => {
  const combinedManifest = [
    {
      id: "20260803120000_meta_content_intelligence_foundation",
      stage: "foundation",
    },
    {
      id: "20260803210000_preserve_incremental_conversation_history",
      stage: "foundation",
    },
    {
      id: "20260806160000_meta_webhook_external_id_idempotency",
      stage: "idempotency",
    },
  ];
  assert.deepEqual(
    ledgerManagedMetaMigrations(combinedManifest).map(
      (migration) => migration.id,
    ),
    combinedManifest.slice(0, 2).map((migration) => migration.id),
  );
  const sql = ledgerSql({ metaMigrations: combinedManifest });
  assert.match(sql, /20260803120000/u);
  assert.match(sql, /20260803210000/u);
  assert.doesNotMatch(sql, /20260806160000/u);
  assert.equal([...sql.matchAll(/where version =/gu)].length, 8);

  assert.equal(
    deriveStagingDatabaseRolloutActions({
      ledger: {
        aiTier: true,
        mobilePush: true,
        metaFoundation: false,
        metaHistory: false,
        metaContinuation: false,
        workspaceMemberPrerequisite: true,
        workspaceMemberInGenericLedger: false,
        whatsappCloudInboundInGenericLedger: false,
      },
      objects: {
        workspaceMemberBoundary: "current",
        whatsappCloudInbound: "absent",
        aiTier: "current",
        mobilePush: "current",
        metaContent: "foundation",
        metaCatchup: "current",
        metaContinuation: "current",
        triggerHardening: "unavailable",
      },
    }).actions.metaContent,
    "block",
  );
});

test("manual workflow is commit-exact, protected Staging and write-disabled", () => {
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(workflow, /PGUSER:.*postgres\.\{0\}/u);
  assert.match(workflow, /PGPORT: '5432'/u);
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.match(workflow, /permissions:\s+contents: read/u);
  assert.doesNotMatch(workflow, /supabase db push|:apply|--apply/iu);
  assert.doesNotMatch(runner, /supabase\s+db\s+push/iu);
});

test("controlled Staging database workflows derive the non-secret Production host anchor", () => {
  const expected =
    "FANMIND_PRODUCTION_DB_HOST: ${{ format('db.{0}.supabase.co', vars.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF) }}";
  for (const path of controlledStagingDatabaseWorkflowPaths) {
    const source = readFileSync(
      resolve(repositoryRoot, ".github/workflows", path),
      "utf8",
    );
    assert.ok(source.includes(expected), path);
    assert.doesNotMatch(
      source,
      /secrets\.FANMIND_PRODUCTION_DB_HOST/u,
      path,
    );
  }
});

test("controlled Staging database workflows pin the reviewed Supabase root CA", () => {
  const certificatePath = resolve(
    repositoryRoot,
    "config/certificates/supabase-root-2021-ca.crt",
  );
  const certificate = new X509Certificate(readFileSync(certificatePath));
  assert.match(certificate.subject, /CN=Supabase Root 2021 CA/u);
  assert.match(certificate.issuer, /CN=Supabase Root 2021 CA/u);
  assert.equal(certificate.ca, true);
  assert.equal(
    certificate.fingerprint256,
    "80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA",
  );
  assert.ok(Date.parse(certificate.validFrom) <= Date.now());
  assert.ok(
    Date.parse(certificate.validTo) >
      Date.now() + 180 * 24 * 60 * 60 * 1000,
  );

  const expected =
    "PGSSLROOTCERT: ${{ github.workspace }}/config/certificates/supabase-root-2021-ca.crt";
  for (const path of tlsStagingDatabaseWorkflowPaths) {
    const source = readFileSync(
      resolve(repositoryRoot, ".github/workflows", path),
      "utf8",
    );
    assert.ok(source.includes(expected), path);
    assert.doesNotMatch(source, /PGSSLROOTCERT: \/etc\/ssl\/certs/u, path);
  }
});

test("offline CLI reuses and verifies every currently available control", () => {
  const output = execFileSync(
    process.execPath,
    [
      resolve(
        repositoryRoot,
        "scripts/operations/staging-database-rollout-state.mjs",
      ),
      "--check",
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  assert.match(output, /STAGING_DATABASE_ROLLOUT_STATE_CONTROLS=verified/u);
  assert.match(output, /STAGING_DATABASE_ROLLOUT_STATE_READY=YES/u);
});

test("read-only CLI derives the expanded state plan without leaking IDs", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "fanmind-rollout-test-"));
  const triggerRunnerAvailable = existsSync(
    resolve(
      repositoryRoot,
      "scripts/operations/trigger-function-hardening-migration-runner.mjs",
    ),
  );
  try {
    const fakePsql = resolve(temporaryDirectory, "psql");
    const passfile = resolve(temporaryDirectory, "pgpass");
    writeFileSync(
      fakePsql,
      `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  exit 0
fi
input="$(cat)"
case "$input" in
  *STAGING_DATABASE_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_LEDGER_OBJECT=present' ;;
  *STAGING_DATABASE_LEDGER=*) echo 'STAGING_DATABASE_LEDGER=1:1:0:0:0:1:0:0' ;;
  *STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT=*) echo 'STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT=absent' ;;
  *WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=*) echo 'WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=absent' ;;
  *STAGING_DATABASE_AI_TIER_OBJECT=*) echo 'STAGING_DATABASE_AI_TIER_OBJECT=present' ;;
  *STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT=absent' ;;
  *STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT=absent' ;;
  *AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS*) echo 'AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS' ;;
  *STAGING_DATABASE_MOBILE_PUSH_OBJECT=*) echo 'STAGING_DATABASE_MOBILE_PUSH_OBJECT=present' ;;
  *MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS*) echo 'MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS' ;;
  *META_CONTENT_MIGRATION_STATE=*) echo 'META_CONTENT_MIGRATION_STATE=absent' ;;
  *STAGING_DATABASE_META_CATCHUP_OBJECT=*) echo 'STAGING_DATABASE_META_CATCHUP_OBJECT=absent' ;;
  *META_CONVERSATION_CONTINUATION_STATE=*) echo 'META_CONVERSATION_CONTINUATION_STATE=absent' ;;
  *STAGING_DATABASE_TRIGGER_OBJECT=*) echo 'STAGING_DATABASE_TRIGGER_OBJECT=pending' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o700 },
    );
    chmodSync(fakePsql, 0o700);
    writeFileSync(passfile, "host:5432:postgres:user:password\n", {
      mode: 0o600,
    });

    const result = spawnSync(
      process.execPath,
      [
        resolve(
          repositoryRoot,
          "scripts/operations/staging-database-rollout-state.mjs",
        ),
        "--run",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ...validEnvironment(),
          PATH: `${temporaryDirectory}:${process.env.PATH}`,
          PGPASSFILE: passfile,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=apply/u,
    );
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=skip/u,
    );
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_AI_TIER=verify/u);
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_AI_TIER_STRIPE_LEDGER=apply/u,
    );
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=apply/u,
    );
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_MOBILE_PUSH=verify/u);
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_META_CONTENT=apply/u);
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_META_CATCHUP=apply/u);
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_META_CONTINUATION=apply/u);
    assert.match(
      result.stdout,
      new RegExp(
        `STAGING_DATABASE_ROLLOUT_TRIGGER_HARDENING=${triggerRunnerAvailable ? "apply" : "skip"}`,
        "u",
      ),
    );
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
    assert.doesNotMatch(result.stdout, /stagingprojectref|20260|host:|password/u);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("read-only CLI blocks the member boundary when the prerequisite ledger is absent", () => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), "fanmind-rollout-no-ledger-"));
  try {
    const fakePsql = resolve(temporaryDirectory, "psql");
    const passfile = resolve(temporaryDirectory, "pgpass");
    writeFileSync(
      fakePsql,
      `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  exit 0
fi
input="$(cat)"
case "$input" in
  *STAGING_DATABASE_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_LEDGER_OBJECT=absent' ;;
  *STAGING_DATABASE_LEDGER=*) exit 91 ;;
  *STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT=*) echo 'STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT=absent' ;;
  *WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=*) echo 'WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=absent' ;;
  *STAGING_DATABASE_AI_TIER_OBJECT=*) echo 'STAGING_DATABASE_AI_TIER_OBJECT=absent' ;;
  *STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT=absent' ;;
  *STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT=absent' ;;
  *STAGING_DATABASE_MOBILE_PUSH_OBJECT=*) echo 'STAGING_DATABASE_MOBILE_PUSH_OBJECT=absent' ;;
  *META_CONTENT_MIGRATION_STATE=*) echo 'META_CONTENT_MIGRATION_STATE=absent' ;;
  *STAGING_DATABASE_META_CATCHUP_OBJECT=*) echo 'STAGING_DATABASE_META_CATCHUP_OBJECT=absent' ;;
  *META_CONVERSATION_CONTINUATION_STATE=*) echo 'META_CONVERSATION_CONTINUATION_STATE=absent' ;;
  *STAGING_DATABASE_TRIGGER_OBJECT=*) echo 'STAGING_DATABASE_TRIGGER_OBJECT=pending' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o700 },
    );
    chmodSync(fakePsql, 0o700);
    writeFileSync(passfile, "host:5432:postgres:user:password\n", {
      mode: 0o600,
    });

    const result = spawnSync(
      process.execPath,
      [
        resolve(
          repositoryRoot,
          "scripts/operations/staging-database-rollout-state.mjs",
        ),
        "--run",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ...validEnvironment(),
          PATH: `${temporaryDirectory}:${process.env.PATH}`,
          PGPASSFILE: passfile,
        },
      },
    );
    assert.equal(result.status, 1, result.stderr);
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=block/u,
    );
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=skip/u,
    );
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_AI_TIER=apply/u);
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_AI_TIER_STRIPE_LEDGER=block/u,
    );
    assert.match(
      result.stdout,
      /STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=apply/u,
    );
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_MOBILE_PUSH=apply/u);
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_META_CONTENT=apply/u);
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_META_CATCHUP=apply/u);
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_META_CONTINUATION=apply/u);
    assert.match(result.stdout, /STAGING_DATABASE_ROLLOUT_STATE=BLOCKED/u);
    assert.doesNotMatch(result.stdout, /stagingprojectref|host:|password/u);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("read-only CLI reports only a safe probe failure category", () => {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "fanmind-rollout-diagnostic-"),
  );
  try {
    const fakePsql = resolve(temporaryDirectory, "psql");
    const passfile = resolve(temporaryDirectory, "pgpass");
    writeFileSync(
      fakePsql,
      `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  exit 0
fi
cat >/dev/null
echo 'psql: error: connection to server at "private-host" failed: FATAL: Tenant or user not found raw-private-db-error' >&2
exit 2
`,
      { mode: 0o700 },
    );
    chmodSync(fakePsql, 0o700);
    writeFileSync(passfile, "host:5432:postgres:user:password\n", {
      mode: 0o600,
    });

    const result = spawnSync(
      process.execPath,
      [
        resolve(
          repositoryRoot,
          "scripts/operations/staging-database-rollout-state.mjs",
        ),
        "--run",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ...validEnvironment(),
          PATH: `${temporaryDirectory}:${process.env.PATH}`,
          PGPASSFILE: passfile,
        },
      },
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /STAGING_DATABASE_ROLLOUT_STATE_PROBE_FAILURE=ledger_object:tenant_or_user_not_found/u,
    );
    assert.doesNotMatch(
      `${result.stdout}\n${result.stderr}`,
      /private-host|raw-private-db-error|stagingprojectref|password/u,
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test("read-only CLI reports a safe optional postflight failure category", () => {
  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "fanmind-rollout-postflight-diagnostic-"),
  );
  try {
    const fakePsql = resolve(temporaryDirectory, "psql");
    const passfile = resolve(temporaryDirectory, "pgpass");
    writeFileSync(
      fakePsql,
      `#!/bin/sh
if [ "\${1:-}" = "--version" ]; then
  exit 0
fi
input="$(cat)"
case "$input" in
  *STAGING_DATABASE_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_LEDGER_OBJECT=present' ;;
  *STAGING_DATABASE_LEDGER=*) echo 'STAGING_DATABASE_LEDGER=1:1:0:0:0:1:0:0' ;;
  *STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT=*) echo 'STAGING_DATABASE_WORKSPACE_MEMBER_BOUNDARY_OBJECT=absent' ;;
  *WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=*) echo 'WHATSAPP_CLOUD_INBOUND_OBJECT_STATE=absent' ;;
  *STAGING_DATABASE_AI_TIER_OBJECT=*) echo 'STAGING_DATABASE_AI_TIER_OBJECT=present' ;;
  *AI_TIER_ENTITLEMENT_MIGRATION_POSTFLIGHT=PASS*)
    echo 'ERROR: cannot execute DO in a read-only transaction raw-private-db-error' >&2
    exit 2
    ;;
  *STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_AI_TIER_STRIPE_LEDGER_OBJECT=absent' ;;
  *STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT=*) echo 'STAGING_DATABASE_STRIPE_BILLING_LEDGER_OBJECT=absent' ;;
  *STAGING_DATABASE_MOBILE_PUSH_OBJECT=*) echo 'STAGING_DATABASE_MOBILE_PUSH_OBJECT=present' ;;
  *MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS*) echo 'MOBILE_PUSH_REGISTRATION_MIGRATION_POSTFLIGHT=PASS' ;;
  *META_CONTENT_MIGRATION_STATE=*) echo 'META_CONTENT_MIGRATION_STATE=absent' ;;
  *STAGING_DATABASE_META_CATCHUP_OBJECT=*) echo 'STAGING_DATABASE_META_CATCHUP_OBJECT=absent' ;;
  *META_CONVERSATION_CONTINUATION_STATE=*) echo 'META_CONVERSATION_CONTINUATION_STATE=absent' ;;
  *STAGING_DATABASE_TRIGGER_OBJECT=*) echo 'STAGING_DATABASE_TRIGGER_OBJECT=pending' ;;
  *TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS*) echo 'TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS' ;;
  *) exit 1 ;;
esac
`,
      { mode: 0o700 },
    );
    chmodSync(fakePsql, 0o700);
    writeFileSync(passfile, "host:5432:postgres:user:password\n", {
      mode: 0o600,
    });

    const result = spawnSync(
      process.execPath,
      [
        resolve(
          repositoryRoot,
          "scripts/operations/staging-database-rollout-state.mjs",
        ),
        "--run",
      ],
      {
        cwd: repositoryRoot,
        encoding: "utf8",
        env: {
          ...process.env,
          ...validEnvironment(),
          PATH: `${temporaryDirectory}:${process.env.PATH}`,
          PGPASSFILE: passfile,
        },
      },
    );
    assert.equal(result.status, 1);
    assert.match(
      result.stderr,
      /STAGING_DATABASE_ROLLOUT_STATE_PROBE_FAILURE=staging_database_ai_tier_object_postflight:write_blocked/u,
    );
    assert.doesNotMatch(
      `${result.stdout}\n${result.stderr}`,
      /raw-private-db-error|stagingprojectref|host:|password/u,
    );
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

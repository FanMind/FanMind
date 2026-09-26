import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CHAT_ADMIN_ACCEPTANCE_CONFIRMATION,
  CHAT_ADMIN_MIGRATION_CONFIRMATION,
  CHAT_ADMIN_SCHEMA_CONFIRMATION,
  evaluateChatAdminStagingControlEnvironment,
} from "../src/lib/chatAdminStagingControlPolicy.mjs";
import {
  CHAT_ADMIN_POSTFLIGHT_SQL,
  SQL_SHA256,
} from "../scripts/operations/chat-admin-staging-runner.mjs";
import {
  CHAT_ADMIN_ACCEPTANCE_SQL,
  CHAT_ADMIN_FIXTURE_RESOLUTION_SQL,
} from "../scripts/operations/chat-admin-staging-acceptance.mjs";
import {
  assertChatAdminCharacterInput,
  buildChatAdminCharacterContext,
} from "../src/lib/chatAdminPolicy.mjs";

const fixture = {
  display_name: "Anna",
  profile_image_path: null,
  public_age: 24,
  bio: "Vom User bereitgestellte Persona.",
  location: "Berlin",
  languages: ["Deutsch"],
  personality: "direkt",
  writing_style: "locker",
  emoji_style: "sparsam",
  sentence_style: "kurz",
  typical_phrases: ["hey du"],
  forbidden_phrases: ["Versprechen"],
  flirt_style: "respektvoll",
  sales_rules: "kein Druck",
  example_messages: ["Hey du 😊"],
  status: "active",
};

const SHA = "a".repeat(40);
const STAGING_REF = "stagingref0123456789";
const PRODUCTION_REF = "prodref0123456789012";
const POOLER_HOST = "aws-0-eu-central-1.pooler.supabase.com";
const baseStagingEnvironment = {
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: SHA,
  FANMIND_CHAT_ADMIN_REVIEWED_COMMIT: SHA,
  FANMIND_RUNTIME_ENVIRONMENT: "staging",
  NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
  FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
  FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
  NEXT_PUBLIC_SUPABASE_URL: `https://${STAGING_REF}.supabase.co`,
  FANMIND_TARGET_SUPABASE_PROJECT_REF: STAGING_REF,
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: PRODUCTION_REF,
  FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
  FANMIND_NON_PRODUCTION_WRITE_ACK: "",
  FANMIND_CHAT_ADMIN_SCHEMA_CONFIRM: CHAT_ADMIN_SCHEMA_CONFIRMATION,
  PGHOST: POOLER_HOST,
  FANMIND_TARGET_DB_HOST: POOLER_HOST,
  FANMIND_PRODUCTION_DB_HOST: `db.${PRODUCTION_REF}.supabase.co`,
  PGPORT: "5432",
  PGDATABASE: "postgres",
  PGUSER: `postgres.${STAGING_REF}`,
  PGSSLMODE: "verify-full",
  PGSSLROOTCERT:
    "/workspace/config/certificates/supabase-root-2021-ca.crt",
};

test("Adult-Character input is bounded and underage personas fail closed", () => {
  assert.equal(assertChatAdminCharacterInput(fixture).public_age, 24);
  assert.throws(
    () => assertChatAdminCharacterInput({ ...fixture, public_age: 17 }),
    /public_age_must_be_adult/,
  );
  assert.throws(
    () =>
      assertChatAdminCharacterInput({
        ...fixture,
        provider_token: "secret",
        public_age: 17,
      }),
    /public_age_must_be_adult/,
  );
});

test("context is revision-bound, selected-character-only and inactive/stale data fails closed", () => {
  const character = { ...fixture, id: "a", revision: 3 };
  const result = JSON.parse(
    buildChatAdminCharacterContext(character, "Hallo", "Fan 1"),
  );
  assert.equal(result.character_id, "a");
  assert.equal(result.character_revision, 3);
  assert.doesNotMatch(JSON.stringify(result), /Sophie|character-b/u);
  assert.throws(
    () => buildChatAdminCharacterContext({ ...character, status: "inactive" }, "Hallo"),
    /character_unavailable/,
  );
  assert.throws(
    () => buildChatAdminCharacterContext({ ...character, revision: null }, "Hallo"),
    /character_unavailable/,
  );
});

test("controlled schema enforces one workspace, tenant composite keys, adult check, RLS and cascade deletion", async () => {
  const sql = await readFile(
    "supabase/controlled/20260920230000_chat_admin_multi_character.sql",
    "utf8",
  );
  for (const pattern of [
    /one_chat_admin_workspace_global/u,
    /public_age between 18 and 99/u,
    /foreign key\(workspace_id,character_id,conversation_id\)/u,
    /on delete cascade/u,
    /enable row level security/u,
    /granted_to_user_id=auth\.uid\(\)/u,
    /owner_user_id=auth\.uid\(\)/u,
  ]) {
    assert.match(sql, pattern);
  }
  assert.doesNotMatch(sql, /isPlatformAdmin|platform_admin|admin_allowlist/iu);
});

test("routes require capability and workspace-bound character; no OnlyFans network, login or auto-send exists", async () => {
  const character = await readFile(
    "src/app/api/chatadmin/characters/route.ts",
    "utf8",
  );
  const reply = await readFile(
    "src/app/api/chatadmin/reply-suggestions/route.ts",
    "utf8",
  );
  const store = await readFile("src/lib/chatAdmin.ts", "utf8");
  for (const source of [character, reply]) {
    assert.match(source, /requireChatAdminCapability/u);
  }
  assert.match(store, /workspace_id=eq\./u);
  assert.match(store, /rows\[0\]\.workspace_id!==workspaceId/u);
  const combined = character + reply + store;
  assert.doesNotMatch(
    combined,
    /onlyfans\.com|OnlyFans API|provider.password|service_role/u,
  );
  assert.doesNotMatch(combined, /isPlatformAdmin/u);
});

test("ChatAdmin stays separate from Platform Admin and UI is capability-hidden", async () => {
  const dashboard = await readFile("src/app/dashboard/page.tsx", "utf8");
  const page = await readFile("src/app/chatadmin/page.tsx", "utf8");
  const admin = await readFile("src/lib/admin.ts", "utf8");
  assert.match(dashboard, /showChatAdmin \?/u);
  assert.match(page, /requireChatAdminCapability/u);
  assert.match(page, /notFound\(\)/u);
  assert.doesNotMatch(admin, /chat_admin_multi_character/u);
});

test("ChatAdmin cannot inherit user, Admin-CRM, Billing or Operations administration", async () => {
  const paths = [
    "src/app/admin/billing/page.tsx",
    "src/app/admin/operations/page.tsx",
    "src/app/api/admin/billing/users/[userId]/crm-access/route.ts",
  ];
  for (const path of paths) {
    const source = await readFile(path, "utf8");
    assert.match(source, /isPlatformAdminEmail|requirePlatformAdmin/u, path);
    assert.doesNotMatch(
      source,
      /chat_admin_multi_character|requireChatAdminCapability/u,
      path,
    );
  }
  const root = await readFile("src/app/admin/page.tsx", "utf8");
  assert.match(root, /redirect\("\/admin\/billing"\)/u);
  const capability = await readFile("src/lib/chatAdmin.ts", "utf8");
  assert.doesNotMatch(
    capability,
    /isPlatformAdmin|SUPABASE_SERVICE_ROLE_KEY|impersonat/iu,
  );
});

test("account deletion and disclosure enumerate all character datasets", async () => {
  const deletion = await readFile(
    "scripts/operations/process-account-deletion.mjs",
    "utf8",
  );
  const disclosure = await readFile(
    "src/lib/dataDisclosureMetaExport.ts",
    "utf8",
  );
  for (const table of [
    "workspace_chat_admin_capabilities",
    "chat_characters",
    "chat_character_conversations",
    "chat_character_messages",
  ]) {
    assert.match(deletion, new RegExp(table, "u"));
    assert.match(disclosure, new RegExp(table, "u"));
  }
});

test("VERIFY is exact-main, project-bound, TLS-pinned and read-only", () => {
  assert.equal(
    evaluateChatAdminStagingControlEnvironment(baseStagingEnvironment, {
      mode: "schema",
    }).ok,
    true,
  );
  const invalidPatches = [
    { GITHUB_REF: "refs/heads/x" },
    { GITHUB_SHA: "b".repeat(40) },
    {
      NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
      FANMIND_TARGET_API_ORIGIN: "https://fanmind.ch",
    },
    {
      FANMIND_TARGET_SUPABASE_PROJECT_REF: PRODUCTION_REF,
      NEXT_PUBLIC_SUPABASE_URL: `https://${PRODUCTION_REF}.supabase.co`,
    },
    { PGUSER: "postgres.wrongprojectref" },
    { PGHOST: `db.${PRODUCTION_REF}.supabase.co`, FANMIND_TARGET_DB_HOST: `db.${PRODUCTION_REF}.supabase.co` },
    { PGHOSTADDR: "127.0.0.1" },
    { PGSSLMODE: "require" },
    { PGSSLROOTCERT: "/tmp/untrusted.crt" },
  ];
  for (const patch of invalidPatches) {
    assert.equal(
      evaluateChatAdminStagingControlEnvironment(
        { ...baseStagingEnvironment, ...patch },
        { mode: "schema" },
      ).ok,
      false,
      JSON.stringify(patch),
    );
  }
});

test("APPLY and ACCEPT require separate explicit write gates", () => {
  for (const [mode, key, value] of [
    [
      "migration",
      "FANMIND_CHAT_ADMIN_MIGRATION_CONFIRM",
      CHAT_ADMIN_MIGRATION_CONFIRMATION,
    ],
    [
      "acceptance",
      "FANMIND_CHAT_ADMIN_ACCEPTANCE_CONFIRM",
      CHAT_ADMIN_ACCEPTANCE_CONFIRMATION,
    ],
  ]) {
    const environment = {
      ...baseStagingEnvironment,
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
      [key]: value,
    };
    assert.equal(
      evaluateChatAdminStagingControlEnvironment(environment, { mode }).ok,
      true,
    );
    assert.equal(
      evaluateChatAdminStagingControlEnvironment(
        { ...environment, [key]: "wrong" },
        { mode },
      ).ok,
      false,
    );
  }
});

test("schema verifier checks definitions, composite tenant constraints and global uniqueness rather than counts", () => {
  assert.equal(
    SQL_SHA256,
    "9dd3674a3848303cd707aa89ad4b808c5bd9a12bfe3ff4b367e2c99121ad1e7b",
  );
  for (const token of [
    "set transaction read only",
    "ABSENT",
    "PARTIAL",
    "VERIFIED",
    "chat_admin_capability_owner_read",
    "chat_admin_characters_owner_all",
    "chat_admin_conversations_owner_all",
    "chat_admin_messages_owner_all",
    "roles = '{authenticated}'::name[]",
    "pg_get_constraintdef",
    "foreignkeyworkspace_id,character_idreferenceschat_charactersworkspace_id,idondeletecascade",
    "foreignkeyworkspace_id,character_id,conversation_idreferenceschat_character_conversationsworkspace_id,character_id,idondeletecascade",
    "one_chat_admin_workspace_global",
    "information_schema.table_privileges",
    "schema_mismatch",
    "format_type",
    "has_function_privilege",
  ]) {
    assert.match(CHAT_ADMIN_POSTFLIGHT_SQL, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }
  assert.doesNotMatch(
    CHAT_ADMIN_POSTFLIGHT_SQL,
    /pg_constraint[\s\S]*count\(\*\)[\s\S]*<\s*14/iu,
  );
  assert.doesNotMatch(CHAT_ADMIN_POSTFLIGHT_SQL, /\bcommit\s*;/iu);
});

test("ACCEPT resolves only canonical synthetic Staging parents when all explicit fixture variables are absent", () => {
  for (const token of [
    "set transaction read only",
    "staging_synthetic_fixture",
    "workspace_processing_acceptance",
    "fanmind_staging_fixture",
    "ai_member",
    "staging_operator_workspace",
    "gen_random_uuid()",
    "rollback;",
  ]) {
    assert.equal(
      CHAT_ADMIN_FIXTURE_RESOLUTION_SQL.toLowerCase().includes(token.toLowerCase()),
      true,
      token,
    );
  }
  assert.doesNotMatch(CHAT_ADMIN_FIXTURE_RESOLUTION_SQL, /email/iu);
  assert.doesNotMatch(CHAT_ADMIN_FIXTURE_RESOLUTION_SQL, /\binsert\b|\bupdate\b|\bdelete\b/iu);
});

test("acceptance uses authenticated JWT subjects and keeps unexercised application flow OPEN", () => {
  for (const token of [
    "set local role authenticated",
    "request.jwt.claim.sub",
    "workspace_member_allowed",
    "owner_without_capability_allowed",
    "platform_admin_allowed",
    "one_chat_admin_workspace_global",
    "wrong_uniqueness_guard",
    "underage_allowed",
    "cross_character_allowed",
    "fan_reference_mixed",
    "rollback;",
    "CHAT_ADMIN_ACCEPTANCE_DATABASE_FLOW=PASS",
    "CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=OPEN",
    "CHAT_ADMIN_ACCEPTANCE_CLEANUP=PASS",
  ]) {
    assert.match(
      CHAT_ADMIN_ACCEPTANCE_SQL,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
    );
  }
  assert.doesNotMatch(
    CHAT_ADMIN_ACCEPTANCE_SQL,
    /CHAT_ADMIN_ACCEPTANCE_MANUAL_FLOW=PASS/iu,
  );
  assert.doesNotMatch(CHAT_ADMIN_ACCEPTANCE_SQL, /\bcommit\s*;/iu);
});

test("storage contract safely rejects malformed paths and binds both old and updated names to an existing character", async () => {
  const sql = await readFile(
    "supabase/controlled/20260920231000_chat_admin_profile_image_storage.sql",
    "utf8",
  );
  assert.match(sql, /public\s*=\s*false/u);
  assert.match(sql, /chat_characters/u);
  assert.match(sql, /is_current_chat_admin_workspace/u);
  assert.match(sql, /\[0-9a-f\]\{8\}/u);
  assert.match(sql, /case[\s\S]*then \(storage\.foldername\(name\)\)\[1\]::uuid/iu);
  assert.match(sql, /for update[\s\S]*with check[\s\S]*exists \([\s\S]*from public\.chat_characters/iu);
  assert.doesNotMatch(
    sql,
    /is_current_chat_admin_workspace\(\(storage\.foldername\(name\)\)\[1\]::uuid\)/u,
  );
  assert.doesNotMatch(sql, /insert into storage\.buckets/iu);
});

test("workflow fails closed on mode mismatch, pins TLS and verifies schema before ACCEPT", async () => {
  const workflow = await readFile(
    ".github/workflows/chat-admin-staging-rollout.yml",
    "utf8",
  );
  assert.match(workflow, /permissions:\n  contents: read/u);
  assert.match(workflow, /timeout-minutes: 20/u);
  assert.match(workflow, /PGCONNECT_TIMEOUT: '10'/u);
  assert.match(workflow, /lock_timeout=5000/u);
  assert.match(workflow, /statement_timeout=120000/u);
  assert.match(
    workflow,
    /PGSSLROOTCERT: \$\{\{ github\.workspace \}\}\/config\/certificates\/supabase-root-2021-ca\.crt/u,
  );
  assert.match(workflow, /Validate mode and exact confirmation/u);
  assert.match(workflow, /ChatAdmin rollout mode\/confirmation mismatch/u);
  assert.match(workflow, /Verify schema before ACCEPT[\s\S]*db:chat-admin:verify/u);
  assert.match(
    workflow,
    /PGUSER: \$\{\{ format\('postgres\.\{0\}', vars\.FANMIND_STAGING_SUPABASE_PROJECT_REF\) \}\}/u,
  );
});

import "./creator-confirmed-chat-learning.cases.mjs";

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(
  repoRoot,
  "scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs",
);

function currentHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function targetEnv(overrides = {}) {
  const target = "stagingref123456";
  return {
    PATH: process.env.PATH ?? "",
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: target,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    NEXT_PUBLIC_SUPABASE_URL: `https://${target}.supabase.co`,
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    PGUSER: `postgres.${target}`,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/tmp/fanmind-test-ca.crt",
    FANMIND_CREATOR_CONFIRMED_CHAT_REVIEWED_COMMIT: currentHead(),
    ...overrides,
  };
}

test("confirmed-chat rollout runner pins the reviewed SQL and stays offline in check mode", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(
    runner,
    /EXPECTED_MIGRATION_GIT_BLOB_SHA1 = "b09a22643d5076e68cfe7816980e88d0d00272f7"/u,
  );
  assert.match(runner, /set transaction read only/u);
  assert.match(runner, /production_apply_forbidden/u);
  assert.match(runner, /source_state_not_installed/u);
  assert.match(runner, /installed_target_with_preinstall_source/u);

  const result = spawnSync(process.execPath, [runnerPath, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_CHECKSUM=verified/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_CONTRACT=verified/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_SHA256=[0-9a-f]{64}/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_SOURCE_STATE=preinstall/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_APPLY=not_requested/u);
});

test("confirmed-chat apply fails before target access while source state is preinstall", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--apply"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FANMIND_CREATOR_CONFIRMED_CHAT_APPLY_CONFIRMATION:
        "apply-creator-confirmed-chat-learning",
      FANMIND_NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT:
        "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=source_state_not_installed/u,
  );
});

test("reviewed VERIFY and APPLY bind rollout state to the exact reviewed commit", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(runner, /status", "--porcelain=v1", "--untracked-files=no"/u);
  assert.match(runner, /const state = reviewedRolloutState\(reviewedCommit\)/u);
  assert.match(
    runner,
    /if \(state !== workingState\) fail\("rollout_state_checkout_mismatch"\)/u,
  );
  assert.match(runner, /runGit\(\["show"/u);
  assert.match(runner, /checkout_dirty/u);
  assert.match(
    runner,
    /requireCleanTrackedCheckout\(\);\s*if \(mode === "apply"\)/u,
  );
});

test("database binding rejects a foreign pooler user before any passfile or psql access", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv({ PGUSER: "postgres.productionref123" }),
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=database_project_binding_invalid/u,
  );
});

test("database binding rejects project-looking users on non-Supabase hosts", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv({
      FANMIND_TARGET_DB_HOST: "database.example.com",
      PGHOST: "database.example.com",
    }),
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=database_project_binding_invalid/u,
  );
});

test("database binding accepts the selected project's Supabase pooler identity before requiring credentials", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv(),
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=passfile_missing/u,
  );
});

test("direct project host requires the plain postgres database user", () => {
  const target = "stagingref123456";
  const valid = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv({
      FANMIND_TARGET_DB_HOST: `db.${target}.supabase.co`,
      PGHOST: `db.${target}.supabase.co`,
      PGUSER: "postgres",
    }),
  });
  assert.notEqual(valid.status, 0);
  assert.match(
    valid.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=passfile_missing/u,
  );

  const wrongUser = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv({
      FANMIND_TARGET_DB_HOST: `db.${target}.supabase.co`,
      PGHOST: `db.${target}.supabase.co`,
      PGUSER: `postgres.${target}`,
    }),
  });
  assert.notEqual(wrongUser.status, 0);
  assert.match(
    wrongUser.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=database_project_binding_invalid/u,
  );
});

test("installed-state verifier binds all stored function bodies and exact empty search paths to the pinned migration", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(runner, /const FUNCTION_CONTRACTS = \[/u);
  assert.match(runner, /migrationFunctionBody/u);
  assert.match(runner, /functionBodyHash/u);
  assert.match(runner, /p\.prosrc/u);
  assert.match(runner, /md5\(function_source\)/u);
  assert.match(
    runner,
    /function_config is distinct from array\['search_path=""'\]::text\[\]/u,
  );
  assert.doesNotMatch(runner, /position\('search_path=' in function_config\)/u);
  assert.doesNotMatch(runner, /lower\(function_def\) not like/u);

  for (const name of [
    "stamp_creator_learning_manual_send",
    "record_creator_confirmed_chat_proposals",
    "confirm_creator_confirmed_chat_outbound",
    "link_creator_confirmed_chat_outcomes",
  ]) {
    assert.match(runner, new RegExp(name, "u"));
  }
});

test("installed-state verifier checks the complete learning-table column/default contract", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(
    runner,
    /from pg_attribute\s+where attrelid = learning_table[\s\S]*<> 22/u,
  );
  for (const fragment of [
    "('proposal_id','uuid',true,null::text)",
    "('confirmed_by','uuid',false,null::text)",
    "('created_at','timestamp with time zone',true,'now()')",
    "('updated_at','timestamp with time zone',true,'now()')",
  ]) {
    assert.ok(runner.includes(fragment), `missing column contract ${fragment}`);
  }
  assert.match(runner, /pg_get_expr\(d\.adbin, d\.adrelid\)/u);
  assert.match(runner, /creator_learning_column_contract_invalid/u);
  assert.match(
    runner,
    /a\.attname = 'creator_learning_manual_send'[\s\S]*format_type\(a\.atttypid, a\.atttypmod\) = 'boolean'[\s\S]*a\.attnotnull[\s\S]*= 'false'/u,
  );
});

test("installed-state verifier preserves exact RLS, ACL, index, trigger and constraint checks", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(runner, /relpersistence = 'p'/u);
  assert.match(
    runner,
    /where tgrelid = learning_table\s+and not tgisinternal[\s\S]*creator_learning_trigger_set_invalid/u,
  );
  assert.match(
    runner,
    /createtriggerconversation_messages_stamp_creator_learning_manual_sendbeforeinsertorupdateonconversation_messagesforeachrowexecutefunctionstamp_creator_learning_manual_send/u,
  );
  assert.match(runner, /policy_qual <> '\(creator_workspace_access_allowed/u);
  assert.match(runner, /policy_permissive is distinct from 'PERMISSIVE'/u);
  assert.match(runner, /array\['authenticated'\]::name\[\]/u);

  for (const privilege of [
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "TRUNCATE",
    "REFERENCES",
    "TRIGGER",
  ]) {
    assert.match(
      runner,
      new RegExp(
        `not has_table_privilege\\('service_role', learning_table, '${privilege}'\\)`,
        "u",
      ),
    );
  }

  assert.match(
    runner,
    /has_function_privilege\(\s*'anon',\s*'public\.record_creator_confirmed_chat_proposals\(uuid,uuid,uuid,uuid,integer,text,jsonb\)',\s*'EXECUTE'\s*\)/u,
  );
  assert.match(runner, /i\.indpred is null and i\.indexprs is null/u);
  assert.match(runner, /am\.amname = 'btree'/u);
  assert.match(runner, /generated_atdesc/u);
  assert.match(runner, /primarykey\(proposal_id\)/u);
  assert.match(runner, /unique\(workspace_id,purchase_event_id\)/u);
  assert.match(runner, /array_length\(check_constraint_defs, 1\) <> 10/u);
  assert.match(runner, /not convalidated or condeferrable or condeferred/u);
});

test("production VERIFY never recommends the staging-only APPLY path", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(
    runner,
    /CREATOR_CONFIRMED_CHAT_NEXT=separate_production_rollout_plan_required/u,
  );
  assert.match(runner, /CREATOR_CONFIRMED_CHAT_APPLY=forbidden/u);
  assert.match(runner, /runtime === "production"/u);
});

test("confirmed-chat verify requires exact target binding and normal deploy never applies the schema", async () => {
  const deploy = await readFile(
    path.join(repoRoot, ".github/workflows/deploy-fanmind.yml"),
    "utf8",
  );
  assert.doesNotMatch(
    deploy,
    /creator-confirmed-chat-learning-migration-runner|20260923023000_creator_confirmed_chat_learning\.sql/u,
  );

  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "" },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=runtime_environment_invalid/u,
  );
});

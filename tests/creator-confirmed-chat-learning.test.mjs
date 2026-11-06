import "./creator-confirmed-chat-learning.cases.mjs";
import "./creator-confirmed-chat-learning-verifier-review.cases.mjs";

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(
  repoRoot,
  "scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs",
);

const SYNTHETIC_REVIEWED_COMMIT = "0".repeat(40);

function currentHead() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const candidate = result.status === 0 ? result.stdout.trim().toLowerCase() : "";
  return /^[0-9a-f]{40}$/u.test(candidate) ? candidate : null;
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
    PGDATABASE: "postgres",
    PGUSER: `postgres.${target}`,
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/tmp/fanmind-test-ca.crt",
    FANMIND_CREATOR_CONFIRMED_CHAT_REVIEWED_COMMIT:
      currentHead() ?? SYNTHETIC_REVIEWED_COMMIT,
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
  assert.match(runner, /set local search_path = pg_catalog/u);
  assert.match(runner, /production_apply_forbidden/u);
  assert.match(runner, /source_state_not_installed/u);
  assert.match(runner, /installed_target_with_preinstall_source/u);
  assert.match(
    runner,
    /CONFIRMED_CHAT_LEARNING_STAGING_SCHEMA_STATE = "\(preinstall\|installed\)"/u,
  );

  const result = spawnSync(process.execPath, [runnerPath, "--check"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_CHECKSUM=verified/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_CONTRACT=verified/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_FOUNDATION_CONTRACT=verified/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_MIGRATION_SHA256=[0-9a-f]{64}/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_STAGING_SOURCE_STATE=installed/u);
  assert.match(result.stdout, /CREATOR_CONFIRMED_CHAT_APPLY=not_requested/u);
});

test("generic confirmed-chat runner keeps apply structurally disabled", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--apply"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      FANMIND_RUNTIME_ENVIRONMENT: "staging",
      FANMIND_CREATOR_CONFIRMED_CHAT_APPLY_CONFIRMATION:
        "apply-creator-confirmed-chat-learning",
      FANMIND_NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT:
        "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=apply_protected_path_required/u,
  );
});

test("reviewed VERIFY and APPLY bind rollout state to the exact reviewed commit", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(runner, /status", "--porcelain=v1", "--untracked-files=no"/u);
  assert.match(runner, /const state = reviewedRolloutState\(reviewedCommit, environment, runtime\)/u);
  assert.match(
    runner,
    /const workingState = runtime === "staging" \? stagingSourceState : "preinstall"/u,
  );
  assert.match(
    runner,
    /if \(state !== workingState\) fail\("rollout_state_checkout_mismatch"\)/u,
  );
  assert.match(runner, /runGit\(\["show"/u);
  assert.match(runner, /checkout_dirty/u);
  assert.match(runner, /requireCleanTrackedCheckout\(environment\);/u);
  assert.match(
    runner,
    /requireReviewedControlFiles\(reviewedCommit, environment\);/u,
  );
  assert.match(runner, /if \(modeArg === "--apply"\) fail\("apply_protected_path_required"\)/u);
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

test("database binding rejects a foreign database name before any passfile or psql access", () => {
  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv({ PGDATABASE: "shadow_database" }),
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=database_name_binding_invalid/u,
  );
});

test("database binding accepts the selected project's Supabase pooler identity before the next protected boundary", () => {
  const hasCheckout = currentHead() !== null;
  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv(),
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    hasCheckout
      ? /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=passfile_missing/u
      : /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=checkout_repository_mismatch/u,
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
    currentHead() !== null
      ? /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=passfile_missing/u
      : /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=checkout_repository_mismatch/u,
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
  assert.match(runner, /const FUNCTION_CONTRACTS =/u);
  assert.match(runner, /functionBody/u);
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
  assert.match(runner, /check_constraint_defs is null/u);
  assert.match(runner, /array_length\(check_constraint_defs, 1\) <> 10/u);
  assert.match(runner, /not convalidated or condeferrable or condeferred/u);
});

test("installed-state verifier pins authorization helpers and callable metadata", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(
    runner,
    /EXPECTED_WORKSPACE_BOUNDARY_GIT_BLOB_SHA1 = "07286a4793204a1f3d82c18fca18728b1380d6fa"/u,
  );
  assert.match(
    runner,
    /EXPECTED_CREATOR_ACCESS_GIT_BLOB_SHA1 = "c2132db39e141131483afc44d045d21d632b1672"/u,
  );
  for (const helper of [
    "creator_workspace_access_allowed",
    "workspace_owner_active_mutation_allowed",
    "workspace_processing_allowed_contract",
  ]) {
    assert.match(runner, new RegExp(helper, "u"));
  }
  for (const field of [
    "p.proisstrict",
    "p.provolatile",
    "l.lanname",
    "format_type(p.prorettype, null)",
    "p.proretset",
    "p.proparallel",
    "p.proleakproof",
    "p.prokind",
    "p.pronargdefaults",
    "p.provariadic",
  ]) {
    assert.ok(runner.includes(field), `missing callable metadata ${field}`);
  }
  assert.match(runner, /creator_learning_foundation_function_invalid/u);
  assert.match(runner, /creator_learning_function_metadata_invalid/u);
});

test("browser roles are explicitly forbidden from bypassing RLS", async () => {
  const runner = await readFile(runnerPath, "utf8");
  assert.match(runner, /rolname in \('anon','authenticated'\)/u);
  assert.match(runner, /rolbypassrls or rolsuper/u);
  assert.match(runner, /creator_learning_browser_role_rls_invalid/u);
});

test("Git attestation ignores caller repository redirection and stays bound to this checkout", async (t) => {
  const fakeRepo = await mkdtemp(path.join(tmpdir(), "fanmind-git-redirection-"));
  t.after(() => rm(fakeRepo, { recursive: true, force: true }));
  const initialized = spawnSync("git", ["init", fakeRepo], { encoding: "utf8" });
  assert.equal(initialized.status, 0, initialized.stderr);

  const result = spawnSync(process.execPath, [runnerPath, "--verify"], {
    cwd: repoRoot,
    encoding: "utf8",
    env: targetEnv({
      GIT_DIR: path.join(fakeRepo, ".git"),
      GIT_WORK_TREE: fakeRepo,
      GIT_CONFIG: path.join(fakeRepo, "attacker-gitconfig"),
    }),
  });
  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    currentHead() !== null
      ? /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=passfile_missing/u
      : /CREATOR_CONFIRMED_CHAT_MIGRATION_ERROR=checkout_repository_mismatch/u,
  );
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

test("confirmed-chat Staging control is verify-only, exact-main and protected", async () => {
  const workflow = await readFile(
    path.join(
      repoRoot,
      ".github/workflows/creator-confirmed-chat-learning-staging-verify.yml",
    ),
    "utf8",
  );

  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /validate:\n[\s\S]*Reject invalid or stale dispatch parameters/u);
  assert.match(workflow, /FANMIND_DISPATCH_REF: \$\{\{ github\.ref \}\}/u);
  assert.match(workflow, /FANMIND_DISPATCH_SHA: \$\{\{ github\.sha \}\}/u);
  assert.match(workflow, /FANMIND_REVIEWED_COMMIT: \$\{\{ inputs\.reviewed_commit \}\}/u);
  assert.match(workflow, /test "\$FANMIND_DISPATCH_REF" = "refs\/heads\/main"/u);
  assert.match(workflow, /test "\$FANMIND_REVIEWED_COMMIT" = "\$FANMIND_DISPATCH_SHA"/u);
  assert.match(
    workflow,
    /test "\$FANMIND_CONFIRMATION" = "verify-creator-confirmed-chat-learning"/u,
  );
  assert.match(workflow, /verify:\n[\s\S]*needs: validate/u);
  assert.doesNotMatch(workflow, /\n\s+if:\s*>-/u);
  assert.match(workflow, /FANMIND_RUNTIME_ENVIRONMENT: staging/u);
  assert.match(
    workflow,
    /FANMIND_CREATOR_CONFIRMED_CHAT_REVIEWED_COMMIT: \$\{\{ inputs\.reviewed_commit \}\}/u,
  );
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.match(workflow, /chmod 600 "\$PGPASSFILE"/u);
  assert.match(
    workflow,
    /creator-confirmed-chat-learning-migration-runner\.mjs --check/u,
  );
  assert.match(
    workflow,
    /creator-confirmed-chat-learning-migration-runner\.mjs --verify/u,
  );
  assert.match(workflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.doesNotMatch(workflow, /--apply|apply-creator-confirmed-chat-learning/u);
  assert.doesNotMatch(workflow, /I_UNDERSTAND_NON_PRODUCTION_ONLY/u);
});

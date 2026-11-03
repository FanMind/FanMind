import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const containerId = process.env.FANMIND_OPEN_QUESTIONS_PG17_CONTAINER_ID?.trim();
const password = process.env.FANMIND_PG17_PASSWORD?.trim() || "fanmind-ci-only-pg17";
const sourceCommit = "e127aab07380c416a0832183631374c70841def6";
const originalSources = {
  "supabase/migrations/20260613120000_create_conversations_messages.sql": "6931f15ec03a4025b7db0fd9f55004a9803f48cb",
  "supabase/migrations/20260614120000_conversation_message_retention.sql": "f5053e78462af0b77676609bba2b3cdc4e244a2e",
  "supabase/migrations/20260617120000_add_conversation_source_metadata.sql": "1808e9aae92cbd96b1b7f6996a4a7bbb3092b4b0",
  "supabase/migrations/20261103090000_website_chat_open_questions.sql": "1a2a20c909d34d2c5a3f49adb7519920eadfbbdb",
  "supabase/controlled/website_chat_open_questions_option_a_retention_body.sql": "939f4f0c5916d86957ce024d0f82cc1372a2d147",
};
const target = {
  workspace: "10000000-0000-4000-8000-000000000001",
  question: "10000000-0000-4000-8000-000000000005",
  message: "10000000-0000-4000-8000-000000000004",
};
const foreignWorkspace = "20000000-0000-4000-8000-000000000001";

function gitBlobSha(path) {
  const data = readFileSync(join(repoRoot, path));
  return createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");
}

function docker(args, options = {}) {
  return spawnSync("docker", args, { encoding: "utf8", ...options });
}

function execInContainer(args, options = {}) {
  return docker(["exec", "-e", `PGPASSWORD=${password}`, containerId, ...args], options);
}

function mustSucceed(result, label) {
  assert.equal(result.error, undefined, `${label}: ${result.error?.message ?? "spawn failed"}`);
  assert.equal(result.status, 0, `${label}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
  return result.stdout.trim();
}

function psql(database, args = []) {
  return execInContainer([
    "psql", "--username=postgres", `--dbname=${database}`, "--no-psqlrc",
    "--set=ON_ERROR_STOP=1", ...args,
  ]);
}

function query(database, command, role = "") {
  const scoped = role ? `set role ${role}; ${command}` : command;
  return mustSucceed(psql(database, [
    "--quiet", "--tuples-only", "--no-align", "--command", scoped,
  ]), "query disposable database").split("\n").at(-1);
}

test("native PG17 proves original retention, BYPASSRLS denial and cleanup", { timeout: 120_000 }, () => {
  assert.ok(containerId, "FANMIND_OPEN_QUESTIONS_PG17_CONTAINER_ID is required");
  assert.match(containerId, /^[a-f0-9]{12,64}$/u);
  for (const [path, expected] of Object.entries(originalSources)) {
    assert.equal(gitBlobSha(path), expected, `${path} must remain bound to ${sourceCommit}`);
  }

  const inspectedContainerId = mustSucceed(
    docker(["inspect", "--format={{.Id}}", containerId]),
    "resolve PostgreSQL service container",
  );
  assert.ok(inspectedContainerId.startsWith(containerId) || containerId.startsWith(inspectedContainerId));
  const version = mustSucceed(execInContainer([
    "psql", "--username=postgres", "--dbname=postgres", "--quiet", "--tuples-only",
    "--no-align", "--command", "show server_version_num",
  ]), "read PostgreSQL version");
  assert.equal(Math.trunc(Number(version) / 10_000), 17);

  const rolesAbsent = mustSucceed(execInContainer([
    "psql", "--username=postgres", "--dbname=postgres", "--quiet", "--tuples-only",
    "--no-align", "--command",
    "select not exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role'))",
  ]), "verify fixed synthetic roles are absent");
  assert.equal(rolesAbsent, "t");

  const suffix = `${process.env.GITHUB_RUN_ID ?? "local"}_${process.env.GITHUB_RUN_ATTEMPT ?? "1"}_${process.pid}`
    .replace(/[^a-zA-Z0-9_]/gu, "_").toLowerCase();
  const database = `fanmind_review_${suffix}`;
  const remoteRoot = `/tmp/${database}`;
  let databaseCreated = false;
  try {
    mustSucceed(execInContainer([
      "psql", "--username=postgres", "--dbname=postgres", "--quiet", "--command",
      "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;",
    ]), "create fixed synthetic roles");
    assert.equal(query("postgres", "select rolbypassrls from pg_roles where rolname='service_role'"), "t");

    mustSucceed(execInContainer(["createdb", "--username=postgres", database]), "create disposable database");
    databaseCreated = true;
    mustSucceed(execInContainer(["mkdir", "-p", remoteRoot]), "create remote workspace");
    mustSucceed(docker(["cp", `${repoRoot}/.`, `${containerId}:${remoteRoot}`]), "copy proof sources");
    mustSucceed(psql(database, ["--file", `${remoteRoot}/tests/fixtures/open-questions-reviewed-excerpt-pg17-setup.sql`]), "apply original migrations, reviewed derivative and Option A");

    assert.equal(query(database, "select count(*) from public.website_chat_open_question_review_derivatives", "service_role"), "3");
    assert.equal(query(database, "select has_table_privilege('service_role','public.website_chat_open_question_review_derivatives','INSERT,UPDATE,DELETE')"), "f");
    assert.equal(query(database, "select has_table_privilege('authenticated','public.website_chat_open_question_review_derivatives','SELECT,INSERT,UPDATE,DELETE')"), "f");
    assert.equal(query(database, "select has_table_privilege('anon','public.website_chat_open_question_review_derivatives','SELECT,INSERT,UPDATE,DELETE')"), "f");
    assert.equal(query(database, "select count(*) from pg_default_acl where defaclrole='postgres'::regrole and array_to_string(defaclacl,',') ~ '(anon|authenticated|service_role)'"), "0");

    const deniedWrite = psql(database, [
      "--quiet", "--command",
      `set role service_role; insert into public.website_chat_open_question_review_derivatives(open_question_id,workspace_id,review_version,review_state) values('${target.question}','${target.workspace}',3,'pending')`,
    ]);
    assert.notEqual(deniedWrite.status, 0, "BYPASSRLS service_role must remain read-only");
    assert.match(deniedWrite.stderr, /permission denied/u);

    const mismatch = psql(database, [
      "--quiet", "--command",
      `insert into public.website_chat_open_question_review_derivatives(open_question_id,workspace_id,review_version,review_state) values('${target.question}','${foreignWorkspace}',3,'pending')`,
    ]);
    assert.notEqual(mismatch.status, 0, "composite question/workspace binding must reject mismatches");

    const foreignBefore = query(database, `select count(*) from public.website_chat_open_questions where workspace_id='${foreignWorkspace}'`) + "/" +
      query(database, `select count(*) from public.conversation_messages where workspace_id='${foreignWorkspace}'`) + "/" +
      query(database, `select count(*) from public.website_chat_open_question_review_derivatives where workspace_id='${foreignWorkspace}'`);

    assert.equal(
      query(database, `select concat_ws('|',deleted_audit_events,deleted_open_questions,deleted_conversation_messages) from public.run_website_chat_option_a_retention('${target.workspace}')`, "service_role"),
      "0|0|0",
    );
    assert.equal(query(database, `select count(*) from public.website_chat_open_questions where id='${target.question}'`), "1");
    assert.equal(query(database, `select count(*) from public.conversation_messages where id='${target.message}'`), "1");
    assert.equal(query(database, `select count(*) from public.website_chat_open_question_review_derivatives where open_question_id='${target.question}'`), "2");

    query(database, `update public.website_chat_retention_controls set legal_hold_released_at=statement_timestamp() where workspace_id='${target.workspace}'; select 1`);
    assert.equal(
      query(database, `select concat_ws('|',deleted_audit_events,deleted_open_questions,deleted_conversation_messages) from public.run_website_chat_option_a_retention('${target.workspace}')`, "service_role"),
      "1|1|1",
    );
    assert.equal(query(database, `select count(*) from public.website_chat_open_questions where id='${target.question}'`), "0");
    assert.equal(query(database, `select count(*) from public.conversation_messages where id='${target.message}'`), "0");
    assert.equal(query(database, `select count(*) from public.website_chat_open_question_review_derivatives where open_question_id='${target.question}'`), "0");

    const foreignAfter = query(database, `select count(*) from public.website_chat_open_questions where workspace_id='${foreignWorkspace}'`) + "/" +
      query(database, `select count(*) from public.conversation_messages where workspace_id='${foreignWorkspace}'`) + "/" +
      query(database, `select count(*) from public.website_chat_open_question_review_derivatives where workspace_id='${foreignWorkspace}'`);
    assert.equal(foreignAfter, foreignBefore);
    console.log(`REVIEW_DERIVATIVE_PG17_VERSION=${version}`);
    console.log("REVIEW_DERIVATIVE_BYPASSRLS_READONLY=PASS");
    console.log("REVIEW_DERIVATIVE_DEFAULT_PRIVILEGES=PASS");
    console.log("REVIEW_DERIVATIVE_OPTION_A_HOLD_CASCADE_ISOLATION=PASS");
  } finally {
    if (databaseCreated) {
      mustSucceed(execInContainer(["dropdb", "--username=postgres", "--force", database]), "drop disposable database");
      assert.equal(query("postgres", `select not exists(select 1 from pg_database where datname='${database}')`), "t");
    }
    mustSucceed(execInContainer([
      "psql", "--username=postgres", "--dbname=postgres", "--quiet", "--command",
      "drop role if exists anon, authenticated, service_role",
    ]), "drop fixed synthetic roles");
    assert.equal(query("postgres", "select not exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role'))"), "t");
    execInContainer(["rm", "-rf", remoteRoot]);
    console.log(`REVIEW_DERIVATIVE_DATABASE=${basename(database)}`);
    console.log("REVIEW_DERIVATIVE_CLEANUP=PASS");
  }
});

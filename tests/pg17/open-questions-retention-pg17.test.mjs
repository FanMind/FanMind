import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const containerId = process.env.FANMIND_PG17_SOURCE_CONTAINER_ID?.trim();
const password = process.env.FANMIND_PG17_PASSWORD?.trim() || "fanmind-ci-only-pg17";
const sourceCommit = "e127aab07380c416a0832183631374c70841def6";
const fixtureIds = {
  workspace: "10000000-0000-4000-8000-000000000001",
  question: "10000000-0000-4000-8000-000000000005",
  message: "10000000-0000-4000-8000-000000000004",
  actor: "10000000-0000-4000-8000-000000000006",
};
const files = {
  "scripts/operations/open-questions-retention-acceptance.sql": "ed8732d2dce80d40ee204d262e7171ecaead132c",
  "scripts/operations/open-questions-retention-staging-acceptance.mjs": "e247092f5ab07e7d84729044a9ce620c3c0a5250",
  "supabase/migrations/20260613120000_create_conversations_messages.sql": "6931f15ec03a4025b7db0fd9f55004a9803f48cb",
  "supabase/migrations/20260614120000_conversation_message_retention.sql": "f5053e78462af0b77676609bba2b3cdc4e244a2e",
  "supabase/migrations/20260617120000_add_conversation_source_metadata.sql": "1808e9aae92cbd96b1b7f6996a4a7bbb3092b4b0",
  "supabase/migrations/20261103090000_website_chat_open_questions.sql": "1a2a20c909d34d2c5a3f49adb7519920eadfbbdb",
  "supabase/controlled/website_chat_open_questions_option_a_retention_body.sql": "939f4f0c5916d86957ce024d0f82cc1372a2d147",
};
const markers = [
  "OPEN_QUESTION_ATOMIC_AUDIT=PASS",
  "OPEN_QUESTION_DELETE_CASCADE=PASS",
  "CONVERSATION_MESSAGE_LATEST_50=PASS",
  "OPTION_A_DEADLINE_BOUNDARIES=PASS",
  "OPTION_A_LEGAL_HOLD=PASS",
  "OPTION_A_WORKSPACE_ISOLATION=PASS",
  "OPTION_A_IDEMPOTENCE=PASS",
  "OPEN_QUESTION_ACCEPTANCE_ROLLBACK=PASS",
];

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

function psql(database, args = [], options = {}) {
  return execInContainer([
    "psql", "--username=postgres", `--dbname=${database}`, "--no-psqlrc",
    "--set=ON_ERROR_STOP=1", ...args,
  ], options);
}

function stateSnapshot(database) {
  const sql = String.raw`select jsonb_build_object(
    'target_questions', (select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]') from public.website_chat_open_questions q where workspace_id = '${fixtureIds.workspace}'),
    'target_messages', (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') from public.conversation_messages m where workspace_id = '${fixtureIds.workspace}'),
    'target_audits', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]') from public.website_chat_open_question_audit_events a where workspace_id = '${fixtureIds.workspace}'),
    'foreign_questions', (select coalesce(jsonb_agg(to_jsonb(q) order by q.id), '[]') from public.website_chat_open_questions q where workspace_id <> '${fixtureIds.workspace}'),
    'foreign_messages', (select coalesce(jsonb_agg(to_jsonb(m) order by m.id), '[]') from public.conversation_messages m where workspace_id <> '${fixtureIds.workspace}'),
    'foreign_audits', (select coalesce(jsonb_agg(to_jsonb(a) order by a.id), '[]') from public.website_chat_open_question_audit_events a where workspace_id <> '${fixtureIds.workspace}'),
    'acls', (select jsonb_agg(jsonb_build_array(n.nspname, c.relname, coalesce(to_jsonb(c.relacl), 'null')) order by c.relname) from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relname in ('workspaces','conversation_messages','website_chat_open_questions','website_chat_open_question_audit_events')),
    'retention_schema_absent', to_regclass('public.website_chat_retention_controls') is null and to_regprocedure('public.run_website_chat_option_a_retention(uuid)') is null and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'website_chat_open_questions' and column_name in ('retention_extended_until','retention_extension_reason'))
  )::text;`;
  return mustSucceed(psql(database, ["--quiet", "--tuples-only", "--no-align", "--command", sql]), "read state snapshot");
}

test("executes the e127aab retention harness in disposable PostgreSQL 17", { timeout: 120_000 }, () => {
  assert.ok(containerId, "FANMIND_PG17_SOURCE_CONTAINER_ID is required");
  assert.match(containerId, /^[a-f0-9]{12,64}$/u, "service container id must be a Docker id");
  for (const [path, expected] of Object.entries(files)) {
    assert.equal(gitBlobSha(path), expected, `${path} must remain bound to ${sourceCommit}`);
  }

  const inspectedContainerId = mustSucceed(
    docker(["inspect", "--format={{.Id}}", containerId]),
    "resolve PostgreSQL service container",
  );
  assert.ok(inspectedContainerId.startsWith(containerId) || containerId.startsWith(inspectedContainerId));
  const serverVersionNum = mustSucceed(
    execInContainer([
      "psql", "--username=postgres", "--dbname=postgres", "--quiet", "--tuples-only",
      "--no-align", "--command", "show server_version_num",
    ]),
    "read PostgreSQL server version",
  );
  assert.equal(Math.trunc(Number(serverVersionNum) / 10_000), 17, `expected PostgreSQL 17, got ${serverVersionNum}`);

  const suffix = `${process.env.GITHUB_RUN_ID ?? "local"}_${process.env.GITHUB_RUN_ATTEMPT ?? "1"}_${process.pid}`
    .replace(/[^a-zA-Z0-9_]/gu, "_").toLowerCase();
  const database = `fanmind_retention_${suffix}`;
  const remoteRoot = `/tmp/${database}`;
  let created = false;
  try {
    mustSucceed(execInContainer(["createdb", "--username=postgres", database]), "create disposable database");
    created = true;
    mustSucceed(execInContainer(["mkdir", "-p", remoteRoot]), "create remote workspace");
    mustSucceed(docker(["cp", `${repoRoot}/.`, `${containerId}:${remoteRoot}`]), "copy proof sources");
    mustSucceed(psql(database, ["--file", `${remoteRoot}/tests/fixtures/open-questions-retention-pg17-setup.sql`]), "apply synthetic fixture and versioned migrations");

    mustSucceed(psql(database, ["--command", `insert into public.conversation_messages (workspace_id, conversation_id, contact_id, direction, message_type, source_platform, source_type, content) select workspace_id, conversation_id, contact_id, direction, message_type, source_platform, source_type, 'intentional-extra-fixture' from public.conversation_messages where id = '${fixtureIds.message}'`]), "insert negative extra fixture");
    const negative = psql(database, [
      "--quiet", "--tuples-only", "--no-align",
      `--set=workspace_id=${fixtureIds.workspace}`, `--set=question_id=${fixtureIds.question}`,
      `--set=message_id=${fixtureIds.message}`, `--set=actor_id=${fixtureIds.actor}`,
      "--set=current_status=open", "--set=next_status=in_review",
      "--file", `${remoteRoot}/scripts/operations/open-questions-retention-acceptance.sql`,
    ]);
    assert.equal(negative.status, 3, `real psql \\quit 3 status\n${negative.stdout}\n${negative.stderr}`);
    assert.match(negative.stdout, /open_question_retention_fixture_not_exactly_one_synthetic/u);
    mustSucceed(psql(database, ["--command", "delete from public.conversation_messages where content = 'intentional-extra-fixture'" ]), "remove negative fixture");

    const before = stateSnapshot(database);
    const acceptance = psql(database, [
      "--quiet", "--tuples-only", "--no-align",
      `--set=workspace_id=${fixtureIds.workspace}`, `--set=question_id=${fixtureIds.question}`,
      `--set=message_id=${fixtureIds.message}`, `--set=actor_id=${fixtureIds.actor}`,
      "--set=current_status=open", "--set=next_status=in_review",
      "--file", `${remoteRoot}/scripts/operations/open-questions-retention-acceptance.sql`,
    ]);
    mustSucceed(acceptance, "execute exact retention acceptance harness");
    for (const marker of markers) assert.match(acceptance.stdout, new RegExp(marker, "u"));
    const after = stateSnapshot(database);
    assert.equal(after, before, "data, ACL, and DDL state must be identical after rollback");

    const counts = mustSucceed(psql(database, ["--quiet", "--tuples-only", "--no-align", "--command", `select count(*) || '/' || (select count(*) from public.conversation_messages) || '/' || (select count(*) from public.website_chat_open_question_audit_events) from public.website_chat_open_questions`]), "read terminal counts");
    console.log(`RETENTION_PG17_TESTED_COMMIT=${sourceCommit}`);
    console.log(`RETENTION_PG17_CONTAINER_ID=${inspectedContainerId}`);
    console.log(`RETENTION_PG17_SERVER_VERSION_NUM=${serverVersionNum}`);
    for (const [path, sha] of Object.entries(files)) console.log(`RETENTION_PG17_BLOB=${sha} ${path}`);
    console.log("RETENTION_PG17_QUIT3_STATUS=3");
    console.log(`RETENTION_PG17_MARKERS=${markers.length}/8`);
    console.log(`RETENTION_PG17_TERMINAL_COUNTS_QUESTIONS_MESSAGES_AUDITS=${counts}`);
    console.log(`RETENTION_PG17_ROLLBACK_STATE_SHA256=${createHash("sha256").update(after).digest("hex")}`);
    console.log("RETENTION_PG17_DATA_ACL_DDL_ROLLBACK=PASS");
  } finally {
    if (created) {
      mustSucceed(execInContainer(["dropdb", "--username=postgres", "--force", database]), "drop disposable database");
      const absent = mustSucceed(execInContainer(["psql", "--username=postgres", "--dbname=postgres", "--quiet", "--tuples-only", "--no-align", "--command", `select not exists (select 1 from pg_database where datname = '${database}')`]), "verify cleanup");
      assert.equal(absent, "t");
      execInContainer(["rm", "-rf", remoteRoot]);
      console.log(`RETENTION_PG17_DATABASE=${basename(database)}`);
      console.log("RETENTION_PG17_CLEANUP=PASS");
    }
  }
});

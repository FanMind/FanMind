import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runnerPath = path.join(
  repoRoot,
  "scripts/operations/creator-confirmed-chat-learning-migration-runner.mjs",
);

async function runnerSource() {
  return readFile(runnerPath, "utf8");
}

test("verifier binds reviewed database-function ownership", async () => {
  const runner = await runnerSource();
  assert.match(runner, /EXPECTED_DATABASE_FUNCTION_OWNER = "postgres"/u);
  assert.match(runner, /pg_get_userbyid\(p\.proowner\)::text/u);
  assert.match(runner, /function_owner is distinct from '\$\{EXPECTED_DATABASE_FUNCTION_OWNER\}'/u);
  assert.match(runner, /function_owner text/u);
});

test("verifier preserves exact foundation helper execution boundaries", async () => {
  const runner = await runnerSource();
  assert.match(runner, /creator_learning_foundation_function_privilege_invalid/u);
  assert.match(
    runner,
    /not has_function_privilege\(\s*'authenticated',\s*'public\.creator_workspace_access_allowed\(uuid\)',\s*'EXECUTE'\s*\)/u,
  );
  assert.match(
    runner,
    /not has_function_privilege\(\s*'service_role',\s*'public\.creator_workspace_access_allowed\(uuid\)',\s*'EXECUTE'\s*\)/u,
  );
  assert.match(
    runner,
    /has_function_privilege\(\s*'anon',\s*'public\.creator_workspace_access_allowed\(uuid\)',\s*'EXECUTE'\s*\)/u,
  );
  for (const helper of [
    "workspace_owner_active_mutation_allowed\\(uuid\\)",
    "workspace_processing_allowed_contract\\(text,text,text,boolean,text,text,jsonb,timestamp with time zone\\)",
  ]) {
    assert.match(
      runner,
      new RegExp(
        `not has_function_privilege\\(\\s*'authenticated',\\s*'public\\.${helper}',\\s*'EXECUTE'\\s*\\)`,
        "u",
      ),
    );
    assert.match(
      runner,
      new RegExp(
        `has_function_privilege\\(\\s*'service_role',\\s*'public\\.${helper}',\\s*'EXECUTE'\\s*\\)`,
        "u",
      ),
    );
  }
});

test("verifier rejects competing or later provenance triggers", async () => {
  const runner = await runnerSource();
  assert.match(runner, /creator_learning_manual_send_competing_trigger_invalid/u);
  assert.match(
    runner,
    /t\.tgname <> 'conversation_messages_stamp_creator_learning_manual_send'/u,
  );
  assert.match(
    runner,
    /t\.tgname > 'conversation_messages_stamp_creator_learning_manual_send'/u,
  );
  assert.match(runner, /t\.tgenabled <> 'D'/u);
  assert.match(runner, /\(t\.tgtype & 1\) = 1/u);
  assert.match(runner, /\(t\.tgtype & 2\) = 2/u);
  assert.match(runner, /pg_get_functiondef\(p\.oid\)/u);
  assert.match(runner, /creator_learning_manual_send' in lower/u);
});

test("verifier rejects ready/live standalone unique indexes even when invalid", async () => {
  const runner = await runnerSource();
  const marker = runner.indexOf("creator_learning_unexpected_unique_index");
  assert.notEqual(marker, -1);
  const start = runner.lastIndexOf("if exists (", marker);
  assert.notEqual(start, -1);
  const block = runner.slice(start, marker);
  assert.match(block, /i\.indisunique/u);
  assert.match(block, /i\.indisready/u);
  assert.match(block, /i\.indislive/u);
  assert.doesNotMatch(block, /i\.indisvalid/u);
  assert.match(block, /c\.conindid = i\.indexrelid/u);
  assert.match(block, /c\.contype in \('p','u'\)/u);
});

test("verifier compares CHECK constraints with parser-preserved grouping", async () => {
  const runner = await runnerSource();
  assert.match(runner, /expected_check_sources text\[\]/u);
  assert.match(runner, /pg_get_expr\(conbin, conrelid, true\)/u);
  assert.match(
    runner,
    /explain \(verbose, format json\) select \(%s\) from public\.creator_confirmed_chat_learning where false/u,
  );
  assert.match(runner, /expected_check_plan->0->'Plan'->'Output'->>0/u);
  assert.match(runner, /expected\.definition = any\(check_constraint_defs\)/u);
  assert.doesNotMatch(
    runner,
    /replace\(\s*[^;]*pg_get_constraintdef\(oid, true\)[^;]*['"]\(['"][^;]*['"]\)['"]/u,
  );
});

test("reviewed target execution rejects index suppression and binds control files to the reviewed commit", async () => {
  const runner = await runnerSource();
  assert.match(runner, /REVIEWED_CONTROL_REPO_PATHS/u);
  assert.match(runner, /\["ls-files", "-v", "--", \.\.\.REVIEWED_CONTROL_REPO_PATHS\]/u);
  assert.match(runner, /states\.get\(repoPath\) !== "H"/u);
  assert.match(runner, /checkout_index_flag_invalid/u);
  assert.match(runner, /\["show", `\$\{reviewedCommit\}:\$\{repoPath\}`\]/u);
  assert.match(runner, /checkout_reviewed_file_mismatch/u);
  assert.match(runner, /requireReviewedControlFiles\(reviewedCommit, environment\)/u);
});

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

test("verifier rejects competing provenance triggers", async () => {
  const runner = await runnerSource();
  assert.match(runner, /creator_learning_manual_send_competing_trigger_invalid/u);
  assert.match(
    runner,
    /t\.tgname <> 'conversation_messages_stamp_creator_learning_manual_send'/u,
  );
  assert.match(runner, /t\.tgenabled <> 'D'/u);
  assert.match(runner, /\(t\.tgtype & 1\) = 1/u);
  assert.match(runner, /\(t\.tgtype & 2\) = 2/u);
  assert.match(runner, /pg_get_functiondef\(p\.oid\)/u);
  assert.match(runner, /creator_learning_manual_send' in lower/u);
});

test("verifier rejects behavior-changing standalone unique indexes", async () => {
  const runner = await runnerSource();
  assert.match(runner, /creator_learning_unexpected_unique_index/u);
  assert.match(runner, /i\.indisunique/u);
  assert.match(runner, /c\.conindid = i\.indexrelid/u);
  assert.match(runner, /c\.contype in \('p','u'\)/u);
});

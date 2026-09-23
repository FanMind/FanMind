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

test("verifier binds the exact database name and pins its own trusted search path", async () => {
  const runner = await runnerSource();
  assert.match(runner, /EXPECTED_DATABASE_NAME = "postgres"/u);
  assert.match(
    runner,
    /clean\(environment\.PGDATABASE\) !== EXPECTED_DATABASE_NAME/u,
  );
  assert.match(runner, /database_name_binding_invalid/u);
  assert.match(runner, /set local search_path = pg_catalog;/u);
});

test("verifier rejects owner, inheritance and rewrite-rule drift on the learning table", async () => {
  const runner = await runnerSource();
  assert.match(runner, /not relispartition/u);
  assert.match(
    runner,
    /pg_get_userbyid\(relowner\) = '\$\{EXPECTED_DATABASE_FUNCTION_OWNER\}'/u,
  );
  assert.match(runner, /from pg_inherits/u);
  assert.match(runner, /inhrelid = learning_table or inhparent = learning_table/u);
  assert.match(runner, /creator_learning_inheritance_invalid/u);
  assert.match(runner, /from pg_rewrite/u);
  assert.match(runner, /ev_class = learning_table/u);
  assert.match(runner, /creator_learning_rewrite_rule_invalid/u);
});

test("verifier requires every reviewed foreign-key trigger to remain enabled on both sides", async () => {
  const runner = await runnerSource();
  assert.match(runner, /creator_learning_foreign_key_trigger_invalid/u);
  assert.match(runner, /t\.tgconstraint = c\.oid/u);
  assert.match(runner, /t\.tgisinternal/u);
  assert.match(runner, /t\.tgrelid in \(c\.conrelid,c\.confrelid\)/u);
  assert.match(runner, /<> 4/u);
  assert.match(runner, /t\.tgenabled <> 'O'/u);
});

test("verifier compares the complete reviewed RPC EXECUTE ACL and rejects inherited broadening", async () => {
  const runner = await runnerSource();
  assert.match(runner, /executeRoles: Object\.freeze\(\["service_role"\]\)/u);
  assert.match(runner, /executeRoles: Object\.freeze\(\["authenticated"\]\)/u);
  assert.match(runner, /aclexplode/u);
  assert.match(runner, /acl\.grantee = 0 then 'PUBLIC'/u);
  assert.match(runner, /acl\.grantee <> p\.proowner/u);
  assert.match(runner, /function_execute_grantees is distinct from/u);
  assert.match(runner, /acl\.is_grantable/u);
  assert.match(runner, /creator_learning_function_acl_invalid/u);
  assert.match(runner, /from pg_auth_members membership/u);
  assert.match(runner, /membership\.inherit_option/u);
  assert.match(runner, /creator_learning_function_acl_inheritance_invalid/u);
});

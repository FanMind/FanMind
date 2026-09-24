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

test("provenance verification binds the complete enabled trigger set", async () => {
  const runner = await runnerSource();
  assert.match(runner, /t\.tgrelid = messages_table[\s\S]*not t\.tgisinternal[\s\S]*t\.tgenabled <> 'D'/u);
  assert.match(runner, /t\.tgname not in \([\s\S]*conversation_messages_stamp_creator_learning_manual_send[\s\S]*conversation_messages_whatsapp_identity_immutable/u);
  assert.match(runner, /creator_learning_trigger_set_invalid/u);
  assert.doesNotMatch(runner, /creator_learning_manual_send_competing_trigger_invalid/u);
  assert.match(runner, /creator_learning_whatsapp_identity_trigger_invalid/u);
  assert.match(runner, /creator_learning_whatsapp_identity_function_invalid/u);
  assert.match(runner, /creator_learning_whatsapp_identity_function_acl_invalid/u);
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
  assert.match(runner, /membership\.set_option/u);
  assert.match(runner, /membership\.admin_option/u);
  assert.match(runner, /creator_learning_function_acl_inheritance_invalid/u);
});


test("verifier requires the complete PostgreSQL 17 learning-table ACL", async () => {
  const runner = await runnerSource();
  assert.match(runner, /table_acl_entries text\[\]/u);
  assert.match(runner, /aclexplode\(coalesce\(c\.relacl, acldefault\('r', c\.relowner\)\)\)/u);
  assert.match(runner, /acl\.grantee <> c\.relowner/u);
  assert.match(runner, /acl\.is_grantable::text/u);
  assert.match(runner, /grantor\.rolname/u);
  assert.match(runner, /'authenticated:SELECT:false:postgres'/u);
  for (const privilege of [
    "DELETE",
    "INSERT",
    "MAINTAIN",
    "REFERENCES",
    "SELECT",
    "TRIGGER",
    "TRUNCATE",
    "UPDATE",
  ]) {
    assert.match(runner, new RegExp(`'service_role:${privilege}:false:postgres'`, "u"));
  }
  assert.match(runner, /creator_learning_table_acl_invalid/u);
});

test("verifier safely binds the optional canonical WhatsApp identity trigger", async () => {
  const runner = await runnerSource();
  assert.match(runner, /WHATSAPP_INBOUND_REPO_PATH/u);
  assert.match(
    runner,
    /EXPECTED_WHATSAPP_INBOUND_GIT_BLOB_SHA1 = "2aac4ab447eaf34685aa7fcff3b78be41332c22b"/u,
  );
  assert.match(runner, /functionBodyHash\(\s*foundationSources\.whatsappInbound,\s*"protect_whatsapp_cloud_message_identity"/u);
  assert.match(
    runner,
    /createtriggerconversation_messages_whatsapp_identity_immutablebeforeupdateonconversation_messagesforeachrowexecutefunctionprotect_whatsapp_cloud_message_identity\(\)/u,
  );
  assert.match(runner, /creator_learning_whatsapp_identity_trigger_invalid/u);
  assert.match(runner, /creator_learning_whatsapp_identity_function_invalid/u);
  assert.match(runner, /creator_learning_whatsapp_identity_function_acl_invalid/u);
  assert.match(runner, /securityDefiner: true,[\s\S]*resultType: "trigger",[\s\S]*argNames: null/u);
  assert.match(runner, /array\['service_role'\]::text\[\]/u);
});


test("verifier binds server-side database identity before state inspection", async () => {
  const runner = await runnerSource();
  assert.match(runner, /current_user is distinct from '\$\{EXPECTED_DATABASE_FUNCTION_OWNER\}'/u);
  assert.match(runner, /current_database\(\) is distinct from '\$\{EXPECTED_DATABASE_NAME\}'/u);
  assert.match(runner, /creator_learning_server_identity_invalid/u);
});

test("verifier rejects any unreviewed overload of each learning function", async () => {
  const runner = await runnerSource();
  assert.match(runner, /learningOverloadChecks/u);
  assert.match(runner, /p\.proname = '\$\{contract\.name\}'/u);
  assert.match(runner, /creator_learning_function_overload_invalid/u);
  assert.match(
    runner,
    /p\.proname in \([\s\S]*'stamp_creator_learning_manual_send'[\s\S]*'record_creator_confirmed_chat_proposals'[\s\S]*'confirm_creator_confirmed_chat_outbound'[\s\S]*'link_creator_confirmed_chat_outcomes'/u,
  );
});

test("preinstall state treats the controlled trigger name as partial state", async () => {
  const runner = await runnerSource();
  const marker = runner.indexOf("creator_learning_schema_partial");
  assert.notEqual(marker, -1);
  const block = runner.slice(Math.max(0, marker - 1800), marker);
  assert.match(block, /from pg_trigger t/u);
  assert.match(block, /conversation_messages_stamp_creator_learning_manual_send/u);
});

test("learning RPC metadata binds exact argument names and input modes", async () => {
  const runner = await runnerSource();
  assert.match(runner, /p\.proargnames/u);
  assert.match(runner, /p\.proargmodes/u);
  assert.match(runner, /function_arg_names is distinct from/u);
  assert.match(runner, /function_arg_modes is not null/u);
  for (const argName of [
    "p_workspace_id",
    "p_contact_id",
    "p_conversation_id",
    "p_creator_id",
    "p_creator_revision",
    "p_prompt_revision",
    "p_proposals",
    "p_proposal_id",
    "p_outbound_message_id",
    "p_actor_user_id",
    "p_expected_actual_text",
    "p_reaction_message_id",
    "p_purchase_event_id",
  ]) {
    assert.match(runner, new RegExp(`"${argName}"`, "u"));
  }
});

test("verifier rejects column ACLs and inherited owner privilege", async () => {
  const runner = await runnerSource();
  assert.match(runner, /a\.attacl is not null/u);
  assert.match(runner, /cardinality\(a\.attacl\) > 0/u);
  assert.match(runner, /creator_learning_column_acl_invalid/u);
  assert.match(
    runner,
    /inherited_role\.rolname in \([\s\S]*'service_role',[\s\S]*'authenticated',[\s\S]*'\$\{EXPECTED_DATABASE_FUNCTION_OWNER\}'/u,
  );
});

test("schema-qualified trigger and FK definitions are normalized before exact comparison", async () => {
  const runner = await runnerSource();
  assert.match(
    runner,
    /replace\(lower\(coalesce\(trigger_def, ''\)\), 'public\.', ''\)/u,
  );
  assert.match(
    runner,
    /replace\(lower\(pg_get_constraintdef\(oid\)\), 'public\.', ''\)/u,
  );
});


test("verifier pins the provenance table owner before accepting RLS", async () => {
  const runner = await runnerSource();
  assert.match(
    runner,
    /where oid = messages_table[\\s\\S]*pg_get_userbyid\\(relowner\\) = '\\$\\{EXPECTED_DATABASE_FUNCTION_OWNER\\}'[\\s\\S]*relrowsecurity[\\s\\S]*not relforcerowsecurity/u,
  );
  assert.match(runner, /creator_learning_provenance_inheritance_invalid/u);
});

test("verifier rejects provenance rewrite rules and generated or identity manual-send markers", async () => {
  const runner = await runnerSource();
  assert.match(runner, /ev_class = messages_table/u);
  assert.match(runner, /creator_learning_provenance_rewrite_rule_invalid/u);
  assert.match(runner, /a\.attgenerated = ''/u);
  assert.match(runner, /a\.attidentity = ''/u);
  assert.match(runner, /creator_learning_manual_send_column_invalid/u);
});

test("controlled database sessions pin the search path before VERIFY or APPLY", async () => {
  const runner = await runnerSource();
  assert.match(
    runner,
    /"-c search_path=pg_catalog -c statement_timeout=60000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=60000"/u,
  );
});

test("verifier requires public schema usage for reviewed authenticated and service callers", async () => {
  const runner = await runnerSource();
  assert.match(runner, /has_schema_privilege\('authenticated', 'public', 'USAGE'\)/u);
  assert.match(runner, /has_schema_privilege\('service_role', 'public', 'USAGE'\)/u);
  assert.match(runner, /creator_learning_schema_usage_invalid/u);
});


test("target prerequisites precede ABSENT and bind provenance RLS", async () => {
  const runner = await runnerSource();
  const absent = runner.indexOf("if learning_table is null then");
  assert.ok(absent > 0);
  for (const marker of [
    "creator_learning_provenance_inheritance_invalid",
    "creator_learning_provenance_rewrite_rule_invalid",
    "creator_learning_service_role_rls_invalid",
    "creator_learning_function_acl_inheritance_invalid",
    "creator_learning_schema_usage_invalid",
    "creator_learning_manual_send_constraint_invalid",
    "creator_learning_provenance_policy_invalid",
    "creator_learning_trigger_set_invalid",
  ]) assert.ok(runner.indexOf(marker) < absent, marker);
  assert.match(runner, /conversation_messages_insert_requires_workspace_owner/u);
  assert.match(runner, /conversation_messages_update_requires_workspace_owner/u);
  assert.match(runner, /conversation_messages_delete_requires_workspace_owner/u);
});

test("all learning columns and marker missing-value state remain ordinary", async () => {
  const runner = await runnerSource();
  assert.match(runner, /a\.attgenerated <> ''/u);
  assert.match(runner, /a\.attidentity <> ''/u);
  assert.match(runner, /not a\.atthasmissing or a\.attmissingval = '\{f\}'::boolean\[\]/u);
  assert.match(runner, /and not relforcerowsecurity/u);
});

test("reviewed functions reject planner support and bind helper arguments", async () => {
  const runner = await runnerSource();
  assert.match(runner, /p\.prosupport/u);
  assert.equal(runner.match(/function_support is distinct from 0::oid/gu)?.length, 2);
  for (const name of ["p_workspace_id", "p_workspace_access_mode", "p_evaluated_at"])
    assert.match(runner, new RegExp(`"${name}"`, "u"));
});

test("canonical authenticator membership is the only controlled-role exception", async () => {
  const runner = await runnerSource();
  assert.match(runner, /member_role\.rolname = 'authenticator'/u);
  assert.match(runner, /not membership\.inherit_option/u);
  assert.match(runner, /membership\.set_option/u);
  assert.match(runner, /not membership\.admin_option/u);
});

test("indexes and internal FK triggers retain complete reviewed integrity", async () => {
  const runner = await runnerSource();
  assert.match(runner, /creator_learning_unexpected_expression_or_partial_index/u);
  assert.match(runner, /creator_learning_constraint_index_invalid/u);
  assert.match(runner, /not i\.indisunique[\s\S]*not i\.indisvalid[\s\S]*not i\.indisready[\s\S]*not i\.indislive/u);
  assert.match(runner, /c\.confrelid = learning_table/u);
  assert.match(runner, /t\.tgrelid = learning_table/u);
});

test("APPLY preflight migration and postflight share one locked transaction", async () => {
  const runner = await runnerSource();
  assert.match(runner, /function buildAtomicApplySql/u);
  assert.match(runner, /pg_advisory_xact_lock/u);
  assert.match(runner, /lock table public\.conversation_messages in access exclusive mode/u);
  assert.match(runner, /database\(buildAtomicApplySql\(sql, verifySql\)\)/u);
});

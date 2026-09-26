import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const moduleUrl = new URL("../scripts/operations/creator-foundation-reconciliation-catalog.mjs", import.meta.url);
let catalogModule;
try { catalogModule = await import(moduleUrl); } catch (error) {
  if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
}

// Strip SQL literals/comments before checking executable tokens. This is a
// deliberately small lexer, not a substitute for the PostgreSQL CI execution.
function statements(sql) {
  assert.doesNotMatch(sql, /\$[A-Za-z_]*\$/u, "dollar quoting is unnecessary in this fixed query");
  return sql.replace(/'(?:''|[^'])*'/gu, "''").replace(/--[^\n]*/gu, "")
    .split(";").map((part) => part.trim()).filter(Boolean);
}

test("catalog generator is present and refuses every caller-supplied argument", () => {
  assert.equal(typeof catalogModule?.buildCreatorFoundationCatalogSql, "function");
  const build = catalogModule.buildCreatorFoundationCatalogSql;
  assert.equal(build.length, 0);
  for (const input of [undefined, null, {}, "public.creators; DROP TABLE public.creators;"]) {
    assert.throws(() => build(input), /CREATOR_FOUNDATION_CATALOG_ERROR=unexpected_input/u);
  }
  assert.equal(build(), build());
});

test("catalog SQL is one fixed catalog SELECT inside a read-only snapshot", () => {
  assert.equal(typeof catalogModule?.buildCreatorFoundationCatalogSql, "function");
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const commands = statements(sql);
  assert.equal(commands[0], "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  assert.equal(commands.at(-1), "ROLLBACK");
  assert.deepEqual(commands.slice(1, -2).map((value) => value.split(" = ")[0]), [
    "SET LOCAL search_path", "SET LOCAL statement_timeout", "SET LOCAL lock_timeout", "SET LOCAL TimeZone", "SET LOCAL DateStyle",
  ]);
  assert.match(commands.at(-2), /^WITH RECURSIVE\b/u);
  assert.doesNotMatch(commands.at(-2), /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|GRANT|REVOKE|COPY|CALL|DO|EXECUTE|INTO|COMMIT|SET|RESET)\b/iu);
  assert.doesNotMatch(sql, /(?:FROM|JOIN)\s+(?:public|auth)\./iu, "never read application data");
  assert.doesNotMatch(sql, /\b(?:dblink|pg_read_file|pg_ls_dir|set_config|pg_advisory|pg_sleep)\b/iu);
  assert.doesNotMatch(sql, /(?:rolpassword|pg_authid|pg_get_functiondef)/iu);
  assert.doesNotMatch(readFileSync(moduleUrl, "utf8"), /(?:from\s+["']node:|process\.|fetch\(|execFile|spawn\()/u);
});

test("catalog captures complete function overloads and connected role grants without numeric identities", () => {
  assert.equal(typeof catalogModule?.buildCreatorFoundationCatalogSql, "function");
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  for (const name of ["guard_creator_identity", "save_creator_bundle", "record_creator_fan_review", "creator_workspace_access_allowed"]) assert.ok(sql.includes(`'${name}'`));
  for (const field of ["proargnames", "proargmodes", "proallargtypes", "proargdefaults", "proconfig", "provariadic", "prosupport", "prosqlbody", "protrftypes", "proisstrict", "proleakproof", "proparallel", "proretset", "prokind", "procost", "prorows"]) assert.ok(sql.includes(field), field);
  for (const field of ["grantor", "inherit_option", "set_option", "admin_option"]) assert.ok(sql.includes(field), field);
  assert.match(sql, /role_component\(oid\) AS/u);
  assert.match(sql, /m\.roleid = rc\.oid OR m\.member = rc\.oid/u);
  assert.match(sql, /'bodySha256',pg_catalog\.encode\(pg_catalog\.sha256\(pg_catalog\.convert_to\(p\.prosrc,'UTF8'\)\),'hex'\)/u);
  assert.doesNotMatch(sql, /bodyMd5|pg_catalog\.md5\(/u);
  assert.doesNotMatch(sql, /'[A-Za-z]*(?:Oid|OID)'\s*,/u);
  for (const field of ["schemaVersion", "observedAt", "pgMajor", "catalog", "parentChecks", "allSatisfied"]) assert.ok(sql.includes(`'${field}'`));
});

test("namespace export includes direct and effective browser creation and usage rights", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const namespaceStart = sql.indexOf("namespace_rows AS (");
  assert.ok(namespaceStart > 0, "namespace export is required");
  const namespaceRows = sql.slice(namespaceStart, sql.indexOf("table_rows AS (", namespaceStart));
  assert.match(namespaceRows, /n\.nspname IN \('public','auth'\)/u);
  assert.match(namespaceRows, /pg_catalog\.aclexplode\(COALESCE\(n\.nspacl,pg_catalog\.acldefault\('n',n\.nspowner\)\)\)/u);
  assert.match(namespaceRows, /pg_catalog\.has_schema_privilege\(r\.oid,n\.oid,v\.name\)/u);
  assert.match(namespaceRows, /pg_catalog\.has_schema_privilege\(r\.oid,n\.oid,v\.name \|\| ' WITH GRANT OPTION'\)/u);
  assert.match(namespaceRows, /VALUES \('USAGE'\),\('CREATE'\)/u);
  assert.match(sql, /'namespaces',COALESCE\(\(SELECT pg_catalog\.jsonb_agg\(row ORDER BY row::text COLLATE "C"\) FROM namespace_rows\)/u);
});

test("auth UID overloads have the same complete body and metadata contract in a distinct section", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const functionRows = sql.slice(sql.indexOf("function_rows AS ("), sql.indexOf("parent_checks AS ("));
  assert.match(functionRows, /OR \(n\.nspname = 'auth' AND p\.proname = 'uid'\)/u);
  assert.match(sql, /'functions',[^\n]+FROM function_rows WHERE row->>'schema' = 'public'/u);
  assert.match(sql, /'authUidFunctions',[^\n]+FROM function_rows WHERE row->>'schema' = 'auth'/u);
  assert.doesNotMatch(functionRows, /p\.pronargs\s*=|p\.proargtypes\s*=/u, "unexpected auth.uid overloads must be visible");
});

test("role graph includes the authority owning the fixed schemas and every auth UID overload", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const graph = sql.slice(sql.indexOf("role_component(oid) AS ("), sql.indexOf("relevant_memberships AS ("));
  assert.match(graph, /SELECT d\.datdba FROM pg_catalog\.pg_database d WHERE d\.datname = pg_catalog\.current_database\(\)/u);
  assert.match(sql, /databaseOwnerPostgres/u);
  assert.match(graph, /SELECT n\.nspowner FROM pg_catalog\.pg_namespace n WHERE n\.nspname IN \('public','auth'\)/u);
  assert.match(graph, /SELECT p\.proowner FROM pg_catalog\.pg_proc p JOIN pg_catalog\.pg_namespace n ON n\.oid = p\.pronamespace/u);
  assert.match(graph, /WHERE n\.nspname = 'auth' AND p\.proname = 'uid'/u);
  assert.doesNotMatch(graph, /UNION ALL/u, "recursive role expansion must remain cycle-safe");
});

test("parent privacy checks reject column-only anonymous access outside managed columns", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const check = sql.slice(sql.indexOf("'anonProfileDenied'"), sql.indexOf("'authenticatedProfileWriteDenied'"));
  assert.match(check, /NOT pg_catalog\.has_any_column_privilege\(r\.oid,c\.oid,'SELECT,INSERT,UPDATE,REFERENCES'\)/u);
});

test("catalog marks Admin CRM variants and follows membership rights instead of unrelated grants by postgres", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  assert.match(sql, /'adminCrmContractAbsent',pg_catalog\.to_regprocedure\('public\.admin_crm_read_allowed\(uuid\)'\) IS NULL/u);
  const graph = sql.slice(sql.indexOf("role_component(oid) AS"), sql.indexOf("table_rows AS"));
  assert.match(graph, /m\.roleid = rc\.oid OR m\.member = rc\.oid/u);
  assert.doesNotMatch(graph, /m\.grantor = rc\.oid|m\.grantor IN \(SELECT oid FROM role_component\)/u);
  assert.match(graph, /UNION SELECT grantor FROM relevant_memberships/u);
});

test("parent tables and policies use complete metadata in separate result sections", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const parents = sql.slice(sql.indexOf("parent_relations AS ("), sql.indexOf("managed_relations AS ("));
  assert.match(parents, /'workspaces','workspace_members','contacts','conversations','contact_ai_profiles'/u);
  assert.match(sql, /AS relation_oid[\s\S]+FROM all_table_relations c LEFT JOIN pg_catalog\.pg_am/u);
  assert.match(sql, /AS relation_oid[\s\S]+FROM all_table_relations c JOIN pg_catalog\.pg_policy/u);
  for (const [section, rows] of [["tables", "table_rows"], ["policies", "policy_rows"]]) {
    assert.match(sql, new RegExp(`'${section}',[^\\n]+FROM ${rows} WHERE relation_oid IN \\(SELECT oid FROM creator_relations\\)`));
    const parentSection = `parent${section[0].toUpperCase()}${section.slice(1)}`;
    assert.match(sql, new RegExp(`'${parentSection}',[^\\n]+FROM ${rows} WHERE relation_oid IN \\(SELECT oid FROM parent_relations\\)`));
  }
});

test("all parent columns include ACLs while existing managed-column coverage stays bounded", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const columns = sql.slice(sql.indexOf("column_rows AS ("), sql.indexOf("constraint_rows AS ("));
  assert.match(columns, /SELECT c\.oid AS relation_oid,/u);
  assert.match(columns, /FROM all_table_relations c JOIN pg_catalog\.pg_attribute a ON a\.attrelid = c\.oid/u);
  assert.match(columns, /WHERE a\.attnum > 0 AND NOT a\.attisdropped\s*\),\s*$/u);
  assert.match(columns, /c\.oid IN \(SELECT oid FROM creator_relations\)/u);
  assert.match(columns, /c\.relname = 'conversations' AND a\.attname IN \('sales_state','sales_state_updated_at','sales_state_source'\)/u);
  assert.match(columns, /c\.relname = 'contact_ai_profiles' AND a\.attname = 'commercial_profile'\)\) AS creator_managed/u);
  assert.match(columns, /pg_catalog\.aclexplode\(a\.attacl\)/u);
  assert.match(columns, /pg_catalog\.has_column_privilege\(r\.oid,c\.oid,a\.attnum,v\.name\)/u);
  assert.match(columns, /pg_catalog\.has_column_privilege\(r\.oid,c\.oid,a\.attnum,v\.name \|\| ' WITH GRANT OPTION'\)/u);
  assert.match(sql, /'columns',[^\n]+FROM column_rows WHERE creator_managed/u);
  assert.match(sql, /'parentColumns',[^\n]+FROM column_rows WHERE relation_oid IN \(SELECT oid FROM parent_relations\)/u);
  const constraints = sql.slice(sql.indexOf("constraint_rows AS ("), sql.indexOf("index_rows AS ("));
  assert.match(constraints, /c\.oid IN \(SELECT oid FROM managed_relations\) AND k\.conname IN/u);
});

test("parent constraints indexes and triggers share the complete Creator projections", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  for (const [section, rows, next, source] of [
    ["constraints", "constraint_rows", "index_rows", "pg_constraint"],
    ["indexes", "index_rows", "policy_rows", "pg_index"],
    ["triggers", "trigger_rows", "function_rows", "pg_trigger"],
  ]) {
    const projection = sql.slice(sql.indexOf(`${rows} AS (`), sql.indexOf(`${next} AS (`));
    assert.match(projection, /SELECT c\.oid AS relation_oid,/u);
    assert.match(projection, new RegExp(`FROM all_table_relations c JOIN pg_catalog\\.${source}`));
    const parentSection = `parent${section[0].toUpperCase()}${section.slice(1)}`;
    assert.match(sql, new RegExp(`'${parentSection}',[^\\n]+FROM ${rows} WHERE relation_oid IN \\(SELECT oid FROM parent_relations\\)`));
    const scope = section === "constraints" ? "creator_managed" : "relation_oid IN \\(SELECT oid FROM creator_relations\\)";
    assert.match(sql, new RegExp(`'${section}',[^\\n]+FROM ${rows} WHERE ${scope}`));
  }
});

test("parent function discovery covers trigger expression and rule execution surfaces", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const objects = sql.slice(sql.indexOf("parent_object_function_edges AS ("), sql.indexOf("parent_function_component(oid) AS ("));
  assert.match(objects, /t\.tgfoid AS target_oid/u);
  assert.match(objects, /SELECT 'trigger',c\.nspname,c\.relname,t\.tgname,d\.refobjid,d\.deptype/u, "trigger WHEN helpers must also enter the function contract");
  for (const [kind, catalog] of [["constraint", "pg_constraint"], ["index", "pg_class"], ["default", "pg_attrdef"], ["rule", "pg_rewrite"]]) {
    assert.ok(objects.includes(`'${kind}'`), kind);
    assert.ok(objects.includes(`d.classid = 'pg_catalog.${catalog}'::pg_catalog.regclass`), catalog);
  }
  assert.match(objects, /d\.refclassid = 'pg_catalog\.pg_proc'::pg_catalog\.regclass/u);
  const component = sql.slice(sql.indexOf("parent_function_component(oid) AS ("), sql.indexOf("browser_roles(name) AS"));
  assert.match(component, /SELECT target_oid FROM parent_object_function_edges/u);
  assert.match(sql, /FROM parent_object_function_edges e JOIN pg_catalog\.pg_proc p ON p\.oid = e\.target_oid/u);
});

test("trigger WHEN uses PostgreSQL's trigger deparser with its OLD and NEW context", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  assert.doesNotMatch(sql, /pg_catalog\.pg_get_expr\(t\.tgqual/u);
  assert.match(sql, /pg_catalog\.pg_get_triggerdef\(t\.oid,false\)/u);
  assert.match(sql, /WHEN t\.tgqual IS NULL THEN NULL/u);
  assert.match(sql, /pg_catalog\.length\(pg_catalog\.quote_ident\(t\.tgname\)\)/u);
  assert.doesNotMatch(sql, /regexp_replace/u, "never erase conditions while stabilizing an internal name");
});

test("parent helper export follows policy and function dependencies without losing unknown helpers", () => {
  const sql = catalogModule.buildCreatorFoundationCatalogSql();
  const policyEdges = sql.slice(sql.indexOf("parent_policy_function_edges AS ("), sql.indexOf("parent_function_component(oid) AS ("));
  assert.match(policyEdges, /d\.classid = 'pg_catalog\.pg_policy'::pg_catalog\.regclass AND d\.objid = pol\.oid/u);
  assert.match(policyEdges, /d\.refclassid = 'pg_catalog\.pg_proc'::pg_catalog\.regclass/u);
  assert.match(policyEdges, /n\.nspname <> 'pg_catalog'/u);
  const component = sql.slice(sql.indexOf("parent_function_component(oid) AS ("), sql.indexOf("browser_roles(name) AS"));
  assert.match(component, /'workspace_owner_active_mutation_allowed','workspace_processing_allowed_contract'/u);
  assert.match(component, /SELECT target_oid FROM parent_policy_function_edges/u);
  assert.match(component, /FROM parent_function_component fc JOIN pg_catalog\.pg_depend d/u);
  assert.match(component, /d\.classid = 'pg_catalog\.pg_proc'::pg_catalog\.regclass AND d\.objid = fc\.oid/u);
  assert.match(component, /d\.refclassid = 'pg_catalog\.pg_proc'::pg_catalog\.regclass/u);
  assert.match(component, /n\.nspname <> 'pg_catalog'/u);
  assert.doesNotMatch(component, /UNION ALL/u, "recursive function dependencies must terminate on cycles");
  assert.match(sql, /'parentFunctions',[^\n]+WHERE function_oid IN \(SELECT oid FROM parent_function_component\) AND NOT \(row->>'schema' = 'auth' AND row->>'name' = 'uid'\)/u);
  assert.match(sql, /'parentDependencies',[^\n]+FROM parent_dependency_rows/u);
  for (const field of ["sourceKind", "sourceSchema", "sourceTable", "sourceName", "targetSchema", "targetIdentity", "dependencyType"]) assert.ok(sql.includes(`'${field}'`), field);
  const graph = sql.slice(sql.indexOf("role_component(oid) AS ("), sql.indexOf("relevant_memberships AS ("));
  assert.match(graph, /SELECT c\.relowner FROM parent_relations c/u);
  assert.match(graph, /SELECT p\.proowner FROM pg_catalog\.pg_proc p WHERE p\.oid IN \(SELECT oid FROM parent_function_component\)/u);
});

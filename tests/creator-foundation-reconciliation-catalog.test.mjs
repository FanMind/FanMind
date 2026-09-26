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

#!/usr/bin/env node
// SOURCE-ONLY. This program has no database, HTTP, workflow or mutation transport.
// Exact means an exported catalog matches an independently pinned PG17 reference;
// it is never a target acceptance, learning-schema verdict or permission to apply.
import { createHash } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const CREATOR_FOUNDATION_SOURCE_PINS = Object.freeze({
  legacyFoundation: Object.freeze({path: "./creator-foundation-reconciliation-artifacts/legacy-foundation.sql", sha256: "8065596853f07feffd419ac1473a34fe727a6152f1f742161af16a909d2f457f", gitBlob: "ebb7c91b799c687a57c251a3f4c0da3699a988d7"}),
  legacyConflict: Object.freeze({path: "./creator-foundation-reconciliation-artifacts/legacy-pt409.sql", sha256: "7e1111357bf1b210023fe43913d11247f3fe6eea32d1a7440b8079d988e671ee", gitBlob: "fac1c49afbd738bd6f2a5469321ab78eedbdfaa6"}),
  currentFoundation: Object.freeze({path: "../../supabase/controlled/creator_intelligence_foundation.sql", sha256: "d892c74c0285487f1e786dddea90cbc5cb3102f794de0b5037e48295d2a61f4b", gitBlob: "e6b9936a663915087c35d58f6fd2e382d2a4e025"}),
  currentConflict: Object.freeze({path: "../../supabase/controlled/creator_revision_conflict_fix.sql", sha256: "d3e984bfd7ef240c63d0e47431d25ca9f21a18d0287b25375830a1a721d88e3f", gitBlob: "c2132db39e141131483afc44d045d21d632b1672"}),
});
const TABLES = ["creators", "creator_voice_profiles", "creator_sales_playbooks", "creator_commercial_events"];
const SECTIONS = ["tables", "columns", "constraints", "indexes", "policies", "triggers", "functions", "parentChecks", "roles", "memberships"];
const CORE_SECTIONS = SECTIONS.filter(key => !["roles", "memberships"].includes(key));
const CHECKS = ["pg17", "parentTablesRls", "parentUuidColumnsReadable", "authUsersPresent", "authUidPresent", "anonProfileDenied", "authenticatedProfileWriteDenied", "profileWorkspaceContactUnique", "adminCrmContractAbsent", "allSatisfied"];
const ROW_KEYS = {
  tables: "schema table owner kind persistence rowSecurity forceRowSecurity isPartition replicaIdentity accessMethod options directAcl effectiveAcl parents children rewriteRules".split(" "),
  columns: "schema table name type notNull identity generated default collation dimensions storage compression isLocal inheritanceCount directAcl effectiveAcl".split(" "),
  constraints: "schema table name type validated deferrable deferred isLocal inheritanceCount noInherit definition columns foreignSchema foreignTable foreignColumns updateAction deleteAction matchType deleteSetColumns parentConstraint index exclusionOperators foreignEqualityOperators parentEqualityOperators childEqualityOperators".split(" "),
  indexes: "schema table name owner kind persistence accessMethod options valid ready live unique primary exclusion immediate clustered replicaIdentity checkXmin nullsNotDistinct attributeCount keyAttributeCount definition expressions predicate columns collations operatorClasses columnOptions".split(" "),
  policies: "schema table name command permissive roles using check".split(" "),
  triggers: "schema table name internal type enabled deferrable deferred function argumentCount argumentsHex when columns constraint constraintRelation constraintIndex parent oldTransitionTable newTransitionTable".split(" "),
  functions: "schema name identity owner language bodyMd5 binary sqlBodyPresent kind securityDefiner leakproof strict returnsSet volatility parallel cost rows inputCount defaultCount returnType argTypes allArgTypes argModes argNames defaults variadicType support transformTypes config directAcl effectiveAcl".split(" "),
  roles: "name superuser inherit createRole createDb canLogin replication bypassRls connectionLimit validUntil config".split(" "),
  memberships: "role member grantor adminOption inheritOption setOption".split(" "),
};
const FUNCTIONS = [
  ["guard_creator_identity", "guard_creator_identity()"],
  ["save_creator_bundle", "save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean)"],
  ["record_creator_fan_review", "record_creator_fan_review(uuid,uuid,jsonb,jsonb)"],
  ["creator_workspace_access_allowed", "creator_workspace_access_allowed(uuid)"],
];
const MAX_BYTES = 2 * 1024 * 1024;
const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
const digest = (value, algorithm = "sha256") => createHash(algorithm).update(value).digest("hex");
const fail = code => { throw new Error(`CREATOR_FOUNDATION_RECONCILIATION_ERROR=${code}`); };

export function verifyCreatorFoundationSource(name, sql) {
  const pin = CREATOR_FOUNDATION_SOURCE_PINS[name];
  if (!pin || typeof sql !== "string" || digest(sql) !== pin.sha256 || digest(`blob ${Buffer.byteLength(sql)}\0${sql}`, "sha1") !== pin.gitBlob) fail("artifact_checksum");
  return sql;
}

export function loadPinnedCreatorFoundationSources() {
  return Object.fromEntries(Object.entries(CREATOR_FOUNDATION_SOURCE_PINS).map(([name, pin]) =>
    [name, verifyCreatorFoundationSource(name, readFileSync(new URL(pin.path, import.meta.url), "utf8"))]));
}

function sourceIdentities() {
  return Object.fromEntries(Object.entries(CREATOR_FOUNDATION_SOURCE_PINS).map(([name, pin]) => [name, {sha256: pin.sha256, gitBlob: pin.gitBlob}]));
}

// Object key order is irrelevant. Nested arrays remain ordered: argument names,
// composite key columns and index options are positional security contracts.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const equal = (left, right) => JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const unorderedRows = value => Array.isArray(value) ? value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))) : value;

function expectedFunctions(variant, sources) {
  const foundation = sources[`${variant}Foundation`];
  const conflict = sources[`${variant}Conflict`];
  return FUNCTIONS.slice(0, variant === "legacy" ? 3 : 4).map(([name, identity]) => {
    const sql = name === "save_creator_bundle" ? conflict : foundation;
    const match = sql.match(new RegExp(`create(?: or replace)? function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, "u"));
    if (!match) fail("function_source_contract");
    return {name, identity, bodyMd5: digest(match[1], "md5")};
  });
}

function coverage(snapshot) {
  const missing = [];
  if (!object(snapshot) || snapshot.schemaVersion !== 1 || snapshot.pgMajor !== 17 || typeof snapshot.observedAt !== "string" || !Number.isFinite(Date.parse(snapshot.observedAt))) missing.push("snapshot_envelope");
  const catalog = snapshot?.catalog;
  if (!object(catalog)) return [...missing, ...SECTIONS.map(key => `catalog_${key}`)];
  for (const key of SECTIONS) {
    if (key === "parentChecks") {
      if (!object(catalog[key]) || CHECKS.some(check => typeof catalog[key][check] !== "boolean")) missing.push(`catalog_${key}`);
    } else if (!Array.isArray(catalog[key]) || catalog[key].some(row => !object(row) || (ROW_KEYS[key] ?? []).some(field => !Object.hasOwn(row, field)))) missing.push(`catalog_${key}`);
  }
  if (Array.isArray(catalog.tables) && (!equal(catalog.tables.map(row => row?.table).sort(), [...TABLES].sort()) || catalog.tables.some(row => row?.schema !== "public"))) missing.push("creator_table_inventory");
  for (const key of ["columns", "constraints", "indexes", "policies", "triggers"]) {
    if (Array.isArray(catalog[key]) && TABLES.some(table => !catalog[key].some(row => row?.schema === "public" && row?.table === table))) missing.push(`creator_${key}_inventory`);
  }
  if (Array.isArray(catalog.functions) && ![3, 4].includes(catalog.functions.length)) missing.push("creator_function_inventory");
  if (Array.isArray(catalog.roles) && ["anon", "authenticated", "service_role", "authenticator", "postgres"].some(name => !catalog.roles.some(row => row?.name === name))) missing.push("role_inventory");
  return [...new Set(missing)];
}

function functionsMatch(catalog, variant, sources) {
  const expected = expectedFunctions(variant, sources);
  return Array.isArray(catalog?.functions) && catalog.functions.length === expected.length && expected.every(fn => catalog.functions.some(row => row.schema === "public" && row.name === fn.name && row.identity === fn.identity && row.bodyMd5 === fn.bodyMd5));
}

export function compareCreatorFoundationCatalogs(actual, expected) {
  return SECTIONS.filter(key => !equal(unorderedRows(actual?.[key]), unorderedRows(expected?.[key])));
}

// Call this only with exports from the isolated PG17 fixture that executed the
// pinned historical/current artifacts. Its serialized output must be reviewed
// and SHA256-pinned independently before classification. A hash embedded inside
// a caller-supplied reference is never a trust root.
export function buildCreatorFoundationReference({legacy, current, roleProfile, querySha256}) {
  const sources = loadPinnedCreatorFoundationSources();
  for (const [variant, snapshot] of Object.entries({legacy, current})) {
    if (coverage(snapshot).length || CHECKS.some(key => snapshot.catalog.parentChecks[key] !== true) || !functionsMatch(snapshot.catalog, variant, sources)) fail("reference_incomplete");
  }
  if (!object(roleProfile) || !Array.isArray(roleProfile.roles) || !Array.isArray(roleProfile.memberships) || !Array.isArray(roleProfile.provenance) || !/^[a-f0-9]{64}$/u.test(querySha256 ?? "")) fail("reference_incomplete");
  const reference = {
    schemaVersion: 1,
    scope: "creator_foundation_catalog_only",
    sourcePins: sourceIdentities(),
    querySha256,
    variants: Object.fromEntries(Object.entries({legacy, current}).map(([variant, snapshot]) => [variant, Object.fromEntries(CORE_SECTIONS.map(key => [key, snapshot.catalog[key]]))])),
    roleProfile,
  };
  return reference;
}

export function classifyCreatorFoundationSnapshot(snapshot, {referenceJson, trustedReferenceSha256, expectedQuerySha256} = {}) {
  const sources = loadPinnedCreatorFoundationSources();
  const blockers = coverage(snapshot);
  const result = {
    status: "INCOMPLETE", scope: "creator_foundation_catalog_only", targetAccepted: false,
    learningState: "UNDETERMINED", applyAllowed: false, runtimeActivated: false,
    blockers, differingSections: [],
  };
  if (snapshot?.catalog?.parentChecks?.adminCrmContractAbsent === false || (Array.isArray(snapshot?.catalog?.policies) && snapshot.catalog.policies.some(row => row?.name === "admin_crm_entitlement_boundary"))) {
    blockers.push("admin_crm_variant_unreviewed");
    return result;
  }
  if (!/^[a-f0-9]{64}$/u.test(trustedReferenceSha256 ?? "")) blockers.push("reference_pin_missing");
  else if (typeof referenceJson !== "string" || Buffer.byteLength(referenceJson) > MAX_BYTES || digest(referenceJson) !== trustedReferenceSha256) blockers.push("reference_pin_mismatch");
  if (blockers.includes("reference_pin_missing") || blockers.includes("reference_pin_mismatch")) return result;
  let reference;
  try { reference = JSON.parse(referenceJson); } catch { blockers.push("reference_invalid"); return result; }
  if (!object(reference) || reference.schemaVersion !== 1 || reference.scope !== result.scope || !equal(reference.sourcePins, sourceIdentities()) || !/^[a-f0-9]{64}$/u.test(expectedQuerySha256 ?? "") || reference.querySha256 !== expectedQuerySha256) {
    blockers.push("reference_contract"); return result;
  }
  const profile = reference.roleProfile;
  if (!object(profile) || !Array.isArray(profile.roles) || !Array.isArray(profile.memberships) || !Array.isArray(profile.provenance)) { blockers.push("role_provenance_missing"); return result; }
  // Every individual grant (including its grantor and options) needs provenance.
  // Names such as supabase_* never bypass this exact allowlist comparison.
  if (profile.memberships.some(edge => !profile.provenance.some(entry => equal(entry.membership, edge) && typeof entry.source === "string" && /^https:\/\/github\.com\/supabase\/(postgres|realtime)\/blob\/[a-f0-9]{40}\//u.test(entry.source)))) {
    blockers.push("role_provenance_missing"); return result;
  }
  for (const variant of ["legacy", "current"]) {
    const candidate = {schemaVersion: 1, pgMajor: 17, observedAt: "2026-09-26T00:00:00.000Z", catalog: {...reference.variants?.[variant], roles: profile.roles, memberships: profile.memberships}};
    if (coverage(candidate).length || CHECKS.some(key => candidate.catalog.parentChecks[key] !== true) || !functionsMatch(candidate.catalog, variant, sources)) blockers.push(`reference_${variant}_incomplete`);
  }
  if (blockers.length) return result;
  const common = {roles: profile.roles, memberships: profile.memberships};
  const comparisons = Object.fromEntries(["legacy", "current"].map(variant => [variant, compareCreatorFoundationCatalogs(snapshot.catalog, {...reference.variants[variant], ...common})]));
  if (snapshot.catalog.parentChecks.allSatisfied && comparisons.legacy.length === 0) result.status = "LEGACY_EXACT";
  else if (snapshot.catalog.parentChecks.allSatisfied && comparisons.current.length === 0) result.status = "CURRENT_EXACT";
  else {
    result.status = "DRIFT";
    result.differingSections = [...new Set([...comparisons.legacy, ...comparisons.current])].sort();
    result.blockers.push("catalog_differs_from_pinned_reference");
  }
  return result;
}

function readBoundedFile(path) {
  let fd;
  try {
    fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size < 1 || stat.size > MAX_BYTES) fail("input_file_invalid");
    return readFileSync(fd, "utf8");
  } finally { if (fd !== undefined) closeSync(fd); }
}

export async function main(args = process.argv.slice(2)) {
  const mode = args[0] ?? "--check";
  loadPinnedCreatorFoundationSources();
  const {buildCreatorFoundationCatalogSql} = await import("./creator-foundation-reconciliation-catalog.mjs");
  const sql = buildCreatorFoundationCatalogSql();
  if (mode === "--check" && args.length <= 1) return {output: "CREATOR_FOUNDATION_RECONCILIATION_SOURCE=VERIFIED\nCREATOR_FOUNDATION_RECONCILIATION_TRANSPORT=NONE", exitCode: 0};
  if (mode === "--sql" && args.length === 1) return {output: sql, exitCode: 0};
  if (mode === "--build-reference" && args.length === 7 && args[1] === "--legacy" && args[3] === "--current" && args[5] === "--role-profile") {
    const reference = buildCreatorFoundationReference({legacy: JSON.parse(readBoundedFile(args[2])), current: JSON.parse(readBoundedFile(args[4])), roleProfile: JSON.parse(readBoundedFile(args[6])), querySha256: digest(sql)});
    return {output: JSON.stringify(reference), exitCode: 0};
  }
  if (mode !== "--classify" || args.length !== 7 || args[1] !== "--snapshot" || args[3] !== "--reference" || args[5] !== "--reference-sha256") fail("mode_invalid");
  const snapshot = JSON.parse(readBoundedFile(args[2]));
  const result = classifyCreatorFoundationSnapshot(snapshot, {referenceJson: readBoundedFile(args[4]), trustedReferenceSha256: args[6], expectedQuerySha256: digest(sql)});
  return {output: JSON.stringify(result), exitCode: result.status.endsWith("_EXACT") ? 0 : 2};
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { const result = await main(); console.log(result.output); process.exitCode = result.exitCode; }
  catch (error) { console.error(error instanceof Error && /^CREATOR_FOUNDATION_RECONCILIATION_ERROR=[a-z_]+$/u.test(error.message) ? error.message : "CREATOR_FOUNDATION_RECONCILIATION_ERROR=invalid_input"); process.exitCode = 1; }
}

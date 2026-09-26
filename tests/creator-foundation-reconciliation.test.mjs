import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {buildCreatorFoundationProviderReferenceSql, creatorFoundationHostedPg17RoleProfile, creatorFoundationUpstreamProviderContract, loadPinnedCreatorProviderAuthSql, CREATOR_FOUNDATION_PROVIDER_PINS} from "../scripts/operations/creator-foundation-reconciliation-provider.mjs";
import {CREATOR_FOUNDATION_PARENT_PINS, CREATOR_FOUNDATION_PARENT_PROFILE, buildCreatorFoundationParentReferenceSql, creatorFoundationParentHelperBodies, creatorFoundationParentPolicyInventory} from "../scripts/operations/creator-foundation-reconciliation-parents.mjs";
import {
  classifyCreatorFoundationSnapshot,
  loadPinnedCreatorFoundationSources,
  verifyCreatorFoundationSource,
  compareCreatorFoundationCatalogs,
  buildCreatorFoundationReference,
  CREATOR_FOUNDATION_SOURCE_PINS,
  main,
} from "../scripts/operations/creator-foundation-reconciliation-preflight.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");

test("historical foundation and accepted PT409 bytes are pinned independently from current artifacts", () => {
  const sources = loadPinnedCreatorFoundationSources();
  assert.equal(sha256(sources.legacyFoundation), "8065596853f07feffd419ac1473a34fe727a6152f1f742161af16a909d2f457f");
  assert.equal(sha256(sources.legacyConflict), "7e1111357bf1b210023fe43913d11247f3fe6eea32d1a7440b8079d988e671ee");
  assert.equal(sha256(sources.currentFoundation), "d892c74c0285487f1e786dddea90cbc5cb3102f794de0b5037e48295d2a61f4b");
  assert.equal(sha256(sources.currentConflict), "d3e984bfd7ef240c63d0e47431d25ca9f21a18d0287b25375830a1a721d88e3f");
  assert.throws(() => verifyCreatorFoundationSource("legacyFoundation", `${sources.legacyFoundation}\n`), /artifact_checksum/u);
  assert.throws(() => verifyCreatorFoundationSource("legacyConflict", sources.currentConflict), /artifact_checksum/u);
});

test("provider reference binds the original auth.uid statement, body and complete source profile", () => {
  const sql = loadPinnedCreatorProviderAuthSql();
  assert.equal(sha256(sql), CREATOR_FOUNDATION_PROVIDER_PINS.authUid.statementSha256);
  assert.equal(sha256(sql.match(/as \$\$([\s\S]*?)\$\$;/u)[1]), CREATOR_FOUNDATION_PROVIDER_PINS.authUid.bodySha256);
  const profile = creatorFoundationUpstreamProviderContract();
  assert.equal(profile.authUidFunctions[0].owner, "supabase_auth_admin");
  assert.equal(profile.authUidFunctions[0].securityDefiner, false);
  assert.equal(profile.authUidFunctions[0].config, null);
  assert.deepEqual(profile.authUidFunctions[0].directAcl.map(row => row.grantee), ["PUBLIC", "dashboard_user", "postgres", "supabase_auth_admin"]);
  assert.deepEqual(profile.namespaces.map(row => [row.schema, row.owner]), [["auth", "supabase_admin"], ["public", "pg_database_owner"]]);
  assert.equal(profile.namespaces.find(row => row.schema === "auth").directAcl.some(row => row.grantee === "PUBLIC"), false);
  assert.equal(profile.namespaces.find(row => row.schema === "public").directAcl.some(row => row.grantee === "PUBLIC" && row.privilege === "USAGE"), true);
  profile.authUidFunctions[0].config = ["search_path=public"];
  assert.equal(creatorFoundationUpstreamProviderContract().authUidFunctions[0].config, null);
});

test("provider replay preserves the original postgres auth.uid owner before the reviewed owner transition", () => {
  const sql = buildCreatorFoundationProviderReferenceSql();
  assert.match(sql, /^SET ROLE postgres;/u);
  assert.match(sql, /original_owner_invalid[\s\S]*RESET ROLE;[\s\S]*ALTER FUNCTION auth\.uid\(\) OWNER TO supabase_auth_admin;/u);
  assert.match(sql, /ALTER FUNCTION auth\.uid\(\) OWNER TO supabase_auth_admin;[\s\S]*SET ROLE supabase_auth_admin;[\s\S]*GRANT ALL ON FUNCTION auth\.uid\(\) TO postgres,dashboard_user;/u);
});

test("Hosted PG17 role profile is complete, pinned and immutable across callers", () => {
  const profile = creatorFoundationHostedPg17RoleProfile();
  assert.equal(profile.roles.length, 21);
  assert.equal(profile.memberships.length, 22);
  assert.equal(profile.provenance.length, 22);
  assert.equal(profile.roles.some(role => role.name === "supabase_privileged_role"), true);
  assert.equal(profile.memberships.some(edge => edge.role === "authenticator" && edge.member === "supabase_storage_admin"), true);
  assert.equal(profile.provenance.every(entry => entry.membership && entry.source.startsWith("https://github.com/supabase/")), true);
  profile.roles.pop();
  assert.equal(creatorFoundationHostedPg17RoleProfile().roles.length, 21);
});

test("classifier rejects a caller-altered Hosted role profile even with a valid reference hash", () => {
  const roleProfile = creatorFoundationHostedPg17RoleProfile();
  roleProfile.roles.pop();
  const querySha256 = "a".repeat(64);
  const reference = {
    schemaVersion: 1,
    scope: "creator_foundation_catalog_only",
    sourcePins: Object.fromEntries(Object.entries(CREATOR_FOUNDATION_SOURCE_PINS).map(([name, pin]) => [name, {sha256: pin.sha256, gitBlob: pin.gitBlob}])),
    parentSourcePins: CREATOR_FOUNDATION_PARENT_PINS,
    parentProfile: CREATOR_FOUNDATION_PARENT_PROFILE,
    querySha256,
    variants: {},
    roleProfile,
  };
  const referenceJson = JSON.stringify(reference);
  const result = classifyCreatorFoundationSnapshot({}, {referenceJson, trustedReferenceSha256: sha256(referenceJson), expectedQuerySha256: querySha256});
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.blockers.includes("role_profile_contract"));
});

test("parent reference replays complete pinned parent DDL and real authority helpers", () => {
  const sql = buildCreatorFoundationParentReferenceSql();
  assert.equal(CREATOR_FOUNDATION_PARENT_PROFILE, "canonical_daily_without_optional_billing_baseline_aug16_v1");
  assert.doesNotMatch(sql, /workspaces_billing_provider_check/u);
  assert.match(sql, /internal_daily_test/u);
  assert.equal(creatorFoundationParentPolicyInventory().length, 22);
  assert.equal((sql.match(/create policy /gu) ?? []).length, 22);
  for (const table of ["workspaces", "workspace_members", "contacts", "conversations", "contact_ai_profiles", "workspace_analysis_settings"]) assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\s*\\(`, "u"));
  for (const column of ["monthly_fee_cents", "organization_name", "internal_notes", "last_message_preview", "source_message_count", "personal_content_retention_days", "meta_sync_mode", "content_cache_retention_days"]) assert.ok(sql.includes(column), column);
  assert.equal(creatorFoundationParentHelperBodies().length, 7);
  for (const trigger of ["workspaces_create_analysis_settings", "contacts_set_updated_at", "conversations_set_updated_at", "contact_ai_profiles_set_updated_at", "workspace_analysis_settings_set_updated_at"]) assert.ok(sql.includes(`create trigger ${trigger}`));
  assert.match(sql, /create policy contact_ai_profiles_select_workspace_member/u);
  assert.match(sql, /workspace_owner_active_mutation_allowed\(workspace_id\)/u);
  assert.match(sql, /owned_workspace\.subscription_effective_end_at::text/u);
  assert.doesNotMatch(sql, /is_workspace_member|is_workspace_admin|select true;/iu);
  assert.deepEqual(creatorFoundationParentHelperBodies().slice(0, 2).map(row => row.bodySha256), ["e9e57a8bef3d480de6c932eadb11a7c8123219db0ffa52969641b216c5cfd42d", "a40948f1efb59ff2d23f720508705a3162b63746761ef57b96da5dab41cacc78"]);
});

test("parent policy definitions, complete policy sets and authority metadata cannot be normalized away", () => {
  const expected = {parentPolicies: [{schema: "public", table: "contact_ai_profiles", name: "contact_ai_profiles_select_workspace_member", using: "member OR owner", check: null, roles: ["PUBLIC"]}], parentFunctions: [{identity: "workspace_owner_active_mutation_allowed(uuid)", bodySha256: "a".repeat(64), securityDefiner: false}], parentTables: [{table: "workspaces", owner: "postgres", rowSecurity: true}]};
  for (const [section, rows] of [
    ["parentPolicies", [{...expected.parentPolicies[0], using: "true"}]],
    ["parentPolicies", [...expected.parentPolicies, {...expected.parentPolicies[0], name: "extra_permissive", using: "true"}]],
    ["parentPolicies", [{...expected.parentPolicies[0], roles: ["anon", "authenticated"]}]],
    ["parentFunctions", [{...expected.parentFunctions[0], securityDefiner: true}]],
    ["parentTables", [{...expected.parentTables[0], owner: "other_owner"}]],
  ]) assert.deepEqual(compareCreatorFoundationCatalogs({...expected, [section]: rows}, expected), [section]);
});

test("unproven parent authorization helpers stay explicitly incomplete", () => {
  const result = classifyCreatorFoundationSnapshot({catalog: {parentFunctions: [{schema: "public", name: "is_workspace_member", identity: "is_workspace_member(uuid)"}]}});
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.blockers.includes("parent_helper_contract_unreviewed"));
});

test("every parent column's metadata and direct/effective privileges participate in comparison", () => {
  const column = {schema: "public", table: "workspaces", name: "billing_status", type: "text", default: null, directAcl: [], effectiveAcl: [{role: "authenticated", privilege: "UPDATE", allowed: false, grantable: false}]};
  const expected = {parentColumns: [column]};
  for (const changed of [
    {...column, directAcl: [{grantor: "postgres", grantee: "authenticated", privilege: "UPDATE", grantable: false}]},
    {...column, effectiveAcl: [{role: "authenticated", privilege: "UPDATE", allowed: true, grantable: false}]},
    {...column, default: "'active'::text"},
    {...column, type: "character varying"},
  ]) assert.deepEqual(compareCreatorFoundationCatalogs({parentColumns: [changed]}, expected), ["parentColumns"]);
  const result = classifyCreatorFoundationSnapshot({catalog: {parentColumns: []}});
  assert.ok(result.blockers.includes("parent_column_inventory"));
});

test("parent write-time triggers, constraints and indexes cannot disappear from comparison", () => {
  for (const section of ["parentTriggers", "parentConstraints", "parentIndexes"]) {
    assert.deepEqual(compareCreatorFoundationCatalogs({[section]: [{name: "extra_write_path"}]}, {[section]: []}), [section]);
  }
});

test("an empty or partial catalog cannot become an exact foundation verdict", () => {
  for (const snapshot of [null, {}, {schemaVersion: 1, pgMajor: 17, catalog: {}}, {schemaVersion: 1, pgMajor: 16, catalog: {}},
    {schemaVersion: 1, pgMajor: 17, catalog: {tables: [null], policies: [false], roles: [42]}},
    {schemaVersion: 1, pgMajor: 17, catalog: {policies: {some: "not-a-function"}}},
  ]) {
    const result = classifyCreatorFoundationSnapshot(snapshot);
    assert.notEqual(result.status, "LEGACY_EXACT");
    assert.notEqual(result.status, "CURRENT_EXACT");
    assert.equal(result.targetAccepted, false);
    assert.equal(result.learningState, "UNDETERMINED");
    assert.equal(result.applyAllowed, false);
  }
});

test("a caller-supplied reference without an independent trust pin cannot authorize an exact result", () => {
  const result = classifyCreatorFoundationSnapshot({}, {referenceJson: '{"complete":true}'});
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.blockers.includes("reference_pin_missing"));
});

test("a mismatching reference pin is reported without echoing private input", () => {
  const result = classifyCreatorFoundationSnapshot({}, {referenceJson: '{"private":"must-not-appear"}', trustedReferenceSha256: "a".repeat(64)});
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.blockers.includes("reference_pin_mismatch"));
  assert.doesNotMatch(JSON.stringify(result), /must-not-appear/u);
});

test("the report does not infer learning absence from the historical source", () => {
  const result = classifyCreatorFoundationSnapshot({schemaVersion: 1, pgMajor: 17, catalog: {functions: []}});
  assert.equal(result.learningState, "UNDETERMINED");
  assert.equal(result.runtimeActivated, false);
  assert.equal(result.targetAccepted, false);
});

test("optional Admin-CRM dependency or policies require their own reviewed reference variant", () => {
  for (const catalog of [
    {parentChecks: {adminCrmContractAbsent: false}},
    {policies: [{name: "admin_crm_entitlement_boundary"}]},
  ]) {
    const result = classifyCreatorFoundationSnapshot({schemaVersion: 1, pgMajor: 17, observedAt: "2026-09-26T00:00:00Z", catalog});
    assert.equal(result.status, "INCOMPLETE");
    assert.ok(result.blockers.includes("admin_crm_variant_unreviewed"));
  }
});

test("missing reviewed provider contract is explicit and a CI auth.uid stub cannot supply it", () => {
  const result = classifyCreatorFoundationSnapshot({schemaVersion: 1, pgMajor: 17, observedAt: "2026-09-26T00:00:00Z", catalog: {authUidFunctions: [{schema: "auth", name: "uid", identity: "uid()", bodySha256: "a".repeat(64)}]}});
  assert.equal(result.status, "INCOMPLETE");
  assert.ok(result.blockers.includes("auth_uid_provider_contract_missing"));
});

test("comparison preserves unknown role paths, grantors, policy expressions and duplicate rows", () => {
  const expected = {memberships: [{role: "service_role", member: "authenticator", grantor: "supabase_admin", adminOption: false, inheritOption: false, setOption: true}], policies: [{table: "creators", expression: "owner AND creator_gate"}]};
  for (const changed of [
    {...expected, memberships: [...expected.memberships, {role: "authenticator", member: "untrusted_user", grantor: "postgres", adminOption: false, inheritOption: false, setOption: true}]},
    {...expected, memberships: [{...expected.memberships[0], grantor: "different_grantor"}]},
    {...expected, memberships: [expected.memberships[0], expected.memberships[0]]},
    {...expected, policies: [{table: "creators", expression: "owner OR creator_gate"}]},
  ]) assert.notEqual(compareCreatorFoundationCatalogs(changed, expected).length, 0);
  assert.deepEqual(compareCreatorFoundationCatalogs(expected, structuredClone(expected)), []);
});

test("comparison preserves positional function arguments and composite key column order", () => {
  const expected = {functions: [{identity: "example(uuid,uuid)", argNames: ["owner_id", "workspace_id"]}], constraints: [{columns: ["workspace_id", "contact_id"]}]};
  assert.deepEqual(compareCreatorFoundationCatalogs({...expected, functions: [{identity: "example(uuid,uuid)", argNames: ["workspace_id", "owner_id"]}]}, expected), ["functions"]);
  assert.deepEqual(compareCreatorFoundationCatalogs({...expected, constraints: [{columns: ["contact_id", "workspace_id"]}]}, expected), ["constraints"]);
});

test("schema ownership and browser CREATE or USAGE changes are not normalized away", () => {
  const expected = {namespaces: [{schema: "public", owner: "postgres", effectiveAcl: [{role: "authenticated", privilege: "CREATE", allowed: false}, {role: "authenticated", privilege: "USAGE", allowed: true}]}]};
  for (const actual of [
    {namespaces: [{...expected.namespaces[0], owner: "other_owner"}]},
    {namespaces: [{...expected.namespaces[0], effectiveAcl: [{role: "authenticated", privilege: "CREATE", allowed: true}, {role: "authenticated", privilege: "USAGE", allowed: true}]}]},
    {namespaces: [{...expected.namespaces[0], effectiveAcl: [{role: "authenticated", privilege: "CREATE", allowed: false}, {role: "authenticated", privilege: "USAGE", allowed: false}]}]},
  ]) assert.deepEqual(compareCreatorFoundationCatalogs(actual, expected), ["namespaces"]);
});

test("reference construction refuses a list of object names without their security metadata", () => {
  const sources = loadPinnedCreatorFoundationSources();
  const tables = ["creators", "creator_voice_profiles", "creator_sales_playbooks", "creator_commercial_events"];
  const names = ["guard_creator_identity", "save_creator_bundle", "record_creator_fan_review", "creator_workspace_access_allowed"];
  const ids = ["guard_creator_identity()", "save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean)", "record_creator_fan_review(uuid,uuid,jsonb,jsonb)", "creator_workspace_access_allowed(uuid)"];
  const catalog = variant => ({
    ...Object.fromEntries(["tables", "columns", "constraints", "indexes", "policies", "triggers"].map(key => [key, tables.map(table => ({schema: "public", table}))])),
    functions: names.slice(0, variant === "legacy" ? 3 : 4).map((name, index) => {
      const sql = sources[`${variant}${index === 1 ? "Conflict" : "Foundation"}`];
      const body = sql.match(new RegExp(`function public\\.${name}\\([\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, "u"))[1];
      return {schema: "public", name, identity: ids[index], bodySha256: sha256(body)};
    }),
    parentChecks: Object.fromEntries(["pg17", "parentTablesRls", "parentUuidColumnsReadable", "authUsersPresent", "authUidPresent", "anonProfileDenied", "authenticatedProfileWriteDenied", "profileWorkspaceContactUnique", "allSatisfied"].map(key => [key, true])),
    roles: ["anon", "authenticated", "service_role", "authenticator", "postgres"].map(name => ({name})), memberships: [],
  });
  const snapshot = variant => ({schemaVersion: 1, observedAt: "2026-09-26T00:00:00Z", pgMajor: 17, catalog: catalog(variant)});
  assert.throws(() => buildCreatorFoundationReference({legacy: snapshot("legacy"), current: snapshot("current"), roleProfile: {roles: catalog("legacy").roles, memberships: [], provenance: []}, querySha256: "a".repeat(64)}), /reference_incomplete/u);
});

test("offline CLI checks source and never treats unknown or apply modes as a database command", async () => {
  assert.equal((await main(["--check"])).exitCode, 0);
  for (const args of [["--apply"], ["--verify"], ["--sql", "--target", "production"], ["--check", "extra"]]) await assert.rejects(main(args), /mode_invalid/u);
});

test("offline CLI gives a nonzero incomplete result for an untrusted catalog and does not echo it", async () => {
  const directory = mkdtempSync(join(tmpdir(), "creator-reconciliation-test-"));
  try {
    const snapshot = join(directory, "snapshot.json");
    const reference = join(directory, "reference.json");
    writeFileSync(snapshot, '{"private":"do-not-print"}');
    writeFileSync(reference, "{}");
    const result = await main(["--classify", "--snapshot", snapshot, "--reference", reference, "--reference-sha256", "b".repeat(64)]);
    assert.equal(result.exitCode, 2);
    assert.equal(JSON.parse(result.output).status, "INCOMPLETE");
    assert.doesNotMatch(result.output, /do-not-print/u);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test("reference CLI refuses incomplete local PG17 exports instead of issuing a trusted bundle", async () => {
  const directory = mkdtempSync(join(tmpdir(), "creator-reference-test-"));
  try {
    const file = join(directory, "incomplete.json");
    writeFileSync(file, "{}");
    await assert.rejects(main(["--build-reference", "--legacy", file, "--current", file, "--role-profile", file]), /reference_incomplete/u);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

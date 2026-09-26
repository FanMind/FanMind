import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  classifyCreatorFoundationSnapshot,
  loadPinnedCreatorFoundationSources,
  verifyCreatorFoundationSource,
  compareCreatorFoundationCatalogs,
  buildCreatorFoundationReference,
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
      return {schema: "public", name, identity: ids[index], bodyMd5: createHash("md5").update(body).digest("hex")};
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

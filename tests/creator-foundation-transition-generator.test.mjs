import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildCreatorFoundationCatalogSql } from "../scripts/operations/creator-foundation-reconciliation-catalog.mjs";
import { CREATOR_FOUNDATION_PARENT_PROFILE } from "../scripts/operations/creator-foundation-reconciliation-parents.mjs";
import { creatorFoundationHostedPg17RoleProfile } from "../scripts/operations/creator-foundation-reconciliation-provider.mjs";
import { CREATOR_FOUNDATION_SOURCE_PINS } from "../scripts/operations/creator-foundation-reconciliation-preflight.mjs";
import {
  assertCreatorFoundationTransitionPreconditions,
  buildCreatorFoundationTransitionSource,
  CREATOR_FOUNDATION_TRANSITION_IDENTITIES,
  CREATOR_FOUNDATION_TRANSITION_SQL_SHA256,
  main,
} from "../scripts/operations/creator-foundation-transition-generator.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const querySha256 = sha256(buildCreatorFoundationCatalogSql());

test("transition source contains only the pinned helper, two RPCs and four policy changes", () => {
  const artifact = buildCreatorFoundationTransitionSource();

  assert.equal(artifact.schemaVersion, 1);
  assert.equal(artifact.scope, "creator_foundation_legacy_to_current_transition_source_only");
  assert.equal(artifact.targetAccepted, false);
  assert.equal(artifact.applyAllowed, false);
  assert.equal(artifact.querySha256, querySha256);
  assert.equal(artifact.parentProfile, CREATOR_FOUNDATION_PARENT_PROFILE);
  assert.equal(artifact.roleProfile, creatorFoundationHostedPg17RoleProfile().profile);
  assert.deepEqual(artifact.sourcePins, Object.fromEntries(Object.entries(CREATOR_FOUNDATION_SOURCE_PINS).map(([name, pin]) => [name, {sha256: pin.sha256, gitBlob: pin.gitBlob}])));
  assert.deepEqual(artifact.steps.map(step => step.id), [
    "create_workspace_access_helper",
    "replace_save_creator_bundle",
    "replace_record_creator_fan_review",
    "alter_creators_member_read",
    "alter_creator_voice_profiles_member_read",
    "alter_creator_sales_playbooks_member_read",
    "alter_creator_commercial_events_member_read",
  ]);
  assert.equal(artifact.sqlSha256, sha256(artifact.sql));
  assert.equal(artifact.sqlSha256, CREATOR_FOUNDATION_TRANSITION_SQL_SHA256);
  assert.equal(artifact.steps.every(step => step.sha256 === sha256(step.sql)), true);
  assert.equal((artifact.sql.match(/create or replace function public\./gu) ?? []).length, 3);
  assert.equal((artifact.sql.match(/alter policy /gu) ?? []).length, 4);
  assert.doesNotMatch(artifact.sql, /^(?:create table|alter table|insert into|update public\.|delete from|drop |create trigger|grant .* on (?:table|schema))/imu);

  for (const identity of CREATOR_FOUNDATION_TRANSITION_IDENTITIES.functions) assert.match(artifact.sql, new RegExp(identity.name, "u"));
  for (const policy of CREATOR_FOUNDATION_TRANSITION_IDENTITIES.policies) {
    assert.match(artifact.sql, new RegExp(`alter policy ${policy.name} on public\\.${policy.table}`, "u"));
  }
  assert.match(artifact.sql, /revoke all on function public\.creator_workspace_access_allowed\(uuid\) from public, anon, authenticated, service_role;/u);
  assert.match(artifact.sql, /grant execute on function public\.creator_workspace_access_allowed\(uuid\) to authenticated, service_role;/u);
  assert.equal((artifact.sql.match(/creator_workspace_access_allowed\(/gu) ?? []).length >= 7, true);
});

test("source manifest and returned values are immutable across callers", () => {
  const first = buildCreatorFoundationTransitionSource();
  first.steps[0].sql = "select true;";
  first.sourcePins.currentConflict.sha256 = "0".repeat(64);
  const second = buildCreatorFoundationTransitionSource();
  assert.notEqual(second.steps[0].sql, "select true;");
  assert.equal(second.sourcePins.currentConflict.sha256, CREATOR_FOUNDATION_SOURCE_PINS.currentConflict.sha256);
});

test("planning requires a cryptographically bound LEGACY_EXACT classifier result", () => {
  const valid = {
    snapshot: {schemaVersion: 1},
    referenceJson: "{}",
    trustedReferenceSha256: sha256("{}"),
    expectedQuerySha256: querySha256,
  };
  const classify = () => ({status: "LEGACY_EXACT", blockers: [], differingSections: [], applyAllowed: false, targetAccepted: false});
  const plan = assertCreatorFoundationTransitionPreconditions(valid, {classify});
  assert.equal(plan.classification.status, "LEGACY_EXACT");
  assert.equal(plan.artifact.sqlSha256, sha256(plan.artifact.sql));
  assert.equal(plan.applyAllowed, false);
  assert.equal(plan.targetAccepted, false);

  for (const status of ["CURRENT_EXACT", "DRIFT", "INCOMPLETE"]) {
    assert.throws(
      () => assertCreatorFoundationTransitionPreconditions(valid, {classify: () => ({status, blockers: ["blocked"], differingSections: ["functions"]})}),
      new RegExp(`CREATOR_FOUNDATION_TRANSITION_ERROR=${status === "CURRENT_EXACT" ? "already_current" : "precondition_not_legacy_exact"}`, "u"),
    );
  }
});

test("planning rejects query drift, reference-pin drift and target-derived shortcuts before classification", () => {
  const base = {
    snapshot: {schemaVersion: 1},
    referenceJson: "{}",
    trustedReferenceSha256: sha256("{}"),
    expectedQuerySha256: querySha256,
  };
  let calls = 0;
  const classify = () => { calls += 1; return {status: "LEGACY_EXACT", blockers: [], differingSections: []}; };

  assert.throws(() => assertCreatorFoundationTransitionPreconditions({...base, expectedQuerySha256: "0".repeat(64)}, {classify}), /query_contract/u);
  assert.throws(() => assertCreatorFoundationTransitionPreconditions({...base, trustedReferenceSha256: "0".repeat(64)}, {classify}), /reference_pin/u);
  assert.throws(() => assertCreatorFoundationTransitionPreconditions({...base, targetDerivedValues: {owner: "observed"}}, {classify}), /target_derived_values/u);
  assert.equal(calls, 0);
});

test("CLI exposes only source verification and deterministic SQL generation", async () => {
  const checked = await main(["--check"]);
  assert.equal(checked.exitCode, 0);
  assert.match(checked.output, /CREATOR_FOUNDATION_TRANSITION_SOURCE=VERIFIED/u);
  assert.match(checked.output, new RegExp(`SQL_SHA256=${CREATOR_FOUNDATION_TRANSITION_SQL_SHA256}`, "u"));
  assert.match(checked.output, /TRANSPORT=NONE/u);
  const generated = await main(["--sql"]);
  assert.equal(generated.output, buildCreatorFoundationTransitionSource().sql);
  await assert.rejects(() => main(["--apply"]), /mode_invalid/u);
});

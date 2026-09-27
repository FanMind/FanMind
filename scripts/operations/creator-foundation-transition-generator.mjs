#!/usr/bin/env node
// SOURCE-ONLY. This module has no database, HTTP, workflow or mutation transport.
// It emits a bounded transition artifact from independently pinned repository
// sources and requires the existing classifier to prove LEGACY_EXACT before a
// plan can be formed. The result never authorizes or performs target mutation.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { buildCreatorFoundationCatalogSql } from "./creator-foundation-reconciliation-catalog.mjs";
import {
  buildCreatorFoundationParentReferenceSql,
  CREATOR_FOUNDATION_PARENT_PINS,
  CREATOR_FOUNDATION_PARENT_PROFILE,
} from "./creator-foundation-reconciliation-parents.mjs";
import {
  creatorFoundationHostedPg17RoleProfile,
  creatorFoundationUpstreamProviderContract,
  CREATOR_FOUNDATION_PROVIDER_PINS,
} from "./creator-foundation-reconciliation-provider.mjs";
import {
  classifyCreatorFoundationSnapshot,
  CREATOR_FOUNDATION_SOURCE_PINS,
  loadPinnedCreatorFoundationSources,
} from "./creator-foundation-reconciliation-preflight.mjs";

const TABLES = Object.freeze([
  "creators",
  "creator_voice_profiles",
  "creator_sales_playbooks",
  "creator_commercial_events",
]);
const MAX_REFERENCE_BYTES = 2 * 1024 * 1024;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const fail = code => { throw new Error(`CREATOR_FOUNDATION_TRANSITION_ERROR=${code}`); };

// Immutable trust roots accepted by PR #1207 / merge 08a4bfc82f080d58cbea5bde59e92244506c3e4e.
// These values are recorded independently in the accepted source receipt and
// exact CI reference artifact; they must never be derived from a target input.
export const CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS = Object.freeze({
  receipt: "project-memory/receipts/creator-foundation-profile-transition-pr1207-source.json",
  referenceSha256: "0543eacab3872c71ec289100d62204fb2fd1660be242b14ae55bf007701b456c",
  querySha256: "252951c7b64adda2e52c92f2d2b141390e79275db61d09460d92bb7509ff2436",
  sourcePinsSha256: "176c6857243357a7455943d027ec2278f7e00d7c3e30d94b27edaa0a91b6e8c3",
  providerPinsSha256: "82c7814050432dd01d8f073e26085db541d1ac1f65d00186ba7336b2663f164c",
  providerContractSha256: "123fdda5c1a718ce643ea42471d6f56a4ee512178a0df1eb613910fbef046d26",
  parentProfile: "canonical_daily_without_optional_billing_baseline_aug16_v1",
  parentPinsSha256: "6e9862340727e540bff08261975feb57574913bf10db4278b48f58ba9bc023c5",
  parentReferenceSqlSha256: "4f54b28202154baa756487b1df993a83ce36b1eee2fb08b75923ec98937df154",
  roleProfileSha256: "32a4b7ca799afc2d3903b193a40f79f7d2a97291d40fac568637321cd3014f9d",
});

export const CREATOR_FOUNDATION_TRANSITION_IDENTITIES = Object.freeze({
  functions: Object.freeze([
    Object.freeze({name: "creator_workspace_access_allowed", identity: "creator_workspace_access_allowed(uuid)"}),
    Object.freeze({name: "save_creator_bundle", identity: "save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean)"}),
    Object.freeze({name: "record_creator_fan_review", identity: "record_creator_fan_review(uuid,uuid,jsonb,jsonb)"}),
  ]),
  policies: Object.freeze(TABLES.map(table => Object.freeze({table, name: `${table}_member_read`}))),
});

export const CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256 = CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.querySha256;
export const CREATOR_FOUNDATION_TRANSITION_SQL_SHA256 = "db69721ce1a3e81a82a0f101e3bd0bdbda1959b0f367a2ffa6413004dd3bb214";

function sourcePins() {
  return Object.fromEntries(Object.entries(CREATOR_FOUNDATION_SOURCE_PINS)
    .map(([name, pin]) => [name, {sha256: pin.sha256, gitBlob: pin.gitBlob}]));
}

function functionStatement(source, name) {
  const statement = source.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\nend \\$\\$;`, "u"))?.[0];
  if (!statement) fail("function_source_contract");
  return statement;
}

function helperStep(source) {
  const statement = functionStatement(source, "creator_workspace_access_allowed");
  const acl = source.match(/revoke all on function public\.creator_workspace_access_allowed\(uuid\) from public, anon, authenticated, service_role;\s*grant execute on function public\.creator_workspace_access_allowed\(uuid\) to authenticated, service_role;/u)?.[0];
  if (!acl) fail("helper_acl_source_contract");
  return `${statement}\n${acl}`;
}

function policyPredicate(source) {
  const template = source.match(/execute format\('create policy %I on public\.%I for select to authenticated using \((.+)\)', tab \|\| '_member_read', tab, tab, tab, tab\);/u)?.[1];
  if (!template || (template.match(/%I/gu) ?? []).length !== 3 || !template.includes("public.creator_workspace_access_allowed(%I.workspace_id)")) fail("policy_source_contract");
  return template;
}

function step(id, sql) {
  return {id, sql: `${sql.trim()}\n`, sha256: sha256(`${sql.trim()}\n`)};
}

function createArtifact() {
  const sources = loadPinnedCreatorFoundationSources();
  if (sha256(buildCreatorFoundationCatalogSql()) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.querySha256) fail("query_source_contract");
  if (sha256(JSON.stringify(CREATOR_FOUNDATION_SOURCE_PINS)) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.sourcePinsSha256) fail("source_pin_contract");
  if (sha256(JSON.stringify(CREATOR_FOUNDATION_PROVIDER_PINS)) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.providerPinsSha256) fail("provider_pin_contract");
  if (sha256(JSON.stringify(creatorFoundationUpstreamProviderContract())) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.providerContractSha256) fail("provider_contract");
  if (CREATOR_FOUNDATION_PARENT_PROFILE !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.parentProfile ||
      sha256(JSON.stringify(CREATOR_FOUNDATION_PARENT_PINS)) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.parentPinsSha256 ||
      sha256(buildCreatorFoundationParentReferenceSql()) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.parentReferenceSqlSha256) fail("parent_profile_contract");
  const predicate = policyPredicate(sources.currentFoundation);
  const steps = [
    step("create_workspace_access_helper", helperStep(sources.currentConflict)),
    step("replace_save_creator_bundle", functionStatement(sources.currentConflict, "save_creator_bundle")),
    step("replace_record_creator_fan_review", functionStatement(sources.currentConflict, "record_creator_fan_review")),
    ...TABLES.map(table => step(`alter_${table}_member_read`, `alter policy ${table}_member_read on public.${table}\nusing (${predicate.replaceAll("%I", table)});`)),
  ];
  const sql = steps.map(item => item.sql).join("\n");
  if (sha256(sql) !== CREATOR_FOUNDATION_TRANSITION_SQL_SHA256) fail("transition_source_contract");
  const roleProfile = creatorFoundationHostedPg17RoleProfile();
  if (sha256(JSON.stringify(roleProfile)) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.roleProfileSha256) fail("role_profile_contract");
  return {
    schemaVersion: 1,
    scope: "creator_foundation_legacy_to_current_transition_source_only",
    targetAccepted: false,
    applyAllowed: false,
    runtimeActivated: false,
    querySha256: CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256,
    acceptedInputs: structuredClone(CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS),
    sourcePins: sourcePins(),
    providerSourcePins: structuredClone(CREATOR_FOUNDATION_PROVIDER_PINS),
    providerContractSha256: CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.providerContractSha256,
    parentSourcePins: structuredClone(CREATOR_FOUNDATION_PARENT_PINS),
    parentProfile: CREATOR_FOUNDATION_PARENT_PROFILE,
    parentReferenceSqlSha256: CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.parentReferenceSqlSha256,
    roleProfile: roleProfile.profile,
    roleProfileSha256: CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.roleProfileSha256,
    steps,
    sql,
    sqlSha256: CREATOR_FOUNDATION_TRANSITION_SQL_SHA256,
  };
}

export function buildCreatorFoundationTransitionSource() {
  return structuredClone(createArtifact());
}

export function assertCreatorFoundationTransitionPreconditions(input) {
  if (!input || typeof input !== "object" || input.targetDerivedValues !== undefined) fail("target_derived_values");
  if (input.expectedQuerySha256 !== CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256) fail("query_contract");
  if (typeof input.referenceJson !== "string" || Buffer.byteLength(input.referenceJson) < 2 || Buffer.byteLength(input.referenceJson) > MAX_REFERENCE_BYTES ||
      input.trustedReferenceSha256 !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.referenceSha256 ||
      sha256(input.referenceJson) !== CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.referenceSha256) fail("reference_pin");
  const classification = classifyCreatorFoundationSnapshot(input.snapshot, {
    referenceJson: input.referenceJson,
    trustedReferenceSha256: input.trustedReferenceSha256,
    expectedQuerySha256: input.expectedQuerySha256,
  });
  if (classification?.status === "CURRENT_EXACT") fail("already_current");
  if (classification?.status !== "LEGACY_EXACT" || classification.applyAllowed !== false || classification.targetAccepted !== false ||
      (classification.blockers?.length ?? 0) !== 0 || (classification.differingSections?.length ?? 0) !== 0) fail("precondition_not_legacy_exact");
  return {
    schemaVersion: 1,
    scope: "creator_foundation_legacy_to_current_transition_plan",
    applyAllowed: false,
    targetAccepted: false,
    classification: structuredClone(classification),
    artifact: buildCreatorFoundationTransitionSource(),
  };
}

export async function main(args = process.argv.slice(2)) {
  const artifact = buildCreatorFoundationTransitionSource();
  if ((args.length === 0 || (args.length === 1 && args[0] === "--check"))) {
    return {
      exitCode: 0,
      output: `CREATOR_FOUNDATION_TRANSITION_SOURCE=VERIFIED\nCREATOR_FOUNDATION_TRANSITION_SQL_SHA256=${artifact.sqlSha256}\nCREATOR_FOUNDATION_TRANSITION_TRANSPORT=NONE`,
    };
  }
  if (args.length === 1 && args[0] === "--sql") return {exitCode: 0, output: artifact.sql};
  fail("mode_invalid");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(({output, exitCode}) => {
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`);
    process.exitCode = exitCode;
  }).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

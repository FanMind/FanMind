#!/usr/bin/env node
// SOURCE-ONLY. This module has no database, HTTP, workflow or mutation transport.
// It emits a bounded transition artifact from independently pinned repository
// sources and requires the existing classifier to prove LEGACY_EXACT before a
// plan can be formed. The result never authorizes or performs target mutation.
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

import { buildCreatorFoundationCatalogSql } from "./creator-foundation-reconciliation-catalog.mjs";
import { CREATOR_FOUNDATION_PARENT_PROFILE } from "./creator-foundation-reconciliation-parents.mjs";
import { creatorFoundationHostedPg17RoleProfile } from "./creator-foundation-reconciliation-provider.mjs";
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

export const CREATOR_FOUNDATION_TRANSITION_IDENTITIES = Object.freeze({
  functions: Object.freeze([
    Object.freeze({name: "creator_workspace_access_allowed", identity: "creator_workspace_access_allowed(uuid)"}),
    Object.freeze({name: "save_creator_bundle", identity: "save_creator_bundle(uuid,uuid,integer,jsonb,jsonb,jsonb,boolean)"}),
    Object.freeze({name: "record_creator_fan_review", identity: "record_creator_fan_review(uuid,uuid,jsonb,jsonb)"}),
  ]),
  policies: Object.freeze(TABLES.map(table => Object.freeze({table, name: `${table}_member_read`}))),
});

export const CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256 = sha256(buildCreatorFoundationCatalogSql());
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
  return {
    schemaVersion: 1,
    scope: "creator_foundation_legacy_to_current_transition_source_only",
    targetAccepted: false,
    applyAllowed: false,
    runtimeActivated: false,
    querySha256: CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256,
    sourcePins: sourcePins(),
    parentProfile: CREATOR_FOUNDATION_PARENT_PROFILE,
    roleProfile: roleProfile.profile,
    roleProfileSha256: sha256(JSON.stringify(roleProfile)),
    steps,
    sql,
    sqlSha256: CREATOR_FOUNDATION_TRANSITION_SQL_SHA256,
  };
}

export function buildCreatorFoundationTransitionSource() {
  return structuredClone(createArtifact());
}

export function assertCreatorFoundationTransitionPreconditions(input, {classify = classifyCreatorFoundationSnapshot} = {}) {
  if (!input || typeof input !== "object" || input.targetDerivedValues !== undefined) fail("target_derived_values");
  if (input.expectedQuerySha256 !== CREATOR_FOUNDATION_TRANSITION_QUERY_SHA256) fail("query_contract");
  if (typeof input.referenceJson !== "string" || Buffer.byteLength(input.referenceJson) < 2 || Buffer.byteLength(input.referenceJson) > MAX_REFERENCE_BYTES ||
      !/^[a-f0-9]{64}$/u.test(input.trustedReferenceSha256 ?? "") || sha256(input.referenceJson) !== input.trustedReferenceSha256) fail("reference_pin");
  const classification = classify(input.snapshot, {
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
    process.stdout.write(`${output}\n`);
    process.exitCode = exitCode;
  }).catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}

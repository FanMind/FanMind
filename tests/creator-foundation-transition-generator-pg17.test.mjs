import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";

import { buildCreatorFoundationCatalogSql } from "../scripts/operations/creator-foundation-reconciliation-catalog.mjs";
import { buildCreatorFoundationParentReferenceSql } from "../scripts/operations/creator-foundation-reconciliation-parents.mjs";
import {
  buildCreatorFoundationProviderReferenceSql,
  creatorFoundationHostedPg17RoleProfile,
} from "../scripts/operations/creator-foundation-reconciliation-provider.mjs";
import {
  buildCreatorFoundationReference,
  classifyCreatorFoundationSnapshot,
  loadPinnedCreatorFoundationSources,
} from "../scripts/operations/creator-foundation-reconciliation-preflight.mjs";
import {
  assertCreatorFoundationTransitionPreconditions,
  buildCreatorFoundationTransitionSource,
  CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS,
} from "../scripts/operations/creator-foundation-transition-generator.mjs";

const enabled = process.env.FANMIND_CREATOR_PG17_REQUIRED === "true";
const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const databases = ["fanmind_creator_transition_legacy_ci", "fanmind_creator_transition_current_ci", "fanmind_creator_transition_under_test_ci"];
const sources = loadPinnedCreatorFoundationSources();
const query = buildCreatorFoundationCatalogSql();
const digest = value => createHash("sha256").update(value).digest("hex");

function sql(statement, database = "postgres") {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  assert.ok(database === "postgres" || databases.includes(database));
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], {
    input: statement,
    encoding: "utf8",
    timeout: 60000,
    maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

const parents = `
CREATE SCHEMA auth AUTHORIZATION postgres;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
GRANT ALL ON SCHEMA auth TO supabase_auth_admin,dashboard_user;
GRANT USAGE ON SCHEMA auth,public TO postgres,anon,authenticated,service_role;
${buildCreatorFoundationProviderReferenceSql()}
ALTER SCHEMA auth OWNER TO supabase_admin;
SET ROLE supabase_admin;
GRANT USAGE ON SCHEMA auth TO postgres;
RESET ROLE;
${buildCreatorFoundationParentReferenceSql()}
`;

const seed = `
INSERT INTO auth.users(id) VALUES
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002');
INSERT INTO public.workspaces(id,name,owner_user_id) VALUES
 ('20000000-0000-0000-0000-000000000001','transition fixture','10000000-0000-0000-0000-000000000001');
INSERT INTO public.contacts(id,workspace_id,display_name) VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','preserved fan');
INSERT INTO public.creators(id,workspace_id,display_name,bio,languages,platforms,status,internal_notes,revision) VALUES
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','preserved creator','bio',ARRAY['de'],ARRAY['instagram'],'active','note',7);
INSERT INTO public.creator_voice_profiles(workspace_id,creator_id,fingerprint,revision) VALUES
 ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','{"tone":"warm"}',7);
INSERT INTO public.creator_sales_playbooks(workspace_id,creator_id,rules,revision) VALUES
 ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','{"offer":"careful"}',7);
INSERT INTO public.contact_ai_profiles(workspace_id,contact_id,commercial_profile) VALUES
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','{"sourceReference":"seed"}');
SET "request.jwt.claim.sub" = '10000000-0000-0000-0000-000000000001';
INSERT INTO public.creator_commercial_events(id,workspace_id,creator_id,contact_id,kind,occurred_at,amount_minor,currency,evidence_reference) VALUES
 ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','purchase','2026-09-26T00:00:00Z',1000,'EUR','seed-event');
RESET "request.jwt.claim.sub";
`;

const dataFingerprintSql = `SELECT pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(jsonb_build_object(
  'creators',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.creators t),
  'voice',(SELECT jsonb_agg(to_jsonb(t) ORDER BY workspace_id,creator_id) FROM public.creator_voice_profiles t),
  'playbooks',(SELECT jsonb_agg(to_jsonb(t) ORDER BY workspace_id,creator_id) FROM public.creator_sales_playbooks t),
  'events',(SELECT jsonb_agg(to_jsonb(t) ORDER BY id) FROM public.creator_commercial_events t),
  'profiles',(SELECT jsonb_agg(to_jsonb(t) ORDER BY workspace_id,contact_id) FROM public.contact_ai_profiles t)
)::text,'UTF8')),'hex');`;

test("PG17 proves the bounded legacy-to-current transition, rollback and data preservation", {skip: !enabled}, () => {
  assert.equal(sql("SELECT current_setting('server_version_num')::integer / 10000;"), "17");
  sql(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_admin') THEN CREATE ROLE supabase_admin NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='supabase_auth_admin') THEN CREATE ROLE supabase_auth_admin NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='dashboard_user') THEN CREATE ROLE dashboard_user NOLOGIN; END IF;
  END $$;`);
  const createFixture = (database, variant) => {
    sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE); CREATE DATABASE ${database};`);
    sql(parents, database);
    sql(sources[`${variant}Foundation`], database);
    sql(sources[`${variant}Conflict`], database);
    return JSON.parse(sql(query, database));
  };
  try {
    const legacy = createFixture(databases[0], "legacy");
    const current = createFixture(databases[1], "current");
    createFixture(databases[2], "legacy");
    sql(seed, databases[2]);

    const roleProfile = creatorFoundationHostedPg17RoleProfile();
    const reference = buildCreatorFoundationReference({legacy, current, roleProfile, querySha256: digest(query)});
    const referenceJson = JSON.stringify(reference);
    const trustedReferenceSha256 = digest(referenceJson);
    assert.equal(trustedReferenceSha256, CREATOR_FOUNDATION_TRANSITION_ACCEPTED_INPUTS.referenceSha256);
    const hosted = snapshot => {
      const copy = structuredClone(snapshot);
      copy.catalog.roles = structuredClone(roleProfile.roles);
      copy.catalog.memberships = structuredClone(roleProfile.memberships);
      return copy;
    };
    const preTransition = JSON.parse(sql(query, databases[2]));
    const plan = assertCreatorFoundationTransitionPreconditions({
      snapshot: hosted(preTransition), referenceJson, trustedReferenceSha256, expectedQuerySha256: digest(query),
    });
    const artifact = buildCreatorFoundationTransitionSource();
    assert.equal(plan.artifact.sqlSha256, artifact.sqlSha256);
    const beforeData = sql(dataFingerprintSql, databases[2]);

    for (let count = 1; count <= artifact.steps.length; count += 1) {
      assert.throws(() => sql(`BEGIN;\n${artifact.steps.slice(0, count).map(step => step.sql).join("\n")}\nDO $$ BEGIN RAISE EXCEPTION 'injected_transition_failure'; END $$;\nCOMMIT;`, databases[2]));
      assert.deepEqual(JSON.parse(sql(query, databases[2])).catalog, preTransition.catalog, `rollback after step ${count}`);
      assert.equal(sql(dataFingerprintSql, databases[2]), beforeData, `data after rollback step ${count}`);
    }

    sql(`BEGIN;\n${artifact.sql}\nCOMMIT;`, databases[2]);
    const transitioned = JSON.parse(sql(query, databases[2]));
    assert.deepEqual(transitioned.catalog, current.catalog);
    assert.equal(sql(dataFingerprintSql, databases[2]), beforeData);
    assert.equal(classifyCreatorFoundationSnapshot(hosted(transitioned), {referenceJson, trustedReferenceSha256, expectedQuerySha256: digest(query)}).status, "CURRENT_EXACT");
    assert.throws(() => assertCreatorFoundationTransitionPreconditions({snapshot: hosted(transitioned), referenceJson, trustedReferenceSha256, expectedQuerySha256: digest(query)}), /already_current/u);

    assert.equal(sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub"='10000000-0000-0000-0000-000000000001'; SELECT count(*) FROM public.creators; ROLLBACK;`, databases[2]), "1");
    assert.equal(sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub"='10000000-0000-0000-0000-000000000002'; SELECT count(*) FROM public.creators; ROLLBACK;`, databases[2]), "0");
    assert.throws(() => sql(`BEGIN; SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub"='10000000-0000-0000-0000-000000000001'; INSERT INTO public.creators(workspace_id,display_name) VALUES('20000000-0000-0000-0000-000000000001','forbidden'); COMMIT;`, databases[2]));
    assert.equal(sql(dataFingerprintSql, databases[2]), beforeData);

    createFixture(databases[2], "legacy");
    for (const mutation of [
      "CREATE FUNCTION public.save_creator_bundle(integer) RETURNS void LANGUAGE sql AS $$ SELECT $$;",
      "CREATE POLICY creator_transition_rogue ON public.creators FOR SELECT TO authenticated USING (true);",
      "CREATE FUNCTION public.admin_crm_read_allowed(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;",
    ]) {
      sql(mutation, databases[2]);
      const changed = hosted(JSON.parse(sql(query, databases[2])));
      assert.throws(() => assertCreatorFoundationTransitionPreconditions({snapshot: changed, referenceJson, trustedReferenceSha256, expectedQuerySha256: digest(query)}), /precondition_not_legacy_exact/u);
      createFixture(databases[2], "legacy");
    }

    sql("CREATE ROLE creator_transition_unknown NOLOGIN; GRANT creator_transition_unknown TO postgres;");
    try {
      const observed = JSON.parse(sql(query, databases[2]));
      const unknownRole = observed.catalog.roles.find(role => role.name === "creator_transition_unknown");
      assert.ok(unknownRole, "catalog query must expose the unknown role");
      const changed = hosted(observed);
      changed.catalog.roles.push(unknownRole);
      assert.throws(() => assertCreatorFoundationTransitionPreconditions({snapshot: changed, referenceJson, trustedReferenceSha256, expectedQuerySha256: digest(query)}), /precondition_not_legacy_exact/u);
    } finally {
      sql("REVOKE creator_transition_unknown FROM postgres; DROP ROLE IF EXISTS creator_transition_unknown;");
    }
  } finally {
    for (const database of databases) sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE);`);
  }
});

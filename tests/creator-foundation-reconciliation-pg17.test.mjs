import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildCreatorFoundationCatalogSql } from "../scripts/operations/creator-foundation-reconciliation-catalog.mjs";
import {
  buildCreatorFoundationReference,
  classifyCreatorFoundationSnapshot,
  loadPinnedCreatorFoundationSources,
} from "../scripts/operations/creator-foundation-reconciliation-preflight.mjs";

const enabled = process.env.FANMIND_CREATOR_PG17_REQUIRED === "true";
const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const databases = ["fanmind_creator_reconciliation_legacy_ci", "fanmind_creator_reconciliation_current_ci", "fanmind_creator_reconciliation_admin_first_ci", "fanmind_creator_reconciliation_creator_first_ci"];
const sources = loadPinnedCreatorFoundationSources();
const query = buildCreatorFoundationCatalogSql();
const digest = (text) => createHash("sha256").update(text).digest("hex");

// The only connection used by this test is docker exec into the explicit CI
// container. No host/URL/password or externally configured database is accepted.
function sql(statement, database = "postgres") {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  assert.ok(database === "postgres" || databases.includes(database));
  return execFileSync("docker", ["exec", "-i", container, "psql", "-X", "-q", "-A", "-t", "-U", "postgres", "-d", database, "-v", "ON_ERROR_STOP=1"], {
    input: statement, encoding: "utf8", timeout: 60000, maxBuffer: 4 * 1024 * 1024,
  }).trim();
}

const parents = `
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
GRANT USAGE ON SCHEMA auth,public TO anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon,authenticated,service_role;
CREATE TABLE public.workspaces(id uuid PRIMARY KEY,owner_user_id uuid NOT NULL REFERENCES auth.users(id),test_access_flags jsonb,workspace_access_mode text,billing_status text,billing_manual_override boolean);
CREATE TABLE public.workspace_members(workspace_id uuid REFERENCES public.workspaces(id),user_id uuid REFERENCES auth.users(id));
CREATE TABLE public.contacts(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES public.workspaces(id));
CREATE TABLE public.conversations(id uuid PRIMARY KEY,workspace_id uuid NOT NULL REFERENCES public.workspaces(id),contact_id uuid NOT NULL REFERENCES public.contacts(id));
CREATE TABLE public.contact_ai_profiles(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),workspace_id uuid NOT NULL REFERENCES public.workspaces(id),contact_id uuid NOT NULL REFERENCES public.contacts(id),UNIQUE(workspace_id,contact_id));
GRANT SELECT ON public.workspaces,public.workspace_members,public.contacts,public.conversations,public.contact_ai_profiles TO authenticated;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_ai_profiles ENABLE ROW LEVEL SECURITY;
`;

test("PG17 reconciles exact historical/current catalogs and rejects real contract drift", { skip: !enabled }, () => {
  assert.equal(sql("SELECT current_setting('server_version_num')::integer / 10000;"), "17");
  sql(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOLOGIN; END IF;
  END $$;`);
  const createFixture = (variant) => {
    const database = databases[variant === "legacy" ? 0 : 1];
    sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE); CREATE DATABASE ${database};`);
    sql(parents, database);
    sql(sources[`${variant}Foundation`], database);
    sql(sources[`${variant}Conflict`], database);
    return JSON.parse(sql(query, database));
  };
  try {
    const legacy = createFixture("legacy");
    const current = createFixture("current");
    assert.equal(legacy.catalog.parentChecks.allSatisfied, true);
    assert.equal(current.catalog.parentChecks.allSatisfied, true);
    assert.equal(legacy.catalog.functions.length, 3);
    assert.equal(current.catalog.functions.length, 4);
    // Vanilla PG17 includes monitor-role memberships granted by postgres, but
    // their grantor is not a privilege path into the Creator/browser roles.
    assert.ok(Number(sql("SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='pg_monitor';")) >= 3);
    assert.equal(current.catalog.roles.some(role => role.name === "pg_monitor"), false);
    // The fixture profile is explicitly empty. Supabase platform edges require
    // separate real provenance and must never be fabricated by this CI test.
    assert.deepEqual(current.catalog.memberships, []);
    const reference = buildCreatorFoundationReference({ legacy, current,
      roleProfile: { roles: current.catalog.roles, memberships: [], provenance: [] }, querySha256: digest(query) });
    const referenceJson = JSON.stringify(reference);
    const options = { referenceJson, trustedReferenceSha256: digest(referenceJson), expectedQuerySha256: digest(query) };
    const classify = (snapshot) => classifyCreatorFoundationSnapshot(snapshot, options);
    assert.equal(classify(legacy).status, "LEGACY_EXACT");
    assert.equal(classify(current).status, "CURRENT_EXACT");
    assert.equal(classifyCreatorFoundationSnapshot(current, { ...options, trustedReferenceSha256: "0".repeat(64) }).status, "INCOMPLETE");
    for (const snapshot of [legacy, current]) {
      const result = classify(snapshot);
      assert.equal(result.applyAllowed, false);
      assert.equal(result.targetAccepted, false);
      assert.equal(result.runtimeActivated, false);
      assert.equal(result.learningState, "UNDETERMINED");
    }

    // Verify PostgreSQL itself entered a read-only repeatable snapshot. The
    // extra diagnostic SELECT is test-only and shares the generated transaction.
    const diagnostic = query.replace("\nROLLBACK;", "\nSELECT jsonb_build_object('readOnly',current_setting('transaction_read_only'),'isolation',current_setting('transaction_isolation'),'observedAt',transaction_timestamp());\nROLLBACK;");
    const [snapshotLine, diagnosticLine] = sql(diagnostic, databases[1]).split("\n");
    const diagnosticResult = JSON.parse(diagnosticLine);
    assert.equal(diagnosticResult.readOnly, "on");
    assert.equal(diagnosticResult.isolation, "repeatable read");
    assert.equal(diagnosticResult.observedAt, JSON.parse(snapshotLine).observedAt);
    assert.throws(() => sql(query.replace("\nROLLBACK;", "\nCREATE TABLE public.must_not_be_written(id integer);\nROLLBACK;"), databases[1]));
    assert.equal(sql("SELECT to_regclass('public.must_not_be_written') IS NULL;", databases[1]), "t");
    const again = JSON.parse(sql(query, databases[1]));
    assert.deepEqual(again.catalog, current.catalog);

    const mutations = [
      ["helper body", "CREATE OR REPLACE FUNCTION public.creator_workspace_access_allowed(p_workspace_id uuid) RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$ BEGIN RETURN true; END $$;", "functions"],
      ["helper ACL", "GRANT EXECUTE ON FUNCTION public.creator_workspace_access_allowed(uuid) TO anon;", "functions"],
      ["read policy", "ALTER POLICY creators_member_read ON public.creators USING (true);", "policies"],
      ["unknown policy", "CREATE POLICY creator_reconciliation_rogue ON public.creators FOR SELECT TO authenticated USING (true);", "policies"],
      ["column ACL", "GRANT UPDATE(display_name) ON public.creators TO authenticated;", "columns"],
      ["managed column", "ALTER TABLE public.contact_ai_profiles DROP COLUMN commercial_profile CASCADE;", "columns"],
      ["identity trigger", "ALTER TABLE public.creators DISABLE TRIGGER creators_identity_guard;", "triggers"],
      ["table RLS", "ALTER TABLE public.creators DISABLE ROW LEVEL SECURITY;", "tables"],
      ["index", "DROP INDEX public.creator_commercial_events_contact_idx; CREATE INDEX creator_commercial_events_contact_idx ON public.creator_commercial_events(contact_id);", "indexes"],
      ["parent UUID access", "REVOKE SELECT ON public.workspace_members FROM authenticated;", "parentChecks"],
      ["anonymous parent column access", "GRANT SELECT(workspace_id) ON public.contact_ai_profiles TO anon;", "parentChecks"],
    ];
    for (const [name, mutation, expectedSection] of mutations) {
      createFixture("current");
      sql(mutation, databases[1]);
      const result = classify(JSON.parse(sql(query, databases[1])));
      assert.equal(result.status, "DRIFT", name);
      assert.ok(result.differingSections.includes(expectedSection), name);
    }

    // Apply the exact canonical Admin CRM helper/policy portion, without its
    // unrelated setter/audit fixture dependencies. Both install orders are
    // explicitly unreviewed and must remain INCOMPLETE, never normalized away.
    const adminMigration = readFileSync(new URL("../supabase/migrations/20260915221500_admin_crm_access.sql", import.meta.url), "utf8");
    assert.equal(digest(adminMigration), "7d1201fc5b45b571d2944b301eb1f5f197ea4f25ad643c8e8010d9d0ba3c1efd");
    const adminEnd = adminMigration.indexOf("create or replace function public.current_admin_crm_access_state");
    assert.ok(adminEnd > 0);
    const adminBoundary = `${adminMigration.slice(0, adminEnd)}\ncommit;`;
    for (const [database, adminFirst] of [[databases[2], true], [databases[3], false]]) {
      sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE); CREATE DATABASE ${database};`);
      sql(parents, database);
      if (adminFirst) sql(adminBoundary, database);
      sql(sources.currentFoundation, database);
      sql(sources.currentConflict, database);
      if (!adminFirst) sql(adminBoundary, database);
      const snapshot = JSON.parse(sql(query, database));
      assert.equal(snapshot.catalog.parentChecks.adminCrmContractAbsent, false);
      const creatorBoundaries = snapshot.catalog.policies.filter((policy) => policy.name === "admin_crm_entitlement_boundary");
      assert.equal(creatorBoundaries.length, adminFirst ? 0 : 4);
      const result = classify(snapshot);
      assert.equal(result.status, "INCOMPLETE");
      assert.ok(result.blockers.includes("admin_crm_variant_unreviewed"));
    }

    createFixture("current");
    sql("CREATE ROLE creator_reconciliation_ci_rogue NOLOGIN; CREATE ROLE creator_reconciliation_ci_grantor NOLOGIN; GRANT service_role TO creator_reconciliation_ci_grantor WITH ADMIN TRUE, INHERIT TRUE, SET TRUE; SET ROLE creator_reconciliation_ci_grantor; GRANT service_role TO creator_reconciliation_ci_rogue WITH INHERIT TRUE, SET TRUE; RESET ROLE;");
    const rogue = JSON.parse(sql(query, databases[1]));
    const edge = rogue.catalog.memberships.find((row) => row.member === "creator_reconciliation_ci_rogue");
    assert.equal(edge.role, "service_role");
    assert.equal(edge.grantor, "creator_reconciliation_ci_grantor");
    assert.equal(edge.inheritOption, true);
    assert.equal(edge.setOption, true);
    assert.ok(rogue.catalog.roles.some((role) => role.name === "creator_reconciliation_ci_rogue"));
    const rogueResult = classify(rogue);
    assert.equal(rogueResult.status, "DRIFT");
    assert.ok(rogueResult.differingSections.includes("memberships"));
    // A new principal connected through the grantor is included recursively,
    // along with the real incoming edge rather than a flattened privilege bit.
    sql("CREATE ROLE creator_reconciliation_ci_indirect NOLOGIN; GRANT creator_reconciliation_ci_grantor TO creator_reconciliation_ci_indirect WITH INHERIT TRUE, SET TRUE;");
    const indirect = JSON.parse(sql(query, databases[1]));
    assert.ok(indirect.catalog.roles.some((role) => role.name === "creator_reconciliation_ci_indirect"));
    assert.ok(indirect.catalog.memberships.some((row) => row.role === "creator_reconciliation_ci_grantor" && row.member === "creator_reconciliation_ci_indirect" && row.grantor === "postgres"));
    assert.equal(classify(indirect).status, "DRIFT");
  } finally {
    for (const database of databases) sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE);`);
    sql("DROP ROLE IF EXISTS creator_reconciliation_ci_indirect; DROP ROLE IF EXISTS creator_reconciliation_ci_rogue; DROP ROLE IF EXISTS creator_reconciliation_ci_grantor;");
  }
});

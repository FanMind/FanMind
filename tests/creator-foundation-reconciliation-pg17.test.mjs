import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import test from "node:test";
import { buildCreatorFoundationCatalogSql } from "../scripts/operations/creator-foundation-reconciliation-catalog.mjs";
import {
  buildCreatorFoundationReference,
  classifyCreatorFoundationSnapshot,
  loadPinnedCreatorFoundationSources,
  CREATOR_FOUNDATION_SOURCE_PINS,
} from "../scripts/operations/creator-foundation-reconciliation-preflight.mjs";

import {buildCreatorFoundationProviderReferenceSql, creatorFoundationHostedPg17RoleProfile, creatorFoundationUpstreamProviderContract, CREATOR_FOUNDATION_PROVIDER_PINS} from "../scripts/operations/creator-foundation-reconciliation-provider.mjs";

import {CREATOR_FOUNDATION_PARENT_PINS, CREATOR_FOUNDATION_PARENT_PROFILE, buildCreatorFoundationParentReferenceSql, creatorFoundationParentPolicyInventory} from "../scripts/operations/creator-foundation-reconciliation-parents.mjs";

const enabled = process.env.FANMIND_CREATOR_PG17_REQUIRED === "true";
const container = process.env.FANMIND_CREATOR_PG17_CONTAINER_ID ?? "";
const databases = ["fanmind_creator_reconciliation_legacy_ci", "fanmind_creator_reconciliation_current_ci", "fanmind_creator_reconciliation_admin_first_ci", "fanmind_creator_reconciliation_creator_first_ci"];
const sources = loadPinnedCreatorFoundationSources();
const query = buildCreatorFoundationCatalogSql();
const digest = (text) => createHash("sha256").update(text).digest("hex");

// Test-only export of the isolated fixtures, called after every native assertion
// and finally-cleanup succeeded. No caller-selected output file is accepted.
function exportCiReferenceArtifacts({legacy, current, postgresVersion, environment}) {
  const invalid = () => { throw new Error("creator_reference_export_invalid"); };
  if (environment.FANMIND_CREATOR_RECONCILIATION_EXPORT !== "true" || environment.GITHUB_ACTIONS !== "true" || environment.GITHUB_REPOSITORY !== "FanMind/FanMind" ||
    !/^[a-f0-9]{40}$/u.test(environment.GITHUB_SHA ?? "") || !/^[a-f0-9]{40}$/u.test(environment.FANMIND_CREATOR_RECONCILIATION_REVIEWED_SOURCE_SHA ?? "") || !/^[1-9][0-9]{0,19}$/u.test(environment.GITHUB_RUN_ID ?? "") ||
    !/^[1-9][0-9]{0,9}$/u.test(environment.GITHUB_RUN_ATTEMPT ?? "") || !/^17\.[0-9]+(?:\s.*)?$/u.test(postgresVersion ?? "") ||
    typeof environment.RUNNER_TEMP !== "string" || !isAbsolute(environment.RUNNER_TEMP)) invalid();
  const root = lstatSync(environment.RUNNER_TEMP);
  if (!root.isDirectory() || root.isSymbolicLink() || root.uid !== process.getuid() || (root.mode & 0o022) !== 0 || realpathSync(environment.RUNNER_TEMP) !== resolve(environment.RUNNER_TEMP)) invalid();
  const content = {"legacy.json": `${JSON.stringify(legacy)}\n`, "current.json": `${JSON.stringify(current)}\n`};
  if (Object.values(content).some(value => Buffer.byteLength(value) > 2 * 1024 * 1024)) invalid();
  const manifest = {
    schemaVersion: 1, scope: "isolated_ci_creator_foundation_reference",
    stagingRoleProfileApproved: false, targetAccepted: false, applyAllowed: false,
    repository: environment.GITHUB_REPOSITORY, githubSha: environment.GITHUB_SHA,
    reviewedSourceSha: environment.FANMIND_CREATOR_RECONCILIATION_REVIEWED_SOURCE_SHA,
    runId: environment.GITHUB_RUN_ID, runAttempt: environment.GITHUB_RUN_ATTEMPT,
    postgresVersion, querySha256: digest(query), sourcePins: CREATOR_FOUNDATION_SOURCE_PINS, providerSourcePins: CREATOR_FOUNDATION_PROVIDER_PINS,
    parentSourcePins: CREATOR_FOUNDATION_PARENT_PINS, parentProfile: CREATOR_FOUNDATION_PARENT_PROFILE, parentReferenceSqlSha256: digest(buildCreatorFoundationParentReferenceSql()),
    stagingProviderProfileApproved: false, providerContractSha256: digest(JSON.stringify(creatorFoundationUpstreamProviderContract())),
    files: Object.fromEntries(Object.entries(content).map(([name, value]) => [name, digest(value)])),
  };
  const output = join(environment.RUNNER_TEMP, `fanmind-creator-foundation-reference-${environment.GITHUB_RUN_ID}-${environment.GITHUB_RUN_ATTEMPT}`);
  mkdirSync(output, {mode: 0o700});
  for (const [name, value] of Object.entries({...content, "manifest.json": `${JSON.stringify(manifest)}\n`})) writeFileSync(join(output, name), value, {mode: 0o600, flag: "wx"});
  return output;
}

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
CREATE SCHEMA auth AUTHORIZATION postgres;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
GRANT ALL ON SCHEMA auth TO supabase_auth_admin,dashboard_user;
GRANT USAGE ON SCHEMA auth,public TO postgres,anon,authenticated,service_role;
${buildCreatorFoundationProviderReferenceSql()}
ALTER SCHEMA auth OWNER TO supabase_admin;
GRANT USAGE ON SCHEMA auth TO postgres;
${buildCreatorFoundationParentReferenceSql()}
`;

test("PG17 reconciles exact historical/current catalogs and rejects real contract drift", { skip: !enabled }, () => {
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
  const createFixture = (variant) => {
    const database = databases[variant === "legacy" ? 0 : 1];
    sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE); CREATE DATABASE ${database};`);
    sql(parents, database);
    sql(sources[`${variant}Foundation`], database);
    sql(sources[`${variant}Conflict`], database);
    return JSON.parse(sql(query, database));
  };
  let verifiedSnapshots;
  const postgresVersion = sql("SELECT current_setting('server_version');");
  try {
    const legacy = createFixture("legacy");
    const current = createFixture("current");
    assert.equal(legacy.catalog.parentChecks.allSatisfied, true);
    assert.equal(current.catalog.parentChecks.allSatisfied, true);
    assert.equal(legacy.catalog.functions.length, 3);
    assert.equal(current.catalog.functions.length, 4);
    assert.equal(current.catalog.parentTables.length, 6);
    const expectedColumnCount = Number(sql("SELECT count(*) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('workspaces','workspace_members','contacts','conversations','contact_ai_profiles','workspace_analysis_settings') AND a.attnum>0 AND NOT a.attisdropped;", databases[1]));
    assert.equal(current.catalog.parentColumns.length, expectedColumnCount);
    assert.equal(expectedColumnCount, 144, "complete source lineage replaces the old 23-column skeleton");
    for (const [table, name] of [["workspaces", "monthly_fee_cents"], ["workspaces", "organization_name"], ["contacts", "internal_notes"], ["conversations", "last_message_preview"], ["contact_ai_profiles", "source_message_count"]]) assert.ok(current.catalog.parentColumns.some(row => row.table === table && row.name === name));
    assert.deepEqual(JSON.parse(sql('SET quote_all_identifiers = on;\n' + query, databases[1])).catalog, current.catalog);

    for (const table of ["workspaces", "workspace_members", "contacts", "conversations", "contact_ai_profiles", "workspace_analysis_settings"]) assert.ok(current.catalog.parentColumns.some(column => column.table === table));
    assert.deepEqual(current.catalog.parentPolicies.map(({schema, table, name}) => ({schema, table, name})).sort((a, b) => a.name.localeCompare(b.name)), creatorFoundationParentPolicyInventory());
    assert.equal(current.catalog.parentFunctions.length, 7);
    assert.equal(current.catalog.parentTriggers.filter(row => !row.internal).length, 5);
    assert.equal(current.catalog.parentConstraints.some(row => row.name === "workspaces_billing_provider_check"), false);
    assert.match(current.catalog.parentConstraints.find(row => row.name === "workspaces_commercial_option_check").definition, /internal_daily_test/u);
    assert.match(current.catalog.parentConstraints.find(row => row.name === "workspaces_payment_collection_method_check").definition, /card/u);
    assert.ok(current.catalog.parentDependencies.some(row => row.sourceKind === "policy" && row.targetIdentity === "workspace_owner_active_mutation_allowed(uuid)"));
    // Vanilla PG17 includes monitor-role memberships granted by postgres, but
    // their grantor is not a privilege path into the Creator/browser roles.
    assert.ok(Number(sql("SELECT count(*) FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname='pg_monitor';")) >= 3);
    assert.equal(current.catalog.roles.some(role => role.name === "pg_monitor"), false);
    // The fixture profile is explicitly empty. Supabase platform edges require
    // separate real provenance and must never be fabricated by this CI test.
    assert.deepEqual(current.catalog.memberships, []);
    const provider = creatorFoundationUpstreamProviderContract();
    assert.deepEqual([...current.catalog.namespaces].sort((a, b) => a.schema.localeCompare(b.schema)), provider.namespaces);
    assert.deepEqual(current.catalog.authUidFunctions, provider.authUidFunctions);
    const roleProfile = creatorFoundationHostedPg17RoleProfile();
    assert.throws(() => buildCreatorFoundationReference({legacy, current, roleProfile: {roles: current.catalog.roles, memberships: [], provenance: [], providerContract: creatorFoundationUpstreamProviderContract()}, querySha256: digest(query)}), /role_profile_contract/u);
    const reference = buildCreatorFoundationReference({ legacy, current, roleProfile, querySha256: digest(query) });
    const referenceJson = JSON.stringify(reference);
    const options = { referenceJson, trustedReferenceSha256: digest(referenceJson), expectedQuerySha256: digest(query) };
    const classify = (snapshot) => classifyCreatorFoundationSnapshot(snapshot, options);
    assert.equal(classify(legacy).status, "DRIFT");
    assert.equal(classify(current).status, "DRIFT");
    const hostedLegacy = structuredClone(legacy);
    const hostedCurrent = structuredClone(current);
    for (const snapshot of [hostedLegacy, hostedCurrent]) {
      snapshot.catalog.roles = structuredClone(roleProfile.roles);
      snapshot.catalog.memberships = structuredClone(roleProfile.memberships);
    }
    assert.equal(classify(hostedLegacy).status, "LEGACY_EXACT");
    assert.equal(classify(hostedCurrent).status, "CURRENT_EXACT");
    assert.equal(classifyCreatorFoundationSnapshot(hostedCurrent, { ...options, trustedReferenceSha256: "0".repeat(64) }).status, "INCOMPLETE");
    for (const snapshot of [hostedLegacy, hostedCurrent]) {
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

    // An unrelated feature's incoming FK is outside this explicit parent
    // projection. Its built-in RI action triggers must not require installing
    // every optional product module in the trusted reference database.
    sql("CREATE TABLE public.reconciliation_other_feature(id uuid PRIMARY KEY,workspace_id uuid REFERENCES public.workspaces(id),contact_id uuid REFERENCES public.contacts(id));", databases[1]);
    assert.deepEqual(JSON.parse(sql(query, databases[1])).catalog, current.catalog);
    sql("DROP TABLE public.reconciliation_other_feature;", databases[1]);
    // Execute the actual INSERT trigger and timestamp triggers, proving these
    // reference dependencies operate on the complete source tables.
    sql("INSERT INTO auth.users(id) VALUES('00000000-0000-0000-0000-000000000001'); INSERT INTO public.workspaces(id,name,owner_user_id) VALUES('00000000-0000-0000-0000-000000000002','reference workspace','00000000-0000-0000-0000-000000000001'); INSERT INTO public.contacts(id,workspace_id,display_name) VALUES('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000002','reference contact'); UPDATE public.contacts SET display_name='updated reference' WHERE id='00000000-0000-0000-0000-000000000003';", databases[1]);
    assert.equal(sql("SELECT count(*) FROM public.workspace_analysis_settings WHERE workspace_id='00000000-0000-0000-0000-000000000002';", databases[1]), "1");
    sql("UPDATE public.workspace_analysis_settings SET updated_at='2000-01-01'::timestamptz WHERE workspace_id='00000000-0000-0000-0000-000000000002';", databases[1]);
    assert.equal(sql("SELECT updated_at > '2000-01-01'::timestamptz FROM public.workspace_analysis_settings WHERE workspace_id='00000000-0000-0000-0000-000000000002';", databases[1]), "t");

    assert.deepEqual(JSON.parse(sql(query, databases[1])).catalog, current.catalog);

    const mutations = [
      ["real timestamp helper", "ALTER FUNCTION public.set_contacts_updated_at() SECURITY DEFINER;", "parentFunctions"],
      ["settings retention constraint", "ALTER TABLE public.workspace_analysis_settings DROP CONSTRAINT workspace_analysis_settings_personal_content_retention_days_check;", "parentConstraints"],
      ["optional billing baseline constraint", "ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_billing_provider_check CHECK (billing_provider IS NULL OR billing_provider IN ('manual','stripe')) NOT VALID;", "parentConstraints"],
      ["Daily commercial option", "ALTER TABLE public.workspaces DROP CONSTRAINT workspaces_commercial_option_check; ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_commercial_option_check CHECK (commercial_option IN ('pilot_only','starter_paid_setup','starter_no_setup_commitment'));", "parentConstraints"],
      ["Daily payment method", "ALTER TABLE public.workspaces DROP CONSTRAINT workspaces_payment_collection_method_check; ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_payment_collection_method_check CHECK (payment_collection_method IS NULL OR payment_collection_method IN ('none','manual_invoice','sepa_direct_debit'));", "parentConstraints"],
      ["settings dependency policy", "ALTER POLICY workspace_analysis_settings_select_requires_workspace_owner ON public.workspace_analysis_settings USING(true);", "parentPolicies"],
      ["settings dependency column ACL", "GRANT UPDATE(fan_analysis_enabled) ON public.workspace_analysis_settings TO authenticated;", "parentColumns"],
      ["server-owned billing column UPDATE", "GRANT UPDATE(billing_status) ON public.workspaces TO authenticated;", "parentColumns"],
      ["membership identity column UPDATE", "GRANT UPDATE(user_id) ON public.workspace_members TO authenticated;", "parentColumns"],
      ["membership SELECT revoked", "REVOKE SELECT ON public.workspace_members FROM authenticated;", "parentColumns"],
      ["parent constraint", "ALTER TABLE public.workspace_members ADD CONSTRAINT reconciliation_write_denied CHECK(false) NOT VALID;", "parentConstraints"],
      ["parent index", "CREATE INDEX reconciliation_parent_index ON public.workspaces(billing_status);", "parentIndexes"],
      ["parent trigger state", "ALTER TABLE public.workspaces DISABLE TRIGGER ALL;", "parentTriggers"],
      ["parent SELECT predicate", "ALTER POLICY contact_ai_profiles_select_workspace_member ON public.contact_ai_profiles USING (true);", "parentPolicies"],
      ["parent extra permissive", "CREATE POLICY reconciliation_parent_rogue ON public.contact_ai_profiles FOR SELECT TO authenticated USING (true);", "parentPolicies"],
      ["parent policy role", "ALTER POLICY contacts_select_workspace_member ON public.contacts TO anon;", "parentPolicies"],
      ["parent WITH CHECK", "ALTER POLICY contacts_insert_requires_workspace_owner ON public.contacts WITH CHECK (true);", "parentPolicies"],
      ["parent owner", "ALTER TABLE public.contact_ai_profiles OWNER TO supabase_admin;", "parentTables"],
      ["parent FORCE RLS", "ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;", "parentTables"],
      ["parent helper body", "CREATE OR REPLACE FUNCTION public.workspace_owner_active_mutation_allowed(p_workspace_id uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$;", "parentFunctions"],
      ["parent helper security", "ALTER FUNCTION public.workspace_owner_active_mutation_allowed(uuid) SECURITY DEFINER;", "parentFunctions"],
      ["parent helper ACL", "GRANT EXECUTE ON FUNCTION public.workspace_owner_active_mutation_allowed(uuid) TO anon;", "parentFunctions"],
      ["parent helper owner", "ALTER FUNCTION public.workspace_owner_active_mutation_allowed(uuid) OWNER TO supabase_admin;", "parentFunctions"],
      ["parent helper config", "ALTER FUNCTION public.workspace_owner_active_mutation_allowed(uuid) SET search_path='public';", "parentFunctions"],
      ["transitive authority helper", "ALTER FUNCTION public.workspace_processing_allowed_contract(text,text,text,boolean,text,text,jsonb,timestamptz) SECURITY DEFINER;", "parentFunctions"],
      ["database owner", `ALTER DATABASE ${databases[1]} OWNER TO supabase_admin;`, "parentChecks"],
      ["public CREATE", "GRANT CREATE ON SCHEMA public TO authenticated;", "namespaces"],
      ["public USAGE ACL", "REVOKE USAGE ON SCHEMA public FROM authenticated;", "namespaces"],
      ["auth USAGE", "REVOKE USAGE ON SCHEMA auth FROM authenticated;", "namespaces"],
      ["schema owner", "ALTER SCHEMA auth OWNER TO postgres;", "namespaces"],
      ["auth UID body", "CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;", "authUidFunctions"],
      ["auth UID owner", "ALTER FUNCTION auth.uid() OWNER TO postgres;", "authUidFunctions"],
      ["auth UID security", "ALTER FUNCTION auth.uid() SECURITY DEFINER;", "authUidFunctions"],
      ["auth UID config", "ALTER FUNCTION auth.uid() SET search_path='public';", "authUidFunctions"],
      ["auth UID ACL", "REVOKE EXECUTE ON FUNCTION auth.uid() FROM PUBLIC;", "authUidFunctions"],
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

    for (const [name, statement, expectedSection] of [
      ["unreviewed trigger authority", "CREATE FUNCTION public.reconciliation_parent_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.billing_manual_override=true; RETURN NEW; END $$; CREATE TRIGGER reconciliation_parent_trigger BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.reconciliation_parent_trigger();", "parentTriggers"],
      ["unreviewed trigger WHEN authority", "CREATE FUNCTION public.reconciliation_trigger_base() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE FUNCTION public.reconciliation_trigger_when(boolean) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$; CREATE TRIGGER reconciliation_parent_when BEFORE UPDATE ON public.workspaces FOR EACH ROW WHEN(public.reconciliation_trigger_when(NEW.billing_manual_override)) EXECUTE FUNCTION public.reconciliation_trigger_base();", "parentTriggers"],
      ["unreviewed trigger OLD NEW authority", "CREATE FUNCTION public.reconciliation_trigger_base() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RETURN NEW; END $$; CREATE FUNCTION public.reconciliation_trigger_when(boolean) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$; CREATE TRIGGER reconciliation_parent_when BEFORE UPDATE ON public.workspaces FOR EACH ROW WHEN(public.reconciliation_trigger_when(NEW.billing_manual_override) AND OLD.billing_manual_override IS DISTINCT FROM NEW.billing_manual_override) EXECUTE FUNCTION public.reconciliation_trigger_base();", "parentTriggers"],
      ["unreviewed index authority", "CREATE FUNCTION public.reconciliation_parent_index(text) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT $1 $$; CREATE INDEX reconciliation_parent_expression ON public.workspaces(public.reconciliation_parent_index(billing_status));", "parentIndexes"],
      ["unreviewed constraint authority", "CREATE FUNCTION public.reconciliation_parent_check(uuid) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT true $$; ALTER TABLE public.workspace_members ADD CONSTRAINT reconciliation_parent_check CHECK(public.reconciliation_parent_check(user_id)) NOT VALID;", "parentConstraints"],
      ["unreviewed default authority", "CREATE FUNCTION public.reconciliation_parent_default() RETURNS text LANGUAGE sql AS $$ SELECT 'active'::text $$; ALTER TABLE public.workspaces ALTER COLUMN billing_status SET DEFAULT public.reconciliation_parent_default();", "parentColumns"],
    ]) {
      createFixture("current");
      sql(statement, databases[1]);
      const snapshot = JSON.parse(sql(query, databases[1]));
      assert.ok(snapshot.catalog[expectedSection].length > 0, name);
      if (["unreviewed trigger WHEN authority", "unreviewed trigger OLD NEW authority"].includes(name)) {
        assert.ok(snapshot.catalog.parentFunctions.some(row => row.identity === "reconciliation_trigger_base()"));
        assert.ok(snapshot.catalog.parentFunctions.some(row => row.identity === "reconciliation_trigger_when(boolean)"));
        const definition = snapshot.catalog.parentTriggers.find(row => row.name === "reconciliation_parent_when").when;
        assert.match(definition, /WHEN[\s\S]*new\.billing_manual_override/iu);
        if (name === "unreviewed trigger OLD NEW authority") assert.match(definition, /old\.billing_manual_override IS DISTINCT FROM new\.billing_manual_override/iu);
      }
      const result = classify(snapshot);
      assert.equal(result.status, "INCOMPLETE", name);
      assert.ok(result.blockers.includes("parent_helper_contract_unreviewed"), name);
    }
    const missingParentColumns = structuredClone(current);
    missingParentColumns.catalog.parentColumns = missingParentColumns.catalog.parentColumns.filter(row => row.table !== "workspace_members");
    assert.throws(() => buildCreatorFoundationReference({legacy, current: missingParentColumns, roleProfile: reference.roleProfile, querySha256: digest(query)}), /reference_incomplete/u);
    const partialParentColumn = structuredClone(current);
    delete partialParentColumn.catalog.parentColumns[0].directAcl;
    assert.throws(() => buildCreatorFoundationReference({legacy, current: partialParentColumn, roleProfile: reference.roleProfile, querySha256: digest(query)}), /reference_incomplete/u);
    createFixture("current");
    sql("CREATE FUNCTION public.is_workspace_member(uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT true $$; ALTER POLICY contact_ai_profiles_select_workspace_member ON public.contact_ai_profiles USING (public.is_workspace_member(workspace_id));", databases[1]);
    const unsupportedParent = classify(JSON.parse(sql(query, databases[1])));
    assert.equal(unsupportedParent.status, "INCOMPLETE");
    assert.ok(unsupportedParent.blockers.includes("parent_helper_contract_unreviewed"));
    const emptyParent = structuredClone(current);
    emptyParent.catalog.parentPolicies = [];
    assert.throws(() => buildCreatorFoundationReference({legacy, current: emptyParent, roleProfile: reference.roleProfile, querySha256: digest(query)}), /reference_incomplete/u);
    const unsupportedProfile = structuredClone(reference);
    unsupportedProfile.parentProfile = "target_derived";
    const unsupportedProfileJson = JSON.stringify(unsupportedProfile);
    assert.equal(classifyCreatorFoundationSnapshot(current, {...options, referenceJson: unsupportedProfileJson, trustedReferenceSha256: digest(unsupportedProfileJson)}).status, "INCOMPLETE");
    const missingParentPins = structuredClone(reference);
    delete missingParentPins.parentSourcePins;
    const missingParentJson = JSON.stringify(missingParentPins);
    assert.ok(classifyCreatorFoundationSnapshot(current, {...options, referenceJson: missingParentJson, trustedReferenceSha256: digest(missingParentJson)}).blockers.includes("reference_contract"));

    const missingProvider = structuredClone(reference);
    delete missingProvider.roleProfile.providerContract;
    const missingProviderJson = JSON.stringify(missingProvider);
    assert.ok(classifyCreatorFoundationSnapshot(current, {...options, referenceJson: missingProviderJson, trustedReferenceSha256: digest(missingProviderJson)}).blockers.includes("auth_uid_provider_contract_missing"));
    const stub = structuredClone(current);
    stub.catalog.authUidFunctions[0].bodySha256 = digest(" SELECT NULL::uuid ");
    assert.throws(() => buildCreatorFoundationReference({legacy, current: stub, roleProfile: reference.roleProfile, querySha256: digest(query)}), /reference_provider_mismatch/u);

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
    const dashboardInitiallyLogin = sql("SELECT rolcanlogin FROM pg_roles WHERE rolname='dashboard_user';");
    assert.equal(dashboardInitiallyLogin, "f");
    sql("ALTER ROLE dashboard_user LOGIN;");
    const dashboardLogin = classify(JSON.parse(sql(query, databases[1])));
    assert.equal(dashboardLogin.status, "DRIFT");
    assert.ok(dashboardLogin.differingSections.includes("roles"));
    sql("ALTER ROLE dashboard_user NOLOGIN; CREATE ROLE creator_reconciliation_ci_dashboard_rogue NOLOGIN; GRANT dashboard_user TO creator_reconciliation_ci_dashboard_rogue;");
    const dashboardEdge = classify(JSON.parse(sql(query, databases[1])));
    assert.equal(dashboardEdge.status, "DRIFT");
    assert.ok(dashboardEdge.differingSections.includes("memberships"));
    sql("DROP ROLE creator_reconciliation_ci_dashboard_rogue;");
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
    verifiedSnapshots = {legacy, current};
  } finally {
    for (const database of databases) sql(`DROP DATABASE IF EXISTS ${database} WITH (FORCE);`);
    sql("ALTER ROLE dashboard_user NOLOGIN; DROP ROLE IF EXISTS creator_reconciliation_ci_dashboard_rogue; DROP ROLE IF EXISTS creator_reconciliation_ci_indirect; DROP ROLE IF EXISTS creator_reconciliation_ci_rogue; DROP ROLE IF EXISTS creator_reconciliation_ci_grantor;");
  }
  if (process.env.FANMIND_CREATOR_RECONCILIATION_EXPORT === "true") {
    assert.equal(execFileSync("git", ["rev-parse", "HEAD"], {encoding: "utf8"}).trim(), process.env.GITHUB_SHA, "reference export must bind the tested checkout");
    execFileSync("git", ["diff", "--exit-code", "HEAD", "--", ".github/workflows/ci-fanmind.yml", "tests/creator-foundation-reconciliation-pg17.test.mjs", "scripts/operations/creator-foundation-reconciliation-catalog.mjs", "scripts/operations/creator-foundation-reconciliation-preflight.mjs", "scripts/operations/creator-foundation-reconciliation-provider.mjs", "scripts/operations/creator-foundation-reconciliation-parents.mjs", ...Object.values(CREATOR_FOUNDATION_PARENT_PINS).map(pin => pin.path.replace("../../", "")), "scripts/operations/creator-foundation-reconciliation-artifacts", "supabase/controlled/creator_intelligence_foundation.sql", "supabase/controlled/creator_revision_conflict_fix.sql"], {stdio: ["ignore", "ignore", "ignore"]});
    exportCiReferenceArtifacts({...verifiedSnapshots, postgresVersion, environment: process.env});
  }
});

test("CI reference export writes private source-bound files without overwriting an existing destination", () => {
  const directory = mkdtempSync(join(tmpdir(), "creator-ci-reference-test-"));
  const environment = {FANMIND_CREATOR_RECONCILIATION_EXPORT: "true", FANMIND_CREATOR_RECONCILIATION_REVIEWED_SOURCE_SHA: "b".repeat(40), GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "FanMind/FanMind", GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: "a".repeat(40), RUNNER_TEMP: directory};
  try {
    const output = exportCiReferenceArtifacts({legacy: {fixture: "legacy"}, current: {fixture: "current"}, postgresVersion: "17.11", environment});
    assert.deepEqual(readdirSync(output).sort(), ["current.json", "legacy.json", "manifest.json"]);
    assert.equal(lstatSync(output).mode & 0o777, 0o700);
    for (const file of readdirSync(output)) assert.equal(lstatSync(join(output, file)).mode & 0o777, 0o600);
    const manifest = JSON.parse(readFileSync(join(output, "manifest.json"), "utf8"));
    assert.equal(manifest.githubSha, environment.GITHUB_SHA);
    assert.equal(manifest.reviewedSourceSha, "b".repeat(40));
    assert.equal(manifest.stagingRoleProfileApproved, false);
    assert.equal(manifest.stagingProviderProfileApproved, false);
    assert.deepEqual(manifest.providerSourcePins, CREATOR_FOUNDATION_PROVIDER_PINS);
    assert.deepEqual(manifest.parentSourcePins, CREATOR_FOUNDATION_PARENT_PINS);
    assert.equal(manifest.parentProfile, CREATOR_FOUNDATION_PARENT_PROFILE);
    assert.equal(manifest.parentReferenceSqlSha256, digest(buildCreatorFoundationParentReferenceSql()));
    assert.equal(manifest.providerContractSha256, digest(JSON.stringify(creatorFoundationUpstreamProviderContract())));
    assert.equal(manifest.scope, "isolated_ci_creator_foundation_reference");
    assert.equal(manifest.querySha256, digest(query));
    assert.equal(manifest.files["legacy.json"], digest(readFileSync(join(output, "legacy.json"))));
    assert.throws(() => exportCiReferenceArtifacts({legacy: {}, current: {}, postgresVersion: "17.11", environment}));
    assert.deepEqual(JSON.parse(readFileSync(join(output, "legacy.json"), "utf8")), {fixture: "legacy"});
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

test("CI reference export rejects missing binding and symlinked or non-private roots before creating files", () => {
  const directory = mkdtempSync(join(tmpdir(), "creator-ci-reference-boundary-test-"));
  const environment = {FANMIND_CREATOR_RECONCILIATION_EXPORT: "true", FANMIND_CREATOR_RECONCILIATION_REVIEWED_SOURCE_SHA: "b".repeat(40), GITHUB_ACTIONS: "true", GITHUB_REPOSITORY: "FanMind/FanMind", GITHUB_RUN_ID: "12345", GITHUB_RUN_ATTEMPT: "1", GITHUB_SHA: "a".repeat(40), RUNNER_TEMP: directory};
  try {
    for (const patch of [{FANMIND_CREATOR_RECONCILIATION_EXPORT: "false"}, {FANMIND_CREATOR_RECONCILIATION_REVIEWED_SOURCE_SHA: ""}, {GITHUB_ACTIONS: "false"}, {GITHUB_REPOSITORY: "elsewhere/repo"}, {GITHUB_RUN_ID: "../escape"}, {GITHUB_RUN_ATTEMPT: ""}, {GITHUB_SHA: "invalid"}, {RUNNER_TEMP: "relative"}]) {
      assert.throws(() => exportCiReferenceArtifacts({legacy: {}, current: {}, postgresVersion: "17.11", environment: {...environment, ...patch}}), /creator_reference_export_invalid/u);
      assert.deepEqual(readdirSync(directory), []);
    }
    const alias = join(directory, "alias");
    const target = join(directory, "real");
    mkdirSync(target, {mode: 0o700}); symlinkSync(target, alias);
    assert.throws(() => exportCiReferenceArtifacts({legacy: {}, current: {}, postgresVersion: "17.11", environment: {...environment, RUNNER_TEMP: alias}}), /creator_reference_export_invalid/u);
    assert.deepEqual(readdirSync(target), []);
    chmodSync(directory, 0o777);
    assert.throws(() => exportCiReferenceArtifacts({legacy: {}, current: {}, postgresVersion: "17.11", environment}), /creator_reference_export_invalid/u);
    chmodSync(directory, 0o700);
    assert.throws(() => exportCiReferenceArtifacts({legacy: {tooLarge: "x".repeat(2 * 1024 * 1024)}, current: {}, postgresVersion: "17.11", environment}), /creator_reference_export_invalid/u);
    assert.equal(readdirSync(directory).includes("fanmind-creator-foundation-reference-12345-1"), false);
  } finally { rmSync(directory, {recursive: true, force: true}); }
});

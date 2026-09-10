import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";
import {
  FIXED_DEMO_EMAIL,
  STRIPE_BILLING_ALLOWED,
  STRIPE_BILLING_BLOCKED,
  STRIPE_BILLING_RETRYABLE_ERROR,
  STRIPE_BILLING_UPDATED,
  STRIPE_BILLING_ZERO_ROWS,
  isStripeBillingWorkspaceEligible,
  stripeBillingManualSuspensionDecision,
  stripeBillingPatchDecision,
  stripeBillingWorkspaceDecision,
} from "../src/lib/stripeWorkspacePolicy.mjs";

const rpcMigrationPath =
  "supabase/migrations/20260726120000_workspace_provisioning_rpc.sql";
const dailyControlledMigrationPath =
  "supabase/controlled/20260808230102_internal_daily_test_workspace_provisioning.sql";
const privilegeMigrationPath =
  "supabase/controlled/20260726121000_workspace_server_owned_columns.sql";
const triggerFunctionSecurityMigrationPath =
  "supabase/controlled/20260806203023_harden_trigger_function_privileges.sql";
const registerPath = "src/app/register/RegisterClient.tsx";
const registerWorkspaceRoutePath = "src/app/api/register/workspace/route.ts";
const serverPath = "src/lib/supabase/server.ts";
const clientPath = "src/lib/supabase/client.ts";
const provisioningPolicyPath = "src/lib/workspaceProvisioning.ts";
const demoModePath = "src/lib/demoMode.ts";

const userEditableWorkspaceColumns = [
  "name",
  "organization_name",
  "street_address",
  "postal_code",
  "city",
  "country",
  "vat_id",
  "tax_number",
  "company_register_number",
  "company_register_court",
];

test("Stripe billing uses only immutable server identities for demo blocking", () => {
  const normalWorkspace = {
    owner_user_id: "11111111-1111-4111-8111-111111111111",
    billing_status: "pending_payment_setup",
    commercial_option: "starter_paid_setup",
    test_access_flags: {},
  };
  assert.equal(
    stripeBillingWorkspaceDecision({
      workspace: normalWorkspace,
      ownerEmail: "owner@example.com",
      hasTemporaryDemoSession: false,
    }),
    STRIPE_BILLING_ALLOWED,
  );
  assert.equal(
    isStripeBillingWorkspaceEligible({
      workspace: normalWorkspace,
      ownerEmail: "owner@example.com",
      hasTemporaryDemoSession: false,
    }),
    true,
  );

  for (const rejected of [
    {
      workspace: normalWorkspace,
      ownerEmail: FIXED_DEMO_EMAIL.toUpperCase(),
      hasTemporaryDemoSession: false,
    },
    {
      workspace: normalWorkspace,
      ownerEmail: "owner@example.com",
      hasTemporaryDemoSession: true,
    },
  ]) {
    assert.equal(
      stripeBillingWorkspaceDecision(rejected),
      STRIPE_BILLING_BLOCKED,
    );
    assert.equal(isStripeBillingWorkspaceEligible(rejected), false);
  }

  for (const mutableMarker of [
    { billing_status: "demo_free" },
    { commercial_option: "pilot_only" },
    { test_access_flags: { temporary_demo: true } },
    { test_access_flags: { fixed_demo_seed_version: "v1" } },
  ]) {
    assert.equal(
      stripeBillingWorkspaceDecision({
        workspace: { ...normalWorkspace, ...mutableMarker },
        ownerEmail: "owner@example.com",
        hasTemporaryDemoSession: false,
      }),
      STRIPE_BILLING_ALLOWED,
      "owner-mutable pre-contract markers must not block Stripe alone",
    );
  }

  for (const unavailable of [
    {
      workspace: normalWorkspace,
      ownerEmail: null,
      hasTemporaryDemoSession: false,
    },
    {
      workspace: null,
      ownerEmail: "owner@example.com",
      hasTemporaryDemoSession: false,
    },
  ]) {
    assert.equal(
      stripeBillingWorkspaceDecision(unavailable),
      STRIPE_BILLING_RETRYABLE_ERROR,
    );
    assert.equal(isStripeBillingWorkspaceEligible(unavailable), false);
  }
});

test("Stripe PATCH and suspension checks separate update, block and retry", () => {
  const workspaceId = "11111111-1111-4111-8111-111111111111";
  const classify = (overrides = {}) =>
    stripeBillingPatchDecision({
      responseOk: true,
      bodyParsed: true,
      rows: [{ id: workspaceId }],
      workspaceId,
      ...overrides,
    });

  assert.equal(classify(), STRIPE_BILLING_UPDATED);
  assert.equal(classify({ rows: [] }), STRIPE_BILLING_ZERO_ROWS);
  assert.equal(
    classify({ responseOk: false }),
    STRIPE_BILLING_RETRYABLE_ERROR,
  );
  assert.equal(
    classify({ bodyParsed: false }),
    STRIPE_BILLING_RETRYABLE_ERROR,
  );
  assert.equal(
    classify({ rows: [{ id: "22222222-2222-4222-8222-222222222222" }] }),
    STRIPE_BILLING_RETRYABLE_ERROR,
  );
  assert.equal(
    classify({ rows: [{ id: workspaceId }, { id: workspaceId }] }),
    STRIPE_BILLING_RETRYABLE_ERROR,
  );

  const verifySuspension = (overrides = {}) =>
    stripeBillingManualSuspensionDecision({
      responseOk: true,
      bodyParsed: true,
      rows: [{ id: workspaceId, billing_status: "manual_suspended" }],
      workspaceId,
      ...overrides,
    });
  assert.equal(verifySuspension(), STRIPE_BILLING_BLOCKED);
  for (const unavailable of [
    { rows: [] },
    { rows: [{ id: workspaceId, billing_status: null }] },
    { rows: [{ id: workspaceId, billing_status: "active" }] },
    {
      rows: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          billing_status: "manual_suspended",
        },
      ],
    },
    { responseOk: false },
    { bodyParsed: false },
  ]) {
    assert.equal(
      verifySuspension(unavailable),
      STRIPE_BILLING_RETRYABLE_ERROR,
      "only an exact server-confirmed manual suspension may be acknowledged",
    );
  }
});

test("Stripe webhook verifies the target before PATCH and referral sync", async () => {
  const [billing, route, migration] = await Promise.all([
    readFile("src/lib/stripeBilling.ts", "utf8"),
    readFile("src/app/api/stripe/webhook/route.ts", "utf8"),
    readFile(rpcMigrationPath, "utf8"),
  ]);

  assert.match(
    billing,
    /isStripeBillingTargetAllowed[\s\S]*id,owner_user_id[\s\S]*demo_start_sessions[\s\S]*getSupabaseAuthUrl\([\s\S]*stripeBillingWorkspaceDecision/u,
  );
  assert.doesNotMatch(
    billing,
    /workspace\.billing_status|workspace\.commercial_option|workspace\.test_access_flags/u,
  );
  assert.match(
    billing,
    /findWorkspaceIdByStripeReferences[\s\S]*Promise<StripeWorkspaceResolution>[\s\S]*lookups\.length === 0[\s\S]*status: "not_found"[\s\S]*!serviceKey[\s\S]*status: "retryable_error"[\s\S]*new Set<string>\(\)[\s\S]*limit=2[\s\S]*!response\.ok[\s\S]*status: "retryable_error"[\s\S]*response\.json\(\)[\s\S]*payload\.length !== 1[\s\S]*status: "retryable_error"[\s\S]*matchedWorkspaceIds\.add\(id\)[\s\S]*matchedWorkspaceIds\.size > 1[\s\S]*status: "retryable_error"[\s\S]*matchedWorkspaceIds\.size === 1[\s\S]*status: "found", workspaceId[\s\S]*status: "not_found"/u,
  );
  const updateFunctionIndex = billing.indexOf(
    "export async function updateWorkspaceBillingDefensively",
  );
  const guardIndex = billing.indexOf(
    "await isStripeBillingTargetAllowed(",
    updateFunctionIndex,
  );
  const patchIndex = billing.indexOf('method: "PATCH"', guardIndex);
  assert.ok(
    guardIndex >= 0 && patchIndex > guardIndex,
    "Workspace demo guard must run before Stripe PATCH",
  );
  assert.match(
    route,
    /const workspaceResolution = await resolveWorkspaceId[\s\S]*workspaceResolution\.status === "retryable_error"[\s\S]*throw new StripeWebhookRetryableError\(\)[\s\S]*workspaceResolution\.status === "not_found"[\s\S]*Stripe webhook without workspace mapping[\s\S]*return;/u,
  );
  assert.match(
    route,
    /const billingUpdateDecision = await updateWorkspaceBillingDefensively[\s\S]*billingUpdateDecision === STRIPE_BILLING_BLOCKED[\s\S]*return;[\s\S]*billingUpdateDecision === STRIPE_BILLING_RETRYABLE_ERROR[\s\S]*throw new StripeWebhookRetryableError\(\)[\s\S]*billingUpdateDecision !== STRIPE_BILLING_UPDATED[\s\S]*throw new StripeWebhookRetryableError\(\)[\s\S]*syncReferralAutomationForWorkspace/u,
  );
  assert.match(
    billing,
    /Prefer: "return=representation"[\s\S]*stripeBillingPatchDecision\([\s\S]*STRIPE_BILLING_ZERO_ROWS[\s\S]*manualGuardApplied[\s\S]*verifyManualSuspendedBillingState/u,
  );
  assert.match(
    billing,
    /isMissingWorkspaceExpandColumn\(new Error\(errorMessage\)\)[\s\S]*withoutWorkspaceExpandColumns\(body\)[\s\S]*stripeBillingPatchDecision/u,
  );
  assert.match(
    billing,
    /PostgREST rejects the complete PATCH[\s\S]*Retry[\s\S]*already-deployed billing columns/u,
  );
  assert.match(
    billing,
    /verifyManualSuspendedBillingState[\s\S]*select", "id,billing_status"[\s\S]*stripeBillingManualSuspensionDecision/u,
  );
  assert.match(
    migration,
    /stripe_customer_id = null,[\s\S]*stripe_subscription_id = null,[\s\S]*stripe_checkout_session_id = null,[\s\S]*stripe_payment_intent_id = null,[\s\S]*from auth\.users as auth_user/u,
  );
});

test("provisioning RPC derives identity and Starter commercial values server-side", async () => {
  const migration = await readFile(rpcMigrationPath, "utf8");

  assert.match(
    migration,
    /create or replace function public\.ensure_current_user_workspace\(\s*p_workspace_name text,\s*p_commercial_option text,\s*p_payment_terms_accepted boolean\s*\)/u,
  );
  assert.match(migration, /security definer/u);
  assert.match(
    migration,
    /set search_path = pg_catalog, public, pg_temp/u,
  );
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/u);
  assert.match(migration, /auth\.role\(\) is distinct from 'authenticated'/u);
  assert.match(migration, /pg_advisory_xact_lock/u);
  assert.doesNotMatch(
    migration,
    /\bp_(?:owner|user)_id\b|\bp_(?:plan|setup_fee|monthly_fee|billing|stripe|test_access)/u,
  );

  assert.match(
    migration,
    /p_commercial_option = 'starter_paid_setup'[\s\S]*v_setup_fee_cents := 99000[\s\S]*v_commitment_months := 0/u,
  );
  assert.match(
    migration,
    /p_commercial_option = 'starter_no_setup_commitment'[\s\S]*v_setup_fee_cents := 0[\s\S]*v_commitment_months := 12/u,
  );
  assert.match(
    migration,
    /'starter',[\s\S]*p_commercial_option,[\s\S]*v_setup_fee_cents,[\s\S]*31200,[\s\S]*v_commitment_months,[\s\S]*'pending_payment_setup',[\s\S]*'stripe',[\s\S]*'sepa_direct_debit',[\s\S]*'2026-06-v1'/u,
  );
  assert.doesNotMatch(
    migration,
    /p_commercial_option\s+in\s*\([^)]*(?:pilot_only|internal_daily_test)/u,
  );
});

test("Daily provisioning is fixed, atomic and service-role-only", async () => {
  const migration = await readFile(dailyControlledMigrationPath, "utf8");
  assert.match(
    migration,
    /lock table supabase_migrations\.schema_migrations in share mode[\s\S]*version = '20260808230102'/u,
  );
  const dailyFunctionStart = migration.indexOf(
    "create or replace function public.ensure_internal_daily_test_workspace",
  );
  const dailyFunctionEnd = migration.indexOf(
    "revoke all on function public.ensure_internal_daily_test_workspace",
    dailyFunctionStart,
  );
  const dailyFunction = migration.slice(dailyFunctionStart, dailyFunctionEnd);

  assert.match(migration, /^begin;/mu);
  assert.match(migration, /^commit;/mu);
  assert.match(
    migration,
    /add constraint workspaces_commercial_option_daily_check[\s\S]*internal_daily_test[\s\S]*not valid[\s\S]*validate constraint workspaces_commercial_option_daily_check[\s\S]*drop constraint if exists workspaces_commercial_option_check[\s\S]*rename constraint workspaces_commercial_option_daily_check[\s\S]*to workspaces_commercial_option_check/u,
  );
  assert.match(
    migration,
    /add constraint workspaces_payment_collection_method_daily_check[\s\S]*sepa_direct_debit[\s\S]*'card'[\s\S]*not valid[\s\S]*validate constraint workspaces_payment_collection_method_daily_check[\s\S]*drop constraint if exists workspaces_payment_collection_method_check[\s\S]*rename constraint workspaces_payment_collection_method_daily_check[\s\S]*to workspaces_payment_collection_method_check/u,
  );
  assert.match(
    migration,
    /create or replace function public\.ensure_internal_daily_test_workspace\(\s*p_user_id uuid,\s*p_workspace_name text,\s*p_payment_terms_accepted boolean\s*\)/u,
  );
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, public, pg_temp/u);
  assert.match(migration, /auth\.role\(\) is distinct from 'service_role'/u);
  assert.match(migration, /from auth\.users[\s\S]*auth_user\.id = p_user_id/u);
  assert.match(migration, /pg_advisory_xact_lock\(hashtextextended\(p_user_id::text, 0\)\)/u);
  assert.match(
    migration,
    /'pilot',[\s\S]*'internal_daily_test',[\s\S]*0,[\s\S]*0,[\s\S]*0,[\s\S]*'pending_payment_setup',[\s\S]*'stripe',[\s\S]*'card',[\s\S]*false,[\s\S]*'2026-06-v1'/u,
  );
  assert.match(
    migration,
    /insert into public\.workspace_members[\s\S]*on conflict on constraint workspace_members_workspace_id_user_id_key[\s\S]*role = excluded\.role/u,
  );
  assert.doesNotMatch(
    dailyFunction,
    /on conflict \(workspace_id, user_id\)/u,
  );
  assert.doesNotMatch(
    dailyFunction,
    /p_(?:commercial_option|plan_id|setup_fee|monthly_fee|commitment|billing|payment_collection|test_access)/u,
  );
  assert.match(
    migration,
    /revoke all on function public\.ensure_internal_daily_test_workspace\([\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant execute on function public\.ensure_internal_daily_test_workspace\([\s\S]*to service_role/u,
  );
  assert.doesNotMatch(
    migration,
    /grant execute on function public\.ensure_internal_daily_test_workspace\([\s\S]*to (?:public|anon|authenticated)/u,
  );
});

test("Daily readiness source contract matches exact CHECK values and denies browser INSERT", async () => {
  const migration = await readFile(dailyControlledMigrationPath, "utf8");
  const readinessFunctionStart = migration.indexOf(
    "create or replace function public.internal_daily_test_workspace_provisioning_ready",
  );
  const readinessFunctionEnd = migration.indexOf(
    "revoke all on function public.internal_daily_test_workspace_provisioning_ready",
    readinessFunctionStart,
  );
  const readinessFunction = migration.slice(
    readinessFunctionStart,
    readinessFunctionEnd,
  );

  assert.match(
    migration,
    /create or replace function public\.internal_daily_test_workspace_provisioning_ready\(\)[\s\S]*returns table \(ready boolean\)/u,
  );
  assert.match(migration, /auth\.role\(\) = 'service_role'/u);
  assert.match(migration, /to_regprocedure\([\s\S]*ensure_internal_daily_test_workspace\(uuid,text,boolean\)/u);
  assert.match(
    migration,
    /has_function_privilege\(\s*'service_role',[\s\S]*ensure_internal_daily_test_workspace\(uuid,text,boolean\)[\s\S]*'EXECUTE'/u,
  );
  assert.match(
    readinessFunction,
    /workspaces_commercial_option_check[\s\S]*convalidated[\s\S]*pg_get_constraintdef\(constraint_record\.oid, true\)\s*=\s*\$commercial_option_contract\$CHECK \(commercial_option = ANY \(ARRAY\['pilot_only'::text, 'starter_paid_setup'::text, 'starter_no_setup_commitment'::text, 'internal_daily_test'::text\]\)\)\$commercial_option_contract\$/u,
  );
  assert.match(
    readinessFunction,
    /workspaces_payment_collection_method_check[\s\S]*convalidated[\s\S]*pg_get_constraintdef\(constraint_record\.oid, true\)\s*=\s*\$payment_collection_contract\$CHECK \(payment_collection_method IS NULL OR \(payment_collection_method = ANY \(ARRAY\['none'::text, 'manual_invoice'::text, 'sepa_direct_debit'::text, 'card'::text\]\)\)\)\$payment_collection_contract\$/u,
  );
  assert.doesNotMatch(
    readinessFunction,
    /position\(|internal_daily_test'\s+in\s+pg_get_constraintdef|'''card'''\s+in\s+pg_get_constraintdef/u,
  );
  assert.match(
    migration,
    /workspaces_owner_user_id_uidx[\s\S]*indrelid = 'public\.workspaces'::regclass[\s\S]*indisunique[\s\S]*indisvalid[\s\S]*indisready[\s\S]*indislive[\s\S]*indimmediate[\s\S]*array\['owner_user_id'\][\s\S]*workspace_members_workspace_user_uidx[\s\S]*indrelid = 'public\.workspace_members'::regclass[\s\S]*array\['workspace_id', 'user_id'\]/u,
  );
  for (const role of ["anon", "authenticated"]) {
    assert.match(
      migration,
      new RegExp(`not has_table_privilege\\(\\s*'${role}',[\\s\\S]*?'INSERT'`, "u"),
    );
    assert.match(
      migration,
      new RegExp(`not has_any_column_privilege\\(\\s*'${role}',[\\s\\S]*?'INSERT'`, "u"),
    );
  }
  assert.match(
    migration,
    /revoke all on function public\.internal_daily_test_workspace_provisioning_ready\(\)[\s\S]*from public, anon, authenticated[\s\S]*grant execute[\s\S]*to service_role/u,
  );
});

test("Daily provisioning SQL stays outside generic migration discovery", async () => {
  const genericMigrations = await readdir("supabase/migrations");
  const dailyFilename =
    "20260808230102_internal_daily_test_workspace_provisioning.sql";
  const genericSql = (
    await Promise.all(
      genericMigrations
        .filter((filename) => filename.endsWith(".sql"))
        .map((filename) =>
          readFile(`supabase/migrations/${filename}`, "utf8"),
        ),
    )
  ).join("\n");
  const runbook = await readFile(
    "docs/operations/INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING.md",
    "utf8",
  );

  assert.match(dailyControlledMigrationPath, /^supabase\/controlled\//u);
  assert.equal(genericMigrations.includes(dailyFilename), false);
  assert.doesNotMatch(
    genericSql,
    /ensure_internal_daily_test_workspace|internal_daily_test_workspace_provisioning_ready|workspaces_(?:commercial_option|payment_collection_method)_daily_check/u,
  );
  assert.match(
    runbook,
    /außerhalb `supabase\/migrations\/`[\s\S]*generisches\s+`supabase db push`/u,
  );
});

test("provisioning is atomic, idempotent and fail-closed for ambiguous owners", async () => {
  const migration = await readFile(rpcMigrationPath, "utf8");

  assert.match(migration, /^begin;/mu);
  assert.match(migration, /^commit;/mu);
  assert.match(
    migration,
    /having count\(\*\) > 1[\s\S]*workspace_provisioning_duplicate_owner/u,
  );
  assert.match(
    migration,
    /create unique index workspaces_owner_user_id_uidx[\s\S]*owner_user_id/u,
  );
  assert.match(
    migration,
    /workspace_provisioning_owner_index_mismatch[\s\S]*workspace_provisioning_membership_index_mismatch/u,
  );
  assert.match(
    migration,
    /index_record\.indislive[\s\S]*index_record\.indimmediate[\s\S]*index_record\.indislive[\s\S]*index_record\.indimmediate/u,
  );
  assert.match(
    migration,
    /insert into public\.workspace_members[\s\S]*on conflict \(workspace_id, user_id\)[\s\S]*role = excluded\.role/u,
  );
  assert.match(
    migration,
    /revoke all on function public\.ensure_current_user_workspace\(text, text, boolean\)[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant execute on function public\.ensure_current_user_workspace\(text, text, boolean\)[\s\S]*to authenticated/u,
  );
  assert.doesNotMatch(
    migration,
    /grant execute[\s\S]*^\s*to (?:public|anon)\s*;/mu,
  );
});

test("app-first bridge and expand migration preserve the rollout boundary", async () => {
  const [migration, runbook, server] = await Promise.all([
    readFile(rpcMigrationPath, "utf8"),
    readFile(
      "docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md",
      "utf8",
    ),
    readFile(serverPath, "utf8"),
  ]);

  assert.match(
    migration,
    /add column if not exists stripe_checkout_session_id text/u,
  );
  assert.match(
    migration,
    /demo_session\.status in \(\s*'reserved',\s*'active',\s*'expired',\s*'failed',\s*'cleanup_pending',\s*'cleanup_failed'\s*\)/u,
  );
  assert.match(
    runbook,
    /RPC-kompatiblen App-Brückenstand deployen[\s\S]*Production-Preflight[\s\S]*additive Migration[\s\S]*PostgREST-Schema-Cache nachweisen/u,
  );
  assert.match(
    runbook,
    /Postconditions müssen erfolgreich sein, bevor der Rollout über[\s\S]*Schritt A hinaus fortgesetzt und Schritt B freigegeben wird[\s\S]*App-Brückenstand[\s\S]*bereits vor Schritt A deployt/u,
  );
  const compatibilityDeployIndex = runbook.indexOf(
    "den RPC-kompatiblen App-Brückenstand deployen",
  );
  const preflightIndex = runbook.indexOf(
    "## Production-Preflight vor Schritt A",
  );
  const stepAIndex = runbook.indexOf("## Schritt A: additive Migration");
  const indexPostconditionIndex = runbook.indexOf(
    "### Postcondition: Indizes",
  );
  const functionPostconditionIndex = runbook.indexOf(
    "### Postcondition: SECURITY-DEFINER-Funktion",
  );
  const postgrestPostconditionIndex = runbook.indexOf(
    "### Postcondition: Spalten und PostgREST-Schema-Cache",
  );
  const appDeployGateIndex = runbook.indexOf(
    "Erst nach leerer Katalogabfrage und beiden erfolgreichen API-Nachweisen",
  );
  assert.ok(
    compatibilityDeployIndex >= 0 &&
      compatibilityDeployIndex < preflightIndex &&
      preflightIndex < stepAIndex &&
      stepAIndex < indexPostconditionIndex &&
      indexPostconditionIndex < functionPostconditionIndex &&
      functionPostconditionIndex < postgrestPostconditionIndex &&
      postgrestPostconditionIndex < appDeployGateIndex,
    "compatibility deploy, preflight, migration and postconditions are misordered",
  );
  assert.match(
    runbook,
    /--get "\$NEXT_PUBLIC_SUPABASE_URL\/rest\/v1\/workspaces"[\s\S]*payment_terms_version[\s\S]*payment_terms_accepted_at[\s\S]*payment_terms_accepted_by_user_id[\s\S]*stripe_checkout_session_id[\s\S]*stripe_payment_intent_id[\s\S]*stripe_mandate_id[\s\S]*billing_note/u,
  );
  assert.match(
    runbook,
    /\.paths\["\/rpc\/ensure_current_user_workspace"\] != null/u,
  );
  for (const column of [
    "billing_provider",
    "payment_collection_method",
    "payment_terms_version",
    "payment_terms_accepted_at",
    "payment_terms_accepted_by_user_id",
    "stripe_checkout_session_id",
    "stripe_payment_intent_id",
    "stripe_mandate_id",
    "billing_note",
  ]) {
    assert.match(runbook, new RegExp(`\\('${column}'\\)`, "u"));
  }
  const workspaceColumns =
    server.match(/const WORKSPACE_COLUMNS =\s*"([^"]+)"/u)?.[1] ?? "";
  const demoCanonical =
    server.match(
      /function demoProtectedCanonicalValues\([\s\S]*?\n\}\n\nfunction temporaryDemoCanonicalValues/u,
    )?.[0] ?? "";
  const migrationOnlyColumns = [
    "payment_terms_version",
    "payment_terms_accepted_at",
    "payment_terms_accepted_by_user_id",
    "stripe_checkout_session_id",
    "stripe_payment_intent_id",
    "stripe_mandate_id",
    "billing_note",
  ];
  for (const migrationOnlyColumn of migrationOnlyColumns) {
    assert.doesNotMatch(
      workspaceColumns,
      new RegExp(migrationOnlyColumn, "u"),
    );
    assert.doesNotMatch(
      demoCanonical,
      new RegExp(`${migrationOnlyColumn}:`, "u"),
    );
  }
  assert.match(
    migration,
    /from auth\.users as auth_user[\s\S]*auth_user\.id = workspace\.owner_user_id[\s\S]*lower\(btrim\(coalesce\(auth_user\.email, ''\)\)\) = 'sandra\.m@fanmind\.ch'/u,
  );
  assert.match(
    migration,
    /stripe_checkout_session_id = null,[\s\S]*stripe_payment_intent_id = null,[\s\S]*stripe_mandate_id = null,[\s\S]*billing_note = null,[\s\S]*payment_terms_version = null,[\s\S]*payment_terms_accepted_at = null,[\s\S]*payment_terms_accepted_by_user_id = null,[\s\S]*from auth\.users as auth_user/u,
  );
});

test("workspace privileges expose exactly ten owner-editable columns", async () => {
  const migration = await readFile(privilegeMigrationPath, "utf8");
  const grant = migration.match(
    /grant update \(([\s\S]*?)\) on table public\.workspaces\s+to authenticated/u,
  );

  assert.ok(grant, "column-level UPDATE grant missing");
  const actualColumns = grant[1]
    .split(",")
    .map((column) => column.trim())
    .filter(Boolean);

  assert.deepEqual(actualColumns, userEditableWorkspaceColumns);
  assert.match(
    migration,
    /revoke insert, update on table public\.workspaces[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /string_agg\(format\('%I', attribute\.attname\)[\s\S]*revoke insert \(%1\$s\), update \(%1\$s\)[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /alter table public\.workspaces enable row level security/u,
  );
  assert.match(
    migration,
    /drop policy if exists "workspaces_insert_owner"/u,
  );
  assert.match(
    migration,
    /create policy "workspaces_update_owner"[\s\S]*as permissive[\s\S]*using \(owner_user_id = auth\.uid\(\)\)[\s\S]*with check \(owner_user_id = auth\.uid\(\)\)/u,
  );
  assert.match(
    migration,
    /create policy "workspaces_update_owner_boundary"[\s\S]*as restrictive[\s\S]*using \(owner_user_id = auth\.uid\(\)\)[\s\S]*with check \(owner_user_id = auth\.uid\(\)\)/u,
  );
  assert.match(
    migration,
    /grant insert, update on table public\.workspaces[\s\S]*to service_role/u,
  );
  assert.doesNotMatch(
    grant[1],
    /owner_user_id|plan_id|commercial_option|fee_cents|billing|stripe|subscription|test_access_flags/u,
  );
  assert.match(
    migration,
    /workspace_privilege_rls_boundary_failed[\s\S]*has_table_privilege\([\s\S]*workspace_privilege_insert_boundary_failed[\s\S]*has_column_privilege\([\s\S]*'INSERT'[\s\S]*has_column_privilege\([\s\S]*'UPDATE'[\s\S]*workspace_privilege_column_boundary_failed/u,
  );
  assert.match(
    migration,
    /plan_id = 'starter'[\s\S]*starter_paid_setup[\s\S]*starter_no_setup_commitment[\s\S]*payment_terms_version is distinct from '2026-06-v1'[\s\S]*payment_terms_accepted_at is null[\s\S]*2026-06-01 00:00:00\+00[\s\S]*statement_timestamp\(\) \+ interval '5 minutes'[\s\S]*payment_terms_accepted_by_user_id is distinct from owner_user_id[\s\S]*workspace_payment_terms_evidence_missing/u,
  );
});

test("registration and login provisioning are server-owned and only bridge an exact missing RPC", async () => {
  const [register, registerWorkspaceRoute, server, client, policy] = await Promise.all([
    readFile(registerPath, "utf8"),
    readFile(registerWorkspaceRoutePath, "utf8"),
    readFile(serverPath, "utf8"),
    readFile(clientPath, "utf8"),
    readFile(provisioningPolicyPath, "utf8"),
  ]);

  assert.match(client, /rpc\/\$\{functionName\}/u);
  assert.match(register, /await syncSupabaseSessionForServer\(data\.session\)[\s\S]*router.push\(setupHref\)/u);
  assert.doesNotMatch(register, /payment_terms_accepted|fetch\("\/api\/register\/workspace"/u);
  assert.doesNotMatch(register, /supabase\.rpc|\.from\("workspaces"\)|\.from\("workspace_members"\)/u);
  assert.match(
    registerWorkspaceRoute,
    /getSupabaseServerUser\(\)[\s\S]*buildTrustedProvisioningUser\([\s\S]*data\.user[\s\S]*ensureUserWorkspace\(trustedUser\)/u,
  );
  assert.match(registerWorkspaceRoute, /isTrustedFanMindMutationRequest\(request\)/u);
  assert.match(registerWorkspaceRoute, /readBoundedJsonRequest\([\s\S]*MAX_REGISTER_WORKSPACE_BODY_BYTES/u);

  assert.match(
    server,
    /INTERNAL_DAILY_TEST_WORKSPACE_PROVISIONING_RPC[\s\S]*WORKSPACE_PROVISIONING_RPC[\s\S]*p_user_id: user\.id[\s\S]*p_commercial_option: workspaceTerms\.commercialOption/u,
  );
  assert.match(
    server,
    /isInternalDailyTest[\s\S]*isInternalDailyTestWorkspaceProvisioningReady\(\)[\s\S]*getPublicDailyTestPlanEnabled\(\)[\s\S]*getServiceAccessToken\(\)/u,
  );
  assert.doesNotMatch(server, /const repairValues/u);
  assert.match(
    policy,
    /message\.includes\(WORKSPACE_PROVISIONING_RPC\)[\s\S]*could not find the function[\s\S]*pgrst202[\s\S]*schema cache/u,
  );
  assert.match(
    policy,
    /WORKSPACE_EXPAND_COLUMNS[\s\S]*payment_terms_version[\s\S]*stripe_checkout_session_id[\s\S]*billing_note[\s\S]*isMissingWorkspaceExpandColumn[\s\S]*namesKnownColumn[\s\S]*message\.includes\("workspaces"\)[\s\S]*could not find[\s\S]*does not exist/u,
  );
  assert.doesNotMatch(
    policy,
    /permission|forbidden|unauthorized|invalid_commercial_option/u,
  );

  const serverBridgeStart = server.indexOf(
    "// Compatibility bridge for the deploy-before-migrate rollout.",
  );
  const serverBridgeEnd = server.indexOf(
    "\n  if (!workspace?.id)",
    serverBridgeStart,
  );
  assert.ok(
    serverBridgeStart >= 0 &&
      serverBridgeEnd > serverBridgeStart,
    "compatibility bridge boundaries are missing",
  );
  const serverBridge = server.slice(serverBridgeStart, serverBridgeEnd);
  assert.match(serverBridge, /if \(!workspace && !isInternalDailyTest\)/u);
  assert.match(
    serverBridge,
    /isMissingWorkspaceExpandColumn\(fullInsertWorkspaceResult\.error\)[\s\S]*coreInsertWorkspaceResult[\s\S]*billing_status[\s\S]*billing_provider[\s\S]*payment_collection_method[\s\S]*billing_updated_by_user_id/u,
  );
  const serverCoreBridge = serverBridge.slice(
    serverBridge.indexOf("const coreInsertWorkspaceResult"),
  );
  for (const bridgeSource of [serverCoreBridge]) {
    for (const migrationOnlyColumn of [
      "payment_terms_version",
      "payment_terms_accepted_at",
      "payment_terms_accepted_by_user_id",
      "stripe_checkout_session_id",
      "stripe_payment_intent_id",
      "stripe_mandate_id",
      "billing_note",
    ]) {
      assert.doesNotMatch(
        bridgeSource,
        new RegExp(`${migrationOnlyColumn}:`, "u"),
      );
    }
  }
});

test("fixed Sandra demo normalization is service-role-only and unconditional", async () => {
  const [server, demoMode] = await Promise.all([
    readFile(serverPath, "utf8"),
    readFile(demoModePath, "utf8"),
  ]);
  const helper = server.match(
    /async function ensureFixedSandraDemoWorkspace\([\s\S]*?\n\}\n\n(?:type DemoFanSeed)/u,
  );

  assert.ok(helper, "fixed Sandra service helper missing");
  assert.match(helper[0], /getServiceAccessToken\(\)/u);
  assert.match(helper[0], /serviceAccessToken/u);
  assert.match(
    helper[0],
    /\.\.\.demoProtectedCanonicalValues\(user\.id, fixedSeedFlags\)/u,
  );
  assert.match(
    helper[0],
    /seedIsCurrent[\s\S]*FIXED_DEMO_SEED_VERSION_FLAG[\s\S]*if \(!seedIsCurrent\)[\s\S]*seedSandraDemoWorkspaceData[\s\S]*test_access_flags: \{[\s\S]*FIXED_DEMO_SEED_VERSION_FLAG/u,
  );
  assert.match(
    helper[0],
    /onConflict: "workspace_id,user_id"/u,
  );
  assert.match(
    helper[0],
    /deterministicFixedDemoWorkspaceId\(user\.id\)[\s\S]*concurrentRows\.length !== 1[\s\S]*concurrentUpdate/u,
  );
  assert.doesNotMatch(helper[0], /workspace\.name !== DEMO_WORKSPACE_NAME/u);
  assert.match(
    server,
    /user\.email\?\.trim\(\)\.toLowerCase\(\) === DEMO_EMAIL/u,
  );
  const dashboard = server.match(
    /export async function getUserWorkspaceDashboard\([\s\S]*?\n\}\n\nexport async function getWorkspaceSocialConnections/u,
  );
  assert.ok(dashboard, "workspace dashboard helper missing");
  assert.match(
    dashboard[0],
    /user\.email\?\.trim\(\)\.toLowerCase\(\) === DEMO_EMAIL[\s\S]*ensureFixedSandraDemoWorkspace\(user\)/u,
  );
  assert.match(
    demoMode,
    /export function isDemoWorkspace[\s\S]*return workspace\?\.billing_status === "demo_free"/u,
  );
  assert.doesNotMatch(
    demoMode.match(
      /export function isDemoWorkspace[\s\S]*?\n\}/u,
    )?.[0] ?? "",
    /isExplicitDemoWorkspace|workspace\?\.name/u,
  );
});

test("temporary demo identity is server-owned across activation and cleanup", async () => {
  const [server, startRoute, cleanupRoute, rpcMigration] = await Promise.all([
    readFile(serverPath, "utf8"),
    readFile("src/app/api/demo/start/route.ts", "utf8"),
    readFile("src/app/api/demo/cleanup/route.ts", "utf8"),
    readFile(rpcMigrationPath, "utf8"),
  ]);

  const creator = server.match(
    /export async function createTemporaryDemoWorkspace\([\s\S]*?\n\}\n\nasync function normalizeTemporaryDemoWorkspace/u,
  );
  const normalizer = server.match(
    /async function normalizeTemporaryDemoWorkspace\([\s\S]*?\n\}\n\nasync function ensureFixedSandraDemoWorkspace/u,
  );
  const cleanup = server.match(
    /async function deleteServerVerifiedTemporaryDemo\([\s\S]*?\n\}\n\nexport async function deleteExpiredTemporaryDemo/u,
  );

  assert.ok(creator, "temporary demo creator missing");
  assert.ok(normalizer, "temporary demo normalizer missing");
  assert.ok(cleanup, "temporary demo cleanup missing");
  assert.match(
    creator[0],
    /expiresAt: Date[\s\S]*temporaryDemoCanonicalValues\(input\.userId, input\.expiresAt\)/u,
  );
  assert.match(
    normalizer[0],
    /!isServerBoundTemporaryDemoWorkspace\(workspace\)[\s\S]*demo_start_sessions[\s\S]*"id,status,expires_at,auth_user_id,workspace_id"[\s\S]*\["auth_user_id", user\.id\][\s\S]*\["workspace_id", workspace\.id\][\s\S]*session\?\.status === "active"[\s\S]*TEMPORARY_DEMO_EXPIRED_ERROR[\s\S]*sessionExpiry\.getTime\(\) > now \+ TEMPORARY_DEMO_MAX_FUTURE_EXPIRY_MS[\s\S]*temporaryDemoCanonicalValues\(user\.id, sessionExpiry\)/u,
  );
  assert.doesNotMatch(
    normalizer[0],
    /user_metadata|demo_expires_at|getTemporaryDemoExpiryState/u,
    "client-editable auth metadata must never become a database entitlement",
  );
  assert.match(
    startRoute,
    /const expiresAt = new Date\([\s\S]*createTemporaryDemoWorkspace\([\s\S]*expiresAt/u,
  );
  assert.match(
    server,
    /billing_status: "demo_free"[\s\S]*billing_provider: "manual"[\s\S]*payment_collection_method: "none"/u,
  );
  const protectedCanonical = server.match(
    /function demoProtectedCanonicalValues\([\s\S]*?\n\}\n\nfunction temporaryDemoCanonicalValues/u,
  );
  assert.ok(protectedCanonical, "shared demo protection reset missing");
  for (const field of [
    "billing_suspended_at",
    "billing_last_payment_failed_at",
    "billing_contract_started_at",
    "subscription_cancel_requested_at",
    "stripe_customer_id",
    "stripe_subscription_id",
    "last_invoice_id",
    "last_invoice_pdf_url",
  ]) {
    assert.match(protectedCanonical[0], new RegExp(`${field}: null`, "u"));
  }
  assert.match(server, /TEMPORARY_DEMO_ACCESS_FLAG = "temporary_demo"/u);
  assert.match(
    server,
    /demoProtectedCanonicalValues\(userId, \{[\s\S]*\[TEMPORARY_DEMO_ACCESS_FLAG\]: true,[\s\S]*\[TEMPORARY_PROCESSING_ACCESS_FLAG\]: true,[\s\S]*\[TEMPORARY_PROCESSING_ACCESS_EXPIRY_FLAG\]: expiresAt\.toISOString\(\)/u,
  );
  assert.doesNotMatch(
    server.match(
      /function temporaryDemoCanonicalValues\([\s\S]*?\n\}/u,
    )?.[0] ?? "",
    /\.\.\.existingFlags/u,
  );
  assert.match(
    cleanup[0],
    /serverIdentity\.authUserId !== user\.id[\s\S]*serverIdentity\.workspaceId !== workspace\.id[\s\S]*workspace\.billing_status !== "demo_free"[\s\S]*TEMPORARY_DEMO_ACCESS_FLAG/u,
  );
  assert.doesNotMatch(cleanup[0], /workspace\.name !==/u);
  assert.match(
    cleanupRoute,
    /id,name,owner_user_id,billing_status,test_access_flags/u,
  );
  assert.match(
    cleanupRoute,
    /authUserId: candidate\.authUserId[\s\S]*workspaceId: candidate\.workspaceId/u,
  );
  assert.doesNotMatch(cleanupRoute, /incomplete_cleanup_identity/u);
  assert.match(
    cleanupRoute,
    /candidate\.authUserId\s*\?\s*fetchAdminUser[\s\S]*candidate\.workspaceId\s*\?\s*fetchWorkspaceIdentity/u,
  );
  assert.match(
    cleanup[0],
    /if \(workspace\)[\s\S]*if \(user\)/u,
  );
  assert.match(
    rpcMigration,
    /demo_start_sessions[\s\S]*stripe_payment_intent_id = null[\s\S]*stripe_mandate_id = null[\s\S]*billing_note = null[\s\S]*test_access_flags = jsonb_build_object\('temporary_demo', true\)/u,
  );
  assert.match(
    creator[0],
    /profileResult\.error[\s\S]*workspace: workspaceResult\.data[\s\S]*memberResult\.error[\s\S]*workspace: workspaceResult\.data[\s\S]*seedError[\s\S]*workspace: workspaceResult\.data/u,
  );
});

test("fixed demo seed writes are deterministic and idempotent", async () => {
  const server = await readFile(serverPath, "utf8");
  const seed = server.match(
    /async function seedDemoFan\([\s\S]*?\n\}\n\nexport async function ensureUserWorkspace/u,
  );

  assert.ok(seed, "fixed demo seed helper missing");
  assert.match(server, /function deterministicDemoSeedId\(/u);
  for (const resource of [
    "contact",
    "memory",
    "followup",
    "conversation",
    "conversation-message",
  ]) {
    assert.match(seed[0], new RegExp(`"${resource}"`, "u"));
  }
  assert.ok(
    (seed[0].match(/upsert: true/g) ?? []).length >= 5,
    "every seed entity must use deterministic upsert",
  );
  assert.ok(
    (seed[0].match(/onConflict: "id"/g) ?? []).length >= 5,
    "every seed entity must conflict on its deterministic primary key",
  );
  assert.doesNotMatch(
    seed[0],
    /if \(conversations\.data\?\.length\) return null/u,
  );
  assert.match(
    seed[0],
    /postgrestSelect<ConversationMessageRow\[\]>\([\s\S]*"conversation_messages"[\s\S]*existingMessageKeys/u,
  );
  assert.match(
    seed[0],
    /existingMessageKeys\.has\(messageKey\)[\s\S]*existingMessageKeys\.add\(messageKey\)/u,
  );
});

test("workspace master and tax updates are owner-only before RLS", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(
    server,
    /const authorized = ownerOnly\s*\?\s*role === "owner"[\s\S]*\["owner", "admin", "manager"\]/u,
  );
  assert.match(
    server,
    /updateWorkspaceMasterDataSettings\([\s\S]*?getAuthorizedWorkspaceSettingsAccess\(\s*user,\s*workspaceId,\s*true,\s*\)/u,
  );
  assert.match(
    server,
    /updateTaxMasterDataSettings\([\s\S]*?getAuthorizedWorkspaceSettingsAccess\(\s*user,\s*workspaceId,\s*true,\s*\)/u,
  );
});

test("the contract step cannot be applied by a generic migration push", async () => {
  const runbook = await readFile(
    "docs/operations/WORKSPACE_SERVER_OWNED_FIELDS.md",
    "utf8",
  );

  assert.match(
    privilegeMigrationPath,
    /^supabase\/controlled\//u,
  );
  assert.match(
    runbook,
    /supabase db push[\s\S]*(?:nicht|never)[\s\S]*Schritt B/iu,
  );
});

test("trigger helpers are search-path pinned and unavailable as browser RPCs", async () => {
  const migration = await readFile(triggerFunctionSecurityMigrationPath, "utf8");

  assert.match(migration, /^begin;/u);
  assert.match(migration, /commit;\s*$/u);

  for (const functionName of [
    "set_social_connections_updated_at",
    "set_referral_updated_at",
    "set_demo_start_session_updated_at",
  ]) {
    assert.match(
      migration,
      new RegExp(
        `alter function public\\.${functionName}\\(\\)[\\s\\S]*` +
          "set search_path = pg_catalog, pg_temp",
        "u",
      ),
    );
    assert.match(
      migration,
      new RegExp(
        `revoke all on function public\\.${functionName}\\(\\)[\\s\\S]*` +
          "from public, anon, authenticated",
        "u",
      ),
    );
  }

  assert.match(
    migration,
    /to_regprocedure\([\s\S]*'public\.trim_conversation_messages_to_latest_50\(\)'[\s\S]*\) is not null/u,
  );
  assert.match(
    migration,
    /alter function public\.trim_conversation_messages_to_latest_50\(\)[\s\S]*set search_path = pg_catalog, pg_temp/u,
  );
  assert.match(
    migration,
    /revoke all on function public\.trim_conversation_messages_to_latest_50\(\)[\s\S]*from public, anon, authenticated/u,
  );
  assert.doesNotMatch(
    migration,
    /grant execute[\s\S]*to (?:public|anon|authenticated)/u,
  );
});

test("workspace provisioning conflict target stays unambiguous", async () => {
  const migration = await readFile(
    "supabase/migrations/20260813210000_fix_workspace_provisioning_conflict_ambiguity.sql",
    "utf8",
  );
  const functionStart = migration.indexOf(
    "create or replace function public.ensure_current_user_workspace",
  );
  const functionEnd = migration.indexOf(
    "revoke all on function public.ensure_current_user_workspace",
    functionStart,
  );
  const functionSql = migration.slice(functionStart, functionEnd);

  assert.ok(functionStart >= 0 && functionEnd > functionStart);
  assert.match(
    functionSql,
    /insert into public\.workspace_members as workspace_member[\s\S]*on conflict on constraint workspace_members_workspace_id_user_id_key[\s\S]*set role = excluded\.role/u,
  );
  assert.doesNotMatch(
    functionSql,
    /on conflict \(workspace_id, user_id\)/u,
  );
  assert.match(
    migration,
    /revoke all on function public\.ensure_current_user_workspace\(text, text, boolean\)[\s\S]*from public, anon, authenticated/u,
  );
  assert.match(
    migration,
    /grant execute on function public\.ensure_current_user_workspace\(text, text, boolean\)[\s\S]*to authenticated/u,
  );
});

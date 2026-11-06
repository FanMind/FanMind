import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import {
  chmod,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  EXPECTED_CONTROL_SHA256,
  runStagingBillingCanonicalAcceptance,
  billingDatabaseFailureDiagnostic,
  evaluateStripeBillingEventLedgerSql,
  materializeStripeBillingEventLedgerPostflight,
} from "../scripts/operations/stripe-billing-event-ledger-runner.mjs";

const SQL_PATH = new URL(
  "../supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql",
  import.meta.url,
);
const ROUTE_PATH = new URL(
  "../src/app/api/stripe/webhook/route.ts",
  import.meta.url,
);
const execFileAsync = promisify(execFile);
const RUNNER_PATH =
  "scripts/operations/stripe-billing-event-ledger-runner.mjs";
const REVIEWED_COMMIT = "a".repeat(40);

async function withFakeDatabase(callback) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-billing-ledger-test-"));
  try {
    const fakePsql = join(root, "psql");
    const passfile = join(root, "pgpass");
    const callLog = join(root, "psql-calls.log");
    const inputLog = join(root, "psql-input.log");
    await writeFile(
      fakePsql,
      `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "psql (PostgreSQL) synthetic"
  exit 0
fi
[ "$PGSSLMODE" = "verify-full" ] || exit 81
[ "$PGGSSENCMODE" = "disable" ] || exit 82
case "$PGSSLROOTCERT" in /*) ;; *) exit 83 ;; esac
printf '%s\n' "$*" >> "$FANMIND_TEST_PSQL_CALL_LOG"
cat >> "$FANMIND_TEST_PSQL_INPUT_LOG"
printf '\n-- FANMIND TEST CALL END --\n' >> "$FANMIND_TEST_PSQL_INPUT_LOG"
if [ -n "\${FANMIND_TEST_POSTFLIGHT_OUTPUT:-}" ]; then
  printf '%s\n' "$FANMIND_TEST_POSTFLIGHT_OUTPUT"
else
  echo "STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS"
  echo "STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING=1"
  echo "STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED=1"
fi
`,
      { mode: 0o700 },
    );
    await writeFile(
      passfile,
      "aws-0-eu-central-1.pooler.supabase.com:5432:postgres:postgres.stagingref12345:synthetic-password\n",
      { mode: 0o600 },
    );
    await chmod(passfile, 0o600);
    const environment = {
      ...process.env,
      PATH: `${root}:${process.env.PATH}`,
      FANMIND_TEST_PSQL_CALL_LOG: callLog,
      FANMIND_TEST_PSQL_INPUT_LOG: inputLog,
      FANMIND_RUNTIME_ENVIRONMENT: "staging",
      NEXT_PUBLIC_APP_URL: "https://staging.fanmind.invalid",
      NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
      FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.invalid",
      FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
      FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
      FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
      FANMIND_NON_PRODUCTION_WRITE_ACK: "",
      FANMIND_STRIPE_BILLING_EVENT_LEDGER_REVIEWED_COMMIT: REVIEWED_COMMIT,
      FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONFIRM: "",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: REVIEWED_COMMIT,
      PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
      FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
      FANMIND_PRODUCTION_DB_HOST: "db.productionref123.supabase.co",
      PGPORT: "5432",
      PGDATABASE: "postgres",
      PGUSER: "postgres.stagingref12345",
      PGSSLMODE: "verify-full",
      PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
      PGPASSFILE: passfile,
    };
    return await callback({ environment, callLog, inputLog });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("general ledger is controlled, transactional and never a generic migration", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.match(sql, /^begin;/u);
  assert.match(sql, /commit;\s*$/u);
  assert.doesNotMatch(SQL_PATH.pathname, /supabase\/migrations/u);
  assert.match(sql, /CONTROLLED \/ DORMANT BY DEFAULT/u);
  assert.doesNotMatch(sql, /https:\/\/api\.stripe\.com|net\.http|http_post/u);
  assert.equal(evaluateStripeBillingEventLedgerSql(sql).digest, EXPECTED_CONTROL_SHA256);
});

test("persistent ledger has streams, historical bindings and canonical receipts", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.match(sql, /create table public\.workspace_stripe_billing_events/u);
  assert.match(sql, /create table public\.workspace_stripe_billing_streams/u);
  assert.match(sql, /create table public\.workspace_stripe_billing_object_bindings/u);
  assert.match(sql, /create table public\.workspace_stripe_billing_reconciliations/u);
  assert.match(sql, /'payment_intent'.*'invoice'.*'charge'.*'refund'.*'dispute'/su);
  assert.match(sql, /raw webhook bodies are never stored/u);
});

test("schema postflight is exact, transactional and source/body-bound", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  const postflight = materializeStripeBillingEventLedgerPostflight(sql);
  assert.match(
    sql,
    /create function public\.verify_workspace_stripe_billing_ledger_schema\(\)[\s\S]*stripe_billing_ledger_columns_invalid/u,
  );
  assert.match(sql, /stripe_billing_ledger_constraints_invalid/u);
  assert.match(sql, /stripe_billing_ledger_check_constraint_trivial/u);
  assert.match(sql, /stripe_billing_ledger_check_constraint_weakened/u);
  assert.match(sql, /FANMIND_STRIPE_BILLING_SCHEMA_REFERENCE_BEGIN/u);
  assert.match(sql, /create temporary table fanmind_expected_workspaces/u);
  assert.match(sql, /stripe_billing_ledger_constraint_source_hash_invalid/u);
  assert.match(sql, /stripe_billing_ledger_index_source_hash_invalid/u);
  assert.match(sql, /pg_catalog\.sha256/u);
  assert.match(
    sql,
    /v_actual_definition := pg_get_constraintdef[\s\S]*if v_definition\.constraint_type = 'f' then[\s\S]*REFERENCES \(public\[.\]\)\?workspaces/u,
  );
  assert.doesNotMatch(
    sql,
    /\(public\|pg_temp\(_\[0-9\]\+\)\?\)\[.\]/u,
  );
  assert.doesNotMatch(sql, /fanmind-exact-v1:/u);
  assert.doesNotMatch(sql, /comment on constraint|comment on index/iu);
  assert.match(sql, /stripe_billing_ledger_indexes_invalid/u);
  assert.match(sql, /where table_relation\.relnamespace = 'public'::regnamespace\s+and index_relation\.relname in/u);
  assert.match(sql, /stripe_billing_ledger_table_acl_invalid/u);
  assert.match(sql, /stripe_billing_ledger_column_acl_invalid/u);
  assert.match(sql, /stripe_billing_ledger_function_set_invalid/u);
  assert.match(sql, /stripe_billing_ledger_function_contract_invalid/u);
  assert.match(
    sql,
    /select public\.verify_workspace_stripe_billing_ledger_schema\(\);[\s\S]*insert into public\.workspace_stripe_billing_object_bindings/u,
  );
  assert.match(
    postflight,
    /create temporary table fanmind_expected_workspaces[\s\S]*create index workspace_stripe_billing_event_pending_idx[\s\S]*begin;[\s\S]*set transaction read only/u,
  );
  assert.match(postflight, /schema_verifier_drift/u);
  assert.match(
    postflight,
    /perform public\.verify_workspace_stripe_billing_ledger_schema\(\)/u,
  );
  assert.doesNotMatch(postflight, /__FANMIND_SCHEMA_VERIFIER_BODY_BASE64__/u);
  assert.doesNotMatch(postflight, /__FANMIND_SCHEMA_REFERENCE_DDL__/u);
  assert.doesNotMatch(
    postflight.slice(0, postflight.indexOf("begin;")),
    /\bpublic\s*[.]/iu,
  );
  assert.match(postflight, /rollback;/u);
  assert.throws(
    () =>
      evaluateStripeBillingEventLedgerSql(
        sql.replace(
          "stripe_billing_ledger_check_constraint_trivial",
          "stripe_billing_ledger_check_constraint_removed",
        ),
      ),
    /control_checksum_mismatch/u,
  );
  assert.throws(
    () =>
      evaluateStripeBillingEventLedgerSql(
        sql.replace(
          "check (projection_revision >= 0)",
          "check (true or projection_revision >= 0)",
        ),
      ),
    /control_checksum_mismatch/u,
  );
  assert.throws(
    () =>
      evaluateStripeBillingEventLedgerSql(
        sql.replace(
          "'^evt_[A-Za-z0-9_]+$'",
          "'^evt_public.[A-Za-z0-9_]+$'",
        ),
      ),
    /control_checksum_mismatch/u,
  );
});

test("PostgreSQL verifier regex literals use one standard-conforming slash", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  for (const expected of [
    String.raw`'\s+'`,
    String.raw`'^CHECK \('`,
    String.raw`'^\(?workspace_id is not null\)?$'`,
    String.raw`'^\(?processing_state = any \(array\[''unresolved''::text, ''reconciliation_needed''::text\]\)\)?$'`,
  ]) {
    assert.ok(sql.includes(expected), `missing exact SQL regex ${expected}`);
  }
  for (const overEscaped of [
    String.raw`'\\s+'`,
    String.raw`'^CHECK \\('`,
    String.raw`'^\\(?workspace_id is not null\\)?$'`,
  ]) {
    assert.equal(
      sql.includes(overEscaped),
      false,
      `over-escaped SQL regex ${overEscaped}`,
    );
  }
  const whitespace = new RegExp(String.raw`\s+`, "gu");
  const checkPrefix = new RegExp(String.raw`^CHECK \(`, "iu");
  const workspacePredicate = new RegExp(
    String.raw`^\(?workspace_id is not null\)?$`,
    "iu",
  );
  const pendingPredicate = new RegExp(
    String.raw`^\(?processing_state = any \(array\['unresolved'::text, 'reconciliation_needed'::text\]\)\)?$`,
    "iu",
  );
  assert.equal("CHECK   ((true))".replace(whitespace, ""), "CHECK((true))");
  assert.equal(checkPrefix.test("CHECK (event_id IS NOT NULL)"), true);
  assert.equal(workspacePredicate.test("(workspace_id is not null)"), true);
  assert.equal(
    pendingPredicate.test(
      "processing_state = any (array['unresolved'::text, 'reconciliation_needed'::text])",
    ),
    true,
  );
  assert.throws(() => new RegExp(String.raw`^CHECK \\(`, "iu"), SyntaxError);
});

test("catalog-like fingerprints preserve CHECK literals and map only FK targets", () => {
  const digest = (value) => createHash("sha256").update(value).digest("hex");
  const normalizeForeignKey = (definition, source) => {
    if (source === "actual") {
      return definition
        .replace(
          /REFERENCES (?:public[.])?workspaces[(]/gu,
          "REFERENCES workspaces(",
        )
        .replace(
          /REFERENCES (?:public[.])?workspace_stripe_billing_reconciliations[(]/gu,
          "REFERENCES workspace_stripe_billing_reconciliations(",
        );
    }
    return definition
      .replace(
        /REFERENCES (?:(?:pg_temp(?:_[0-9]+)?)[.])?fanmind_expected_workspaces[(]/gu,
        "REFERENCES workspaces(",
      )
      .replace(
        /REFERENCES (?:(?:pg_temp(?:_[0-9]+)?)[.])?fanmind_expected_workspace_stripe_billing_reconciliations[(]/gu,
        "REFERENCES workspace_stripe_billing_reconciliations(",
      );
  };
  const expectedCheck =
    "CHECK ((event_id ~ '^evt_[A-Za-z0-9_]+$'::text))";
  const attackedCheck =
    "CHECK ((event_id ~ '^evt_public.[A-Za-z0-9_]+$'::text))";
  assert.notEqual(digest(attackedCheck), digest(expectedCheck));
  assert.equal(attackedCheck.includes("public."), true);
  assert.equal(new RegExp("^evt_[A-Za-z0-9_]+$").test("evt_public!A"), false);
  assert.equal(
    new RegExp("^evt_public.[A-Za-z0-9_]+$").test("evt_public!A"),
    true,
  );
  const actualForeignKey =
    "FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE";
  const oracleForeignKey =
    "FOREIGN KEY (workspace_id) REFERENCES pg_temp_7.fanmind_expected_workspaces(id) ON DELETE CASCADE";
  assert.equal(
    digest(normalizeForeignKey(actualForeignKey, "actual")),
    digest(normalizeForeignKey(oracleForeignKey, "oracle")),
  );
});

test("service-role RPC EXECUTE cannot carry grant option", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  const postflight = materializeStripeBillingEventLedgerPostflight(sql);
  assert.match(
    sql,
    /v_function\.service_execute[\s\S]*acl\.privilege_type = 'EXECUTE'[\s\S]*acl\.grantor = definition\.proowner\s+and not acl\.is_grantable/u,
  );
  assert.match(
    postflight,
    /acl\.grantee = \([\s\S]*rolname = 'service_role'[\s\S]*acl\.privilege_type = 'EXECUTE'\s+and acl\.is_grantable/u,
  );
  assert.throws(
    () =>
      evaluateStripeBillingEventLedgerSql(
        sql.replace("and not acl.is_grantable", "and acl.is_grantable"),
      ),
    /control_checksum_mismatch/u,
  );
});

test("billing function ownership is session-bound and never service-role", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  const postflight = materializeStripeBillingEventLedgerPostflight(sql);
  assert.match(
    sql,
    /definition\.proowner = \([\s\S]*rolname = session_user[\s\S]*definition\.proowner <> \([\s\S]*rolname = 'service_role'/u,
  );
  assert.equal(
    postflight.match(/rolname = session_user/gu)?.length,
    3,
    "verifier, outer RPCs and helpers need independent owner checks",
  );
  assert.equal(postflight.match(/proowner <> \(/gu)?.length, 3);
  const ownerAllowed = (ownerOid, sessionOwnerOid, serviceRoleOid) =>
    ownerOid === sessionOwnerOid && ownerOid !== serviceRoleOid;
  assert.equal(ownerAllowed(20, 20, 30), true);
  assert.equal(ownerAllowed(30, 20, 30), false);
  assert.equal(ownerAllowed(30, 30, 30), false);
  assert.throws(
    () =>
      evaluateStripeBillingEventLedgerSql(
        sql.replace(
          "and definition.proowner <> (",
          "and definition.proowner = (",
        ),
      ),
    /control_checksum_mismatch/u,
  );
});

test("all billing routine bodies are source-hash-bound by the pinned verifier", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  const routineNames = [
    "workspace_stripe_billing_projection_valid",
    "apply_workspace_stripe_billing_projection",
    "mark_workspace_stripe_billing_reconciliation",
    "apply_workspace_stripe_billing_event",
    "reconcile_workspace_stripe_billing_projection",
  ];
  for (const routineName of routineNames) {
    const bodyMatch = new RegExp(
      `create function public[.]${routineName}\\([\\s\\S]*?\\)\\s*` +
        "returns[\\s\\S]*?as \\$function\\$(?<body>[\\s\\S]*?)" +
        "\\$function\\$;",
      "iu",
    ).exec(sql);
    assert.ok(bodyMatch?.groups?.body, `${routineName} body must be extractable`);
    const bodyHash = createHash("sha256")
      .update(bodyMatch.groups.body, "utf8")
      .digest("hex");
    assert.equal(
      sql.split(`'${bodyHash}'`).length - 1,
      1,
      `${routineName} must have one immutable verifier hash`,
    );
  }
  assert.match(
    sql,
    /pg_catalog\.sha256\(convert_to\([\s\S]*definition\.prosrc[\s\S]*stripe_billing_ledger_function_body_drift/u,
  );
  assert.throws(
    () =>
      evaluateStripeBillingEventLedgerSql(
        sql.replace(
          "v_stream_bootstrap_allowed boolean;",
          "v_stream_bootstrap_allowed boolean; -- unauthorized body drift",
        ),
      ),
    /control_checksum_mismatch/u,
  );
});

test("event RPC serializes identity and monotonic state without event-id ordering", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.match(sql, /on conflict \(event_id\) do nothing/u);
  assert.match(sql, /p_event_created_at < v_stream\.last_event_created_at/u);
  assert.match(sql, /p_event_created_at = v_stream\.last_event_created_at/u);
  assert.match(sql, /event_order_conflict/u);
  assert.match(sql, /projection_revision = projection_revision \+ 1/u);
  assert.match(sql, /and projection_revision = v_expected_revision/u);
  assert.doesNotMatch(sql, /p_event_id\s*[<>]/u);
  assert.match(sql, /Lexical event-ID order here is only a deadlock-free\s+-- multi-row lock order; it is never used as Stripe lifecycle chronology/u);
  assert.match(sql, /v_stream\.lifecycle_terminal[\s\S]*terminal_subscription_conflict/u);
  assert.match(sql, /p_event_type = 'customer\.subscription\.deleted' then true/u);
  assert.match(sql, /fanmind-stripe-billing:[\s\S]*pg_advisory_xact_lock/u);
  assert.match(sql, /order by event_anchor\.anchor_type, event_anchor\.anchor_id/u);
  assert.match(sql, /UUID order preserves event -> Workspace -> stream order/u);
});

test("typed tenant contracts do not use invoice PI as an invoice anchor", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.match(sql, /p_binding_mode = 'customer_transaction'.*p_customer_id is null or p_payment_intent_id is null/su);
  assert.match(sql, /p_binding_mode = 'customer_subscription'.*p_customer_id is null or p_subscription_id is null/su);
  assert.match(sql, /binding\.stripe_object_type = 'payment_intent'\s+and p_binding_mode in \(\s+'checkout', 'customer_transaction', 'reversal'/u);
  assert.doesNotMatch(
    sql,
    /binding\.stripe_object_type = 'payment_intent'\s+and p_binding_mode in \([^)]*customer_subscription/u,
  );
  assert.doesNotMatch(
    sql,
    /binding\.stripe_object_type = 'invoice'\s+and p_binding_mode = 'customer_subscription'/u,
  );
  assert.match(sql, /p_binding_mode = 'reversal'.*'object_binding_missing'/su);
  assert.match(sql, /workspace_stripe_billing_event_reference_contract_invalid/u);
  assert.match(sql, /p_event_type like 'invoice\.%'[\s\S]*p_invoice_id is null/u);
  assert.match(sql, /p_event_stream = 'tax'[\s\S]*workspace_stripe_billing_tax_projection_invalid/u);
  assert.match(sql, /if not p_projection_enabled then[\s\S]*v_reason := 'reconciliation_pending'/u);
  assert.match(
    sql,
    /v_stream_bootstrap_allowed[\s\S]*p_event_stream = 'lifecycle'[\s\S]*p_binding_mode = 'checkout'[\s\S]*v_workspace\.stripe_customer_id is null[\s\S]*v_workspace\.stripe_subscription_id is null[\s\S]*workspace_stripe_billing_object_bindings/u,
  );
  assert.match(
    sql,
    /case when v_stream_bootstrap_allowed then 'in_sync'[\s\S]*case when v_stream_bootstrap_allowed then null[\s\S]*else 'controlled_cutover'/u,
  );
  assert.doesNotMatch(sql, /case when p_projection_enabled then 'in_sync'/u);
});

test("unresolved events persist and conflicts fail closed only for lifecycle", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.match(sql, /processing_state = 'unresolved'/u);
  assert.match(sql, /'tenant_binding_missing', 'object_binding_missing'/u);
  assert.match(sql, /p_customer_id is null or p_subscription_id is null[\s\S]*v_reason := 'tenant_binding_missing'/u);
  assert.match(sql, /if p_event_stream = 'lifecycle' then\s+perform public\.mark_workspace_stripe_billing_reconciliation/su);
  assert.match(sql, /billing_status = 'suspended'/u);
  assert.match(sql, /workspace_access_mode = 'archived_readonly'/u);
  assert.match(sql, /billing_status is distinct from 'manual_suspended'/u);
  assert.match(sql, /foreach v_conflict_workspace_id in array coalesce\(v_candidates, '\{\}'\)/u);
  assert.match(
    sql,
    /A conflicting delivery may make a formerly unresolved event attributable[\s\S]*\('customer', v_event\.stripe_customer_id\)[\s\S]*\('customer', p_customer_id\)[\s\S]*foreach v_conflict_workspace_id in array v_candidates/u,
  );
  assert.match(sql, /pending\.processing_state in \('unresolved', 'reconciliation_needed'\)[\s\S]*v_prior_pending/u);
  assert.match(sql, /elsif v_prior_pending then[\s\S]*v_reason := 'reconciliation_pending'/u);
  assert.match(sql, /workspace\.id = p_workspace_id_candidate/u);
});

test("canonical reconciliation is request-id idempotent, snapshot-fresh and CAS-bound", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.match(sql, /p_stripe_request_id !~ '\^req_/u);
  assert.match(sql, /snapshot_fingerprint.*\^\[a-f0-9\]\{64\}\$/u);
  assert.match(sql, /duplicate_reconciliation/u);
  assert.match(sql, /workspace_stripe_billing_reconciliation_cas_conflict/u);
  assert.match(
    sql,
    /v_cutoff <= greatest\(\s*coalesce\(v_pending_max, -1\),\s*coalesce\(v_stream\.last_event_created_at, -1\)\s*\)/u,
  );
  assert.match(sql, /workspace_stripe_billing_reconciliation_pending_omitted/u);
  assert.match(sql, /resolved_event_ids/u);
  assert.match(sql, /snapshot_observed_at < statement_timestamp\(\) - interval '15 minutes'/u);
  assert.match(sql, /p_projection \?& array\[[\s\S]*'workspace_access_mode'/u);
  assert.match(sql, /canonical_anchor\.anchor_type, canonical_anchor\.anchor_id/u);
  assert.match(sql, /binding\.value->>'type' not in \('customer', 'tax_id'\)/u);
  assert.match(sql, /event\.workspace_id_candidate = p_workspace_id[\s\S]*v_checkout_bootstrap/u);
  assert.match(sql, /event\.stripe_customer_id = p_customer_id[\s\S]*jsonb_array_elements\(p_object_bindings\)/u);
  assert.match(sql, /'charge', event\.stripe_charge_id[\s\S]*'dispute', event\.stripe_dispute_id/u);
});

test("ledger tables are forced-RLS and only service-role RPC execute is granted", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  for (const table of [
    "workspace_stripe_billing_streams",
    "workspace_stripe_billing_object_bindings",
    "workspace_stripe_billing_reconciliations",
    "workspace_stripe_billing_events",
  ]) {
    assert.match(sql, new RegExp(`alter table public\\.${table} force row level security`, "u"));
    assert.match(sql, new RegExp(`revoke all on table public\\.${table}`, "u"));
  }
  assert.match(sql, /grant execute on function public\.apply_workspace_stripe_billing_event/su);
  assert.match(sql, /grant execute on function public\.reconcile_workspace_stripe_billing_projection/su);
  assert.doesNotMatch(sql, /grant execute[\s\S]*with grant option/iu);
  assert.doesNotMatch(sql, /grant (select|insert|update|delete).*workspace_stripe_billing_/u);
});

test("existing Stripe workspaces seed into canonical cutover, not in-sync", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.match(sql, /'reconciliation_needed', 'controlled_cutover'/u);
  assert.match(sql, /customer_binding_collision/u);
  assert.match(sql, /subscription_binding_collision/u);
});

test("route enters ledger before legacy lookup only behind the dormant gate", async () => {
  const route = await readFile(ROUTE_PATH, "utf8");
  assert.match(route, /if \(isStripeBillingEventLedgerCaptureEnabled\(\)\) \{\s+const ledgerResult = await syncStripeBillingEvent/su);
  assert.match(
    route,
    /syncStripeBillingEvent\(\{\s+event: input\.event,\s+projection: input\.fields,\s+referralBillingStatus: input\.referralBillingStatus,\s+signedEventVerified: true,\s+\}\);/u,
  );
  assert.match(route, /ledgerResult\.status === "unresolved"/u);
  assert.match(route, /ledgerResult\.status === "reconciliation_needed"/u);
  assert.match(route, /ledgerResult\.reason === "reconciled_event"/u);
  assert.match(route, /isStripeBillingEventLedgerCaptureEnabled\(\) &&\s+!isStripeBillingEventLedgerEnabled\(\)[\s\S]*return;/u);
  assert.match(route, /else \{\s+\/\/ Dormant-by-default bridge[\s\S]*resolveWorkspaceId/u);
  assert.match(
    route,
    /stripeWebhookReferenceLookupValues\(\{[\s\S]*findWorkspaceIdByStripeReferences\(lookupReferences\)[\s\S]*resolution\.status === "not_found"[\s\S]*status: "retryable_error"/u,
  );
});

test("runner check pins the reviewed SQL without a database", async () => {
  const { stdout, stderr } = await execFileAsync(process.execPath, [
    RUNNER_PATH,
    "--check",
  ]);
  const output = `${stdout}\n${stderr}`;
  assert.match(output, /STRIPE_BILLING_EVENT_LEDGER_CHECKSUM=verified/u);
  assert.match(output, /STRIPE_BILLING_EVENT_LEDGER_CONTRACT=verified/u);
  assert.match(output, /STRIPE_BILLING_EVENT_LEDGER_READY=YES/u);
});

test("runner verify creates only a temp oracle before rollback read-only inspection", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [RUNNER_PATH, "--verify"],
      { env: environment },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const sql = await readFile(inputLog, "utf8");
    assert.match(output, /STRIPE_BILLING_EVENT_LEDGER_APPLY=not_requested/u);
    assert.match(output, /STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS/u);
    assert.match(output, /STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING=1/u);
    assert.match(
      output,
      /STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED=1/u,
    );
    assert.equal(calls.trim().split("\n").length, 1);
    assert.match(
      sql,
      /create temporary table fanmind_expected_workspaces[\s\S]*begin;[\s\S]*set transaction read only/iu,
    );
    assert.match(sql, /rollback;/iu);
    assert.doesNotMatch(
      `${output}\n${calls}`,
      /synthetic-password|stagingref12345|db\.stagingref12345\.supabase\.co/u,
    );
  });
});

test("runner apply needs both non-production gates and exact confirmation", async () => {
  await withFakeDatabase(async ({ environment }) => {
    for (const override of [
      {},
      { FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true" },
      {
        FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
        FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
        FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONFIRM: "yes",
      },
    ]) {
      await assert.rejects(
        execFileAsync(process.execPath, [RUNNER_PATH, "--apply"], {
          env: { ...environment, ...override },
        }),
        (error) => {
          assert.match(
            `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
            /STRIPE_BILLING_EVENT_LEDGER_ERROR=(environment_invalid|apply_confirmation_invalid)/u,
          );
          return true;
        },
      );
    }
  });
});

test("confirmed synthetic Staging apply executes control and postflight once", async () => {
  await withFakeDatabase(async ({ environment, callLog, inputLog }) => {
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [RUNNER_PATH, "--apply"],
      {
        env: {
          ...environment,
          FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
          FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
          FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONFIRM:
            "apply-stripe-billing-event-ledger",
        },
      },
    );
    const output = `${stdout}\n${stderr}`;
    const calls = await readFile(callLog, "utf8");
    const sql = await readFile(inputLog, "utf8");
    assert.match(output, /STRIPE_BILLING_EVENT_LEDGER_APPLY=completed/u);
    assert.equal(calls.trim().split("\n").length, 2);
    assert.match(sql, /create table public\.workspace_stripe_billing_events/iu);
    assert.match(sql, /set transaction read only/iu);
    assert.doesNotMatch(output, /synthetic-password/u);
  });
});

test("runner rejects a spoofed or partial PASS transcript after apply", async () => {
  await withFakeDatabase(async ({ environment }) => {
    await assert.rejects(
      execFileAsync(process.execPath, [RUNNER_PATH, "--apply"], {
        env: {
          ...environment,
          FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
          FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
          FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONFIRM:
            "apply-stripe-billing-event-ledger",
          FANMIND_TEST_POSTFLIGHT_OUTPUT:
            "STRIPE_BILLING_EVENT_LEDGER_POSTFLIGHT=PASS\n" +
            "STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING=0\n" +
            "UNEXPECTED_FALSE_PASS=1",
        },
      }),
      (error) => {
        assert.match(
          `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
          /STRIPE_BILLING_EVENT_LEDGER_ERROR=postflight_failed/u,
        );
        return true;
      },
    );
  });
});

test("runner rejects every Production target even with write acknowledgements", async () => {
  await withFakeDatabase(async ({ environment }) => {
    await assert.rejects(
      execFileAsync(process.execPath, [RUNNER_PATH, "--apply"], {
        env: {
          ...environment,
          FANMIND_RUNTIME_ENVIRONMENT: "production",
          NEXT_PUBLIC_APP_URL: "https://fanmind.ch",
          NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
          FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
          FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
          FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
          FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONFIRM:
            "apply-stripe-billing-event-ledger",
        },
      }),
      (error) => {
        assert.match(
          `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
          /STRIPE_BILLING_EVENT_LEDGER_ERROR=environment_invalid/u,
        );
        return true;
      },
    );
  });
});

test("runner requires exact reviewed main, pinned TLS and no libpq redirect", async () => {
  await withFakeDatabase(async ({ environment }) => {
    for (const override of [
      { GITHUB_REF: "refs/heads/feature" },
      { GITHUB_SHA: "b".repeat(40) },
      { FANMIND_STRIPE_BILLING_EVENT_LEDGER_REVIEWED_COMMIT: "b".repeat(40) },
      { FANMIND_PRODUCTION_DB_HOST: "" },
      { FANMIND_PRODUCTION_DB_HOST: environment.PGHOST },
      {
        PGHOST: "db.stagingref12345.supabase.co",
        FANMIND_TARGET_DB_HOST: "db.stagingref12345.supabase.co",
      },
      { PGUSER: "postgres.productionref123" },
      { PGSSLMODE: "require" },
      { PGSSLROOTCERT: "relative-ca.crt" },
      { DATABASE_URL: "postgres://redirect.invalid/db" },
      { PGSSLCERT: "/tmp/client.crt" },
    ]) {
      await assert.rejects(
        execFileAsync(process.execPath, [RUNNER_PATH, "--verify"], {
          env: { ...environment, ...override },
        }),
        (error) => {
          const output = `${error.stdout ?? ""}\n${error.stderr ?? ""}`;
          assert.match(
            output,
            /STRIPE_BILLING_EVENT_LEDGER_ERROR=(database_binding_invalid|database_redirect_invalid)/u,
          );
          assert.doesNotMatch(output, /redirect\.invalid|client\.crt/u);
          return true;
        },
      );
    }
  });
});

test("workflow is manual, main-only, Staging-only and never activates runtime", async () => {
  const workflow = await readFile(
    ".github/workflows/stripe-billing-event-ledger-staging.yml",
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/u);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(workflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(workflow, /environment: staging/u);
  assert.match(workflow, /FANMIND_STRIPE_BILLING_EVENT_LEDGER_REVIEWED_COMMIT/u);
  assert.match(workflow, /FANMIND_PRODUCTION_DB_HOST/u);
  assert.match(workflow, /PGUSER: \$\{\{ format\('postgres\.\{0\}'/u);
  assert.match(workflow, /PGSSLMODE: verify-full/u);
  assert.match(workflow, /supabase-root-2021-ca\.crt/u);
  assert.match(workflow, /persist-credentials: false/u);
  assert.match(workflow, /apply-stripe-billing-event-ledger/u);
  assert.match(workflow, /npm run --silent db:staging-rollout-state:run/u);
  assert.match(
    workflow,
    /STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=apply/u,
  );
  assert.match(workflow, /npm run db:stripe-billing-ledger:apply/u);
  assert.doesNotMatch(workflow, /\b(?:push|schedule):/u);
  assert.doesNotMatch(
    workflow,
    /FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED:\s*['"]?true/iu,
  );
});


test("database failure diagnostics emit only SQLSTATE and pinned fixed messages", async () => {
  const sql = await readFile(SQL_PATH, "utf8");
  assert.deepEqual(billingDatabaseFailureDiagnostic("ERROR:  55000: workspace_stripe_billing_required_columns_missing\nDETAIL: private data", sql), {code:"55000", reason:"workspace_stripe_billing_required_columns_missing"});
  assert.deepEqual(billingDatabaseFailureDiagnostic("ERROR:  42501: secret-password\nCONTEXT: private SQL", sql), {code:"42501", reason:"database_rejected"});
  assert.deepEqual(billingDatabaseFailureDiagnostic("ERROR:  P0001: stripe_billing_ledger_owner_invalid", "raise exception 'stripe_billing_ledger_owner_invalid';"), {code:"P0001", reason:"stripe_billing_ledger_owner_invalid"});
  assert.deepEqual(billingDatabaseFailureDiagnostic("private connection string", sql), {code:"unknown", reason:"database_rejected"});
});


test("canonical acceptance rejects absent consent, Production and wrong release before database access", async () => {
  await withFakeDatabase(async ({environment,callLog})=>{
    let requests=0;
    const request=async()=>{requests++;throw Error("unexpected_network");};
    await assert.rejects(runStagingBillingCanonicalAcceptance(environment,request), /canonical_confirmation_invalid/u);
    const approved={...environment,FANMIND_ENABLE_NON_PRODUCTION_WRITES:"true",FANMIND_NON_PRODUCTION_WRITE_ACK:"I_UNDERSTAND_NON_PRODUCTION_ONLY",
      FANMIND_STAGING_BILLING_CANONICAL_CONFIRM:"run-staging-billing-canonical-acceptance",
      FANMIND_AI_TIER_STAGING_WORKSPACE_ID:"58a18c7e-4af0-459d-b44d-7d924ee7ffe9",GITHUB_RUN_ID:"123"};
    await assert.rejects(runStagingBillingCanonicalAcceptance({...approved,FANMIND_RUNTIME_ENVIRONMENT:"production"},request),/environment_invalid/u);
    assert.equal(requests,0);
    await assert.rejects(runStagingBillingCanonicalAcceptance(approved,async()=>new Response(JSON.stringify({application:"fanmind",runtimeEnvironment:"staging",releaseCommit:"b".repeat(40)}),{headers:{"cache-control":"no-store"}})),/canonical_release_invalid/u);
    await assert.rejects(readFile(callLog),{code:"ENOENT"});
  });
});

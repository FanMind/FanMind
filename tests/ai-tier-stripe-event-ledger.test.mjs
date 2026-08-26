import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sqlPath =
  "supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql";
const runbookPath =
  "docs/operations/AI_TIER_STRIPE_EVENT_LEDGER.md";

test("the AI Stripe ledger is a controlled, non-automatic database change", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /^begin;/u);
  assert.match(sql, /commit;\s*$/u);
  assert.doesNotMatch(sqlPath, /supabase\/migrations/u);
  assert.doesNotMatch(
    sql,
    /^\s*(?:truncate\s+(?:table\s+)?|drop\s+(?:table|schema|database)\s+)/imu,
  );
  assert.match(
    sql,
    /v_existing\.snapshot_kind = \(case[\s\S]*end\) then/u,
  );
});

test("event and reconciliation records are server-only with forced RLS", async () => {
  const sql = await readFile(sqlPath, "utf8");
  for (const table of [
    "workspace_ai_tier_stripe_events",
    "workspace_ai_tier_stripe_reconciliations",
  ]) {
    assert.match(sql, new RegExp(`create table public\\.${table}`, "u"));
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table}[\\s\\S]*force row level security`, "u"),
    );
    assert.match(
      sql,
      new RegExp(`revoke all on table public\\.${table}[\\s\\S]*from public, anon, authenticated, service_role`, "u"),
    );
  }
  assert.doesNotMatch(sql, /create\s+policy/iu);
  assert.doesNotMatch(
    sql,
    /grant\s+(?:select|insert|update|delete|all)[^;]*\bto\s+(?:public|anon|authenticated)\s*;/iu,
  );
});

test("the ledger stores normalized identity and a digest, never a raw Stripe body", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(sql, /event_id text primary key/u);
  assert.match(sql, /payload_fingerprint text not null/u);
  assert.match(sql, /payload_fingerprint ~ '\^\[a-f0-9\]\{64\}\$'/u);
  assert.match(sql, /signature_verified_at timestamptz not null/u);
  assert.doesNotMatch(sql, /raw_(?:body|payload)|jsonb|request_body/iu);
});

test("tenant and subscription binding happens under the first row lock", async () => {
  const sql = await readFile(sqlPath, "utf8");
  const workspaceLock = sql.indexOf(
    "select workspace.stripe_customer_id, workspace.stripe_subscription_id",
  );
  const eventInsert = sql.indexOf(
    "insert into public.workspace_ai_tier_stripe_events",
  );
  const entitlementLock = sql.indexOf(
    "from public.workspace_ai_tier_entitlements as entitlement",
    eventInsert,
  );
  assert.ok(workspaceLock >= 0);
  assert.ok(eventInsert > workspaceLock);
  assert.ok(entitlementLock > eventInsert);
  assert.match(
    sql,
    /v_workspace_customer_id is distinct from p_customer_id[\s\S]*v_workspace_subscription_id is distinct from p_subscription_id/u,
  );
});

test("projection writes are atomic internal compare-and-swap operations", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(
    sql,
    /where workspace_id = p_workspace_id\s+and stripe_sync_revision = v_expected_revision/iu,
  );
  assert.match(sql, /workspace_ai_tier_event_cas_failed/u);
  assert.match(sql, /stripe_sync_revision = stripe_sync_revision \+ 1/u);
  assert.match(
    sql,
    /revoke insert, update, delete[\s\S]*workspace_ai_tier_entitlements[\s\S]*from service_role/u,
  );
});

test("same-second events persist reconciliation and never sort by event ID", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(
    sql,
    /prior\.event_created_at = p_event_created_at[\s\S]*into\s+v_same_second_conflict,\s+v_unresolved_conflict,\s+v_latest_ledger_created_at/u,
  );
  assert.match(
    sql,
    /p_event_created_at = v_current\.last_stripe_event_created_at[\s\S]*v_conflict_reason := 'event_order_conflict'[\s\S]*stripe_sync_state = 'reconciliation_needed'[\s\S]*processing_reason = v_conflict_reason[\s\S]*result_status := 'reconciliation_needed'/u,
  );
  assert.doesNotMatch(
    sql,
    /p_event_id\s*(?:<|>|<=|>=)|order\s+by\s+event_id/iu,
  );
  assert.match(
    sql,
    /p_event_created_at < v_latest_ledger_created_at[\s\S]*processing_reason = 'stale_event'/u,
  );
});

test("a duplicate only reopens an unresolved reconciliation", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(
    sql,
    /v_existing_event\.processing_state = 'reconciliation_needed'\s+and v_existing_event\.reconciled_by_request_id is null/u,
  );
});

test("event identity conflicts persist and fail-close every identified tenant", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(
    sql,
    /if v_identity_conflict then[\s\S]*workspace_ai_tier_stripe_events[\s\S]*processing_state = 'reconciliation_needed'[\s\S]*processing_reason = 'event_identity'/u,
  );
  assert.match(
    sql,
    /workspace_id in \(\s*p_workspace_id,\s*v_existing_event\.workspace_id\s*\)[\s\S]*result_reason := 'event_identity'/u,
  );
});

test("a reconciliation requires a provider request identity and exact revision", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.match(
    sql,
    /create function public\.reconcile_workspace_ai_tier_stripe_subscription/u,
  );
  assert.match(sql, /stripe_request_id ~ '\^req_/u);
  assert.match(
    sql,
    /v_current\.stripe_sync_state <> 'reconciliation_needed'[\s\S]*v_current\.stripe_sync_revision <> p_expected_revision/u,
  );
  assert.match(sql, /workspace_ai_tier_reconciliation_cas_failed/u);
  assert.match(
    sql,
    /v_snapshot_event_created_cutoff\s*:=\s*floor\(extract\(epoch from p_snapshot_observed_at\)\)::bigint/u,
  );
  assert.match(
    sql,
    /v_snapshot_event_created_cutoff <= greatest\([\s\S]*v_latest_unresolved_created_at[\s\S]*v_current\.last_stripe_event_created_at[\s\S]*v_latest_reconciliation_cutoff/u,
  );
  assert.equal(
    (
      sql.match(
        /last_stripe_event_created_at = v_snapshot_event_created_cutoff/gu,
      ) ?? []
    ).length,
    2,
  );
  assert.match(
    sql,
    /not v_has_current and \([\s\S]*p_has_paid_item[\s\S]*v_rows := 1/u,
  );
});

test("only service role can invoke the fixed-search-path security definers", async () => {
  const sql = await readFile(sqlPath, "utf8");
  assert.equal((sql.match(/language plpgsql\s+security definer\s+set search_path = pg_catalog, public, pg_temp/gu) ?? []).length, 2);
  for (const rpc of [
    "apply_workspace_ai_tier_stripe_event",
    "reconcile_workspace_ai_tier_stripe_subscription",
  ]) {
    assert.match(
      sql,
      new RegExp(`revoke all[\\s\\S]*on function public\\.${rpc}[\\s\\S]*from public, anon, authenticated, service_role`, "u"),
    );
    assert.match(
      sql,
      new RegExp(`grant execute[\\s\\S]*on function public\\.${rpc}[\\s\\S]*to service_role`, "u"),
    );
  }
});

test("the redacted entitlement loader rejects unresolved or legacy projections", async () => {
  const [loader, normalizer] = await Promise.all([
    readFile("src/lib/workspaceAiTierEntitlements.ts", "utf8"),
    readFile("src/lib/workspaceAiTierStorage.mjs", "utf8"),
  ]);
  assert.match(loader, /"stripe_sync_state"/u);
  assert.match(loader, /"stripe_sync_revision"/u);
  assert.match(normalizer, /row\.stripe_sync_state !== "in_sync"/u);
  assert.match(normalizer, /syncRevision < 1/u);
});

test("the runbook keeps canonical reconciliation and base billing blockers explicit", async () => {
  const runbook = await readFile(runbookPath, "utf8");
  assert.match(runbook, /ausschließlich auf Supabase Staging angewendet/iu);
  assert.match(runbook, /Production wurde nicht angewendet oder verändert/iu);
  assert.match(runbook, /keine aktuelle rollback-only Post-Ledger-Lifecycle-Abnahme/iu);
  assert.match(runbook, /kanonischen[\s\S]*(?:Stripe-)?Subscription-Stand/iu);
  assert.match(runbook, /Basis-Billing[\s\S]*separat/iu);
  assert.match(runbook, /Plus\/Ultra[\s\S]*fail-closed/iu);
});

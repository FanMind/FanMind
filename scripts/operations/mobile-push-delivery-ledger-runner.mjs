#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const LEDGER_ID = "20260903190000_mobile_push_delivery_ledger";
export const LEDGER_PATH = resolve(
  process.cwd(),
  `supabase/controlled/${LEDGER_ID}.sql`,
);
export const EXPECTED_LEDGER_SHA256 =
  "667218600bc9f31693cb8f5cce00c7020da646c278cd7f260afa3fa966214862";

function fail(code) {
  throw new Error(`MOBILE_PUSH_DELIVERY_LEDGER_ERROR=${code}`);
}

export function evaluateMobilePushDeliveryLedgerSql(sql) {
  if (typeof sql !== "string") fail("ledger_unreadable");
  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_LEDGER_SHA256) fail("ledger_checksum_mismatch");
  const required = [
    /^begin;/iu,
    /create table public\.mobile_push_delivery_attempts/iu,
    /unique \(idempotency_key, attempt_number\)/iu,
    /alter table public\.mobile_push_delivery_attempts enable row level security/iu,
    /from public, anon, authenticated, service_role/iu,
    /to service_role/iu,
    /create or replace function public\.mobile_push_delivery_reserve\(p_input jsonb\)/iu,
    /for update of w, m, f, c, r/iu,
    /pg_advisory_xact_lock\(hashtextextended\(v_idempotency_key, 0\)\)/iu,
    /r\.expo_token_hash = v_token_fingerprint/iu,
    /create or replace function public\.mobile_push_delivery_reserve_receipt\(p_input jsonb\)/iu,
    /create or replace function public\.mobile_push_delivery_transition/iu,
    /v_registration_id <> v_attempt\.registration_id/iu,
    /update public\.mobile_push_registrations set\s+status = 'disabled'/iu,
    /Installing this table does not enable a route, timer, worker or provider send/iu,
    /commit;\s*$/iu,
  ];
  const forbidden = [
    /create\s+policy/iu,
    /\btruncate\b/iu,
    /\bpg_cron\b|\bcron\.schedule\b/iu,
    /\b(?:http|net)\.(?:post|get)\b/iu,
    /exp\.host|expo\.dev/iu,
  ];
  if (
    required.some((contract) => !contract.test(sql)) ||
    forbidden.some((contract) => contract.test(sql))
  ) {
    fail("ledger_contract_invalid");
  }
  return Object.freeze({ digest, ledgerId: LEDGER_ID });
}

export function checkMobilePushDeliveryLedger() {
  const result = evaluateMobilePushDeliveryLedgerSql(
    readFileSync(LEDGER_PATH, "utf8"),
  );
  console.log(`MOBILE_PUSH_DELIVERY_LEDGER_ID=${result.ledgerId}`);
  console.log(`MOBILE_PUSH_DELIVERY_LEDGER_SHA256=${result.digest}`);
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_APPLIED=NO");
  console.log("MOBILE_PUSH_DELIVERY_LEDGER_READY=YES");
  return result;
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  if (process.argv.length !== 3 || process.argv[2] !== "--check") {
    fail("argument_invalid");
  }
  checkMobilePushDeliveryLedger();
}

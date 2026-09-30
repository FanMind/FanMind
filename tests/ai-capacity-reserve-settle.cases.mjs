import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  calculateOpenAiSettlementCost,
  convertUsdMicrosToEurMicrocents,
  estimateOpenAiReservationCost,
} from "../src/lib/aiCapacityAccounting.mjs";

const EUR_USD_090_NANOS = 900_000_000;
const FX_VERSION = "ecb-test-2026-09-30";

test("converts provider USD micros to EUR microcents with integer ceiling", () => {
  assert.equal(convertUsdMicrosToEurMicrocents({
    usdMicros: 600,
    eurPerUsdNanos: EUR_USD_090_NANOS,
  }), 54_000);
  assert.equal(convertUsdMicrosToEurMicrocents({
    usdMicros: 1,
    eurPerUsdNanos: 333_333_333,
  }), 34);
});

test("builds conservative OpenAI reservation from pinned catalog and explicit FX snapshot", () => {
  const result = estimateOpenAiReservationCost({
    model: "gpt-6-luna",
    serviceTier: "standard",
    occurredAt: "2026-09-30T12:00:00.000Z",
    estimatedInputTokens: 1_000,
    maxOutputTokens: 2_000,
    eurPerUsdNanos: EUR_USD_090_NANOS,
    fxVersion: FX_VERSION,
  });
  assert.equal(result.providerUsdMicros, 1_100);
  assert.equal(result.reservedEurMicrocents, 99_000);
  assert.equal(result.pricingVersion, "openai-2026-09-30-gpt6-standard-v1");
  assert.equal(result.fxVersion, FX_VERSION);
});

test("settles from actual OpenAI provider usage and preserves cached/reasoning details", () => {
  const result = calculateOpenAiSettlementCost({
    model: "gpt-6-luna",
    serviceTier: "standard",
    occurredAt: "2026-09-30T12:00:00.000Z",
    eurPerUsdNanos: EUR_USD_090_NANOS,
    fxVersion: FX_VERSION,
    providerUsage: {
      input_tokens: 1_000,
      output_tokens: 500,
      total_tokens: 1_500,
      input_tokens_details: {
        cached_tokens: 400,
        cache_write_tokens: 0,
      },
      output_tokens_details: {
        reasoning_tokens: 200,
      },
    },
  });
  assert.equal(result.providerUsdMicros, 314);
  assert.equal(result.actualEurMicrocents, 28_260);
  assert.equal(result.usage.cachedInputTokens, 400);
  assert.equal(result.usage.reasoningOutputTokens, 200);
  assert.equal(result.pricingVersion, "openai-2026-09-30-gpt6-standard-v1");
});

test("settlement fails closed without billing-grade provider usage or FX version", () => {
  assert.throws(() => calculateOpenAiSettlementCost({
    model: "gpt-6-luna",
    occurredAt: "2026-09-30T12:00:00.000Z",
    eurPerUsdNanos: EUR_USD_090_NANOS,
    fxVersion: FX_VERSION,
    providerUsage: null,
  }), { name: "TypeError", message: "capacity_provider_usage_unavailable" });

  assert.throws(() => estimateOpenAiReservationCost({
    model: "gpt-6-luna",
    occurredAt: "2026-09-30T12:00:00.000Z",
    estimatedInputTokens: 1,
    maxOutputTokens: 1,
    eurPerUsdNanos: EUR_USD_090_NANOS,
    fxVersion: "",
  }), { name: "TypeError", message: "capacity_fx_version_required" });
});

test("reserve/settle SQL is service-role-only, idempotent and preserves indeterminate spend", () => {
  const sql = fs.readFileSync("supabase/controlled/ai_capacity_reserve_settle.sql", "utf8");
  assert.match(sql, /create or replace function public\.ai_capacity_grant_credit/u);
  assert.match(sql, /create or replace function public\.ai_capacity_reserve/u);
  assert.match(sql, /create or replace function public\.ai_capacity_settle/u);
  assert.match(sql, /create or replace function public\.ai_capacity_release/u);
  assert.match(sql, /create or replace function public\.ai_capacity_mark_indeterminate/u);
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/u);
  assert.match(sql, /pg_advisory_xact_lock/u);
  assert.match(sql, /ai_capacity_reservation_idempotency_conflict/u);
  assert.match(sql, /ai_capacity_settlement_idempotency_conflict/u);
  assert.match(sql, /ai_capacity_insufficient_balance/u);
  assert.match(sql, /state in \('reserved','indeterminate','reconciliation_required'\)/u);
  assert.match(sql, /reservation_reconciliation_required/u);
  assert.match(sql, /reservation_reconciliation_required/u);
  assert.match(sql, /revoke all on function public\.ai_capacity_reserve[\s\S]*public, anon, authenticated/u);
  assert.match(sql, /grant execute on function public\.ai_capacity_reserve[\s\S]*to service_role/u);
});


test("capacity percentage snapshot is server-only and counts held reservations as unavailable", () => {
  const sql = fs.readFileSync("supabase/controlled/ai_capacity_reserve_settle.sql", "utf8");
  assert.match(sql, /create or replace function public\.ai_capacity_balance_snapshot/u);
  assert.match(sql, /state in \('reserved','indeterminate','reconciliation_required'\)/u);
  assert.match(sql, /greatest\(0::bigint, total_granted - consumed - held\)/u);
  assert.match(sql, /floor\([\s\S]*\* 100::numeric[\s\S]*\/ total_granted::numeric/u);
  assert.match(sql, /revoke all on function public\.ai_capacity_balance_snapshot\(uuid\)[\s\S]*public, anon, authenticated/u);
  assert.match(sql, /grant execute on function public\.ai_capacity_balance_snapshot\(uuid\)[\s\S]*to service_role/u);
});

test("capacity usage UI exposes only percentage and explicitly has no free reserve", () => {
  const page = fs.readFileSync("src/app/settings/ai-usage/page.tsx", "utf8");
  assert.match(page, /AI-Kapazität/u);
  assert.match(page, /Verbleibendes Kontingent/u);
  assert.match(page, /remainingPercent/u);
  assert.match(page, /keine kostenlose oder gedrosselte Reserve/u);
  assert.match(page, /Premium verbraucht die Kapazität deutlich schneller/u);
  assert.doesNotMatch(page, /kostenlose Reserve verfügbar/u);
});

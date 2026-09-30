import assert from "node:assert/strict";
import test from "node:test";
import { allocateAiCreditDebitMicros, resetMonthlyIncludedCreditMicros } from "../src/lib/aiCreditLedger.mjs";

test("consumes monthly included credit before persistent top-up credit", () => {
  assert.deepEqual(
    allocateAiCreditDebitMicros({ includedBalanceMicros: 100, topUpBalanceMicros: 500, billableCostMicros: 150 }),
    { allowed: true, reason: null, includedDebitMicros: 100, topUpDebitMicros: 50, includedBalanceAfterMicros: 0, topUpBalanceAfterMicros: 450 },
  );
});

test("does not touch top-up while included monthly credit covers usage", () => {
  const result = allocateAiCreditDebitMicros({ includedBalanceMicros: 200, topUpBalanceMicros: 500, billableCostMicros: 150 });
  assert.equal(result.includedBalanceAfterMicros, 50);
  assert.equal(result.topUpBalanceAfterMicros, 500);
});

test("fails closed without partially debiting when total credit is insufficient", () => {
  assert.deepEqual(
    allocateAiCreditDebitMicros({ includedBalanceMicros: 20, topUpBalanceMicros: 30, billableCostMicros: 51 }),
    { allowed: false, reason: "insufficient_credit", includedDebitMicros: 0, topUpDebitMicros: 0, includedBalanceAfterMicros: 20, topUpBalanceAfterMicros: 30 },
  );
});

test("monthly reset replaces included credit and preserves purchased top-up", () => {
  assert.deepEqual(
    resetMonthlyIncludedCreditMicros({ newIncludedCreditMicros: 900, topUpBalanceMicros: 321 }),
    { includedBalanceMicros: 900, topUpBalanceMicros: 321 },
  );
});

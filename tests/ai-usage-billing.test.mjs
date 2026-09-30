import assert from "node:assert/strict";
import test from "node:test";
import { evaluateAiUsageCreditDebit } from "../src/lib/aiUsageBilling.mjs";

const price = {
  inputPerMillionMicros: 10_000_000,
  cachedInputPerMillionMicros: 2_000_000,
  cacheWritePerMillionMicros: 12_000_000,
  outputPerMillionMicros: 30_000_000,
};

test("real provider usage is valued at OpenAI cost plus 33 percent and debited included-first", () => {
  const result = evaluateAiUsageCreditDebit({
    usage: { inputTokens: 1_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 },
    price,
    includedBalanceMicros: 10_000,
    topUpBalanceMicros: 10_000,
  });
  assert.equal(result.billableCostMicros, 13_300);
  assert.equal(result.includedDebitMicros, 10_000);
  assert.equal(result.topUpDebitMicros, 3_300);
  assert.equal(result.topUpBalanceAfterMicros, 6_700);
});

test("usage billing fails closed when balances cannot cover exact marked-up cost", () => {
  const result = evaluateAiUsageCreditDebit({
    usage: { inputTokens: 1_000, cachedInputTokens: 0, cacheWriteTokens: 0, outputTokens: 0 },
    price,
    includedBalanceMicros: 1_000,
    topUpBalanceMicros: 1_000,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "insufficient_credit");
  assert.equal(result.includedDebitMicros, 0);
  assert.equal(result.topUpDebitMicros, 0);
});

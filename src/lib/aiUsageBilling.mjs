import { calculateFanMindBillableUsageMicros } from "./aiCostEngine.mjs";
import { allocateAiCreditDebitMicros } from "./aiCreditLedger.mjs";

/**
 * Pure billing decision used by the real usage path before persistence.
 * Persistence remains behind the controlled billing-write boundary.
 */
export function evaluateAiUsageCreditDebit({
  usage,
  price,
  includedBalanceMicros,
  topUpBalanceMicros,
}) {
  const billableCostMicros = calculateFanMindBillableUsageMicros({ usage, price });
  return {
    billableCostMicros,
    ...allocateAiCreditDebitMicros({
      includedBalanceMicros,
      topUpBalanceMicros,
      billableCostMicros,
    }),
  };
}

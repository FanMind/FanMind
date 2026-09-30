export type AiCreditDebitAllocation = {
  allowed: boolean;
  reason: "insufficient_credit" | null;
  includedDebitMicros: number;
  topUpDebitMicros: number;
  includedBalanceAfterMicros: number;
  topUpBalanceAfterMicros: number;
};
export function allocateAiCreditDebitMicros(input: { includedBalanceMicros: number; topUpBalanceMicros: number; billableCostMicros: number }): AiCreditDebitAllocation;
export function resetMonthlyIncludedCreditMicros(input: { newIncludedCreditMicros: number; topUpBalanceMicros: number }): { includedBalanceMicros: number; topUpBalanceMicros: number };

function asNonNegativeSafeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new TypeError(`invalid_${field}`);
  return value;
}

export function allocateAiCreditDebitMicros({ includedBalanceMicros, topUpBalanceMicros, billableCostMicros }) {
  const included = asNonNegativeSafeInteger(includedBalanceMicros, "included_balance");
  const topUp = asNonNegativeSafeInteger(topUpBalanceMicros, "topup_balance");
  const cost = asNonNegativeSafeInteger(billableCostMicros, "billable_cost");
  const available = included + topUp;

  if (cost > available) {
    return {
      allowed: false,
      reason: "insufficient_credit",
      includedDebitMicros: 0,
      topUpDebitMicros: 0,
      includedBalanceAfterMicros: included,
      topUpBalanceAfterMicros: topUp,
    };
  }

  const includedDebitMicros = Math.min(included, cost);
  const topUpDebitMicros = cost - includedDebitMicros;
  return {
    allowed: true,
    reason: null,
    includedDebitMicros,
    topUpDebitMicros,
    includedBalanceAfterMicros: included - includedDebitMicros,
    topUpBalanceAfterMicros: topUp - topUpDebitMicros,
  };
}

export function resetMonthlyIncludedCreditMicros({ newIncludedCreditMicros, topUpBalanceMicros }) {
  return {
    includedBalanceMicros: asNonNegativeSafeInteger(newIncludedCreditMicros, "included_credit"),
    topUpBalanceMicros: asNonNegativeSafeInteger(topUpBalanceMicros, "topup_balance"),
  };
}

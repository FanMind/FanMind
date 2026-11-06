function requireNonNegativeFiniteNumber(value, field) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new TypeError(`${field} must be a non-negative finite number`);
  }
}

export function parsePostgrestExactCount(contentRange) {
  if (typeof contentRange !== "string") return null;
  const match = /^(?:\d+-\d+|\*)\/(\d+|\*)$/u.exec(contentRange.trim());
  if (!match || match[1] === "*") return null;
  const count = Number(match[1]);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export function calculateAiCostPerContactMetrics(
  estimatedCostCents,
  contactCount,
) {
  requireNonNegativeFiniteNumber(estimatedCostCents, "estimatedCostCents");
  if (!Number.isSafeInteger(contactCount) || contactCount <= 0) {
    return Object.freeze({
      perFanCents: null,
      perHundredFansCents: null,
      perThousandFansCents: null,
    });
  }

  const perFanCents = estimatedCostCents / contactCount;
  return Object.freeze({
    perFanCents,
    perHundredFansCents: perFanCents * 100,
    perThousandFansCents: perFanCents * 1_000,
  });
}

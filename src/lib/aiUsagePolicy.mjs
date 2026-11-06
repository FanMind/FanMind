function normalizeNonNegativeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

export function normalizeAiUsageThreshold(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.max(1, Math.round(numeric));
}

export function calculateAiUsageIndicator(input) {
  const requests = normalizeNonNegativeNumber(input?.requests);
  const tokens = normalizeNonNegativeNumber(input?.tokens);
  const requestWarning = normalizeAiUsageThreshold(input?.requestWarning);
  const tokenWarning = normalizeAiUsageThreshold(input?.tokenWarning);

  const ratios = [];
  if (requestWarning) ratios.push(requests / requestWarning);
  if (tokenWarning) ratios.push(tokens / tokenWarning);

  if (!ratios.length) {
    return {
      configured: false,
      level: "unconfigured",
      usageRatio: null,
      usagePercent: null,
      requestWarning,
      tokenWarning,
    };
  }

  const usageRatio = Math.max(...ratios);
  const level =
    usageRatio >= 1 ? "attention" : usageRatio >= 0.8 ? "warning" : "normal";

  return {
    configured: true,
    level,
    usageRatio,
    usagePercent: Math.max(0, Math.min(Math.round(usageRatio * 100), 100)),
    requestWarning,
    tokenWarning,
  };
}

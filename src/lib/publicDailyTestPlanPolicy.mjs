const MAX_ADMIN_ID_LENGTH = 320;

export function getPublicDailyBetaStatus(settings, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  const updatedAt = typeof settings?.updatedAt === "string" ? settings.updatedAt : "";
  const updatedAtMs = Date.parse(updatedAt);
  const updatedBy = typeof settings?.updatedBy === "string" ? settings.updatedBy.trim() : "";
  const valid = Number.isFinite(nowMs)
    && Number.isFinite(updatedAtMs)
    && updatedAtMs <= nowMs
    && updatedBy.length > 0
    && updatedBy.length <= MAX_ADMIN_ID_LENGTH
    && typeof settings?.publicDailyTestPlanEnabled === "boolean"
    && (settings.publicDailyTestPlanEnabledUntil === undefined || settings.publicDailyTestPlanEnabledUntil === null);

  return {
    enabled: valid && settings.publicDailyTestPlanEnabled === true,
    updatedAt: valid ? new Date(updatedAtMs).toISOString() : null,
  };
}

export function createPublicDailyBetaSettings(enabled, updatedBy, now = new Date()) {
  const updatedAtMs = now instanceof Date ? now.getTime() : Number.NaN;
  const normalizedAdmin = typeof updatedBy === "string" ? updatedBy.trim() : "";
  if (!Number.isFinite(updatedAtMs)) throw new TypeError("invalid_now");
  if (!normalizedAdmin || normalizedAdmin.length > MAX_ADMIN_ID_LENGTH) {
    throw new TypeError("invalid_updated_by");
  }
  return {
    publicDailyTestPlanEnabled: enabled === true,
    publicDailyTestPlanEnabledUntil: null,
    updatedAt: new Date(updatedAtMs).toISOString(),
    updatedBy: normalizedAdmin,
  };
}

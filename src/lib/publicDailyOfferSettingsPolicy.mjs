// FM-DEC-020: a persistent, administrator-controlled catalog switch.
// Legacy 24-hour beta settings do not authorize or disable this separate offer.
export function readPublicDailyOfferEnabled(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  if (Object.hasOwn(settings, "publicDailyOfferEnabled")) return settings.publicDailyOfferEnabled === true;
  // Only the recognized legacy beta record preserves the previously public offer.
  // Empty, unrelated or partially written current records must fail closed.
  if (Object.hasOwn(settings, "publicDailyOfferUpdatedAt") || Object.hasOwn(settings, "publicDailyOfferUpdatedBy")) return false;
  if (!Object.hasOwn(settings, "publicDailyTestPlanEnabled") || typeof settings.publicDailyTestPlanEnabled !== "boolean") return false;
  const expires = settings.publicDailyTestPlanEnabledUntil;
  return !Object.hasOwn(settings, "publicDailyTestPlanEnabledUntil") || expires === null ||
    (typeof expires === "string" && Number.isFinite(Date.parse(expires)) && new Date(expires).toISOString() === expires);
}

export function createPublicDailyOfferSettings(enabled, updatedBy, previous = {}, now = new Date()) {
  if (typeof enabled !== "boolean") throw new TypeError("invalid_enabled");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError("invalid_now");
  if (typeof updatedBy !== "string" || !updatedBy.trim() || updatedBy.length > 254) throw new TypeError("invalid_actor");
  return {
    ...previous,
    publicDailyOfferEnabled: enabled,
    publicDailyOfferUpdatedAt: now.toISOString(),
    publicDailyOfferUpdatedBy: updatedBy,
  };
}

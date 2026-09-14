// FM-DEC-020: a persistent, administrator-controlled catalog switch.
// Legacy 24-hour beta settings do not authorize or disable this separate offer.
export function readPublicDailyOfferEnabled(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) return false;
  if (!Object.hasOwn(settings, "publicDailyOfferEnabled")) return true;
  return settings.publicDailyOfferEnabled === true;
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

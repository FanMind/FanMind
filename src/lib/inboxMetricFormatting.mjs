function normalizeMinutes(value) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function isEnglish(locale) {
  return locale === "en";
}

export function formatInboxWaitingTime(value, locale) {
  const minutes = normalizeMinutes(value);
  if (minutes <= 0) return "—";
  if (minutes < 60) return isEnglish(locale) ? `${minutes} min.` : `${minutes} Min.`;

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    if (isEnglish(locale)) return `${hours} ${hours === 1 ? "hr." : "hrs."}`;
    return `${hours} Std.`;
  }

  const days = Math.floor(hours / 24);
  if (isEnglish(locale)) return `${days} ${days === 1 ? "day" : "days"}`;
  return `${days} ${days === 1 ? "Tag" : "Tage"}`;
}

export function formatInboxAverageResponseTime(value, locale) {
  const minutes = normalizeMinutes(value);
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    if (isEnglish(locale)) return `${days} ${days === 1 ? "day" : "days"}`;
    return `${days} ${days === 1 ? "Tag" : "Tage"}`;
  }

  const hours = Math.round(minutes / 60);
  if (isEnglish(locale)) return `${hours} ${hours === 1 ? "hr." : "hrs."}`;
  return `${hours} Std.`;
}

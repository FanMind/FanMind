/**
 * @typedef {{ status?: string | null, tags?: string[] | null }} FanTagContact
 * @typedef {{ tags: string[] }} FanTagGroup
 * @typedef {{
 *   channel?: string,
 *   searchQuery?: string,
 *   tag?: string,
 *   locale?: string,
 * }} FansListHrefOptions
 */

/** @param {string | null | undefined} value */
export function normalizeFanTag(value) {
  return value?.trim().toLowerCase() ?? "";
}

/** @param {FanTagContact[]} contacts */
export function getAvailableFanTags(contacts) {
  const tagsByKey = new Map();

  for (const contact of contacts) {
    if (contact.status?.trim().toLowerCase() === "archived") {
      continue;
    }

    for (const tag of contact.tags ?? []) {
      const trimmed = tag.trim();
      const key = normalizeFanTag(trimmed);
      if (key && !tagsByKey.has(key)) {
        tagsByKey.set(key, trimmed);
      }
    }
  }

  return [...tagsByKey.values()].sort((left, right) =>
    left.localeCompare(right, "de", { sensitivity: "base" }),
  );
}

/**
 * @template {FanTagGroup} T
 * @param {T[]} groups
 * @param {string} activeTag
 * @returns {T[]}
 */
export function filterFanGroupsByTag(groups, activeTag) {
  const normalizedTag = normalizeFanTag(activeTag);
  if (!normalizedTag) {
    return groups;
  }

  return groups.filter((group) =>
    group.tags.some((tag) => normalizeFanTag(tag) === normalizedTag),
  );
}

/** @param {FansListHrefOptions} options */
export function getFansListHref({
  channel = "all",
  searchQuery = "",
  tag = "",
  locale = "de",
} = {}) {
  const params = new URLSearchParams();
  if (channel !== "all") {
    params.set("channel", channel);
  }
  if (searchQuery.trim()) {
    params.set("q", searchQuery.trim());
  }
  if (tag.trim()) {
    params.set("tag", tag.trim());
  }
  if (locale === "en") {
    params.set("lang", locale);
  }

  const queryString = params.toString();
  return queryString ? `/fans?${queryString}#fans-list` : "/fans#fans-list";
}

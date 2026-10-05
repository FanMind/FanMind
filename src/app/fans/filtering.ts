export type FanTagContact = {
  status?: string | null;
  tags?: string[] | null;
};

export type FanTagGroup = {
  tags: string[];
};

export type FansListHrefOptions = {
  channel?: string;
  searchQuery?: string;
  tag?: string;
  locale?: string;
};

export function normalizeFanTag(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function getAvailableFanTags(contacts: FanTagContact[]): string[] {
  const tagsByKey = new Map<string, string>();

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

export function filterFanGroupsByTag<T extends FanTagGroup>(
  groups: T[],
  activeTag: string,
): T[] {
  const normalizedTag = normalizeFanTag(activeTag);
  if (!normalizedTag) {
    return groups;
  }

  return groups.filter((group) =>
    group.tags.some((tag) => normalizeFanTag(tag) === normalizedTag),
  );
}

export function getFansListHref({
  channel = "all",
  searchQuery = "",
  tag = "",
  locale = "de",
}: FansListHrefOptions): string {
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

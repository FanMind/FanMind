import assert from "node:assert/strict";
import test from "node:test";

import {
  filterFanGroupsByTag,
  getAvailableFanTags,
  getFansListHref,
  normalizeFanTag,
} from "../src/app/fans/filtering.mjs";

test("normalizes and compares tags exactly without substring matches", () => {
  const groups = [
    { id: "vip", tags: [" VIP "] },
    { id: "vip-plus", tags: ["VIP-plus"] },
    { id: "name-only", displayName: "VIP", tags: [] },
    { id: "note-only", note: "VIP", tags: [] },
  ];

  assert.equal(normalizeFanTag(" VIP "), "vip");
  assert.deepEqual(filterFanGroupsByTag(groups, "vip").map(({ id }) => id), ["vip"]);
  assert.deepEqual(filterFanGroupsByTag(groups, " VIP ").map(({ id }) => id), ["vip"]);
  assert.deepEqual(filterFanGroupsByTag(groups, ""), groups);
});

test("builds options only from active contacts and deduplicates case-insensitively", () => {
  assert.deepEqual(
    getAvailableFanTags([
      { status: "active", tags: ["VIP", " Newsletter "] },
      { status: "new", tags: [" vip ", "", "Berlin"] },
      { status: " archived ", tags: ["Archived only", "newsletter"] },
    ]),
    ["Berlin", "Newsletter", "VIP"],
  );
});

test("a grouped fan matches a tag present on any allowed contact in the group", () => {
  const groups = [
    { id: "grouped", tags: ["Newsletter", "VIP"] },
    { id: "other", tags: ["Lead"] },
  ];

  assert.deepEqual(filterFanGroupsByTag(groups, "vip").map(({ id }) => id), ["grouped"]);
});

test("tag filtering composes with channel and text search", () => {
  const groups = [
    { id: "anna", name: "Anna", platforms: ["instagram"], tags: ["VIP"] },
    { id: "bert", name: "Bert", platforms: ["instagram"], tags: ["VIP-plus"] },
    { id: "cara", name: "Cara", platforms: ["facebook"], tags: ["vip"] },
  ];
  const combined = filterFanGroupsByTag(
    groups.filter((group) => group.platforms.includes("instagram")),
    " VIP ",
  ).filter((group) => group.name.toLowerCase().includes("ann"));

  assert.deepEqual(combined.map(({ id }) => id), ["anna"]);
  assert.deepEqual(filterFanGroupsByTag(groups, "unknown"), []);
});

test("URL helpers preserve search, channel and locale while changing or clearing tag", () => {
  assert.equal(
    getFansListHref({
      channel: "instagram",
      searchQuery: " Anna ",
      tag: " VIP ",
      locale: "en",
    }),
    "/fans?channel=instagram&q=Anna&tag=VIP&lang=en#fans-list",
  );
  assert.equal(
    getFansListHref({
      channel: "instagram",
      searchQuery: "Anna",
      locale: "en",
    }),
    "/fans?channel=instagram&q=Anna&lang=en#fans-list",
  );
  assert.equal(getFansListHref({ tag: "   " }), "/fans#fans-list");
});

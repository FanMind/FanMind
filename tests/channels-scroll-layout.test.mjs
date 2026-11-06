import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const channelsCssPath = "src/app/channels/channels.module.css";
const channelsGridPath = "src/app/channels/ChannelsGrid.tsx";
const dashboardCssPath = "src/app/dashboard/dashboard.module.css";

function getRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, "u"))?.[1] ?? "";
}

test("channels grid section does not clip the full channel-card content", async () => {
  const css = await readFile(channelsCssPath, "utf8");
  const gridSectionRule = getRule(css, ".gridSection");
  const channelGridRule = getRule(css, ".channelGrid");

  assert.ok(gridSectionRule, "expected .gridSection rule to exist");
  assert.doesNotMatch(gridSectionRule, /overflow\s*:\s*hidden/u);
  assert.doesNotMatch(gridSectionRule, /overflow-y\s*:\s*hidden/u);
  assert.doesNotMatch(channelGridRule, /max-height\s*:/u);
  assert.doesNotMatch(channelGridRule, /overflow\s*:\s*hidden/u);
});

test("workspace content owns the single vertical scroll area while the sidebar remains fixed on desktop", async () => {
  const css = await readFile(dashboardCssPath, "utf8");
  const sidebarRule = getRule(css, ".sidebar");
  const scrollAreaRule = getRule(css, ".dashboardScrollArea");

  assert.match(sidebarRule, /position\s*:\s*fixed/u);
  assert.match(scrollAreaRule, /min-height\s*:\s*0/u);
  assert.match(scrollAreaRule, /overflow-y\s*:\s*auto/u);
  assert.doesNotMatch(scrollAreaRule, /max-height\s*:/u);
});

test("all channels groups and the 16 global main channels remain rendered", async () => {
  const source = await readFile(channelsGridPath, "utf8");

  for (const label of [
    "Globale Hauptkanäle",
    "Creator & Community",
    "Business & Reviews",
    "Internationale Märkte",
  ]) {
    assert.match(source, new RegExp(`label: "${label}"`, "u"));
  }

  const channelGroupsStart = source.indexOf("const channelGroups");
  const globalGroupStart = source.indexOf('label: "Globale Hauptkanäle",', channelGroupsStart);
  const nextGroupStart = source.indexOf('label: "Creator & Community",', globalGroupStart);
  assert.notEqual(globalGroupStart, -1);
  assert.notEqual(nextGroupStart, -1);
  const globalGroup = source.slice(globalGroupStart, nextGroupStart);
  assert.equal(
    (globalGroup.match(/makeChannel\(/gu) ?? []).length,
    16,
    "global main channels must keep all 16 cards reachable",
  );
});

test("channel catalog keeps phase 7 complete and phase 8 visibly unstarted", async () => {
  const source = await readFile(channelsGridPath, "utf8");

  assert.match(source, /phase3ChannelKeys = new Set\(\["facebook", "instagram", "whatsapp"\]\)/u);
  assert.match(source, /phase7ChannelKeys = new Set\(\["tiktok", "twitter", "discord", "discord-server", "onlyfans"\]\)/u);
  assert.match(source, /"onlyfans",\s*"OnlyFans"/u);
  assert.match(source, /Phase 8 \/ noch nicht begonnen/u);
  assert.match(source, /Noch keine Eingänge umgesetzt/u);
  assert.match(source, /preparedPhase8ChannelKeys = new Set\(\["telegram"\]\)/u);
  assert.match(source, /preparedPhase8Groundwork[\s\S]*Coming Soon \/ geplant \/ vorbereitet/u);
  assert.match(source, /"Bot-\/Account-Struktur vorbereitet"/u);
});

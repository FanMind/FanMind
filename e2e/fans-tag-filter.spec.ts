import { expect, test } from "@playwright/test";

import {
  filterFanGroupsByTag,
  getFansListHref,
  normalizeFanTag,
} from "../src/app/fans/filtering";

const groups = [
  { id: "anna", name: "Anna", platforms: ["instagram"], tags: ["VIP", "Newsletter"] },
  { id: "bert", name: "Bert", platforms: ["instagram"], tags: ["VIP-plus"] },
  { id: "cara", name: "Cara", platforms: ["facebook"], tags: ["vip"] },
];

test("combined tag filter preserves URL state across navigation", async ({ page }) => {
  await page.route("**/fans**", async (route) => {
    const url = new URL(route.request().url());
    const channel = url.searchParams.get("channel") ?? "all";
    const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
    const tag = url.searchParams.get("tag") ?? "";
    const locale = url.searchParams.get("lang") ?? "de";
    const visible = filterFanGroupsByTag(
      groups.filter((group) => channel === "all" || group.platforms.includes(channel)),
      tag,
    ).filter((group) => !query || group.name.toLowerCase().includes(query));
    const optionValues = ["VIP", "Newsletter", "VIP-plus"];
    const selected = optionValues.find(
      (option) => normalizeFanTag(option) === normalizeFanTag(tag),
    );

    await route.fulfill({
      contentType: "text/html",
      body: `<!doctype html>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>body{font:16px sans-serif;margin:16px}form{display:flex;flex-wrap:wrap;gap:8px;max-width:100%}table{width:100%}</style>
        <form method="get" action="/fans">
          <label for="tag-filter">Tag</label>
          <select id="tag-filter" name="tag">
            <option value="">Alle Tags</option>
            ${optionValues.map((option) => `<option ${option === selected ? "selected" : ""}>${option}</option>`).join("")}
          </select>
          ${channel !== "all" ? `<input type="hidden" name="channel" value="${channel}">` : ""}
          ${query ? `<input type="hidden" name="q" value="${query}">` : ""}
          ${locale === "en" ? '<input type="hidden" name="lang" value="en">' : ""}
          <button type="submit">Tag anwenden</button>
          ${tag ? `<a id="clear-tag" href="${getFansListHref({ channel, searchQuery: query, locale })}">Tag zurücksetzen</a>` : ""}
        </form>
        <a id="all-channels" href="${getFansListHref({ searchQuery: query, tag, locale })}">Alle Kanäle</a>
        <table><tbody>${visible.map((group) => `<tr><td>${group.name}</td></tr>`).join("")}</tbody></table>
        ${visible.length ? "" : '<p role="status">Keine Fans für diese Filter.</p>'}`,
    });
  });

  await page.goto("/fans?lang=en&channel=instagram&q=anna&tag=VIP");
  await expect(page.getByRole("cell", { name: "Anna" })).toBeVisible();
  await expect(page.getByRole("cell", { name: "Bert" })).toHaveCount(0);

  await page.getByLabel("Tag").selectOption("Newsletter");
  await page.getByRole("button", { name: "Tag anwenden" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("tag")).toBe("Newsletter");
  expect(new URL(page.url()).searchParams.get("channel")).toBe("instagram");
  expect(new URL(page.url()).searchParams.get("q")).toBe("anna");
  expect(new URL(page.url()).searchParams.get("lang")).toBe("en");
  await expect(page.getByRole("cell", { name: "Anna" })).toBeVisible();

  await page.getByRole("link", { name: "Tag zurücksetzen" }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get("channel")).toBe("instagram");
  expect(new URL(page.url()).searchParams.get("q")).toBe("anna");
  expect(new URL(page.url()).searchParams.get("lang")).toBe("en");
  expect(new URL(page.url()).searchParams.has("tag")).toBe(false);

  await page.goBack();
  await expect(page).toHaveURL(/tag=Newsletter/);
  await page.goForward();
  expect(new URL(page.url()).searchParams.has("tag")).toBe(false);

  await page.goto("/fans?lang=en&channel=instagram&tag=unknown");
  await expect(page.getByRole("status")).toContainText("Keine Fans");
  expect(await page.locator("body").evaluate(() => document.body.scrollWidth <= innerWidth)).toBe(true);
});

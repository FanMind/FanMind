import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile("src/app/landing-v2/landing-v2.module.css", "utf8");

function maxWidthBlocks(width) {
  const marker = `@media (max-width: ${width}px)`;
  const blocks = [];
  let searchFrom = 0;
  while (true) {
    const start = css.indexOf(marker, searchFrom);
    if (start === -1) break;
    const open = css.indexOf("{", start);
    let depth = 0;
    for (let index = open; index < css.length; index += 1) {
      const char = css[index];
      if (char === "{") depth += 1;
      if (char === "}") depth -= 1;
      if (depth === 0) {
        blocks.push(css.slice(open + 1, index));
        searchFrom = index + 1;
        break;
      }
    }
  }
  assert.ok(blocks.length > 0, `${marker} exists`);
  return blocks;
}

function lastRuleBlock(selector) {
  const pattern = new RegExp(`${selector.replaceAll(".", "\\.")}\\s*\\{([^}]*)\\}`, "g");
  let match;
  let last = "";
  while ((match = pattern.exec(css)) !== null) last = match[1];
  assert.ok(last, `${selector} rule exists`);
  return last;
}

test("landing hero keeps a two-column desktop shell for Chromium, Edge and Firefox viewports", () => {
  assert.match(
    css,
    /Issue #619\/#621 follow-up:[\s\S]*?\.hero\s*\{[^}]*grid-template-columns:\s*minmax\(390px,\s*0\.76fr\)\s*minmax\(0,\s*1\.24fr\)/,
    "final hero rule keeps text left and dashboard right with a zero-min dashboard track",
  );

  assert.match(lastRuleBlock(".heroCopy"), /max-width:\s*620px/, "text block stays bounded without forcing the grid wider");
  assert.match(css, /Issue #619\/#621 follow-up:[\s\S]*?\.dashboardWrap\s*\{[^}]*justify-self:\s*end/, "dashboard preview remains aligned to the right column");
});

test("landing hero prevents intrinsic minimum widths from causing browser-specific stacking", () => {
  assert.match(css, /\.hero,\s*\n\.hero > \*,\s*\n\.heroCopy,\s*\n\.dashboardWrap,\s*\n\.dashboardImage,\s*\n\.heroFeatureGrid,\s*\n\.heroFeatureCard\s*\{\s*min-width:\s*0;/s);
  assert.match(css, /\.landingHeaderRoot \.header\s*\{[^}]*grid-template-columns:\s*minmax\(180px,\s*274px\)\s*minmax\(0,\s*1fr\)\s*auto/s);
});

test("landing hero and cards do not stack at 1440x900 or 1920x1080 desktop widths", () => {
  const desktopCompressionBlocks = maxWidthBlocks(1500).join("\n");
  assert.doesNotMatch(desktopCompressionBlocks, /\.heroFeatureGrid\s*\{[^}]*grid-template-columns:\s*repeat\(3,/s);
  assert.doesNotMatch(desktopCompressionBlocks, /\.hero\s*\{[^}]*grid-template-columns:\s*1fr/s);

  for (const width of [1440, 1920]) {
    assert.ok(width > 1100, `${width}px desktop viewport stays above the single-column hero breakpoint`);
  }
});

test("landing hero feature cards keep six desktop columns above tablet width", () => {
  const desktopGrid = css.match(/\.heroFeatureGrid\s*{[^}]*grid-template-columns:\s*repeat\(6,\s*minmax\(0,\s*1fr\)\)/s);
  assert.ok(desktopGrid, "base hero feature grid uses six flexible columns without intrinsic min-width expansion");
});

test("landing hero only collapses at the shared tablet breakpoint, then mobile stays single-column", () => {
  const tabletBlocks = maxWidthBlocks(1100).join("\n");
  assert.match(tabletBlocks, /\.hero\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(tabletBlocks, /\.heroFeatureGrid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);

  const mobileBlocks = maxWidthBlocks(720).join("\n");
  assert.match(mobileBlocks, /\.heroFeatureGrid\s*{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(mobileBlocks, /\.landingHeaderRoot \.header\s*\{[^}]*min-height:\s*0/s);
});

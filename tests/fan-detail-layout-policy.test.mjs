import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const cssPath = "src/app/fans/[id]/fan-detail.module.css";

test("fan detail AI composer stays in normal flow and cannot overlap the message timeline", async () => {
  const css = await readFile(cssPath, "utf8");
  const replyRule = css.match(/\.replyCard\s*\{([^}]*)\}/u)?.[1] ?? "";

  assert.match(replyRule, /position:\s*static/u);
  assert.doesNotMatch(replyRule, /position:\s*(?:sticky|fixed|absolute)/u);
  assert.doesNotMatch(replyRule, /bottom:/u);
});

test("the final desktop copilot rule is sticky and the single-column breakpoint resets it", async () => {
  const css = await readFile(cssPath, "utf8");
  // Inspect the final production-layout rule so an earlier, overridden rule cannot make this test pass.
  const productionLayout = css.indexOf("/* Fan detail production layout");
  const stickyRule = css.indexOf(
    ".copilot {\n  position: sticky;",
    productionLayout,
  );
  const responsiveReset = css.indexOf(
    "@media (max-width: 1240px)",
    stickyRule,
  );

  assert.notEqual(productionLayout, -1);
  assert.ok(stickyRule > productionLayout);
  assert.ok(responsiveReset > stickyRule);
  assert.match(
    css.slice(stickyRule, responsiveReset),
    /top:\s*0;[\s\S]*?align-self:\s*start;[\s\S]*?max-height:\s*calc\(100dvh - 94px\);[\s\S]*?overflow-y:\s*auto;/u,
  );
  assert.match(
    css.slice(responsiveReset),
    /\.copilot\s*\{[\s\S]*?position:\s*static;[\s\S]*?max-height:\s*none;[\s\S]*?overflow:\s*visible;/u,
  );
  assert.doesNotMatch(
    css.slice(stickyRule, responsiveReset),
    /position:\s*static/u,
  );
});

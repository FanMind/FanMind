import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const loginPagePath = "src/app/login/page.tsx";
const loginStylesPath = "src/app/login/login.module.css";

async function read(path) {
  return readFile(path, "utf8");
}

test("public demo API starts only from the confirmation action", async () => {
  const loginPage = await read(loginPagePath);

  assert.match(loginPage, /onClick=\{openDemoConfirm\}/u);
  assert.match(loginPage, /onClick=\{handleDemoStart\}/u);
  assert.match(loginPage, /fetch\("\/api\/demo\/start"/u);
  const publicButtonBlock = loginPage.match(/<button[\s\S]*?onClick=\{openDemoConfirm\}[\s\S]*?<\/button>/u)?.[0] ?? "";
  assert.ok(publicButtonBlock, "Missing public demo trigger button.");
  assert.doesNotMatch(publicButtonBlock, /fetch\("\/api\/demo\/start"/u);
});

test("cancel, escape, and close dismiss the dialog without demo API usage", async () => {
  const loginPage = await read(loginPagePath);

  assert.match(loginPage, /const closeDemoConfirm = useCallback\(\(\) => \{/u);
  assert.match(loginPage, /event\.key === "Escape"/u);
  assert.match(loginPage, /onClick=\{closeDemoConfirm\}/u);

  const closeDemoConfirmBody = loginPage.match(
    /const closeDemoConfirm = useCallback\(\(\) => \{(?<body>[\s\S]*?)\n  \},/u,
  )?.groups?.body ?? "";
  assert.doesNotMatch(closeDemoConfirmBody, /fetch\("\/api\/demo\/start"/u);
});

test("demo confirmation prevents double starts while creating the demo", async () => {
  const loginPage = await read(loginPagePath);

  assert.match(loginPage, /disabled=\{isSubmitting\}/u);
  assert.match(loginPage, /ref=\{demoConfirmStartRef\}/u);
});

test("German and English demo confirmation copy and accessibility attributes are present", async () => {
  const [loginPage, loginStyles] = await Promise.all([
    read(loginPagePath),
    read(loginStylesPath),
  ]);

  for (const copy of [
    "Demo jetzt starten?",
    "Dein Demo-Zugang läuft 60 Minuten. Nach Ablauf kann ein neuer Demo-Start aufgrund unserer Schutzlimits möglicherweise nicht sofort verfügbar sein.",
    "Demo starten",
    "Abbrechen",
    "Start the demo now?",
    "Your demo access lasts 60 minutes. After it expires, another demo start may not be immediately available due to our protection limits.",
    "Start demo",
    "Cancel",
  ]) {
    assert.ok(loginPage.includes(copy), `Missing copy: ${copy}`);
  }

  assert.match(loginPage, /role="dialog"/u);
  assert.match(loginPage, /aria-modal="true"/u);
  assert.match(loginPage, /aria-labelledby="demo-confirm-title"/u);
  assert.match(loginPage, /aria-describedby="demo-confirm-description"/u);
  assert.match(loginPage, /demoConfirmStartRef\.current\?\.focus\(\)/u);
  assert.match(loginStyles, /:focus-visible/u);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, expect } from "@playwright/test";
import ts from "typescript";

// Execute the actual client and React DOM in Chromium. Only the external API is
// deferred; this suite proves client isolation, not Staging/provider acceptance.
const require = createRequire(import.meta.url);
const modules = {
  react: ["react", "react.production.js"],
  "react/jsx-runtime": ["react", "react-jsx-runtime.production.js"],
  "react-dom": ["react-dom", "react-dom.production.js"],
  "react-dom/client": ["react-dom", "react-dom-client.production.js"],
  scheduler: ["scheduler", "scheduler.production.js"],
};
const moduleSources = Object.entries(modules).map(([name, [pkg, file]]) =>
  `${JSON.stringify(name)}: function(module, exports, require) {\n${readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")}\n}`,
);
const client = ts.transpileModule(readFileSync("src/app/chatadmin/ChatAdminClient.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const bundle = `(() => {
  const modules = {${moduleSources.join(",")},
    "./chatadmin.module.css": function(module) { module.exports = {__esModule: true, default: new Proxy({}, {get: (_, key) => String(key)})}; },
    client: function(module, exports, require) {${client}}
  };
  const cache = {};
  function require(name) {
    if (!modules[name]) throw new Error("Unexpected client dependency: " + name);
    if (!cache[name]) { cache[name] = {exports: {}}; modules[name](cache[name], cache[name].exports, require); }
    return cache[name].exports;
  }
  window.mountCharacters = (characters) => require("react-dom/client").createRoot(document.getElementById("root")).render(require("react").createElement(require("client").ChatAdminClient, {initialCharacters: characters}));
})();`;

const characterA = {
  id: "10000000-0000-4000-8000-000000000001", workspace_id: "20000000-0000-4000-8000-000000000001",
  display_name: "Synthetic Anna", profile_image_path: null, public_age: 24, bio: "Anna synthetic bio", location: "", languages: ["Deutsch"],
  personality: "ruhig", writing_style: "klar", emoji_style: "sparsam", sentence_style: "kurz", typical_phrases: [], forbidden_phrases: [],
  flirt_style: "respektvoll", sales_rules: "kein Druck", example_messages: [], status: "active", revision: 1, created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z",
};
const characterB = { ...characterA, id: "10000000-0000-4000-8000-000000000002", display_name: "Synthetic Bea", bio: "Bea synthetic bio" };
const drafts = ["Synthetic Anna reply one", "Synthetic Anna reply two", "Synthetic Anna reply three"];
let browser;
before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.CHATADMIN_TEST_BROWSER || undefined }); });
after(async () => { await browser?.close(); });

async function mount(t) {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  t.after(() => context.close());
  const page = await context.newPage();
  await page.route("**/*", (route) => {
    assert.equal(route.request().url(), "http://localhost/chatadmin-client-test");
    return route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div></body></html>' });
  });
  await page.goto("http://localhost/chatadmin-client-test");
  await page.evaluate(() => {
    window.testRequests = [];
    window.fetch = (url, options) => new Promise((resolve, reject) => {
      if (!String(url).startsWith("/api/chatadmin/")) throw new Error("Unexpected network request");
      // Intentionally ignore AbortSignal: cancellation alone is not a stale-result guard.
      window.testRequests.push({ url, options, body: JSON.parse(options.body), resolve, reject });
    });
  });
  await page.addScriptTag({ content: bundle });
  await page.evaluate((characters) => window.mountCharacters(characters), [characterA, characterB]);
  await expect(page.getByRole("heading", { name: "Synthetic Anna" })).toBeVisible();
  return page;
}
const card = (page, name) => page.getByRole("article").filter({ has: page.getByRole("heading", { name, exact: true }) });
const copies = (page) => page.getByRole("button", { name: "Antwort kopieren", exact: true });
async function generate(page, message = "Synthetic fan message") {
  await page.getByLabel("Von OnlyFans kopierte Fan-Nachricht").fill(message);
  await page.getByRole("button", { name: "Antwortvorschläge erzeugen", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.testRequests.length)).toBeGreaterThan(0);
}
async function complete(page, index = 0, body = { replies: drafts, character_id: characterA.id, character_revision: 1, safety_note: "Manuell prüfen und einfügen." }, status = 200) {
  await page.evaluate(async ({ index, body, status }) => {
    window.testRequests[index].resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { index, body, status });
}

test("copying three drafts uses the selected persona; selecting another clears fan context and drafts", async (t) => {
  const page = await mount(t);
  await page.getByLabel("Fan/Chat-Bezeichnung (optional)").fill("Synthetic Anna fan");
  await generate(page);
  assert.deepEqual(await page.evaluate(() => window.testRequests[0].body), { character_id: characterA.id, character_revision: 1, incoming_message: "Synthetic fan message", fan_label: "Synthetic Anna fan" });
  await complete(page);
  await expect(copies(page)).toHaveCount(3);
  await copies(page).first().click();
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), drafts[0]);
  await card(page, "Synthetic Bea").getByRole("button", { name: "Auswählen" }).click();
  await expect(copies(page)).toHaveCount(0);
  await expect(page.getByLabel("Fan/Chat-Bezeichnung (optional)")).toHaveValue("");
  await expect(page.getByLabel("Von OnlyFans kopierte Fan-Nachricht")).toHaveValue("");
});

test("a delayed response cannot reappear after switching away and back to the same character", async (t) => {
  const page = await mount(t);
  await generate(page);
  await card(page, "Synthetic Bea").getByRole("button", { name: "Auswählen" }).click();
  await card(page, "Synthetic Anna").getByRole("button", { name: "Auswählen" }).click();
  await complete(page);
  await expect(copies(page)).toHaveCount(0);
});

test("starting character editing invalidates a delayed reply", async (t) => {
  const page = await mount(t);
  await generate(page);
  await card(page, "Synthetic Anna").getByRole("button", { name: "Bearbeiten" }).click();
  await complete(page);
  await expect(copies(page)).toHaveCount(0);
});

test("switching character editors replaces unsaved values with the correct persona", async (t) => {
  const page = await mount(t);
  await card(page, "Synthetic Anna").getByRole("button", { name: "Bearbeiten" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Unsaved Anna");
  await card(page, "Synthetic Bea").getByRole("button", { name: "Bearbeiten" }).click();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Synthetic Bea");
  await expect(page.getByRole("textbox", { name: "Bio", exact: true })).toHaveValue("Bea synthetic bio");
});

test("a saved revision removes old drafts and the next request carries the new revision", async (t) => {
  const page = await mount(t);
  await generate(page);
  await complete(page);
  await card(page, "Synthetic Anna").getByRole("button", { name: "Bearbeiten" }).click();
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.testRequests.length)).toBe(2);
  await complete(page, 1, { character: { ...characterA, revision: 2 } });
  await expect(copies(page)).toHaveCount(0);
  await generate(page, "Fresh synthetic message");
  assert.equal(await page.evaluate(() => window.testRequests.at(-1).body.character_revision), 2);
});

for (const action of ["Deaktivieren", "Löschen"]) {
  test(`a delayed reply cannot survive ${action}`, async (t) => {
    const page = await mount(t);
    page.on("dialog", (dialog) => dialog.accept());
    await generate(page);
    await card(page, "Synthetic Anna").getByRole("button", { name: action }).click();
    await expect.poll(() => page.evaluate(() => window.testRequests.length)).toBe(2);
    await complete(page);
    await expect(copies(page)).toHaveCount(0);
    await complete(page, 1, { character: { ...characterA, status: "inactive", revision: 2 } });
    if (action === "Löschen") await card(page, "Synthetic Bea").getByRole("button", { name: "Auswählen" }).click();
    await expect(copies(page)).toHaveCount(0);
    if (action === "Deaktivieren") await expect(page.getByRole("button", { name: "Antwortvorschläge erzeugen", exact: true })).toBeDisabled();
  });
}

for (const [name, metadata] of [["character", { character_id: characterB.id, character_revision: 1 }], ["revision", { character_id: characterA.id, character_revision: 2 }]]) {
  test(`wrong ${name} response metadata never enables copying`, async (t) => {
    const page = await mount(t);
    await generate(page);
    await complete(page, 0, { replies: drafts, ...metadata, safety_note: "Wrong response binding" });
    await expect(copies(page)).toHaveCount(0);
  });
}

test("changing the pasted message invalidates pending output and allows only fresh drafts", async (t) => {
  const page = await mount(t);
  await generate(page);
  await page.getByLabel("Von OnlyFans kopierte Fan-Nachricht").fill("New synthetic fan message");
  await complete(page);
  await expect(copies(page)).toHaveCount(0);
  await generate(page, "New synthetic fan message");
  await complete(page, 1, { replies: ["Fresh one", "Fresh two", "Fresh three"], character_id: characterA.id, character_revision: 1, safety_note: "Manual only" });
  await expect(copies(page)).toHaveCount(3);
  await expect(page.getByText("Fresh one", { exact: true })).toBeVisible();
});

test("a pending generation is disabled and network failure allows retry with a visible error", async (t) => {
  const page = await mount(t);
  await generate(page);
  const button = page.getByRole("button", { name: "Antwortvorschläge erzeugen", exact: true });
  await expect(button).toBeDisabled();
  await page.evaluate(() => window.testRequests[0].reject(new Error("Synthetic network failure")));
  await expect(button).toBeEnabled();
  await expect(page.getByRole("status")).toContainText("fehlgeschlagen");
  await expect(copies(page)).toHaveCount(0);
});

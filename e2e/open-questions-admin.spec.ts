import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import ts from "typescript";

declare global {
  interface Window {
    mountOpenQuestions: (props: unknown) => void;
    statusActions: Array<Record<string, string>>;
  }
}

const nodeRequire = createRequire(join(process.cwd(), "package.json"));
const modules = {
  react: ["react", "react.production.js"],
  "react/jsx-runtime": ["react", "react-jsx-runtime.production.js"],
  "react-dom": ["react-dom", "react-dom.production.js"],
  "react-dom/client": ["react-dom", "react-dom-client.production.js"],
  scheduler: ["scheduler", "scheduler.production.js"],
};
const moduleSources = Object.entries(modules).map(([name, [pkg, file]]) =>
  `${JSON.stringify(name)}: function(module, exports, require) {\n${readFileSync(join(dirname(nodeRequire.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")}\n}`,
);
const pageSource = readFileSync("src/app/admin/open-questions/page.tsx", "utf8");
const readerSource = readFileSync("src/lib/adminOpenQuestions.ts", "utf8");
const clientSource = readFileSync("src/app/admin/open-questions/OpenQuestionsClient.tsx", "utf8");
const client = ts.transpileModule(clientSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const bundle = `(() => {
  const modules = {${moduleSources.join(",")},
    "./openQuestions.module.css": function(module) { module.exports = {__esModule: true, default: new Proxy({}, {get: (_, key) => String(key)})}; },
    "./actions": function(module) { module.exports = {updateOpenQuestionStatus: async formData => window.statusActions.push(Object.fromEntries(formData.entries()))}; },
    client: function(module, exports, require) {${client}}
  };
  const cache = {};
  function require(name) {
    if (!modules[name]) throw new Error("Unexpected client dependency: " + name);
    if (!cache[name]) { cache[name] = {exports: {}}; modules[name](cache[name], cache[name].exports, require); }
    return cache[name].exports;
  }
  window.mountOpenQuestions = props => require("react-dom/client").createRoot(document.getElementById("root")).render(require("react").createElement(require("client").OpenQuestionsClient, props));
})();`;

const selectedWorkspaceId = "10000000-0000-4000-8000-000000000001";
const workspaces = [
  { id: selectedWorkspaceId, name: "Synthetic Alpha" },
  { id: "10000000-0000-4000-8000-000000000002", name: "Synthetic Beta" },
];
const questions = [
  { id: "20000000-0000-4000-8000-000000000001", topic: "Allgemeine Supportfrage", reason: "assistant_uncertainty", status: "open", createdAt: "2026-11-03T23:30:00Z", reviewedQuestionExcerpt: "Wie lange dauert der Versand?", excerptReviewState: "approved", duplicateCount: 2 },
  { id: "20000000-0000-4000-8000-000000000002", topic: "Allgemeine Supportfrage", reason: "assistant_uncertainty", status: "in_review", createdAt: "2026-11-02T10:00:00Z", reviewedQuestionExcerpt: "Kann ich per Rechnung zahlen?", excerptReviewState: "approved", duplicateCount: 1 },
  { id: "20000000-0000-4000-8000-000000000003", topic: "Allgemeine Supportfrage", reason: "knowledge_gap", status: "open", createdAt: "2026-10-28T10:00:00Z", reviewedQuestionExcerpt: "WIE lange dauert der Versand!", excerptReviewState: "approved", duplicateCount: 2 },
  { id: "20000000-0000-4000-8000-000000000004", topic: "Technische Hilfe", reason: "provider_error", status: "open", createdAt: "2026-10-27T10:00:00Z", reviewedQuestionExcerpt: null, excerptReviewState: "pending", duplicateCount: 1 },
];
const topicStats = [{ topic: "Allgemeine Supportfrage", count: 3 }, { topic: "Technische Hilfe", count: 1 }];

async function mount(page: Page) {
  await page.route("**/*", (route) => route.fulfill({ contentType: "text/html", body: '<html><body><main id="root"></main></body></html>' }));
  await page.goto("http://localhost/open-questions-client-test");
  await page.addStyleTag({ content: readFileSync("src/app/admin/open-questions/openQuestions.module.css", "utf8") });
  await page.addScriptTag({ content: bundle });
  await page.evaluate(({ workspaces, selectedWorkspaceId, questions, topicStats }) => {
    window.statusActions = [];
    window.mountOpenQuestions({ workspaces, selectedWorkspaceId, questions, topicStats });
  }, { workspaces, selectedWorkspaceId, questions, topicStats });
  await expect(page.getByRole("region", { name: "Offene Supportfragen" })).toBeVisible();
}

test("approved excerpts stay distinguishable and exact duplicates retain per-question actions", async ({ page }) => {
  await mount(page);
  const search = page.getByLabel("Suche", { exact: true });

  await search.fill("Rechnung");
  await expect(page.locator("details")).toHaveCount(1);
  await expect(page.getByText("Kann ich per Rechnung zahlen?", { exact: true })).toBeVisible();
  await page.locator("details").first().locator("summary").click();
  await page.getByLabel("Bearbeitungsstatus").selectOption("resolved");
  await page.getByRole("button", { name: "Status speichern" }).click();
  expect(await page.evaluate(() => window.statusActions[0])).toEqual({
    workspace: selectedWorkspaceId,
    id: "20000000-0000-4000-8000-000000000002",
    status: "resolved",
  });

  await search.fill("Versand");
  await expect(page.locator("details")).toHaveCount(2);
  await page.locator("details").first().locator("summary").click();
  await expect(page.getByText("2", { exact: true })).toBeVisible();
});

test("pending content is neutral and prohibited raw values never reach DOM or search", async ({ page }) => {
  expect(pageSource).not.toContain("cause.message");
  expect(pageSource).not.toContain("conversation_id");
  expect(readerSource).not.toContain("conversation_messages?");
  expect(readerSource).not.toContain("inbound_message_id");
  expect(clientSource).not.toMatch(/\breference\b/u);

  await mount(page);
  await expect(page.getByText("Frageinhalt noch nicht datenschutzgeprüft", { exact: true })).toBeVisible();
  for (const prohibited of ["visitor@example.invalid", "https://example.invalid/private", "sk-synthetic-secret", "000000a1"]) {
    await expect(page.locator("body")).not.toContainText(prohibited);
    await page.getByLabel("Suche", { exact: true }).fill(prohibited);
    await expect(page.locator("details")).toHaveCount(0);
  }
});

test("focused Admin review remains usable without horizontal overflow", async ({ page }) => {
  await mount(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  for (const control of await page.locator("button, input, select, summary").all()) {
    const box = await control.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(38);
  }
});

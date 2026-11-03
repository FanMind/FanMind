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
const client = ts.transpileModule(readFileSync("src/app/admin/open-questions/OpenQuestionsClient.tsx", "utf8"), {
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
  { id: "20000000-0000-4000-8000-000000000001", topic: "Abrechnung", reason: "assistant_uncertainty", status: "open", createdAt: "2026-11-03T23:30:00Z", reference: "000000a1" },
  { id: "20000000-0000-4000-8000-000000000002", topic: "Technische Hilfe", reason: "provider_error", status: "in_review", createdAt: "2026-11-02T10:00:00Z", reference: "000000a2" },
  { id: "20000000-0000-4000-8000-000000000003", topic: "Anmeldung", reason: "knowledge_gap", status: "resolved", createdAt: "2026-10-28T10:00:00Z", reference: "000000a3" },
];
const topicStats = [{ topic: "Abrechnung", count: 3 }, { topic: "Technische Hilfe", count: 1 }];

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

test("synthetic Admin review filters redacted details and submits the existing status contract", async ({ page }) => {
  await mount(page);
  const workspace = page.getByLabel("Workspace", { exact: true });
  await expect(workspace.locator("option")).toHaveCount(3);
  await expect(workspace).toContainText("Synthetic Alpha");
  await expect(workspace).toContainText("Synthetic Beta");
  await expect(page.locator("body")).not.toContainText("visitor@example.invalid");
  await expect(page.locator("body")).not.toContainText("sk-synthetic-secret");

  const search = page.getByLabel("Suche", { exact: true });
  await search.fill("Abrechnung");
  await expect(page.locator("details")).toHaveCount(1);
  await expect(page.locator("details").getByText("Abrechnung", { exact: true })).toBeVisible();
  await search.press("Tab");
  await expect(page.getByLabel("Thema", { exact: true })).toBeFocused();

  await page.getByRole("button", { name: "Filter zurücksetzen" }).click();
  await page.getByLabel("Status", { exact: true }).selectOption("in_review");
  await expect(page.locator("details")).toHaveCount(1);
  await expect(page.getByText("Providerfehler", { exact: true })).toBeHidden();
  await page.locator("details").first().locator("summary").click();
  await expect(page.getByText("Providerfehler", { exact: true })).toBeVisible();

  await page.getByLabel("Bearbeitungsstatus").selectOption("resolved");
  await page.getByRole("button", { name: "Status speichern" }).click();
  await expect.poll(() => page.evaluate(() => window.statusActions.length)).toBe(1);
  expect(await page.evaluate(() => window.statusActions[0])).toEqual({
    workspace: selectedWorkspaceId,
    id: "20000000-0000-4000-8000-000000000002",
    status: "resolved",
  });
});

test("synthetic Admin review stays usable without horizontal overflow", async ({ page }) => {
  await mount(page);
  await page.getByLabel("Von", { exact: true }).fill("2026-11-04");
  await page.getByLabel("Bis", { exact: true }).fill("2026-11-04");
  await expect(page.locator("details")).toHaveCount(1);
  await expect(page.locator("details").getByText("Abrechnung", { exact: true })).toBeVisible();
  await expect(page.locator("details").getByText(/04\.11\.2026/u)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  for (const control of await page.locator("button, input, select, summary").all()) {
    const box = await control.boundingBox();
    if (box) expect(box.height).toBeGreaterThanOrEqual(38);
  }
});

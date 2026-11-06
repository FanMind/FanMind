import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const panelPath = "src/app/fans/[id]/FanContextPanel.tsx";
const actionsPath = "src/app/fans/[id]/contextActions.ts";
const pagePath = "src/app/fans/[id]/page.tsx";
const packagePath = "package.json";

test("successful follow-up deletion is server-side, revalidates counters, and shows success UI state", async () => {
  const [actions, page] = await Promise.all([
    readFile(actionsPath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);

  assert.match(actions, /export async function deleteManualFollowup\(formData: FormData\)/u);
  assert.match(actions, /"use server"/u);
  assert.match(actions, /method:\s*"DELETE"/u);
  assert.match(actions, /revalidatePath\(`\/fans\/\$\{contactId\}`\)/u);
  assert.match(actions, /revalidatePath\("\/dashboard"\)/u);
  assert.match(actions, /revalidatePath\("\/followups"\)/u);
  assert.match(actions, /"followup_deleted"/u);
  assert.match(page, /if \(value === "followup_deleted"\)[\s\S]*?Follow-up wurde gelöscht\./u);
});

test("cancelling the confirmation prevents the delete form submission", async () => {
  const panel = await readFile(panelPath, "utf8");

  assert.match(panel, /action=\{deleteManualFollowup\}/u);
  assert.match(panel, /window\.confirm\(\s*"Dieses Follow-up wirklich löschen\?"/u);
  assert.match(panel, /if \(!confirmed\) event\.preventDefault\(\)/u);
});

test("foreign-workspace follow-ups are rejected by workspace and contact filters", async () => {
  const actions = await readFile(actionsPath, "utf8");

  assert.match(actions, /requireContactInActiveAuthorizedWorkspace\(contactId\)/u);
  assert.match(actions, /url\.searchParams\.set\("workspace_id", `eq\.\$\{input\.workspaceId\}`\)/u);
  assert.match(actions, /url\.searchParams\.set\("contact_id", `eq\.\$\{input\.contactId\}`\)/u);
  assert.match(actions, /table: "followups"/u);
});

test("unknown follow-up IDs keep the item visible and surface a clean error", async () => {
  const [actions, page] = await Promise.all([
    readFile(actionsPath, "utf8"),
    readFile(pagePath, "utf8"),
  ]);

  assert.match(actions, /rows\.some\(\(row\) => row\.id === input\.entryId\)/u);
  assert.match(actions, /followup_delete_failed/u);
  assert.match(page, /if \(value === "followup_delete_failed"\)[\s\S]*?Follow-up konnte nicht gelöscht werden/u);
});

test("follow-up count and UI state update through the operations test suite", async () => {
  const [panel, actions, pkgRaw] = await Promise.all([
    readFile(panelPath, "utf8"),
    readFile(actionsPath, "utf8"),
    readFile(packagePath, "utf8"),
  ]);
  const pkg = JSON.parse(pkgRaw);

  assert.match(panel, /followups\.map\(\(followup\) =>/u);
  assert.match(panel, /key=\{followup\.id\}/u);
  assert.match(actions, /redirect\(contactPath\(contactId, locale, "followup_deleted", "followups"\)\)/u);
  assert.match(pkg.scripts["test:operations"], /tests\/followup-delete-policy\.test\.mjs/u);
});

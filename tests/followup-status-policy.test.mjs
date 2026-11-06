import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actionsPath = new URL("../src/app/fans/[id]/contextActions.ts", import.meta.url);
const formPath = new URL("../src/app/followups/FollowupStatusForm.tsx", import.meta.url);
const followupsPagePath = new URL("../src/app/followups/page.tsx", import.meta.url);
const fanPanelPath = new URL("../src/app/fans/[id]/FanContextPanel.tsx", import.meta.url);
const fanPagePath = new URL("../src/app/fans/[id]/page.tsx", import.meta.url);
const serverPath = new URL("../src/lib/supabase/server.ts", import.meta.url);
const pkgPath = new URL("../package.json", import.meta.url);

test("open follow-ups can be marked completed with server-side revalidation and success notices", async () => {
  const actions = await readFile(actionsPath, "utf8");
  const form = await readFile(formPath, "utf8");
  const page = await readFile(fanPagePath, "utf8");
  assert.match(actions, /export async function updateManualFollowupStatus\(formData: FormData\)/u);
  assert.match(actions, /values: \{ status: nextStatus \}/u);
  assert.match(actions, /nextStatus === "completed" \? "followup_completed" : "followup_reopened"/u);
  assert.match(actions, /revalidatePath\(`\/fans\/\$\{contactId\}`\)/u);
  assert.match(actions, /revalidatePath\("\/dashboard"\)/u);
  assert.match(actions, /revalidatePath\("\/followups"\)/u);
  assert.match(form, /name="next_status" type="hidden" value=\{nextStatus\}/u);
  assert.match(form, /const nextStatus = isCompleted \? "open" : "completed"/u);
  assert.match(page, /if \(value === "followup_completed"\)[\s\S]*?Follow-up wurde als erledigt markiert/u);
});

test("completed follow-ups can be reopened using the same server action", async () => {
  const actions = await readFile(actionsPath, "utf8");
  const form = await readFile(formPath, "utf8");
  const page = await readFile(fanPagePath, "utf8");
  assert.match(form, /followup\.status === "completed" \|\| followup\.status === "done"/u);
  assert.match(form, /Wieder öffnen/u);
  assert.match(actions, /formValue\(formData, "next_status"\) === "open" \? "open" : "completed"/u);
  assert.match(page, /if \(value === "followup_reopened"\)[\s\S]*?Follow-up wurde wieder geöffnet/u);
});

test("mark-completed confirmation can cancel before mutation", async () => {
  const form = await readFile(formPath, "utf8");
  assert.match(form, /window\.confirm\("Dieses Follow-up als erledigt markieren\?"\)/u);
  assert.match(form, /if \(!confirmed\) event\.preventDefault\(\)/u);
  assert.match(form, /if \(nextStatus !== "completed"\) return/u);
});

test("foreign workspace follow-ups are rejected by workspace and contact filters", async () => {
  const actions = await readFile(actionsPath, "utf8");
  assert.match(actions, /requireContactInActiveAuthorizedWorkspace\(contactId\)/u);
  assert.match(actions, /url\.searchParams\.set\("workspace_id", `eq\.\$\{input\.workspaceId\}`\)/u);
  assert.match(actions, /url\.searchParams\.set\("contact_id", `eq\.\$\{input\.contactId\}`\)/u);
  assert.match(actions, /table: "followups"/u);
});

test("unknown follow-up IDs keep status unchanged and show a clear error", async () => {
  const actions = await readFile(actionsPath, "utf8");
  const followupsPage = await readFile(followupsPagePath, "utf8");
  const fanPage = await readFile(fanPagePath, "utf8");
  assert.match(actions, /if \(!rows\.some\(\(row\) => row\.id === input\.entryId\)\)/u);
  assert.match(actions, /followup_status_failed/u);
  assert.match(followupsPage, /Follow-up konnte nicht geändert werden\. Es wurde möglicherweise bereits gelöscht oder gehört zu einem anderen Workspace\./u);
  assert.match(fanPage, /Follow-up konnte nicht geändert werden\. Es wurde möglicherweise bereits gelöscht oder gehört zu einem anderen Workspace\./u);
});

test("counters are refreshed after status changes", async () => {
  const actions = await readFile(actionsPath, "utf8");
  const followupsPage = await readFile(followupsPagePath, "utf8");
  assert.match(actions, /revalidatePath\("\/dashboard"\)/u);
  assert.match(actions, /revalidatePath\("\/followups"\)/u);
  assert.match(followupsPage, /getOpenFollowupCount\(workspace\.id\)/u);
});

test("open and completed lists render the correct status entries", async () => {
  const followupsPage = await readFile(followupsPagePath, "utf8");
  const server = await readFile(serverPath, "utf8");
  const fanPanel = await readFile(fanPanelPath, "utf8");
  assert.match(followupsPage, /requestedStatus === "done" \|\| requestedStatus === "completed" \? "completed" : "open"/u);
  assert.match(server, /if \(normalizedStatus && normalizedStatus !== "completed"\) \{[\s\S]*?filters\.push\(\["status", normalizedStatus\]\);[\s\S]*?\}/u);
  assert.match(server, /followup\.status === "completed" \|\| followup\.status === "done"/u);
  assert.match(fanPanel, /<FollowupStatusForm[\s\S]*returnTo="contact"/u);
  assert.match(followupsPage, /<FollowupStatusForm[\s\S]*returnTo="followups"/u);
});

test("operation tests include follow-up status policy coverage", async () => {
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  assert.match(pkg.scripts["test:operations"], /tests\/followup-status-policy\.test\.mjs/u);
});

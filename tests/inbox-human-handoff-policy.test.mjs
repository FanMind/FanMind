import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  formatInboxAverageResponseTime,
  formatInboxWaitingTime,
} from "../src/lib/inboxMetricFormatting.mjs";

const actionsPath = new URL("../src/app/inbox/actions.ts", import.meta.url);
const pagePath = new URL("../src/app/inbox/page.tsx", import.meta.url);
const serverPath = new URL("../src/lib/supabase/server.ts", import.meta.url);
const navigationPath = new URL("../src/lib/workspaceNavigation.ts", import.meta.url);
const searchFormPath = new URL("../src/app/inbox/InboxSearchForm.tsx", import.meta.url);
const migrationPath = new URL(
  "../supabase/migrations/20260808140000_add_conversation_assignment_identity.sql",
  import.meta.url,
);

test("inbox handoff stays authenticated and workspace-bound", async () => {
  const actions = await readFile(actionsPath, "utf8");

  assert.match(actions, /requireActiveAuthorizedWorkspace\(\)/u);
  assert.match(actions, /getWorkspaceConversations\(workspace\.id\)/u);
  assert.match(actions, /workspaceId: workspace\.id/u);
  assert.match(actions, /assignedUserId: user\.id/u);
  assert.doesNotMatch(actions, /service.role|SUPABASE_SERVICE_ROLE_KEY/iu);
});

test("assignment mutations are identity-bound and cannot send a message", async () => {
  const server = await readFile(serverPath, "utf8");
  const assignment = server.slice(
    server.indexOf("export async function claimConversationAssignment"),
    server.indexOf("export async function saveReplyDraftAsNote"),
  );

  assert.match(assignment, /assigned_owner/u);
  assert.match(assignment, /assigned_user_id/u);
  assert.match(assignment, /workspace_id/u);
  assert.match(assignment, /\["assigned_user_id", null\]/u);
  assert.match(assignment, /\["assigned_user_id", assignedUserId\]/u);
  assert.doesNotMatch(assignment, /status: "open"|next_step:/u);
  assert.doesNotMatch(assignment, /conversation_messages|send|webhook/iu);
});

test("assignment rollout is backward-compatible and avoids email labels", async () => {
  const [actions, page, server] = await Promise.all([
    readFile(actionsPath, "utf8"),
    readFile(pagePath, "utf8"),
    readFile(serverPath, "utf8"),
  ]);

  assert.match(server, /CONVERSATION_ASSIGNMENT_COLUMNS/u);
  assert.match(server, /isMissingAssignedUserIdentity/u);
  assert.match(server, /assigned_user_id[\s\S]*CONVERSATION_COLUMNS/u);
  assert.match(server, /assignmentSupported = false[\s\S]*assignment_supported: assignmentSupported/u);
  assert.match(page, /item\.assignmentSupported && !item\.assignedUserId/u);
  assert.match(page, /item\.assignmentSupported && item\.assignedUserId === userId/u);
  assert.doesNotMatch(actions, /user\.email/u);
  assert.match(actions, /return "Workspace-Team"/u);
  assert.doesNotMatch(page, /getSupabaseServerUser/u);
  assert.match(page, /WorkspaceAuthorizationError/u);
  assert.match(page, /redirect\("\/onboarding"\)/u);
});

test("inbox exposes claim and release controls only when assignment is supported", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /claimConversation/u);
  assert.match(page, /releaseConversation/u);
  assert.match(page, /inboxText\(locale, "Übernehmen"\)/u);
  assert.match(page, /inboxText\(locale, "Freigeben"\)/u);
  assert.match(page, /item\.assignedUserId === userId/u);
  assert.match(page, /getNoticeMessage\(notice, locale\)/u);
  assert.match(page, /readOnly=\{memberReadOnly\}/u);
  assert.match(page, /!readOnly && item\.conversationId/u);
});

test("English inbox navigation preserves locale and renders localized workspace copy", async () => {
  const [page, navigation, searchForm, actions] = await Promise.all([
    readFile(pagePath, "utf8"),
    readFile(navigationPath, "utf8"),
    readFile(searchFormPath, "utf8"),
    readFile(actionsPath, "utf8"),
  ]);

  assert.match(navigation, /localizedWorkspaceHref\("\/inbox", locale\)/u);
  assert.match(navigation, /url\.searchParams\.set\("lang", "en"\)/u);
  assert.match(page, /resolveWorkspaceLocale\(\{[\s\S]*lang: params\?\.lang,[\s\S]*user,/u);
  assert.match(
    page,
    /getWorkspaceNavigationForUser\([\s\S]*"inbox",[\s\S]*userEmail,[\s\S]*locale,[\s\S]*workspace\.role/u,
  );
  assert.match(page, /locale=\{locale\}/u);
  assert.match(page, /Prioritized work queue for incoming messages/u);
  assert.match(page, /Never send replies automatically/u);
  assert.match(page, /"Ø Antwortzeit": "Average response time"/u);
  assert.match(page, /formatInboxWaitingTime\(item\.waitingMinutes, locale\)/u);
  assert.match(page, /getInboxKpis\(queueItems, locale\)/u);
  assert.doesNotMatch(page, /<span>\{item\.waitingSince\}<\/span>/u);
  assert.match(page, /const fanListHref = localizedWorkspaceHref\("\/fans#fans-list", locale\)/u);
  assert.equal(
    page.match(/(?:primaryActionHref: fanListHref|href=\{fanListHref\})/gu)?.length,
    2,
  );
  assert.match(page, /localizedWorkspaceHref\(`\/fans\/\$\{item\.contactId\}`, locale\)/u);
  assert.match(page, /localizedWorkspaceHref\(`\/fans\/\$\{item\.contactId\}\?focus=reply`, locale\)/u);
  assert.match(page, /localizedWorkspaceHref\(`\/fans\/\$\{item\.contactId\}\?focus=followup`, locale\)/u);
  assert.doesNotMatch(page, /(?:href|primaryActionHref)=[{]?["`]\/fans#fans-list/u);
  assert.doesNotMatch(page, /href=\{`\/fans\/\$\{item\.contactId\}(?:\?focus=(?:reply|followup))?`\}/u);
  assert.match(searchForm, /if \(locale === "en"\) params\.set\("lang", "en"\)/u);
  assert.match(searchForm, /locale === "en" \? "Search" : "Suche"/u);
  assert.equal(page.match(/<input name="lang" type="hidden" value=\{locale\} \/>/gu)?.length, 2);
  assert.match(actions, /formValue\(formData, "lang"\) === "en"/u);
  assert.match(actions, /inboxNoticePath\("conversation_claimed", locale\)/u);
  assert.match(actions, /params\.set\("lang", "en"\)/u);
});

test("English inbox metrics localize duration units and preserve German output", () => {
  assert.equal(formatInboxWaitingTime(0, "en"), "—");
  assert.equal(formatInboxWaitingTime(59, "en"), "59 min.");
  assert.equal(formatInboxWaitingTime(60, "en"), "1 hr.");
  assert.equal(formatInboxWaitingTime(120, "en"), "2 hrs.");
  assert.equal(formatInboxWaitingTime(2879, "en"), "47 hrs.");
  assert.equal(formatInboxWaitingTime(2880, "en"), "2 days");
  assert.equal(formatInboxAverageResponseTime(0, "en"), "0 hrs.");
  assert.equal(formatInboxAverageResponseTime(60, "en"), "1 hr.");
  assert.equal(formatInboxAverageResponseTime(120, "en"), "2 hrs.");
  assert.equal(formatInboxAverageResponseTime(1439, "en"), "24 hrs.");
  assert.equal(formatInboxAverageResponseTime(1440, "en"), "1 day");
  assert.equal(formatInboxAverageResponseTime(4320, "en"), "3 days");

  assert.equal(formatInboxWaitingTime(59, "de"), "59 Min.");
  assert.equal(formatInboxWaitingTime(60, "de"), "1 Std.");
  assert.equal(formatInboxAverageResponseTime(1440, "de"), "1 Tag");
  assert.equal(formatInboxAverageResponseTime(4320, "de"), "3 Tage");
});

test("assignment schema stores a stable authenticated identity", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /assigned_user_id uuid references auth\.users\(id\)/u);
  assert.match(migration, /on delete set null/u);
  assert.match(migration, /workspace_id, assigned_user_id/u);
});

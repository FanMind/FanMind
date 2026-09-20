import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("account deletion blocker evaluation covers every owned workspace with a hard inventory bound", async () => {
  const source = await readFile("src/lib/accountDeletionRequests.ts", "utf8");

  assert.match(source, /type OwnedWorkspaceDeletionRow/u);
  assert.match(source, /owner_user_id=eq\.\$\{encodeURIComponent\(/u);
  assert.match(source, /limit=101/u);
  assert.match(source, /if \(rows\.length > 100\)/u);
  assert.match(source, /for \(const workspace of ownedWorkspaces\)/u);
  assert.match(source, /countOtherWorkspaceMembers/u);
  assert.match(source, /requiresSubscriptionResolution\(workspace\)/u);
});

test("cancelling before processing erases the request instead of retaining a raw user identifier", async () => {
  const source = await readFile("src/lib/accountDeletionRequests.ts", "utf8");

  assert.match(source, /async function eraseCancellableDeletionRequest/u);
  assert.match(source, /method: "DELETE"/u);
  assert.match(source, /in\.\(pending,blocked\)/u);
  assert.match(source, /return publicAccountDeletionStatus\(null\)/u);
  assert.doesNotMatch(
    source.slice(source.indexOf("export async function cancelAccountDeletionRequest")),
    /status: "cancelled"|cancelled_at/u,
  );
});

test("manual deletion processing is read-only by default and explicitly resumable after an interrupted processing state", async () => {
  const source = await readFile(
    "scripts/operations/process-account-deletion.mjs",
    "utf8",
  );
  const processSection = source.slice(
    source.indexOf("export async function processAccountDeletion"),
    source.indexOf("async function main()"),
  );

  assert.match(
    source,
    /PROCESSABLE_STATUSES = new Set\(\["pending", "blocked", "processing"\]\)/u,
  );
  assert.match(processSection, /resuming && execute && !resume/u);
  assert.match(processSection, /request_resume_required/u);
  assert.match(processSection, /allowMissing: resuming/u);
  assert.match(processSection, /dry_run_resume_ready/u);
  assert.match(source, /completion_notification_sent_at/u);
  assert.match(source, /markCompletionNotificationSent/u);
  assert.match(source, /status: "eq\.processing"/u);
  assert.match(source, /const resume = hasFlag\("--resume"\)/u);

  const dryRunReturn = processSection.indexOf('if (!execute) {\n    log("ACCOUNT_DELETION_RESULT=dry_run_success")');
  const blockedMutation = processSection.indexOf("await updateBlockedState");
  assert.ok(dryRunReturn >= 0, "dry-run return must be explicit");
  assert.ok(
    blockedMutation > dryRunReturn,
    "blocker status updates must occur only after the dry-run return",
  );
});

test("contact deletion is owner-bound, workspace-filtered and relies on complete cascading Creator cleanup", async () => {
  const [action, creatorSql, conversationSql, profileSql] = await Promise.all([
    readFile("src/app/fans/[id]/contextActions.ts", "utf8"),
    readFile("supabase/controlled/creator_intelligence_foundation.sql", "utf8"),
    readFile("supabase/migrations/20260613120000_create_conversations_messages.sql", "utf8"),
    readFile("supabase/migrations/20260614143000_create_memory_profile_tables.sql", "utf8"),
  ]);
  const section = action.slice(action.indexOf("export async function deleteContactAndCreatorData"));
  assert.match(section, /requireContactInActiveAuthorizedWorkspace\(contactId\)/u);
  assert.match(section, /url\.searchParams\.set\("id", `eq\.\$\{contactId\}`\)/u);
  assert.match(section, /url\.searchParams\.set\("workspace_id", `eq\.\$\{workspace\.id\}`\)/u);
  assert.match(section, /rows\.length !== 1/u);
  assert.match(section, /rows\[0\]\?\.workspace_id !== workspace\.id/u);
  assert.match(creatorSql, /creator_commercial_events[\s\S]*foreign key \(workspace_id,contact_id\) references public\.contacts\(workspace_id,id\) on delete cascade/u);
  assert.match(conversationSql, /contact_id uuid not null references public\.contacts\(id\) on delete cascade/u);
  assert.match(profileSql, /contact_ai_profiles[\s\S]*contact_id uuid not null references public\.contacts\(id\) on delete cascade/u);
});

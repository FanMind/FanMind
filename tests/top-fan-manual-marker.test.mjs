import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverPath = new URL("../src/lib/supabase/server.ts", import.meta.url);
const actionsPath = new URL("../src/app/fans/actions.ts", import.meta.url);
const topFansPath = new URL("../src/app/top-fans/page.tsx", import.meta.url);
const toggleFormPath = new URL("../src/app/fans/TopFanToggleForm.tsx", import.meta.url);
const migrationPath = new URL("../supabase/migrations/20260719120000_add_contact_top_fan_marker.sql", import.meta.url);

test("contacts persist a workspace-scoped manual top-fan marker", () => {
  const migration = readFileSync(migrationPath, "utf8");
  const server = readFileSync(serverPath, "utf8");

  assert.match(migration, /add column if not exists is_top_fan boolean not null default false/u);
  assert.match(migration, /contacts_workspace_top_fan_created_at_idx/u);
  assert.match(server, /is_top_fan: boolean \| null/u);
  assert.match(server, /const CONTACT_COLUMNS =\n  "[^"]*is_top_fan/u);
});

test("top-fan action authenticates and rejects foreign workspace contacts", () => {
  const actions = readFileSync(actionsPath, "utf8");

  assert.match(actions, /export async function updateTopFanMark\(formData: FormData\)/u);
  assert.match(actions, /requireContactInActiveAuthorizedWorkspace\(contactId\)/u);
  assert.match(actions, /contact\.workspace_id !== workspace\.id/u);
  assert.match(actions, /notice=top_fan_forbidden/u);
});

test("top-fan action supports successful marking and removal refreshes", () => {
  const actions = readFileSync(actionsPath, "utf8");

  assert.match(actions, /isTopFan = formValue\(formData, "is_top_fan"\) === "true"/u);
  assert.match(actions, /updateContactTopFanMarkServer\(\{[\s\S]*isTopFan/u);
  assert.match(actions, /top_fan_marked/u);
  assert.match(actions, /top_fan_removed/u);
  assert.match(actions, /revalidatePath\(`\/fans\/\$\{contactId\}`\)/u);
  assert.match(actions, /revalidatePath\("\/fans"\)/u);
  assert.match(actions, /revalidatePath\("\/top-fans"\)/u);
});

test("top-fan action rejects an unknown contact id", () => {
  const actions = readFileSync(actionsPath, "utf8");

  assert.match(actions, /if \(!contactId\) \{/u);
  assert.match(actions, /notice=top_fan_unknown_contact/u);
  assert.match(actions, /catch \{/u);
  assert.match(actions, /notice=top_fan_forbidden/u);
});

test("top-fans page filters to marked contacts and shows honest empty state", () => {
  const page = readFileSync(topFansPath, "utf8");

  assert.match(page, /topFanContacts = \(contactsResult\?\.contacts \?\? \[\]\)\.filter/u);
  assert.match(page, /Boolean\(contact\.is_top_fan\)/u);
  assert.match(page, /contacts=\{topFanContacts\}/u);
  assert.match(page, /Noch keine Top Fans markiert\./u);
  assert.match(page, /kein\s+automatisches Scoring und kein Ranking/u);
});

test("removing a top-fan marker asks for explicit confirmation", () => {
  const form = readFileSync(toggleFormPath, "utf8");

  assert.match(form, /Top-Fan-Markierung wirklich entfernen\?/u);
  assert.match(form, /window\.confirm/u);
});

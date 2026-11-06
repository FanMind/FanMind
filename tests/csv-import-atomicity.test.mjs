import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function exportedFunction(source, name, nextName) {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} is missing`);
  const end = source.indexOf(`export async function ${nextName}`, start + 1);
  assert.notEqual(end, -1, `${nextName} boundary is missing`);
  return source.slice(start, end);
}

test("CSV import sends one atomic PostgREST batch after duplicate filtering", async () => {
  const [actions, server] = await Promise.all([
    readFile(path.join(repoRoot, "src/app/fans/actions.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/lib/supabase/server.ts"), "utf8"),
  ]);

  const action = exportedFunction(actions, "importCsvContacts", "saveFacebookReplyTarget");
  const batch = exportedFunction(
    server,
    "createWorkspaceContactsBatch",
    "createWorkspaceContactServer",
  );

  assert.match(action, /const contactsToCreate: typeof parsed\.contacts = \[\]/u);
  assert.match(action, /contactsToCreate\.push\(/u);
  assert.match(action, /knownDuplicateKeys\.add\(duplicateKey\)/u);
  assert.equal(
    [...action.matchAll(/await createWorkspaceContactsBatch\(/gu)].length,
    1,
  );
  assert.doesNotMatch(action, /await createWorkspaceContact\(/u);
  assert.match(action, /importedCount:\s*0/u);
  assert.match(action, /gesamte Import wurde atomar abgebrochen/u);

  assert.match(batch, /const rows = input\.contacts\.map/u);
  assert.match(batch, /postgrestRequest\(\s*"contacts",\s*"POST",\s*rows/u);
  assert.equal([...batch.matchAll(/await postgrestRequest\(/gu)].length, 1);
  assert.match(batch, /createdCount:\s*0[\s\S]*result\.error/u);
  assert.match(batch, /createdCount: rows\.length, error: null/u);
  assert.doesNotMatch(batch, /return=representation/u);
});

test("CSV batch validates every row before its only database request", async () => {
  const server = await readFile(
    path.join(repoRoot, "src/lib/supabase/server.ts"),
    "utf8",
  );
  const batch = exportedFunction(
    server,
    "createWorkspaceContactsBatch",
    "createWorkspaceContactServer",
  );

  const validationPosition = batch.indexOf(
    "rows.some((row) => !row.display_name)",
  );
  const requestPosition = batch.indexOf("await postgrestRequest(");

  assert.ok(validationPosition >= 0);
  assert.ok(requestPosition > validationPosition);
  assert.match(batch, /input\.contacts\.length > 1_000/u);
  assert.match(batch, /workspace_id: input\.workspaceId/u);
});

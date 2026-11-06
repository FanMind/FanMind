import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const server = await readFile(
  new URL("../src/lib/supabase/server.ts", import.meta.url),
  "utf8",
);
const stats = await readFile(
  new URL("../src/lib/workspaceKpiStats.ts", import.meta.url),
  "utf8",
);
const strip = await readFile(
  new URL("../src/components/WorkspaceKpiStrip.tsx", import.meta.url),
  "utf8",
);
const manifest = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

test("follow-up completion KPI uses workspace-scoped count-only queries", () => {
  const start = server.indexOf(
    "export async function getFollowupCompletionCounts",
  );
  const end = server.indexOf(
    "export async function getWorkspaceOpenFollowups",
    start,
  );
  const implementation =
    start >= 0 && end > start ? server.slice(start, end) : "";

  assert.ok(implementation, "count helper must exist");
  assert.equal(
    (implementation.match(/postgrestCount\("followups"/gu) ?? []).length,
    3,
  );
  assert.equal(
    (implementation.match(/\["workspace_id", workspaceId\]/gu) ?? []).length,
    3,
  );
  assert.match(implementation, /\["status", "open"\]/u);
  assert.match(implementation, /\["status", "completed"\]/u);
  assert.match(implementation, /\["status", "done"\]/u);
  assert.match(
    implementation,
    /completed:\s*completedResult\.count \+ legacyDoneResult\.count/u,
  );
  assert.doesNotMatch(implementation, /postgrestSelect/u);
});

test("completion rate fails closed for errors, invalid counts and an empty denominator", () => {
  assert.match(stats, /if \(total === 0\) return null;/u);
  assert.match(stats, /!Number\.isInteger\(open\)/u);
  assert.match(stats, /!Number\.isInteger\(completed\)/u);
  assert.match(stats, /Math\.round\(\(completed \/ total\) \* 100\)/u);
  assert.match(strip, /followupCompletionRate\s*\?/u);
  assert.match(strip, /wt\(locale, "Nicht verfügbar"\)/u);
  assert.doesNotMatch(strip, /label: wt\(locale, "Conversion Rate"\)/u);
  assert.match(strip, /Keine Conversion- oder Umsatzkennzahl\./u);
  assert.match(
    manifest.scripts["test:operations"],
    /tests\/followup-completion-kpi\.test\.mjs/u,
  );
});

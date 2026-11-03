import test from "node:test";
import assert from "node:assert/strict";
import { groupOpenQuestions, normalizeQuestion } from "./openQuestionsGrouping.mjs";

test("normalizes case, punctuation and whitespace", () => {
  assert.equal(normalizeQuestion("  WIE  geht's? "), "wie geht s");
});

test("counts duplicates without combining workspaces", () => {
  const rows = [
    { id: "1", workspace_id: "A", question: "Wie geht's?", created_at: "2026-11-01" },
    { id: "2", workspace_id: "A", question: "WIE GEHT S", created_at: "2026-11-02" },
    { id: "3", workspace_id: "B", question: "Wie geht's?", created_at: "2026-11-03" },
  ];
  const groups = groupOpenQuestions(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(x => x.workspace_id === "A").count, 2);
  assert.equal(groups.find(x => x.workspace_id === "B").count, 1);
});

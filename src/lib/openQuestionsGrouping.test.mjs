import test from "node:test";
import assert from "node:assert/strict";
import { groupOpenQuestions, groupUnresolvedOpenQuestions, normalizeQuestion } from "./openQuestionsGrouping.mjs";

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

test("unresolved ranking excludes resolved entries and preserves workspace boundaries", () => {
  const rows = [
    { id: "1", workspace_id: "A", question: "Lieferzeit?", status: "open", created_at: "2026-11-01" },
    { id: "2", workspace_id: "A", question: "Lieferzeit?", status: "in_review", created_at: "2026-11-02" },
    { id: "3", workspace_id: "A", question: "Lieferzeit?", status: "resolved", created_at: "2026-11-03" },
    { id: "4", workspace_id: "B", question: "Lieferzeit?", status: "open", created_at: "2026-11-03" },
    { id: "5", workspace_id: "A", question: "Montage?", status: "resolved", created_at: "2026-11-03" },
  ];
  const grouped = groupUnresolvedOpenQuestions(rows);
  assert.equal(grouped.length, 2);
  assert.equal(grouped.find(group => group.workspace_id === "A").count, 2);
  assert.equal(grouped.find(group => group.workspace_id === "B").count, 1);
  assert.equal(grouped.some(group => group.normalized_question === "montage"), false);
  assert.equal(rows.length, 5, "full source list must remain unchanged");
});

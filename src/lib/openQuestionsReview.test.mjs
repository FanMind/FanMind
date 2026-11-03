import assert from "node:assert/strict";
import test from "node:test";
import {
  EXCERPT_REVIEW_NOTICE,
  normalizeReviewedQuestion,
  projectOpenQuestionReviews,
  topicForReviewedExcerpt,
  validApprovedExcerpt,
} from "./openQuestionsReview.mjs";

const workspace = "10000000-0000-4000-8000-000000000001";
const foreignWorkspace = "10000000-0000-4000-8000-000000000002";
const reviewer = "30000000-0000-4000-8000-000000000001";
const questions = [
  { id: "20000000-0000-4000-8000-000000000001", workspace_id: workspace },
  { id: "20000000-0000-4000-8000-000000000002", workspace_id: workspace },
  { id: "20000000-0000-4000-8000-000000000003", workspace_id: workspace },
];

function review(overrides = {}) {
  return {
    open_question_id: questions[0].id,
    workspace_id: workspace,
    review_version: 1,
    review_state: "approved",
    reviewed_question_excerpt: "Wie lange dauert der Versand?",
    reviewer_id: reviewer,
    reviewed_at: "2026-11-03T20:00:00.000Z",
    ...overrides,
  };
}

test("accepts only complete bounded approved plaintext evidence", () => {
  assert.equal(validApprovedExcerpt(review()), true);
  for (const reviewed_question_excerpt of [
    "x".repeat(161),
    " https://example.invalid",
    "visitor@example.invalid",
    "sk-synthetic-secret",
    "+41 79 123 45 67",
    "Zeile eins\nZeile zwei",
  ]) {
    assert.equal(validApprovedExcerpt(review({ reviewed_question_excerpt })), false);
  }
  assert.equal(validApprovedExcerpt(review({ review_state: "pending", reviewed_question_excerpt: null, reviewer_id: null, reviewed_at: null })), false);
  assert.equal(validApprovedExcerpt(review({ reviewer_id: null })), false);
  assert.equal(EXCERPT_REVIEW_NOTICE, "Frageinhalt noch nicht datenschutzgeprüft");
});

test("newer pending or rejected evidence blocks an older approval without fallback", () => {
  const oldApproval = review();
  for (const latestState of ["pending", "rejected", "unknown"]) {
    const projected = projectOpenQuestionReviews(questions, [
      oldApproval,
      review({
        review_version: 2,
        review_state: latestState,
        reviewed_question_excerpt: null,
        reviewer_id: null,
        reviewed_at: null,
      }),
    ]);
    assert.equal(projected.get(questions[0].id).reviewedQuestionExcerpt, null);
  }
});

test("an invalid bound review version blocks older approved evidence", () => {
  const projected = projectOpenQuestionReviews(questions, [
    review(),
    review({
      review_version: "2",
      review_state: "rejected",
      reviewed_question_excerpt: null,
      reviewer_id: null,
      reviewed_at: null,
    }),
  ]);
  assert.equal(projected.get(questions[0].id).reviewedQuestionExcerpt, null);
  assert.equal(projected.get(questions[0].id).excerptReviewState, "pending");
});

test("approved excerpts retain allowlisted topics while pending content stays generic", () => {
  assert.equal(topicForReviewedExcerpt("Kann ich per Rechnung zahlen?", "Allgemeine Supportfrage"), "Abrechnung");
  assert.equal(topicForReviewedExcerpt(null, "Technische Hilfe"), "Technische Hilfe");
});

test("binds review rows to exact question and workspace and counts only valid approved duplicates", () => {
  const projected = projectOpenQuestionReviews(questions, [
    review(),
    review({ open_question_id: questions[1].id, reviewed_question_excerpt: "WIE lange dauert der Versand!" }),
    review({ open_question_id: questions[2].id, reviewed_question_excerpt: "Kann ich per Rechnung zahlen?" }),
    review({ open_question_id: questions[2].id, workspace_id: foreignWorkspace, reviewed_question_excerpt: "MUST NOT LEAK" }),
  ]);
  assert.equal(projected.get(questions[0].id).duplicateCount, 2);
  assert.equal(projected.get(questions[1].id).duplicateCount, 2);
  assert.equal(projected.get(questions[2].id).duplicateCount, 1);
  assert.equal(normalizeReviewedQuestion(" WIE lange dauert der Versand! "), "wie lange dauert der versand");
  assert.equal([...projected.values()].some((row) => row.reviewedQuestionExcerpt === "MUST NOT LEAK"), false);
});

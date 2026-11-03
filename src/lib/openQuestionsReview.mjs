import { redactOpenQuestion } from "./openQuestionsRedaction.mjs";

export const EXCERPT_REVIEW_NOTICE = "Frageinhalt noch nicht datenschutzgeprüft";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const URL = /(?:https?:\/\/|www\.)/iu;
const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/iu;
const TOKEN = /\b(?:sk|pk|token|bearer)[-_][\p{L}\p{N}_-]{8,}\b/iu;
const PHONE = /(?:\+\d[\d ()/-]{6,}\d|\b\d[\d ()/-]{8,}\d\b)/u;

export function normalizeReviewedQuestion(text) {
  return String(text ?? "").normalize("NFKC").toLocaleLowerCase("de")
    .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/gu, " ");
}

// Validation only rejects unsafe data. It never creates or upgrades approval.
export function validApprovedExcerpt(review) {
  if (!review || review.review_state !== "approved") return false;
  if (!Number.isSafeInteger(review.review_version) || review.review_version < 1) return false;
  if (!UUID.test(String(review.open_question_id ?? "")) || !UUID.test(String(review.workspace_id ?? ""))) return false;
  if (!UUID.test(String(review.reviewer_id ?? ""))) return false;
  if (typeof review.reviewed_at !== "string" || !Number.isFinite(Date.parse(review.reviewed_at))) return false;
  if (typeof review.reviewed_question_excerpt !== "string") return false;
  const excerpt = review.reviewed_question_excerpt;
  if (!excerpt || excerpt !== excerpt.trim() || Array.from(excerpt).length > 160) return false;
  return !CONTROL.test(excerpt) && !URL.test(excerpt) && !EMAIL.test(excerpt) && !TOKEN.test(excerpt) && !PHONE.test(excerpt);
}

export function topicForReviewedExcerpt(reviewedQuestionExcerpt, fallbackTopic) {
  if (typeof reviewedQuestionExcerpt !== "string" || !reviewedQuestionExcerpt) return fallbackTopic;
  return redactOpenQuestion(reviewedQuestionExcerpt).replace(/^Thema:\s*/u, "");
}

export function projectOpenQuestionReviews(questions, reviews) {
  const questionByBinding = new Map();
  for (const question of Array.isArray(questions) ? questions : []) {
    if (!UUID.test(String(question?.id ?? "")) || !UUID.test(String(question?.workspace_id ?? ""))) continue;
    questionByBinding.set(JSON.stringify([question.id, question.workspace_id]), question);
  }

  const rowsByBinding = new Map();
  for (const review of Array.isArray(reviews) ? reviews : []) {
    const key = JSON.stringify([review?.open_question_id, review?.workspace_id]);
    if (!questionByBinding.has(key)) continue;
    const rows = rowsByBinding.get(key) ?? [];
    rows.push(review);
    rowsByBinding.set(key, rows);
  }

  const result = new Map();
  for (const [binding, question] of questionByBinding) {
    const boundRows = rowsByBinding.get(binding) ?? [];
    const invalidVersion = boundRows.some(
      (review) => !Number.isSafeInteger(review?.review_version) || review.review_version < 1,
    );
    const rows = invalidVersion
      ? []
      : [...boundRows].sort((left, right) => right.review_version - left.review_version);
    const latest = rows[0];
    const ambiguousLatest = latest && rows.filter((row) => row.review_version === latest.review_version).length !== 1;
    const approved = !invalidVersion && !ambiguousLatest && validApprovedExcerpt(latest);
    const state = approved ? "approved" : latest?.review_state === "rejected" ? "rejected" : "pending";
    result.set(question.id, {
      reviewedQuestionExcerpt: approved ? latest.reviewed_question_excerpt : null,
      excerptReviewState: state,
      duplicateCount: 1,
    });
  }

  const counts = new Map();
  for (const projection of result.values()) {
    if (!projection.reviewedQuestionExcerpt) continue;
    const normalized = normalizeReviewedQuestion(projection.reviewedQuestionExcerpt);
    if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  for (const projection of result.values()) {
    if (!projection.reviewedQuestionExcerpt) continue;
    projection.duplicateCount = counts.get(normalizeReviewedQuestion(projection.reviewedQuestionExcerpt)) ?? 1;
  }
  return result;
}

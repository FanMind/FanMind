export type OpenQuestionReviewState = "pending" | "approved" | "rejected";

export type OpenQuestionReviewSource = {
  open_question_id: string;
  workspace_id: string;
  review_version: number;
  review_state: string;
  reviewed_question_excerpt: unknown;
  reviewer_id: unknown;
  reviewed_at: unknown;
};

export type OpenQuestionReviewProjection = {
  reviewedQuestionExcerpt: string | null;
  excerptReviewState: OpenQuestionReviewState;
  duplicateCount: number;
};

export const EXCERPT_REVIEW_NOTICE: string;
export function normalizeReviewedQuestion(text: unknown): string;
export function validApprovedExcerpt(review: unknown): boolean;
export function topicForReviewedExcerpt(reviewedQuestionExcerpt: string | null, fallbackTopic: string): string;
export function projectOpenQuestionReviews(
  questions: Array<{ id: string; workspace_id: string }>,
  reviews: OpenQuestionReviewSource[],
): Map<string, OpenQuestionReviewProjection>;

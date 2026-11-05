export type QuestionInput = { id: string; workspace_id: string; question: string; created_at: string; status?: "open" | "in_review" | "resolved" };
export type QuestionGroup = { workspace_id: string; normalized_question: string; excerpt: string; count: number; ids: string[]; latest_at: string };
export function normalizeQuestion(text: string): string;
export function groupOpenQuestions(rows: QuestionInput[]): QuestionGroup[];
export function groupUnresolvedOpenQuestions(rows: QuestionInput[]): QuestionGroup[];

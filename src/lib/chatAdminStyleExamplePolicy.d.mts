export type ChatAdminStyleExampleStatus = "draft" | "approved" | "revoked" | "deleted";
export type ChatAdminStyleExample = {
  example_id: string;
  workspace_id: string;
  character_id: string;
  revision: number;
  text: string;
  status: ChatAdminStyleExampleStatus;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reviewer_declaration: string | null;
  preview_fingerprint: string | null;
};
export type ChatAdminStyleExamplePreview = {
  example_id: string;
  workspace_id: string;
  character_id: string;
  revision: number;
  text: string;
  status: "draft";
  preview_fingerprint: string;
};
export type ChatAdminContextTurn = {
  ordinal: number;
  speaker: "counterpart" | "character";
  text: string;
};
export type ChatAdminContextProvenance = {
  source_type: "synthetic";
  source_reference: string;
};
export type ChatAdminContextSegment = {
  segment_id: string;
  workspace_id: string;
  character_id: string;
  revision: number;
  context_turns: ChatAdminContextTurn[];
  selected_response_ordinals: number[];
  provenance: ChatAdminContextProvenance;
  status: ChatAdminStyleExampleStatus;
  selector_id: string | null;
  selected_at: string | null;
  selection_declaration: string | null;
  sanitizer_id: string | null;
  sanitized_at: string | null;
  sanitization_declaration: string | null;
  reviewer_id: string | null;
  reviewed_at: string | null;
  reviewer_declaration: string | null;
  preview_fingerprint: string | null;
};
export type ChatAdminContextSegmentPreview = {
  segment_id: string;
  workspace_id: string;
  character_id: string;
  revision: number;
  context_turns: ChatAdminContextTurn[];
  selected_response_ordinals: number[];
  provenance: ChatAdminContextProvenance;
  status: "draft";
  preview_fingerprint: string;
};

export const CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION: "non_explicit_role_style_confirmed";
export const CHAT_ADMIN_STYLE_EXAMPLE_STATUSES: readonly ChatAdminStyleExampleStatus[];
export const CHAT_ADMIN_CONTEXT_SEGMENT_SELECTION_DECLARATION: "synthetic_non_explicit_context_selected";
export const CHAT_ADMIN_CONTEXT_SEGMENT_SANITIZATION_DECLARATION: "synthetic_context_person_data_removed";
export const CHAT_ADMIN_CONTEXT_SEGMENT_REVIEW_DECLARATION: "synthetic_non_explicit_context_approved";
export const CHAT_ADMIN_CONTEXT_SEGMENT_STATUSES: readonly ChatAdminStyleExampleStatus[];
export class ChatAdminStyleExamplePolicyError extends Error {
  code: string;
  constructor(code: string);
}
export function createChatAdminStyleExampleDraft(value: unknown): ChatAdminStyleExample;
export function previewChatAdminStyleExample(value: unknown): ChatAdminStyleExamplePreview;
export function approveChatAdminStyleExample(value: unknown, now?: number): ChatAdminStyleExample;
export function correctChatAdminStyleExample(value: unknown, correction: unknown): ChatAdminStyleExample;
export function revokeChatAdminStyleExample(value: unknown): ChatAdminStyleExample;
export function deleteChatAdminStyleExample(value: unknown): ChatAdminStyleExample;
export function compileChatAdminStyleExamples(value: unknown): Array<{ example_id: string; revision: number; text: string }>;
export function createChatAdminContextSegmentDraft(value: unknown): ChatAdminContextSegment;
export function previewChatAdminContextSegment(value: unknown): ChatAdminContextSegmentPreview;
export function approveChatAdminContextSegment(value: unknown, now?: number): ChatAdminContextSegment;
export function correctChatAdminContextSegment(value: unknown, correction: unknown): ChatAdminContextSegment;
export function revokeChatAdminContextSegment(value: unknown): ChatAdminContextSegment;
export function deleteChatAdminContextSegment(value: unknown): ChatAdminContextSegment;
export function compileChatAdminContextSegments(value: unknown): Array<{
  segment_id: string;
  revision: number;
  context_turns: ChatAdminContextTurn[];
  selected_response_ordinals: number[];
  provenance: ChatAdminContextProvenance;
}>;


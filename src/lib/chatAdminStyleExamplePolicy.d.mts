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

export const CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION: "non_explicit_role_style_confirmed";
export const CHAT_ADMIN_STYLE_EXAMPLE_STATUSES: readonly ChatAdminStyleExampleStatus[];
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

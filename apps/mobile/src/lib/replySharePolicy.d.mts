export class ReplySharePolicyError extends Error {
  readonly code: string;
}

export function createReplyShareContent(value: unknown): Readonly<{
  message: string;
}>;

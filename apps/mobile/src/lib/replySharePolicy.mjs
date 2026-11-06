export class ReplySharePolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "ReplySharePolicyError";
    this.code = code;
  }
}

export function createReplyShareContent(value) {
  if (typeof value !== "string") {
    throw new ReplySharePolicyError("invalid_reply");
  }

  const message = value.trim();
  if (!message) {
    throw new ReplySharePolicyError("empty_reply");
  }

  return Object.freeze({ message });
}

export const FANMIND_REPLY_QUALITY_INSTRUCTIONS: string;
export class ReplyQualityError extends Error { code: "reply_quality_rejected"; }
export function assessReplyQuality(replies: unknown, recentReplies?: string[], knownInterests?: Array<{topic:string; polarity:"positive"|"negative"}>): string[];
export function fitRecentDialogueContext(profileContext: string, lines: string[], maximum: number): string;
export function runReplyQualityGate<T>(options: {
  generate: (feedback: string | null) => Promise<T>;
  readReplies: (result: T) => unknown;
  onAttempt: (attempt: {result: T | undefined; error: unknown; feedback: string | null}) => Promise<void>;
  recentReplies?: string[];
  knownInterests?: Array<{topic:string; polarity:"positive"|"negative"}>;
  inputChars: number;
  inputLimit: number;
}): Promise<T>;

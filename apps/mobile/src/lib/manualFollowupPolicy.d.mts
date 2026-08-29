export type ManualFollowupPriority = "low" | "normal" | "high";

export type ManualFollowupDraft = {
  reason?: unknown;
  dueDate?: unknown;
  due_date?: unknown;
  priority?: unknown;
};

export type ManualFollowupResult =
  | {
      ok: true;
      value: {
        reason: string;
        due_date: string;
        priority: ManualFollowupPriority;
      };
      errors: [];
    }
  | {
      ok: false;
      value: null;
      errors: string[];
    };

export function normalizeManualFollowupDraft(
  input: ManualFollowupDraft,
  today?: string,
): ManualFollowupResult;

export const CANONICAL_COMPLETED_FOLLOWUP_STATUS = "completed" as const;
export const LEGACY_COMPLETED_FOLLOWUP_STATUS = "done" as const;

export function isCompletedFollowupStatus(
  status: string | null | undefined,
): boolean {
  return (
    status === CANONICAL_COMPLETED_FOLLOWUP_STATUS ||
    status === LEGACY_COMPLETED_FOLLOWUP_STATUS
  );
}

export function isOpenFollowupStatus(
  status: string | null | undefined,
): boolean {
  return !isCompletedFollowupStatus(status);
}

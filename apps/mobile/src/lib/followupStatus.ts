export const CANONICAL_COMPLETED_FOLLOWUP_STATUS = "completed" as const;
export const LEGACY_COMPLETED_FOLLOWUP_STATUS = "done" as const;
export const COMPLETED_FOLLOWUP_FILTER = `(${CANONICAL_COMPLETED_FOLLOWUP_STATUS},${LEGACY_COMPLETED_FOLLOWUP_STATUS})`;
export const OPEN_FOLLOWUP_FILTER =
  `status.is.null,status.not.in.${COMPLETED_FOLLOWUP_FILTER}`;

export function isCompletedFollowupStatus(status: string | null | undefined): boolean {
  return (
    status === CANONICAL_COMPLETED_FOLLOWUP_STATUS ||
    status === LEGACY_COMPLETED_FOLLOWUP_STATUS
  );
}

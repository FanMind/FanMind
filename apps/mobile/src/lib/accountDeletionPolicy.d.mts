export const MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE: "KONTO LÖSCHEN";
export const MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE: "LÖSCHANFRAGE ABBRECHEN";
export const MOBILE_ACCOUNT_DELETION_PROCESSING_DAYS: 30;

export class MobileAccountDeletionPolicyError extends Error {
  readonly code: string;
  constructor(code: string);
}

export function normalizeMobileAccountDeletionEmail(value: unknown): string;

export function validateMobileAccountDeletionConfirmation(
  input: { emailConfirmation?: unknown; confirmation?: unknown } | null | undefined,
  expectedEmail: unknown,
): { email: string };

export function validateMobileAccountDeletionCancellation(
  input: { requestId?: unknown; confirmation?: unknown } | null | undefined,
): { requestId: string };

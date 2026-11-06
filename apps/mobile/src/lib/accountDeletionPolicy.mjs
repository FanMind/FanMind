export const MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE = "KONTO LÖSCHEN";
export const MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE = "LÖSCHANFRAGE ABBRECHEN";
export const MOBILE_ACCOUNT_DELETION_PROCESSING_DAYS = 30;

export class MobileAccountDeletionPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "MobileAccountDeletionPolicyError";
    this.code = code;
  }
}

export function normalizeMobileAccountDeletionEmail(value) {
  if (typeof value !== "string") {
    throw new MobileAccountDeletionPolicyError("email_invalid");
  }
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 320 ||
    /[\r\n\0]/u.test(email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    throw new MobileAccountDeletionPolicyError("email_invalid");
  }
  return email;
}

export function validateMobileAccountDeletionConfirmation(input, expectedEmail) {
  const email = normalizeMobileAccountDeletionEmail(input?.emailConfirmation);
  const expected = normalizeMobileAccountDeletionEmail(expectedEmail);
  if (email !== expected) {
    throw new MobileAccountDeletionPolicyError("email_confirmation_mismatch");
  }
  if (input?.confirmation !== MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE) {
    throw new MobileAccountDeletionPolicyError("confirmation_phrase_invalid");
  }
  return { email };
}

export function validateMobileAccountDeletionCancellation(input) {
  if (input?.confirmation !== MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE) {
    throw new MobileAccountDeletionPolicyError("cancel_confirmation_invalid");
  }
  if (
    typeof input?.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      input.requestId,
    )
  ) {
    throw new MobileAccountDeletionPolicyError("request_id_invalid");
  }
  return { requestId: input.requestId.toLowerCase() };
}

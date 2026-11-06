export const ACCOUNT_DELETION_CONFIRMATION_PHRASE = "KONTO LÖSCHEN";
export const ACCOUNT_DELETION_CANCEL_PHRASE = "LÖSCHANFRAGE ABBRECHEN";
export const ACCOUNT_DELETION_PROCESSING_DAYS = 30;
export const ACCOUNT_DELETION_CONFIRMATION_VERSION = "v1";

export const ACCOUNT_DELETION_REQUEST_SOURCES = Object.freeze([
  "web",
  "mobile",
]);

export const ACCOUNT_DELETION_STATUSES = Object.freeze([
  "pending",
  "blocked",
  "processing",
  "completed",
  "completed_notification_pending",
  "cancelled",
  "failed",
]);

export const ACCOUNT_DELETION_ACTIVE_STATUSES = Object.freeze([
  "pending",
  "blocked",
  "processing",
]);

export class AccountDeletionPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "AccountDeletionPolicyError";
    this.code = code;
  }
}

export function normalizeAccountDeletionEmail(value) {
  if (typeof value !== "string") {
    throw new AccountDeletionPolicyError("email_invalid");
  }
  const email = value.trim().toLowerCase();
  if (
    email.length < 3 ||
    email.length > 320 ||
    /[\r\n\0]/u.test(email) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
  ) {
    throw new AccountDeletionPolicyError("email_invalid");
  }
  return email;
}

export function validateAccountDeletionRequest(input, expectedEmail, source) {
  const normalizedExpectedEmail = normalizeAccountDeletionEmail(expectedEmail);
  const email = normalizeAccountDeletionEmail(input?.emailConfirmation);
  if (email !== normalizedExpectedEmail) {
    throw new AccountDeletionPolicyError("email_confirmation_mismatch");
  }
  if (input?.confirmation !== ACCOUNT_DELETION_CONFIRMATION_PHRASE) {
    throw new AccountDeletionPolicyError("confirmation_phrase_invalid");
  }
  if (!ACCOUNT_DELETION_REQUEST_SOURCES.includes(source)) {
    throw new AccountDeletionPolicyError("request_source_invalid");
  }
  return {
    email,
    source,
    confirmationVersion: ACCOUNT_DELETION_CONFIRMATION_VERSION,
  };
}

export function validateAccountDeletionCancellation(input) {
  if (input?.confirmation !== ACCOUNT_DELETION_CANCEL_PHRASE) {
    throw new AccountDeletionPolicyError("cancel_confirmation_invalid");
  }
  if (
    typeof input?.requestId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      input.requestId,
    )
  ) {
    throw new AccountDeletionPolicyError("request_id_invalid");
  }
  return { requestId: input.requestId.toLowerCase() };
}

export function getAccountDeletionDeadline(requestedAt = new Date()) {
  const date = requestedAt instanceof Date ? requestedAt : new Date(requestedAt);
  if (Number.isNaN(date.getTime())) {
    throw new AccountDeletionPolicyError("requested_at_invalid");
  }
  return new Date(
    date.getTime() + ACCOUNT_DELETION_PROCESSING_DAYS * 24 * 60 * 60 * 1000,
  );
}

export function isAccountDeletionCancellable(status) {
  return status === "pending" || status === "blocked";
}

export function requiresSubscriptionResolution(workspace, now = new Date()) {
  if (!workspace?.stripe_subscription_id) return false;
  const effectiveEnd = workspace.subscription_effective_end_at
    ? new Date(workspace.subscription_effective_end_at)
    : null;
  if (effectiveEnd && !Number.isNaN(effectiveEnd.getTime())) {
    return effectiveEnd.getTime() > now.getTime();
  }
  const status = String(workspace.billing_status ?? "").toLowerCase();
  return !["cancelled", "canceled", "ended", "expired", "demo_free"].includes(
    status,
  );
}

export function publicAccountDeletionStatus(row) {
  if (!row) return { status: "none", cancellable: false };
  const status = ACCOUNT_DELETION_STATUSES.includes(row.status)
    ? row.status
    : "failed";
  return {
    id: row.id,
    status,
    requestedAt: row.requested_at,
    processingDeadlineAt: row.processing_deadline_at,
    requiresOwnershipTransfer: Boolean(row.requires_ownership_transfer),
    requiresSubscriptionResolution: Boolean(
      row.requires_subscription_resolution,
    ),
    cancellable: isAccountDeletionCancellable(status),
  };
}

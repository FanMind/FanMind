import { createHash } from "node:crypto";

import { evaluateWorkspaceProcessingEntitlement } from "./workspaceProcessingPolicy.mjs";

export const MOBILE_PUSH_DELIVERY_CONFIRMATION =
  "deliver-mobile-followup-reminder-staging";
export const MOBILE_PUSH_DELIVERY_ENABLED_ENV =
  "FANMIND_MOBILE_PUSH_DELIVERY_ENABLED";
export const MOBILE_PUSH_EXPO_ACCESS_TOKEN_ENV =
  "FANMIND_MOBILE_PUSH_EXPO_ACCESS_TOKEN";
export const MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT =
  "mobile-push-target-revalidation-v1";
export const MOBILE_PUSH_STAGING_APP_HOSTNAME = "staging.fanmind.ch";
export const MOBILE_PUSH_PRODUCTION_DELIVERY_SUPPORTED = false;
export const MOBILE_PUSH_MAX_ATTEMPTS = 3;
export const MOBILE_PUSH_MAX_RECEIPT_CHECKS = 4;
export const MOBILE_PUSH_REVALIDATION_MAX_CLOCK_SKEW_MS = 60 * 1000;
export const MOBILE_PUSH_REGISTRATION_MAX_FUTURE_MS =
  31 * 24 * 60 * 60 * 1000;
export const MOBILE_PUSH_RECEIPT_CHECK_DELAY_MS = 15 * 60 * 1000;
export const MOBILE_PUSH_RECEIPT_EXPIRY_MS = 24 * 60 * 60 * 1000;
export const MOBILE_PUSH_REMINDER_TTL_SECONDS = 60 * 60;
export const MOBILE_PUSH_RECEIPT_RETRY_DELAYS_MS = Object.freeze([
  15 * 60 * 1000,
  60 * 60 * 1000,
  6 * 60 * 60 * 1000,
]);
export const MOBILE_PUSH_RETRY_DELAYS_MS = Object.freeze([
  60 * 1000,
  5 * 60 * 1000,
  15 * 60 * 1000,
]);

export const MOBILE_PUSH_REMINDER_COPY = Object.freeze({
  title: "FanMind",
  body: "Ein Follow-up ist fällig.",
  type: "followup_reminder",
  channelId: "followup-reminders",
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const EXPO_PUSH_TOKEN_PATTERN =
  /^(?:Exponent|Expo)PushToken\[[A-Za-z0-9_-]{16,220}\]$/u;
const TOKEN_FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/u;
const SUPABASE_REF_PATTERN = /^[a-z0-9]{8,40}$/u;
const DATABASE_TIMESTAMP_PATTERN =
  /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.(?<fraction>\d{1,6}))?(?<zone>Z|(?<offsetSign>[+-])(?<offsetHour>\d{2}):(?<offsetMinute>\d{2}))$/u;

export class MobilePushDeliveryPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "MobilePushDeliveryPolicyError";
    this.code = code;
  }
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizedUuid(value) {
  const candidate = clean(value).toLowerCase();
  return UUID_PATTERN.test(candidate) ? candidate : null;
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    actual.length === wanted.length &&
    actual.every((key, index) => key === wanted[index])
  );
}

function parseHttpsUrl(value) {
  try {
    const parsed = new URL(clean(value));
    return parsed.protocol === "https:" && !parsed.username && !parsed.password
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function supabaseProjectRefFromUrl(parsed) {
  if (
    !parsed ||
    parsed.port ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash
  ) {
    return null;
  }
  const match = parsed.hostname
    .toLowerCase()
    .match(/^([a-z0-9]{8,40})\.supabase\.co$/u);
  return match?.[1] ?? null;
}

function supabaseProjectRef(value) {
  return supabaseProjectRefFromUrl(parseHttpsUrl(value));
}

function validDate(value) {
  if (!DATE_PATTERN.test(clean(value))) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function canonicalizeMobilePushDatabaseTimestamp(value) {
  if (typeof value !== "string" || value.length > 40) return null;
  const match = value.match(DATABASE_TIMESTAMP_PATTERN);
  if (!match?.groups) return null;
  const year = Number(match.groups.year);
  const month = Number(match.groups.month);
  const day = Number(match.groups.day);
  const hour = Number(match.groups.hour);
  const minute = Number(match.groups.minute);
  const second = Number(match.groups.second);
  const offsetHour = Number(match.groups.offsetHour ?? "0");
  const offsetMinute = Number(match.groups.offsetMinute ?? "0");
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth[month - 1] ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

export function validateMobilePushDeliveryTargetBinding(value) {
  if (
    !exactKeys(value, [
      "serviceRoleKey",
      "supabaseProjectRef",
      "supabaseUrl",
    ])
  ) {
    throw new MobilePushDeliveryPolicyError("target_binding_invalid");
  }

  const supabaseUrl = parseHttpsUrl(value.supabaseUrl);
  const supabaseProjectRef = clean(value.supabaseProjectRef).toLowerCase();
  const serviceRoleKey = clean(value.serviceRoleKey);
  if (
    !supabaseUrl ||
    !SUPABASE_REF_PATTERN.test(supabaseProjectRef) ||
    supabaseProjectRef !== supabaseProjectRefFromUrl(supabaseUrl) ||
    serviceRoleKey.length < 20 ||
    serviceRoleKey.length > 4096 ||
    /[\u0000-\u0020\u007f]/u.test(serviceRoleKey)
  ) {
    throw new MobilePushDeliveryPolicyError("target_binding_invalid");
  }

  return Object.freeze({
    supabaseUrl: `https://${supabaseProjectRef}.supabase.co`,
    supabaseProjectRef,
    serviceRoleKey,
  });
}

function validTimestamp(value) {
  return canonicalizeMobilePushDatabaseTimestamp(value) === value;
}

export function evaluateMobilePushDeliveryEnvironment(
  environment = {},
  {
    confirmation = "",
    expectedProjectId = "",
    reviewedAppHostname = "",
    reviewedTargetSupabaseProjectRef = "",
    reviewedProductionSupabaseProjectRef = "",
  } = {},
) {
  const errors = [];
  const runtime = clean(environment.FANMIND_RUNTIME_ENVIRONMENT).toLowerCase();
  const configuredProjectId = normalizedUuid(
    environment.FANMIND_MOBILE_PUSH_EAS_PROJECT_ID,
  );
  const expected = normalizedUuid(expectedProjectId);
  const appUrl = parseHttpsUrl(
    environment.NEXT_PUBLIC_APP_URL ?? environment.FANMIND_APP_URL,
  );
  const targetSupabaseRef = clean(
    environment.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const productionSupabaseRef = clean(
    environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  ).toLowerCase();
  const approvedTargetSupabaseRef = clean(
    reviewedTargetSupabaseProjectRef,
  ).toLowerCase();
  const approvedProductionSupabaseRef = clean(
    reviewedProductionSupabaseProjectRef,
  ).toLowerCase();
  const approvedAppHostname = clean(reviewedAppHostname).toLowerCase();
  const urlSupabaseRef = supabaseProjectRef(
    environment.NEXT_PUBLIC_SUPABASE_URL,
  );
  const accessToken = clean(environment[MOBILE_PUSH_EXPO_ACCESS_TOKEN_ENV]);

  if (runtime !== "staging") errors.push("staging_only");
  if (environment[MOBILE_PUSH_DELIVERY_ENABLED_ENV] !== "true") {
    errors.push("delivery_disabled");
  }
  if (confirmation !== MOBILE_PUSH_DELIVERY_CONFIRMATION) {
    errors.push("confirmation_missing");
  }
  if (environment.FANMIND_ENABLE_NON_PRODUCTION_WRITES !== "true") {
    errors.push("non_production_writes_disabled");
  }
  if (
    environment.FANMIND_NON_PRODUCTION_WRITE_ACK !==
    "I_UNDERSTAND_NON_PRODUCTION_ONLY"
  ) {
    errors.push("non_production_write_ack_missing");
  }
  if (!configuredProjectId || !expected || configuredProjectId !== expected) {
    errors.push("project_binding_invalid");
  }
  if (
    !appUrl ||
    !approvedAppHostname ||
    approvedAppHostname !== MOBILE_PUSH_STAGING_APP_HOSTNAME ||
    appUrl.hostname.toLowerCase() !== approvedAppHostname ||
    appUrl.pathname !== "/" ||
    appUrl.port ||
    appUrl.search ||
    appUrl.hash ||
    appUrl.hostname.toLowerCase() === "fanmind.ch" ||
    appUrl.hostname.toLowerCase() === "www.fanmind.ch" ||
    approvedAppHostname === "fanmind.ch" ||
    approvedAppHostname === "www.fanmind.ch"
  ) {
    errors.push("staging_api_target_invalid");
  }
  if (
    !SUPABASE_REF_PATTERN.test(targetSupabaseRef) ||
    !SUPABASE_REF_PATTERN.test(productionSupabaseRef) ||
    !SUPABASE_REF_PATTERN.test(approvedTargetSupabaseRef) ||
    !SUPABASE_REF_PATTERN.test(approvedProductionSupabaseRef) ||
    !urlSupabaseRef ||
    urlSupabaseRef !== approvedTargetSupabaseRef ||
    targetSupabaseRef !== approvedTargetSupabaseRef ||
    productionSupabaseRef !== approvedProductionSupabaseRef ||
    approvedTargetSupabaseRef === approvedProductionSupabaseRef
  ) {
    errors.push("staging_supabase_target_invalid");
  }
  if (
    accessToken.length < 20 ||
    accessToken.length > 2048 ||
    /[\u0000-\u0020\u007f]/u.test(accessToken)
  ) {
    errors.push("expo_access_token_invalid");
  }
  if (
    environment.FANMIND_MOBILE_PUSH_PRODUCTION_ACTIVATION_CONFIRMED === "true" ||
    MOBILE_PUSH_PRODUCTION_DELIVERY_SUPPORTED
  ) {
    errors.push("production_activation_forbidden");
  }

  return {
    ok: errors.length === 0,
    mode: "staging-explicit-single-reminder",
    runtime,
    projectBound: Boolean(
      configuredProjectId && expected && configuredProjectId === expected,
    ),
    appTargetBound: Boolean(
      appUrl &&
        approvedAppHostname &&
        approvedAppHostname === MOBILE_PUSH_STAGING_APP_HOSTNAME &&
        appUrl.hostname.toLowerCase() === approvedAppHostname &&
        appUrl.pathname === "/" &&
        !appUrl.port &&
        !appUrl.search &&
        !appUrl.hash,
    ),
    supabaseTargetBound: Boolean(
      urlSupabaseRef &&
        targetSupabaseRef === approvedTargetSupabaseRef &&
        urlSupabaseRef === approvedTargetSupabaseRef &&
        productionSupabaseRef === approvedProductionSupabaseRef &&
        approvedTargetSupabaseRef !== approvedProductionSupabaseRef,
    ),
    productionSupported: MOBILE_PUSH_PRODUCTION_DELIVERY_SUPPORTED,
    errors,
  };
}

export function validateMobilePushDeliveryTrigger(value) {
  if (
    !exactKeys(value, [
      "confirmation",
      "dueDateCutoff",
      "followupId",
      "userId",
      "workspaceId",
    ])
  ) {
    throw new MobilePushDeliveryPolicyError("invalid_trigger");
  }

  const workspaceId = normalizedUuid(value.workspaceId);
  const userId = normalizedUuid(value.userId);
  const followupId = normalizedUuid(value.followupId);
  const dueDateCutoff = clean(value.dueDateCutoff);
  const confirmation = clean(value.confirmation);

  if (!workspaceId || !userId || !followupId || !validDate(dueDateCutoff)) {
    throw new MobilePushDeliveryPolicyError("invalid_trigger");
  }
  if (confirmation !== MOBILE_PUSH_DELIVERY_CONFIRMATION) {
    throw new MobilePushDeliveryPolicyError("confirmation_missing");
  }

  return {
    workspaceId,
    userId,
    followupId,
    dueDateCutoff,
    confirmation,
  };
}

export function validateEligibleMobilePushTarget(
  target,
  trigger,
  { now = new Date(), expectedProjectId = "" } = {},
) {
  if (!target || typeof target !== "object" || Array.isArray(target)) {
    throw new MobilePushDeliveryPolicyError("target_missing");
  }
  const expected = normalizedUuid(expectedProjectId);
  const nowMs = now instanceof Date ? now.getTime() : Number.NaN;
  if (!expected || !Number.isFinite(nowMs)) {
    throw new MobilePushDeliveryPolicyError("target_invalid");
  }
  const todayUtc = new Date(nowMs).toISOString().slice(0, 10);

  const membership = target.membership;
  const workspace = target.workspace;
  const contact = target.contact;
  const followup = target.followup;
  const registration = target.registration;
  const registrationToken = clean(registration?.token);
  const registrationTokenFingerprint = clean(
    registration?.token_fingerprint,
  ).toLowerCase();

  if (
    !membership ||
    normalizedUuid(membership.user_id) !== trigger.userId ||
    normalizedUuid(membership.workspace_id) !== trigger.workspaceId ||
    !["owner", "member"].includes(membership.role)
  ) {
    throw new MobilePushDeliveryPolicyError("membership_forbidden");
  }
  if (
    !workspace ||
    normalizedUuid(workspace.id) !== trigger.workspaceId ||
    workspace.billing_status === "demo_free" ||
    evaluateWorkspaceProcessingEntitlement(workspace, now).allowed !== true
  ) {
    throw new MobilePushDeliveryPolicyError("workspace_ineligible");
  }
  if (
    !followup ||
    normalizedUuid(followup.id) !== trigger.followupId ||
    normalizedUuid(followup.workspace_id) !== trigger.workspaceId ||
    normalizedUuid(followup.contact_id) === null ||
    followup.status !== "open" ||
    !validDate(followup.due_date) ||
    trigger.dueDateCutoff > todayUtc ||
    followup.due_date > trigger.dueDateCutoff
  ) {
    throw new MobilePushDeliveryPolicyError("followup_ineligible");
  }
  if (
    !contact ||
    normalizedUuid(contact.id) !== normalizedUuid(followup.contact_id) ||
    normalizedUuid(contact.workspace_id) !== trigger.workspaceId
  ) {
    throw new MobilePushDeliveryPolicyError("contact_forbidden");
  }
  if (
    !registration ||
    normalizedUuid(registration.id) === null ||
    normalizedUuid(registration.user_id) !== trigger.userId ||
    normalizedUuid(registration.workspace_id) !== trigger.workspaceId ||
    normalizedUuid(registration.expo_project_id) !== expected ||
    registration.status !== "active" ||
    !["android", "ios"].includes(registration.platform) ||
    !validTimestamp(registration.expires_at) ||
    Date.parse(registration.expires_at) <= nowMs ||
    Date.parse(registration.expires_at) >
      nowMs + MOBILE_PUSH_REGISTRATION_MAX_FUTURE_MS ||
    registration.token !== registrationToken ||
    !EXPO_PUSH_TOKEN_PATTERN.test(registrationToken) ||
    registration.token_fingerprint !== registrationTokenFingerprint ||
    !TOKEN_FINGERPRINT_PATTERN.test(registrationTokenFingerprint)
  ) {
    throw new MobilePushDeliveryPolicyError("registration_ineligible");
  }

  return {
    workspaceId: trigger.workspaceId,
    userId: trigger.userId,
    followupId: trigger.followupId,
    contactId: normalizedUuid(contact.id),
    registrationId: normalizedUuid(registration.id),
    projectId: expected,
    platform: registration.platform,
    token: registrationToken,
    registrationTokenFingerprint,
    dueDate: followup.due_date,
  };
}

export function createMobilePushDeliveryIdempotencyKey(target) {
  const fields = [
    "workspaceId",
    "userId",
    "followupId",
    "registrationId",
    "projectId",
    "dueDate",
  ];
  if (
    !target ||
    fields.some((field) => typeof target[field] !== "string" || !target[field])
  ) {
    throw new MobilePushDeliveryPolicyError("target_invalid");
  }
  return `mpd1_${createHash("sha256")
    .update("fanmind-mobile-followup-delivery-v1\0")
    .update(fields.map((field) => target[field]).join("\0"))
    .digest("hex")}`;
}

export function buildMinimalFollowupPushPayload(target) {
  if (
    !target ||
    !EXPO_PUSH_TOKEN_PATTERN.test(clean(target.token)) ||
    !normalizedUuid(target.followupId) ||
    !["android", "ios"].includes(target.platform)
  ) {
    throw new MobilePushDeliveryPolicyError("target_invalid");
  }
  return {
    to: clean(target.token),
    title: MOBILE_PUSH_REMINDER_COPY.title,
    body: MOBILE_PUSH_REMINDER_COPY.body,
    ttl: MOBILE_PUSH_REMINDER_TTL_SECONDS,
    data: {
      type: MOBILE_PUSH_REMINDER_COPY.type,
      followupId: normalizedUuid(target.followupId),
    },
    ...(target.platform === "android"
      ? { channelId: MOBILE_PUSH_REMINDER_COPY.channelId }
      : {}),
  };
}

export function mobilePushRetryDelayMs(attemptNumber) {
  if (
    !Number.isInteger(attemptNumber) ||
    attemptNumber < 1 ||
    attemptNumber > MOBILE_PUSH_MAX_ATTEMPTS
  ) {
    throw new MobilePushDeliveryPolicyError("attempt_invalid");
  }
  return MOBILE_PUSH_RETRY_DELAYS_MS[attemptNumber - 1];
}

export function mobilePushReceiptRetryDelayMs(receiptCheckNumber) {
  if (
    !Number.isInteger(receiptCheckNumber) ||
    receiptCheckNumber < 1 ||
    receiptCheckNumber >= MOBILE_PUSH_MAX_RECEIPT_CHECKS
  ) {
    throw new MobilePushDeliveryPolicyError("receipt_check_invalid");
  }
  return MOBILE_PUSH_RECEIPT_RETRY_DELAYS_MS[receiptCheckNumber - 1];
}

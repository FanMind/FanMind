export const FOLLOWUP_NOTIFICATION_TYPE = "followup_reminder";
export const FOLLOWUP_NOTIFICATION_ROUTE = "/(app)/followups";
export const FOLLOWUP_NOTIFICATION_PATHNAME = "/followups";
export const MESSAGE_NOTIFICATION_TYPES = Object.freeze([
  "message_received",
  "message_reminder",
]);
export const MESSAGE_NOTIFICATION_SECTION = "messages";
export const MESSAGE_NOTIFICATION_NAVIGATION_SECTION_PREFIX = "message-view-";
export const MAX_NOTIFICATION_RESPONSE_IDENTIFIER_LENGTH = 256;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isExactObject(value, expectedKeys) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.length === expectedKeys.length &&
    expectedKeys.every((key) => keys.includes(key))
  );
}

function isMessageSection(value) {
  return (
    value === MESSAGE_NOTIFICATION_SECTION ||
    (typeof value === "string" &&
      value.startsWith(MESSAGE_NOTIFICATION_NAVIGATION_SECTION_PREFIX))
  );
}

export function parseFollowupNotificationData(value) {
  if (
    !isExactObject(value, ["type", "followupId"]) ||
    value.type !== FOLLOWUP_NOTIFICATION_TYPE ||
    typeof value.followupId !== "string" ||
    !UUID_PATTERN.test(value.followupId)
  ) {
    return null;
  }

  return {
    type: FOLLOWUP_NOTIFICATION_TYPE,
    followupId: value.followupId,
    route: FOLLOWUP_NOTIFICATION_ROUTE,
    consumePathname: FOLLOWUP_NOTIFICATION_PATHNAME,
  };
}

export function parseMessageNotificationData(value) {
  if (
    !isExactObject(value, ["type", "contactId", "section"]) ||
    !MESSAGE_NOTIFICATION_TYPES.includes(value.type) ||
    typeof value.contactId !== "string" ||
    !UUID_PATTERN.test(value.contactId) ||
    value.section !== MESSAGE_NOTIFICATION_SECTION
  ) {
    return null;
  }

  return {
    type: value.type,
    contactId: value.contactId,
    section: MESSAGE_NOTIFICATION_SECTION,
    route: `/(app)/contacts/${value.contactId}?section=${MESSAGE_NOTIFICATION_SECTION}`,
    consumePathname: `/contacts/${value.contactId}`,
  };
}

export function parseNotificationData(value) {
  return parseFollowupNotificationData(value) ?? parseMessageNotificationData(value);
}

function hasValidResponseEnvelope(value, defaultActionIdentifier) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof defaultActionIdentifier === "string" &&
    value.actionIdentifier === defaultActionIdentifier &&
    typeof value.requestIdentifier === "string" &&
    value.requestIdentifier.length > 0 &&
    value.requestIdentifier.length <= MAX_NOTIFICATION_RESPONSE_IDENTIFIER_LENGTH &&
    !/[\u0000-\u001f\u007f]/u.test(value.requestIdentifier)
  );
}

export function createNotificationIntent(value, defaultActionIdentifier) {
  if (!hasValidResponseEnvelope(value, defaultActionIdentifier)) return null;
  const data = parseNotificationData(value.data);
  if (!data) return null;
  return { ...data, responseIdentifier: value.requestIdentifier };
}

export function createFollowupNotificationIntent(value, defaultActionIdentifier) {
  const intent = createNotificationIntent(value, defaultActionIdentifier);
  return intent?.type === FOLLOWUP_NOTIFICATION_TYPE ? intent : null;
}

export function decideNotificationIntent({
  authLoading,
  hasSession,
  segments,
  pathname,
  currentSection = null,
  navigationIssued = false,
  pendingIntent,
}) {
  if (!pendingIntent || authLoading || !hasSession) return "wait";
  if (!Array.isArray(segments)) return "wait";
  if (segments[0] === "(auth)") return "wait";

  const atDestination =
    typeof pathname === "string" && pathname === pendingIntent.consumePathname;
  if (!atDestination) return "navigate";

  if (pendingIntent.section === MESSAGE_NOTIFICATION_SECTION) {
    if (!navigationIssued || !isMessageSection(currentSection)) return "navigate";
  }

  return "consume";
}

export function decideFollowupNotificationIntent(input) {
  return decideNotificationIntent({
    ...input,
    pathname:
      typeof input?.pathname === "string"
        ? input.pathname
        : Array.isArray(input?.segments) &&
            input.segments[0] === "(app)" &&
            input.segments[1] === "followups"
          ? FOLLOWUP_NOTIFICATION_PATHNAME
          : null,
  });
}
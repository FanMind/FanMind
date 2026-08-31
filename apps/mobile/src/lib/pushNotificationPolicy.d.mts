export const FOLLOWUP_NOTIFICATION_TYPE: "followup_reminder";
export const FOLLOWUP_NOTIFICATION_ROUTE: "/(app)/followups";
export const FOLLOWUP_NOTIFICATION_PATHNAME: "/followups";
export const MESSAGE_NOTIFICATION_TYPES: readonly [
  "message_received",
  "message_reminder",
];
export const MESSAGE_NOTIFICATION_SECTION: "messages";
export const MAX_NOTIFICATION_RESPONSE_IDENTIFIER_LENGTH: number;

export type FollowupNotificationData = {
  type: typeof FOLLOWUP_NOTIFICATION_TYPE;
  followupId: string;
  route: typeof FOLLOWUP_NOTIFICATION_ROUTE;
  consumePathname: typeof FOLLOWUP_NOTIFICATION_PATHNAME;
};

export type MessageNotificationData = {
  type: (typeof MESSAGE_NOTIFICATION_TYPES)[number];
  contactId: string;
  section: typeof MESSAGE_NOTIFICATION_SECTION;
  route: string;
  consumePathname: string;
};

export type NotificationData =
  | FollowupNotificationData
  | MessageNotificationData;

export type FollowupNotificationIntent = FollowupNotificationData & {
  responseIdentifier: string;
};

export type MessageNotificationIntent = MessageNotificationData & {
  responseIdentifier: string;
};

export type NotificationIntent =
  | FollowupNotificationIntent
  | MessageNotificationIntent;

export function parseFollowupNotificationData(
  value: unknown,
): FollowupNotificationData | null;
export function parseMessageNotificationData(
  value: unknown,
): MessageNotificationData | null;
export function parseNotificationData(value: unknown): NotificationData | null;
export function createNotificationIntent(
  value: unknown,
  defaultActionIdentifier: string,
): NotificationIntent | null;
export function createFollowupNotificationIntent(
  value: unknown,
  defaultActionIdentifier: string,
): FollowupNotificationIntent | null;
export function decideNotificationIntent(input: {
  authLoading: boolean;
  hasSession: boolean;
  segments: readonly string[];
  pathname: string | null;
  pendingIntent: NotificationIntent | null;
}): "wait" | "navigate" | "consume";
export function decideFollowupNotificationIntent(input: {
  authLoading: boolean;
  hasSession: boolean;
  segments: readonly string[];
  pathname?: string | null;
  pendingIntent: FollowupNotificationIntent | null;
}): "wait" | "navigate" | "consume";

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  createNotificationIntent,
  type NotificationIntent,
} from "@/lib/pushNotificationPolicy.mjs";

export const FOLLOWUP_NOTIFICATION_CHANNEL_ID = "followup-reminders";
export const MESSAGE_NOTIFICATION_CHANNEL_ID = "message-alerts";

export async function configureNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Promise.all([
    Notifications.setNotificationChannelAsync(
      FOLLOWUP_NOTIFICATION_CHANNEL_ID,
      {
        name: "Follow-up-Erinnerungen",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#149EF2",
      },
    ),
    Notifications.setNotificationChannelAsync(
      MESSAGE_NOTIFICATION_CHANNEL_ID,
      {
        name: "Nachrichten",
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#149EF2",
      },
    ),
  ]);
}

export function parseNotificationResponse(
  response: Notifications.NotificationResponse,
): NotificationIntent | null {
  return createNotificationIntent(
    {
      actionIdentifier: response.actionIdentifier,
      requestIdentifier: response.notification.request.identifier,
      data: response.notification.request.content.data,
    },
    Notifications.DEFAULT_ACTION_IDENTIFIER,
  );
}

export function registerNotificationResponseListener(
  onIntent: (intent: NotificationIntent) => void,
) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const intent = parseNotificationResponse(response);
    if (intent) onIntent(intent);
  });
}

export function getLastNotificationIntent(): NotificationIntent | null {
  const response = Notifications.getLastNotificationResponse();
  return response ? parseNotificationResponse(response) : null;
}

export function clearLastNotificationIntent(): void {
  Notifications.clearLastNotificationResponse();
}

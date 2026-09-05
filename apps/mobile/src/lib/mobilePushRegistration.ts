import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { getMobileEnvironment } from "@/lib/env";
import { configureNotificationChannel } from "@/lib/pushNotifications";

const environment = getMobileEnvironment();

export type MobilePushRegistrationStatus = {
  enabled: boolean;
  platform: "android" | "ios" | null;
  expiresAt: string | null;
  deliveryEnabled: false;
};

type PushResponsePayload = {
  ok?: boolean;
  status?: MobilePushRegistrationStatus;
  error?: string;
};

function headers(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-FanMind-Client": "mobile",
  };
}

function projectId() {
  const easProjectId = Constants.easConfig?.projectId?.trim();
  const configProjectId = (
    Constants.expoConfig?.extra as
      | { eas?: { projectId?: unknown } }
      | undefined
  )?.eas?.projectId;
  const value =
    easProjectId ||
    (typeof configProjectId === "string" ? configProjectId.trim() : "");
  return value || null;
}

async function callPushApi(
  accessToken: string,
  body: Record<string, unknown>,
  timeoutMs = 10_000,
): Promise<{
  status: MobilePushRegistrationStatus | null;
  error: string | null;
}> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `${environment.apiUrl}/api/mobile/push-registration`,
      {
        method: "POST",
        headers: headers(accessToken),
        body: JSON.stringify(body),
        signal: controller.signal,
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | PushResponsePayload
      | null;
    if (!response.ok || !payload?.status) {
      return {
        status: null,
        error:
          payload?.error ??
          "Die Push-Einstellung konnte gerade nicht sicher verarbeitet werden.",
      };
    }
    return { status: payload.status, error: null };
  } catch {
    return {
      status: null,
      error: "FanMind ist gerade nicht erreichbar. Bitte prüfe deine Verbindung.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function getMobilePushRegistrationStatus(accessToken: string) {
  return callPushApi(accessToken, { action: "status" });
}

export async function enableMobilePushRegistration(accessToken: string) {
  const currentProjectId = projectId();
  if (!currentProjectId) {
    return {
      status: null,
      error:
        "Der signierte FanMind-Build ist noch nicht mit dem freigegebenen EAS-Projekt verbunden.",
    };
  }
  if (Platform.OS !== "android" && Platform.OS !== "ios") {
    return {
      status: null,
      error: "Push-Erinnerungen sind nur in der nativen Android-/iOS-App verfügbar.",
    };
  }

  try {
    await configureNotificationChannel();
  } catch {
    return {
      status: null,
      error:
        "Die lokalen Benachrichtigungskanäle konnten auf diesem Gerät nicht vorbereitet werden.",
    };
  }

  let permissions = await Notifications.getPermissionsAsync().catch(() => null);
  if (!permissions) {
    return {
      status: null,
      error: "Der Benachrichtigungsstatus des Geräts konnte nicht gelesen werden.",
    };
  }
  if (permissions.status !== "granted") {
    permissions = await Notifications.requestPermissionsAsync().catch(() => null);
  }
  if (!permissions || permissions.status !== "granted") {
    return {
      status: null,
      error:
        "Push-Erinnerungen wurden nicht erlaubt. Du kannst die Freigabe später erneut in den Geräteeinstellungen erteilen.",
    };
  }

  let devicePushToken: Notifications.DevicePushToken;
  try {
    devicePushToken = await Notifications.getDevicePushTokenAsync();
  } catch {
    return {
      status: null,
      error:
        Platform.OS === "android"
          ? "Android-Push ist in diesem Build noch nicht vollständig mit Firebase/FCM verbunden."
          : "Für dieses Gerät konnte noch kein nativer Push-Token bezogen werden.",
    };
  }

  let token: Notifications.ExpoPushToken;
  try {
    token = await Notifications.getExpoPushTokenAsync({
      projectId: currentProjectId,
      devicePushToken,
    });
  } catch {
    return {
      status: null,
      error:
        "Der native Push-Token konnte noch nicht sicher beim FanMind-EAS-Projekt registriert werden.",
    };
  }

  return callPushApi(accessToken, {
    action: "register",
    token: token.data,
    projectId: currentProjectId,
    platform: Platform.OS,
  });
}

export function disableMobilePushRegistration(accessToken: string) {
  return callPushApi(accessToken, { action: "unregister" });
}

export async function bestEffortDisableMobilePushRegistration(
  accessToken: string,
) {
  await callPushApi(accessToken, { action: "unregister" }, 1_500).catch(
    () => undefined,
  );
}

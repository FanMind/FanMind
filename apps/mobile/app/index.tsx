import { Redirect } from "expo-router";

import { LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useNotificationIntent } from "@/providers/NotificationIntentProvider";

export default function IndexRoute() {
  const { session, loading } = useAuth();
  const { pendingIntent } = useNotificationIntent();
  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Sichere FanMind-Sitzung wird geladen…" />
      </Screen>
    );
  }
  return (
    <Redirect
      href={
        session
          ? pendingIntent?.route ?? "/(app)"
          : "/(auth)/login"
      }
    />
  );
}

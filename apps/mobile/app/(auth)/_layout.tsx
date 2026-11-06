import { Redirect, Stack, useSegments } from "expo-router";

import { isPasswordRecoverySegments } from "@/lib/authRecoveryPolicy.mjs";
import { useAuth } from "@/providers/AuthProvider";
import { useNotificationIntent } from "@/providers/NotificationIntentProvider";

export default function AuthLayout() {
  const { session, loading } = useAuth();
  const { pendingIntent } = useNotificationIntent();
  const segments = useSegments();
  const passwordRecovery = isPasswordRecoverySegments(segments);

  if (!loading && session && !passwordRecovery) {
    return <Redirect href={pendingIntent?.route ?? "/(app)"} />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}

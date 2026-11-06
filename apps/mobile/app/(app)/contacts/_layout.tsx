import { Stack } from "expo-router";

import { colors } from "@/theme/tokens";

export default function ContactsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}

import { Redirect, Tabs } from "expo-router";
import { Text } from "react-native";

import { LoadingState, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, typography } from "@/theme/tokens";

function TabGlyph({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text
      style={{
        color: focused ? colors.cyan : colors.textMuted,
        fontSize: typography.micro,
        fontWeight: "900",
      }}
    >
      {label}
    </Text>
  );
}

export default function AppLayout() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingState />
      </Screen>
    );
  }
  if (!session) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cyan,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: "absolute",
          height: 74,
          paddingTop: 8,
          paddingBottom: 10,
          backgroundColor: "rgba(5, 20, 43, 0.98)",
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Start",
          tabBarIcon: ({ focused }) => <TabGlyph label="01" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: "Kontakte",
          tabBarIcon: ({ focused }) => <TabGlyph label="02" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="followups"
        options={{
          title: "Follow-ups",
          tabBarIcon: ({ focused }) => <TabGlyph label="03" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Konto",
          tabBarIcon: ({ focused }) => <TabGlyph label="04" focused={focused} />,
        }}
      />
      <Tabs.Screen name="account-deletion" options={{ href: null }} />
    </Tabs>
  );
}

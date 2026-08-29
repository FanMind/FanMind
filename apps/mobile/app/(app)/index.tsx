import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import {
  Card,
  EmptyState,
  LoadingState,
  Screen,
  SecondaryButton,
  SectionTitle,
  StatusPill,
  mobileStyles,
} from "@/components/ui";
import { messagePlatformLabel } from "@/lib/contactMessageChannelPolicy.mjs";
import {
  listTodaysFollowups,
  listUnseenInboundFans,
  loadDashboardCounts,
} from "@/lib/data";
import { addLocalDaysDate } from "@/lib/localDate";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import type { DashboardUnreadFan, Followup } from "@/types";

function formatMessageTime(value: string | null): string {
  if (!value) return "Zeit unbekannt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Zeit unbekannt";
  return new Intl.DateTimeFormat("de-AT", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function UnreadFanRow({ fan }: { fan: DashboardUnreadFan }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${fan.display_name}, ${fan.unread_count} neue Nachrichten`}
      onPress={() => router.push(`/(app)/contacts/${fan.id}`)}
      style={({ pressed }) => [styles.fanRow, pressed && styles.pressed]}
    >
      <View style={styles.unreadDot} />
      <View style={styles.fanText}>
        <View style={styles.fanTitleRow}>
          <Text style={styles.fanName}>{fan.display_name}</Text>
          <StatusPill tone="accent">{fan.unread_count} neu</StatusPill>
        </View>
        <Text style={styles.fanHandle}>{fan.handle || "ohne Handle"}</Text>
        <Text style={styles.fanMeta}>
          {messagePlatformLabel(fan.latest_source_platform)} · {formatMessageTime(fan.latest_message_at)}
        </Text>
      </View>
    </Pressable>
  );
}

function TodayFollowupRow({ item }: { item: Followup }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Heutiges Follow-up für ${item.contact?.display_name || "Kontakt"}`}
      onPress={() =>
        router.push(`/(app)/contacts/${item.contact_id}?section=followups`)
      }
      style={({ pressed }) => [styles.todayFollowupRow, pressed && styles.pressed]}
    >
      <View style={styles.todayFollowupText}>
        <Text style={styles.fanName}>{item.contact?.display_name || "Kontakt"}</Text>
        <Text style={mobileStyles.body}>{item.reason}</Text>
      </View>
      <StatusPill tone="warning">Heute</StatusPill>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const { workspace, loading: workspaceLoading, error, refresh: refreshWorkspace } =
    useWorkspace();
  const [fans, setFans] = useState<DashboardUnreadFan[]>([]);
  const [openFollowups, setOpenFollowups] = useState(0);
  const [todayFollowups, setTodayFollowups] = useState<Followup[]>([]);
  const [todayFollowupCount, setTodayFollowupCount] = useState(0);
  const [todayFollowupsTruncated, setTodayFollowupsTruncated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!workspace?.id) {
      setFans([]);
      setOpenFollowups(0);
      setTodayFollowups([]);
      setTodayFollowupCount(0);
      setTodayFollowupsTruncated(false);
      setDashboardError(null);
      return;
    }

    setLoading(true);
    const [fansResult, countsResult, todayResult] = await Promise.all([
      listUnseenInboundFans(workspace.id),
      loadDashboardCounts(workspace.id),
      listTodaysFollowups(workspace.id, addLocalDaysDate(0)),
    ]);
    setFans(fansResult.fans);
    setOpenFollowups(countsResult.followups);
    setTodayFollowups(todayResult.followups);
    setTodayFollowupCount(todayResult.totalCount);
    setTodayFollowupsTruncated(todayResult.truncated);
    setDashboardError(fansResult.error ?? countsResult.error ?? todayResult.error);
    setLoading(false);
  }, [workspace?.id]);

  const refresh = useCallback(async () => {
    await refreshWorkspace();
    await load();
  }, [load, refreshWorkspace]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (workspaceLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Workspace wird geladen…" />
      </Screen>
    );
  }

  if (!workspace) {
    return (
      <Screen title="FanMind App" subtitle="Eigener mobiler Arbeitsbereich">
        <EmptyState
          title="Noch kein Workspace"
          description={error ?? "Schließe das FanMind-Onboarding zuerst im Web ab."}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title="Neue Nachrichten"
      subtitle={`Hallo in ${workspace.name}`}
      right={
        <SecondaryButton disabled={loading} onPress={() => void refresh()}>
          {loading ? "Lädt…" : "Aktualisieren"}
        </SecondaryButton>
      }
    >
      <View style={styles.kpiGrid}>
        <Card style={styles.kpiCard}>
          <Text style={styles.kpiValue}>{loading ? "…" : fans.length}</Text>
          <Text style={styles.kpiLabel}>Fans mit Neuigkeiten</Text>
        </Card>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push("/(app)/followups")}
          style={({ pressed }) => [styles.followupKpi, pressed && styles.pressed]}
        >
          <Text style={styles.kpiValue}>{loading ? "…" : openFollowups}</Text>
          <Text style={styles.kpiLabel}>Offene Follow-ups</Text>
        </Pressable>
      </View>

      <View style={styles.sectionHeader}>
        <SectionTitle eyebrow="Inbox">Fans mit ungelesenen Nachrichten</SectionTitle>
        <StatusPill tone="good">Nur eingehend</StatusPill>
      </View>
      {dashboardError ? <Text style={mobileStyles.error}>{dashboardError}</Text> : null}
      {loading && !fans.length ? (
        <LoadingState label="Neue Nachrichten werden geladen…" />
      ) : fans.length ? (
        <View style={styles.fanList}>
          {fans.map((fan) => <UnreadFanRow key={fan.id} fan={fan} />)}
        </View>
      ) : (
        <EmptyState
          title="Keine neuen Nachrichten"
          description="Hier erscheinen ausschließlich Fans mit noch nicht gesehenen eingehenden Nachrichten."
        />
      )}

      <View style={styles.sectionHeader}>
        <SectionTitle eyebrow="Heute">Fällige Follow-ups</SectionTitle>
        <StatusPill tone={todayFollowupCount ? "warning" : "good"}>
          {todayFollowupCount}
        </StatusPill>
      </View>
      {todayFollowups.length ? (
        <View style={styles.fanList}>
          {todayFollowups.slice(0, 20).map((item) => (
            <TodayFollowupRow key={item.id} item={item} />
          ))}
          {todayFollowupCount > 20 || todayFollowupsTruncated ? (
            <Text style={mobileStyles.muted}>
              Die wichtigsten 20 von {todayFollowupCount} heutigen Follow-ups werden hier angezeigt.
              Öffne die zentrale Follow-up-Liste für die weitere Bearbeitung.
            </Text>
          ) : null}
          {todayFollowupCount > 20 ? (
            <SecondaryButton onPress={() => router.push("/(app)/followups")}>
              Alle Follow-ups öffnen
            </SecondaryButton>
          ) : null}
        </View>
      ) : (
        <EmptyState
          title="Heute nichts fällig"
          description="Für heute sind keine offenen Follow-ups geplant."
        />
      )}

      <Text style={mobileStyles.muted}>
        Sobald du einen Fan öffnest, gelten dessen eingehende Nachrichten für den Workspace-Owner als gesehen.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: "row", gap: spacing.md },
  kpiCard: { flex: 1, minHeight: 125, justifyContent: "center" },
  followupKpi: {
    flex: 1,
    minHeight: 125,
    justifyContent: "center",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  kpiValue: {
    color: colors.cyan,
    fontSize: 36,
    fontWeight: "900",
    letterSpacing: -1,
  },
  kpiLabel: { color: colors.textMuted, fontSize: typography.small, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  fanList: { gap: spacing.md },
  fanRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  pressed: { opacity: 0.72 },
  unreadDot: {
    width: 11,
    height: 11,
    marginTop: 7,
    borderRadius: 6,
    backgroundColor: colors.cyan,
  },
  fanText: { flex: 1, gap: spacing.xs },
  fanTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  fanName: { flex: 1, color: colors.text, fontSize: typography.body, fontWeight: "900" },
  fanHandle: { color: colors.textMuted, fontSize: typography.small },
  fanMeta: { color: colors.cyan, fontSize: typography.micro, fontWeight: "700" },
  todayFollowupRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  todayFollowupText: { flex: 1, gap: spacing.xs },
});

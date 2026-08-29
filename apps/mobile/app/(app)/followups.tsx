import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  EmptyState,
  LoadingState,
  Screen,
  StatusPill,
  mobileStyles,
} from "@/components/ui";
import { completeFollowup, listFollowups } from "@/lib/data";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import type { Followup } from "@/types";

function dueLabel(value: string | null): { label: string; tone: "neutral" | "warning" | "danger" } {
  if (!value) return { label: "ohne Datum", tone: "neutral" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return { label: value, tone: "neutral" };
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)} Tag(e) überfällig`, tone: "danger" };
  if (diff === 0) return { label: "heute", tone: "warning" };
  if (diff === 1) return { label: "morgen", tone: "warning" };
  return { label: `in ${diff} Tagen`, tone: "neutral" };
}

function FollowupRow({
  item,
  onComplete,
  busy,
  readOnly,
  onOpen,
}: {
  item: Followup;
  onComplete: () => void;
  busy: boolean;
  readOnly: boolean;
  onOpen: () => void;
}) {
  const due = dueLabel(item.due_date);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.contact?.display_name || "Kontakt"} öffnen`}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.contact}>{item.contact?.display_name || "Kontakt"}</Text>
          <Text style={styles.handle}>{item.contact?.handle || "ohne Handle"}</Text>
        </View>
        <StatusPill tone={due.tone}>{due.label}</StatusPill>
      </View>
      <Text style={mobileStyles.body}>{item.reason}</Text>
      <View style={styles.rowFooter}>
        <StatusPill>{item.priority || "normal"}</StatusPill>
        {readOnly ? (
          <StatusPill tone="warning">Nur lesen</StatusPill>
        ) : (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              onComplete();
            }}
            disabled={busy}
            style={({ pressed }) => [
              styles.completeButton,
              pressed && { opacity: 0.7 },
              busy && { opacity: 0.45 },
            ]}
          >
            <Text style={styles.completeText}>{busy ? "Speichert…" : "Erledigt"}</Text>
          </Pressable>
        )}
      </View>
      <Text style={styles.openContact}>Fan öffnen →</Text>
    </Pressable>
  );
}

export default function FollowupsScreen() {
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (!workspace?.id) {
        setFollowups([]);
        setError(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      refresh ? setRefreshing(true) : setLoading(true);
      const result = await listFollowups(workspace.id);
      setFollowups(result.followups);
      setError(result.error);
      setLoading(false);
      setRefreshing(false);
    },
    [workspace?.id],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function complete(item: Followup) {
    if (!workspace?.id || workspace.role !== "owner") return;
    setBusyId(item.id);
    const result = await completeFollowup(workspace.id, item.id, workspace.role);
    setError(result);
    if (!result) await load();
    setBusyId(null);
  }

  if (workspaceLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Follow-ups werden geladen…" />
      </Screen>
    );
  }

  if (!workspace) {
    return (
      <Screen
        title="Follow-ups"
        subtitle="Offene Aufgaben und Rückmeldungen auf einen Blick"
      >
        <EmptyState
          title="Noch kein Workspace"
          description={
            workspaceError ??
            "Schließe zuerst das FanMind-Onboarding ab, damit Follow-ups geladen werden können."
          }
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Follow-ups werden geladen…" />
      </Screen>
    );
  }

  return (
    <Screen
      title="Follow-ups"
      subtitle="Offene Aufgaben und Rückmeldungen auf einen Blick"
      scroll={false}
    >
      {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
      <FlatList
        data={followups}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FollowupRow
            item={item}
            busy={busyId === item.id}
            readOnly={workspace.role !== "owner"}
            onComplete={() => void complete(item)}
            onOpen={() =>
              router.push(`/(app)/contacts/${item.contact_id}?section=followups`)
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            tintColor={colors.cyan}
          />
        }
        ListEmptyComponent={
          <EmptyState
            title="Keine offenen Follow-ups"
            description="Neue Follow-ups kannst du direkt im Fan-Detail oder aus einem KI-Vorschlag speichern."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 110 },
  row: {
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  rowPressed: { opacity: 0.72 },
  rowHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  contact: { color: colors.text, fontSize: typography.body, fontWeight: "900" },
  handle: { color: colors.textMuted, fontSize: typography.small },
  rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  completeButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.green,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  completeText: { color: colors.background, fontWeight: "900", fontSize: typography.small },
  openContact: { color: colors.cyan, fontSize: typography.small, fontWeight: "800" },
});

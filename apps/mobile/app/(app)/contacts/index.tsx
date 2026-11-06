import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  EmptyState,
  LoadingState,
  Screen,
  SecondaryButton,
  StatusPill,
  mobileStyles,
} from "@/components/ui";
import {
  createContactLoadSequence,
  resolveContactLoadTarget,
} from "@/lib/contactRefreshPolicy.mjs";
import { listContacts } from "@/lib/data";
import {
  readOfflineReadCache,
  removeOfflineReadCache,
  writeOfflineReadCache,
} from "@/lib/offlineReadCache";
import {
  OFFLINE_READ_CACHE_MAX_AGE_MS,
  filterOfflineContacts,
} from "@/lib/offlineReadCachePolicy.mjs";
import { useAuth } from "@/providers/AuthProvider";
import {
  useWorkspace,
  type WorkspaceRefreshResult,
} from "@/providers/WorkspaceProvider";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import type { ContactListItem } from "@/types";

function formatCachedAt(value: number | null): string {
  if (!value) return "unbekannt";
  return new Date(value).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ContactRow({
  contact,
  disabled,
}: {
  contact: ContactListItem;
  disabled: boolean;
}) {
  const platform = contact.source_platform || "manuell";
  return (
    <Pressable
      onPress={() => router.push(`/(app)/contacts/${contact.id}`)}
      disabled={disabled}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={
        disabled
          ? `${contact.display_name}, offline gespeichert`
          : `${contact.display_name} öffnen`
      }
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{contact.display_name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.name}>{contact.display_name}</Text>
        <Text style={styles.meta} numberOfLines={1}>
          {contact.handle || "ohne Handle"} · {platform}
        </Text>
        {contact.summary ? (
          <Text style={styles.summary} numberOfLines={2}>
            {contact.summary}
          </Text>
        ) : null}
      </View>
      <StatusPill tone={contact.status === "vip" ? "accent" : "neutral"}>
        {contact.status || "neu"}
      </StatusPill>
    </Pressable>
  );
}

export default function ContactsScreen() {
  const { session } = useAuth();
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
    refresh: refreshWorkspace,
    transportUnavailable,
  } = useWorkspace();
  const [contacts, setContacts] = useState<ContactListItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usingCache, setUsingCache] = useState(false);
  const [contactTransportUnavailable, setContactTransportUnavailable] =
    useState(false);
  const [cachedAt, setCachedAt] = useState<number | null>(null);
  const [cachedWorkspaceName, setCachedWorkspaceName] = useState<string | null>(
    null,
  );
  const loadSequence = useRef(createContactLoadSequence());
  const cachedContacts = useRef<ContactListItem[]>([]);

  const load = useCallback(
    async (
      isRefresh = false,
      refreshResult?: WorkspaceRefreshResult,
    ) => {
      const userId = session?.user.id;
      if (!userId) {
        loadSequence.current.invalidate();
        setContacts([]);
        setError(null);
        setUsingCache(false);
        setContactTransportUnavailable(false);
        setCachedAt(null);
        setCachedWorkspaceName(null);
        cachedContacts.current = [];
        setLoading(false);
        setRefreshing(false);
        return;
      }

      isRefresh ? setRefreshing(true) : setLoading(true);
      if (usingCache && !isRefresh) {
        setContacts(filterOfflineContacts(cachedContacts.current, search));
        setLoading(false);
        setRefreshing(false);
        return;
      }
      const sequence = loadSequence.current.begin();
      const {
        workspace: activeWorkspace,
        transportUnavailable: activeTransportUnavailable,
      } = resolveContactLoadTarget(
        { workspace, transportUnavailable },
        refreshResult,
      );

      if (!activeWorkspace?.id) {
        if (activeTransportUnavailable) {
          const cached = await readOfflineReadCache(userId);
          if (!loadSequence.current.isCurrent(sequence)) return;
          if (cached) {
            cachedContacts.current = cached.contacts;
            setContacts(filterOfflineContacts(cached.contacts, search));
            setError(null);
            setUsingCache(true);
            setContactTransportUnavailable(true);
            setCachedAt(cached.cachedAt);
            setCachedWorkspaceName(cached.workspaceName);
          } else {
            cachedContacts.current = [];
            setContacts([]);
            setError("FanMind ist offline und es ist noch kein gültiger Kontaktstand gespeichert.");
            setUsingCache(false);
            setContactTransportUnavailable(true);
            setCachedAt(null);
            setCachedWorkspaceName(null);
          }
        } else {
          void removeOfflineReadCache(userId);
          cachedContacts.current = [];
          setContacts([]);
          setError(null);
          setUsingCache(false);
          setContactTransportUnavailable(false);
          setCachedAt(null);
          setCachedWorkspaceName(null);
        }
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const result = await listContacts(activeWorkspace.id, search);
      if (!loadSequence.current.isCurrent(sequence)) return;

      if (!result.error) {
        cachedContacts.current = [];
        setContacts(result.contacts);
        setError(null);
        setUsingCache(false);
        setContactTransportUnavailable(false);
        setCachedAt(null);
        setCachedWorkspaceName(null);
        if (!search.trim()) {
          void writeOfflineReadCache({
            userId,
            workspaceId: activeWorkspace.id,
            workspaceName: activeWorkspace.name,
            contacts: result.contacts,
            accessExpiresAt:
              activeWorkspace.test_access_flags?.temporary_processing_access === true
                ? String(activeWorkspace.test_access_flags.temporary_processing_access_expires_at ?? "")
                : null,
          });
        }
      } else if (result.offlineEligible) {
        const cached = await readOfflineReadCache(userId, activeWorkspace.id);
        if (!loadSequence.current.isCurrent(sequence)) return;
        if (cached) {
          cachedContacts.current = cached.contacts;
          setContacts(filterOfflineContacts(cached.contacts, search));
          setError(null);
          setUsingCache(true);
          setContactTransportUnavailable(true);
          setCachedAt(cached.cachedAt);
          setCachedWorkspaceName(cached.workspaceName);
        } else {
          cachedContacts.current = [];
          setContacts([]);
          setError(result.error);
          setUsingCache(false);
          setContactTransportUnavailable(true);
          setCachedAt(null);
          setCachedWorkspaceName(null);
        }
      } else {
        void removeOfflineReadCache(userId);
        cachedContacts.current = [];
        setContacts([]);
        setError(result.error);
        setUsingCache(false);
        setContactTransportUnavailable(false);
        setCachedAt(null);
        setCachedWorkspaceName(null);
      }
      setLoading(false);
      setRefreshing(false);
    },
    [
      search,
      session?.user.id,
      transportUnavailable,
      usingCache,
      workspace?.id,
      workspace?.name,
    ],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!usingCache || cachedAt === null) return;
    const userId = session?.user.id;
    const expiresAt = cachedAt + OFFLINE_READ_CACHE_MAX_AGE_MS;
    const expireCachedView = () => {
      if (Date.now() < expiresAt) return;
      loadSequence.current.invalidate();
      cachedContacts.current = [];
      setContacts([]);
      setError(
        "Der gespeicherte Kontaktstand ist abgelaufen. Stelle eine Verbindung her, um ihn zu erneuern.",
      );
      setUsingCache(false);
      setContactTransportUnavailable(true);
      setCachedAt(null);
      setCachedWorkspaceName(null);
      if (userId) void removeOfflineReadCache(userId);
    };
    const expiryTimer = setTimeout(
      expireCachedView,
      Math.max(0, expiresAt - Date.now()),
    );
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") expireCachedView();
    });
    expireCachedView();
    return () => {
      clearTimeout(expiryTimer);
      appStateSubscription.remove();
    };
  }, [cachedAt, session?.user.id, usingCache]);

  const refreshOnline = useCallback(async () => {
    setRefreshing(true);
    const result = await refreshWorkspace();
    if (!result) {
      setRefreshing(false);
      return;
    }
    await load(true, result);
  }, [load, refreshWorkspace]);

  if (workspaceLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Kontakte werden geladen…" />
      </Screen>
    );
  }

  if (!workspace && transportUnavailable && loading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Gespeicherter Kontaktstand wird geprüft…" />
      </Screen>
    );
  }

  if (!workspace && !usingCache) {
    const offlineUnavailable = transportUnavailable || contactTransportUnavailable;
    return (
      <Screen
        title="Kontakte"
        subtitle={
          offlineUnavailable
            ? "Offline-Kontaktübersicht nicht verfügbar"
            : "Suche, öffne und verstehe deinen Fan-Kontext"
        }
      >
        <EmptyState
          title={offlineUnavailable ? "Keine gültigen Offline-Daten" : "Noch kein Workspace"}
          description={
            error ??
            workspaceError ??
            "Schließe zuerst das FanMind-Onboarding ab, damit Kontakte geladen werden können."
          }
        />
      </Screen>
    );
  }

  const offlineReadOnly = usingCache || contactTransportUnavailable;
  const memberReadOnly = workspace?.role !== "owner";
  const mutationReadOnly = offlineReadOnly || memberReadOnly;

  return (
    <Screen
      title="Kontakte"
      subtitle={
        cachedWorkspaceName
          ? `Gespeicherter Stand für ${cachedWorkspaceName}`
          : "Suche, öffne und verstehe deinen Fan-Kontext"
      }
      scroll={false}
      right={
        <SecondaryButton
          disabled={mutationReadOnly}
          onPress={() => router.push("/(app)/contacts/new")}
        >
          Neu
        </SecondaryButton>
      }
    >
      {usingCache ? (
        <View style={styles.offlineBanner}>
          <StatusPill tone="warning">Offline · nur lesen</StatusPill>
          <Text style={mobileStyles.muted}>
            Stand {formatCachedAt(cachedAt)} Uhr. Bis zu 50 zuletzt geladene Kontakte sind lokal
            geschützt verfügbar. Details und Änderungen bleiben bis zur nächsten Verbindung
            gesperrt.
          </Text>
        </View>
      ) : contactTransportUnavailable ? (
        <View style={styles.offlineBanner}>
          <StatusPill tone="warning">Offline · keine lokalen Daten</StatusPill>
          <Text style={mobileStyles.muted}>
            Es ist kein gültiger gespeicherter Kontaktstand verfügbar. Stelle eine Verbindung
            her, um die Kontaktübersicht zu laden. Änderungen bleiben bis dahin gesperrt.
          </Text>
        </View>
      ) : memberReadOnly ? (
        <View style={styles.offlineBanner}>
          <StatusPill tone="warning">Teamzugang · nur lesen</StatusPill>
          <Text style={mobileStyles.muted}>
            Kontakte und Kontaktwissen bleiben sichtbar. Anlegen und Bearbeiten
            sind bis zu einem atomaren Datenbankvertrag deaktiviert.
          </Text>
        </View>
      ) : null}
      <TextInput
        value={search}
        onChangeText={(value) => {
          loadSequence.current.updateSearch(value);
          setSearch(value);
        }}
        placeholder={
          offlineReadOnly
            ? "Name, Handle oder Plattform suchen"
            : "Name, Handle, Plattform oder Zusammenfassung suchen"
        }
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        style={mobileStyles.input}
        accessibilityLabel="Kontakte suchen"
      />
      {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
      {loading ? (
        <LoadingState label="Kontakte werden geladen…" />
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ContactRow contact={item} disabled={offlineReadOnly} />
          )}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void refreshOnline();
              }}
              tintColor={colors.cyan}
            />
          }
          ListEmptyComponent={
            <EmptyState
              title="Keine Kontakte gefunden"
              description={
                search
                  ? "Passe deine Suche an."
                  : offlineReadOnly
                    ? "Im letzten gespeicherten Stand sind keine Kontakte enthalten."
                    : "Lege den ersten Kontakt direkt in der App an."
              }
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 110 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  rowPressed: { opacity: 0.72, transform: [{ scale: 0.995 }] },
  rowDisabled: { opacity: 0.72 },
  offlineBanner: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.amber,
    borderRadius: radius.md,
    backgroundColor: "rgba(255, 189, 89, 0.08)",
    padding: spacing.md,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: "rgba(100, 230, 255, 0.16)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.cyan, fontWeight: "900" },
  rowText: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: typography.body, fontWeight: "900" },
  meta: { color: colors.textMuted, fontSize: typography.small },
  summary: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 18,
    marginTop: 3,
  },
});

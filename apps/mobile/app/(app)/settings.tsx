import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import {
  BrandMark,
  Card,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  StatusPill,
  mobileStyles,
} from "@/components/ui";
import {
  disableMobilePushRegistration,
  enableMobilePushRegistration,
  getMobilePushRegistrationStatus,
  type MobilePushRegistrationStatus,
} from "@/lib/mobilePushRegistration";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { colors, spacing, typography } from "@/theme/tokens";

export default function SettingsScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushStatus, setPushStatus] =
    useState<MobilePushRegistrationStatus | null>(null);

  const loadPushStatus = useCallback(async () => {
    const accessToken = session?.access_token;
    if (!accessToken) return;
    setPushError(null);
    const result = await getMobilePushRegistrationStatus(accessToken);
    if (result.status) setPushStatus(result.status);
    else setPushError(result.error);
  }, [session?.access_token]);

  useEffect(() => {
    void loadPushStatus();
  }, [loadPushStatus]);

  async function enablePush() {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setPushError("Bitte melde dich erneut an.");
      return;
    }
    setPushBusy(true);
    setPushError(null);
    const result = await enableMobilePushRegistration(accessToken);
    if (result.status) setPushStatus(result.status);
    else setPushError(result.error);
    setPushBusy(false);
  }

  async function disablePush() {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setPushError("Bitte melde dich erneut an.");
      return;
    }
    setPushBusy(true);
    setPushError(null);
    const result = await disableMobilePushRegistration(accessToken);
    if (result.status) setPushStatus(result.status);
    else setPushError(result.error);
    setPushBusy(false);
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      await signOut();
    } catch (logoutError) {
      setError(logoutError instanceof Error ? logoutError.message : "Abmeldung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen title="Konto" subtitle="Sitzung, Workspace und App-Grenzen">
      <BrandMark />
      <Card>
        <SectionTitle eyebrow="Angemeldet">Deine App-Sitzung</SectionTitle>
        <View style={styles.detailRow}>
          <Text style={styles.label}>E-Mail</Text>
          <Text style={styles.value}>{session?.user.email || "nicht verfügbar"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Workspace</Text>
          <Text style={styles.value}>{workspace?.name || "nicht geladen"}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.label}>Rolle</Text>
          <StatusPill tone="accent">{workspace?.role || "offen"}</StatusPill>
        </View>
      </Card>

      <Card>
        <SectionTitle eyebrow="Unabhängigkeit">App und Website sind getrennt</SectionTitle>
        <Text style={mobileStyles.body}>
          Änderungen an Landingpage, Website-Navigation oder Web-CSS verändern diese App nicht.
          Die App hat eigene Releases, eigene Navigation und eigene mobile Komponenten.
        </Text>
        <Text style={mobileStyles.muted}>
          Gemeinsam verwendet werden ausschließlich die freigegebene FanMind-Produktlogik, das
          RLS-geschützte Supabase-Datenmodell und serverseitige KI-Endpunkte.
        </Text>
      </Card>

      <Card>
        <SectionTitle eyebrow="Sicherheit">Harte Grenzen</SectionTitle>
        <Text style={mobileStyles.muted}>• Kein Service-Role-Key in der App</Text>
        <Text style={mobileStyles.muted}>• Kein OpenAI-Key in der App</Text>
        <Text style={mobileStyles.muted}>• Keine automatische Sendefunktion</Text>
        <Text style={mobileStyles.muted}>• Keine eingebettete Website als Haupt-App</Text>
      </Card>

      <Card>
        <View style={mobileStyles.rowBetween}>
          <SectionTitle eyebrow="Beta-Vorbereitung">
            Follow-up-Push
          </SectionTitle>
          <StatusPill tone={pushStatus?.enabled ? "good" : "neutral"}>
            {pushStatus?.enabled ? "Gerät registriert" : "Nicht aktiv"}
          </StatusPill>
        </View>
        <Text style={mobileStyles.body}>
          Push wird nur nach deiner ausdrücklichen Freigabe vorbereitet. FanMind
          speichert das Geräte-Token ausschließlich verschlüsselt und bindet es an
          dein angemeldetes Konto.
        </Text>
        <Text style={mobileStyles.muted}>
          Die serverseitige Zustellung ist noch deaktiviert, bis ein signierter
          Build, Staging und echte Android-/iOS-Gerätetests abgenommen sind. Es
          werden keine Nachrichten an Kontakte gesendet.
        </Text>
        {pushError ? <Text style={mobileStyles.error}>{pushError}</Text> : null}
        {pushStatus?.enabled ? (
          <SecondaryButton
            disabled={pushBusy}
            onPress={() => void disablePush()}
          >
            Push-Registrierung entfernen
          </SecondaryButton>
        ) : (
          <PrimaryButton
            busy={pushBusy}
            onPress={() => void enablePush()}
          >
            Push auf diesem Gerät vorbereiten
          </PrimaryButton>
        )}
      </Card>

      <Card>
        <SectionTitle eyebrow="Lokale Daten">Sicheres Abmelden</SectionTitle>
        <Text style={mobileStyles.muted}>
          Beim Abmelden beendet FanMind die lokale Supabase-Sitzung, entfernt alle registrierten
          FanMind-Schlüssel aus SecureStore und leert den geladenen Workspace-Zustand. Dazu gehört
          auch die verschlüsselte, höchstens 24 Stunden alte Offline-Kontaktübersicht. Kontaktwissen,
          Nachrichten, KI-Inhalte und interne Notizen werden nicht offline gespeichert.
        </Text>
      </Card>

      <Card style={styles.dangerCard}>
        <SectionTitle eyebrow="Datenschutz">Account und Daten löschen</SectionTitle>
        <Text style={mobileStyles.muted}>
          Leite die vollständige Löschung des FanMind-Logins und der zugehörigen
          nicht aufbewahrungspflichtigen Daten ein. Dieser Prozess ist von einer
          Abo-Kündigung getrennt, zeigt den Bearbeitungsstatus und ist leicht
          auffindbar, ohne Support-E-Mail oder Telefonanruf.
        </Text>
        <SecondaryButton onPress={() => router.push("/(app)/account-deletion")}>
          Vollständige Account-Löschung verwalten
        </SecondaryButton>
      </Card>

      {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
      <PrimaryButton busy={busy} onPress={() => void logout()}>
        Sicher abmelden und lokale Daten entfernen
      </PrimaryButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: { color: colors.textMuted, fontSize: typography.small },
  value: { flex: 1, color: colors.text, fontSize: typography.small, fontWeight: "800", textAlign: "right" },
  dangerCard: { borderColor: colors.red },
});

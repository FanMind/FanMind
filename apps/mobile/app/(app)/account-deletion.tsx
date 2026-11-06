import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import {
  Card,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  StatusPill,
  mobileStyles,
} from "@/components/ui";
import {
  cancelAccountDeletion,
  getAccountDeletionStatus,
  requestAccountDeletion,
  type AccountDeletionRequestStatus,
} from "@/lib/accountDeletion";
import {
  MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE,
  MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE,
  MOBILE_ACCOUNT_DELETION_PROCESSING_DAYS,
  validateMobileAccountDeletionCancellation,
  validateMobileAccountDeletionConfirmation,
} from "@/lib/accountDeletionPolicy.mjs";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { colors, radius, spacing, typography } from "@/theme/tokens";

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
}

function statusLabel(status: string) {
  if (status === "pending") return "Aufgenommen";
  if (status === "blocked") return "Klärung erforderlich";
  if (status === "processing") return "In Bearbeitung";
  return status === "none" ? "Keine aktive Anfrage" : "Wird geprüft";
}

function statusTone(status: string): "neutral" | "warning" | "danger" | "accent" {
  if (status === "blocked") return "warning";
  if (status === "processing") return "accent";
  if (status === "pending") return "danger";
  return "neutral";
}

export default function AccountDeletionScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { workspace } = useWorkspace();
  const [request, setRequest] = useState<AccountDeletionRequestStatus>({
    status: "none",
    cancellable: false,
  });
  const [emailConfirmation, setEmailConfirmation] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [cancelConfirmation, setCancelConfirmation] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const accountEmail = session?.user.email ?? "";
  const accessToken = session?.access_token ?? "";
  const hasActiveRequest = useMemo(
    () => ["pending", "blocked", "processing"].includes(request.status),
    [request.status],
  );

  const loadStatus = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    const result = await getAccountDeletionStatus(accessToken);
    if (result.error || !result.request) {
      setError(result.error ?? "Der Löschstatus konnte nicht geladen werden.");
    } else {
      setRequest(result.request);
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  async function submitDeletionRequest() {
    setError(null);
    setSuccess(null);
    if (!accessToken || !accountEmail) {
      setError("Bitte melde dich erneut an.");
      return;
    }
    try {
      validateMobileAccountDeletionConfirmation(
        { emailConfirmation, confirmation },
        accountEmail,
      );
    } catch {
      setError(
        "Bestätige die aktive Account-E-Mail und gib die Löschphrase exakt ein.",
      );
      return;
    }

    Alert.alert(
      "Account wirklich löschen?",
      `Die vollständige Löschung wird aufgenommen und spätestens innerhalb von ${MOBILE_ACCOUNT_DELETION_PROCESSING_DAYS} Tagen bearbeitet. Dies ist keine bloße Deaktivierung.`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Löschung anfragen",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setBusy(true);
              const result = await requestAccountDeletion({
                accessToken,
                emailConfirmation,
                confirmation,
              });
              if (result.error || !result.request) {
                setError(
                  result.error ??
                    "Die Löschanfrage konnte nicht aufgenommen werden.",
                );
                setBusy(false);
                return;
              }
              setRequest(result.request);
              setSuccess(result.message);
              try {
                await signOut();
              } catch {
                setBusy(false);
                setError(
                  "Die Löschanfrage wurde aufgenommen. Die lokale Datenbereinigung konnte jedoch nicht vollständig bestätigt werden; bitte öffne die App erneut und melde dich ab.",
                );
                return;
              }
              setBusy(false);
            })();
          },
        },
      ],
    );
  }

  async function cancelRequest() {
    setError(null);
    setSuccess(null);
    if (!accessToken || !request.id) {
      setError("Es wurde keine widerrufbare Löschanfrage gefunden.");
      return;
    }
    try {
      validateMobileAccountDeletionCancellation({
        requestId: request.id,
        confirmation: cancelConfirmation,
      });
    } catch {
      setError("Gib die Widerrufsphrase exakt ein.");
      return;
    }
    setBusy(true);
    const result = await cancelAccountDeletion({
      accessToken,
      requestId: request.id,
      confirmation: cancelConfirmation,
    });
    if (result.error) {
      setError(result.error);
    } else {
      setRequest({ status: "none", cancellable: false });
      setCancelConfirmation("");
      setEmailConfirmation("");
      setSuccess(result.message);
    }
    setBusy(false);
  }

  return (
    <Screen
      title="Account löschen"
      subtitle="Vollständige Account- und Datenlöschung"
      right={
        <SecondaryButton onPress={() => router.back()}>
          Zurück
        </SecondaryButton>
      }
    >
      {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
      {success ? <Text style={mobileStyles.success}>{success}</Text> : null}

      {loading ? (
        <Card>
          <Text style={mobileStyles.muted}>Löschstatus wird sicher geladen…</Text>
        </Card>
      ) : hasActiveRequest ? (
        <>
          <Card>
            <View style={mobileStyles.rowBetween}>
              <SectionTitle eyebrow="Datenschutz">Aktive Löschanfrage</SectionTitle>
              <StatusPill tone={statusTone(request.status)}>
                {statusLabel(request.status)}
              </StatusPill>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Aufgenommen</Text>
              <Text style={styles.value}>{formatDate(request.requestedAt)}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Späteste Bearbeitung</Text>
              <Text style={styles.value}>
                {formatDate(request.processingDeadlineAt)}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.label}>Workspace</Text>
              <Text style={styles.value}>{workspace?.name ?? "Kein Workspace"}</Text>
            </View>
            {request.requiresOwnershipTransfer ? (
              <Text style={styles.warningText}>
                Der Workspace hat weitere Mitglieder. Vor der Löschung muss die
                Verantwortung geklärt oder übertragen werden; fremde Daten werden
                nicht gelöscht.
              </Text>
            ) : null}
            {request.requiresSubscriptionResolution ? (
              <Text style={styles.warningText}>
                Ein aktives oder noch laufendes Abo muss vor der destruktiven
                Bearbeitung geklärt werden.
              </Text>
            ) : null}
          </Card>

          {request.cancellable ? (
            <Card style={styles.warningCard}>
              <SectionTitle eyebrow="Widerruf">Anfrage abbrechen</SectionTitle>
              <Text style={mobileStyles.muted}>
                Solange die Bearbeitung noch nicht begonnen hat, kannst du die
                Anfrage widerrufen. Gib exakt
                {" "}
                <Text style={styles.phrase}>
                  {MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE}
                </Text>
                {" "}ein.
              </Text>
              <TextInput
                style={mobileStyles.input}
                value={cancelConfirmation}
                onChangeText={setCancelConfirmation}
                autoCapitalize="characters"
                autoCorrect={false}
                spellCheck={false}
                placeholder="Widerrufsphrase"
                placeholderTextColor={colors.textMuted}
              />
              <SecondaryButton
                disabled={
                  busy ||
                  cancelConfirmation !== MOBILE_ACCOUNT_DELETION_CANCEL_PHRASE
                }
                onPress={() => void cancelRequest()}
              >
                Löschanfrage widerrufen
              </SecondaryButton>
            </Card>
          ) : null}
        </>
      ) : (
        <Card style={styles.dangerCard}>
          <SectionTitle eyebrow="Unwiderruflich nach Bearbeitungsstart">
            Vollständige Löschung einleiten
          </SectionTitle>
          <Text style={mobileStyles.body}>
            Die Anfrage umfasst deinen FanMind-Login und die zugehörigen nicht
            aufbewahrungspflichtigen Daten. Sie ist von einer Abo-Kündigung getrennt
            und bietet keine bloße Deaktivierung an.
          </Text>
          <Text style={mobileStyles.muted}>
            Account-E-Mail: <Text style={styles.value}>{accountEmail}</Text>
          </Text>
          <TextInput
            style={mobileStyles.input}
            value={emailConfirmation}
            onChangeText={setEmailConfirmation}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Account-E-Mail bestätigen"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={mobileStyles.muted}>
            Gib exakt
            {" "}
            <Text style={styles.phrase}>
              {MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE}
            </Text>
            {" "}ein.
          </Text>
          <TextInput
            style={mobileStyles.input}
            value={confirmation}
            onChangeText={setConfirmation}
            autoCapitalize="characters"
            autoCorrect={false}
            spellCheck={false}
            placeholder="Löschphrase"
            placeholderTextColor={colors.textMuted}
          />
          <PrimaryButton
            busy={busy}
            disabled={
              confirmation !== MOBILE_ACCOUNT_DELETION_CONFIRMATION_PHRASE ||
              emailConfirmation.trim().toLowerCase() !== accountEmail.toLowerCase()
            }
            onPress={() => void submitDeletionRequest()}
            style={styles.dangerButton}
          >
            Vollständige Löschung anfragen
          </PrimaryButton>
        </Card>
      )}

      <Card>
        <SectionTitle eyebrow="Aufbewahrung">Was danach gilt</SectionTitle>
        <Text style={mobileStyles.muted}>
          Nicht gesetzlich aufzubewahrende Kontodaten werden aus dem aktiven
          FanMind-System entfernt. Rechnungsnachweise und technisch nicht selektiv
          bearbeitbare Sicherungskopien können gesetzlichen beziehungsweise
          technischen Aufbewahrungsfristen unterliegen.
        </Text>
        <SecondaryButton
          onPress={() =>
            void Linking.openURL("https://fanmind.ch/account-deletion")
          }
        >
          Öffentliche Prozessbeschreibung öffnen
        </SecondaryButton>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  label: {
    flex: 1,
    color: colors.textMuted,
    fontSize: typography.small,
  },
  value: {
    flex: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
    textAlign: "right",
  },
  phrase: {
    color: colors.text,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  warningText: {
    color: colors.amber,
    fontSize: typography.small,
    lineHeight: 20,
  },
  warningCard: {
    borderColor: colors.amber,
  },
  dangerCard: {
    borderColor: colors.red,
  },
  dangerButton: {
    backgroundColor: colors.red,
    borderRadius: radius.pill,
  },
});

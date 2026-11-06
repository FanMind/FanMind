import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  BrandMark,
  Card,
  EmptyState,
  LoadingState,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  mobileStyles,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing } from "@/theme/tokens";

export default function ResetPasswordScreen() {
  const {
    recoveryStatus,
    recoveryError,
    updateRecoveredPassword,
    clearRecoveryState,
  } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setGraceExpired(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  function returnToRequest() {
    clearRecoveryState();
    router.replace("/(auth)/forgot-password");
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await updateRecoveredPassword(password, confirmation);
    setError(result);
    setBusy(false);
    if (!result) router.replace("/(app)");
  }

  if (recoveryStatus === "processing" || (recoveryStatus === "idle" && !graceExpired)) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Wiederherstellungslink wird sicher geprüft…" />
      </Screen>
    );
  }

  if (recoveryStatus !== "ready") {
    return (
      <Screen
        title="Passwort zurücksetzen"
        subtitle="Der Link muss auf demselben Gerät geöffnet werden"
      >
        <EmptyState
          title="Link nicht verfügbar"
          description={
            recoveryError ??
            "Der Wiederherstellungslink ist ungültig, abgelaufen oder wurde bereits verwendet."
          }
        />
        <PrimaryButton onPress={returnToRequest}>
          Neuen Link anfordern
        </PrimaryButton>
        <SecondaryButton onPress={() => router.replace("/(auth)/login")}>
          Zur Anmeldung
        </SecondaryButton>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <BrandMark />
          <SectionTitle eyebrow="Bestätigter Link">Neues Passwort setzen</SectionTitle>
          <Text style={mobileStyles.muted}>
            Verwende 12 bis 128 Zeichen mit mindestens einem Buchstaben und einer Zahl.
          </Text>
        </View>

        <Card>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Neues Passwort"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            style={mobileStyles.input}
            accessibilityLabel="Neues Passwort"
          />
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="Neues Passwort wiederholen"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            textContentType="newPassword"
            autoComplete="new-password"
            style={mobileStyles.input}
            accessibilityLabel="Neues Passwort wiederholen"
            onSubmitEditing={() => void submit()}
          />
          {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
          <PrimaryButton busy={busy} onPress={() => void submit()}>
            Passwort sicher aktualisieren
          </PrimaryButton>
          <Text style={mobileStyles.muted}>
            Recovery-Codes und Sitzungstokens werden weder angezeigt noch protokolliert.
          </Text>
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: "center",
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  header: { gap: spacing.md },
});

import { router } from "expo-router";
import { useState } from "react";
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
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  mobileStyles,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing } from "@/theme/tokens";

export default function ForgotPasswordScreen() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setSent(false);
    const result = await requestPasswordReset(email);
    setError(result);
    setSent(!result);
    setBusy(false);
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <BrandMark />
          <SectionTitle eyebrow="Kontozugang">Passwort zurücksetzen</SectionTitle>
          <Text style={mobileStyles.muted}>
            FanMind sendet einen einmal verwendbaren Link an die angegebene Adresse. Aus
            Datenschutzgründen wird nicht offengelegt, ob ein Konto existiert.
          </Text>
        </View>

        <Card>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-Mail-Adresse"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            autoComplete="email"
            style={mobileStyles.input}
            accessibilityLabel="E-Mail-Adresse für Passwort-Wiederherstellung"
            onSubmitEditing={() => void submit()}
          />
          {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
          {sent ? (
            <Text style={mobileStyles.success}>
              Falls ein FanMind-Konto zu dieser Adresse existiert, wurde ein
              Wiederherstellungslink versendet. Öffne ihn auf diesem Gerät.
            </Text>
          ) : null}
          <PrimaryButton busy={busy} onPress={() => void submit()}>
            Wiederherstellungslink anfordern
          </PrimaryButton>
          <SecondaryButton onPress={() => router.replace("/(auth)/login")}>
            Zur Anmeldung
          </SecondaryButton>
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

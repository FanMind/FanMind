import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
  mobileStyles,
} from "@/components/ui";
import { getMobileEnvironment } from "@/lib/env";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, typography } from "@/theme/tokens";

const environment = getMobileEnvironment();
const isStaging = new URL(environment.apiUrl).hostname === "staging.fanmind.ch";
const INVISIBLE_PASSWORD_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2060\uFEFF]/u;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordDiagnostic = useMemo(() => {
    if (!isStaging || password.length === 0) return null;
    const hasOuterWhitespace = password !== password.trim();
    const hasInvisibleCharacters = INVISIBLE_PASSWORD_CHARACTERS.test(password);
    return {
      length: Array.from(password).length,
      suspicious: hasOuterWhitespace || hasInvisibleCharacters,
    };
  }, [password]);

  async function submit() {
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setError(result);
    setBusy(false);
  }

  return (
    <Screen scroll={false}>
      <KeyboardAvoidingView
        style={styles.wrap}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.intro}>
          <BrandMark />
          {isStaging ? (
            <View style={styles.environmentBadge}>
              <Text style={styles.environmentBadgeText}>STAGING · TESTSYSTEM</Text>
            </View>
          ) : null}
          <Text style={styles.title}>Deine Kontakte. Dein Kontext. Deine Antwort.</Text>
          <Text style={styles.subtitle}>
            Die FanMind-App ist dein mobiler Arbeitsbereich. Sie ist keine umverpackte Website
            und sendet niemals automatisch.
          </Text>
        </View>

        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>Sicher anmelden</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-Mail-Adresse"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="username"
            autoComplete="email"
            style={mobileStyles.input}
            accessibilityLabel="E-Mail-Adresse"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Passwort"
            placeholderTextColor={colors.textMuted}
            secureTextEntry={!showPassword}
            textContentType={isStaging ? "none" : "password"}
            autoComplete={isStaging ? "off" : "current-password"}
            autoCorrect={false}
            autoCapitalize="none"
            style={mobileStyles.input}
            accessibilityLabel="Passwort"
            onSubmitEditing={() => void submit()}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
            onPress={() => setShowPassword((current) => !current)}
            style={styles.passwordToggle}
          >
            <Text style={styles.passwordToggleText}>
              {showPassword ? "Passwort ausblenden" : "Passwort anzeigen"}
            </Text>
          </Pressable>
          {passwordDiagnostic ? (
            <Text
              style={
                passwordDiagnostic.suspicious
                  ? styles.passwordDiagnosticWarning
                  : styles.passwordDiagnostic
              }
            >
              {passwordDiagnostic.length} Zeichen · {passwordDiagnostic.suspicious
                ? "Leer-/Steuerzeichen erkannt"
                : "keine äußeren/unsichtbaren Zeichen erkannt"}
            </Text>
          ) : null}
          {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
          <PrimaryButton busy={busy} onPress={() => void submit()}>
            Anmelden
          </PrimaryButton>
          <SecondaryButton onPress={() => router.push("/(auth)/forgot-password")}>
            Passwort vergessen?
          </SecondaryButton>
          <Text style={styles.securityText}>
            Die Sitzung wird verschlüsselt im sicheren Gerätespeicher gehalten. Service-Role-
            und KI-Schlüssel befinden sich nicht in der App.
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
    gap: spacing.xxl,
    paddingVertical: spacing.xl,
  },
  intro: { gap: spacing.lg },
  environmentBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.cyan,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  environmentBadgeText: {
    color: colors.cyan,
    fontSize: typography.micro,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: typography.body,
    lineHeight: 24,
  },
  formCard: { gap: spacing.lg },
  formTitle: { color: colors.text, fontSize: typography.heading, fontWeight: "900" },
  passwordToggle: {
    alignSelf: "flex-end",
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  passwordToggleText: {
    color: colors.cyan,
    fontSize: typography.micro,
    fontWeight: "800",
  },
  passwordDiagnostic: {
    color: colors.textMuted,
    fontSize: typography.micro,
    lineHeight: 17,
  },
  passwordDiagnosticWarning: {
    color: colors.red,
    fontSize: typography.micro,
    lineHeight: 17,
    fontWeight: "800",
  },
  securityText: {
    color: colors.textMuted,
    fontSize: typography.micro,
    lineHeight: 17,
    textAlign: "center",
  },
});

import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  Card,
  PrimaryButton,
  SectionTitle,
  mobileStyles,
} from "@/components/ui";
import {
  CONTACT_STATUS_VALUES,
  MAX_CONTACT_HANDLE_LENGTH,
  MAX_CONTACT_LANGUAGE_LENGTH,
  MAX_CONTACT_NAME_LENGTH,
  MAX_CONTACT_NOTES_LENGTH,
  MAX_CONTACT_PLATFORM_LENGTH,
  MAX_CONTACT_SUMMARY_LENGTH,
  type ContactDraft,
} from "@/lib/contactDraftPolicy.mjs";
import { colors, radius, spacing, typography } from "@/theme/tokens";

type ContactFormProps = {
  initialValue: ContactDraft;
  submitLabel: string;
  busy?: boolean;
  error?: string | null;
  notice?: string | null;
  onSubmit: (draft: ContactDraft) => void | Promise<void>;
};

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function ContactForm({
  initialValue,
  submitLabel,
  busy = false,
  error,
  notice,
  onSubmit,
}: ContactFormProps) {
  const [draft, setDraft] = useState<ContactDraft>(initialValue);

  function set<K extends keyof ContactDraft>(key: K, value: ContactDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <>
      <Card>
        <SectionTitle eyebrow="Pflichtfeld">Kontakt</SectionTitle>
        <View style={styles.field}>
          <FieldLabel>Name</FieldLabel>
          <TextInput
            value={draft.displayName}
            onChangeText={(value) => set("displayName", value)}
            placeholder="z. B. Sandra M."
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_CONTACT_NAME_LENGTH}
            autoCapitalize="words"
            style={mobileStyles.input}
            accessibilityLabel="Kontaktname"
          />
        </View>
        <View style={styles.field}>
          <FieldLabel>Handle</FieldLabel>
          <TextInput
            value={draft.handle}
            onChangeText={(value) => set("handle", value)}
            placeholder="z. B. @sandra_fit"
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_CONTACT_HANDLE_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            style={mobileStyles.input}
            accessibilityLabel="Kontakt-Handle"
          />
        </View>
      </Card>

      <Card>
        <SectionTitle eyebrow="Einordnung">Quelle und Sprache</SectionTitle>
        <View style={styles.field}>
          <FieldLabel>Quelle / Plattform</FieldLabel>
          <TextInput
            value={draft.sourcePlatform}
            onChangeText={(value) => set("sourcePlatform", value)}
            placeholder="manual, instagram, tiktok …"
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_CONTACT_PLATFORM_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            style={mobileStyles.input}
            accessibilityLabel="Kontaktquelle"
          />
          <Text style={mobileStyles.muted}>
            Dies ist nur die Herkunftsangabe. Die App synchronisiert keine externe Plattform.
          </Text>
        </View>
        <View style={styles.field}>
          <FieldLabel>Sprache</FieldLabel>
          <TextInput
            value={draft.language}
            onChangeText={(value) => set("language", value)}
            placeholder="de oder en"
            placeholderTextColor={colors.textMuted}
            maxLength={MAX_CONTACT_LANGUAGE_LENGTH}
            autoCapitalize="none"
            autoCorrect={false}
            style={mobileStyles.input}
            accessibilityLabel="Kontaktsprache"
          />
        </View>
      </Card>

      <Card>
        <SectionTitle eyebrow="CRM-Status">Beziehungsstatus</SectionTitle>
        <View style={styles.statusWrap}>
          {CONTACT_STATUS_VALUES.map((status) => {
            const selected = draft.status === status;
            return (
              <Pressable
                key={status}
                onPress={() => set("status", status)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.statusButton,
                  selected && styles.statusButtonSelected,
                  pressed && styles.statusButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    selected && styles.statusTextSelected,
                  ]}
                >
                  {status}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.field}>
          <FieldLabel>Tags</FieldLabel>
          <TextInput
            value={draft.tags}
            onChangeText={(value) => set("tags", value)}
            placeholder="fitness; vip; warm"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            style={mobileStyles.input}
            accessibilityLabel="Kontakt-Tags"
          />
          <Text style={mobileStyles.muted}>
            Trenne Tags mit Semikolon oder Komma. Doppelte Tags werden zusammengeführt.
          </Text>
        </View>
      </Card>

      <Card>
        <SectionTitle eyebrow="Kontext">Zusammenfassung und interne Notiz</SectionTitle>
        <View style={styles.field}>
          <FieldLabel>Zusammenfassung</FieldLabel>
          <TextInput
            value={draft.summary}
            onChangeText={(value) => set("summary", value)}
            placeholder="Was sollte FanMind über diesen Kontakt wissen?"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CONTACT_SUMMARY_LENGTH}
            style={[mobileStyles.input, mobileStyles.textArea]}
            accessibilityLabel="Kontaktzusammenfassung"
          />
        </View>
        <View style={styles.field}>
          <FieldLabel>Interne Notiz</FieldLabel>
          <TextInput
            value={draft.internalNotes}
            onChangeText={(value) => set("internalNotes", value)}
            placeholder="Nur für den internen Arbeitskontext"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={MAX_CONTACT_NOTES_LENGTH}
            style={[mobileStyles.input, styles.notesInput]}
            accessibilityLabel="Interne Kontaktnotiz"
          />
        </View>
      </Card>

      {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
      {notice ? <Text style={mobileStyles.success}>{notice}</Text> : null}
      <PrimaryButton busy={busy} onPress={() => void onSubmit(draft)}>
        {submitLabel}
      </PrimaryButton>
      <Text style={styles.boundary}>
        Der Kontakt bleibt an deinen RLS-geschützten FanMind-Workspace gebunden.
      </Text>
    </>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  label: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  statusWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  statusButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    backgroundColor: colors.backgroundRaised,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  statusButtonSelected: {
    borderColor: colors.cyan,
    backgroundColor: "rgba(100, 230, 255, 0.15)",
  },
  statusButtonPressed: { opacity: 0.72 },
  statusText: {
    color: colors.textMuted,
    fontSize: typography.micro,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  statusTextSelected: { color: colors.cyan },
  notesInput: { minHeight: 100, textAlignVertical: "top" },
  boundary: {
    color: colors.textMuted,
    fontSize: typography.micro,
    lineHeight: 17,
    textAlign: "center",
  },
});

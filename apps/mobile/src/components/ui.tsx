import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, spacing, typography } from "@/theme/tokens";

export function BrandMark() {
  return (
    <View style={styles.brandRow} accessibilityLabel="FanMind">
      <Text style={styles.brandText}>
        Fan<Text style={styles.brandMind}>Mind</Text>
      </Text>
    </View>
  );
}

export function Screen({
  children,
  title,
  subtitle,
  scroll = true,
  right,
}: PropsWithChildren<{
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  right?: ReactNode;
}>) {
  const content = (
    <View style={styles.screenContent}>
      {title ? (
        <View style={styles.screenHeader}>
          <View style={styles.screenHeaderText}>
            <Text style={styles.screenTitle}>{title}</Text>
            {subtitle ? <Text style={styles.screenSubtitle}>{subtitle}</Text> : null}
          </View>
          {right}
        </View>
      ) : null}
      {children}
    </View>
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      {scroll ? (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        <View style={styles.screen}>{content}</View>
      )}
    </SafeAreaView>
  );
}

export function Card({
  children,
  style,
}: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({
  children,
  eyebrow,
}: PropsWithChildren<{ eyebrow?: string }>) {
  return (
    <View style={styles.sectionTitleWrap}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({
  children,
  busy = false,
  disabled,
  style,
  ...props
}: PropsWithChildren<
  PressableProps & { busy?: boolean; style?: StyleProp<ViewStyle> }
>) {
  return (
    <Pressable
      {...props}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.primaryButton,
        pressed && styles.buttonPressed,
        (disabled || busy) && styles.buttonDisabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={colors.background} />
      ) : (
        <Text style={styles.primaryButtonText}>{children}</Text>
      )}
    </Pressable>
  );
}

export function SecondaryButton({
  children,
  style,
  ...props
}: PropsWithChildren<PressableProps & { style?: StyleProp<ViewStyle> }>) {
  return (
    <Pressable
      {...props}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && styles.buttonPressed,
        props.disabled && styles.buttonDisabled,
        style,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{children}</Text>
    </Pressable>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: PropsWithChildren<{
  tone?: "neutral" | "good" | "warning" | "danger" | "accent";
}>) {
  return (
    <View
      style={[
        styles.pill,
        tone === "good" && styles.pillGood,
        tone === "warning" && styles.pillWarning,
        tone === "danger" && styles.pillDanger,
        tone === "accent" && styles.pillAccent,
      ]}
    >
      <Text style={styles.pillText}>{children}</Text>
    </View>
  );
}

export function LoadingState({ label = "FanMind lädt…" }: { label?: string }) {
  return (
    <View style={styles.stateWrap}>
      <ActivityIndicator size="large" color={colors.cyan} />
      <Text style={styles.stateText}>{label}</Text>
    </View>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
    </Card>
  );
}

export const mobileStyles = StyleSheet.create({
  body: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 23,
  },
  muted: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  gap: {
    gap: spacing.md,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    color: colors.text,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body,
  },
  textArea: {
    minHeight: 130,
    textAlignVertical: "top",
  },
  error: {
    color: colors.red,
    fontSize: typography.small,
    lineHeight: 19,
  },
  success: {
    color: colors.green,
    fontSize: typography.small,
    lineHeight: 19,
  },
});

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  screenContent: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 110,
    gap: spacing.lg,
  },
  screenHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  screenHeaderText: { flex: 1, gap: spacing.xs },
  screenTitle: {
    color: colors.text,
    fontSize: typography.title,
    lineHeight: 34,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  screenSubtitle: {
    color: colors.textMuted,
    fontSize: typography.small,
    lineHeight: 19,
  },
  brandRow: { flexDirection: "row", alignItems: "center" },
  brandText: {
    color: colors.text,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  brandMind: { color: colors.cyan },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionTitleWrap: { gap: 2 },
  eyebrow: {
    color: colors.cyan,
    fontSize: typography.micro,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: colors.text,
    fontSize: typography.heading,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.pill,
    backgroundColor: colors.cyan,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: typography.body,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.backgroundRaised,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  buttonPressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.45 },
  pill: {
    alignSelf: "flex-start",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillGood: { backgroundColor: "rgba(98, 242, 179, 0.13)" },
  pillWarning: { backgroundColor: "rgba(255, 211, 106, 0.14)" },
  pillDanger: { backgroundColor: "rgba(255, 114, 139, 0.14)" },
  pillAccent: { backgroundColor: "rgba(100, 230, 255, 0.13)" },
  pillText: { color: colors.text, fontSize: typography.micro, fontWeight: "900" },
  stateWrap: {
    flex: 1,
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  stateText: { color: colors.textMuted, fontSize: typography.body },
  emptyCard: { alignItems: "center", paddingVertical: spacing.xxl },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: typography.heading },
  emptyDescription: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
});

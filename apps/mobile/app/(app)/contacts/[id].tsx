import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  Card,
  EmptyState,
  LoadingState,
  PrimaryButton,
  Screen,
  SecondaryButton,
  SectionTitle,
  StatusPill,
  mobileStyles,
} from "@/components/ui";
import { requestReplySuggestions } from "@/lib/api";
import {
  createContactMemory,
  createFollowup,
  getContact,
  listContactMemories,
  listContactMessages,
} from "@/lib/data";
import { addLocalDaysDate } from "@/lib/localDate";
import { createReplyShareContent } from "@/lib/replySharePolicy.mjs";
import { useAuth } from "@/providers/AuthProvider";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { colors, radius, spacing, typography } from "@/theme/tokens";
import type {
  Contact,
  ContactMemory,
  ConversationMessage,
  ReplySuggestions,
} from "@/types";

function formatMessageDate(value: string | null): string {
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

function messageAuthor(
  message: ConversationMessage,
  contactName: string,
): string {
  const storedAuthor = message.author_label?.trim();
  if (storedAuthor) return storedAuthor;
  if (message.direction === "inbound") return contactName;
  if (message.direction === "note") return "Interne Notiz";
  return "FanMind Team";
}

function messageContext(message: ConversationMessage): string {
  return [message.source_platform, message.message_type]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" · ");
}

export default function ContactDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const contactId = Array.isArray(params.id) ? params.id[0] : params.id;
  const { session } = useAuth();
  const {
    workspace,
    loading: workspaceLoading,
    error: workspaceError,
  } = useWorkspace();
  const [contact, setContact] = useState<Contact | null>(null);
  const [memories, setMemories] = useState<ContactMemory[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [incomingMessage, setIncomingMessage] = useState("");
  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<ReplySuggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [followupBusy, setFollowupBusy] = useState(false);
  const [sharingReplyIndex, setSharingReplyIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contactId) {
      setContact(null);
      setMemories([]);
      setMessages([]);
      setError("Kontakt-ID fehlt.");
      setLoading(false);
      return;
    }

    if (!workspace?.id) {
      setContact(null);
      setMemories([]);
      setMessages([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const [contactResult, memoriesResult, messagesResult] = await Promise.all([
      getContact(workspace.id, contactId),
      listContactMemories(workspace.id, contactId),
      listContactMessages(workspace.id, contactId),
    ]);
    setContact(contactResult.contact);
    setMemories(memoriesResult.memories);
    setMessages(messagesResult.messages);
    setError(contactResult.error ?? memoriesResult.error ?? messagesResult.error);
    setLoading(false);
  }, [contactId, workspace?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const tags = useMemo(() => contact?.tags ?? [], [contact?.tags]);

  async function generateSuggestions() {
    if (!session?.access_token || !contact) return;
    setAiBusy(true);
    setError(null);
    setNotice(null);
    const result = await requestReplySuggestions({
      accessToken: session.access_token,
      contact,
      incomingMessage,
      responseInstruction: instruction,
    });
    setSuggestions(result.data);
    setError(result.error);
    setAiBusy(false);
  }

  async function copy(text: string) {
    await Clipboard.setStringAsync(text);
    setNotice("Antwort wurde kopiert. Prüfe sie vor dem Versand.");
  }

  async function shareReply(text: string, index: number) {
    setSharingReplyIndex(index);
    setError(null);
    setNotice(null);

    try {
      const result = await Share.share(createReplyShareContent(text), {
        dialogTitle: "Antwort manuell teilen",
      });
      setNotice(
        result.action === Share.dismissedAction
          ? "Teilen wurde abgebrochen."
          : "Antwort wurde an die Teilen-Auswahl übergeben. Du wählst und sendest final selbst.",
      );
    } catch {
      setError("Antwort konnte nicht an die Teilen-Auswahl übergeben werden.");
    } finally {
      setSharingReplyIndex(null);
    }
  }

  async function saveMemory() {
    if (
      !workspace?.id ||
      workspace.role !== "owner" ||
      !contact ||
      !suggestions?.suggested_memory.content
    ) return;
    setMemoryBusy(true);
    const result = await createContactMemory({
      workspaceId: workspace.id,
      workspaceRole: workspace.role,
      contactId: contact.id,
      content: suggestions.suggested_memory.content,
      importance: suggestions.suggested_memory.importance,
    });
    setError(result);
    if (!result) {
      setNotice("Kontaktwissen wurde gespeichert.");
      await load();
    }
    setMemoryBusy(false);
  }

  async function saveFollowup() {
    if (
      !workspace?.id ||
      workspace.role !== "owner" ||
      !contact ||
      !suggestions?.suggested_followup.recommended
    ) return;
    const days = suggestions.suggested_followup.in_days ?? 3;
    setFollowupBusy(true);
    const result = await createFollowup({
      workspaceId: workspace.id,
      workspaceRole: workspace.role,
      contactId: contact.id,
      dueDate: addLocalDaysDate(days),
      reason: suggestions.suggested_followup.reason || "Kontakt erneut ansprechen",
      priority: "normal",
    });
    setError(result);
    if (!result) setNotice(`Follow-up in ${days} Tagen wurde gespeichert.`);
    setFollowupBusy(false);
  }

  if (workspaceLoading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Workspace wird geladen…" />
      </Screen>
    );
  }

  if (!workspace) {
    return (
      <Screen
        title="Kontakt"
        right={<SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>}
      >
        <EmptyState
          title="Noch kein Workspace"
          description={
            workspaceError ??
            "Schließe zuerst das FanMind-Onboarding ab, damit Kontakte geöffnet werden können."
          }
        />
      </Screen>
    );
  }

  if (loading) {
    return (
      <Screen scroll={false}>
        <LoadingState label="Kontakt wird geladen…" />
      </Screen>
    );
  }

  if (!contact) {
    return (
      <Screen
        title="Kontakt"
        right={<SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>}
      >
        <EmptyState
          title="Kontakt nicht verfügbar"
          description={error ?? "Dieser Kontakt gehört nicht zu deinem Workspace."}
        />
      </Screen>
    );
  }

  return (
    <Screen
      title={contact.display_name}
      subtitle={`${contact.handle || "ohne Handle"} · ${contact.source_platform || "manuell"}`}
      right={
        <View style={styles.headerActions}>
          {workspace.role === "owner" ? (
            <SecondaryButton
              onPress={() => router.push(`/(app)/contacts/${contact.id}/edit`)}
            >
              Bearbeiten
            </SecondaryButton>
          ) : null}
          <SecondaryButton onPress={() => router.back()}>Zurück</SecondaryButton>
        </View>
      }
    >
      <View style={styles.pills}>
        <StatusPill tone="accent">{contact.status || "neu"}</StatusPill>
        <StatusPill>{contact.language || "de"}</StatusPill>
        {tags.slice(0, 3).map((tag) => (
          <StatusPill key={tag}>{tag}</StatusPill>
        ))}
      </View>

      <Card>
        <SectionTitle eyebrow="Profil">Kurzüberblick</SectionTitle>
        <Text style={mobileStyles.body}>
          {contact.summary || "Noch keine Zusammenfassung gespeichert."}
        </Text>
      </Card>

      <Card>
        <SectionTitle eyebrow="Nachrichten">Gesprächsverlauf</SectionTitle>
        {messages.length ? (
          <View style={styles.messageList}>
            {messages.map((message) => {
              const outbound = message.direction === "outbound";
              const note = message.direction === "note";
              return (
                <View
                  key={message.id}
                  style={[
                    styles.messageRow,
                    outbound && styles.messageRowOutbound,
                    note && styles.messageRowNote,
                  ]}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      outbound && styles.messageBubbleOutbound,
                      note && styles.messageBubbleNote,
                    ]}
                  >
                    <View style={styles.messageMeta}>
                      <Text style={styles.messageAuthor}>
                        {messageAuthor(message, contact.display_name)}
                      </Text>
                      <Text style={styles.messageTime}>
                        {formatMessageDate(message.created_at)}
                      </Text>
                    </View>
                    <Text selectable style={styles.messageContent}>
                      {message.content}
                    </Text>
                    {messageContext(message) ? (
                      <Text style={styles.messageContext}>
                        {messageContext(message)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={mobileStyles.muted}>
            Noch kein gespeicherter Nachrichtenverlauf.
          </Text>
        )}
        <Text style={mobileStyles.muted}>
          Der Verlauf ist nur lesbar. FanMind sendet keine Nachricht automatisch.
        </Text>
      </Card>

      <Card>
        <SectionTitle eyebrow="Kontaktwissen">Was FanMind berücksichtigen darf</SectionTitle>
        {memories.length ? (
          memories.slice(0, 8).map((memory) => (
            <View key={memory.id} style={styles.memoryRow}>
              <View style={styles.memoryDot} />
              <View style={{ flex: 1 }}>
                <Text style={mobileStyles.body}>{memory.content}</Text>
                <Text style={mobileStyles.muted}>
                  {memory.importance || "normal"} · {memory.type || "Hinweis"}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text style={mobileStyles.muted}>Noch kein Kontaktwissen gespeichert.</Text>
        )}
      </Card>

      <Card>
        <SectionTitle eyebrow="Neue Nachricht">Antworten vorbereiten</SectionTitle>
        {workspace.role === "owner" ? (
          <>
            <TextInput
              value={incomingMessage}
              onChangeText={setIncomingMessage}
              placeholder="Füge die neue Nachricht des Kontakts ein…"
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={4000}
              style={[mobileStyles.input, mobileStyles.textArea]}
              accessibilityLabel="Neue eingehende Nachricht"
            />
            <Text style={mobileStyles.muted}>
              Der gespeicherte Gesprächsverlauf wird serverseitig automatisch und
              passend zur freigegebenen KI-Stufe berücksichtigt.
            </Text>
            <TextInput
              value={instruction}
              onChangeText={setInstruction}
              placeholder="Optional: z. B. kurz, direkt und ohne Verkaufsdruck"
              placeholderTextColor={colors.textMuted}
              maxLength={1000}
              style={mobileStyles.input}
              accessibilityLabel="Optionale Antwortanweisung"
            />
            {error ? <Text style={mobileStyles.error}>{error}</Text> : null}
            {notice ? <Text style={mobileStyles.success}>{notice}</Text> : null}
            <PrimaryButton busy={aiBusy} onPress={() => void generateSuggestions()}>
              Drei Antworten vorbereiten
            </PrimaryButton>
            <Text style={styles.safety}>
              Mensch prüft und sendet final selbst. Keine automatische Sendefunktion.
            </Text>
          </>
        ) : (
          <Text style={mobileStyles.muted}>
            Die KI-Verarbeitung ist für Teamzugänge bis zum atomaren
            Datenbankvertrag deaktiviert. Vorhandene Kontaktinformationen
            bleiben lesbar.
          </Text>
        )}
      </Card>

      {suggestions ? (
        <>
          <Card>
            <SectionTitle eyebrow="KI Standard">Antwortvorschläge</SectionTitle>
            {suggestions.reply_options.map((option, index) => (
              <View key={`${option.label}-${index}`} style={styles.replyCard}>
                <View style={mobileStyles.rowBetween}>
                  <Text style={styles.replyLabel}>{option.label}</Text>
                  <StatusPill>{option.tone}</StatusPill>
                </View>
                <Text style={mobileStyles.body}>{option.text}</Text>
                <View style={styles.replyActions}>
                  <SecondaryButton onPress={() => void copy(option.text)}>
                    Antwort kopieren
                  </SecondaryButton>
                  <SecondaryButton
                    disabled={sharingReplyIndex !== null}
                    onPress={() => void shareReply(option.text, index)}
                  >
                    {sharingReplyIndex === index ? "Teilen…" : "Nativ teilen"}
                  </SecondaryButton>
                </View>
              </View>
            ))}
          </Card>

          {workspace.role === "owner" && suggestions.suggested_memory.content ? (
            <Card>
              <SectionTitle eyebrow="Vorschlag">Kontaktwissen speichern?</SectionTitle>
              <Text style={mobileStyles.body}>{suggestions.suggested_memory.content}</Text>
              <PrimaryButton busy={memoryBusy} onPress={() => void saveMemory()}>
                Kontaktwissen speichern
              </PrimaryButton>
            </Card>
          ) : null}

          {workspace.role === "owner" && suggestions.suggested_followup.recommended ? (
            <Card>
              <SectionTitle eyebrow="Vorschlag">Follow-up einplanen?</SectionTitle>
              <Text style={mobileStyles.body}>
                In {suggestions.suggested_followup.in_days ?? 3} Tagen · {suggestions.suggested_followup.reason}
              </Text>
              <PrimaryButton busy={followupBusy} onPress={() => void saveFollowup()}>
                Follow-up speichern
              </PrimaryButton>
            </Card>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  memoryRow: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  memoryDot: {
    width: 9,
    height: 9,
    marginTop: 7,
    borderRadius: 5,
    backgroundColor: colors.cyan,
  },
  messageList: { gap: spacing.md },
  messageRow: { alignItems: "flex-start" },
  messageRowOutbound: { alignItems: "flex-end" },
  messageRowNote: { alignItems: "center" },
  messageBubble: {
    width: "88%",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    padding: spacing.md,
  },
  messageBubbleOutbound: {
    borderColor: colors.cyan,
    backgroundColor: colors.surfaceMuted,
  },
  messageBubbleNote: {
    borderStyle: "dashed",
    backgroundColor: colors.surface,
  },
  messageMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  messageAuthor: {
    flexShrink: 1,
    color: colors.text,
    fontSize: typography.small,
    fontWeight: "800",
  },
  messageTime: {
    color: colors.textMuted,
    fontSize: typography.micro,
  },
  messageContent: {
    color: colors.text,
    fontSize: typography.body,
    lineHeight: 24,
  },
  messageContext: {
    color: colors.textMuted,
    fontSize: typography.micro,
    textTransform: "capitalize",
  },
  safety: {
    color: colors.amber,
    fontSize: typography.micro,
    lineHeight: 17,
    textAlign: "center",
    fontWeight: "700",
  },
  replyCard: {
    gap: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    padding: spacing.lg,
  },
  replyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  replyLabel: { color: colors.text, fontSize: typography.body, fontWeight: "900" },
});

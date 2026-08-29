import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
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
  markContactInboundMessagesSeen,
} from "@/lib/data";
import {
  ALL_MESSAGE_CHANNELS,
  buildMessageChannelOptions,
  filterMessagesByChannel,
} from "@/lib/contactMessageChannelPolicy.mjs";
import { addLocalDaysDate } from "@/lib/localDate";
import { normalizeManualFollowupDraft } from "@/lib/manualFollowupPolicy.mjs";
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

function manualFollowupError(errors: string[]): string {
  if (errors.includes("reason")) {
    return "Bitte gib einen kurzen Grund mit höchstens 500 Zeichen ein.";
  }
  if (errors.includes("due_date_past")) {
    return "Das Follow-up-Datum darf nicht in der Vergangenheit liegen.";
  }
  if (errors.includes("due_date")) {
    return "Bitte verwende ein gültiges Datum im Format JJJJ-MM-TT.";
  }
  return "Bitte prüfe die Follow-up-Angaben.";
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
  const [messageError, setMessageError] = useState<string | null>(null);
  const [messageSeenError, setMessageSeenError] = useState<string | null>(null);
  const [messagesBusy, setMessagesBusy] = useState(false);
  const [selectedMessageChannel, setSelectedMessageChannel] = useState<string>(
    ALL_MESSAGE_CHANNELS,
  );
  const [incomingMessage, setIncomingMessage] = useState("");
  const [instruction, setInstruction] = useState("");
  const [suggestions, setSuggestions] = useState<ReplySuggestions | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiBusy, setAiBusy] = useState(false);
  const [memoryBusy, setMemoryBusy] = useState(false);
  const [followupBusy, setFollowupBusy] = useState(false);
  const [manualFollowupBusy, setManualFollowupBusy] = useState(false);
  const [manualFollowupReason, setManualFollowupReason] = useState("");
  const [manualFollowupDueDate, setManualFollowupDueDate] = useState(
    addLocalDaysDate(3),
  );
  const [manualFollowupPriority, setManualFollowupPriority] = useState<
    "low" | "normal" | "high"
  >("normal");
  const [manualFollowupFormError, setManualFollowupFormError] = useState<
    string | null
  >(null);
  const [manualFollowupNotice, setManualFollowupNotice] = useState<string | null>(
    null,
  );
  const [sharingReplyIndex, setSharingReplyIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!contactId) {
      setContact(null);
      setMemories([]);
      setMessages([]);
      setMessageError(null);
      setMessageSeenError(null);
      setError("Kontakt-ID fehlt.");
      setLoading(false);
      return;
    }

    if (!workspace?.id) {
      setContact(null);
      setMemories([]);
      setMessages([]);
      setMessageError(null);
      setMessageSeenError(null);
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
    const seenError =
      !messagesResult.error && contactResult.contact
        ? await markContactInboundMessagesSeen({
            workspaceId: workspace.id,
            workspaceRole: workspace.role,
            contactId,
          })
        : null;
    setContact(contactResult.contact);
    setMemories(memoriesResult.memories);
    setMessages(messagesResult.messages);
    setMessageError(messagesResult.error);
    setMessageSeenError(seenError);
    setError(contactResult.error ?? memoriesResult.error);
    setLoading(false);
  }, [contactId, workspace?.id, workspace?.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const refreshMessages = useCallback(async () => {
    if (!workspace?.id || !contactId) return;
    setMessagesBusy(true);
    const result = await listContactMessages(workspace.id, contactId);
    if (!result.error) setMessages(result.messages);
    setMessageError(result.error);
    setMessageSeenError(
      result.error
        ? null
        : await markContactInboundMessagesSeen({
            workspaceId: workspace.id,
            workspaceRole: workspace.role,
            contactId,
          }),
    );
    setMessagesBusy(false);
  }, [contactId, workspace?.id, workspace?.role]);

  const tags = useMemo(() => contact?.tags ?? [], [contact?.tags]);
  const messageChannelOptions = useMemo(
    () => buildMessageChannelOptions(messages),
    [messages],
  );
  const activeMessageChannel = messageChannelOptions.some(
    (option) => option.key === selectedMessageChannel,
  )
    ? selectedMessageChannel
    : ALL_MESSAGE_CHANNELS;
  const visibleMessages = useMemo(
    () => filterMessagesByChannel(messages, activeMessageChannel),
    [activeMessageChannel, messages],
  );

  useEffect(() => {
    setSelectedMessageChannel(ALL_MESSAGE_CHANNELS);
    setManualFollowupFormError(null);
    setManualFollowupNotice(null);
  }, [contactId]);

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

  async function saveManualFollowup() {
    if (!workspace?.id || workspace.role !== "owner" || !contact) return;
    const normalized = normalizeManualFollowupDraft({
      reason: manualFollowupReason,
      dueDate: manualFollowupDueDate,
      priority: manualFollowupPriority,
    });
    if (!normalized.ok) {
      setManualFollowupFormError(manualFollowupError(normalized.errors));
      return;
    }

    setManualFollowupBusy(true);
    setManualFollowupFormError(null);
    setManualFollowupNotice(null);
    const result = await createFollowup({
      workspaceId: workspace.id,
      workspaceRole: workspace.role,
      contactId: contact.id,
      dueDate: normalized.value.due_date,
      reason: normalized.value.reason,
      priority: normalized.value.priority,
    });
    setManualFollowupFormError(result);
    if (!result) {
      setManualFollowupReason("");
      setManualFollowupNotice(
        `Follow-up für ${manualFollowupDueDate} wurde gespeichert.`,
      );
    }
    setManualFollowupBusy(false);
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
        <View style={styles.messageHeader}>
          <SectionTitle eyebrow="Nachrichten">Gesprächsverlauf</SectionTitle>
          <SecondaryButton
            disabled={messagesBusy}
            onPress={() => void refreshMessages()}
          >
            {messagesBusy ? "Lädt…" : "Aktualisieren"}
          </SecondaryButton>
        </View>
        {messageError ? (
          <Text style={mobileStyles.error}>{messageError}</Text>
        ) : messages.length ? (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.messageChannelList}
              accessibilityRole="tablist"
            >
              {messageChannelOptions.map((option) => {
                const selected = option.key === activeMessageChannel;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${option.label}, ${option.count} Nachrichten`}
                    onPress={() => setSelectedMessageChannel(option.key)}
                    style={({ pressed }) => [
                      styles.messageChannel,
                      selected && styles.messageChannelSelected,
                      pressed && styles.messageChannelPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageChannelText,
                        selected && styles.messageChannelTextSelected,
                      ]}
                    >
                      {option.label} · {option.count}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.messageList}>
              {visibleMessages.map((message) => {
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
          </>
        ) : (
          <Text style={mobileStyles.muted}>
            Noch kein gespeicherter Nachrichtenverlauf.
          </Text>
        )}
        <Text style={mobileStyles.muted}>
          Der Verlauf ist nur lesbar. FanMind sendet keine Nachricht automatisch.
        </Text>
        {messageSeenError ? (
          <Text style={mobileStyles.error}>{messageSeenError}</Text>
        ) : null}
      </Card>

      <Card>
        <SectionTitle eyebrow="Follow-up">Direkt beim Fan anlegen</SectionTitle>
        {workspace.role === "owner" ? (
          <>
            <TextInput
              value={manualFollowupReason}
              onChangeText={setManualFollowupReason}
              placeholder="Grund, z. B. Event-Details senden"
              placeholderTextColor={colors.textMuted}
              maxLength={500}
              style={mobileStyles.input}
              accessibilityLabel="Grund für das Follow-up"
            />
            <Text style={mobileStyles.muted}>Wann möchtest du erinnert werden?</Text>
            <View style={styles.followupChoiceRow}>
              {[
                { label: "Morgen", days: 1 },
                { label: "In 3 Tagen", days: 3 },
                { label: "In 7 Tagen", days: 7 },
              ].map((choice) => {
                const value = addLocalDaysDate(choice.days);
                const selected = manualFollowupDueDate === value;
                return (
                  <Pressable
                    key={choice.days}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setManualFollowupDueDate(value)}
                    style={({ pressed }) => [
                      styles.followupChoice,
                      selected && styles.followupChoiceSelected,
                      pressed && styles.messageChannelPressed,
                    ]}
                  >
                    <Text style={selected ? styles.followupChoiceTextSelected : styles.followupChoiceText}>
                      {choice.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={manualFollowupDueDate}
              onChangeText={setManualFollowupDueDate}
              placeholder="JJJJ-MM-TT"
              placeholderTextColor={colors.textMuted}
              maxLength={10}
              style={mobileStyles.input}
              accessibilityLabel="Datum des Follow-ups"
            />
            <Text style={mobileStyles.muted}>Priorität</Text>
            <View style={styles.followupChoiceRow}>
              {[
                { key: "low" as const, label: "Niedrig" },
                { key: "normal" as const, label: "Normal" },
                { key: "high" as const, label: "Hoch" },
              ].map((priority) => {
                const selected = manualFollowupPriority === priority.key;
                return (
                  <Pressable
                    key={priority.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setManualFollowupPriority(priority.key)}
                    style={({ pressed }) => [
                      styles.followupChoice,
                      selected && styles.followupChoiceSelected,
                      pressed && styles.messageChannelPressed,
                    ]}
                  >
                    <Text style={selected ? styles.followupChoiceTextSelected : styles.followupChoiceText}>
                      {priority.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {manualFollowupFormError ? (
              <Text style={mobileStyles.error}>{manualFollowupFormError}</Text>
            ) : null}
            {manualFollowupNotice ? (
              <Text style={mobileStyles.success}>{manualFollowupNotice}</Text>
            ) : null}
            <PrimaryButton
              busy={manualFollowupBusy}
              onPress={() => void saveManualFollowup()}
            >
              Follow-up speichern
            </PrimaryButton>
            <SecondaryButton onPress={() => router.push("/(app)/followups")}>
              Offene Follow-ups anzeigen
            </SecondaryButton>
          </>
        ) : (
          <Text style={mobileStyles.muted}>
            Teamzugänge können Follow-ups in Mobile derzeit nur lesen.
          </Text>
        )}
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
  messageHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  messageChannelList: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  messageChannel: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  messageChannelSelected: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyan,
  },
  messageChannelPressed: { opacity: 0.72 },
  messageChannelText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "800",
  },
  messageChannelTextSelected: { color: colors.background },
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
  followupChoiceRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  followupChoice: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.backgroundRaised,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  followupChoiceSelected: {
    borderColor: colors.cyan,
    backgroundColor: colors.cyan,
  },
  followupChoiceText: {
    color: colors.textMuted,
    fontSize: typography.small,
    fontWeight: "800",
  },
  followupChoiceTextSelected: {
    color: colors.background,
    fontSize: typography.small,
    fontWeight: "900",
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

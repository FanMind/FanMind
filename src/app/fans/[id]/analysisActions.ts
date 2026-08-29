"use server";

import { revalidatePath } from "next/cache";
import { getAiTierConfig } from "@/config/aiTiers.mjs";
import {
  AI_ANALYSIS_MEMORY_ROW_LIMIT,
  AI_ANALYSIS_MESSAGE_ROW_LIMIT,
  AI_ANALYSIS_OUTPUT_TOKEN_LIMIT,
  AI_ANALYSIS_RATE_LIMIT_MAX,
  AI_ANALYSIS_RATE_LIMIT_WINDOW_MS,
  buildBoundedFanAnalysisPayload,
} from "@/lib/aiExecutionPolicy.mjs";
import { getFanMindAiModel, recordAiUsageEvent } from "@/lib/aiUsage";
import { consumeSharedRateLimit } from "@/lib/sharedRateLimit";
import { isWorkspaceArchivedAfterSubscriptionEnd } from "@/lib/subscriptionCancellation";
import {
  getRecentContactConversationMessages,
  getRecentContactMemories,
  getWorkspaceAnalysisCapabilityStatus,
  deleteContactAnalysisProfiles,
  upsertFanAnalysisReport,
} from "@/lib/supabase/server";
import {
  requireContactInActiveAuthorizedWorkspace,
  requireContactInActiveAuthorizedWorkspaceMember,
  requireContactInAuthorizedWorkspace,
} from "@/lib/workspaceAuthorization";
import { getResolvedWorkspaceAiTier } from "@/lib/workspaceAiTierEntitlements";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
const ANALYSIS_TIMEOUT_MS = 25_000;
const MAX_INSTRUCTION_LENGTH = 500;

type AnalysisMode = "short" | "standard" | "detailed";

type AnalysisReport = {
  kurzprofil: string;
  kommunikationsstil: string;
  stimmung: string;
  interessen_trigger: string;
  kauf_reaktion: string;
  antwortstil: string;
  no_gos: string;
  language: "de" | "en";
  analysis_mode: AnalysisMode;
};

export type FanAnalysisActionState = {
  ok: boolean;
  message: string;
  generatedAt?: string;
  report?: {
    report_json: Record<string, unknown> | null;
    summary: string | null;
    source_message_count: number | null;
    generated_at: string | null;
    updated_at?: string | null;
  } | null;
};

export async function deleteFanCommunicationProfile(
  _previousState: FanAnalysisActionState,
  formData: FormData,
): Promise<FanAnalysisActionState> {
  const contactId = formValue(formData, "contact_id");
  const locale = formValue(formData, "locale") === "en" ? "en" : "de";
  if (!contactId) return { ok: false, message: "Kontakt fehlt." };

  const { workspace } = await requireContactInAuthorizedWorkspace(contactId);
  const result = await deleteContactAnalysisProfiles({
    workspaceId: workspace.id,
    contactId,
  });
  if (result.error) {
    return {
      ok: false,
      message:
        locale === "en"
          ? "The derived communication profile could not be deleted completely."
          : "Das abgeleitete Kommunikationsprofil konnte nicht vollständig gelöscht werden.",
    };
  }

  revalidatePath(`/fans/${contactId}`);
  return {
    ok: true,
    message:
      locale === "en"
        ? "The derived communication profile was deleted. Stored chat history was not changed."
        : "Das abgeleitete Kommunikationsprofil wurde gelöscht. Der gespeicherte Chatverlauf blieb unverändert.",
    report: null,
  };
}

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
  error?: { message?: string };
  usage?: {
    input_tokens?: unknown;
    output_tokens?: unknown;
    total_tokens?: unknown;
  };
};

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "kurzprofil",
    "kommunikationsstil",
    "stimmung",
    "interessen_trigger",
    "kauf_reaktion",
    "antwortstil",
    "no_gos",
    "language",
  ],
  properties: {
    kurzprofil: { type: "string" },
    kommunikationsstil: { type: "string" },
    stimmung: { type: "string" },
    interessen_trigger: { type: "string" },
    kauf_reaktion: { type: "string" },
    antwortstil: { type: "string" },
    no_gos: { type: "string" },
    language: { type: "string", enum: ["de", "en"] },
  },
} as const;

function formValue(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function resolveMode(value: string): AnalysisMode {
  if (value === "standard" || value === "detailed") return value;
  return "short";
}

function fallbackReport(
  locale: "de" | "en",
  mode: AnalysisMode,
  lowDataHint: string,
): AnalysisReport {
  if (locale === "en") {
    return {
      kurzprofil:
        lowDataHint ||
        "Careful communication overview based only on the stored conversation.",
      kommunikationsstil:
        "The preferred communication style is not yet clear; stay friendly, concise, and respectful.",
      stimmung:
        "The current mood cannot be determined reliably from the available context.",
      interessen_trigger:
        "Use only explicitly mentioned interests and practical questions.",
      kauf_reaktion:
        "Do not predict a purchase; respond to the concrete question and offer a clear next step.",
      antwortstil:
        "Reply calmly, helpfully, and without pressure. The human reviews and sends manually.",
      no_gos:
        "No diagnoses, protected or sensitive inferences, pressure, invented facts, or image analysis.",
      language: locale,
      analysis_mode: mode,
    };
  }

  return {
    kurzprofil:
      lowDataHint ||
      "Vorsichtige Kommunikationsübersicht auf Basis des gespeicherten Austauschs.",
    kommunikationsstil:
      "Der bevorzugte Kommunikationsstil ist noch nicht eindeutig; freundlich, knapp und respektvoll bleiben.",
    stimmung:
      "Die aktuelle Stimmung ist aus dem vorhandenen Kontext nicht zuverlässig bestimmbar.",
    interessen_trigger:
      "Nur ausdrücklich genannte Interessen und konkrete Fragen berücksichtigen.",
    kauf_reaktion:
      "Keine Kaufprognose abgeben; auf die konkrete Frage eingehen und einen klaren nächsten Schritt anbieten.",
    antwortstil:
      "Ruhig, hilfreich und ohne Druck antworten. Der Mensch prüft und sendet manuell.",
    no_gos:
      "Keine Diagnosen, geschützten oder sensiblen Ableitungen, erfundenen Fakten, Druck oder Bildanalyse.",
    language: locale,
    analysis_mode: mode,
  };
}

function modeInstruction(mode: AnalysisMode, locale: "de" | "en"): string {
  if (locale === "en") {
    if (mode === "detailed") {
      return "Detailed mode: up to 3 concise sentences per section, still readable and non-repetitive.";
    }
    if (mode === "standard") {
      return "Standard mode: 1-2 concise sentences per section.";
    }
    return "Short mode: kurzprofil must fit in at most three short lines; every other section is one short sentence.";
  }

  if (mode === "detailed") {
    return "Ausführlicher Modus: höchstens drei knappe Sätze je Abschnitt, weiterhin gut lesbar und ohne Wiederholungen.";
  }
  if (mode === "standard") {
    return "Standardmodus: ein bis zwei knappe Sätze je Abschnitt.";
  }
  return "Kurzmodus: kurzprofil in höchstens drei kurzen Zeilen; alle weiteren Abschnitte jeweils nur ein kurzer Satz.";
}

function buildSystemPrompt(input: {
  locale: "de" | "en";
  mode: AnalysisMode;
  instruction: string;
}): string {
  const customInstruction = input.instruction
    ? input.locale === "en"
      ? `Additional user instruction: ${input.instruction}`
      : `Zusätzliche Nutzeranweisung: ${input.instruction}`
    : "";

  const rules =
    input.locale === "en"
      ? [
          "Create a practical communication overview in English.",
          "Use only the supplied contact data, notes, contact knowledge, and messages.",
          "Never infer religion, spirituality, health, psychology, diagnosis, ethnicity, sexuality, politics, or other protected or sensitive attributes.",
          "Do not present a purchase probability, personality judgment, or emotional state as a fact.",
          "Do not invent dates, prices, promises, availability, relationships, or events.",
          "Media attachments may only be mentioned as present; do not claim image analysis.",
          "Use cautious wording when the evidence is limited.",
          modeInstruction(input.mode, input.locale),
          customInstruction,
          "Return only JSON matching the required schema.",
        ]
      : [
          "Erstelle eine praktische Kommunikationsübersicht auf Deutsch.",
          "Nutze ausschließlich die gelieferten Kontaktdaten, Notizen, das Kontaktwissen und die gespeicherten Nachrichten.",
          "Leite niemals Religion, Spiritualität, Gesundheit, psychologische Diagnosen, Ethnie, Sexualität, Politik oder andere geschützte beziehungsweise sensible Eigenschaften ab.",
          "Stelle keine Kaufwahrscheinlichkeit, Persönlichkeitswertung oder Stimmung als sichere Tatsache dar.",
          "Erfinde keine Termine, Preise, Versprechen, Verfügbarkeiten, Beziehungen oder Ereignisse.",
          "Medien dürfen nur als vorhanden erwähnt werden; behaupte keine Bildanalyse.",
          "Formuliere bei geringer Datenlage ausdrücklich vorsichtig.",
          modeInstruction(input.mode, input.locale),
          customInstruction,
          "Gib ausschließlich JSON im vorgegebenen Schema zurück.",
        ];

  return rules.filter(Boolean).join("\n");
}

function outputText(response: OpenAiResponse | null): string {
  if (response?.output_text) return response.output_text;
  return (
    response?.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => item.text)
      .find((value): value is string => Boolean(value)) ?? ""
  );
}

function textValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeReport(
  value: unknown,
  fallback: AnalysisReport,
  mode: AnalysisMode,
  locale: "de" | "en",
): AnalysisReport {
  const parsed =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    kurzprofil: textValue(parsed.kurzprofil, fallback.kurzprofil),
    kommunikationsstil: textValue(
      parsed.kommunikationsstil,
      fallback.kommunikationsstil,
    ),
    stimmung: textValue(parsed.stimmung, fallback.stimmung),
    interessen_trigger: textValue(
      parsed.interessen_trigger,
      fallback.interessen_trigger,
    ),
    kauf_reaktion: textValue(parsed.kauf_reaktion, fallback.kauf_reaktion),
    antwortstil: textValue(parsed.antwortstil, fallback.antwortstil),
    no_gos: textValue(parsed.no_gos, fallback.no_gos),
    language: locale,
    analysis_mode: mode,
  };
}

export async function analyzeFanCommunication(
  _previousState: FanAnalysisActionState,
  formData: FormData,
  explicitAccessToken?: string,
): Promise<FanAnalysisActionState> {
  const contactId = formValue(formData, "contact_id");
  const locale = formValue(formData, "locale") === "en" ? "en" : "de";
  const mode = resolveMode(formValue(formData, "analysis_mode"));
  const instruction = formValue(formData, "analysis_instruction").slice(
    0,
    MAX_INSTRUCTION_LENGTH,
  );

  if (!contactId) {
    return { ok: false, message: "Kontakt fehlt." };
  }

  const { workspace, user, contact } = explicitAccessToken
    ? await requireContactInActiveAuthorizedWorkspaceMember(
        contactId,
        explicitAccessToken,
      )
    : await requireContactInActiveAuthorizedWorkspace(contactId);
  // Lifecycle guard only. Billing authorization requires server-owned
  // entitlement state before Standard/Plus/Ultra can be activated.
  if (isWorkspaceArchivedAfterSubscriptionEnd(workspace)) {
    return {
      ok: false,
      message:
        locale === "en"
          ? "This workspace is read-only after the subscription ended."
          : "Dieser Workspace ist nach Vertragsende im Lesemodus.",
    };
  }

  const analysisCapability = await getWorkspaceAnalysisCapabilityStatus(
    workspace.id,
    "fan_analysis",
  );
  if (!analysisCapability.enabled) {
    return {
      ok: false,
      message:
        locale === "en"
          ? "Fan analysis is disabled until this workspace's privacy and retention controls are confirmed."
          : "Die Fan-Analyse ist deaktiviert, bis Datenschutz- und Aufbewahrungskontrollen dieses Workspaces bestätigt sind.",
    };
  }

  let rateLimit;
  try {
    rateLimit = await consumeSharedRateLimit({
      scope: "ai_analysis_workspace_user",
      subject: `${workspace.id}:${user.id}`,
      maxRequests: AI_ANALYSIS_RATE_LIMIT_MAX,
      windowMs: AI_ANALYSIS_RATE_LIMIT_WINDOW_MS,
    });
  } catch {
    return {
      ok: false,
      message:
        locale === "en"
          ? "The communication overview cannot be started safely right now."
          : "Die Kommunikationsübersicht kann gerade nicht sicher gestartet werden.",
    };
  }

  if (!rateLimit.allowed) {
    return {
      ok: false,
      message:
        locale === "en"
          ? "Too many AI analyses. Please try again later."
          : "Zu viele KI-Analysen. Bitte versuche es später erneut.",
    };
  }

  const resolvedTier = await getResolvedWorkspaceAiTier(workspace.id);
  const contextMessageLimit =
    getAiTierConfig(resolvedTier.entitlement.effectiveTierId)
      .contextMessageLimit ?? AI_ANALYSIS_MESSAGE_ROW_LIMIT;

  const [messagesResult, memoriesResult] = await Promise.all([
    getRecentContactConversationMessages(
      workspace.id,
      contactId,
      contextMessageLimit,
      explicitAccessToken,
    ),
    getRecentContactMemories(
      workspace.id,
      contactId,
      AI_ANALYSIS_MEMORY_ROW_LIMIT,
      explicitAccessToken,
    ),
  ]);

  if (messagesResult.error) {
    return {
      ok: false,
      message:
        locale === "en"
          ? "Messages could not be loaded for the analysis."
          : "Nachrichten konnten für die Analyse nicht geladen werden.",
    };
  }
  if (memoriesResult.error) {
    return {
      ok: false,
      message:
        locale === "en"
          ? "Contact knowledge could not be loaded for the analysis."
          : "Kontaktwissen konnte für die Analyse nicht geladen werden.",
    };
  }

  let boundedInput: ReturnType<typeof buildBoundedFanAnalysisPayload>;
  try {
    boundedInput = buildBoundedFanAnalysisPayload({
      language: locale,
      analysisMode: mode,
      additionalInstruction: instruction,
      contact: {
        displayName: contact.display_name,
        handle: contact.handle,
        sourcePlatform: contact.source_platform,
        contactLanguage: contact.language,
        status: contact.status,
        tags: contact.tags ?? [],
        summary: contact.summary,
        internalNotes: contact.internal_notes ?? "",
      },
      contactKnowledge: memoriesResult.memories.map((memory) => ({
        type: memory.type,
        content: memory.content,
        importance: memory.importance,
        createdAt: memory.created_at,
      })),
      messages: messagesResult.messages.map((message) => ({
        direction: message.direction,
        channel: message.source_platform ?? "manual",
        origin: message.source_type ?? message.message_type ?? "unknown",
        author: message.author_label ?? message.original_author_label ?? null,
        text: message.content || message.original_text_excerpt || "",
        mediaPresent: Boolean(message.attachments?.length),
        createdAt: message.created_at,
      })),
      messageLimit: contextMessageLimit,
    });
  } catch {
    return {
      ok: false,
      message:
        locale === "en"
          ? "The communication context could not be prepared safely."
          : "Der Kommunikationskontext konnte nicht sicher vorbereitet werden.",
    };
  }

  const { payload, inputChars } = boundedInput;
  const sourceMessages = payload.messages;
  const lowDataHint =
    sourceMessages.length < 3
      ? locale === "en"
        ? "Only a small amount of message context is available."
        : "Es ist erst wenig Nachrichtenkontext vorhanden."
      : "";
  const fallback = fallbackReport(locale, mode, lowDataHint);
  const model = getFanMindAiModel();
  const apiKey = process.env.OPENAI_API_KEY;
  const startedAt = Date.now();
  let report = fallback;
  let userMessage = lowDataHint;

  if (!apiKey) {
    userMessage =
      locale === "en"
        ? "OpenAI is not configured. A careful interim overview was saved."
        : "OpenAI ist serverseitig nicht konfiguriert. Eine vorsichtige Zwischenübersicht wurde gespeichert.";
  } else if (sourceMessages.length > 0) {
    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          store: false,
          max_output_tokens: AI_ANALYSIS_OUTPUT_TOKEN_LIMIT,
          input: [
            {
              role: "system",
              content: buildSystemPrompt({ locale, mode, instruction }),
            },
            { role: "user", content: JSON.stringify(payload) },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "fanmind_communication_overview",
              strict: true,
              schema: analysisSchema,
            },
          },
        }),
        signal: AbortSignal.timeout(ANALYSIS_TIMEOUT_MS),
      });
      const responseBody = (await response.json().catch(() => null)) as
        | OpenAiResponse
        | null;
      const text = outputText(responseBody);

      if (!response.ok || !text) {
        await recordAiUsageEvent({
          workspaceId: workspace.id,
          userId: user.id,
          contactId,
          feature: "fan_analysis",
          model,
          inputChars,
          outputChars: text.length,
          status: "error",
          errorCode: response.ok ? "missing_output" : String(response.status),
          latencyMs: Date.now() - startedAt,
          sourceRoute: "src/app/fans/[id]/analysisActions.ts#analyzeFanCommunication",
          providerUsage: responseBody?.usage,
        });
        return {
          ok: false,
          message:
            locale === "en"
              ? "The communication overview could not be created."
              : "Die Kommunikationsübersicht konnte nicht erstellt werden.",
        };
      }

      report = normalizeReport(JSON.parse(text), fallback, mode, locale);
      await recordAiUsageEvent({
        workspaceId: workspace.id,
        userId: user.id,
        contactId,
        feature: "fan_analysis",
        model,
        inputChars,
        outputChars: text.length,
        status: "ok",
        latencyMs: Date.now() - startedAt,
        sourceRoute: "src/app/fans/[id]/analysisActions.ts#analyzeFanCommunication",
        providerUsage: responseBody?.usage,
      });
      userMessage =
        locale === "en"
          ? "Communication overview saved."
          : "Kommunikationsübersicht gespeichert.";
    } catch (error) {
      await recordAiUsageEvent({
        workspaceId: workspace.id,
        userId: user.id,
        contactId,
        feature: "fan_analysis",
        model,
        inputChars,
        outputChars: 0,
        status: "error",
        errorCode:
          error instanceof SyntaxError
            ? "invalid_json"
            : error instanceof Error && error.name === "TimeoutError"
              ? "timeout"
              : "exception",
        latencyMs: Date.now() - startedAt,
        sourceRoute: "src/app/fans/[id]/analysisActions.ts#analyzeFanCommunication",
      });
      return {
        ok: false,
        message:
          locale === "en"
            ? "The communication overview could not be created. Please try again."
            : "Die Kommunikationsübersicht konnte nicht erstellt werden. Bitte erneut versuchen.",
      };
    }
  } else {
    userMessage =
      locale === "en"
        ? "No messages are stored yet. A careful interim overview was saved."
        : "Noch keine Nachrichten gespeichert. Eine vorsichtige Zwischenübersicht wurde gespeichert.";
  }

  const result = await upsertFanAnalysisReport({
    workspaceId: workspace.id,
    contactId,
    reportJson: report,
    summary: report.kurzprofil,
    model:
      apiKey && sourceMessages.length > 0
        ? model
        : apiKey
          ? "fallback-no-messages"
          : "fallback-no-api-key",
    sourceMessageCount: sourceMessages.length,
  });

  if (result.error) {
    return {
      ok: false,
      message:
        locale === "en"
          ? "The communication overview could not be saved."
          : "Die Kommunikationsübersicht konnte nicht gespeichert werden.",
    };
  }

  revalidatePath(`/fans/${contactId}`);
  return {
    ok: true,
    message: userMessage,
    generatedAt: result.report?.generated_at ?? undefined,
    report: result.report
      ? {
          report_json: result.report.report_json as Record<string, unknown> | null,
          summary: result.report.summary,
          source_message_count: result.report.source_message_count,
          generated_at: result.report.generated_at,
          updated_at: result.report.updated_at,
        }
      : null,
  };
}

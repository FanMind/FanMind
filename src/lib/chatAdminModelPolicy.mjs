import { resolveFanMindAiQualityProfile } from "../config/openAiPriceCatalog.mjs";
import { CHAT_ADMIN_REPLY_INSTRUCTIONS, assertChatAdminReplySemantics, buildChatAdminFanContext } from "./chatAdminPolicy.mjs";

// Owner-authorized ChatAdmin upgrade only; this is not a paid-tier entitlement.
export function getChatAdminModelProfile() {
  const profile = resolveFanMindAiQualityProfile("premium");
  if (!profile) throw new Error("chat_admin_model_unavailable");
  // Keep the strongest model; short chat replies do not need maximum reasoning.
  return Object.freeze({ ...profile, reasoningEffort: "medium" });
}
export const CHAT_ADMIN_MODEL_TIMEOUT_MS = 55_000;
export function buildChatAdminModelRequest(context) {
  const profile = getChatAdminModelProfile();
  return {
    model: profile.model,
    // Provider API calls standard processing "default"; catalog calls it "standard".
    service_tier: "default",
    reasoning: { effort: profile.reasoningEffort },
    input: [{ role: "system", content: CHAT_ADMIN_REPLY_INSTRUCTIONS }, { role: "user", content: context }],
    text: { format: { type: "json_schema", name: "chat_admin_replies", strict: true, schema: {
      type: "object", additionalProperties: false, required: ["replies"],
      properties: { replies: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", minLength: 1 } } },
    } } },
    // Includes reasoning tokens; instructions still request short visible replies.
    max_output_tokens: 8192,
    store: false,
  };
}
function probeFailure(code) { return Object.assign(new Error("chat_admin_model_probe_failed"), {code}); }
export async function verifyChatAdminModelProvider({apiKey, fetchImpl = fetch}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) throw probeFailure("KEY_MISSING");
  const incoming = "Was hast du für Fotos für mich?";
  // Exercise the real context builder and a full 20-turn history. All identities
  // and content are local fixtures; this probe never reads or writes the database.
  const workspaceId = "synthetic-workspace", characterId = "synthetic-character";
  const fanId = "synthetic-fan", conversationId = "synthetic-conversation";
  const character = {
    id: characterId, workspace_id: workspaceId, revision: 1, status: "active",
    display_name: "Synthetic", public_age: 25, bio: "Fiktive erwachsene Testpersona für einen technischen Freigabetest.",
    location: null, languages: ["Deutsch"], personality: "freundlich, aufmerksam, entspannt",
    writing_style: "kurz, natürlich, freundlich", emoji_style: "sparsam", sentence_style: "kurz",
    typical_phrases: ["Erzähl mal"], forbidden_phrases: ["Als KI"], flirt_style: "respektvoll",
    sales_rules: "Keine erfundenen Preise, kein Druck, bei fehlendem Angebot nachfragen.",
    example_messages: ["Welche Motive gefallen dir denn?"],
  };
  const fan = { id: fanId, workspace_id: workspaceId, character_id: characterId, status: "active",
    display_name: "Synthetic Fan", platform: "OnlyFans", language: "Deutsch", customer_tier: "red",
    summary: "Mag kurze Antworten und natürliche Fotomotive.", notes: "Keine Preise oder Inhalte versprechen, die nicht im Angebot stehen." };
  const conversation = { id: conversationId, workspace_id: workspaceId, character_id: characterId, fan_id: fanId };
  const messages = Array.from({ length: 20 }, (_, index) => ({
    id: `synthetic-message-${index}`, workspace_id: workspaceId, character_id: characterId,
    fan_id: fanId, conversation_id: conversationId,
    direction: index % 2 === 0 ? "fan_inbound" : "confirmed_reply",
    content: index % 2 === 0
      ? "Ich mag natürliche Fotos und kurze persönliche Antworten. Wie war dein Tag? Ich war draußen spazieren, habe ein paar Landschaften fotografiert und genieße jetzt einen ruhigen Abend. Was macht dir beim Fotografieren am meisten Spaß?"
      : "Mein Tag war entspannt. Ich mag natürliches Licht und spontane Motive, weil dabei schöne kleine Momente entstehen. Erzähl mir gern, welche Fotos dir gefallen. Wir können ohne Druck darüber reden und müssen nichts überstürzen.",
    created_at: new Date(Date.UTC(2026, 9, 14, 12, index)).toISOString(),
  }));
  const context = buildChatAdminFanContext(character, fan, conversation, messages, incoming, 80_000, Date.UTC(2026, 9, 14, 13));
  const request = buildChatAdminModelRequest(context);
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(request), signal: AbortSignal.timeout(CHAT_ADMIN_MODEL_TIMEOUT_MS), cache: "no-store",
  });
  if (!response.ok) throw probeFailure(response.status === 401 || response.status === 403 ? "ACCESS_DENIED" : response.status === 404 ? "MODEL_UNAVAILABLE" : response.status === 429 ? "RATE_LIMITED" : "PROVIDER_ERROR");
  const payload = await response.json();
  if (payload.status !== "completed" || typeof payload.model !== "string" || !(payload.model === request.model || payload.model.startsWith(`${request.model}-`))) throw probeFailure("RESPONSE_BINDING");
  const text = payload.output_text ?? payload.output?.flatMap(value => value.content ?? []).map(value => value.text ?? "").join("");
  assertChatAdminReplySemantics(JSON.parse(text).replies, incoming, null);
  return true;
}

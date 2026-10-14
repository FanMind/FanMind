import { resolveFanMindAiQualityProfile } from "../config/openAiPriceCatalog.mjs";
import { CHAT_ADMIN_REPLY_INSTRUCTIONS, assertChatAdminReplySemantics } from "./chatAdminPolicy.mjs";

// Owner-authorized ChatAdmin upgrade only; this is not a paid-tier entitlement.
export function getChatAdminModelProfile() {
  const profile = resolveFanMindAiQualityProfile("premium");
  if (!profile) throw new Error("chat_admin_model_unavailable");
  return profile;
}
export const CHAT_ADMIN_MODEL_TIMEOUT_MS = 45_000;
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
    // Includes reasoning tokens; visible replies retain the existing short-output guard.
    max_output_tokens: 8192,
    store: false,
  };
}
function probeFailure(code) { return Object.assign(new Error("chat_admin_model_probe_failed"), {code}); }
export async function verifyChatAdminModelProvider({apiKey, fetchImpl = fetch}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) throw probeFailure("KEY_MISSING");
  const incoming = "Hallo, deine Fotos sind schön.";
  const context = JSON.stringify({ incoming_message: incoming, character: { display_name: "Synthetic", public_age: 25, writing_style: "kurz, natürlich, freundlich", bio: "Fiktiver technischer Prüffall" }, sales_playbook: { requested_offer: null, offers: [] } });
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

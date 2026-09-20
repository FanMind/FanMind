import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import { normalizeOpenAiResponseUsage } from "@/lib/aiUsageProviderMetrics.mjs";

export type AiUsageFeature = "reply_suggestions" | "chat_admin_reply" | "fan_analysis" | "conversation_summary" | "memory_suggestion" | "followup_suggestion" | "campaign_draft_preview";
export type AiUsageStatus = "ok" | "error" | "skipped";

export type RecordAiUsageEventInput = {
  workspaceId: string;
  userId?: string | null;
  contactId?: string | null;
  feature: AiUsageFeature;
  model: string;
  inputChars: number;
  outputChars?: number;
  status: AiUsageStatus;
  errorCode?: string | null;
  latencyMs?: number | null;
  sourceRoute?: string | null;
  provider?: string;
  providerUsage?: unknown;
};

const DEFAULT_CURRENCY = "USD";

export function getFanMindAiModel(): string {
  return process.env.FANMIND_AI_MODEL?.trim() || "gpt-5.2";
}

export function estimateTokensFromChars(chars: number): number {
  return Math.max(0, Math.ceil(Math.max(0, chars) / 4));
}

function modelPricePerMillionTokens(model: string, direction: "input" | "output"): number {
  const normalized = model.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  const specific = process.env[`FANMIND_AI_PRICE_${normalized}_${direction.toUpperCase()}_PER_MILLION_CENTS`];
  const fallback = process.env[`FANMIND_AI_PRICE_${direction.toUpperCase()}_PER_MILLION_CENTS`];
  const parsed = Number(specific ?? fallback ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function estimateAiCostCents(inputTokens: number, outputTokens: number, model: string): number {
  const inputCost = (inputTokens / 1_000_000) * modelPricePerMillionTokens(model, "input");
  const outputCost = (outputTokens / 1_000_000) * modelPricePerMillionTokens(model, "output");
  return Number((inputCost + outputCost).toFixed(6));
}

export async function recordAiUsageEvent(input: RecordAiUsageEventInput): Promise<void> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return;

  const inputChars = Math.max(0, Math.round(input.inputChars));
  const outputChars = Math.max(0, Math.round(input.outputChars ?? 0));
  const providerUsage = normalizeOpenAiResponseUsage(input.providerUsage);
  const recordedInputTokens =
    providerUsage?.inputTokens ?? estimateTokensFromChars(inputChars);
  const recordedOutputTokens =
    providerUsage?.outputTokens ?? estimateTokensFromChars(outputChars);
  const recordedTotalTokens =
    providerUsage?.totalTokens ?? recordedInputTokens + recordedOutputTokens;

  const body = {
    workspace_id: input.workspaceId,
    user_id: input.userId ?? null,
    contact_id: input.contactId ?? null,
    feature: input.feature,
    model: input.model,
    provider: input.provider ?? "openai",
    input_chars: inputChars,
    output_chars: outputChars,
    estimated_input_tokens: recordedInputTokens,
    estimated_output_tokens: recordedOutputTokens,
    estimated_total_tokens: recordedTotalTokens,
    estimated_cost_cents: estimateAiCostCents(
      recordedInputTokens,
      recordedOutputTokens,
      input.model,
    ),
    currency: process.env.FANMIND_AI_USAGE_CURRENCY?.trim() || DEFAULT_CURRENCY,
    status: input.status,
    error_code: input.errorCode ?? null,
    latency_ms: input.latencyMs == null ? null : Math.max(0, Math.round(input.latencyMs)),
    source_route: input.sourceRoute ?? null,
  };

  try {
    await fetch(getSupabaseRestUrl("ai_usage_events"), {
      method: "POST",
      headers: { ...getSupabaseHeaders(serviceKey), Prefer: "return=minimal" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    // Usage logging must never break the user-facing AI workflow.
  }
}

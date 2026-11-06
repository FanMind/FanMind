import { calculateAiUsageIndicator } from "@/lib/aiUsagePolicy.mjs";
import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";

export type WorkspaceAiUsageEvent = {
  id: string;
  feature: string;
  model: string;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_total_tokens: number;
  status: string;
  error_code: string | null;
  created_at: string;
};

export type WorkspaceAiUsageFeatureSummary = {
  feature: string;
  requests: number;
  successfulRequests: number;
  errorRequests: number;
  estimatedTokens: number;
};

export type WorkspaceAiUsageIndicator = {
  configured: boolean;
  level: "unconfigured" | "normal" | "warning" | "attention";
  usageRatio: number | null;
  usagePercent: number | null;
  requestWarning: number | null;
  tokenWarning: number | null;
};

export type WorkspaceAiUsageSummary = {
  periodStart: string;
  periodEnd: string;
  totalRequests: number;
  successfulRequests: number;
  errorRequests: number;
  skippedRequests: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  byFeature: WorkspaceAiUsageFeatureSummary[];
  recentEvents: WorkspaceAiUsageEvent[];
  indicator: WorkspaceAiUsageIndicator;
  truncated: boolean;
};

const USAGE_COLUMNS =
  "id,feature,model,estimated_input_tokens,estimated_output_tokens,estimated_total_tokens,status,error_code,created_at";
const PAGE_SIZE = 1000;
const MAX_EVENTS = 10_000;

function currentMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function parseOptionalPositiveInteger(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null;
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

async function fetchWorkspaceUsageEvents(input: {
  workspaceId: string;
  periodStart: string;
  periodEnd: string;
}): Promise<{
  events: WorkspaceAiUsageEvent[];
  truncated: boolean;
  error: string | null;
}> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return {
      events: [],
      truncated: false,
      error: "KI-Nutzung ist serverseitig noch nicht konfiguriert.",
    };
  }

  const events: WorkspaceAiUsageEvent[] = [];

  try {
    for (let offset = 0; offset < MAX_EVENTS; offset += PAGE_SIZE) {
      const url = new URL(getSupabaseRestUrl("ai_usage_events"));
      url.searchParams.set("select", USAGE_COLUMNS);
      url.searchParams.set("workspace_id", `eq.${input.workspaceId}`);
      url.searchParams.set("created_at", `gte.${input.periodStart}`);
      url.searchParams.append("created_at", `lt.${input.periodEnd}`);
      url.searchParams.set("order", "created_at.desc");
      url.searchParams.set("limit", String(PAGE_SIZE));
      url.searchParams.set("offset", String(offset));

      const response = await fetch(url, {
        headers: getSupabaseHeaders(serviceKey),
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });

      if (!response.ok) {
        return {
          events: [],
          truncated: false,
          error: `KI-Nutzung konnte nicht geladen werden (${response.status}).`,
        };
      }

      const page = (await response.json()) as WorkspaceAiUsageEvent[];
      events.push(...page);
      if (page.length < PAGE_SIZE) {
        return { events, truncated: false, error: null };
      }
    }

    return { events, truncated: true, error: null };
  } catch {
    return {
      events: [],
      truncated: false,
      error: "KI-Nutzung konnte nicht geladen werden.",
    };
  }
}

export async function getWorkspaceAiUsageSummary(
  workspaceId: string,
  now = new Date(),
): Promise<{ summary: WorkspaceAiUsageSummary | null; error: string | null }> {
  const periodStart = currentMonthStart(now);
  const periodEnd = now;
  const result = await fetchWorkspaceUsageEvents({
    workspaceId,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  });

  if (result.error) return { summary: null, error: result.error };

  const byFeature = new Map<string, WorkspaceAiUsageFeatureSummary>();
  let successfulRequests = 0;
  let errorRequests = 0;
  let skippedRequests = 0;
  let estimatedInputTokens = 0;
  let estimatedOutputTokens = 0;
  let estimatedTotalTokens = 0;

  for (const event of result.events) {
    const inputTokens = safeNumber(event.estimated_input_tokens);
    const outputTokens = safeNumber(event.estimated_output_tokens);
    const totalTokens = safeNumber(event.estimated_total_tokens);

    estimatedInputTokens += inputTokens;
    estimatedOutputTokens += outputTokens;
    estimatedTotalTokens += totalTokens;

    if (event.status === "ok") successfulRequests += 1;
    else if (event.status === "error") errorRequests += 1;
    else skippedRequests += 1;

    const current = byFeature.get(event.feature) ?? {
      feature: event.feature,
      requests: 0,
      successfulRequests: 0,
      errorRequests: 0,
      estimatedTokens: 0,
    };
    current.requests += 1;
    current.estimatedTokens += totalTokens;
    if (event.status === "ok") current.successfulRequests += 1;
    if (event.status === "error") current.errorRequests += 1;
    byFeature.set(event.feature, current);
  }

  const requestWarning = parseOptionalPositiveInteger(
    process.env.FANMIND_AI_STANDARD_SOFT_REQUEST_WARNING,
  );
  const tokenWarning = parseOptionalPositiveInteger(
    process.env.FANMIND_AI_STANDARD_SOFT_TOKEN_WARNING,
  );
  const indicator = calculateAiUsageIndicator({
    requests: result.events.length,
    tokens: estimatedTotalTokens,
    requestWarning,
    tokenWarning,
  }) as WorkspaceAiUsageIndicator;

  return {
    summary: {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalRequests: result.events.length,
      successfulRequests,
      errorRequests,
      skippedRequests,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      byFeature: [...byFeature.values()].sort(
        (a, b) => b.requests - a.requests || b.estimatedTokens - a.estimatedTokens,
      ),
      recentEvents: result.events.slice(0, 10),
      indicator,
      truncated: result.truncated,
    },
    error: null,
  };
}

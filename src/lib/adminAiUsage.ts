import { getSupabaseHeaders, getSupabaseRestUrl } from "@/lib/supabase/config";
import {
  calculateAiCostPerContactMetrics,
  parsePostgrestExactCount,
} from "@/lib/aiUsageCostMetrics.mjs";
import {
  aggregateAiUsageByModel,
  aggregateAiUsageTokenDistributionByFeature,
  calculateAiBudgetIndicator,
  calculateAiUsageSpikeIndicator,
} from "@/lib/aiUsageDashboardMetrics.mjs";

export type AdminAiUsageEvent = {
  id: string;
  workspace_id: string;
  feature: string;
  model: string;
  input_chars: number;
  output_chars: number;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_total_tokens: number;
  estimated_cost_cents: number;
  currency: string;
  status: string;
  error_code: string | null;
  latency_ms: number | null;
  source_route: string | null;
  created_at: string;
};

type WorkspaceRow = { id: string; name: string | null; plan_id: string | null; commercial_option: string | null };

export type AdminAiUsageWorkspaceSummary = {
  workspaceId: string;
  workspaceName: string;
  requests: number;
  estimatedCostCents: number;
  inputTokens: number;
  outputTokens: number;
  contactCount: number | null;
  estimatedCostPerFanCents: number | null;
  estimatedCostPerHundredFansCents: number | null;
  estimatedCostPerThousandFansCents: number | null;
};

export type AdminAiUsageSummary = {
  totalRequests: number;
  totalEstimatedCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  errorRequests: number;
  currency: string;
  byWorkspace: AdminAiUsageWorkspaceSummary[];
  byFeature: Array<{ feature: string; requests: number; estimatedCostCents: number; errorRequests: number }>;
  byFeatureTokenDistribution: ReturnType<
    typeof aggregateAiUsageTokenDistributionByFeature
  >;
  byModel: Array<{ model: string; requests: number; estimatedCostCents: number; inputTokens: number; outputTokens: number; errorRequests: number }>;
  recentEvents: AdminAiUsageEvent[];
  periodStart: string;
  periodEnd: string;
  truncated: boolean;
  previousPeriodTruncated: boolean;
  budgetIndicator: ReturnType<typeof calculateAiBudgetIndicator>;
  spikeIndicator: ReturnType<typeof calculateAiUsageSpikeIndicator>;
};

const COLUMNS = "id,workspace_id,feature,model,input_chars,output_chars,estimated_input_tokens,estimated_output_tokens,estimated_total_tokens,estimated_cost_cents,currency,status,error_code,latency_ms,source_route,created_at";
const ADMIN_USAGE_PAGE_SIZE = 1_000;
const MAX_ADMIN_USAGE_EVENTS = 10_000;

function serviceKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }

function positiveNumber(value: string | undefined, fallback: number | null): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function estimatedCost(events: AdminAiUsageEvent[]): number {
  return events.reduce(
    (sum, event) => sum + Math.max(0, Number(event.estimated_cost_cents) || 0),
    0,
  );
}

function currentUtcMonthStart(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function loadAdminUsageEvents(
  input: { periodStart: string; periodEnd: string },
  key: string,
): Promise<{ events: AdminAiUsageEvent[]; truncated: boolean }> {
  const events: AdminAiUsageEvent[] = [];

  for (
    let offset = 0;
    offset < MAX_ADMIN_USAGE_EVENTS;
    offset += ADMIN_USAGE_PAGE_SIZE
  ) {
    const usageUrl = new URL(getSupabaseRestUrl("ai_usage_events"));
    usageUrl.searchParams.set("select", COLUMNS);
    usageUrl.searchParams.set("created_at", `gte.${input.periodStart}`);
    usageUrl.searchParams.append("created_at", `lt.${input.periodEnd}`);
    usageUrl.searchParams.set("order", "created_at.desc");
    usageUrl.searchParams.set("limit", String(ADMIN_USAGE_PAGE_SIZE));
    usageUrl.searchParams.set("offset", String(offset));
    const response = await fetch(usageUrl, {
      headers: getSupabaseHeaders(key),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      throw new Error(
        `KI-Verbrauch konnte nicht geladen werden (${response.status}). Migration evtl. noch nicht live.`,
      );
    }

    const page = (await response.json()) as AdminAiUsageEvent[];
    events.push(...page);
    if (page.length < ADMIN_USAGE_PAGE_SIZE) {
      return { events, truncated: false };
    }
  }

  return { events, truncated: true };
}

async function loadWorkspaceContactCounts(
  workspaceIds: string[],
  key: string,
): Promise<Map<string, number | null>> {
  const counts = new Map<string, number | null>();
  let cursor = 0;
  const workerCount = Math.min(8, workspaceIds.length);

  async function loadNext() {
    while (cursor < workspaceIds.length) {
      const workspaceId = workspaceIds[cursor];
      cursor += 1;
      const url = new URL(getSupabaseRestUrl("contacts"));
      url.searchParams.set("select", "id");
      url.searchParams.set("workspace_id", `eq.${workspaceId}`);
      try {
        const response = await fetch(url, {
          headers: {
            ...getSupabaseHeaders(key),
            Range: "0-0",
            Prefer: "count=exact",
          },
          cache: "no-store",
        });
        counts.set(
          workspaceId,
          response.ok
            ? parsePostgrestExactCount(response.headers.get("content-range"))
            : null,
        );
      } catch {
        counts.set(workspaceId, null);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => loadNext()));
  return counts;
}

export async function getAdminAiUsageSummary(days = 30, now = new Date()): Promise<{ summary: AdminAiUsageSummary | null; error: string | null }> {
  const key = serviceKey();
  if (!key) return { summary: null, error: "Supabase Service Role ist nicht konfiguriert." };
  const selectedDays = Math.max(1, Math.min(days, 365));
  const periodEnd = now;
  const periodStart = new Date(
    periodEnd.getTime() - selectedDays * 24 * 60 * 60 * 1000,
  );
  const previousPeriodStart = new Date(
    periodStart.getTime() - selectedDays * 24 * 60 * 60 * 1000,
  );
  const monthlyBudgetCents = positiveNumber(
    process.env.FANMIND_AI_ADMIN_MONTHLY_BUDGET_CENTS,
    null,
  );
  try {
    const [currentPeriod, previousPeriod, monthlyPeriod] = await Promise.all([
      loadAdminUsageEvents(
        {
          periodStart: periodStart.toISOString(),
          periodEnd: periodEnd.toISOString(),
        },
        key,
      ),
      loadAdminUsageEvents(
        {
          periodStart: previousPeriodStart.toISOString(),
          periodEnd: periodStart.toISOString(),
        },
        key,
      ),
      monthlyBudgetCents === null
        ? Promise.resolve({ events: [] as AdminAiUsageEvent[], truncated: false })
        : loadAdminUsageEvents(
            {
              periodStart: currentUtcMonthStart(now).toISOString(),
              periodEnd: periodEnd.toISOString(),
            },
            key,
          ),
    ]);
    const events = currentPeriod.events;
    const workspaceIds = [...new Set(events.map((event) => event.workspace_id))];
    const workspaces = new Map<string, WorkspaceRow>();
    const contactCountsPromise = loadWorkspaceContactCounts(workspaceIds, key);
    if (workspaceIds.length) {
      const workspaceUrl = new URL(getSupabaseRestUrl("workspaces"));
      workspaceUrl.searchParams.set("select", "id,name,plan_id,commercial_option");
      workspaceUrl.searchParams.set("id", `in.(${workspaceIds.join(",")})`);
      const workspaceResponse = await fetch(workspaceUrl, { headers: getSupabaseHeaders(key), cache: "no-store" });
      if (workspaceResponse.ok) {
        for (const workspace of await workspaceResponse.json() as WorkspaceRow[]) workspaces.set(workspace.id, workspace);
      }
    }
    const contactCounts = await contactCountsPromise;

    const byWorkspace = new Map<string, AdminAiUsageWorkspaceSummary>();
    const byFeature = new Map<string, { feature: string; requests: number; estimatedCostCents: number; errorRequests: number }>();
    for (const event of events) {
      const cost = Number(event.estimated_cost_cents ?? 0);
      const workspace = byWorkspace.get(event.workspace_id) ?? {
        workspaceId: event.workspace_id,
        workspaceName: workspaces.get(event.workspace_id)?.name ?? event.workspace_id,
        requests: 0,
        estimatedCostCents: 0,
        inputTokens: 0,
        outputTokens: 0,
        contactCount: contactCounts.get(event.workspace_id) ?? null,
        estimatedCostPerFanCents: null,
        estimatedCostPerHundredFansCents: null,
        estimatedCostPerThousandFansCents: null,
      };
      workspace.requests += 1; workspace.estimatedCostCents += cost; workspace.inputTokens += event.estimated_input_tokens; workspace.outputTokens += event.estimated_output_tokens; byWorkspace.set(event.workspace_id, workspace);
      const feature = byFeature.get(event.feature) ?? { feature: event.feature, requests: 0, estimatedCostCents: 0, errorRequests: 0 };
      feature.requests += 1; feature.estimatedCostCents += cost; if (event.status === "error") feature.errorRequests += 1; byFeature.set(event.feature, feature);
    }

    const workspaceSummaries = [...byWorkspace.values()].map((workspace) => {
      const metrics = calculateAiCostPerContactMetrics(
        workspace.estimatedCostCents,
        workspace.contactCount,
      );
      return {
        ...workspace,
        estimatedCostPerFanCents: metrics.perFanCents,
        estimatedCostPerHundredFansCents: metrics.perHundredFansCents,
        estimatedCostPerThousandFansCents: metrics.perThousandFansCents,
      };
    });

    const totalEstimatedCostCents = estimatedCost(events);
    const budgetIndicator = calculateAiBudgetIndicator({
      currentCostCents: estimatedCost(monthlyPeriod.events),
      budgetCents: monthlyBudgetCents,
      truncated: monthlyPeriod.truncated,
    });
    const spikeIndicator = calculateAiUsageSpikeIndicator({
      currentRequests: events.length,
      previousRequests: previousPeriod.events.length,
      currentCostCents: totalEstimatedCostCents,
      previousCostCents: estimatedCost(previousPeriod.events),
      ratioThreshold: positiveNumber(
        process.env.FANMIND_AI_ADMIN_SPIKE_RATIO,
        2,
      ),
      minRequests: positiveNumber(
        process.env.FANMIND_AI_ADMIN_SPIKE_MIN_REQUESTS,
        10,
      ),
      minCostCents: positiveNumber(
        process.env.FANMIND_AI_ADMIN_SPIKE_MIN_COST_CENTS,
        100,
      ),
      currentTruncated: currentPeriod.truncated,
      previousTruncated: previousPeriod.truncated,
    });

    return { summary: { totalRequests: events.length, totalEstimatedCostCents, totalInputTokens: events.reduce((sum, event) => sum + event.estimated_input_tokens, 0), totalOutputTokens: events.reduce((sum, event) => sum + event.estimated_output_tokens, 0), errorRequests: events.filter((event) => event.status === "error").length, currency: events[0]?.currency ?? (process.env.FANMIND_AI_USAGE_CURRENCY?.trim() || "USD"), byWorkspace: workspaceSummaries.sort((a, b) => b.estimatedCostCents - a.estimatedCostCents), byFeature: [...byFeature.values()].sort((a, b) => b.estimatedCostCents - a.estimatedCostCents), byFeatureTokenDistribution: aggregateAiUsageTokenDistributionByFeature(events), byModel: aggregateAiUsageByModel(events), recentEvents: events.slice(0, 25), periodStart: periodStart.toISOString(), periodEnd: periodEnd.toISOString(), truncated: currentPeriod.truncated, previousPeriodTruncated: previousPeriod.truncated, budgetIndicator, spikeIndicator }, error: null };
  } catch { return { summary: null, error: "KI-Nutzung konnte nicht geladen werden." }; }
}

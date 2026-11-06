import "server-only";

import {
  getAiTierRuntimeReadinessFromEnvironment,
  resolveWorkspaceAiTierEntitlement,
} from "@/config/aiTiers.mjs";
import {
  isWorkspaceAiTierStorageWorkspaceId,
  normalizeWorkspaceAiTierStorageRows,
  unavailableWorkspaceAiTierStorage,
  type WorkspaceAiTierStorageResult,
} from "@/lib/workspaceAiTierStorage.mjs";
import {
  getSupabaseHeaders,
  getSupabaseRestUrl,
} from "@/lib/supabase/config";

const UNAVAILABLE_MESSAGE =
  "Die KI-Stufe konnte serverseitig nicht verifiziert werden.";

type WorkspaceAiTierEntitlement = ReturnType<
  typeof resolveWorkspaceAiTierEntitlement
>;

export type ResolvedWorkspaceAiTier = Readonly<{
  storageStatus: WorkspaceAiTierStorageResult["status"];
  entitlement: WorkspaceAiTierEntitlement;
  error: string | null;
}>;

function standardFallback(
  storage: WorkspaceAiTierStorageResult,
): ResolvedWorkspaceAiTier {
  return {
    storageStatus: storage.status,
    entitlement: resolveWorkspaceAiTierEntitlement(),
    error: storage.status === "unavailable" ? UNAVAILABLE_MESSAGE : null,
  };
}

export async function getResolvedWorkspaceAiTier(
  workspaceId: string,
): Promise<ResolvedWorkspaceAiTier> {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    return standardFallback(
      unavailableWorkspaceAiTierStorage("configuration"),
    );
  }
  if (!isWorkspaceAiTierStorageWorkspaceId(workspaceId)) {
    return standardFallback(
      unavailableWorkspaceAiTierStorage("invalid_workspace"),
    );
  }

  try {
    const url = new URL(
      getSupabaseRestUrl("workspace_ai_tier_entitlements"),
    );
    url.searchParams.set(
      "select",
      [
        "workspace_id",
        "tier_id",
        "status",
        "source",
        "stripe_subscription_id",
        "stripe_subscription_item_id",
        "stripe_price_id",
        "effective_at",
        "expires_at",
        "last_stripe_event_id",
        "last_stripe_event_created_at",
        "stripe_sync_state",
        "stripe_sync_revision",
      ].join(","),
    );
    url.searchParams.set("workspace_id", `eq.${workspaceId}`);
    url.searchParams.set("limit", "2");

    const response = await fetch(url, {
      headers: getSupabaseHeaders(serviceKey),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return standardFallback(
        unavailableWorkspaceAiTierStorage("upstream"),
      );
    }

    const storage = normalizeWorkspaceAiTierStorageRows(
      await response.json(),
      workspaceId,
    );
    if (storage.status !== "found" || !storage.entitlement) {
      return standardFallback(storage);
    }

    return {
      storageStatus: "found",
      entitlement: resolveWorkspaceAiTierEntitlement(
        storage.entitlement,
        getAiTierRuntimeReadinessFromEnvironment(
          storage.entitlement.tierId,
        ),
      ),
      error: null,
    };
  } catch {
    return standardFallback(
      unavailableWorkspaceAiTierStorage("upstream"),
    );
  }
}

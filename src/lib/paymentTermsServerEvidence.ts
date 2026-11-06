import "server-only";

import {
  CURRENT_PAYMENT_TERMS_VERSION,
  isPaymentTermsActivationEnabled,
  PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS,
} from "@/lib/paymentTermsActivationPolicy.mjs";
import { getSupabaseApiKeyHeaders } from "@/lib/supabase/config";

const MAX_ACCEPTANCE_CLOCK_SKEW_MS = 5 * 60 * 1000;

type WorkspacePaymentTermsEvidenceRow = {
  id?: unknown;
  owner_user_id?: unknown;
  payment_terms_version?: unknown;
  payment_terms_accepted_at?: unknown;
  payment_terms_accepted_by_user_id?: unknown;
};

export type WorkspacePaymentTermsEvidenceDecision = {
  ready: boolean;
  code:
    | "ready"
    | "version_unresolved"
    | "invalid_identity"
    | "server_configuration_missing"
    | "evidence_unavailable"
    | "evidence_ambiguous"
    | "owner_mismatch"
    | "version_mismatch"
    | "accepted_at_invalid"
    | "accepted_at_before_window"
    | "accepted_at_future"
    | "accepted_by_mismatch";
};

function decision(
  ready: boolean,
  code: WorkspacePaymentTermsEvidenceDecision["code"],
): WorkspacePaymentTermsEvidenceDecision {
  return Object.freeze({ ready, code });
}

function validUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value,
    )
  );
}

export function evaluateWorkspacePaymentTermsEvidence(
  row: WorkspacePaymentTermsEvidenceRow | null | undefined,
  {
    workspaceId,
    userId,
    now = Date.now(),
    activationEnabled = isPaymentTermsActivationEnabled(),
  }: {
    workspaceId: string;
    userId: string;
    now?: number | Date;
    activationEnabled?: boolean;
  },
): WorkspacePaymentTermsEvidenceDecision {
  if (activationEnabled !== true) return decision(false, "version_unresolved");
  if (!validUuid(workspaceId) || !validUuid(userId)) {
    return decision(false, "invalid_identity");
  }
  if (!row || row.id !== workspaceId) return decision(false, "evidence_unavailable");
  if (row.owner_user_id !== userId) return decision(false, "owner_mismatch");
  if (row.payment_terms_version !== CURRENT_PAYMENT_TERMS_VERSION) {
    return decision(false, "version_mismatch");
  }
  if (row.payment_terms_accepted_by_user_id !== userId) {
    return decision(false, "accepted_by_mismatch");
  }

  const acceptedAt =
    typeof row.payment_terms_accepted_at === "string"
      ? Date.parse(row.payment_terms_accepted_at)
      : Number.NaN;
  const nowTimestamp = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(acceptedAt) || !Number.isFinite(nowTimestamp)) {
    return decision(false, "accepted_at_invalid");
  }
  if (acceptedAt < PAYMENT_TERMS_ACCEPTED_NOT_BEFORE_MS) {
    return decision(false, "accepted_at_before_window");
  }
  if (acceptedAt > nowTimestamp + MAX_ACCEPTANCE_CLOCK_SKEW_MS) {
    return decision(false, "accepted_at_future");
  }

  return decision(true, "ready");
}

export async function getWorkspacePaymentTermsEvidence(
  workspaceId: string,
  userId: string,
): Promise<WorkspacePaymentTermsEvidenceDecision> {
  if (!isPaymentTermsActivationEnabled()) {
    return decision(false, "version_unresolved");
  }
  if (!validUuid(workspaceId) || !validUuid(userId)) {
    return decision(false, "invalid_identity");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/u, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) {
    return decision(false, "server_configuration_missing");
  }

  const query = new URLSearchParams({
    select:
      "id,owner_user_id,payment_terms_version,payment_terms_accepted_at,payment_terms_accepted_by_user_id",
    id: `eq.${workspaceId}`,
    limit: "2",
  });

  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/workspaces?${query}`, {
      method: "GET",
      headers: {
        ...getSupabaseApiKeyHeaders(serviceRoleKey),
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return decision(false, "evidence_unavailable");

    const payload = (await response.json().catch(() => null)) as unknown;
    if (!Array.isArray(payload)) return decision(false, "evidence_unavailable");
    if (payload.length !== 1) {
      return decision(
        false,
        payload.length > 1 ? "evidence_ambiguous" : "evidence_unavailable",
      );
    }

    return evaluateWorkspacePaymentTermsEvidence(
      payload[0] as WorkspacePaymentTermsEvidenceRow,
      { workspaceId, userId },
    );
  } catch {
    return decision(false, "evidence_unavailable");
  }
}

export async function hasCurrentWorkspacePaymentTermsEvidence(
  workspaceId: string,
  userId: string,
): Promise<boolean> {
  return (await getWorkspacePaymentTermsEvidence(workspaceId, userId)).ready;
}

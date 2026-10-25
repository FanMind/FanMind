/**
 * Privacy-safe repair audit payload. Database persistence is deliberately
 * separate and must fail closed before any future mutating repair executes.
 */
export type RepairAuditStatus =
  | "requested" | "denied" | "started" | "succeeded"
  | "failed" | "partial" | "manual_action_required";

export type RepairAuditEvent = {
  workspace_id: string;
  actor_user_id: string;
  platform: "instagram" | "facebook" | "whatsapp";
  action: string;
  consent_required: boolean;
  consent_given: boolean;
  status: RepairAuditStatus;
  request_id: string;
  completed_at: string | null;
};

const statuses = new Set<RepairAuditStatus>([
  "requested", "denied", "started", "succeeded", "failed", "partial", "manual_action_required",
]);
const platforms = new Set(["instagram", "facebook", "whatsapp"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function buildRepairAuditEvent(input: RepairAuditEvent): RepairAuditEvent {
  if (!uuid.test(input.workspace_id) || !uuid.test(input.actor_user_id) ||
      !uuid.test(input.request_id) || !platforms.has(input.platform) ||
      !statuses.has(input.status) || !/^[a-z_]{3,64}$/.test(input.action)) {
    throw new Error("invalid_repair_audit_event");
  }
  if (input.consent_required && !input.consent_given &&
      !["requested", "denied"].includes(input.status)) {
    throw new Error("repair_consent_missing");
  }
  if (["succeeded", "failed", "partial", "manual_action_required"].includes(input.status) &&
      (!input.completed_at || !Number.isFinite(Date.parse(input.completed_at)))) {
    throw new Error("repair_completion_timestamp_missing");
  }
  // Explicit projection: never persist tokens, credentials, provider payloads,
  // customer messages, or arbitrary caller-supplied metadata.
  return {
    workspace_id: input.workspace_id,
    actor_user_id: input.actor_user_id,
    platform: input.platform,
    action: input.action,
    consent_required: input.consent_required,
    consent_given: input.consent_given,
    status: input.status,
    request_id: input.request_id,
    completed_at: input.completed_at,
  };
}

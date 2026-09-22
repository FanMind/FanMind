#!/usr/bin/env node

import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const DEFAULT_ENV_FILE = "/var/www/fanmind/.env.production";
const REQUEST_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PROCESSABLE_STATUSES = new Set(["pending", "blocked", "processing"]);

export class AccountDeletionProcessorError extends Error {
  constructor(code) {
    super(code);
    this.name = "AccountDeletionProcessorError";
    this.code = code;
  }
}

function parseArgument(name) {
  const directIndex = process.argv.findIndex((value) => value === name);
  if (directIndex >= 0) return process.argv[directIndex + 1] ?? null;
  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

export function parseEnvText(source) {
  const values = {};
  for (const rawLine of String(source).split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function requireValue(env, name, minimumLength = 1) {
  const value = String(env[name] ?? "").trim();
  if (value.length < minimumLength || /[\r\n\0]/u.test(value)) {
    throw new AccountDeletionProcessorError("configuration_missing");
  }
  return value;
}

function normalizeSupabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new AccountDeletionProcessorError("configuration_invalid");
  }
  if (parsed.protocol !== "https:") {
    throw new AccountDeletionProcessorError("configuration_invalid");
  }
  return parsed.toString().replace(/\/$/u, "");
}

function serviceHeaders(serviceKey, prefer) {
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function requestJson(fetchImpl, url, init, errorCode) {
  const response = await fetchImpl(url, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!response) throw new AccountDeletionProcessorError(errorCode);
  const payload = await response.json().catch(() => null);
  return { response, payload };
}

async function restSelect(fetchImpl, config, table, query, errorCode) {
  const { response, payload } = await requestJson(
    fetchImpl,
    `${config.supabaseUrl}/rest/v1/${table}?${query}`,
    { headers: serviceHeaders(config.serviceKey) },
    errorCode,
  );
  if (!response.ok || !Array.isArray(payload)) {
    throw new AccountDeletionProcessorError(errorCode);
  }
  return payload;
}

async function restPatch(fetchImpl, config, table, query, body, errorCode) {
  const { response, payload } = await requestJson(
    fetchImpl,
    `${config.supabaseUrl}/rest/v1/${table}?${query}`,
    {
      method: "PATCH",
      headers: serviceHeaders(config.serviceKey, "return=representation"),
      body: JSON.stringify(body),
    },
    errorCode,
  );
  if (!response.ok || !Array.isArray(payload) || !payload.length) {
    throw new AccountDeletionProcessorError(errorCode);
  }
  return payload[0];
}

async function getDeletionRequest(fetchImpl, config, requestId) {
  const rows = await restSelect(
    fetchImpl,
    config,
    "account_deletion_requests",
    new URLSearchParams({
      select:
        "id,user_id,workspace_id,notification_email,request_source,status,requires_ownership_transfer,requires_subscription_resolution,requested_at,processing_deadline_at,completion_notification_sent_at",
      id: `eq.${requestId}`,
      limit: "1",
    }).toString(),
    "request_lookup_failed",
  );
  if (!rows[0]) throw new AccountDeletionProcessorError("request_not_found");
  return rows[0];
}

async function getAuthUser(
  fetchImpl,
  config,
  userId,
  { allowMissing = false } = {},
) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      headers: serviceHeaders(config.serviceKey),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  ).catch(() => null);
  if (!response) {
    throw new AccountDeletionProcessorError("auth_user_lookup_failed");
  }
  if (allowMissing && response.status === 404) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || typeof payload !== "object") {
    throw new AccountDeletionProcessorError("auth_user_lookup_failed");
  }
  return payload.user ?? payload;
}
async function getOwnedWorkspaces(fetchImpl, config, userId) {
  return restSelect(
    fetchImpl,
    config,
    "workspaces",
    new URLSearchParams({
      select:
        "id,owner_user_id,billing_status,stripe_subscription_id,subscription_effective_end_at",
      owner_user_id: `eq.${userId}`,
    }).toString(),
    "workspace_lookup_failed",
  );
}

async function countOtherWorkspaceMembers(
  fetchImpl,
  config,
  workspaceId,
  userId,
) {
  const rows = await restSelect(
    fetchImpl,
    config,
    "workspace_members",
    new URLSearchParams({
      select: "id",
      workspace_id: `eq.${workspaceId}`,
      user_id: `neq.${userId}`,
    }).toString(),
    "workspace_member_lookup_failed",
  );
  return rows.length;
}

async function validateHistoricalRequestWorkspace(
  fetchImpl,
  config,
  request,
  ownedWorkspaces,
) {
  if (!request.workspace_id) {
    if (ownedWorkspaces.length === 0) return;
    throw new AccountDeletionProcessorError("request_workspace_mismatch");
  }
  if (ownedWorkspaces.some((workspace) => workspace.id === request.workspace_id)) {
    return;
  }

  // workspace_id records where the request was created. After the intended
  // ownership transfer the requester is no longer its owner, but must still
  // be associated with that exact Workspace. This prevents a forged request
  // from being used to inspect or delete another tenant's Workspace.
  const memberships = await restSelect(
    fetchImpl,
    config,
    "workspace_members",
    new URLSearchParams({
      select: "id,workspace_id,user_id",
      workspace_id: `eq.${request.workspace_id}`,
      user_id: `eq.${request.user_id}`,
      limit: "2",
    }).toString(),
    "request_workspace_lookup_failed",
  );
  if (
    memberships.length !== 1 ||
    memberships[0]?.workspace_id !== request.workspace_id ||
    memberships[0]?.user_id !== request.user_id
  ) {
    throw new AccountDeletionProcessorError("request_workspace_mismatch");
  }
}

export function workspaceSubscriptionRequiresResolution(workspace, now = new Date()) {
  if (!workspace?.stripe_subscription_id) return false;
  if (workspace.subscription_effective_end_at) {
    const effectiveEnd = new Date(workspace.subscription_effective_end_at);
    if (!Number.isNaN(effectiveEnd.getTime())) {
      return effectiveEnd.getTime() > now.getTime();
    }
  }
  const status = String(workspace.billing_status ?? "").toLowerCase();
  return !["cancelled", "canceled", "ended", "expired", "demo_free"].includes(
    status,
  );
}

export async function evaluateAccountDeletionEligibility({
  request,
  authUser,
  workspaces,
  fetchImpl,
  config,
  now = new Date(),
}) {
  if (!request?.user_id || !authUser?.id || authUser.id !== request.user_id) {
    throw new AccountDeletionProcessorError("request_identity_mismatch");
  }
  const normalizedRequestEmail = String(request.notification_email ?? "")
    .trim()
    .toLowerCase();
  const normalizedAuthEmail = String(authUser.email ?? "").trim().toLowerCase();
  if (
    !normalizedRequestEmail ||
    !normalizedAuthEmail ||
    normalizedRequestEmail !== normalizedAuthEmail
  ) {
    throw new AccountDeletionProcessorError("request_email_mismatch");
  }
  await validateHistoricalRequestWorkspace(
    fetchImpl,
    config,
    request,
    workspaces,
  );

  let otherMemberCount = 0;
  let requiresSubscriptionResolution = false;
  for (const workspace of workspaces) {
    otherMemberCount += await countOtherWorkspaceMembers(
      fetchImpl,
      config,
      workspace.id,
      request.user_id,
    );
    requiresSubscriptionResolution ||= workspaceSubscriptionRequiresResolution(
      workspace,
      now,
    );
  }

  return {
    ownedWorkspaceCount: workspaces.length,
    otherMemberCount,
    requiresOwnershipTransfer: otherMemberCount > 0,
    requiresSubscriptionResolution,
    eligible: otherMemberCount === 0 && !requiresSubscriptionResolution,
  };
}

async function deleteAuthUser(fetchImpl, config, userId) {
  const response = await fetchImpl(
    `${config.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: serviceHeaders(config.serviceKey),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  ).catch(() => null);
  if (!response?.ok) {
    throw new AccountDeletionProcessorError("auth_user_delete_failed");
  }
}

const WORKSPACE_DELETION_TABLES = [
  "contacts",
  "memories",
  "followups",
  "conversations",
  "conversation_messages",
  "conversation_summaries",
  "contact_ai_profiles",
  "fan_analysis_reports",
  "communication_analysis_reports",
  "contact_reply_targets",
  "workspace_voice_profiles",
  "social_connections",
  "content_sources",
  "content_metric_snapshots",
  "creators",
  "creator_voice_profiles",
  "creator_sales_playbooks",
  "creator_commercial_events",
  "workspace_chat_admin_capabilities",
  "chat_characters",
  "chat_character_conversations",
  "chat_character_messages",
];

const OPTIONAL_WORKSPACE_DELETION_TABLES = new Set([
  "communication_analysis_reports",
  "content_metric_snapshots",
  "creators",
  "creator_voice_profiles",
  "creator_sales_playbooks",
  "creator_commercial_events",
  "workspace_chat_admin_capabilities",
  "chat_characters",
  "chat_character_conversations",
  "chat_character_messages",
]);

async function verifyWorkspaceDataDeleted(fetchImpl, config, workspaceIds) {
  for (const workspaceId of workspaceIds) {
    for (const table of WORKSPACE_DELETION_TABLES) {
      const { response, payload } = await requestJson(
        fetchImpl,
        `${config.supabaseUrl}/rest/v1/${table}?${new URLSearchParams({
          select: "workspace_id",
          workspace_id: `eq.${workspaceId}`,
          limit: "1",
        })}`,
        { headers: serviceHeaders(config.serviceKey) },
        "deletion_verification_failed",
      );
      if (!response.ok) {
        const errorText = JSON.stringify(payload ?? "").toLowerCase();
        const missingSchema =
          response.status === 404 ||
          errorText.includes("schema cache") ||
          errorText.includes("does not exist") ||
          errorText.includes("could not find");
        if (OPTIONAL_WORKSPACE_DELETION_TABLES.has(table) && missingSchema) continue;
        throw new AccountDeletionProcessorError("deletion_verification_failed");
      }
      if (!Array.isArray(payload) || payload.length > 0) {
        throw new AccountDeletionProcessorError("deletion_verification_failed");
      }
    }
  }
}

export async function recoverWorkspaceIdsForResume(fetchImpl, config, request) {
  if (!request.workspace_id) return [];
  const rows = await restSelect(
    fetchImpl,
    config,
    "workspaces",
    new URLSearchParams({
      select: "id",
      id: `eq.${request.workspace_id}`,
      limit: "1",
    }).toString(),
    "workspace_resume_lookup_failed",
  );
  // Existing means the historical Workspace survived (for example after
  // ownership transfer) and must never be traversed as deleted tenant data.
  // Absence after Auth deletion means it was the owned Workspace deleted by
  // cascade and its captured ID must still drive the completeness postcheck.
  return rows.length === 0 ? [request.workspace_id] : [];
}

async function verifyDeletion(fetchImpl, config, userId, workspaceIds = []) {
  const checks = await Promise.all([
    restSelect(
      fetchImpl,
      config,
      "profiles",
      new URLSearchParams({ select: "id", id: `eq.${userId}` }).toString(),
      "deletion_verification_failed",
    ),
    restSelect(
      fetchImpl,
      config,
      "workspace_members",
      new URLSearchParams({ select: "id", user_id: `eq.${userId}` }).toString(),
      "deletion_verification_failed",
    ),
    restSelect(
      fetchImpl,
      config,
      "workspaces",
      new URLSearchParams({
        select: "id",
        owner_user_id: `eq.${userId}`,
      }).toString(),
      "deletion_verification_failed",
    ),
  ]);
  if (checks.some((rows) => rows.length > 0)) {
    throw new AccountDeletionProcessorError("deletion_verification_failed");
  }
  await verifyWorkspaceDataDeleted(fetchImpl, config, workspaceIds);
}

async function sendCompletionEmail(fetchImpl, env, email, requestId) {
  const apiKey = String(env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) return { sent: false, errorCode: "mail_provider_not_configured" };
  const from =
    String(env.FANMIND_NOTIFICATION_FROM ?? "").trim() ||
    "FanMind <noreply@fanmind.ch>";
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "FanMind Account wurde gelöscht",
      text: [
        "Die vollständige Löschung deines FanMind-Accounts wurde abgeschlossen.",
        "",
        `Referenz: ${requestId}`,
        "Der Login ist nicht mehr aktiv. Nicht gesetzlich aufzubewahrende Kontodaten wurden aus dem aktiven FanMind-System entfernt.",
        "Rechnungsnachweise und Sicherungskopien können gesetzlichen beziehungsweise technischen Aufbewahrungsfristen unterliegen.",
        "",
        "FanMind",
      ].join("\n"),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  return response?.ok
    ? { sent: true, errorCode: null }
    : { sent: false, errorCode: "mail_delivery_failed" };
}

function userReferenceHash(userId, secret) {
  return createHmac("sha256", secret).update(userId).digest("hex");
}

async function updateBlockedState(fetchImpl, config, request, eligibility) {
  const status = eligibility.eligible ? "pending" : "blocked";
  return restPatch(
    fetchImpl,
    config,
    "account_deletion_requests",
    new URLSearchParams({
      id: `eq.${request.id}`,
      user_id: `eq.${request.user_id}`,
      select: "id,status",
    }).toString(),
    {
      status,
      requires_ownership_transfer: eligibility.requiresOwnershipTransfer,
      requires_subscription_resolution:
        eligibility.requiresSubscriptionResolution,
      last_error_code: null,
    },
    "request_update_failed",
  );
}

function enforceExecutionGates(env, requestId, confirmation) {
  if (env.FANMIND_ACCOUNT_DELETION_EXECUTION_ENABLED !== "true") {
    throw new AccountDeletionProcessorError("execution_gate_disabled");
  }
  if (confirmation !== requestId) {
    throw new AccountDeletionProcessorError("execution_confirmation_invalid");
  }
  return requireValue(env, "FANMIND_ACCOUNT_DELETION_HASH_SECRET", 32);
}

async function markCompletionNotificationSent(
  fetchImpl,
  config,
  request,
  sentAt,
) {
  await restPatch(
    fetchImpl,
    config,
    "account_deletion_requests",
    new URLSearchParams({
      id: `eq.${request.id}`,
      status: "eq.processing",
      select: "id,status,completion_notification_sent_at",
    }).toString(),
    {
      completion_notification_sent_at: sentAt,
      last_error_code: null,
    },
    "completion_notification_record_failed",
  );
}

async function finalizeDeletedAccount({
  fetchImpl,
  env,
  config,
  request,
  userId,
  hashSecret,
  workspaceIds,
  log,
}) {
  await verifyDeletion(fetchImpl, config, userId, workspaceIds);
  const notificationEmail = String(request.notification_email ?? "")
    .trim()
    .toLowerCase();
  if (!notificationEmail) {
    throw new AccountDeletionProcessorError("completion_email_missing");
  }

  let completion = request.completion_notification_sent_at
    ? { sent: true, errorCode: null }
    : await sendCompletionEmail(
        fetchImpl,
        env,
        notificationEmail,
        request.id,
      );
  let notificationSentAt = request.completion_notification_sent_at || null;
  if (completion.sent && !notificationSentAt) {
    notificationSentAt = new Date().toISOString();
    await markCompletionNotificationSent(
      fetchImpl,
      config,
      request,
      notificationSentAt,
    );
  }

  const completedAt = new Date().toISOString();
  const finalStatus = completion.sent
    ? "completed"
    : "completed_notification_pending";
  await restPatch(
    fetchImpl,
    config,
    "account_deletion_requests",
    new URLSearchParams({
      id: `eq.${request.id}`,
      status: "eq.processing",
      select: "id,status",
    }).toString(),
    {
      user_id: null,
      workspace_id: null,
      user_reference_hash: userReferenceHash(userId, hashSecret),
      status: finalStatus,
      completed_at: completedAt,
      completion_notification_sent_at: notificationSentAt,
      notification_email: completion.sent ? null : notificationEmail,
      requires_ownership_transfer: false,
      requires_subscription_resolution: false,
      last_error_code: completion.errorCode,
    },
    "completion_record_failed",
  );

  log(`ACCOUNT_DELETION_COMPLETION_NOTIFICATION_SENT=${completion.sent}`);
  log(`ACCOUNT_DELETION_RESULT=${finalStatus}`);
  return finalStatus;
}

export async function processAccountDeletion({
  env,
  requestId,
  execute = false,
  confirmation = null,
  resume = false,
  fetchImpl = fetch,
  log = console.log,
  now = new Date(),
}) {
  if (!REQUEST_ID_PATTERN.test(requestId)) {
    throw new AccountDeletionProcessorError("request_id_invalid");
  }
  const supabaseUrl = normalizeSupabaseUrl(
    requireValue(env, "NEXT_PUBLIC_SUPABASE_URL", 12),
  );
  const serviceKey = requireValue(env, "SUPABASE_SERVICE_ROLE_KEY", 20);
  const config = { supabaseUrl, serviceKey };
  const request = await getDeletionRequest(fetchImpl, config, requestId);
  if (!PROCESSABLE_STATUSES.has(request.status)) {
    throw new AccountDeletionProcessorError("request_not_processable");
  }
  if (!request.user_id) {
    throw new AccountDeletionProcessorError("request_identity_missing");
  }

  const resuming = request.status === "processing";
  if (resuming && execute && !resume) {
    throw new AccountDeletionProcessorError("request_resume_required");
  }

  const authUser = await getAuthUser(fetchImpl, config, request.user_id, {
    allowMissing: resuming,
  });
  log(`ACCOUNT_DELETION_MODE=${execute ? "execute" : "dry_run"}`);
  log(`ACCOUNT_DELETION_REQUEST_STATUS=${request.status}`);
  log(`ACCOUNT_DELETION_RESUME=${resuming}`);

  if (!authUser) {
    log("ACCOUNT_DELETION_RECOVERY_STATE=auth_user_already_absent");
    const resumeWorkspaceIds = await recoverWorkspaceIdsForResume(
      fetchImpl,
      config,
      request,
    );
    if (!execute) {
      await verifyDeletion(
        fetchImpl,
        config,
        request.user_id,
        resumeWorkspaceIds,
      );
      log("ACCOUNT_DELETION_RESULT=dry_run_resume_ready");
      return {
        executed: false,
        resumeRequired: true,
        eligibility: null,
      };
    }
    const hashSecret = enforceExecutionGates(env, requestId, confirmation);
    const finalStatus = await finalizeDeletedAccount({
      fetchImpl,
      env,
      config,
      request,
      userId: request.user_id,
      hashSecret,
      workspaceIds: resumeWorkspaceIds,
      log,
    });
    return { executed: true, resumed: true, eligibility: null, finalStatus };
  }

  const workspaces = await getOwnedWorkspaces(
    fetchImpl,
    config,
    request.user_id,
  );
  const eligibility = await evaluateAccountDeletionEligibility({
    request,
    authUser,
    workspaces,
    fetchImpl,
    config,
    now,
  });

  log(`ACCOUNT_DELETION_OWNED_WORKSPACE_COUNT=${eligibility.ownedWorkspaceCount}`);
  log(`ACCOUNT_DELETION_OTHER_MEMBER_COUNT=${eligibility.otherMemberCount}`);
  log(
    `ACCOUNT_DELETION_SUBSCRIPTION_BLOCKED=${eligibility.requiresSubscriptionResolution}`,
  );
  log(`ACCOUNT_DELETION_ELIGIBLE=${eligibility.eligible}`);

  if (!execute) {
    log("ACCOUNT_DELETION_RESULT=dry_run_success");
    return { executed: false, resumeRequired: resuming, eligibility };
  }

  const hashSecret = enforceExecutionGates(env, requestId, confirmation);
  if (!eligibility.eligible) {
    if (!resuming) {
      await updateBlockedState(fetchImpl, config, request, eligibility);
    }
    throw new AccountDeletionProcessorError("request_blocked");
  }

  if (!resuming) {
    await restPatch(
      fetchImpl,
      config,
      "account_deletion_requests",
      new URLSearchParams({
        id: `eq.${request.id}`,
        user_id: `eq.${request.user_id}`,
        status: "in.(pending,blocked)",
        select: "id,status",
      }).toString(),
      {
        status: "processing",
        processing_started_at: now.toISOString(),
        requires_ownership_transfer: false,
        requires_subscription_resolution: false,
        last_error_code: null,
      },
      "request_update_failed",
    );
  }

  await deleteAuthUser(fetchImpl, config, request.user_id);
  const finalStatus = await finalizeDeletedAccount({
    fetchImpl,
    env,
    config,
    request: { ...request, status: "processing" },
    userId: request.user_id,
    hashSecret,
    workspaceIds: workspaces.map((workspace) => workspace.id),
    log,
  });
  return { executed: true, resumed: resuming, eligibility, finalStatus };
}

async function main() {
  const envFile =
    parseArgument("--env-file") ||
    process.env.FANMIND_ENV_FILE ||
    DEFAULT_ENV_FILE;
  const requestId = parseArgument("--request-id") || "";
  const execute = hasFlag("--execute");
  const resume = hasFlag("--resume");
  const confirmation = parseArgument("--confirm");
  const env = parseEnvText(await readFile(envFile, "utf8"));
  await processAccountDeletion({
    env,
    requestId,
    execute,
    confirmation,
    resume,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    const code =
      error instanceof AccountDeletionProcessorError
        ? error.code
        : "account_deletion_processor_failed";
    console.error(`ACCOUNT_DELETION_FATAL=${code}`);
    process.exit(1);
  });
}

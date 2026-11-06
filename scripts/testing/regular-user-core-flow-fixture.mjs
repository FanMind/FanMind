#!/usr/bin/env node

import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const FIXTURE_ACKNOWLEDGEMENT =
  "fanmind-local-synthetic-core-flow";
export const FIXTURE_HOST = "127.0.0.1";
export const FIXTURE_DEFAULT_PORT = 54321;
export const FIXTURE_EMAIL = "gerhard-core-flow@synthetic.invalid";
export const FIXTURE_PASSWORD = "FanMind-Local-Core-Flow-2026!";
export const FIXTURE_ACCESS_TOKEN =
  "fanmind-local-core-flow-access-token";
export const FIXTURE_REFRESH_TOKEN =
  "fanmind-local-core-flow-refresh-token";
export const FIXTURE_SERVICE_ROLE_KEY =
  "fanmind-local-core-flow-service-role-key";

export const FIXTURE_IDS = Object.freeze({
  user: "10000000-0000-4000-8000-000000000001",
  workspace: "20000000-0000-4000-8000-000000000001",
  contact: "30000000-0000-4000-8000-000000000001",
  conversation: "40000000-0000-4000-8000-000000000001",
  message: "50000000-0000-4000-8000-000000000001",
  memory: "60000000-0000-4000-8000-000000000001",
  followup: "70000000-0000-4000-8000-000000000001",
});

const FIXTURE_NAME = "fanmind_regular_user_core_flow";
const FIXTURE_SEED_VERSION = "2026-08-16-v1";
export const FIXTURE_APP_ORIGIN = "http://localhost:3100";
const FIXTURE_CREATED_AT = "2026-08-10T08:00:00.000Z";
const FIXTURE_UPDATED_AT = "2026-08-10T08:15:00.000Z";
const FIXTURE_MUTATION_CREATED_AT = "2026-08-16T12:00:00.000Z";
const MAX_JSON_BODY_BYTES = 32_768;

const READ_METHODS = new Set(["GET", "HEAD"]);
const MUTATION_CODES = Object.freeze({
  memoryCreated: "memories:POST",
  followupCreated: "followups:POST",
  inboundSeen: "conversation_messages:PATCH:seen_at",
  followupCompleted: "followups:PATCH:completed",
  followupReopened: "followups:PATCH:open",
});

const TABLE_COLUMNS = Object.freeze({
  workspaces: new Set([
    "id",
    "name",
    "owner_user_id",
    "plan_id",
    "commercial_option",
    "setup_fee_cents",
    "monthly_fee_cents",
    "commitment_months",
    "billing_status",
    "billing_provider",
    "payment_collection_method",
    "billing_suspended_at",
    "billing_suspended_reason",
    "billing_manual_override",
    "billing_last_payment_failed_at",
    "billing_last_payment_at",
    "billing_retry_count",
    "billing_next_retry_at",
    "billing_grace_until",
    "billing_admin_note",
    "billing_contract_started_at",
    "billing_current_period_end_at",
    "billing_next_invoice_at",
    "billing_minimum_term_ends_at",
    "subscription_cancel_requested_at",
    "subscription_cancel_requested_by_user_id",
    "subscription_cancel_at_period_end",
    "subscription_effective_end_at",
    "subscription_cancellation_revoked_at",
    "workspace_access_mode",
    "billing_updated_at",
    "billing_updated_by_user_id",
    "stripe_customer_id",
    "stripe_subscription_id",
    "last_invoice_id",
    "last_invoice_status",
    "last_invoice_amount_due_cents",
    "last_invoice_amount_paid_cents",
    "last_invoice_hosted_url",
    "last_invoice_pdf_url",
    "test_access_flags",
    "organization_name",
    "street_address",
    "postal_code",
    "city",
    "country",
    "vat_id",
    "tax_number",
    "company_register_number",
    "company_register_court",
  ]),
  contacts: new Set([
    "id",
    "workspace_id",
    "display_name",
    "handle",
    "source_platform",
    "language",
    "status",
    "tags",
    "summary",
    "internal_notes",
    "is_top_fan",
    "created_at",
    "updated_at",
  ]),
  conversations: new Set([
    "id",
    "workspace_id",
    "contact_id",
    "status",
    "priority",
    "source_platform",
    "source_type",
    "source_url",
    "reply_target_url",
    "external_thread_id",
    "external_message_id",
    "external_post_id",
    "external_comment_id",
    "original_author_label",
    "original_text_excerpt",
    "last_inbound_at",
    "last_outbound_at",
    "last_message_preview",
    "assigned_owner",
    "assigned_user_id",
    "ai_status",
    "next_step",
    "created_at",
    "updated_at",
  ]),
  conversation_messages: new Set([
    "id",
    "workspace_id",
    "conversation_id",
    "contact_id",
    "direction",
    "message_type",
    "source_platform",
    "source_type",
    "source_url",
    "reply_target_url",
    "external_thread_id",
    "external_message_id",
    "external_post_id",
    "external_video_id",
    "external_comment_id",
    "original_author_label",
    "original_text_excerpt",
    "author_label",
    "content",
    "attachments",
    "message_kind",
    "created_at",
    "seen_at",
  ]),
  memories: new Set([
    "id",
    "workspace_id",
    "contact_id",
    "type",
    "content",
    "importance",
    "created_at",
  ]),
  followups: new Set([
    "id",
    "workspace_id",
    "contact_id",
    "due_date",
    "priority",
    "reason",
    "status",
    "created_at",
  ]),
  social_connections: new Set([
    "id",
    "workspace_id",
    "platform",
    "provider",
    "status",
    "external_account_id",
    "external_account_name",
    "page_id",
    "page_name",
    "token_last_four",
    "scopes",
    "webhook_subscribed",
    "connected_by",
    "connected_at",
    "disconnected_at",
    "last_event_at",
    "last_comment_fetch_at",
    "last_comment_fetch_count",
    "last_comment_fetch_error",
    "last_messenger_sync_at",
    "last_messenger_sync_checked_count",
    "last_messenger_sync_imported_inbound_count",
    "last_messenger_sync_imported_outbound_count",
    "last_messenger_sync_imported_media_count",
    "last_messenger_sync_skipped_count",
    "last_messenger_sync_error",
    "last_messenger_sync_outbound_at",
    "created_at",
    "updated_at",
  ]),
  fan_analysis_reports: new Set([
    "id",
    "workspace_id",
    "contact_id",
    "report_json",
    "summary",
    "model",
    "source_message_count",
    "generated_at",
    "created_at",
    "updated_at",
  ]),
  contact_reply_targets: new Set([
    "id",
    "workspace_id",
    "contact_id",
    "source_platform",
    "source_type",
    "label",
    "url",
    "quality",
    "created_at",
    "updated_at",
  ]),
  workspace_ai_prompt_settings: new Set([
    "workspace_id",
    "company_prompt",
    "profiles",
    "updated_at",
  ]),
});

const TABLE_METHODS = Object.freeze({
  workspaces: new Set(["GET", "HEAD"]),
  contacts: new Set(["GET", "HEAD"]),
  conversations: new Set(["GET", "HEAD"]),
  conversation_messages: new Set(["GET", "HEAD", "PATCH"]),
  memories: new Set(["GET", "HEAD", "POST"]),
  followups: new Set(["GET", "HEAD", "POST", "PATCH"]),
  social_connections: new Set(["GET", "HEAD"]),
  fan_analysis_reports: new Set(["GET", "HEAD"]),
  contact_reply_targets: new Set(["GET", "HEAD"]),
  workspace_ai_prompt_settings: new Set(["GET", "HEAD"]),
});

function createSeedTables() {
  return {
    workspaces: [
      {
        id: FIXTURE_IDS.workspace,
        name: "Gerhard Core Flow Studio",
        owner_user_id: FIXTURE_IDS.user,
        plan_id: "starter",
        commercial_option: "starter_paid_setup",
        setup_fee_cents: 99_000,
        monthly_fee_cents: 31_200,
        commitment_months: 0,
        billing_status: "active",
        billing_provider: "manual",
        payment_collection_method: "manual",
        billing_suspended_at: null,
        billing_suspended_reason: null,
        billing_manual_override: false,
        billing_last_payment_failed_at: null,
        billing_last_payment_at: FIXTURE_CREATED_AT,
        billing_retry_count: 0,
        billing_next_retry_at: null,
        billing_grace_until: null,
        billing_admin_note: null,
        billing_contract_started_at: FIXTURE_CREATED_AT,
        billing_current_period_end_at: "2026-09-10T08:00:00.000Z",
        billing_next_invoice_at: "2026-09-10T08:00:00.000Z",
        billing_minimum_term_ends_at: null,
        subscription_cancel_requested_at: null,
        subscription_cancel_requested_by_user_id: null,
        subscription_cancel_at_period_end: false,
        subscription_effective_end_at: null,
        subscription_cancellation_revoked_at: null,
        workspace_access_mode: "active",
        billing_updated_at: FIXTURE_UPDATED_AT,
        billing_updated_by_user_id: FIXTURE_IDS.user,
        stripe_customer_id: null,
        stripe_subscription_id: null,
        last_invoice_id: null,
        last_invoice_status: null,
        last_invoice_amount_due_cents: null,
        last_invoice_amount_paid_cents: null,
        last_invoice_hosted_url: null,
        last_invoice_pdf_url: null,
        test_access_flags: { synthetic_core_flow: true },
        organization_name: "Gerhard Core Flow Studio",
        street_address: null,
        postal_code: null,
        city: "Wien",
        country: "AT",
        vat_id: null,
        tax_number: null,
        company_register_number: null,
        company_register_court: null,
      },
    ],
    contacts: [
      {
        id: FIXTURE_IDS.contact,
        workspace_id: FIXTURE_IDS.workspace,
        display_name: "Sandra Synthetic",
        handle: "@sandra_synthetic",
        source_platform: "instagram",
        language: "de",
        status: "active",
        tags: ["synthetic", "core-flow"],
        summary: "Synthetischer Kontakt für die lokale Browser-Abnahme.",
        internal_notes: null,
        is_top_fan: false,
        created_at: FIXTURE_CREATED_AT,
        updated_at: FIXTURE_UPDATED_AT,
      },
    ],
    conversations: [
      {
        id: FIXTURE_IDS.conversation,
        workspace_id: FIXTURE_IDS.workspace,
        contact_id: FIXTURE_IDS.contact,
        status: "open",
        priority: "high",
        source_platform: "instagram",
        source_type: "instagram_messages",
        source_url: null,
        reply_target_url: null,
        external_thread_id: null,
        external_message_id: null,
        external_post_id: null,
        external_comment_id: null,
        original_author_label: "Sandra Synthetic",
        original_text_excerpt:
          "Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?",
        last_inbound_at: FIXTURE_UPDATED_AT,
        last_outbound_at: null,
        last_message_preview:
          "Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?",
        assigned_owner: null,
        assigned_user_id: null,
        ai_status: "ready",
        next_step: "Antwort manuell prüfen und kopieren",
        created_at: FIXTURE_CREATED_AT,
        updated_at: FIXTURE_UPDATED_AT,
      },
    ],
    conversation_messages: [
      {
        id: FIXTURE_IDS.message,
        workspace_id: FIXTURE_IDS.workspace,
        conversation_id: FIXTURE_IDS.conversation,
        contact_id: FIXTURE_IDS.contact,
        direction: "inbound",
        message_type: "text",
        source_platform: "instagram",
        source_type: "instagram_messages",
        source_url: null,
        reply_target_url: null,
        external_thread_id: null,
        external_message_id: null,
        external_post_id: null,
        external_video_id: null,
        external_comment_id: null,
        original_author_label: "Sandra Synthetic",
        original_text_excerpt:
          "Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?",
        author_label: "Sandra Synthetic",
        content:
          "Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?",
        attachments: null,
        message_kind: "dm",
        created_at: FIXTURE_UPDATED_AT,
        seen_at: null,
      },
    ],
    memories: [],
    followups: [],
    social_connections: [],
    fan_analysis_reports: [],
    contact_reply_targets: [],
    workspace_ai_prompt_settings: [],
  };
}

function createFixtureState() {
  return {
    tables: createSeedTables(),
    mutationCodes: [],
  };
}

function resetFixtureState(state) {
  state.tables = createSeedTables();
  state.mutationCodes = [];
}

function redactedState(state) {
  const followups = state.tables.followups;
  const messages = state.tables.conversation_messages;

  return {
    fixture: FIXTURE_NAME,
    seed_version: FIXTURE_SEED_VERSION,
    binding: FIXTURE_HOST,
    counts: {
      workspaces: state.tables.workspaces.length,
      contacts: state.tables.contacts.length,
      conversations: state.tables.conversations.length,
      conversation_messages: messages.length,
      memories: state.tables.memories.length,
      followups: followups.length,
      open_followups: followups.filter((row) => row.status === "open").length,
      completed_followups: followups.filter(
        (row) => row.status === "completed",
      ).length,
      seen_inbound_messages: messages.filter(
        (row) => row.direction === "inbound" && row.seen_at !== null,
      ).length,
    },
    mutation_codes: [...state.mutationCodes],
  };
}

function userPayload() {
  return {
    id: FIXTURE_IDS.user,
    email: FIXTURE_EMAIL,
    aud: "authenticated",
    role: "authenticated",
    user_metadata: {
      display_name: "Gerhard Testnutzer",
      synthetic_core_flow: true,
    },
    created_at: FIXTURE_CREATED_AT,
    updated_at: FIXTURE_UPDATED_AT,
  };
}

function applyCors(request, response) {
  const origin = request.headers.origin;
  response.setHeader("Vary", "Origin");
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, PATCH, OPTIONS",
  );
  response.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, apikey, content-type, prefer, range",
  );
  response.setHeader("Access-Control-Expose-Headers", "content-range");
  if (origin === FIXTURE_APP_ORIGIN) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }
}

function sendJson(request, response, status, payload, headers = {}) {
  applyCors(request, response);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  if (request.method === "HEAD" || status === 204) {
    response.end();
    return;
  }
  response.end(JSON.stringify(payload));
}

function sendEmpty(request, response, status, headers = {}) {
  applyCors(request, response);
  response.writeHead(status, { "Cache-Control": "no-store", ...headers });
  response.end();
}

function sendError(request, response, status, code, headers = {}) {
  sendJson(request, response, status, { error: code, code }, headers);
}

function methodNotAllowed(request, response, methods) {
  sendError(request, response, 405, "method_not_allowed", {
    Allow: [...methods].join(", "),
  });
}

function bearerToken(request) {
  const header = String(request.headers.authorization ?? "");
  const prefix = "bearer ";
  if (
    header.length <= prefix.length ||
    header.slice(0, prefix.length).toLowerCase() !== prefix
  ) {
    return null;
  }
  const token = header.slice(prefix.length);
  for (const character of token) {
    if (character.trim() === "") return null;
  }
  return token;
}

function requireFixtureToken(request, response, allowedTokens) {
  if (!allowedTokens.has(bearerToken(request))) {
    sendError(request, response, 401, "fixture_auth_invalid");
    return false;
  }
  return true;
}

async function readJsonBody(request) {
  const chunks = [];
  let byteCount = 0;

  for await (const chunk of request) {
    byteCount += chunk.length;
    if (byteCount > MAX_JSON_BODY_BYTES) {
      const error = new Error("payload_too_large");
      error.status = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    const error = new Error("invalid_json");
    error.status = 400;
    throw error;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("invalid_json");
    error.status = 400;
    throw error;
  }
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(value, expectedKeys) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  return (
    actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
  );
}

function parseSelect(url, columns) {
  const rawSelect = url.searchParams.get("select");
  if (!rawSelect || rawSelect === "*") return null;
  const selected = rawSelect.split(",").map((value) => value.trim());
  if (
    selected.some((value) => !value || !/^[a-z][a-z0-9_]*$/u.test(value)) ||
    selected.some((value) => !columns.has(value))
  ) {
    throw new Error("query_select_invalid");
  }
  return selected;
}

function parseLimit(url) {
  const rawLimit = url.searchParams.get("limit");
  if (rawLimit === null) return null;
  if (!/^[1-9][0-9]{0,3}$/u.test(rawLimit)) {
    throw new Error("query_limit_invalid");
  }
  const limit = Number(rawLimit);
  if (limit > 1000) throw new Error("query_limit_invalid");
  return limit;
}

function parseOrder(url, columns) {
  const rawOrder = url.searchParams.get("order");
  if (!rawOrder) return [];

  return rawOrder.split(",").map((entry) => {
    const [column, direction = "asc", nulls] = entry.split(".");
    if (
      !columns.has(column) ||
      !["asc", "desc"].includes(direction) ||
      (nulls !== undefined && !["nullsfirst", "nullslast"].includes(nulls))
    ) {
      throw new Error("query_order_invalid");
    }
    return { column, direction, nulls: nulls ?? "nullslast" };
  });
}

function parseFilters(url, columns, allowedControlParameters) {
  const filters = [];
  const seen = new Set();

  for (const [key, value] of url.searchParams) {
    if (seen.has(key)) throw new Error("query_parameter_duplicate");
    seen.add(key);
    if (allowedControlParameters.has(key)) continue;
    if (!columns.has(key)) throw new Error("query_filter_invalid");

    if (value === "is.null") {
      filters.push({ column: key, operation: "is_null", value: null });
      continue;
    }
    if (value.startsWith("eq.") && value.length > 3) {
      filters.push({ column: key, operation: "eq", value: value.slice(3) });
      continue;
    }
    throw new Error("query_filter_invalid");
  }

  return filters;
}

function filterRows(rows, filters) {
  return rows.filter((row) =>
    filters.every((filter) => {
      const value = row[filter.column];
      if (filter.operation === "is_null") return value === null;
      return (
        value !== null && value !== undefined && String(value) === filter.value
      );
    }),
  );
}

function compareNullable(left, right, nulls) {
  if (left === null || left === undefined) {
    if (right === null || right === undefined) return 0;
    return nulls === "nullsfirst" ? -1 : 1;
  }
  if (right === null || right === undefined) {
    return nulls === "nullsfirst" ? 1 : -1;
  }
  return String(left).localeCompare(String(right), "en");
}

function orderRows(rows, orders) {
  if (!orders.length) return rows;
  return [...rows].sort((left, right) => {
    for (const order of orders) {
      const compared = compareNullable(
        left[order.column],
        right[order.column],
        order.nulls,
      );
      if (compared !== 0) {
        return order.direction === "desc" ? -compared : compared;
      }
    }
    return 0;
  });
}

function projectRow(row, selected) {
  if (!selected) return { ...row };
  return Object.fromEntries(selected.map((column) => [column, row[column]]));
}

function parseReadQuery(url, table) {
  const columns = TABLE_COLUMNS[table];
  const controls = new Set(["select", "limit", "order"]);
  const selected = parseSelect(url, columns);
  const limit = parseLimit(url);
  const orders = parseOrder(url, columns);
  const filters = parseFilters(url, columns, controls);
  return { selected, limit, orders, filters };
}

function representationRequested(request, url) {
  return (
    String(request.headers.prefer ?? "").includes("return=representation") ||
    url.searchParams.has("select")
  );
}

function mutationResponse(request, response, url, status, row, selected) {
  if (representationRequested(request, url)) {
    sendJson(request, response, status, [projectRow(row, selected)]);
    return;
  }
  sendEmpty(request, response, 204);
}

async function handleAuth(request, response, url) {
  if (url.pathname === "/auth/v1/token") {
    if (request.method !== "POST") {
      methodNotAllowed(request, response, new Set(["POST"]));
      return;
    }
    if (
      url.searchParams.get("grant_type") !== "password" ||
      url.searchParams.size !== 1
    ) {
      sendError(request, response, 400, "fixture_grant_invalid");
      return;
    }

    const body = await readJsonBody(request);
    if (!hasExactKeys(body, ["email", "password"])) {
      sendError(request, response, 400, "fixture_credentials_invalid");
      return;
    }
    if (body.email !== FIXTURE_EMAIL || body.password !== FIXTURE_PASSWORD) {
      sendError(request, response, 401, "fixture_credentials_invalid");
      return;
    }

    const user = userPayload();
    sendJson(request, response, 200, {
      access_token: FIXTURE_ACCESS_TOKEN,
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: FIXTURE_REFRESH_TOKEN,
      user,
    });
    return;
  }

  if (url.pathname === "/auth/v1/user") {
    if (request.method !== "GET") {
      methodNotAllowed(request, response, new Set(["GET"]));
      return;
    }
    if (
      !requireFixtureToken(request, response, new Set([FIXTURE_ACCESS_TOKEN]))
    ) {
      return;
    }
    sendJson(request, response, 200, userPayload());
    return;
  }

  if (url.pathname === "/auth/v1/logout") {
    if (request.method !== "POST") {
      methodNotAllowed(request, response, new Set(["POST"]));
      return;
    }
    if (
      !requireFixtureToken(request, response, new Set([FIXTURE_ACCESS_TOKEN]))
    ) {
      return;
    }
    sendEmpty(request, response, 204);
    return;
  }

  sendError(request, response, 404, "fixture_auth_route_unknown");
}

function handleRead(request, response, url, table, state) {
  const query = parseReadQuery(url, table);
  const filtered = filterRows(state.tables[table], query.filters);
  const ordered = orderRows(filtered, query.orders);
  const limited = query.limit === null ? ordered : ordered.slice(0, query.limit);
  const rows = limited.map((row) => projectRow(row, query.selected));
  const contentRange = filtered.length
    ? `0-${Math.max(0, rows.length - 1)}/${filtered.length}`
    : "*/0";

  if (request.method === "HEAD") {
    sendEmpty(request, response, 200, { "Content-Range": contentRange });
    return;
  }
  sendJson(request, response, 200, rows, { "Content-Range": contentRange });
}

function validateInsertScope(body) {
  return (
    body.workspace_id === FIXTURE_IDS.workspace &&
    body.contact_id === FIXTURE_IDS.contact
  );
}

async function handleMemoryInsert(request, response, url, state) {
  const body = await readJsonBody(request);
  const keys = [
    "workspace_id",
    "contact_id",
    "type",
    "content",
    "importance",
  ];
  if (!hasExactKeys(body, keys) || !validateInsertScope(body)) {
    sendError(request, response, 400, "memory_insert_invalid");
    return;
  }
  if (
    !["note", "preference", "promise"].includes(body.type) ||
    !["low", "normal", "high"].includes(body.importance) ||
    typeof body.content !== "string" ||
    !body.content.trim() ||
    body.content.length > 4000
  ) {
    sendError(request, response, 400, "memory_insert_invalid");
    return;
  }
  if (state.tables.memories.length !== 0) {
    sendError(request, response, 409, "memory_already_created");
    return;
  }

  const selected = parseSelect(url, TABLE_COLUMNS.memories);
  parseFilters(url, TABLE_COLUMNS.memories, new Set(["select"]));
  const row = {
    id: FIXTURE_IDS.memory,
    workspace_id: FIXTURE_IDS.workspace,
    contact_id: FIXTURE_IDS.contact,
    type: body.type,
    content: body.content.trim(),
    importance: body.importance,
    created_at: FIXTURE_MUTATION_CREATED_AT,
  };
  state.tables.memories.push(row);
  state.mutationCodes.push(MUTATION_CODES.memoryCreated);
  mutationResponse(request, response, url, 201, row, selected);
}

async function handleFollowupInsert(request, response, url, state) {
  const body = await readJsonBody(request);
  const keys = [
    "workspace_id",
    "contact_id",
    "due_date",
    "priority",
    "reason",
    "status",
  ];
  if (!hasExactKeys(body, keys) || !validateInsertScope(body)) {
    sendError(request, response, 400, "followup_insert_invalid");
    return;
  }
  if (
    body.status !== "open" ||
    !["low", "normal", "high"].includes(body.priority) ||
    typeof body.reason !== "string" ||
    !body.reason.trim() ||
    body.reason.length > 2000 ||
    !(
      body.due_date === null ||
      (typeof body.due_date === "string" &&
        /^\d{4}-\d{2}-\d{2}$/u.test(body.due_date))
    )
  ) {
    sendError(request, response, 400, "followup_insert_invalid");
    return;
  }
  if (state.tables.followups.length !== 0) {
    sendError(request, response, 409, "followup_already_created");
    return;
  }

  const selected = parseSelect(url, TABLE_COLUMNS.followups);
  parseFilters(url, TABLE_COLUMNS.followups, new Set(["select"]));
  const row = {
    id: FIXTURE_IDS.followup,
    workspace_id: FIXTURE_IDS.workspace,
    contact_id: FIXTURE_IDS.contact,
    due_date: body.due_date,
    priority: body.priority,
    reason: body.reason.trim(),
    status: "open",
    created_at: FIXTURE_MUTATION_CREATED_AT,
  };
  state.tables.followups.push(row);
  state.mutationCodes.push(MUTATION_CODES.followupCreated);
  mutationResponse(request, response, url, 201, row, selected);
}

function filterMap(filters) {
  return new Map(
    filters.map((filter) => [
      filter.column,
      filter.operation === "is_null" ? "is.null" : `eq.${filter.value}`,
    ]),
  );
}

async function handleMessageSeenPatch(request, response, url, state) {
  const body = await readJsonBody(request);
  if (
    !hasExactKeys(body, ["seen_at"]) ||
    typeof body.seen_at !== "string" ||
    !body.seen_at ||
    !Number.isFinite(Date.parse(body.seen_at))
  ) {
    sendError(request, response, 400, "seen_patch_invalid");
    return;
  }

  const columns = TABLE_COLUMNS.conversation_messages;
  const selected = parseSelect(url, columns);
  const filters = parseFilters(url, columns, new Set(["select"]));
  const scope = filterMap(filters);
  if (
    filters.length !== 4 ||
    scope.get("workspace_id") !== `eq.${FIXTURE_IDS.workspace}` ||
    scope.get("contact_id") !== `eq.${FIXTURE_IDS.contact}` ||
    scope.get("direction") !== "eq.inbound" ||
    scope.get("seen_at") !== "is.null"
  ) {
    sendError(request, response, 400, "mutation_scope_invalid");
    return;
  }

  const row = state.tables.conversation_messages.find(
    (candidate) =>
      candidate.workspace_id === FIXTURE_IDS.workspace &&
      candidate.contact_id === FIXTURE_IDS.contact &&
      candidate.direction === "inbound" &&
      candidate.seen_at === null,
  );
  if (!row) {
    if (representationRequested(request, url)) {
      sendJson(request, response, 200, []);
    } else {
      sendEmpty(request, response, 204);
    }
    return;
  }

  row.seen_at = body.seen_at;
  state.mutationCodes.push(MUTATION_CODES.inboundSeen);
  mutationResponse(request, response, url, 200, row, selected);
}

async function handleFollowupStatusPatch(request, response, url, state) {
  const body = await readJsonBody(request);
  if (
    !hasExactKeys(body, ["status"]) ||
    !["open", "completed"].includes(body.status)
  ) {
    sendError(request, response, 400, "followup_status_patch_invalid");
    return;
  }

  const columns = TABLE_COLUMNS.followups;
  const selected = parseSelect(url, columns);
  const filters = parseFilters(url, columns, new Set(["select"]));
  const scope = filterMap(filters);
  if (
    filters.length !== 3 ||
    scope.get("id") !== `eq.${FIXTURE_IDS.followup}` ||
    scope.get("workspace_id") !== `eq.${FIXTURE_IDS.workspace}` ||
    scope.get("contact_id") !== `eq.${FIXTURE_IDS.contact}`
  ) {
    sendError(request, response, 400, "mutation_scope_invalid");
    return;
  }

  const row = state.tables.followups.find(
    (candidate) => candidate.id === FIXTURE_IDS.followup,
  );
  if (!row) {
    sendJson(request, response, 200, []);
    return;
  }
  const transitionAllowed =
    (row.status === "open" && body.status === "completed") ||
    (row.status === "completed" && body.status === "open");
  if (!transitionAllowed) {
    sendError(request, response, 409, "followup_status_transition_invalid");
    return;
  }

  row.status = body.status;
  state.mutationCodes.push(
    body.status === "completed"
      ? MUTATION_CODES.followupCompleted
      : MUTATION_CODES.followupReopened,
  );
  mutationResponse(request, response, url, 200, row, selected);
}

async function handlePostgrest(request, response, url, state) {
  const pathMatch = /^\/rest\/v1\/([a-z][a-z0-9_]*)$/u.exec(url.pathname);
  const table = pathMatch?.[1];
  if (!table || !Object.hasOwn(TABLE_COLUMNS, table)) {
    sendError(request, response, 404, "fixture_table_unknown");
    return;
  }

  const methods = TABLE_METHODS[table];
  if (!methods.has(request.method)) {
    methodNotAllowed(request, response, methods);
    return;
  }
  if (
    !requireFixtureToken(
      request,
      response,
      new Set([FIXTURE_ACCESS_TOKEN, FIXTURE_SERVICE_ROLE_KEY]),
    )
  ) {
    return;
  }

  if (READ_METHODS.has(request.method)) {
    handleRead(request, response, url, table, state);
    return;
  }
  if (table === "memories" && request.method === "POST") {
    if (bearerToken(request) !== FIXTURE_ACCESS_TOKEN) {
      sendError(request, response, 403, "fixture_write_role_invalid");
      return;
    }
    await handleMemoryInsert(request, response, url, state);
    return;
  }
  if (table === "followups" && request.method === "POST") {
    if (bearerToken(request) !== FIXTURE_ACCESS_TOKEN) {
      sendError(request, response, 403, "fixture_write_role_invalid");
      return;
    }
    await handleFollowupInsert(request, response, url, state);
    return;
  }
  if (table === "conversation_messages" && request.method === "PATCH") {
    if (bearerToken(request) !== FIXTURE_ACCESS_TOKEN) {
      sendError(request, response, 403, "fixture_write_role_invalid");
      return;
    }
    await handleMessageSeenPatch(request, response, url, state);
    return;
  }
  if (table === "followups" && request.method === "PATCH") {
    if (bearerToken(request) !== FIXTURE_SERVICE_ROLE_KEY) {
      sendError(request, response, 403, "fixture_write_role_invalid");
      return;
    }
    await handleFollowupStatusPatch(request, response, url, state);
    return;
  }

  sendError(request, response, 405, "method_not_allowed");
}

function createRequestHandler(state) {
  return async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${FIXTURE_HOST}`);

      if (request.method === "OPTIONS") {
        sendEmpty(request, response, 204);
        return;
      }
      if (url.pathname === "/__health") {
        if (request.method !== "GET") {
          methodNotAllowed(request, response, new Set(["GET"]));
          return;
        }
        sendJson(request, response, 200, {
          ok: true,
          fixture: FIXTURE_NAME,
          binding: FIXTURE_HOST,
        });
        return;
      }
      const syntheticAuthorization = /^\/__social-authorization\/(instagram|facebook)$/u.exec(url.pathname);
      if (syntheticAuthorization) {
        if (request.method !== "GET" || url.search) {
          sendError(request, response, 405, "method_not_allowed");
          return;
        }
        response.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": "default-src 'none'",
        });
        response.end(`<main>Synthetic ${syntheticAuthorization[1]} authorization</main>`);
        return;
      }
      if (url.pathname === "/__state") {
        if (request.method !== "GET") {
          methodNotAllowed(request, response, new Set(["GET"]));
          return;
        }
        if (
          !requireFixtureToken(
            request,
            response,
            new Set([FIXTURE_SERVICE_ROLE_KEY]),
          )
        ) {
          return;
        }
        sendJson(request, response, 200, redactedState(state));
        return;
      }
      if (url.pathname === "/__reset") {
        if (request.method !== "POST") {
          methodNotAllowed(request, response, new Set(["POST"]));
          return;
        }
        if (
          !requireFixtureToken(
            request,
            response,
            new Set([FIXTURE_SERVICE_ROLE_KEY]),
          )
        ) {
          return;
        }
        resetFixtureState(state);
        sendJson(request, response, 200, {
          ok: true,
          state: redactedState(state),
        });
        return;
      }
      if (url.pathname.startsWith("/auth/v1/")) {
        await handleAuth(request, response, url);
        return;
      }
      if (url.pathname.startsWith("/rest/v1/")) {
        await handlePostgrest(request, response, url, state);
        return;
      }

      sendError(request, response, 404, "fixture_route_unknown");
    } catch (error) {
      const status = Number.isInteger(error?.status) ? error.status : 400;
      const code =
        typeof error?.message === "string" &&
        /^[a-z][a-z0-9_]*$/u.test(error.message)
          ? error.message
          : "fixture_request_invalid";
      sendError(request, response, status, code);
    }
  };
}

function parsePort(value) {
  if (value === undefined || value === "") return FIXTURE_DEFAULT_PORT;
  if (!/^\d{1,5}$/u.test(value)) throw new Error("fixture_port_invalid");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65_535) {
    throw new Error("fixture_port_invalid");
  }
  return port;
}

export async function startRegularUserCoreFlowFixture(options = {}) {
  const acknowledgement =
    options.acknowledgement ?? process.env.FANMIND_CORE_FLOW_FIXTURE_ACK;
  if (acknowledgement !== FIXTURE_ACKNOWLEDGEMENT) {
    throw new Error("fixture_ack_invalid");
  }

  const port = parsePort(
    options.port === undefined
      ? process.env.FANMIND_CORE_FLOW_FIXTURE_PORT
      : String(options.port),
  );
  const state = createFixtureState();
  const server = createServer(createRequestHandler(state));

  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off("listening", onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, FIXTURE_HOST);
  });

  return { server, state, address: server.address() };
}

async function runCli() {
  let fixture;
  try {
    fixture = await startRegularUserCoreFlowFixture();
  } catch (error) {
    const code =
      error instanceof Error && error.message === "fixture_ack_invalid"
        ? "fixture_ack_invalid"
        : "fixture_start_failed";
    process.stderr.write(`${JSON.stringify({ ok: false, code })}\n`);
    process.exitCode = 1;
    return;
  }

  const address = fixture.address;
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      code: "regular_user_core_flow_fixture_ready",
      host: FIXTURE_HOST,
      port:
        typeof address === "object" && address
          ? address.port
          : FIXTURE_DEFAULT_PORT,
    })}\n`,
  );

  const stop = () => {
    fixture.server.close(() => {
      process.exitCode = 0;
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

const isMain =
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  await runCli();
}

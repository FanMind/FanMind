#!/usr/bin/env node

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

const VERSION = "fanmind-server-error-acceptance-1";
const ACCEPTANCE_ACK = "server-error-production-email-disabled-acceptance";
const RELEASE_PATTERN = /^[0-9a-f]{40}$/u;
const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/u;
const SAFE_ERROR_PATTERN = /^server_error_acceptance_(?:ack_invalid|cleanup_failed|config_missing|contract_invalid|email_not_disabled|environment_invalid|release_invalid|store_[1-5][0-9]{2}|store_invalid|unexpected_failure)$/u;

function fail(code) {
  throw new Error(`server_error_acceptance_${code}`);
}

function log(level, event, fields = {}) {
  process.stdout.write(`${JSON.stringify({
    ts: new Date().toISOString(),
    version: VERSION,
    level,
    event,
    ...fields,
  })}\n`);
}

export function serverErrorAcceptanceFingerprint(releaseCommit) {
  if (!RELEASE_PATTERN.test(releaseCommit)) fail("release_invalid");
  return createHash("sha256")
    .update(`fanmind-server-error-acceptance:${releaseCommit}`)
    .digest("hex");
}

function configFromEnvironment(env) {
  if (env.FANMIND_RUNTIME_ENVIRONMENT !== "production") fail("environment_invalid");
  if (env.FANMIND_SERVER_ERROR_EMAIL_ENABLED !== "false") fail("email_not_disabled");
  if (env.FANMIND_SERVER_ERROR_ACCEPTANCE_ACK !== ACCEPTANCE_ACK) fail("ack_invalid");
  const releaseCommit = String(env.FANMIND_RELEASE_COMMIT ?? "").trim();
  if (!RELEASE_PATTERN.test(releaseCommit)) fail("release_invalid");
  const url = String(env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/$/u, "");
  const key = String(env.SUPABASE_SERVICE_ROLE_KEY ?? "");
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail("config_missing");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    !/^[a-z0-9]{8,64}\.supabase\.co$/u.test(parsed.hostname) ||
    key.length < 32
  ) {
    fail("config_missing");
  }
  return { url, key, releaseCommit };
}

async function request(config, path, init = {}) {
  const response = await fetch(`${config.url}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) fail(`store_${response.status}`);
  if (response.status === 204) return null;
  try {
    return await response.json();
  } catch {
    fail("store_invalid");
  }
}

function filter(name, value) {
  return `${name}=eq.${encodeURIComponent(value)}`;
}

async function cleanup(config, fingerprint) {
  const reference = `server_error:${fingerprint}`;
  await request(config, `/admin_notifications?${filter("technical_reference", reference)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  await request(config, `/server_error_events?${filter("fingerprint", fingerprint)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  await request(config, `/server_error_groups?${filter("fingerprint", fingerprint)}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}

async function selectRows(config, table, select, filterExpression) {
  const payload = await request(
    config,
    `/${table}?select=${encodeURIComponent(select)}&${filterExpression}`,
  );
  if (!Array.isArray(payload)) fail("store_invalid");
  return payload;
}

async function recordSyntheticError(config, fingerprint) {
  const payload = await request(config, "/rpc/record_server_error_event", {
    method: "POST",
    body: JSON.stringify({
      p_fingerprint: fingerprint,
      p_digest: null,
      p_route_path: "/internal/server-error-acceptance",
      p_route_type: "route",
      p_router_kind: "App Router",
      p_http_method: "GET",
      p_environment: "production",
      p_release_commit: config.releaseCommit,
      p_alert_threshold: 2,
      p_cooldown_minutes: 30,
    }),
  });
  const row = Array.isArray(payload) ? payload[0] : payload;
  if (!row || typeof row !== "object") fail("store_invalid");
  return row;
}

function validateTransition(row, expected) {
  if (
    row.fingerprint !== expected.fingerprint ||
    row.is_new !== expected.isNew ||
    row.recent_count !== expected.recentCount ||
    row.should_notify !== true ||
    row.severity !== expected.severity
  ) {
    fail("contract_invalid");
  }
}

async function proveStoredContract(config, fingerprint) {
  const reference = `server_error:${fingerprint}`;
  const [events, groups, notifications] = await Promise.all([
    selectRows(
      config,
      "server_error_events",
      "fingerprint,digest,route_path,route_type,router_kind,http_method,environment,release_commit",
      filter("fingerprint", fingerprint),
    ),
    selectRows(
      config,
      "server_error_groups",
      "fingerprint,occurrence_count,digest,route_path,route_type,router_kind,http_method,environment,latest_release_commit,status,last_notified_severity",
      filter("fingerprint", fingerprint),
    ),
    selectRows(
      config,
      "admin_notifications",
      "category,severity,status,title,message,source,technical_reference,metadata",
      filter("technical_reference", reference),
    ),
  ]);

  const eventContract = (row) =>
    row.fingerprint === fingerprint &&
    row.digest === null &&
    row.route_path === "/internal/server-error-acceptance" &&
    row.route_type === "route" &&
    row.router_kind === "App Router" &&
    row.http_method === "GET" &&
    row.environment === "production" &&
    row.release_commit === config.releaseCommit;
  const group = groups[0];
  const notification = notifications[0];
  if (
    events.length !== 2 ||
    !events.every(eventContract) ||
    groups.length !== 1 ||
    group?.fingerprint !== fingerprint ||
    Number(group?.occurrence_count) !== 2 ||
    group?.digest !== null ||
    group?.route_path !== "/internal/server-error-acceptance" ||
    group?.route_type !== "route" ||
    group?.router_kind !== "App Router" ||
    group?.http_method !== "GET" ||
    group?.environment !== "production" ||
    group?.latest_release_commit !== config.releaseCommit ||
    group?.status !== "open" ||
    group?.last_notified_severity !== "critical" ||
    notifications.length !== 1 ||
    notification?.category !== "critical" ||
    notification?.severity !== "critical" ||
    notification?.status !== "open" ||
    notification?.title !== "Serverfehler häufen sich" ||
    notification?.message !== `Mehrere serverseitige Fehler wurden derselben Gruppe zugeordnet. Referenz ${fingerprint.slice(0, 12)}.` ||
    notification?.source !== "server_error_tracking" ||
    notification?.technical_reference !== reference ||
    notification?.metadata?.fingerprint !== fingerprint ||
    Number(notification?.metadata?.recent_count) !== 2
  ) {
    fail("contract_invalid");
  }
  return { events: events.length, groups: groups.length, notifications: notifications.length };
}

async function verifyCleanup(config, fingerprint) {
  const reference = `server_error:${fingerprint}`;
  const [events, groups, notifications] = await Promise.all([
    selectRows(config, "server_error_events", "fingerprint", filter("fingerprint", fingerprint)),
    selectRows(config, "server_error_groups", "fingerprint", filter("fingerprint", fingerprint)),
    selectRows(
      config,
      "admin_notifications",
      "technical_reference",
      filter("technical_reference", reference),
    ),
  ]);
  if (events.length || groups.length || notifications.length) fail("cleanup_failed");
}

export function serverErrorAcceptanceErrorCode(error) {
  const value = String(error?.message ?? "");
  return SAFE_ERROR_PATTERN.test(value)
    ? value
    : "server_error_acceptance_unexpected_failure";
}

export async function runServerErrorProductionAcceptance(env = process.env) {
  const config = configFromEnvironment(env);
  const fingerprint = serverErrorAcceptanceFingerprint(config.releaseCommit);
  if (!FINGERPRINT_PATTERN.test(fingerprint)) fail("contract_invalid");

  await cleanup(config, fingerprint);
  await verifyCleanup(config, fingerprint);
  let result;
  let failure;
  try {
    const warning = await recordSyntheticError(config, fingerprint);
    validateTransition(warning, {
      fingerprint,
      isNew: true,
      recentCount: 1,
      severity: "warning",
    });
    const critical = await recordSyntheticError(config, fingerprint);
    validateTransition(critical, {
      fingerprint,
      isNew: false,
      recentCount: 2,
      severity: "critical",
    });
    result = await proveStoredContract(config, fingerprint);
  } catch (error) {
    failure = error;
  }

  try {
    await cleanup(config, fingerprint);
    await verifyCleanup(config, fingerprint);
  } catch {
    fail("cleanup_failed");
  }
  if (failure) throw failure;
  return { ...result, transitions: ["warning", "critical", "cleanup"], emailEnabled: false };
}

async function main() {
  try {
    const result = await runServerErrorProductionAcceptance();
    log("info", "acceptance_completed", {
      transitions: result.transitions,
      event_count: result.events,
      group_count: result.groups,
      notification_count: result.notifications,
      email_enabled: result.emailEnabled,
    });
  } catch (error) {
    log("error", "acceptance_failed", {
      error_code: serverErrorAcceptanceErrorCode(error),
    });
    process.exitCode = 1;
  }
}

const direct = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (direct) await main();

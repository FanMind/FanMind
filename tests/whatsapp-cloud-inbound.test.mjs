import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WHATSAPP_CLOUD_MAX_MESSAGES,
  buildWhatsAppCloudDiagnostic,
  evaluateWhatsAppCloudInboundRuntime,
  fingerprintWhatsAppCloudInboundEvent,
  parseWhatsAppCloudInboundPayload,
  readBoundedWhatsAppCloudBody,
  validateWhatsAppCloudSignature,
  validateWhatsAppCloudVerifyToken,
} from "../src/lib/whatsappCloudInboundPolicy.mjs";
import {
  applySql,
  evaluateWhatsAppCloudInboundSql,
  materializeWhatsAppCloudInboundPostflight,
} from "../scripts/operations/whatsapp-cloud-inbound-migration-runner.mjs";
import { evaluateWorkspaceProcessingEntitlement } from "../src/lib/workspaceProcessingPolicy.mjs";

const routePath = "src/app/api/webhooks/whatsapp/route.ts";
const migrationPath =
  "supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql";

function inboundFixture(overrides = {}) {
  const message = {
    from: "491701234567",
    id: "wamid.synthetic-001",
    timestamp: "1786838400",
    type: "text",
    text: { body: "Hallo FanMind" },
    ...(overrides.message ?? {}),
  };
  const value = {
    messaging_product: "whatsapp",
    metadata: {
      display_phone_number: "+43 660 0000000",
      phone_number_id: "109876543210987",
    },
    contacts: [
      { profile: { name: "Synthetic Contact" }, wa_id: "491701234567" },
    ],
    messages: [message],
    ...(overrides.value ?? {}),
  };
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "123456789012345",
        changes: [{ field: "messages", value, ...(overrides.change ?? {}) }],
        ...(overrides.entry ?? {}),
      },
    ],
    ...overrides.root,
  };
}

test("WhatsApp Cloud inbound is explicit non-production opt-in only", () => {
  assert.deepEqual(evaluateWhatsAppCloudInboundRuntime({}), {
    enabled: false,
    reason: "runtime_unknown",
  });
  assert.deepEqual(
    evaluateWhatsAppCloudInboundRuntime({
      FANMIND_RUNTIME_ENVIRONMENT: "staging",
    }),
    { enabled: false, reason: "feature_disabled" },
  );
  assert.deepEqual(
    evaluateWhatsAppCloudInboundRuntime({
      FANMIND_RUNTIME_ENVIRONMENT: "staging",
      FANMIND_WHATSAPP_CLOUD_INBOUND_ENABLED: "true",
    }),
    { enabled: true, reason: "enabled_non_production" },
  );
  assert.deepEqual(
    evaluateWhatsAppCloudInboundRuntime({
      FANMIND_RUNTIME_ENVIRONMENT: "production",
      FANMIND_WHATSAPP_CLOUD_INBOUND_ENABLED: "true",
    }),
    { enabled: false, reason: "production_forbidden" },
  );
});

test("verify token and app secret are exact, separate and timing-safe", () => {
  assert.equal(
    validateWhatsAppCloudVerifyToken({
      configuredToken: "verify-only",
      receivedToken: "verify-only",
    }).ok,
    true,
  );
  assert.equal(
    validateWhatsAppCloudVerifyToken({
      configuredToken: " verify-only",
      receivedToken: "verify-only",
    }).ok,
    false,
  );

  const rawBody = Buffer.from('{"fixture":true}', "utf8");
  const appSecret = "app-secret-only";
  const signature = `sha256=${createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex")}`;
  assert.deepEqual(
    validateWhatsAppCloudSignature({
      rawBody,
      signatureHeader: signature,
      configuredAppSecret: appSecret,
    }),
    { ok: true, errorCode: null },
  );
  assert.equal(
    validateWhatsAppCloudSignature({
      rawBody,
      signatureHeader: signature,
      configuredAppSecret: "verify-only",
    }).ok,
    false,
  );
});

test("raw body reader enforces declared and streamed byte bounds", async () => {
  const accepted = await readBoundedWhatsAppCloudBody(
    new Request("https://staging.example/webhook", {
      method: "POST",
      body: "12345678",
      headers: { "content-length": "8" },
    }),
    8,
  );
  assert.equal(accepted.ok, true);
  assert.equal(accepted.body?.toString("utf8"), "12345678");

  const declared = await readBoundedWhatsAppCloudBody(
    new Request("https://staging.example/webhook", {
      method: "POST",
      body: "x",
      headers: { "content-length": "9" },
    }),
    8,
  );
  assert.deepEqual(declared, {
    ok: false,
    errorCode: "payload_too_large",
    body: null,
  });

  const streamed = await readBoundedWhatsAppCloudBody(
    new Request("https://staging.example/webhook", {
      method: "POST",
      body: "123456789",
    }),
    8,
  );
  assert.deepEqual(streamed, {
    ok: false,
    errorCode: "payload_too_large",
    body: null,
  });
});

test("strict official message shape maps one bounded inbound text event", () => {
  const parsed = parseWhatsAppCloudInboundPayload(inboundFixture());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.events.length, 1);
  assert.deepEqual(parsed.events[0], {
    sourcePlatform: "whatsapp",
    sourceType: "whatsapp_messages",
    messageType: "dm",
    messageKind: "text",
    direction: "inbound",
    content: "Hallo FanMind",
    externalMessageId: "wamid.synthetic-001",
    externalThreadId: "109876543210987:491701234567",
    authorLabel: "Synthetic Contact",
    phoneNumberId: "109876543210987",
    senderId: "491701234567",
    receivedAt: "2026-08-16T00:00:00.000Z",
    payloadFingerprint:
      "00aff8c978101f3646245f88d0a050871a331e625dffb50ea83540678811e3cd",
  });
});

test("official type:text is explicit and fingerprints UTF-8 normalized payload bytes", () => {
  const fixture = inboundFixture();
  assert.equal(fixture.entry[0].changes[0].value.messages[0].type, "text");
  const parsed = parseWhatsAppCloudInboundPayload(fixture);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.events[0]?.messageKind, "text");
  assert.equal(
    parsed.events[0]?.payloadFingerprint,
    "00aff8c978101f3646245f88d0a050871a331e625dffb50ea83540678811e3cd",
  );
  assert.equal(
    fingerprintWhatsAppCloudInboundEvent({
      ...parsed.events[0],
      content: "Grüße 👋",
      authorLabel: "Jörg Ä.",
      externalMessageId: "wamid.unicode-001",
    }),
    "aebd5235910b26a046d8b3c667644d9a44b8b39990658386630340bb29ab1b05",
  );
});

test("contact display name is used only for the exactly matching wa_id", () => {
  const payload = inboundFixture({
    value: {
      contacts: [
        { profile: { name: "Wrong Contact" }, wa_id: "491709999999" },
        { profile: { name: "Right Contact" }, wa_id: "491701234567" },
      ],
    },
  });
  const parsed = parseWhatsAppCloudInboundPayload(payload);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.events[0]?.authorLabel, "Right Contact");
});

test("conflicting duplicate contacts and messages fail closed", () => {
  const contactConflict = inboundFixture({
    value: {
      contacts: [
        { profile: { name: "First Name" }, wa_id: "491701234567" },
        { profile: { name: "Changed Name" }, wa_id: "491701234567" },
      ],
    },
  });
  assert.equal(parseWhatsAppCloudInboundPayload(contactConflict).ok, false);

  const identicalDuplicate = inboundFixture();
  identicalDuplicate.entry[0].changes[0].value.messages.push({
    ...identicalDuplicate.entry[0].changes[0].value.messages[0],
    text: { body: "Hallo FanMind" },
  });
  const identicalResult = parseWhatsAppCloudInboundPayload(identicalDuplicate);
  assert.equal(identicalResult.ok, true);
  assert.equal(identicalResult.events.length, 1);
  assert.equal(identicalResult.duplicateCount, 1);

  const messageConflict = inboundFixture();
  messageConflict.entry[0].changes[0].value.messages.push({
    ...messageConflict.entry[0].changes[0].value.messages[0],
    text: { body: "Contradicting body" },
  });
  assert.equal(parseWhatsAppCloudInboundPayload(messageConflict).ok, false);
});

test("provider timestamps are bounded before a receipt can be claimed", () => {
  const fixedNow = Date.parse("2026-08-16T00:00:00.000Z");
  assert.equal(
    parseWhatsAppCloudInboundPayload(
      inboundFixture({ message: { timestamp: "946684799" } }),
      { now: fixedNow },
    ).ok,
    false,
  );
  assert.equal(
    parseWhatsAppCloudInboundPayload(
      inboundFixture({ message: { timestamp: "1786924800" } }),
      { now: fixedNow },
    ).ok,
    true,
  );
  assert.equal(
    parseWhatsAppCloudInboundPayload(
      inboundFixture({ message: { timestamp: "1786924801" } }),
      { now: fixedNow },
    ).ok,
    false,
  );
});

test("strict parser rejects fallback identifiers and malformed provider shapes", () => {
  for (const payload of [
    inboundFixture({ root: { object: "page" } }),
    inboundFixture({ change: { field: "feed" } }),
    inboundFixture({ value: { metadata: { display_phone_number: "+43" } } }),
    inboundFixture({ value: { metadata: { phone_number_id: " 109876543210987 " } } }),
    inboundFixture({ message: { id: "unscoped-id" } }),
    inboundFixture({ message: { id: " wamid.synthetic-001" } }),
    inboundFixture({ message: { from: "not-a-whatsapp-id" } }),
    inboundFixture({ message: { timestamp: "2026-08-16" } }),
    inboundFixture({ message: { text: { body: "" } } }),
  ]) {
    assert.equal(parseWhatsAppCloudInboundPayload(payload).ok, false);
  }
});

test("official delivery statuses are acknowledged but never ingested", () => {
  const payload = inboundFixture({
    value: {
      contacts: [],
      messages: undefined,
      statuses: [
        {
          id: "wamid.synthetic-001",
          status: "delivered",
          timestamp: "1786838400",
        },
      ],
    },
  });
  const parsed = parseWhatsAppCloudInboundPayload(payload);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.events.length, 0);
  assert.equal(parsed.unsupportedCount, 1);
});

test("message candidates are globally bounded across entries and changes", () => {
  const payload = inboundFixture();
  payload.entry[0].changes = Array.from({ length: 2 }, (_, changeIndex) => ({
    field: "messages",
    value: {
      ...payload.entry[0].changes[0].value,
      messages: Array.from(
        { length: Math.ceil(WHATSAPP_CLOUD_MAX_MESSAGES / 2) },
        (_, messageIndex) => ({
          ...payload.entry[0].changes[0].value.messages[0],
          id: `wamid.synthetic-${changeIndex}-${messageIndex}`,
        }),
      ),
    },
  }));
  assert.equal(parseWhatsAppCloudInboundPayload(payload).ok, false);
});

test("diagnostics expose fixed counts and booleans only", () => {
  const diagnostic = buildWhatsAppCloudDiagnostic({
    eventCount: 1,
    savedCount: 1,
    duplicateCount: 0,
    unsupportedCount: 0,
    schemaReady: true,
    phoneNumberId: "109876543210987",
    content: "secret message",
  });
  assert.deepEqual(Object.keys(diagnostic).sort(), [
    "connector_whatsapp_cloud",
    "duplicate_count",
    "event_count",
    "processing_blocked",
    "saved_count",
    "schema_ready",
    "schema_version",
    "unsupported_count",
  ]);
  assert.doesNotMatch(JSON.stringify(diagnostic), /109876543210987|secret message/u);
});

test("route authenticates bounded raw bytes before JSON and has no secret fallbacks", async () => {
  const route = await readFile(routePath, "utf8");
  const boundedAt = route.indexOf("readBoundedWhatsAppCloudBody(request)");
  const signatureAt = route.indexOf("validateWhatsAppCloudSignature({");
  const decodeAt = route.indexOf('new TextDecoder("utf-8"');
  const parseAt = route.indexOf("JSON.parse(jsonText)");

  assert.ok(boundedAt >= 0 && signatureAt > boundedAt);
  assert.ok(decodeAt > signatureAt && parseAt > decodeAt);
  assert.match(route, /WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN/u);
  assert.match(route, /WHATSAPP_CLOUD_APP_SECRET/u);
  assert.doesNotMatch(
    route,
    /FACEBOOK_|INSTAGRAM_|META_APP_SECRET|META_WEBHOOK_APP_SECRET/u,
  );
  assert.doesNotMatch(route, /fetch\s*\(|send(?:Message|_message)|graph\.facebook/u);
  const consoleCalls = [];
  for (const match of route.matchAll(/console\.(?:info|error)\(/gu)) {
    const statementEnd = route.indexOf(";", match.index);
    assert.ok(statementEnd > match.index);
    consoleCalls.push(route.slice(match.index, statementEnd + 1));
  }
  assert.ok(consoleCalls.length > 0);
  for (const consoleCall of consoleCalls) {
    assert.doesNotMatch(
      consoleCall,
      /request\.url|receivedToken|challenge|url\.searchParams/u,
    );
  }
  assert.match(route, /result\.errorCode === "idempotency_conflict"/u);
  assert.match(route, /conflict[\s\S]*409/u);
});

test("controlled schema gives one active phone binding and exact DB idempotency", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(
    migration,
    /create unique index social_connections_active_whatsapp_phone_unique_idx[\s\S]*on public\.social_connections \(page_id\)[\s\S]*platform = 'whatsapp'[\s\S]*provider = 'meta_whatsapp_cloud'[\s\S]*status = 'connected'/u,
  );
  assert.match(
    migration,
    /create unique index conversation_messages_whatsapp_identity_unique_idx[\s\S]*whatsapp_social_connection_id,[\s\S]*whatsapp_phone_number_id,[\s\S]*external_message_id[\s\S]*source_platform = 'whatsapp'/u,
  );
  assert.doesNotMatch(
    migration,
    /create unique index conversation_messages_whatsapp_external_message_unique_idx/iu,
  );
  assert.match(
    migration,
    /constraint whatsapp_cloud_receipt_identity_unique unique[\s\S]*social_connection_id,[\s\S]*phone_number_id,[\s\S]*external_message_id/u,
  );
  assert.match(migration, /add column whatsapp_payload_fingerprint text/u);
  assert.match(migration, /payload_fingerprint text not null/u);
  assert.match(
    migration,
    /whatsapp_cloud_receipt_message_workspace_fk[\s\S]*on delete set null \(conversation_message_id\)/u,
  );
  assert.match(
    migration,
    /status = 'stored' and lease_token is null and lease_until is null and last_error_code is null/u,
  );
  assert.match(
    migration,
    /conversation_messages_whatsapp_identity_server_insert[\s\S]*as restrictive[\s\S]*whatsapp_payload_fingerprint is null/u,
  );
  assert.match(
    migration,
    /conversation_messages_whatsapp_identity_check check \([\s\S]*when whatsapp_social_connection_id is not null[\s\S]*source_type is not distinct from 'whatsapp_messages'[\s\S]*else true/u,
  );
  assert.doesNotMatch(
    migration,
    /when source_platform is not distinct from 'whatsapp' then/u,
  );
  assert.match(
    migration,
    /conversation_messages_whatsapp_identity_server_update[\s\S]*using \(true\)[\s\S]*with check \(true\)/u,
  );
  assert.match(
    migration,
    /create function public\.protect_whatsapp_cloud_message_identity\(\)[\s\S]*auth\.role\(\) is distinct from 'service_role'[\s\S]*whatsapp_payload_fingerprint is distinct from[\s\S]*create trigger conversation_messages_whatsapp_identity_immutable/u,
  );
  assert.match(
    migration,
    /external_message_id = case[\s\S]*p_received_at >= conversation\.last_inbound_at[\s\S]*last_inbound_at = greatest[\s\S]*last_message_preview = case[\s\S]*updated_at = case/u,
  );
  assert.match(migration, /fanmind-whatsapp:v1:sha256:/u);
  assert.match(migration, /pg_get_constraintdef\(constraint_definition\.oid, true\)/u);
  assert.match(migration, /= 'true'::text/u);
  assert.match(migration, /function_definition\.protrftypes/u);
  assert.doesNotMatch(migration, /\.protransform\b/u);
  assert.match(
    migration,
    /create index whatsapp_cloud_webhook_receipts_retry_idx[\s\S]*updated_at, id[\s\S]*status in \('processing', 'retryable_error'\)/u,
  );
  assert.match(migration, /force row level security/u);
  assert.match(
    migration,
    /revoke all on table public\.whatsapp_cloud_webhook_receipts[\s\S]*public, anon, authenticated, service_role/u,
  );
  assert.doesNotMatch(
    migration,
    /grant (?:select|insert|update|delete|all)[\s\S]*whatsapp_cloud_webhook_receipts/u,
  );
});

test("controlled migration runner is checksum-pinned and materializes exact postflight bodies", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    evaluateWhatsAppCloudInboundSql(migration).digest,
    /^[0-9a-f]{64}$/u,
  );
  assert.throws(
    () => evaluateWhatsAppCloudInboundSql(`${migration}\n-- mutation`),
    /WHATSAPP_CLOUD_INBOUND_ERROR=control_checksum_mismatch/u,
  );
  const postflight = materializeWhatsAppCloudInboundPostflight(migration);
  assert.doesNotMatch(postflight, /__FANMIND_[A-Z_]+__/u);
  assert.match(postflight, /set transaction read only/u);
  assert.match(
    postflight,
    /set local search_path = pg_catalog, public, pg_temp;/u,
  );
  assert.match(
    applySql(migration),
    /select pg_advisory_lock\(20260817, 230000\)[\s\S]*WHATSAPP_CLOUD_INBOUND_APPLY_COMMIT=PASS/u,
  );
});

test("lease reclaim cannot be completed by a stale claimant", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /returns table \(receipt_id uuid, lease_token uuid, outcome text\)/u,
  );
  assert.match(migration, /lease_token = gen_random_uuid\(\)/u);
  assert.match(
    migration,
    /receipt\.lease_token = p_lease_token[\s\S]*receipt\.lease_until >= now\(\)/u,
  );
  assert.doesNotMatch(migration, /finish_whatsapp_cloud_inbound_message/u);
});

test("disconnect and store serialize on the same connection and cleanup leases", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const store = migration.slice(
    migration.indexOf("create function public.store_whatsapp_cloud_inbound_message"),
    migration.indexOf("create function public.disconnect_whatsapp_cloud_inbound_connection"),
  );
  const disconnect = migration.slice(
    migration.indexOf("create function public.disconnect_whatsapp_cloud_inbound_connection"),
  );
  const claim = migration.slice(
    migration.indexOf("create function public.claim_whatsapp_cloud_inbound_message"),
    migration.indexOf("create function public.store_whatsapp_cloud_inbound_message"),
  );

  assert.match(claim, /from public\.social_connections[\s\S]*for update/u);
  assert.match(store, /from public\.social_connections[\s\S]*for update/u);
  assert.match(store, /connection_record\.status is distinct from 'connected'/u);
  assert.match(disconnect, /update public\.social_connections/u);
  assert.match(
    disconnect,
    /page_access_token_encrypted = null[\s\S]*webhook_subscribed = false[\s\S]*status in \('processing', 'retryable_error'\)/u,
  );
  assert.match(disconnect, /lease_token = null[\s\S]*lease_until = null/u);
});

test("contact, conversation, message and receipt completion share one atomic RPC", async () => {
  const [migration, processor] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("src/lib/whatsappWebhook.ts", "utf8"),
  ]);
  const store = migration.slice(
    migration.indexOf("create function public.store_whatsapp_cloud_inbound_message"),
    migration.indexOf("create function public.disconnect_whatsapp_cloud_inbound_connection"),
  );
  const contactAt = store.indexOf("insert into public.contacts");
  const conversationAt = store.indexOf("insert into public.conversations");
  const messageAt = store.indexOf("insert into public.conversation_messages");
  const receiptAt = store.lastIndexOf("update public.whatsapp_cloud_webhook_receipts");

  assert.ok(contactAt >= 0 && conversationAt > contactAt);
  assert.ok(messageAt > conversationAt && receiptAt > messageAt);
  assert.match(store, /pg_advisory_xact_lock/u);
  assert.match(
    store,
    /connection_bound_thread_id :=[\s\S]*p_social_connection_id::text[\s\S]*connection_bound_contact_handle :=/u,
  );
  assert.match(
    store,
    /expected_payload_fingerprint :=[\s\S]*pg_catalog\.sha256[\s\S]*'conflict'::text/u,
  );
  assert.match(processor, /payloadFingerprint: event\.payloadFingerprint/u);
  assert.match(processor, /storeWhatsAppCloudInboundMessage/u);
  assert.doesNotMatch(processor, /createMetaWebhookConversationMessage/u);
});

test("atomic store uses the canonical processing contract before cancelling a receipt", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const store = migration.slice(
    migration.indexOf("create function public.store_whatsapp_cloud_inbound_message"),
    migration.indexOf("create function public.disconnect_whatsapp_cloud_inbound_connection"),
  );
  const contractAt = store.indexOf(
    "workspace_allowed := public.workspace_processing_allowed_contract(",
  );
  const cancellationAt = store.indexOf("if not workspace_allowed then");
  const receiptCancellationAt = store.indexOf("set status = 'cancelled'");

  assert.ok(contractAt >= 0);
  assert.ok(cancellationAt > contractAt);
  assert.ok(receiptCancellationAt > cancellationAt);
  assert.match(
    store,
    /workspace_record\.workspace_access_mode,[\s\S]*workspace_record\.subscription_effective_end_at::text,[\s\S]*workspace_record\.billing_status,[\s\S]*workspace_record\.billing_manual_override,[\s\S]*workspace_record\.billing_grace_until::text,[\s\S]*workspace_record\.billing_suspended_at::text,[\s\S]*workspace_record\.test_access_flags/u,
  );
  assert.doesNotMatch(
    store.slice(contractAt, cancellationAt),
    /billing_status\s*(?:=|in|not in)|billing_suspended_at\s+is/u,
  );
  assert.match(
    store.slice(cancellationAt, receiptCancellationAt + 200),
    /set status = 'cancelled',[\s\S]*last_error_code = null/u,
  );
});

test("trusted demo lookup and atomic store share the same allow result without cancelling its receipt", async () => {
  const trustedDemo = {
    workspace_access_mode: "active",
    subscription_effective_end_at: null,
    billing_status: "demo_free",
    billing_manual_override: false,
    billing_grace_until: null,
    billing_suspended_at: null,
    test_access_flags: { fixed_demo_seed_version: "2026-07-26-v1" },
  };
  assert.deepEqual(
    evaluateWorkspaceProcessingEntitlement(
      trustedDemo,
      new Date("2026-08-17T12:00:00.000Z"),
    ),
    { allowed: true, reason: "trusted_demo" },
  );

  const migration = await readFile(migrationPath, "utf8");
  assert.match(
    migration,
    /not public\.workspace_processing_allowed_contract\([\s\S]*'demo_free'[\s\S]*fixed_demo_seed_version[\s\S]*whatsapp_cloud_member_control_behavior_invalid/u,
  );
  assert.match(
    migration,
    /workspace_allowed := public\.workspace_processing_allowed_contract\([\s\S]*if not workspace_allowed then[\s\S]*set status = 'cancelled'/u,
  );
});

test("runtime schema state checks exact keys, predicates, RPC ACLs and security-definer paths", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const state = migration.slice(
    migration.indexOf("create function public.whatsapp_cloud_inbound_schema_state"),
    migration.indexOf("create function public.claim_whatsapp_cloud_inbound_message"),
  );
  assert.match(state, /definition\.indkey\[0\]/u);
  assert.match(state, /pg_get_expr\(definition\.indpred/u);
  assert.match(state, /aclexplode/u);
  assert.match(state, /not has_table_privilege/u);
  assert.match(state, /function_definition\.prosecdef/u);
  assert.match(state, /obj_description\(function_definition\.oid, 'pg_proc'\)/u);
  assert.match(state, /constraint_definition\.conparentid <> 0/u);
  assert.match(state, /definition\.indnullsnotdistinct/u);
  assert.match(state, /policy_definition\.polname not in/u);
  assert.match(state, /fanmind-whatsapp:v1:sha256/u);
  assert.match(state, /search_path=pg_catalog, public, pg_temp/u);
});

test("group diagnostics use only the current group error", async () => {
  const [processor, server] = await Promise.all([
    readFile("src/lib/whatsappWebhook.ts", "utf8"),
    readFile("src/lib/supabase/server.ts", "utf8"),
  ]);
  assert.match(
    processor,
    /let groupErrorCode:[\s\S]*const groupStatus = groupErrorCode[\s\S]*status: groupStatus/u,
  );
  assert.doesNotMatch(
    processor,
    /status: firstErrorCode \? "processing_failed" : "processed"/u,
  );
  assert.match(
    server,
    /if \(!entitlement\.allowed\) \{[\s\S]*connection: matches\[0\][\s\S]*lookupStatus: "processing_blocked"/u,
  );
  assert.match(
    processor,
    /lookupStatus === "processing_blocked"[\s\S]*connection: lookup\.connection/u,
  );
  assert.match(
    processor,
    /input\.unsupportedCount[\s\S]*status: "ignored_unsupported"[\s\S]*unsupportedCount: input\.unsupportedCount/u,
  );
  assert.match(processor, /unsupportedCount: 0,[\s\S]*status: groupStatus/u);
  assert.doesNotMatch(processor, /groupSkipped/u);
  assert.match(server, /normalizeWhatsAppCloudDiagnosticPayload/u);
});

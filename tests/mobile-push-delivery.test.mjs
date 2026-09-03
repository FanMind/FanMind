import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createMobilePushDeliveryService,
  EXPO_PUSH_RECEIPTS_ENDPOINT,
  EXPO_PUSH_SEND_ENDPOINT,
  MobilePushDeliveryError,
} from "../src/lib/mobilePushDelivery.mjs";
import {
  buildMinimalFollowupPushPayload,
  canonicalizeMobilePushDatabaseTimestamp,
  createMobilePushDeliveryIdempotencyKey,
  evaluateMobilePushDeliveryEnvironment,
  MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT,
  MOBILE_PUSH_DELIVERY_CONFIRMATION,
  MobilePushDeliveryPolicyError,
  validateEligibleMobilePushTarget,
  validateMobilePushDeliveryTrigger,
} from "../src/lib/mobilePushDeliveryPolicy.mjs";
import {
  decryptMobilePushToken,
  encryptMobilePushToken,
} from "../src/lib/mobilePushTokenCrypto.mjs";
import {
  EXPECTED_LEDGER_SHA256,
  LEDGER_POSTFLIGHT_SQL,
  evaluateMobilePushDeliveryLedgerSql,
} from "../scripts/operations/mobile-push-delivery-ledger-runner.mjs";

const IDS = Object.freeze({
  workspace: "11111111-1111-4111-8111-111111111111",
  user: "22222222-2222-4222-8222-222222222222",
  contact: "33333333-3333-4333-8333-333333333333",
  followup: "44444444-4444-4444-8444-444444444444",
  registration: "55555555-5555-4555-8555-555555555555",
  project: "66666666-6666-4666-8666-666666666666",
  attempt: "77777777-7777-4777-8777-777777777777",
});
const TOKEN = "ExponentPushToken[abcdefghijklmnop1234567890_-]";
const TOKEN_FINGERPRINT = "a".repeat(64);
const RECEIPT_ID = "AAAAAAAA-AAAA-AAAA-AAAA-AAAAAAAAAAAA";
const NOW = new Date("2026-08-16T12:00:00.000Z");
const REPOSITORY_ROOT = fileURLToPath(new URL("../", import.meta.url));
const REVIEWED_TARGETS = Object.freeze({
  appHostname: "staging.fanmind.ch",
  targetSupabaseProjectRef: "stagingref0123456789",
  productionSupabaseProjectRef: "prodref0123456789012",
});
const DELIVERY_LEDGER_SQL_URL = new URL(
  "../supabase/controlled/20260903190000_mobile_push_delivery_ledger.sql",
  import.meta.url,
);

test("delivery ledger SQL is pinned, atomic, browser-denied and dormant", async () => {
  const sql = await readFile(DELIVERY_LEDGER_SQL_URL, "utf8");
  const result = evaluateMobilePushDeliveryLedgerSql(sql);
  assert.equal(result.digest, EXPECTED_LEDGER_SHA256);
  for (const boundary of [
    /for update of w, m, f, c, r/iu,
    /pg_advisory_xact_lock\(hashtextextended\(v_idempotency_key, 0\)\)/iu,
    /r\.expo_token_hash = v_token_fingerprint/iu,
    /receipt_lease_hash is distinct from v_lease_hash/iu,
    /send_lease_hash is distinct from v_lease_hash/iu,
    /update public\.mobile_push_registrations set\s+status = 'disabled'[\s\S]*update public\.mobile_push_delivery_attempts set\s+state = 'rejected'/iu,
  ]) {
    assert.match(sql, boundary);
  }
  assert.match(sql, /revoke all on table public\.mobile_push_delivery_attempts\s+from public, anon, authenticated, service_role/iu);
  assert.doesNotMatch(sql, /create\s+policy|\bpg_cron\b|\bcron\.schedule\b|expo\.dev/iu);
  assert.throws(
    () => evaluateMobilePushDeliveryLedgerSql(`${sql}\n-- drift`),
    /ledger_checksum_mismatch/u,
  );
  assert.match(LEDGER_POSTFLIGHT_SQL, /set transaction read only/iu);
  assert.match(LEDGER_POSTFLIGHT_SQL, /acl\.grantee = 0/iu);
  assert.match(LEDGER_POSTFLIGHT_SQL, /has_function_privilege\('service_role'/iu);
  assert.match(LEDGER_POSTFLIGHT_SQL, /MOBILE_PUSH_DELIVERY_LEDGER_POSTFLIGHT=PASS/u);
});

test("delivery ledger server adapter keeps one validated RPC target", async () => {
  const source = await readFile(
    new URL("../src/lib/mobilePushDeliveryLedger.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /^import "server-only";/u);
  assert.match(source, /validateMobilePushDeliveryTargetBinding/u);
  assert.match(source, /ledger_target_binding_mismatch/u);
  assert.match(source, /\/rest\/v1\/rpc\//u);
  assert.match(source, /Authorization: `Bearer \$\{binding\.serviceRoleKey\}`/u);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)|mobilePushDelivery\.mjs/u);
});

function environment(overrides = {}) {
  return {
    NODE_ENV: "test",
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    FANMIND_MOBILE_PUSH_DELIVERY_ENABLED: "true",
    FANMIND_MOBILE_PUSH_EXPO_ACCESS_TOKEN:
      "expo_access_token_abcdefghijklmnopqrstuvwxyz",
    FANMIND_MOBILE_PUSH_EAS_PROJECT_ID: IDS.project,
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    NEXT_PUBLIC_APP_URL: `https://${REVIEWED_TARGETS.appHostname}`,
    NEXT_PUBLIC_SUPABASE_URL: `https://${REVIEWED_TARGETS.targetSupabaseProjectRef}.supabase.co`,
    FANMIND_TARGET_SUPABASE_PROJECT_REF:
      REVIEWED_TARGETS.targetSupabaseProjectRef,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:
      REVIEWED_TARGETS.productionSupabaseProjectRef,
    FANMIND_MOBILE_PUSH_PRODUCTION_ACTIVATION_CONFIRMED: "false",
    SUPABASE_SERVICE_ROLE_KEY:
      "synthetic_staging_service_role_key_abcdefghijklmnopqrstuvwxyz",
    ...overrides,
  };
}

function reviewedEnvironmentBindings(overrides = {}) {
  return {
    confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
    expectedProjectId: IDS.project,
    reviewedAppHostname: REVIEWED_TARGETS.appHostname,
    reviewedTargetSupabaseProjectRef:
      REVIEWED_TARGETS.targetSupabaseProjectRef,
    reviewedProductionSupabaseProjectRef:
      REVIEWED_TARGETS.productionSupabaseProjectRef,
    ...overrides,
  };
}

function reviewedServiceBindings(overrides = {}) {
  return {
    reviewedProjectId: IDS.project,
    reviewedAppHostname: REVIEWED_TARGETS.appHostname,
    reviewedTargetSupabaseProjectRef:
      REVIEWED_TARGETS.targetSupabaseProjectRef,
    reviewedProductionSupabaseProjectRef:
      REVIEWED_TARGETS.productionSupabaseProjectRef,
    ...overrides,
  };
}

function trigger(overrides = {}) {
  return {
    confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
    dueDateCutoff: "2026-08-16",
    followupId: IDS.followup,
    userId: IDS.user,
    workspaceId: IDS.workspace,
    ...overrides,
  };
}

function target(overrides = {}) {
  const base = {
    membership: {
      user_id: IDS.user,
      workspace_id: IDS.workspace,
      role: "member",
    },
    workspace: {
      id: IDS.workspace,
      billing_status: "active",
      billing_suspended_at: null,
      billing_manual_override: false,
      billing_grace_until: null,
      subscription_effective_end_at: null,
      workspace_access_mode: "active",
      test_access_flags: null,
    },
    contact: {
      id: IDS.contact,
      workspace_id: IDS.workspace,
    },
    followup: {
      id: IDS.followup,
      workspace_id: IDS.workspace,
      contact_id: IDS.contact,
      due_date: "2026-08-16",
      status: "open",
    },
    registration: {
      id: IDS.registration,
      user_id: IDS.user,
      workspace_id: IDS.workspace,
      expo_project_id: IDS.project,
      platform: "android",
      status: "active",
      expires_at: "2026-09-01T00:00:00.000Z",
      token: TOKEN,
      token_fingerprint: TOKEN_FINGERPRINT,
    },
  };
  return {
    ...base,
    ...overrides,
    membership: { ...base.membership, ...overrides.membership },
    workspace: { ...base.workspace, ...overrides.workspace },
    contact: { ...base.contact, ...overrides.contact },
    followup: { ...base.followup, ...overrides.followup },
    registration: { ...base.registration, ...overrides.registration },
  };
}

function ledger(overrides = {}) {
  const calls = [];
  const adapter = {
    calls,
    async reserve(value, targetBinding) {
      calls.push(["reserve", value, targetBinding]);
      return {
        status: "reserved",
        attemptId: IDS.attempt,
        attemptNumber: 1,
        leaseToken: "synthetic-lease-token-1234567890",
        revalidationContract: value.revalidationContract,
        revalidatedTargetHash: value.expectedTargetHash,
        revalidatedRegistrationTokenFingerprint:
          value.expectedRegistrationTokenFingerprint,
        revalidatedSupabaseProjectRef: targetBinding.supabaseProjectRef,
        revalidatedAt: value.reservedAt,
      };
    },
    async markTicket(value) {
      calls.push(["markTicket", value]);
    },
    async markRetry(value) {
      calls.push(["markRetry", value]);
    },
    async markIndeterminate(value) {
      calls.push(["markIndeterminate", value]);
    },
    async markTerminal(value) {
      calls.push(["markTerminal", value]);
    },
    async reserveReceiptCheck(value) {
      calls.push(["reserveReceiptCheck", value]);
      return {
        status: "reserved",
        attemptId: IDS.attempt,
        receiptId: RECEIPT_ID,
        projectId: IDS.project,
        registrationId: IDS.registration,
        attemptNumber: 1,
        receiptCheckNumber: 1,
        receiptLeaseToken: "synthetic-receipt-lease-token-1234567890",
        ticketCreatedAt: "2026-08-16T11:40:00.000Z",
      };
    },
    async markReceiptAccepted(value) {
      calls.push(["markReceiptAccepted", value]);
    },
    async markReceiptPending(value) {
      calls.push(["markReceiptPending", value]);
    },
    async markDeviceNotRegistered(value) {
      calls.push(["markDeviceNotRegistered", value]);
    },
    ...overrides,
  };
  return adapter;
}

function service({
  fetchImpl,
  ledgerAdapter = ledger(),
  targetValue = target(),
  loadTarget,
  env,
  reviewedBindings = reviewedServiceBindings(),
} = {}) {
  return {
    ledger: ledgerAdapter,
    sender: createMobilePushDeliveryService(
      {
        ...reviewedBindings,
        loadTarget: loadTarget ?? (async () => targetValue),
        ledger: ledgerAdapter,
        fetchImpl:
          fetchImpl ??
          (async () =>
            Response.json({
              data: { status: "ok", id: RECEIPT_ID },
            })),
        now: () => new Date(NOW),
      },
      env ?? environment(),
    ),
  };
}

test("missing or incomplete ledger fails closed before target or provider access", () => {
  let targetLoads = 0;
  let providerCalls = 0;
  const methodNames = [
    "reserve",
    "markTicket",
    "markRetry",
    "markIndeterminate",
    "markTerminal",
    "reserveReceiptCheck",
    "markReceiptAccepted",
    "markReceiptPending",
    "markDeviceNotRegistered",
  ];
  const incompleteLedgers = methodNames.map((methodName) => {
    const adapter = ledger();
    delete adapter[methodName];
    return adapter;
  });

  for (const ledgerAdapter of [undefined, null, {}, ...incompleteLedgers]) {
    assert.throws(
      () =>
        createMobilePushDeliveryService(
          {
            ...reviewedServiceBindings(),
            loadTarget: async () => {
              targetLoads += 1;
              return target();
            },
            ledger: ledgerAdapter,
            fetchImpl: async () => {
              providerCalls += 1;
              return Response.json({});
            },
          },
          environment(),
        ),
      (error) =>
        error instanceof MobilePushDeliveryError &&
        error.code === "delivery_ledger_not_configured",
    );
  }
  assert.equal(targetLoads, 0);
  assert.equal(providerCalls, 0);
});

const EXECUTABLE_SOURCE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".cjs",
  ".conf",
  ".mjs",
  ".mts",
  ".service",
  ".sh",
  ".sql",
  ".timer",
  ".ts",
  ".tsx",
  ".yaml",
  ".yml",
]);

async function executableFilesBelow(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await executableFilesBelow(path)));
    } else if (
      entry.isFile() &&
      EXECUTABLE_SOURCE_EXTENSIONS.has(extname(entry.name))
    ) {
      files.push(path);
    }
  }
  return files;
}

test("delivery stays fail-closed outside exact Staging activation", () => {
  assert.equal(evaluateMobilePushDeliveryEnvironment().ok, false);
  assert.equal(
    evaluateMobilePushDeliveryEnvironment(
      environment(),
      reviewedEnvironmentBindings(),
    ).ok,
    true,
  );

  for (const mutation of [
    { FANMIND_RUNTIME_ENVIRONMENT: "production" },
    { FANMIND_MOBILE_PUSH_DELIVERY_ENABLED: "false" },
    { NEXT_PUBLIC_APP_URL: "https://fanmind.ch" },
    {
      NEXT_PUBLIC_SUPABASE_URL: "https://prodref0123456789012.supabase.co",
      FANMIND_TARGET_SUPABASE_PROJECT_REF: "prodref0123456789012",
    },
    { FANMIND_MOBILE_PUSH_EXPO_ACCESS_TOKEN: "" },
    { FANMIND_MOBILE_PUSH_PRODUCTION_ACTIVATION_CONFIRMED: "true" },
  ]) {
    assert.equal(
      evaluateMobilePushDeliveryEnvironment(
        environment(mutation),
        reviewedEnvironmentBindings(),
      ).ok,
      false,
      JSON.stringify(mutation),
    );
  }
});

test("reviewed EAS binding is independent from the runtime environment value", async () => {
  let targetLoads = 0;
  let providerCalls = 0;
  const adapter = ledger();
  const sender = createMobilePushDeliveryService(
    {
      ...reviewedServiceBindings({
        reviewedProjectId: "99999999-9999-4999-8999-999999999999",
      }),
      loadTarget: async () => {
        targetLoads += 1;
        return target();
      },
      ledger: adapter,
      fetchImpl: async () => {
        providerCalls += 1;
        return Response.json({});
      },
      now: () => new Date(NOW),
    },
    environment(),
  );
  await assert.rejects(
    () => sender.deliver(trigger()),
    (error) =>
      error instanceof MobilePushDeliveryError &&
      error.code === "project_binding_invalid",
  );
  assert.equal(targetLoads, 0);
  assert.equal(providerCalls, 0);
});

test("reviewed app and Supabase bindings reject environment drift before target loading", async () => {
  for (const testCase of [
    {
      environment: { NEXT_PUBLIC_APP_URL: "https://preview.fanmind.ch" },
      code: "staging_api_target_invalid",
    },
    {
      environment: { NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch." },
      code: "staging_api_target_invalid",
    },
    {
      environment: {
        NEXT_PUBLIC_SUPABASE_URL:
          "https://otherstagingref1234.supabase.co",
        FANMIND_TARGET_SUPABASE_PROJECT_REF: "otherstagingref1234",
      },
      code: "staging_supabase_target_invalid",
    },
    {
      environment: {
        FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "otherprodref12345678",
      },
      code: "staging_supabase_target_invalid",
    },
    {
      environment: { SUPABASE_SERVICE_ROLE_KEY: "" },
      code: "service_role_not_configured",
    },
    {
      bindings: { reviewedAppHostname: "preview.fanmind.ch" },
      code: "staging_api_target_invalid",
    },
    {
      environment: { NEXT_PUBLIC_APP_URL: "https://preview.fanmind.ch" },
      bindings: { reviewedAppHostname: "preview.fanmind.ch" },
      code: "staging_api_target_invalid",
    },
    {
      bindings: {
        reviewedTargetSupabaseProjectRef: "otherstagingref1234",
      },
      code: "staging_supabase_target_invalid",
    },
    {
      bindings: {
        reviewedProductionSupabaseProjectRef: "otherprodref12345678",
      },
      code: "staging_supabase_target_invalid",
    },
  ]) {
    let targetLoads = 0;
    let providerCalls = 0;
    const sender = createMobilePushDeliveryService(
      {
        ...reviewedServiceBindings(testCase.bindings),
        loadTarget: async () => {
          targetLoads += 1;
          return target();
        },
        ledger: ledger(),
        fetchImpl: async () => {
          providerCalls += 1;
          return Response.json({});
        },
        now: () => new Date(NOW),
      },
      environment(testCase.environment),
    );

    await assert.rejects(
      () => sender.deliver(trigger()),
      (error) =>
        error instanceof MobilePushDeliveryError &&
        error.code === testCase.code,
      JSON.stringify(testCase),
    );
    assert.equal(targetLoads, 0, JSON.stringify(testCase));
    assert.equal(providerCalls, 0, JSON.stringify(testCase));
  }
});

test("trigger and target authorization reject CRM content and cross-tenant drift", () => {
  const acceptedTrigger = validateMobilePushDeliveryTrigger(trigger());
  assert.deepEqual(acceptedTrigger, trigger());
  assert.throws(
    () => validateMobilePushDeliveryTrigger(trigger({ contactName: "PII" })),
    { code: "invalid_trigger" },
  );

  const eligible = validateEligibleMobilePushTarget(target(), acceptedTrigger, {
    now: NOW,
    expectedProjectId: IDS.project,
  });
  assert.equal(eligible.contactId, IDS.contact);

  for (const drift of [
    { membership: { workspace_id: "88888888-8888-4888-8888-888888888888" } },
    { workspace: { workspace_access_mode: "archived_readonly" } },
    { contact: { workspace_id: "88888888-8888-4888-8888-888888888888" } },
    { followup: { status: "completed" } },
    { followup: { due_date: "2026-08-17" } },
    { registration: { expires_at: NOW.toISOString() } },
    { registration: { expires_at: "2026-08-17T24:00:00.000Z" } },
    { registration: { expires_at: "2026-08-28T12:00:00Z" } },
    { registration: { expires_at: "2026-10-01T00:00:00.000Z" } },
    { registration: { expo_project_id: "99999999-9999-4999-8999-999999999999" } },
    { registration: { token: ` ${TOKEN}` } },
    { registration: { token_fingerprint: "b".repeat(63) } },
    { registration: { token_fingerprint: "B".repeat(64) } },
  ]) {
    assert.throws(
      () =>
        validateEligibleMobilePushTarget(target(drift), acceptedTrigger, {
          now: NOW,
          expectedProjectId: IDS.project,
        }),
      (error) => error instanceof MobilePushDeliveryPolicyError,
      JSON.stringify(drift),
    );
  }

  assert.throws(
    () =>
      validateEligibleMobilePushTarget(
        target({ followup: { due_date: "2026-08-17" } }),
        validateMobilePushDeliveryTrigger(
          trigger({ dueDateCutoff: "2026-08-17" }),
        ),
        { now: NOW, expectedProjectId: IDS.project },
      ),
    { code: "followup_ineligible" },
  );
});

test("registration expiry is calendar-strict, canonical and future-bounded", () => {
  assert.equal(
    canonicalizeMobilePushDatabaseTimestamp("2026-08-28T12:00:00+00:00"),
    "2026-08-28T12:00:00.000Z",
  );
  assert.equal(
    canonicalizeMobilePushDatabaseTimestamp("2026-02-29T12:00:00+00:00"),
    null,
  );
  assert.equal(
    canonicalizeMobilePushDatabaseTimestamp("2024-02-29T12:00:00.123456Z"),
    "2024-02-29T12:00:00.123Z",
  );
});

test("payload and idempotency key are minimal, deterministic and content-free", () => {
  const eligible = validateEligibleMobilePushTarget(
    target(),
    validateMobilePushDeliveryTrigger(trigger()),
    { now: NOW, expectedProjectId: IDS.project },
  );
  const payload = buildMinimalFollowupPushPayload(eligible);
  assert.deepEqual(payload, {
    to: TOKEN,
    title: "FanMind",
    body: "Ein Follow-up ist fällig.",
    ttl: 3600,
    data: { type: "followup_reminder", followupId: IDS.followup },
    channelId: "followup-reminders",
  });
  assert.doesNotMatch(
    JSON.stringify(payload),
    /workspace|contact|reason|message|note|display_name|Sandra/iu,
  );
  assert.equal(
    createMobilePushDeliveryIdempotencyKey(eligible),
    createMobilePushDeliveryIdempotencyKey(eligible),
  );
  assert.match(createMobilePushDeliveryIdempotencyKey(eligible), /^mpd1_[0-9a-f]{64}$/u);
});

test("one explicit delivery records a ticket and returns only a fixed result", async () => {
  let providerRequest;
  let loadedInput;
  const { sender, ledger: adapter } = service({
    loadTarget: async (input) => {
      loadedInput = input;
      return target();
    },
    fetchImpl: async (url, init) => {
      providerRequest = { url, init };
      return Response.json({ data: { status: "ok", id: RECEIPT_ID } });
    },
  });
  const result = await sender.deliver(trigger());

  assert.deepEqual(result, {
    ok: true,
    status: "queued",
    code: "push_ticket_recorded",
    retryable: false,
  });
  assert.equal(providerRequest.url, EXPO_PUSH_SEND_ENDPOINT);
  assert.equal(providerRequest.init.method, "POST");
  assert.match(providerRequest.init.headers.Authorization, /^Bearer /u);
  assert.deepEqual(JSON.parse(providerRequest.init.body), {
    to: TOKEN,
    title: "FanMind",
    body: "Ein Follow-up ist fällig.",
    ttl: 3600,
    data: { type: "followup_reminder", followupId: IDS.followup },
    channelId: "followup-reminders",
  });
  assert.deepEqual(
    adapter.calls.map(([name]) => name),
    ["reserve", "markTicket"],
  );
  assert.deepEqual(
    {
      workspaceId: loadedInput.workspaceId,
      userId: loadedInput.userId,
      followupId: loadedInput.followupId,
      supabaseUrl: loadedInput.targetBinding.supabaseUrl,
      supabaseProjectRef: loadedInput.targetBinding.supabaseProjectRef,
      serviceRoleKeyBound: Boolean(loadedInput.targetBinding.serviceRoleKey),
    },
    {
      workspaceId: IDS.workspace,
      userId: IDS.user,
      followupId: IDS.followup,
      supabaseUrl: `https://${REVIEWED_TARGETS.targetSupabaseProjectRef}.supabase.co`,
      supabaseProjectRef: REVIEWED_TARGETS.targetSupabaseProjectRef,
      serviceRoleKeyBound: true,
    },
  );
  assert.equal(
    adapter.calls[0][1].revalidationContract,
    MOBILE_PUSH_ATOMIC_REVALIDATION_CONTRACT,
  );
  assert.equal(
    adapter.calls[0][1].expectedTargetHash,
    adapter.calls[0][1].idempotencyKey,
  );
  assert.equal(
    adapter.calls[0][1].expectedRegistrationTokenFingerprint,
    TOKEN_FINGERPRINT,
  );
  assert.equal(
    adapter.calls[0][1].expectedSupabaseProjectRef,
    REVIEWED_TARGETS.targetSupabaseProjectRef,
  );
  assert.strictEqual(adapter.calls[0][2], loadedInput.targetBinding);
  assert.doesNotMatch(JSON.stringify(result), /ExpoPushToken|receipt|workspace|contact/iu);
});

test("persistent reservation prevents duplicate provider calls", async () => {
  let providerCalls = 0;
  const adapter = ledger({
    async reserve(value) {
      this.calls.push(["reserve", value]);
      return { status: "duplicate" };
    },
  });
  const { sender } = service({
    ledgerAdapter: adapter,
    fetchImpl: async () => {
      providerCalls += 1;
      return Response.json({});
    },
  });
  assert.deepEqual(await sender.deliver(trigger()), {
    ok: false,
    status: "duplicate",
    code: "delivery_already_reserved",
    retryable: false,
  });
  assert.equal(providerCalls, 0);
});

test("a send reservation requires fresh atomic database revalidation", async () => {
  for (const mutation of [
    { revalidationContract: "missing-contract" },
    { revalidatedTargetHash: "mpd1_deadbeef" },
    { revalidatedRegistrationTokenFingerprint: "b".repeat(64) },
    { revalidatedSupabaseProjectRef: "otherstagingref1234" },
    {
      revalidatedAt: new Date(
        NOW.getTime() - 61 * 1000,
      ).toISOString(),
    },
  ]) {
    let providerCalls = 0;
    const adapter = ledger({
      async reserve(value, targetBinding) {
        this.calls.push(["reserve", value, targetBinding]);
        return {
          status: "reserved",
          attemptId: IDS.attempt,
          attemptNumber: 1,
          leaseToken: "synthetic-lease-token-1234567890",
          revalidationContract: value.revalidationContract,
          revalidatedTargetHash: value.expectedTargetHash,
          revalidatedRegistrationTokenFingerprint:
            value.expectedRegistrationTokenFingerprint,
          revalidatedSupabaseProjectRef: targetBinding.supabaseProjectRef,
          revalidatedAt: value.reservedAt,
          ...mutation,
        };
      },
    });
    const { sender } = service({
      ledgerAdapter: adapter,
      fetchImpl: async () => {
        providerCalls += 1;
        return Response.json({});
      },
    });

    await assert.rejects(
      () => sender.deliver(trigger()),
      (error) =>
        error instanceof MobilePushDeliveryError &&
        error.code === "delivery_ledger_invalid",
      JSON.stringify(mutation),
    );
    assert.equal(providerCalls, 0, JSON.stringify(mutation));
  }
});

test("retry, indeterminate transport and invalid device paths are fail-closed", async () => {
  {
    const adapter = ledger();
    const { sender } = service({
      ledgerAdapter: adapter,
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
    });
    const result = await sender.deliver(trigger());
    assert.equal(result.status, "retry_scheduled");
    assert.equal(result.ok, false);
    assert.equal(adapter.calls.at(-1)[0], "markRetry");
  }
  {
    const adapter = ledger();
    const { sender } = service({
      ledgerAdapter: adapter,
      fetchImpl: async () => {
        throw new Error("synthetic network failure");
      },
    });
    const result = await sender.deliver(trigger());
    assert.equal(result.status, "indeterminate");
    assert.equal(result.ok, false);
    assert.equal(result.retryable, false);
    assert.equal(adapter.calls.at(-1)[0], "markIndeterminate");
  }
  {
    const adapter = ledger();
    const { sender } = service({
      ledgerAdapter: adapter,
      fetchImpl: async () =>
        Response.json({
          data: {
            status: "error",
            message: `token ${TOKEN} rejected`,
            details: { error: "DeviceNotRegistered" },
          },
        }),
    });
    const result = await sender.deliver(trigger());
    assert.equal(result.code, "device_not_registered");
    assert.equal(result.ok, false);
    assert.deepEqual(
      adapter.calls.map(([name]) => name),
      ["reserve", "markDeviceNotRegistered"],
    );
    assert.deepEqual(adapter.calls[1][1], {
      attemptId: IDS.attempt,
      leaseToken: "synthetic-lease-token-1234567890",
      registrationId: IDS.registration,
      reason: "device_not_registered",
    });
    assert.doesNotMatch(JSON.stringify(adapter.calls), /ExponentPushToken/u);
  }
});

test("an indeterminate provider result plus ledger failure is never success", async () => {
  const adapter = ledger({
    async markIndeterminate() {
      throw new Error("synthetic ledger outage");
    },
  });
  const { sender } = service({
    ledgerAdapter: adapter,
    fetchImpl: async () => {
      throw new Error("synthetic network failure");
    },
  });
  assert.deepEqual(await sender.deliver(trigger()), {
    ok: false,
    status: "indeterminate",
    code: "ledger_state_indeterminate",
    retryable: false,
  });
});

test("invalid-device terminalization is one atomic fail-closed ledger operation", async () => {
  const adapter = ledger({
    async markDeviceNotRegistered(value) {
      this.calls.push(["markDeviceNotRegistered", value]);
      throw new Error("synthetic atomic ledger outage");
    },
  });
  const { sender } = service({
    ledgerAdapter: adapter,
    fetchImpl: async () =>
      Response.json({
        data: {
          status: "error",
          details: { error: "DeviceNotRegistered" },
        },
      }),
  });

  assert.deepEqual(await sender.deliver(trigger()), {
    ok: false,
    status: "indeterminate",
    code: "ledger_state_indeterminate",
    retryable: false,
  });
  assert.deepEqual(
    adapter.calls.map(([name]) => name),
    ["reserve", "markDeviceNotRegistered"],
  );
});

test("receipt lookup waits, records provider acceptance and disables invalid devices", async () => {
  let receiptCalls = 0;
  const adapter = ledger();
  const { sender } = service({
    ledgerAdapter: adapter,
    fetchImpl: async (url, init) => {
      receiptCalls += 1;
      assert.equal(url, EXPO_PUSH_RECEIPTS_ENDPOINT);
      assert.deepEqual(JSON.parse(init.body), { ids: [RECEIPT_ID] });
      return Response.json({ data: { [RECEIPT_ID]: { status: "ok" } } });
    },
  });
  assert.deepEqual(
    await sender.checkReceipt({
      attemptId: IDS.attempt,
      confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
    }),
    {
      ok: true,
      status: "accepted",
      code: "provider_receipt_ok",
      retryable: false,
    },
  );
  assert.equal(receiptCalls, 1);
  assert.deepEqual(
    adapter.calls.map(([name]) => name),
    ["reserveReceiptCheck", "markReceiptAccepted"],
  );

  const earlyAdapter = ledger({
    async reserveReceiptCheck(value) {
      this.calls.push(["reserveReceiptCheck", value]);
      return { status: "not_due" };
    },
  });
  const early = service({
    ledgerAdapter: earlyAdapter,
    fetchImpl: async () => {
      throw new Error("must not be called before 15 minutes");
    },
  });
  assert.equal(
    (
      await early.sender.checkReceipt({
        attemptId: IDS.attempt,
        confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
      })
    ).code,
    "receipt_check_not_due",
  );
  assert.equal(
    (
      await early.sender.checkReceipt({
        attemptId: IDS.attempt,
        confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
      })
    ).ok,
    false,
  );

  const invalidAdapter = ledger();
  const invalid = service({
    ledgerAdapter: invalidAdapter,
    fetchImpl: async () =>
      Response.json({
        data: {
          [RECEIPT_ID]: {
            status: "error",
            message: `private provider text ${TOKEN}`,
            details: { error: "DeviceNotRegistered" },
          },
        },
      }),
  });
  assert.equal(
    (
      await invalid.sender.checkReceipt({
        attemptId: IDS.attempt,
        confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
      })
    ).code,
    "device_not_registered",
  );
  assert.deepEqual(
    invalidAdapter.calls.map(([name]) => name),
    ["reserveReceiptCheck", "markDeviceNotRegistered"],
  );
  assert.deepEqual(invalidAdapter.calls[1][1], {
    attemptId: IDS.attempt,
    receiptLeaseToken: "synthetic-receipt-lease-token-1234567890",
    registrationId: IDS.registration,
    reason: "device_not_registered",
  });
  assert.doesNotMatch(JSON.stringify(invalidAdapter.calls), /ExponentPushToken/u);
});

test("receipt polling uses an atomic lease and is provider-bounded", async () => {
  let providerCalls = 0;
  const adapter = ledger({
    async reserveReceiptCheck(value) {
      this.calls.push(["reserveReceiptCheck", value]);
      return {
        status: "reserved",
        attemptId: IDS.attempt,
        receiptId: RECEIPT_ID,
        projectId: IDS.project,
        registrationId: IDS.registration,
        attemptNumber: 1,
        receiptCheckNumber: 4,
        receiptLeaseToken: "synthetic-receipt-lease-token-1234567890",
        ticketCreatedAt: "2026-08-16T11:40:00.000Z",
      };
    },
  });
  const { sender } = service({
    ledgerAdapter: adapter,
    fetchImpl: async () => {
      providerCalls += 1;
      return new Response("unavailable", { status: 503 });
    },
  });
  assert.deepEqual(
    await sender.checkReceipt({
      attemptId: IDS.attempt,
      confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
    }),
    {
      ok: false,
      status: "rejected",
      code: "receipt_lookup_exhausted",
      retryable: false,
    },
  );
  assert.equal(providerCalls, 1);
  assert.deepEqual(
    adapter.calls.map(([name]) => name),
    ["reserveReceiptCheck", "markTerminal"],
  );
  assert.equal(
    adapter.calls.at(-1)[1].receiptLeaseToken,
    "synthetic-receipt-lease-token-1234567890",
  );

  let inflightProviderCalls = 0;
  const inflight = service({
    ledgerAdapter: ledger({
      async reserveReceiptCheck(value) {
        this.calls.push(["reserveReceiptCheck", value]);
        return { status: "inflight" };
      },
    }),
    fetchImpl: async () => {
      inflightProviderCalls += 1;
      return Response.json({});
    },
  });
  assert.equal(
    (
      await inflight.sender.checkReceipt({
        attemptId: IDS.attempt,
        confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
      })
    ).status,
    "duplicate",
  );
  assert.equal(inflightProviderCalls, 0);
});

test("receipt ticket timestamps are canonical and bounded by the 24-hour window", async () => {
  for (const ticketCreatedAt of [
    "2026-08-16T11:40:00Z",
    "2026-08-16 11:40:00.000Z",
    "2026-08-16T12:00:00.001Z",
  ]) {
    let providerCalls = 0;
    const adapter = ledger({
      async reserveReceiptCheck(value) {
        this.calls.push(["reserveReceiptCheck", value]);
        return {
          status: "reserved",
          attemptId: IDS.attempt,
          receiptId: RECEIPT_ID,
          projectId: IDS.project,
          registrationId: IDS.registration,
          attemptNumber: 1,
          receiptCheckNumber: 1,
          receiptLeaseToken: "synthetic-receipt-lease-token-1234567890",
          ticketCreatedAt,
        };
      },
    });
    const { sender } = service({
      ledgerAdapter: adapter,
      fetchImpl: async () => {
        providerCalls += 1;
        return Response.json({});
      },
    });
    await assert.rejects(
      () =>
        sender.checkReceipt({
          attemptId: IDS.attempt,
          confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
        }),
      (error) =>
        error instanceof MobilePushDeliveryError &&
        error.code === "receipt_attempt_invalid",
      ticketCreatedAt,
    );
    assert.equal(providerCalls, 0, ticketCreatedAt);
  }

  let expiredProviderCalls = 0;
  const expiredAdapter = ledger({
    async reserveReceiptCheck(value) {
      this.calls.push(["reserveReceiptCheck", value]);
      return {
        status: "reserved",
        attemptId: IDS.attempt,
        receiptId: RECEIPT_ID,
        projectId: IDS.project,
        registrationId: IDS.registration,
        attemptNumber: 1,
        receiptCheckNumber: 1,
        receiptLeaseToken: "synthetic-receipt-lease-token-1234567890",
        ticketCreatedAt: "2026-08-15T11:59:59.999Z",
      };
    },
  });
  const expired = service({
    ledgerAdapter: expiredAdapter,
    fetchImpl: async () => {
      expiredProviderCalls += 1;
      return Response.json({});
    },
  });
  assert.deepEqual(
    await expired.sender.checkReceipt({
      attemptId: IDS.attempt,
      confirmation: MOBILE_PUSH_DELIVERY_CONFIRMATION,
    }),
    {
      ok: false,
      status: "rejected",
      code: "receipt_expired",
      retryable: false,
    },
  );
  assert.equal(expiredProviderCalls, 0);
  assert.equal(expiredAdapter.calls.at(-1)[0], "markTerminal");
});

test("provider fetch can only be injected by synthetic tests", () => {
  const adapter = ledger();
  assert.throws(
    () =>
      createMobilePushDeliveryService(
        {
          ...reviewedServiceBindings(),
          loadTarget: async () => target(),
          ledger: adapter,
          fetchImpl: async () => Response.json({}),
        },
        environment({ NODE_ENV: "production" }),
      ),
    (error) =>
      error instanceof MobilePushDeliveryError &&
      error.code === "provider_fetch_override_forbidden",
  );
});

test("encrypted registration tokens decrypt only with the dedicated key", () => {
  const previous = process.env.FANMIND_PUSH_TOKEN_ENCRYPTION_KEY;
  process.env.FANMIND_PUSH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString(
    "base64",
  );
  try {
    const ciphertext = encryptMobilePushToken(TOKEN);
    assert.equal(decryptMobilePushToken(ciphertext), TOKEN);
    const parts = ciphertext.split(":");
    const tamperedTag = Buffer.from(parts[2], "base64url");
    tamperedTag[0] ^= 0x01;
    const tamperedCiphertext = [
      parts[0],
      parts[1],
      tamperedTag.toString("base64url"),
      parts[3],
    ].join(":");
    assert.notEqual(tamperedCiphertext, ciphertext);
    assert.throws(
      () => decryptMobilePushToken(tamperedCiphertext),
      { code: "push_token_ciphertext_invalid" },
    );
  } finally {
    if (previous === undefined) {
      delete process.env.FANMIND_PUSH_TOKEN_ENCRYPTION_KEY;
    } else {
      process.env.FANMIND_PUSH_TOKEN_ENCRYPTION_KEY = previous;
    }
  }
});

test("server target loader selects authorization boundaries without CRM content", async () => {
  const [delivery, loader] = await Promise.all([
    readFile(
      new URL("../src/lib/mobilePushDelivery.mjs", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../src/lib/mobilePushDeliveryTarget.ts", import.meta.url),
      "utf8",
    ),
  ]);
  assert.match(delivery, /https:\/\/exp\.host\/--\/api\/v2\/push\/send/u);
  assert.match(delivery, /https:\/\/exp\.host\/--\/api\/v2\/push\/getReceipts/u);
  assert.doesNotMatch(delivery, /console\.(?:log|warn|error)/u);
  assert.match(delivery, /targetBinding: config\.targetBinding/u);
  assert.match(loader, /^import "server-only";/u);
  assert.match(loader, /validateMobilePushDeliveryTargetBinding/u);
  assert.match(loader, /serviceHeaders\(binding\)/u);
  assert.doesNotMatch(loader, /process\.env|getSupabaseRestUrl/u);
  assert.match(loader, /workspace_members/u);
  assert.match(loader, /mobile_push_registrations/u);
  assert.match(loader, /expo_token_ciphertext,expo_token_hash/u);
  assert.match(loader, /hashMobilePushToken\(token\) !== tokenFingerprint/u);
  assert.match(loader, /id,workspace_id,contact_id,due_date,status/u);
  assert.match(loader, /query\("id,workspace_id"/u);
  assert.doesNotMatch(
    loader,
    /display_name|handle|summary|internal_notes|reason|message_text|raw_payload/u,
  );
});

test("dormancy invariant rejects routes workers timers migrations and production wiring", async () => {
  const allowed = new Set([
    "src/lib/mobilePushDelivery.d.mts",
    "src/lib/mobilePushDelivery.mjs",
    "src/lib/mobilePushDeliveryPolicy.d.mts",
    "src/lib/mobilePushDeliveryPolicy.mjs",
    "src/lib/mobilePushDeliveryTarget.ts",
    "src/lib/mobilePushDeliveryLedger.ts",
    "src/lib/mobilePushStagingControlPolicy.mjs",
    "scripts/operations/mobile-push-delivery-ledger-runner.mjs",
    "scripts/operations/mobile-push-delivery-ledger-staging-acceptance.mjs",
    ".github/workflows/mobile-push-delivery-ledger-staging.yml",
    ".github/workflows/mobile-push-delivery-ledger-staging-acceptance.yml",
    "supabase/controlled/20260903190000_mobile_push_delivery_ledger.sql",
  ]);
  const roots = [
    "src",
    "apps",
    "scripts",
    ".github/workflows",
    "ops",
    "supabase",
  ];
  const violations = [];
  for (const root of roots) {
    for (const file of await executableFilesBelow(join(REPOSITORY_ROOT, root))) {
      const relativePath = relative(REPOSITORY_ROOT, file);
      if (allowed.has(relativePath)) continue;
      const source = await readFile(file, "utf8");
      if (
        /(?:\bfrom\s+|\bimport\s+|\bimport\s*\(\s*|\brequire\s*\(\s*)["'][^"']*mobilePushDelivery/u.test(
          source,
        ) ||
        /\b(?:createMobilePushDeliveryService|loadAuthorizedMobilePushDeliveryTarget)\s*\(/u.test(
          source,
        ) ||
        /mobile_push_delivery_(?:attempt|ledger|receipt|reservation)/iu.test(
          source,
        ) ||
        /mobile[-_]push[-_]delivery/iu.test(relativePath)
      ) {
        violations.push(relativePath);
      }
    }
  }
  assert.deepEqual(violations, []);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createFollowupNotificationIntent,
  createNotificationIntent,
  decideFollowupNotificationIntent,
  decideNotificationIntent,
  FOLLOWUP_NOTIFICATION_PATHNAME,
  FOLLOWUP_NOTIFICATION_ROUTE,
  FOLLOWUP_NOTIFICATION_TYPE,
  MAX_NOTIFICATION_RESPONSE_IDENTIFIER_LENGTH,
  MESSAGE_NOTIFICATION_SECTION,
  MESSAGE_NOTIFICATION_TYPES,
  parseFollowupNotificationData,
  parseMessageNotificationData,
} from "../apps/mobile/src/lib/pushNotificationPolicy.mjs";

const followupId = "5ab7de62-296e-4e79-9812-3455169e53e5";
const contactId = "dbaf648c-753e-4e49-a928-f306ac5de9f5";

test("accepts only the minimal follow-up reminder payload", () => {
  assert.deepEqual(
    parseFollowupNotificationData({
      type: FOLLOWUP_NOTIFICATION_TYPE,
      followupId,
    }),
    {
      type: FOLLOWUP_NOTIFICATION_TYPE,
      followupId,
      route: FOLLOWUP_NOTIFICATION_ROUTE,
      consumePathname: FOLLOWUP_NOTIFICATION_PATHNAME,
    },
  );
});

test("accepts only privacy-minimal message notification payloads", () => {
  for (const type of MESSAGE_NOTIFICATION_TYPES) {
    assert.deepEqual(
      parseMessageNotificationData({
        type,
        contactId,
        section: MESSAGE_NOTIFICATION_SECTION,
      }),
      {
        type,
        contactId,
        section: MESSAGE_NOTIFICATION_SECTION,
        route: `/(app)/contacts/${contactId}?section=messages`,
        consumePathname: `/contacts/${contactId}`,
      },
    );
  }
});

test("rejects malformed, ambiguous and data-rich notification payloads", () => {
  const rejectedFollowups = [
    null,
    [],
    {},
    { type: FOLLOWUP_NOTIFICATION_TYPE },
    { type: "contact_message", followupId },
    { type: FOLLOWUP_NOTIFICATION_TYPE, followupId: "not-a-uuid" },
    {
      type: FOLLOWUP_NOTIFICATION_TYPE,
      followupId,
      contactName: "Must not enter push data",
    },
    {
      type: FOLLOWUP_NOTIFICATION_TYPE,
      followupId,
      route: "/(app)/contacts",
    },
  ];

  for (const payload of rejectedFollowups) {
    assert.equal(parseFollowupNotificationData(payload), null);
  }

  const rejectedMessages = [
    null,
    [],
    {},
    { type: "message_received", contactId },
    { type: "message_received", contactId: "not-a-uuid", section: "messages" },
    { type: "message_unknown", contactId, section: "messages" },
    { type: "message_received", contactId, section: "knowledge" },
    {
      type: "message_received",
      contactId,
      section: "messages",
      fanName: "Must not enter push data",
    },
    {
      type: "message_received",
      contactId,
      section: "messages",
      messageText: "Must not enter push data",
    },
  ];

  for (const payload of rejectedMessages) {
    assert.equal(parseMessageNotificationData(payload), null);
  }
});

test("accepts only a bounded default notification response", () => {
  const defaultActionIdentifier = "default";
  const response = {
    actionIdentifier: defaultActionIdentifier,
    requestIdentifier: "notification-123",
    data: {
      type: FOLLOWUP_NOTIFICATION_TYPE,
      followupId,
    },
  };

  assert.deepEqual(
    createFollowupNotificationIntent(response, defaultActionIdentifier),
    {
      type: FOLLOWUP_NOTIFICATION_TYPE,
      followupId,
      route: FOLLOWUP_NOTIFICATION_ROUTE,
      consumePathname: FOLLOWUP_NOTIFICATION_PATHNAME,
      responseIdentifier: "notification-123",
    },
  );

  assert.equal(
    createNotificationIntent(
      { ...response, actionIdentifier: "custom" },
      defaultActionIdentifier,
    ),
    null,
  );
  assert.equal(
    createNotificationIntent(
      { ...response, requestIdentifier: "" },
      defaultActionIdentifier,
    ),
    null,
  );
  assert.equal(
    createNotificationIntent(
      {
        ...response,
        requestIdentifier: "x".repeat(
          MAX_NOTIFICATION_RESPONSE_IDENTIFIER_LENGTH + 1,
        ),
      },
      defaultActionIdentifier,
    ),
    null,
  );
  assert.equal(
    createNotificationIntent(
      {
        ...response,
        data: { ...response.data, contactName: "Must stay out" },
      },
      defaultActionIdentifier,
    ),
    null,
  );
});

test("message response routes to the exact fan messages section", () => {
  const intent = createNotificationIntent(
    {
      actionIdentifier: "default",
      requestIdentifier: "message-notification-1",
      data: {
        type: "message_received",
        contactId,
        section: "messages",
      },
    },
    "default",
  );

  assert.deepEqual(intent, {
    type: "message_received",
    contactId,
    section: "messages",
    route: `/(app)/contacts/${contactId}?section=messages`,
    consumePathname: `/contacts/${contactId}`,
    responseIdentifier: "message-notification-1",
  });
});

test("notification intent waits for auth and consumes only at its exact destination", () => {
  const followupIntent = {
    type: FOLLOWUP_NOTIFICATION_TYPE,
    followupId,
    route: FOLLOWUP_NOTIFICATION_ROUTE,
    consumePathname: FOLLOWUP_NOTIFICATION_PATHNAME,
    responseIdentifier: "notification-123",
  };
  const decideFollowup = (overrides = {}) =>
    decideNotificationIntent({
      authLoading: false,
      hasSession: true,
      segments: ["(app)", "contacts"],
      pathname: "/contacts",
      pendingIntent: followupIntent,
      ...overrides,
    });

  assert.equal(decideFollowup({ authLoading: true }), "wait");
  assert.equal(decideFollowup({ hasSession: false }), "wait");
  assert.equal(
    decideFollowup({ segments: ["(auth)", "login"], pathname: "/login" }),
    "wait",
  );
  assert.equal(
    decideFollowup({
      segments: ["(auth)", "reset-password"],
      pathname: "/reset-password",
    }),
    "wait",
  );
  assert.equal(decideFollowup(), "navigate");
  assert.equal(decideFollowup({ pathname: "/followups" }), "consume");
  assert.equal(decideFollowup({ pendingIntent: null }), "wait");

  assert.equal(
    decideFollowupNotificationIntent({
      authLoading: false,
      hasSession: true,
      segments: ["(app)", "followups"],
      pendingIntent: followupIntent,
    }),
    "consume",
  );
});

test("message intent never consumes on the wrong fan", () => {
  const intent = {
    type: "message_reminder",
    contactId,
    section: "messages",
    route: `/(app)/contacts/${contactId}?section=messages`,
    consumePathname: `/contacts/${contactId}`,
    responseIdentifier: "message-notification-2",
  };

  assert.equal(
    decideNotificationIntent({
      authLoading: false,
      hasSession: true,
      segments: ["(app)", "contacts", "[id]"],
      pathname: "/contacts/11111111-1111-4111-8111-111111111111",
      pendingIntent: intent,
    }),
    "navigate",
  );
  assert.equal(
    decideNotificationIntent({
      authLoading: false,
      hasSession: true,
      segments: ["(app)", "contacts", "[id]"],
      pathname: `/contacts/${contactId}`,
      pendingIntent: intent,
    }),
    "consume",
  );
});

test("mobile push navigation remains payload-minimal and delivery-free", async () => {
  const [appConfig, source, registration, provider, authLayout, indexRoute] =
    await Promise.all([
      readFile(new URL("../apps/mobile/app.json", import.meta.url), "utf8"),
      readFile(
        new URL("../apps/mobile/src/lib/pushNotifications.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL(
          "../apps/mobile/src/lib/mobilePushRegistration.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL(
          "../apps/mobile/src/providers/NotificationIntentProvider.tsx",
          import.meta.url,
        ),
        "utf8",
      ),
      readFile(
        new URL("../apps/mobile/app/(auth)/_layout.tsx", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../apps/mobile/app/index.tsx", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(appConfig, /"expo-notifications"/);
  assert.match(source, /addNotificationResponseReceivedListener/);
  assert.match(source, /setNotificationChannelAsync/);
  assert.match(source, /getLastNotificationResponse\(\)/);
  assert.match(source, /clearLastNotificationResponse\(\)/);
  assert.match(source, /createNotificationIntent/);
  assert.doesNotMatch(source, /router\.(?:push|replace)/);
  assert.doesNotMatch(source, /requestPermissionsAsync/);
  assert.doesNotMatch(source, /getExpoPushTokenAsync/);
  assert.match(registration, /requestPermissionsAsync/);
  assert.match(registration, /getExpoPushTokenAsync\(\{\s*projectId/u);
  assert.doesNotMatch(registration, /scheduleNotificationAsync/);
  assert.doesNotMatch(source, /scheduleNotificationAsync/);
  assert.ok(
    provider.indexOf(
      "const subscription = registerNotificationResponseListener",
    ) < provider.indexOf("const initialIntent = getLastNotificationIntent"),
  );
  assert.match(provider, /MAX_CONSUMED_RESPONSE_IDENTIFIERS = 32/);
  assert.match(provider, /usePathname\(\)/);
  assert.match(provider, /decideNotificationIntent/);
  assert.match(authLayout, /pendingIntent\?\.route \?\? "\/\(app\)"/);
  assert.match(indexRoute, /pendingIntent\?\.route \?\? "\/\(app\)"/);

  const consumeIdentifier = provider.indexOf(
    "const responseIdentifier = pendingIntent.responseIdentifier",
  );
  const clearNativeResponse = provider.indexOf(
    "clearLastNotificationIntent()",
    consumeIdentifier,
  );
  const consumeEffectEnd = provider.indexOf(
    "}, [loading, pathname, pendingIntent, router, segments, session])",
    clearNativeResponse,
  );
  assert.ok(consumeIdentifier >= 0);
  assert.ok(clearNativeResponse > consumeIdentifier);
  assert.ok(consumeEffectEnd > clearNativeResponse);
  assert.doesNotMatch(
    provider.slice(consumeIdentifier, consumeEffectEnd),
    /catch\s*\{\s*return;/u,
  );
});

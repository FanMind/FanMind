import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { shouldPersistMetaConnectionSyncStatus } from "../src/lib/metaSyncScopePolicy.mjs";

test("connection-wide Meta sync status is persisted only without a scoped identifier", () => {
  assert.equal(shouldPersistMetaConnectionSyncStatus(), true);
  assert.equal(shouldPersistMetaConnectionSyncStatus({}), true);
  assert.equal(
    shouldPersistMetaConnectionSyncStatus({
      contactId: undefined,
      fanSenderId: undefined,
    }),
    true,
  );
  assert.equal(
    shouldPersistMetaConnectionSyncStatus({
      contactId: null,
      fanSenderId: null,
    }),
    true,
  );
  assert.equal(
    shouldPersistMetaConnectionSyncStatus({
      contactId: "  ",
      fanSenderId: "\t",
    }),
    true,
  );
  assert.equal(
    shouldPersistMetaConnectionSyncStatus({ contactId: "contact-123" }),
    false,
  );
  assert.equal(
    shouldPersistMetaConnectionSyncStatus({ fanSenderId: "fan-123" }),
    false,
  );
  assert.equal(
    shouldPersistMetaConnectionSyncStatus({
      contactId: "  ",
      fanSenderId: "fan-123",
    }),
    false,
  );
  assert.equal(
    shouldPersistMetaConnectionSyncStatus({ contactId: 123 }),
    false,
  );
});

test("Facebook and Instagram gate all connection-wide sync status writes", async () => {
  const [facebook, instagram] = await Promise.all([
    readFile("src/app/channels/facebookWebhookActions.ts", "utf8"),
    readFile("src/app/channels/instagramWebhookActions.ts", "utf8"),
  ]);

  for (const source of [facebook, instagram]) {
    assert.match(
      source,
      /shouldPersistMetaConnectionSyncStatus\(input\)/u,
    );
    assert.match(
      source,
      /const shouldPersistConnectionStatus\s*=\s*shouldPersistMetaConnectionSyncStatus\(input\)/u,
    );
  }

  const facebookWrites =
    facebook.match(/await updateFacebookMessengerSyncStatus\(/gu) ?? [];
  const guardedFacebookWrites =
    facebook.match(
      /if \(shouldPersistConnectionStatus\) \{\s*await updateFacebookMessengerSyncStatus\(/gu,
    ) ?? [];
  const guardedFacebookResultWrites =
    facebook.match(
      /if \(shouldPersistConnectionStatus\) \{\s*const statusResult = await updateFacebookMessengerSyncStatus\(/gu,
    ) ?? [];
  assert.equal(facebookWrites.length, 3);
  assert.equal(
    guardedFacebookWrites.length + guardedFacebookResultWrites.length,
    facebookWrites.length,
  );

  const instagramErrorWrites =
    instagram.match(/await persistSyncStatus\(/gu) ?? [];
  const guardedInstagramErrorWrites =
    instagram.match(
      /if \(shouldPersistConnectionStatus\) \{\s*await persistSyncStatus\(/gu,
    ) ?? [];
  assert.equal(instagramErrorWrites.length, 2);
  assert.equal(
    guardedInstagramErrorWrites.length,
    instagramErrorWrites.length,
  );

  assert.match(
    instagram,
    /if \(shouldPersistConnectionStatus\) \{\s*const statusResult = await updateInstagramMessengerSyncStatus\(/u,
  );
});

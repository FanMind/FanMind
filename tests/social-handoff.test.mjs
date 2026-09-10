import assert from "node:assert/strict";
import test from "node:test";
import { onlyFansManualTarget } from "../src/lib/socialHandoffPolicy.mjs";

test("OnlyFans handoff accepts only explicitly stored HTTPS URLs on the exact provider host", () => {
  assert.equal(onlyFansManualTarget("https://onlyfans.com/creator"), "https://onlyfans.com/creator");
  assert.equal(onlyFansManualTarget("https://onlyfans.com/my/chats/chat/123"), "https://onlyfans.com/my/chats/chat/123");
  for (const value of [null, "javascript:alert(1)", "http://onlyfans.com/", "https://onlyfans.com.evil.test/", "https://evil.test/onlyfans.com", "https://me:secret@onlyfans.com/", "https://onlyfans.com:8443/", "https://onlyfans.com/?token=secret", "https://onlyfans.com/#access_token=secret", "https://onlyfans.com/%2f%2fevil.test"]) {
    assert.equal(onlyFansManualTarget(value), null);
  }
});

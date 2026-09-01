import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const detailUrl = new URL(
  "../apps/mobile/app/(app)/contacts/[id].tsx",
  import.meta.url,
);

test("Mobile marks inbound messages seen only while the Messages section is displayed", async () => {
  const detail = await readFile(detailUrl, "utf8");

  assert.match(
    detail,
    /activeSection !== "messages"[\s\S]*markContactInboundMessagesSeen\(\{/u,
  );
  assert.match(
    detail,
    /\[activeSection, contact, contactId, messageError, messages, workspace\?\.id, workspace\?\.role\]/u,
  );
  assert.doesNotMatch(
    detail,
    /const seenError =[\s\S]*await markContactInboundMessagesSeen/u,
  );
  assert.doesNotMatch(
    detail,
    /const refreshMessages[\s\S]*setMessageSeenError\([\s\S]*await markContactInboundMessagesSeen/u,
  );
});

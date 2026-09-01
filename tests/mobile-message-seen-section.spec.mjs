import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const detailUrl = new URL(
  "../apps/mobile/app/(app)/contacts/[id].tsx",
  import.meta.url,
);

test("Mobile marks inbound messages seen only for the settled exact contact Messages section", async () => {
  const detail = await readFile(detailUrl, "utf8");

  assert.match(
    detail,
    /const rawSectionParam = Array\.isArray\(params\.section\)[\s\S]*const sectionRouteKey = `\$\{contactId \?\? ""\}:\$\{rawSectionParam\}`/u,
  );
  assert.match(
    detail,
    /activeSection !== "messages"[\s\S]*contact\.id !== contactId[\s\S]*settledSectionRouteKey !== sectionRouteKey[\s\S]*markContactInboundMessagesSeen\(\{/u,
  );
  assert.match(
    detail,
    /setActiveSection\(requestedSection\);[\s\S]*setSettledSectionRouteKey\(sectionRouteKey\);/u,
  );
  assert.match(
    detail,
    /\[\s*activeSection,\s*contact,\s*contactId,\s*messageError,\s*messages,\s*sectionRouteKey,\s*settledSectionRouteKey,\s*workspace\?\.id,\s*workspace\?\.role,\s*\]/u,
  );
  assert.match(
    detail,
    /\}, \[requestedSection, sectionRouteKey\]\);/u,
  );
  assert.match(
    detail,
    /onPress=\{\(\) => setActiveSection\(section\.key\)\}/u,
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

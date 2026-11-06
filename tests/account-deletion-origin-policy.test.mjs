import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cookie-authenticated account deletion mutations require a trusted same-origin request", async () => {
  const source = await readFile("src/app/api/account-deletion/route.ts", "utf8");

  assert.match(source, /function assertTrustedMutationOrigin/u);
  assert.match(source, /if \(accessToken\) return/u);
  assert.match(source, /request\.headers\.get\("origin"\)/u);
  assert.match(source, /NEXT_PUBLIC_APP_URL/u);
  assert.match(source, /NEXT_PUBLIC_SITE_URL/u);
  assert.match(source, /FANMIND_APP_URL/u);
  assert.match(source, /request\.headers\.get\("sec-fetch-site"\)/u);
  assert.match(source, /invalid_request_origin/u);
  assert.match(
    source,
    /invalid_request_origin"[\s\S]*403[\s\S]*angemeldeten FanMind-Bereich/u,
  );

  const calls = source.match(/assertTrustedMutationOrigin\(request, context\.accessToken\)/gu) ?? [];
  assert.equal(calls.length, 2, "POST and DELETE must both enforce the origin boundary");
});

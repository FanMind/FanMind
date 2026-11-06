import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildSupabaseApiKeyHeaders,
  isOpaqueSupabaseApiKey,
} from "../src/lib/supabase/apiKeyPolicy.mjs";

const legacyAnon = "eyJlegacyAnon";
const legacyService = "eyJlegacyService";
const publishable = "sb_publishable_synthetic";
const secret = "sb_secret_synthetic";
const userJwt = "eyJuserSession";

test("legacy Supabase keys remain backward compatible", () => {
  assert.deepEqual(buildSupabaseApiKeyHeaders(legacyAnon), {
    apikey: legacyAnon,
    Authorization: `Bearer ${legacyAnon}`,
    "Content-Type": "application/json",
  });
  assert.deepEqual(buildSupabaseApiKeyHeaders(legacyAnon, legacyService), {
    apikey: legacyAnon,
    Authorization: `Bearer ${legacyService}`,
    "Content-Type": "application/json",
  });
});

test("opaque publishable keys carry a user JWT only when one exists", () => {
  assert.deepEqual(buildSupabaseApiKeyHeaders(publishable), {
    apikey: publishable,
    "Content-Type": "application/json",
  });
  assert.deepEqual(buildSupabaseApiKeyHeaders(publishable, userJwt), {
    apikey: publishable,
    Authorization: `Bearer ${userJwt}`,
    "Content-Type": "application/json",
  });
});

test("opaque secret keys use the apikey header and are never bearer tokens", () => {
  assert.equal(isOpaqueSupabaseApiKey(secret), true);
  const headers = buildSupabaseApiKeyHeaders(publishable, secret);
  assert.deepEqual(headers, {
    apikey: secret,
    "Content-Type": "application/json",
  });
  assert.equal("Authorization" in headers, false);
});

test("server-owned Supabase calls share the opaque-key transport policy", async () => {
  const paths = [
    "src/app/api/admin/assets/upload/route.ts",
    "src/app/settings/actions.ts",
    "src/lib/accountDeletionRequests.ts",
    "src/lib/adminAssets.ts",
    "src/lib/mobilePushRegistrations.ts",
    "src/lib/operations.ts",
    "src/lib/paymentTermsServerEvidence.ts",
    "src/lib/serverErrorTelemetry.ts",
    "src/lib/stripeBilling.ts",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));

  for (const source of sources) {
    assert.match(source, /getSupabase(?:ApiKey)?Headers/u);
    assert.doesNotMatch(
      source,
      /apikey:\s*(?:serviceKey|serviceRoleKey|config\.(?:key|anonKey))[\s\S]{0,120}Authorization:\s*`Bearer \$\{(?:serviceKey|serviceRoleKey|config\.key|serviceToken)\}`/u,
    );
  }
});

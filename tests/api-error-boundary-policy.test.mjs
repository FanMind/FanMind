import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  inspectDeclaredBodyLength,
  isTrustedMutationRequest,
  readBoundedJsonRequest,
} from "../src/lib/httpMutationPolicy.mjs";

function mutationRequest({
  origin = "https://fanmind.ch",
  fetchSite = "same-origin",
  body = "{}",
} = {}) {
  return new Request("https://fanmind.ch/api/mutation", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin,
      "sec-fetch-site": fetchSite,
    },
    body,
  });
}

test("browser mutations require an allowlisted HTTP origin and safe fetch site", () => {
  assert.equal(isTrustedMutationRequest(mutationRequest()), true);
  assert.equal(
    isTrustedMutationRequest(
      mutationRequest({ origin: "https://app.fanmind.ch" }),
      ["https://app.fanmind.ch"],
    ),
    true,
  );
  assert.equal(
    isTrustedMutationRequest(mutationRequest({ origin: "https://evil.invalid" })),
    false,
  );
  assert.equal(
    isTrustedMutationRequest(mutationRequest({ fetchSite: "cross-site" })),
    false,
  );
  const missingOrigin = mutationRequest();
  missingOrigin.headers.delete("origin");
  assert.equal(isTrustedMutationRequest(missingOrigin), false);
});

test("declared and streamed JSON bodies are bounded before parsing", async () => {
  assert.equal(inspectDeclaredBodyLength(null, 32), "unknown");
  assert.equal(inspectDeclaredBodyLength("32", 32), "accepted");
  assert.equal(inspectDeclaredBodyLength("33", 32), "too_large");
  assert.equal(inspectDeclaredBodyLength("1e3", 32), "invalid");
  assert.equal(inspectDeclaredBodyLength("-1", 32), "invalid");

  const accepted = await readBoundedJsonRequest(
    mutationRequest({ body: '{"ok":true}' }),
    32,
  );
  assert.deepEqual(accepted, { ok: true, reason: null, value: { ok: true } });

  const streamedOversize = await readBoundedJsonRequest(
    {
      headers: new Headers(),
      text: async () => JSON.stringify({ token: "secret-value".repeat(10) }),
    },
    32,
  );
  assert.deepEqual(streamedOversize, {
    ok: false,
    reason: "payload_too_large",
    value: null,
  });
});

test("public demo failures never forward Supabase or Turnstile response text", async () => {
  const [route, protection] = await Promise.all([
    readFile("src/app/api/demo/start/route.ts", "utf8"),
    readFile("src/lib/demoProtection.ts", "utf8"),
  ]);

  assert.doesNotMatch(route, /parseError\(|workspaceResult\.error\?\.message/u);
  assert.doesNotMatch(route, /error:\s*claim\.error/u);
  assert.match(route, /code: "demo_reservation_failed"/u);
  assert.doesNotMatch(protection, /response\.text\(\)|error instanceof Error \? error\.message/u);
  assert.doesNotMatch(protection, /\["error-codes"\].*join/u);
  assert.match(protection, /error: "demo_rpc_failed"/u);
});

test("checkout and Stripe lifecycle boundaries use only fixed failures", async () => {
  const [route, billing] = await Promise.all([
    readFile("src/app/api/billing/checkout/route.ts", "utf8"),
    readFile("src/lib/stripeBilling.ts", "utf8"),
  ]);

  assert.match(route, /isTrustedMutationRequest/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.doesNotMatch(route, /workspaceResult\.error\?\.message|session\.error/u);
  assert.match(route, /code: "checkout_unavailable"/u);
  assert.doesNotMatch(billing, /json\.error\?\.message/u);
  assert.doesNotMatch(
    billing,
    /console\.warn\([\s\S]{0,180}error instanceof Error \? error\.message/u,
  );
  assert.match(billing, /signal: AbortSignal\.timeout\(12000\)/u);
});

test("admin asset and optional Telegram paths redact provider errors", async () => {
  const [assetRoute, telegramRoute, server, ui] = await Promise.all([
    readFile("src/app/api/admin/assets/upload/route.ts", "utf8"),
    readFile("src/app/api/integrations/telegram/send-message/route.ts", "utf8"),
    readFile("src/lib/supabase/server.ts", "utf8"),
    readFile("src/app/fans/[id]/AiReplySuggestions.tsx", "utf8"),
  ]);

  assert.match(assetRoute, /isTrustedFanMindMutationRequest/u);
  assert.doesNotMatch(assetRoute, /uploadResponse\.text\(\)|uploadResponse\.statusText/u);
  assert.doesNotMatch(assetRoute, /SUPABASE_SERVICE_ROLE_KEY ist/u);
  assert.match(assetRoute, /code: "asset_upload_failed"/u);

  assert.match(telegramRoute, /isTrustedMutationRequest/u);
  assert.match(telegramRoute, /readBoundedJsonRequest/u);
  assert.match(telegramRoute, /MAX_TELEGRAM_TEXT_CHARACTERS = 4096/u);
  assert.doesNotMatch(
    telegramRoute,
    /error instanceof Error \? error\.message|result\.error\.message/u,
  );
  assert.doesNotMatch(server, /`Telegram-Versand fehlgeschlagen: \$\{description\}`/u);
  assert.doesNotMatch(
    server,
    /Telegram-Konversation konnte nicht geladen werden: \$\{conversationResult\.error\.message\}/u,
  );
  assert.match(server, /errorCode:\s*"provider_unavailable"/u);
  assert.match(ui, /maxLength=\{4096\}/u);
});

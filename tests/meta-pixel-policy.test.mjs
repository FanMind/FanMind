import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FANMIND_MARKETING_CONSENT_COOKIE,
  META_PIXEL_ACTIVE_EVENTS,
  META_PIXEL_PREPARED_EVENTS,
  META_PIXEL_PUBLIC_ROUTES,
  buildMetaPixelBootstrap,
  isMetaPixelEnabled,
  isMetaPixelPageViewAllowed,
  isMetaPixelPublicRoute,
  isMetaPixelReferrerAllowed,
  normalizeMarketingConsent,
  normalizeMetaPixelId,
  normalizeMetaPixelRoute,
} from "../src/lib/metaPixelPolicy.mjs";

const PIXEL_ID = "2069553844439892";

async function source(path) {
  return readFile(path, "utf8");
}

test("Meta Pixel ID and consent fail closed", () => {
  assert.equal(normalizeMetaPixelId(PIXEL_ID), PIXEL_ID);
  assert.equal(normalizeMetaPixelId(""), null);
  assert.equal(normalizeMetaPixelId("pixel-2069553844439892"), null);
  assert.equal(normalizeMetaPixelId("2069553844439892\nalert(1)"), null);

  assert.equal(normalizeMarketingConsent("granted"), "granted");
  assert.equal(normalizeMarketingConsent("denied"), "denied");
  assert.equal(normalizeMarketingConsent("anything"), "unset");
  assert.equal(
    isMetaPixelEnabled({ pixelId: PIXEL_ID, consent: "granted" }),
    true,
  );
  assert.equal(
    isMetaPixelEnabled({ pixelId: PIXEL_ID, consent: "denied" }),
    false,
  );
  assert.equal(
    isMetaPixelEnabled({ pixelId: "", consent: "granted" }),
    false,
  );
});

test("Meta Pixel is limited to explicit public routes and harmless URL values", () => {
  assert.ok(META_PIXEL_PUBLIC_ROUTES.includes("/"));
  assert.ok(META_PIXEL_PUBLIC_ROUTES.includes("/login"));
  assert.ok(META_PIXEL_PUBLIC_ROUTES.includes("/datenschutz"));
  assert.equal(isMetaPixelPublicRoute("/fans/contact-123"), false);
  assert.equal(isMetaPixelPublicRoute("/dashboard"), false);
  assert.equal(isMetaPixelPublicRoute("/settings/profile"), false);
  assert.equal(isMetaPixelPublicRoute("/reset-password"), false);

  assert.equal(
    isMetaPixelPageViewAllowed({ pathname: "/", search: "", hash: "" }),
    true,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({ pathname: "/", search: "?lang=en" }),
    true,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/register",
      search: "plan=growth&lang=de",
    }),
    true,
  );
  for (const search of ["plan=daily", "plan=daily&lang=en"]) {
    assert.equal(isMetaPixelPageViewAllowed({ pathname: "/register", search }), true);
  }
  for (const search of ["plan=daily-private", "plan=daily&ref=PRIVATE", "plan=daily&email=person%40example.com"]) {
    assert.equal(isMetaPixelPageViewAllowed({ pathname: "/register", search }), false);
  }
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/register",
      search: "plan=starter&option=starter_no_setup_commitment&lang=en",
    }),
    true,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/datenschutz",
      hash: "#marketing-messung",
    }),
    true,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/datenschutz",
      hash: "#email-person@example.com",
    }),
    false,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/login",
      search: "returnTo=%2Ffans%2Fcontact-123",
    }),
    false,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/",
      search: "email=person%40example.com",
    }),
    false,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/register",
      search: "plan=custom-person",
    }),
    false,
  );
  assert.equal(
    isMetaPixelPageViewAllowed({
      pathname: "/register",
      search: "plan=starter&option=starter-12",
    }),
    false,
  );
});

test("same-origin protected referrers and detailed external referrers are blocked", () => {
  assert.equal(
    isMetaPixelReferrerAllowed({ referrer: "", origin: "https://fanmind.ch" }),
    true,
  );
  assert.equal(
    isMetaPixelReferrerAllowed({
      referrer: "https://search.example/",
      origin: "https://fanmind.ch",
    }),
    true,
  );
  assert.equal(
    isMetaPixelReferrerAllowed({
      referrer: "https://search.example/result?q=fanmind",
      origin: "https://fanmind.ch",
    }),
    false,
  );
  assert.equal(
    isMetaPixelReferrerAllowed({
      referrer: "https://fanmind.ch/roadmap?lang=de",
      origin: "https://fanmind.ch",
    }),
    true,
  );
  assert.equal(
    isMetaPixelReferrerAllowed({
      referrer: "https://fanmind.ch/fans/contact-123",
      origin: "https://fanmind.ch",
    }),
    false,
  );
  assert.equal(
    isMetaPixelReferrerAllowed({
      referrer: "https://fanmind.ch/login?returnTo=%2Ffans%2Fcontact-123",
      origin: "https://fanmind.ch",
    }),
    false,
  );
});

test("bootstrap initializes exactly once, disables automatic events and does not fire PageView", () => {
  const bootstrap = buildMetaPixelBootstrap(PIXEL_ID);
  assert.equal(typeof bootstrap, "string");
  assert.match(bootstrap, /connect\.facebook\.net\/en_US\/fbevents\.js/u);
  assert.match(
    bootstrap,
    /fbq\('set','autoConfig',false,'2069553844439892'\)/u,
  );
  assert.match(bootstrap, /fbq\('init','2069553844439892'\)/u);
  assert.match(bootstrap, /__fanmindMetaPixelId==='2069553844439892'/u);
  assert.match(bootstrap, /referrerPolicy='no-referrer'/u);
  assert.equal((bootstrap.match(/fbq\('init'/gu) ?? []).length, 1);
  assert.doesNotMatch(bootstrap, /PageView|facebook\.com\/tr|noscript/iu);
  assert.doesNotMatch(
    bootstrap,
    /email|phone|external_id|user_data|advanced_matching/iu,
  );
});

test("only PageView is active while every conversion remains prepared", () => {
  assert.deepEqual([...META_PIXEL_ACTIVE_EVENTS], ["PageView"]);
  assert.deepEqual([...META_PIXEL_PREPARED_EVENTS], [
    "CompleteRegistration",
    "Lead",
    "ViewContent",
    "Contact",
    "Schedule",
    "StartTrial",
    "Purchase",
  ]);
  assert.equal(FANMIND_MARKETING_CONSENT_COOKIE, "fanmind_marketing_consent");
  assert.equal(normalizeMetaPixelRoute("/login"), "/login");
  assert.equal(normalizeMetaPixelRoute("//evil.example"), "/");
});

test("root layout mounts one global consent manager and reads only public configuration", async () => {
  const layout = await source("src/app/layout.tsx");
  assert.match(layout, /MarketingConsentManager/u);
  assert.match(layout, /FANMIND_MARKETING_CONSENT_COOKIE/u);
  assert.match(layout, /NEXT_PUBLIC_META_PIXEL_ID/u);
  assert.match(layout, /referrer: "strict-origin-when-cross-origin"/u);
  assert.match(layout, /<Suspense fallback=\{null\}>/u);
  assert.equal((layout.match(/<MarketingConsentManager/gu) ?? []).length, 1);
  assert.doesNotMatch(
    layout,
    /SUPABASE_SERVICE_ROLE_KEY|RESEND_API_KEY|STRIPE_SECRET_KEY|OPENAI_API_KEY/u,
  );
});

test("consent controls gate loading, protected URLs and later withdrawal", async () => {
  const [manager, loader, helper] = await Promise.all([
    source("src/components/marketing/MarketingConsentManager.tsx"),
    source("src/components/marketing/MetaPixelLoader.tsx"),
    source("src/lib/metaPixel.ts"),
  ]);

  assert.match(manager, /Nur notwendige/u);
  assert.match(manager, /Marketing erlauben/u);
  assert.match(manager, /Datenschutz-Einstellungen/u);
  assert.match(
    manager,
    /Aktiv ist ausschließlich PageView[\s\S]*ohne zusätzliche Eventparameter/u,
  );
  assert.match(
    manager,
    /Only PageView on approved public pages is active[\s\S]*no additional event parameters/u,
  );
  assert.doesNotMatch(manager, /CompleteRegistration|Lead/u);
  assert.match(manager, /isMetaPixelEnabled/u);
  assert.match(manager, /isMetaPixelPageViewAllowed/u);
  assert.match(manager, /isMetaPixelReferrerAllowed/u);
  assert.match(manager, /locationHash/u);
  assert.match(manager, /documentReferrer/u);
  assert.match(manager, /queueMicrotask\(syncLocationContext\)/u);
  assert.match(manager, /!pixelConfigured/u);
  assert.match(manager, /\|\|\s*!routeEligible/u);
  assert.match(manager, /revokeMetaPixelConsent/u);
  assert.match(manager, /SameSite=Lax/u);
  assert.match(loader, /strategy="afterInteractive"/u);
  assert.match(loader, /useSearchParams/u);
  assert.match(loader, /hash: window\.location\.hash/u);
  assert.match(helper, /currentPageIsEligible/u);
  assert.match(helper, /window\.location\.hash/u);
  assert.match(helper, /document\.referrer/u);
  assert.match(helper, /__fanmindMetaPixelLastRoute/u);
  assert.match(helper, /window\.fbq\("consent", "revoke"\)/u);
  assert.match(helper, /expireFirstPartyMetaCookie\("_fbp"\)/u);
  assert.match(helper, /expireFirstPartyMetaCookie\("_fbc"\)/u);
  assert.doesNotMatch(
    `${manager}\n${loader}\n${helper}`,
    /user\.email|display_name|contactId|messageContent|advancedMatching|external_id/u,
  );
});

test("event helper accepts no arbitrary payload and no conversion is wired", async () => {
  const helper = await source("src/lib/metaPixel.ts");
  const register = await source("src/app/register/RegisterClient.tsx");
  const inquiryForm = await source("src/components/landing/FooterInquiryForm.tsx");
  const repositorySources = await Promise.all([
    source("src/app/layout.tsx"),
    source("src/components/marketing/MarketingConsentManager.tsx"),
    source("src/components/marketing/MetaPixelLoader.tsx"),
  ]);

  assert.match(
    helper,
    /trackMetaPixelEvent\(eventName: MetaPixelActiveEventName\): boolean/u,
  );
  assert.doesNotMatch(helper, /trackMetaPixelEvent\([^)]*,/u);
  assert.doesNotMatch(helper, /customData|userData/u);
  assert.doesNotMatch(
    `${repositorySources.join("\n")}\n${register}\n${inquiryForm}`,
    /trackMetaPixelEvent\("(?:CompleteRegistration|Lead|ViewContent|Contact|Schedule|StartTrial|Purchase)"\)/u,
  );
  assert.match(helper, /!isActiveMetaPixelEvent\(eventName\)/u);
});

test("environment, privacy and runbook document the inactive-by-default rollout", async () => {
  const [envExample, stagingExample, privacy, runbook] = await Promise.all([
    source(".env.example"),
    source(".env.staging.example"),
    source("src/app/datenschutz/page.tsx"),
    source("docs/analytics/META_PIXEL.md"),
  ]);

  assert.match(envExample, /NEXT_PUBLIC_META_PIXEL_ID=2069553844439892/u);
  assert.match(stagingExample, /NEXT_PUBLIC_META_PIXEL_ID=/u);
  assert.match(privacy, /marketing-messung/u);
  assert.match(privacy, /Meta Pixel/u);
  assert.match(privacy, /ausdrücklichen (?:Marketing-)?Einwilligung/u);
  assert.match(
    privacy,
    /ausschließlich das Standardevent[\s\S]*<code>PageView<\/code>/u,
  );
  assert.match(
    privacy,
    /<code>PageView<\/code>[\s\S]*ohne zusätzliche[\s\S]*FanMind-Eventparameter/u,
  );
  assert.doesNotMatch(privacy, /<code>(?:CompleteRegistration|Lead)<\/code>/u);
  assert.match(runbook, /\| `PageView` \|/u);
  assert.match(runbook, /Nur vorbereitet, nicht verdrahtet/u);
  assert.match(runbook, /- `CompleteRegistration`/u);
  assert.match(runbook, /- `Lead`/u);
  assert.match(runbook, /weder `CompleteRegistration` noch `Lead`/u);
  assert.match(runbook, /Öffentliche Routengrenze/u);
  assert.match(runbook, /same-origin/iu);
  assert.match(runbook, /keine Conversions API/iu);
  assert.match(runbook, /kein erweitertes Matching/iu);
  assert.match(
    runbook,
    /Die Codeintegration allein bedeutet nicht, dass der Pixel bereits auf Production aktiv ist/u,
  );
});

test("browser E2E uses a synthetic Meta script and proves consent-gated PageView", async () => {
  const [workflow, spec] = await Promise.all([
    source(".github/workflows/browser-e2e.yml"),
    source("e2e/public-critical.spec.ts"),
  ]);

  assert.match(workflow, /NEXT_PUBLIC_META_PIXEL_ID: "2069553844439892"/u);
  assert.match(spec, /connect\.facebook\.net\/en_US\/fbevents\.js/u);
  assert.match(spec, /Marketing erlauben/u);
  assert.match(spec, /Nur notwendige/u);
  assert.match(spec, /2069553844439892/u);
  assert.match(spec, /autoConfig/u);
  assert.match(spec, /PageView/u);
  assert.match(spec, /returnTo=%2Ffans%2Fsynthetic-contact-reference/u);
  assert.match(spec, /Datenschutz-Einstellungen/u);
  assert.equal(spec.includes("facebook.com/tr"), false);
});

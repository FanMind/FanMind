import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";
import * as dailyReadiness from "../src/lib/internalDailyTestReadinessPolicy.mjs";

const workspaceId = "00000000-0000-4000-8000-000000000001";
const ownerId = "00000000-0000-4000-8000-000000000002";
const admin = { id: "synthetic-admin", email: "admin@example.invalid" };
const readyStripe = {
  hasSecretKey: true, hasWebhookSecret: true, hasAppUrl: true,
  hasInternalDailyTestPrice: true, readyForWebhook: true, readyForTax: true,
};
const styles = new Proxy({}, { get: (_, name) => String(name) });

function load(file, dependencies, globals = {}) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    exports, URL, Date, Response,
    fetch() { throw new Error("Unexpected provider request"); },
    ...globals,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("payment terms render consecutive numbers and matching anchors with Daily shown or hidden", async () => {
  const lengths = [];
  for (const showDaily of [true, false]) {
    const page = load("src/app/zahlungsbedingungen/page.tsx", {
      "react/jsx-runtime": jsxRuntime,
      "next/link": { default: "a" },
      "@/components/LegalTopHeader": { default: () => null },
      "@/lib/dailyOfferTermsVisibility": { showDailyOfferTerms: async () => showDaily },
      "@/lib/plans": { getCommercialTerms: () => ({ setupFeeCents: 0, monthlyFeeCents: 31200, commitmentMonths: 12 }) },
      "@/lib/publicDailyPlanPolicy.mjs": { PUBLIC_DAILY_PLAN_PRICE_CENTS: 100, PUBLIC_DAILY_PLAN_SETUP_FEE_CENTS: 0 },
      "./zahlungsbedingungen.module.css": { default: styles },
    });
    const html = renderToStaticMarkup(await page.default());
    const numbers = [...html.matchAll(/class="number" aria-hidden="true">(\d+)</gu)].map(match => Number(match[1]));
    const anchors = [...html.matchAll(/id="abschnitt-(\d+)"/gu)].map(match => Number(match[1]));
    assert.ok(numbers.length > 10);
    assert.deepEqual(numbers, Array.from({ length: numbers.length }, (_, index) => index + 1));
    assert.deepEqual(anchors, numbers);
    assert.equal(html.includes("<h2>Daily</h2>"), showDaily);
    assert.match(html, /<h2>KI-Stufen und Referral-Rabatte<\/h2>/u);
    lengths.push(numbers.length);
  }
  assert.equal(lengths[0], lengths[1] + 1);
});

test("admin Daily start reflects OFF, retains existing cancellation, and preserves all readiness conditions", async () => {
  for (const scenario of [
    { visible: false, internal: true, stripe: true, existing: true, enabled: false },
    { visible: true, internal: true, stripe: true, existing: false, enabled: true },
    { visible: true, internal: false, stripe: true, existing: false, enabled: false },
    { visible: true, internal: true, stripe: false, existing: false, enabled: false },
  ]) {
    const workspace = { id: workspaceId, name: "Synthetic", commercial_option: scenario.existing ? "internal_daily_test" : "starter_paid_setup" };
    const page = load("src/app/admin/billing/workspaces/[workspaceId]/page.tsx", {
      "react/jsx-runtime": jsxRuntime, "next/link": { default: "a" },
      "next/navigation": { notFound() { throw new Error("Unexpected missing workspace"); } },
      "@/lib/admin": { requirePlatformAdmin: async () => admin },
      "@/lib/adminBilling": {
        INTERNAL_DAILY_TEST_OPTION: "internal_daily_test",
        getAdminBillingWorkspace: async () => ({ workspace, error: null }),
        isInternalTestWorkspace: () => scenario.internal,
        listStripeInvoicesForWorkspace: async () => ({ invoices: [], error: null }),
      },
      "@/lib/billing": { getBillingStatusLabel: () => "Synthetic" },
      "@/lib/dashboardFeatures": { getCommercialOptionLabel: () => "Synthetic" },
      "@/lib/stripeBilling": { getStripeConfigStatus: () => ({ ...readyStripe, readyForTax: scenario.stripe }) },
      "@/lib/internalDailyTestReadinessPolicy.mjs": dailyReadiness,
      "@/lib/runtimeProductSettings": { getPublicDailyTestPlanEnabled: async () => scenario.visible },
      "../../AdminBillingShell": { AdminBillingShell: ({ children }) => children },
      "../../adminBilling.module.css": { default: styles },
    });
    const html = renderToStaticMarkup(await page.default({ params: Promise.resolve({ workspaceId }) }));
    const start = html.match(/<button\b[^>]*>1-€-Live-Testabo starten<\/button>/u)?.[0];
    assert.ok(start);
    assert.equal(start.includes("disabled="), !scenario.enabled);
    assert.equal(html.includes('id="daily-offer-closed"'), !scenario.visible);
    if (!scenario.visible) {
      assert.match(start, /aria-describedby="daily-offer-closed"/u);
      assert.match(html, /Bestehende Abos bleiben unverändert/u);
    }
    if (scenario.existing) {
      const cancel = html.match(/<button\b[^>]*>Live-Testabo deaktivieren<\/button>/u)?.[0];
      assert.ok(cancel);
      assert.doesNotMatch(cancel, /disabled=/u);
    }
  }
});

function routeHarness({ visible = true, authorized = true, result = { ok: true, status: 200, url: "https://checkout.example.invalid/synthetic" } } = {}) {
  let starts = 0;
  let reads = 0;
  const route = load("src/app/api/admin/billing/workspaces/[workspaceId]/internal-daily-test/route.ts", {
    "next/server": { NextResponse: {
      json: (body, init) => Response.json(body, init),
      redirect: (url, init) => new Response(null, { ...init, headers: { location: String(url) } }),
    } },
    "@/lib/admin": { requirePlatformAdmin: async () => { if (!authorized) throw new Error("unauthorized"); return admin; } },
    "@/lib/adminBilling": { startInternalDailyTestCheckout: async () => { starts += 1; return result; } },
    "@/lib/httpMutationPolicy.mjs": { isTrustedFanMindMutationRequest: request => mutationPolicy.isTrustedFanMindMutationRequest(request, {}) },
    "@/lib/runtimeProductSettings": { getPublicDailyTestPlanEnabled: async () => { reads += 1; return visible; } },
  });
  const request = (origin = "https://fanmind.ch") => new Request(`https://fanmind.ch/api/admin/billing/workspaces/${workspaceId}/internal-daily-test`, { method: "POST", headers: { origin } });
  return { route, request, context: { params: Promise.resolve({ workspaceId }) }, counts: () => ({ starts, reads }) };
}

test("admin Daily POST rejects OFF explicitly before checkout while preserving authentication and origin checks", async () => {
  const closed = routeHarness({ visible: false });
  const response = await closed.route.POST(closed.request(), closed.context);
  assert.equal(response.status, 409);
  assert.equal((await response.json()).error, "offer_unavailable");
  assert.deepEqual(closed.counts(), { starts: 0, reads: 1 });
  const foreign = routeHarness();
  assert.equal((await foreign.route.POST(foreign.request("https://foreign.invalid"), foreign.context)).status, 403);
  assert.deepEqual(foreign.counts(), { starts: 0, reads: 0 });
  const denied = routeHarness({ authorized: false });
  await assert.rejects(denied.route.POST(denied.request(), denied.context), /unauthorized/u);
  assert.deepEqual(denied.counts(), { starts: 0, reads: 0 });
});

test("admin Daily POST preserves successful redirection and reports a switch closed during checkout preparation", async () => {
  const open = routeHarness();
  const redirect = await open.route.POST(open.request(), open.context);
  assert.equal(redirect.status, 303);
  assert.equal(redirect.headers.get("location"), "https://checkout.example.invalid/synthetic");
  const closed = routeHarness({ result: { ok: false, status: 409, code: "offer_unavailable", error: "private provider text" } });
  const response = await closed.route.POST(closed.request(), closed.context);
  assert.equal(response.status, 409);
  const text = await response.text();
  assert.match(text, /offer_unavailable/u);
  assert.doesNotMatch(text, /private provider text/u);
});

test("actual admin billing helper preserves late closed-offer code without persisting a Workspace mutation", async () => {
  const requests = [];
  let checkouts = 0;
  const workspace = { id: workspaceId, owner_user_id: ownerId, billing_status: "demo_free", test_access_flags: { internal: true, test: true, billing_disabled: true } };
  const billing = load("src/lib/adminBilling.ts", {
    "@/lib/stripeBilling": {
      getStripeConfigStatus: () => readyStripe,
      resolveCheckoutPlan: () => ({ planId: "pilot", commercialOption: "internal_daily_test" }),
      createStripeCheckoutSession: async () => { checkouts += 1; return { code: "offer_unavailable", error: "private provider text" }; },
      expireStripeCheckoutSession() { throw new Error("No session exists to expire"); },
    },
    "@/lib/internalDailyTestReadinessPolicy.mjs": dailyReadiness,
    "@/lib/stripeBillingWriteFreeze.mjs": { STRIPE_BILLING_WRITE_FREEZE_CODE: "billing_write_frozen" },
    "@/lib/stripeClient": { getStripeClient() { throw new Error("Unexpected Stripe client"); } },
    "@/lib/supabase/config": {
      getSupabaseRestUrl: table => `https://database.example.invalid/${table}`,
      getSupabaseAuthUrl: route => `https://database.example.invalid${route}`,
      getSupabaseHeaders: () => ({}),
    },
  }, {
    process: { env: { SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-a-credential" } },
    fetch: async (url, options) => {
      assert.equal(options.method ?? "GET", "GET");
      requests.push(String(url));
      return Response.json(String(url).includes("/admin/users/") ? { email: "owner@example.invalid" } : [workspace]);
    },
  });
  const result = await billing.startInternalDailyTestCheckout(workspaceId, admin);
  assert.equal(result.code, "offer_unavailable");
  assert.equal(result.status, 409);
  assert.equal(result.ok, false);
  assert.equal(checkouts, 1);
  assert.equal(requests.length, 2);
  assert.doesNotMatch(result.error, /private provider text/u);
});

import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as capacityPolicy from "../src/lib/capacityRegistrationPolicy.mjs";
import * as termsPolicy from "../src/lib/paymentTermsActivationPolicy.mjs";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";
import * as dailyReadinessPolicy from "../src/lib/internalDailyTestReadinessPolicy.mjs";

const revision = termsPolicy.CURRENT_PAYMENT_TERMS_VERSION;
const accepted = { paymentTermsAccepted: true, paymentTermsVersion: revision };
const selections = [
  { planId: "pilot", commercialOption: "internal_daily_test" },
];

test("consent requires the exact displayed revision and an explicit acceptance", () => {
  const enabled = { activationEnabled: true };
  assert.equal(termsPolicy.evaluatePaymentTermsSubmission(accepted, enabled).ready, true);
  for (const paymentTermsVersion of [undefined, null, "", "obsolete-revision", ` ${revision}`, `${revision} `, 2026, [revision]]) {
    assert.equal(termsPolicy.evaluatePaymentTermsSubmission({ ...accepted, paymentTermsVersion }, enabled).code, "version_mismatch");
  }
  for (const paymentTermsAccepted of [undefined, false, "true", "on", 1]) {
    assert.equal(termsPolicy.evaluatePaymentTermsSubmission({ ...accepted, paymentTermsAccepted }, enabled).code, "not_accepted");
  }
  for (const activationEnabled of [false, "true", 1, null]) {
    assert.equal(termsPolicy.evaluatePaymentTermsSubmission(accepted, { activationEnabled }).code, "version_unresolved");
  }
});

function compile(path, suffix = "") {
  return ts.transpileModule(fs.readFileSync(path, "utf8") + suffix, {
    fileName: path,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
}

const compiledTrusted = compile("src/lib/trustedWorkspaceProvisioning.ts");
const compiledRoute = compile("src/app/api/register/workspace/route.ts");
// Expose the actual private action only in the test VM; production exports stay unchanged.
const compiledPage = compile("src/app/workspace/setup/page.tsx", "\nexport { provisionWorkspace };\n");

const readyStripeConfig = {
  hasSecretKey: true,
  hasWebhookSecret: true,
  hasAppUrl: true,
  hasInternalDailyTestPrice: true,
  readyForWebhook: true,
  readyForTax: true,
};

function harness({
  activationEnabled = true,
  authenticated = true,
  locale = "de",
  workspaceProvisioningReady = true,
  stripeConfig = readyStripeConfig,
  dailyEnabled = true,
  existingWorkspaceResult = { workspace: null },
  userMetadata = {
    plan: "ultra", commercial_option: "forged-option",
    payment_terms_accepted: true, payment_terms_version: revision,
    payment_terms_accepted_at: "2000-01-01T00:00:00.000Z",
  },
} = {}) {
  const calls = [];
  const user = {
    id: "synthetic-owner",
    email: "synthetic@example.invalid",
    user_metadata: userMetadata,
  };
  const policy = {
    ...termsPolicy,
    isPaymentTermsActivationEnabled: () => activationEnabled,
    evaluatePaymentTermsSubmission: (submission) => termsPolicy.evaluatePaymentTermsSubmission(submission, { activationEnabled }),
  };
  class Redirect extends Error {
    constructor(location) { super(location); this.location = location; }
  }
  const dependencies = {
    "@/lib/capacityRegistrationPolicy.mjs": capacityPolicy,
    "@/components/CapacityPackageSelection": { CapacityPackageSelection: "capacity-selection" },
    "server-only": {},
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "next/navigation": { redirect(location) { throw new Redirect(location); } },
    "next/link": { default: "a" },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "../../dashboard/dashboard.module.css": { default: {} },
    "@/lib/paymentTermsActivationPolicy.mjs": policy,
    "@/lib/httpMutationPolicy.mjs": {
      ...mutationPolicy,
      isTrustedFanMindMutationRequest: (request) => mutationPolicy.isTrustedFanMindMutationRequest(request, {}),
    },
    "@/lib/preActivation": { getBillingContinuationHref: () => "/billing/synthetic" },
    "@/lib/workspaceLocale": { resolveWorkspaceLocale: async () => locale },
    "@/lib/workspaceAuthorization": { getUserAuthorizedWorkspaceDashboard: async () => existingWorkspaceResult },
    "@/lib/internalDailyTestReadinessPolicy.mjs": { ...dailyReadinessPolicy, isInternalDailyTestBillingRuntimeReady: () => true },
    "@/lib/runtimeProductSettings": { getPublicDailyTestPlanEnabled: async () => dailyEnabled },
    "@/lib/stripeBilling": { getStripeConfigStatus: () => stripeConfig },
    "@/lib/supabase/server": {
      getSupabaseServerUser: async () => ({ data: { user: authenticated ? user : null } }),
      ensureUserWorkspace: async (trustedUser) => { calls.push(trustedUser); return { workspace: { id: "synthetic-workspace" } }; },
      isInternalDailyTestWorkspaceProvisioningReady: async () => workspaceProvisioningReady,
    },
  };
  function load(source) {
    const exports = {};
    runInNewContext(source, {
      exports, Date, Response,
      require(name) {
        assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency: ${name}`);
        return dependencies[name];
      },
      fetch() { throw new Error("Unexpected network access"); },
    });
    return exports;
  }
  const trusted = load(compiledTrusted);
  dependencies["@/lib/trustedWorkspaceProvisioning"] = trusted;
  const route = load(compiledRoute);
  const page = load(compiledPage);
  return { calls, user, trusted, route, page, Redirect };
}

function request(payload, origin = "https://fanmind.invalid") {
  return new Request("https://fanmind.invalid/api/register/workspace", {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function form(selection, paymentTermsVersion = revision) {
  const body = new FormData();
  for (const [name, value] of Object.entries(selection)) body.set(name, value);
  body.set("paymentTermsAccepted", "on");
  if (paymentTermsVersion !== null) body.set("paymentTermsVersion", paymentTermsVersion);
  return body;
}

function walk(node, visit) {
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  if (!node || typeof node !== "object") return;
  visit(node);
  walk(node.props?.children, visit);
}

function nodesMatching(tree, predicate) {
  const nodes = [];
  walk(tree, (node) => { if (predicate(node)) nodes.push(node); });
  return nodes;
}

function textContent(node) {
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  return node && typeof node === "object" ? textContent(node.props?.children) : "";
}

async function renderedSetup(h) {
  const originalUser = structuredClone(h.user);
  const tree = await h.page.default({ searchParams: Promise.resolve({}) });
  const forms = nodesMatching(tree, (node) => node.type === "form" && node.props.action === h.page.provisionWorkspace);
  const dailyForms = forms.filter((node) => nodesMatching(node, (field) =>
    field.type === "input" && field.props.name === "commercialOption" && field.props.value === "internal_daily_test").length === 1);
  assert.equal(dailyForms.length, 1, "Daily remains visible exactly once");
  assert.equal(h.calls.length, 0, "Rendering must not provision a workspace");
  assert.deepEqual(h.user, originalUser, "Rendering must not promote or change account metadata");
  const daily = dailyForms[0];
  const [consent] = nodesMatching(daily, (node) => node.type === "input" && node.props.name === "paymentTermsAccepted");
  const [button] = nodesMatching(daily, (node) => node.type === "button" && node.props.type === "submit");
  assert.ok(consent);
  assert.ok(button);
  assert.equal(consent.props.required, true);
  assert.notEqual(consent.props.checked, true);
  assert.notEqual(consent.props.defaultChecked, true);
  return { tree, forms, daily, consent, button };
}

for (const selection of selections) {
  test(`${selection.commercialOption}: stale or missing consent cannot reach provisioning through either entry point`, async () => {
    const h = harness();
    for (const paymentTermsVersion of [undefined, "obsolete-revision"]) {
      const response = await h.route.POST(request({ ...selection, ...accepted, paymentTermsVersion }));
      assert.equal(response.status, 409);
      assert.equal((await response.json()).code, "payment_terms_changed");
      assert.equal(response.headers.get("cache-control"), "no-store");
      await assert.rejects(h.page.provisionWorkspace(form(selection, paymentTermsVersion ?? null)),
        (error) => error instanceof h.Redirect && error.location === "/workspace/setup?error=payment_terms_changed");
    }
    assert.equal(h.calls.length, 0);
    // A persisted metadata claim cannot replace the missing submitted revision.
    assert.equal(h.trusted.buildTrustedProvisioningUser(h.user, selection, true, undefined), null);
  });

  test(`${selection.commercialOption}: current consent reaches provisioning with server-owned package and time`, async () => {
    const h = harness();
    assert.equal((await h.route.POST(request({ ...selection, ...accepted }))).status, 200);
    await assert.rejects(h.page.provisionWorkspace(form(selection)),
      (error) => error instanceof h.Redirect && error.location === "/billing/synthetic");
    assert.equal(h.calls.length, 2);
    for (const forwarded of h.calls) {
      assert.equal(forwarded.id, h.user.id);
      assert.equal(forwarded.user_metadata.plan, selection.planId);
      assert.equal(forwarded.user_metadata.commercial_option, selection.commercialOption);
      assert.equal(forwarded.user_metadata.payment_terms_version, revision);
      assert.ok(Math.abs(Date.now() - Date.parse(forwarded.user_metadata.payment_terms_accepted_at)) < 5000);
    }
    assert.equal(h.user.user_metadata.plan, "ultra");
  });
}

test("authentication, request origin and activation guards remain effective", async () => {
  const payload = { ...selections[0], ...accepted };
  const disabled = harness({ activationEnabled: false });
  assert.equal((await disabled.route.POST(request(payload))).status, 409);
  await assert.rejects(disabled.page.provisionWorkspace(form(selections[0])),
    (error) => error.location.includes(termsPolicy.PAYMENT_TERMS_ACTIVATION_BLOCK_CODE));
  assert.equal(disabled.trusted.buildTrustedProvisioningUser(disabled.user, selections[0], true, revision), null);
  const anonymous = harness({ authenticated: false });
  assert.equal((await anonymous.route.POST(request(payload))).status, 401);
  await assert.rejects(anonymous.page.provisionWorkspace(form(selections[0])),
    (error) => error.location.startsWith("/login?"));
  const foreign = harness();
  assert.equal((await foreign.route.POST(request(payload, "https://foreign.invalid"))).status, 403);
  for (const h of [disabled, anonymous, foreign]) assert.equal(h.calls.length, 0);
});

test("only the separate Daily form carries a consent revision; Capacity remains non-binding", async () => {
  const h = harness();
  const tree = await h.page.default({ searchParams: Promise.resolve({}) });
  const forms = [];
  walk(tree, (node) => { if (node.type === "form" && node.props.action === h.page.provisionWorkspace) forms.push(node); });
  assert.equal(forms.length, 1);
  for (const renderedForm of forms) {
    const fields = {};
    walk(renderedForm, (node) => { if (node.type === "input") fields[node.props.name] = node.props.value; });
    assert.equal(fields.paymentTermsVersion, revision);
  }
});

test("new registrations cannot provision legacy Starter or Capacity through either entry point", async () => {
  for (const selection of [
    { planId: "starter", commercialOption: "starter_paid_setup" },
    { planId: "starter", commercialOption: "starter_no_setup_commitment" },
    ...["capacity_99", "capacity_199", "capacity_312"].map((id) => ({ planId: id, commercialOption: id })),
  ]) {
    const h = harness();
    assert.equal(h.trusted.parseTrustedProvisioningSelection(selection), null);
    const response = await h.route.POST(request({ ...selection, ...accepted }));
    assert.equal(response.status, 400);
    await assert.rejects(h.page.provisionWorkspace(form(selection)),
      (error) => error.location === "/workspace/setup?error=payment_terms_required");
    assert.equal(h.calls.length, 0);
    const tree = await h.page.default({ searchParams: Promise.resolve({}) });
    const text = textContent(tree);
    assert.equal(nodesMatching(tree, node => node.type === "capacity-selection").length, 1);
    assert.doesNotMatch(text, /990|Starter Flex|Starter 12/u);
  }
});

test("Daily stays visible in DE and EN while each existing activation prerequisite is unavailable", async () => {
  const unavailable = [
    ["payment terms activation", { activationEnabled: false }],
    ["workspace provisioning", { workspaceProvisioningReady: false }],
    ...Object.keys(readyStripeConfig).map((key) => [key, { stripeConfig: { ...readyStripeConfig, [key]: false } }]),
  ];
  for (const locale of ["de", "en"]) {
    for (const [label, options] of unavailable) {
      const h = harness({ ...options, locale });
      const { tree, daily, consent, button } = await renderedSetup(h);
      assert.equal(textContent(button), locale === "en" ? "Daily · €0 setup + €1/day" : "Daily · 0 € Setup + 1 €/Tag", label);
      assert.equal(consent.props.disabled, true, label);
      assert.equal(button.props.disabled, true, label);
      const [status] = nodesMatching(daily, (node) => node.props.role === "status");
      assert.ok(status, label);
      assert.equal(button.props["aria-describedby"], status.props.id, label);
      assert.match(textContent(status), locale === "en" ? /Daily activation is still being prepared/u : /Die Daily-Aktivierung wird noch vorbereitet/u, label);
      assert.match(textContent(status), locale === "en" ? /No subscription or payment has started/u : /Es wurde kein Abo und keine Zahlung gestartet/u, label);
      assert.equal(nodesMatching(tree, (node) => node.type === "a" && node.props.href?.includes("demo=1")).length, options.activationEnabled === false ? 1 : 0);
    }
  }
});

test("admin-off hides Daily and preserves the unactivated Capacity packages", async () => {
  for (const locale of ["de", "en"]) {
    const h = harness({
      locale,
      dailyEnabled: false,
      userMetadata: { registration_option_preference: "internal_daily_test" },
    });
    const tree = await h.page.default({ searchParams: Promise.resolve({}) });
    const forms = nodesMatching(tree, (node) => node.type === "form" && node.props.action === h.page.provisionWorkspace);
    assert.equal(forms.length, 0);
    assert.equal(textContent(tree).includes("Daily"), false);
    assert.equal(textContent(tree).includes("vorgemerkte Auswahl"), false);
    assert.equal(textContent(tree).includes("saved selection"), false);
    assert.equal(h.calls.length, 0);
  }
});

test("ready Daily preserves explicit current consent without activating Capacity or legacy Starter", async () => {
  for (const locale of ["de", "en"]) {
    const h = harness({ locale });
    const { forms, daily, consent, button } = await renderedSetup(h);
    assert.equal(forms.length, 1);
    assert.equal(consent.props.disabled, false);
    assert.equal(button.props.disabled, false);
    assert.equal(button.props["aria-describedby"], undefined);
    assert.equal(nodesMatching(daily, (node) => node.props.role === "status").length, 0);
    const renderedSelections = forms.map((renderedForm) => {
      const fields = Object.fromEntries(nodesMatching(renderedForm, (node) => node.type === "input")
        .map((node) => [node.props.name, node.props.value]));
      assert.equal(fields.paymentTermsVersion, revision);
      const [checkbox] = nodesMatching(renderedForm, (node) => node.type === "input" && node.props.name === "paymentTermsAccepted");
      assert.equal(checkbox.props.required, true);
      assert.notEqual(checkbox.props.checked, true);
      assert.notEqual(checkbox.props.defaultChecked, true);
      assert.notEqual(checkbox.props.disabled, true);
      assert.equal(nodesMatching(renderedForm, (node) => node.type === "a" && node.props.href === (locale === "en" ? "/zahlungsbedingungen?lang=en" : "/zahlungsbedingungen")).length, 1);
      return { planId: fields.planId, commercialOption: fields.commercialOption };
    });
    assert.deepEqual(renderedSelections, selections);
  }
});

test("only the exact saved Daily option is displayed as a preference and never implies consent or activation", async () => {
  const cases = [
    [null, false],
    [{}, false],
    [{ commercial_option: "internal_daily_test", registration_plan_preference: "pilot" }, false],
    ...["starter_paid_setup", "daily", "internal_daily_test ", ["internal_daily_test"], true].map((value) => [{ registration_option_preference: value }, false]),
    [{ registration_option_preference: "internal_daily_test" }, true],
    [{ registration_option_preference: "internal_daily_test", registration_plan_preference: "starter" }, true],
  ];
  for (const locale of ["de", "en"]) {
    for (const [userMetadata, preferred] of cases) {
      const h = harness({ locale, userMetadata, workspaceProvisioningReady: false });
      const { daily, button } = await renderedSetup(h);
      assert.equal(textContent(daily).includes(locale === "en" ? "Your saved selection: Daily" : "Deine vorgemerkte Auswahl: Daily"), preferred);
      assert.equal(button.props.disabled, true);
    }
  }
});

test("setup retains anonymous, existing-workspace and deleted-demo redirects before any provisioning", async () => {
  for (const lang of [undefined, "en", ["en"]]) {
    const h = harness({ authenticated: false });
    const returnTo = lang ? "/workspace/setup?lang=en" : "/workspace/setup";
    await assert.rejects(h.page.default({ searchParams: Promise.resolve({ lang }) }),
      (error) => error instanceof h.Redirect && error.location === `/login?returnTo=${encodeURIComponent(returnTo)}`);
    assert.equal(h.calls.length, 0);
  }
  for (const [existingWorkspaceResult, destination] of [
    [{ workspace: { id: "synthetic-existing" } }, "/billing/synthetic"],
    [{ workspace: null, error: { message: "TEMPORARY_DEMO_DELETED" } }, "/login?demo_deleted=1"],
  ]) {
    const h = harness({ existingWorkspaceResult, userMetadata: { registration_option_preference: "internal_daily_test" } });
    await assert.rejects(h.page.default({ searchParams: Promise.resolve({}) }),
      (error) => error instanceof h.Redirect && error.location === destination);
    assert.equal(h.calls.length, 0);
  }
});

// Exercise the actual Checkout route after field protection is decoupled from
// historical consent: missing server evidence must still stop provider work.
test("Checkout denies an incomplete Starter without server consent before any Stripe call", async () => {
  let stripeCalls = 0;
  const user = { id: "10000000-0000-4000-8000-000000000001", user_metadata: { payment_terms_accepted: true, payment_terms_version: revision } };
  const workspace = { id: "20000000-0000-4000-8000-000000000002", owner_user_id: user.id, plan_id: "starter", commercial_option: "starter_paid_setup", billing_status: null };
  const evidence = {};
  runInNewContext(compile("src/lib/paymentTermsServerEvidence.ts"), {
    exports: evidence, Date, AbortSignal, URLSearchParams,
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://synthetic.invalid", SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-a-key" } },
    require(name) {
      if (name === "server-only") return {};
      if (name === "@/lib/paymentTermsActivationPolicy.mjs") return termsPolicy;
      if (name === "@/lib/supabase/config") return { getSupabaseApiKeyHeaders: () => ({}) };
      throw new Error(`Unexpected evidence dependency: ${name}`);
    },
    fetch: async (_url, options) => {
      assert.equal(options.method, "GET");
      return Response.json([{ ...workspace, payment_terms_version: null, payment_terms_accepted_at: null, payment_terms_accepted_by_user_id: null }]);
    },
  });
  const deps = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/demoMode": { isDemoWorkspace: () => false, isTemporaryDemoUser: () => false },
    "@/lib/adminCrmAccessPolicy.mjs": { isAdminCrmAccessWorkspace: () => false },
    "@/lib/httpMutationPolicy.mjs": { ...mutationPolicy, isTrustedMutationRequest: () => true },
    "@/lib/paymentTermsActivationPolicy.mjs": termsPolicy,
    "@/lib/paymentTermsServerEvidence": evidence,
    "@/lib/stripeBilling": {
      getStripeConfigStatus: () => ({ readyForCheckout: true }),
      resolveWorkspaceCheckoutPlan: async () => ({ planId: workspace.plan_id, commercialOption: workspace.commercial_option }),
      createStripeCheckoutSession: async () => { stripeCalls++; throw new Error("Unexpected Stripe call"); },
    },
    "@/lib/stripeBillingWriteFreeze.mjs": { isStripeBillingWriteFrozen: () => false },
    "@/lib/internalDailyTestReadinessPolicy.mjs": {},
    "@/lib/runtimeProductSettings": {},
    "@/lib/supabase/server": {
      getSupabaseServerUser: async () => ({ data: { user } }),
      getUserWorkspaceDashboard: async () => ({ workspace }),
    },
  };
  const exports = {};
  runInNewContext(compile("src/app/api/billing/checkout/route.ts"), {
    exports, Response, process: { env: {} },
    require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; },
    fetch() { throw new Error("Unexpected network access"); },
  });
  const response = await exports.POST(request({ planId: workspace.plan_id, commercialOption: workspace.commercial_option }));
  assert.equal(response.status, 409);
  assert.equal((await response.json()).code, termsPolicy.PAYMENT_TERMS_ACTIVATION_BLOCK_CODE);
  assert.equal(stripeCalls, 0);
});

test("Capacity Checkout reads the server-owned package and requires the exact sandbox Price", async () => {
  const env = {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
    NEXT_PUBLIC_SUPABASE_URL: "https://vshyhvgcmrlagvfnvomc.supabase.co",
    FANMIND_STAGING_CAPACITY_CHECKOUT_READY: "true",
    STRIPE_SECRET_KEY: "sk_test_Synthetic",
    SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-key",
    STRIPE_PRICE_CAPACITY_99: "price_Package99",
    STRIPE_PRICE_CAPACITY_199: "price_Package199",
    STRIPE_PRICE_CAPACITY_312: "price_Package312",
  };
  const { STAGING_CAPACITY_PRICE_CONTRACTS } = await import("../src/lib/stagingStripeCatalogPolicy.mjs");
  const exports = {};
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const workspaceId = "22222222-2222-4222-8222-222222222222";
  let rows = [];
  let frozen = false;
  let queries = 0;
  const deps = {
    "server-only": {},
    "@/config/aiCapacityPackages.mjs": await import("../src/config/aiCapacityPackages.mjs"),
    "@/lib/aiCapacityAdmin": {
      getAiCapacityAdminState: async () => ({
        installed: true,
        policy: {
          globalCapacityEnabled: true,
          emergencySpendFreeze: frozen,
          packageSalesEnabled: Object.fromEntries(STAGING_CAPACITY_PRICE_CONTRACTS.map(c => [c.slot, true])),
        },
      }),
    },
    "@/lib/stagingStripeCatalogPolicy.mjs": { STAGING_CAPACITY_PRICE_CONTRACTS },
    "@/lib/stripeBillingEventLedger.mjs": { isStripeBillingEventLedgerEnabled: () => true },
    "@/lib/stripeKeyPolicy.mjs": await import("../src/lib/stripeKeyPolicy.mjs"),
    "@/lib/supabase/config": { getSupabaseRestUrl: path => path, getSupabaseApiKeyHeaders: () => ({}) },
  };
  runInNewContext(compile("src/lib/stripeCapacityCheckout.ts"), {
    exports, AbortSignal, process: { env },
    require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; },
    fetch: async (path, request) => {
      queries++;
      assert.equal(path, "rpc/read_ai_capacity_checkout_contract");
      assert.deepEqual(JSON.parse(request.body), { p_workspace_id: workspaceId, p_owner_user_id: ownerId });
      return Response.json(rows);
    },
  });
  const resolve = () => exports.readCapacityCheckoutPlan(workspaceId, ownerId);
  assert.equal((await resolve()).kind, "legacy");
  for (const [packageId, priceId, cents] of [
    ["capacity_99", "price_Package99", 9900],
    ["capacity_199", "price_Package199", 19900],
    ["capacity_312", "price_Package312", 31200],
  ]) {
    rows = [{ package_id: packageId, price_id: priceId, eligible: true }];
    const { kind, plan } = await resolve();
    assert.equal(kind, "capacity");
    assert.equal(plan.planId, packageId);
    assert.equal(plan.priceIds[0], priceId);
    assert.equal(plan.monthlyFeeCents, cents);
    assert.equal(plan.setupFeeCents, 0);
    assert.equal(plan.commitmentMonths, 0);
  }
  rows = [{ package_id: "capacity_312", price_id: "price_Package199", eligible: true }];
  assert.equal((await resolve()).kind, "blocked");
  rows = [{ ...rows[0], price_id: "price_Package312", eligible: false }];
  assert.equal((await resolve()).kind, "blocked");
  rows = [{ ...rows[0], eligible: true }];
  frozen = true;
  assert.equal((await resolve()).kind, "blocked");
  const previousQueries = queries;
  env.STRIPE_SECRET_KEY = "sk_live_Synthetic";
  assert.equal((await resolve()).kind, "legacy");
  assert.equal(queries, previousQueries);
});

test("the shared Stripe session uses only the fresh Capacity contract and stable initial idempotency key", async () => {
  const catalog = await import("../src/lib/stagingStripeCatalogPolicy.mjs");
  const plan = {
    billingContract: "capacity_v2", planId: "capacity_199", commercialOption: "capacity_v2",
    mode: "subscription", priceIds: ["price_Package199"], setupFeeCents: 0,
    monthlyFeeCents: 19900, commitmentMonths: 0, paymentCollectionMethod: "card",
  };
  const workspaceId = "22222222-2222-4222-8222-222222222222";
  const userId = "11111111-1111-4111-8111-111111111111";
  const price = {
    object: "price", id: plan.priceIds[0], livemode: false, active: true,
    type: "recurring", currency: "eur", unit_amount: 19900, tax_behavior: "exclusive",
    billing_scheme: "per_unit", recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
    product: { object: "product", active: true, livemode: false },
  };
  let mapping = { kind: "capacity", plan };
  let termsReady = true;
  const created = [];
  const deps = {
    "@/lib/supabase/config": {},
    "@/lib/stripeClient": {
      createStripeIntegrationIdentifier: () => "synthetic",
      getStripeClient: () => ({
        prices: { retrieve: async id => { assert.equal(id, price.id); return price; } },
        checkout: { sessions: {
          create: async (params, options) => {
            created.push({ params: JSON.parse(JSON.stringify(params)), key: options.idempotencyKey });
            return { id: "cs_test_Example", status: "open", livemode: false, url: "https://checkout.stripe.com/c/pay/example" };
          },
        } },
      }),
    },
    "@/lib/workspaceProvisioning": {},
    "@/lib/stripeBillingWriteFreeze.mjs": { isStripeBillingWriteFrozen: () => false },
    "@/lib/internalDailyTestReadinessPolicy.mjs": {},
    "@/lib/runtimeProductSettings": {},
    "@/lib/stripeWorkspacePolicy.mjs": {},
    "@/lib/stripeTaxPolicy.mjs": { evaluateStripeTaxConfiguration: () => ({ ready: true }) },
    "@/lib/stripeCapacityCheckout": {
      readCapacityCheckoutPlan: async (workspace, user) => {
        assert.equal(workspace, workspaceId);
        assert.equal(user, userId);
        return mapping;
      },
    },
    "@/lib/paymentTermsServerEvidence": { hasCurrentWorkspacePaymentTermsEvidence: async () => termsReady },
    "@/lib/stagingStripeCatalogPolicy.mjs": catalog,
    "@/lib/stripeIntegrationIdentifierPolicy.mjs": await import("../src/lib/stripeIntegrationIdentifierPolicy.mjs"),
    "@/lib/stripeWebhookSignaturePolicy.mjs": {},
  };
  const exports = {};
  runInNewContext(compile("src/lib/stripeBilling.ts"), {
    exports, URL,
    process: { env: { STRIPE_SECRET_KEY: "sk_test_Example", STRIPE_WEBHOOK_SECRET: "whsec_Example", NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch" } },
    require(name) { assert.ok(Object.hasOwn(deps, name), name); return deps[name]; },
  });
  const start = (selection = plan, userEmail) => exports.createStripeCheckoutSession({ plan: selection, workspaceId, userId, userEmail });
  assert.equal((await start({ ...plan, priceIds: ["price_Unbound"] })).url, undefined);
  termsReady = false;
  assert.equal((await start()).url, undefined);
  termsReady = true;
  price.unit_amount = 9900;
  assert.equal((await start()).url, undefined);
  price.unit_amount = 19900;
  mapping = { kind: "blocked" };
  assert.equal((await start()).url, undefined);
  assert.equal(created.length, 0);
  mapping = { kind: "capacity", plan };
  assert.equal((await start(plan, "first@example.invalid")).id, "cs_test_Example");
  assert.equal((await start(plan, "second@example.invalid")).id, "cs_test_Example");
  assert.deepEqual(created[0], created[1]);
  const { params, key } = created[0];
  assert.equal(key, `fanmind:capacity-v2:initial:${workspaceId}`);
  assert.match(params.integration_identifier, /^fanmind_checkout_[A-Za-z]{8}$/u);
  assert.equal(params.client_reference_id, workspaceId);
  assert.deepEqual(params.line_items, [{ price: price.id, quantity: 1 }]);
  assert.equal(params.mode, "subscription");
  assert.equal(params.metadata.fanmind_capacity_package, "capacity_199");
  assert.equal(params.metadata.fanmind_billing_contract, "capacity_v2");
  assert.deepEqual(params.subscription_data.metadata, params.metadata);
});

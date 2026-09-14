import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as termsPolicy from "../src/lib/paymentTermsActivationPolicy.mjs";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";
import * as dailyReadinessPolicy from "../src/lib/internalDailyTestReadinessPolicy.mjs";

const revision = termsPolicy.CURRENT_PAYMENT_TERMS_VERSION;
const accepted = { paymentTermsAccepted: true, paymentTermsVersion: revision };
const selections = [
  { planId: "starter", commercialOption: "starter_paid_setup" },
  { planId: "starter", commercialOption: "starter_no_setup_commitment" },
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
    "@/lib/internalDailyTestReadinessPolicy.mjs": dailyReadinessPolicy,
    "@/lib/runtimeProductSettings": { getPublicDailyTestPlanEnabled: async () => true },
    "@/lib/publicDailyPlanPolicy.mjs": { PUBLIC_DAILY_PLAN_ENABLED: true },
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

test("all three rendered package forms carry the displayed revision", async () => {
  const h = harness();
  const tree = await h.page.default({ searchParams: Promise.resolve({}) });
  const forms = [];
  walk(tree, (node) => { if (node.type === "form" && node.props.action === h.page.provisionWorkspace) forms.push(node); });
  assert.equal(forms.length, 3);
  for (const renderedForm of forms) {
    const fields = {};
    walk(renderedForm, (node) => { if (node.type === "input") fields[node.props.name] = node.props.value; });
    assert.equal(fields.paymentTermsVersion, revision);
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

test("ready Daily preserves explicit current consent and both Starter choices without starting an action", async () => {
  for (const locale of ["de", "en"]) {
    const h = harness({ locale });
    const { forms, daily, consent, button } = await renderedSetup(h);
    assert.equal(forms.length, 3);
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

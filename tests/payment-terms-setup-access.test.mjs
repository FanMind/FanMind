import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Compile the actual setup page; the private action is exported only in this VM.
const source = fs.readFileSync("src/app/workspace/setup/page.tsx", "utf8");
const compiled = ts.transpileModule(source + "\nexport { provisionWorkspace };\n", {
  fileName: "src/app/workspace/setup/page.tsx",
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

function harness({ locale = "de", authenticated = true, activationEnabled = false, existingWorkspace = false } = {}) {
  const calls = { provision: 0, readiness: 0 };
  class Redirect extends Error {
    constructor(location) { super(location); this.location = location; }
  }
  const jsx = (type, props) => ({ type, props });
  const dependencies = {
    "next/link": { default: "a" },
    "next/navigation": { redirect(location) { throw new Redirect(location); } },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "../../dashboard/dashboard.module.css": { default: {} },
    "@/lib/preActivation": { getBillingContinuationHref: () => "/billing/synthetic" },
    "@/lib/workspaceLocale": { resolveWorkspaceLocale: async () => locale },
    "@/lib/workspaceAuthorization": { getUserAuthorizedWorkspaceDashboard: async () => ({ workspace: existingWorkspace ? { id: "synthetic" } : null }) },
    "@/lib/internalDailyTestReadinessPolicy.mjs": { isInternalDailyTestAdmissionReady: () => true },
    "@/lib/paymentTermsActivationPolicy.mjs": {
      isPaymentTermsActivationEnabled: () => activationEnabled,
      CURRENT_PAYMENT_TERMS_VERSION: "synthetic-revision",
      PAYMENT_TERMS_ACTIVATION_BLOCK_CODE: "payment_terms_version_unresolved",
      evaluatePaymentTermsSubmission: () => { throw new Error("Unexpected consent evaluation"); },
    },
    "@/lib/runtimeProductSettings": { getPublicDailyTestPlanEnabled: async () => true },
    "@/lib/publicDailyPlanPolicy.mjs": { PUBLIC_DAILY_PLAN_ENABLED: true },
    "@/lib/stripeBilling": { getStripeConfigStatus: () => { calls.readiness++; return {}; } },
    "@/lib/trustedWorkspaceProvisioning": {
      buildTrustedProvisioningUser: () => { throw new Error("Unexpected provisioning authority"); },
      parseTrustedProvisioningSelection: () => { throw new Error("Unexpected selection submission"); },
    },
    "@/lib/supabase/server": {
      getSupabaseServerUser: async () => ({ data: { user: authenticated ? { id: "synthetic" } : null } }),
      ensureUserWorkspace: async () => { calls.provision++; throw new Error("Unexpected database write"); },
      isInternalDailyTestWorkspaceProvisioningReady: async () => { calls.readiness++; return true; },
    },
  };
  const exports = {};
  runInNewContext(compiled, {
    exports,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected import: ${name}`);
      return dependencies[name];
    },
    fetch() { throw new Error("Unexpected network request"); },
  });
  return { page: exports, calls, Redirect };
}

function nodes(tree) {
  const result = [];
  function walk(node) {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    result.push(node);
    walk(node.props?.children);
  }
  walk(tree);
  return result;
}

for (const locale of ["de", "en"]) {
  test(`${locale}: blocked activation still exposes the terms without granting consent or a paid workspace`, async () => {
    const h = harness({ locale });
    const tree = await h.page.default({ searchParams: Promise.resolve({ lang: locale }) });
    const all = nodes(tree);
    const terms = all.filter((node) => node.type === "a" && node.props.href?.startsWith("/zahlungsbedingungen"));
    assert.equal(terms.length, 1);
    assert.equal(terms[0].props.href, locale === "en" ? "/zahlungsbedingungen?lang=en" : "/zahlungsbedingungen");
    assert.equal(terms[0].props.target, "_blank");
    assert.match(terms[0].props.rel, /noopener/);
    assert.equal(all.filter((node) => node.type === "form" && node.props.action === h.page.provisionWorkspace).length, 0);
    assert.equal(all.filter((node) => node.type === "input" && node.props.name === "paymentTermsAccepted").length, 0);
    const status = all.find((node) => node.props.role === "status");
    assert.ok(status);
    assert.match(status.props.children, locale === "en" ? /not enabled yet/ : /noch nicht freigeschaltet/);
    assert.deepEqual(h.calls, { provision: 0, readiness: 0 });
  });
}

test("a forged submission remains blocked before provisioning even when the document is accessible", async () => {
  const h = harness();
  const form = new FormData();
  form.set("paymentTermsAccepted", "on");
  form.set("paymentTermsVersion", "synthetic-revision");
  form.set("planId", "starter");
  form.set("commercialOption", "starter_paid_setup");
  await assert.rejects(h.page.provisionWorkspace(form), (error) =>
    error instanceof h.Redirect && error.location === "/workspace/setup?error=payment_terms_version_unresolved");
  assert.deepEqual(h.calls, { provision: 0, readiness: 0 });
});

test("enabled activation retains all three explicit versioned package forms", async () => {
  const h = harness({ activationEnabled: true });
  const all = nodes(await h.page.default({ searchParams: Promise.resolve({}) }));
  const forms = all.filter((node) => node.type === "form" && node.props.action === h.page.provisionWorkspace);
  assert.equal(forms.length, 3);
  for (const form of forms) {
    const fields = nodes(form).filter((node) => node.type === "input");
    assert.equal(fields.find((node) => node.props.name === "paymentTermsVersion")?.props.value, "synthetic-revision");
    assert.equal(fields.find((node) => node.props.name === "paymentTermsAccepted")?.props.required, true);
  }
  assert.equal(all.filter((node) => node.props.role === "status").length, 0);
  assert.equal(h.calls.provision, 0);
});

for (const locale of ["de", "en"]) {
  test(`${locale}: setup remains authenticated`, async () => {
    const h = harness({ locale, authenticated: false });
    const returnTo = locale === "en" ? "/workspace/setup?lang=en" : "/workspace/setup";
    await assert.rejects(h.page.default({ searchParams: Promise.resolve({ lang: locale }) }),
      (error) => error instanceof h.Redirect && error.location === `/login?returnTo=${encodeURIComponent(returnTo)}`);
    assert.deepEqual(h.calls, { provision: 0, readiness: 0 });
  });
}

test("existing workspace continuation is preserved", async () => {
  const h = harness({ existingWorkspace: true });
  await assert.rejects(h.page.default({ searchParams: Promise.resolve({}) }),
    (error) => error instanceof h.Redirect && error.location === "/billing/synthetic");
  assert.deepEqual(h.calls, { provision: 0, readiness: 0 });
});

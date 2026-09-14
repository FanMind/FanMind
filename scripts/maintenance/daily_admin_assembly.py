"""One-use source transport; never touches main, runtime, providers or SQL.
The resulting tree excludes this helper and its hosted-only workflow. Native
PR review/CI/merge remains mandatory. All replacements require exact matches.
"""
import json, os, re, subprocess, urllib.request
from pathlib import Path

BASE = '1e011edd422d3cc7165ac3a4be221af8b8c57f56'
REPO = 'FanMind/FanMind'
BRANCH = 'fix/daily-admin-visibility-20260914'
assert os.environ.get('GITHUB_REPOSITORY') == REPO
assert os.environ.get('GITHUB_REF') == 'refs/heads/' + BRANCH
assert subprocess.check_output(['git', 'merge-base', BASE, 'HEAD'], text=True).strip() == BASE
changed = set()
def read(p): return Path(p).read_text()
def write(p, value):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    Path(p).write_text(value)
    changed.add(p)
def replace(p, old, new, count=1):
    value = read(p)
    assert value.count(old) == count, f'Unexpected source shape: {p}: {old[:70]}'
    write(p, value.replace(old, new))
def prefix(p, value): write(p, value + read(p))

write('src/lib/dailyPlanSettings.mjs', '''import { randomUUID } from "node:crypto";
import { lstat, open, rename, unlink } from "node:fs/promises";

const MAX_BYTES = 8192;

async function readPayload(file) {
  try {
    const stat = await lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BYTES) throw new Error("daily_settings_invalid");
    const handle = await open(file, "r");
    try {
      const opened = await handle.stat();
      if (!opened.isFile() || opened.ino !== stat.ino || opened.dev !== stat.dev || opened.size > MAX_BYTES) throw new Error("daily_settings_invalid");
      const buffer = Buffer.alloc(MAX_BYTES + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > MAX_BYTES) throw new Error("daily_settings_invalid");
      const value = JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("daily_settings_invalid");
      if (Object.hasOwn(value, "publicDailyPlanEnabled") && typeof value.publicDailyPlanEnabled !== "boolean") throw new Error("daily_settings_invalid");
      return { value, missing: false };
    } finally { await handle.close(); }
  } catch (error) {
    if (error?.code === "ENOENT") return { value: {}, missing: true };
    throw new Error("daily_settings_unavailable");
  }
}

export async function readDailyPlanSettings(file) {
  try {
    const { value } = await readPayload(file);
    // Preserve the already published catalog until the owner explicitly sets
    // this new switch. The historical 24-hour beta window is not this switch.
    if (!Object.hasOwn(value, "publicDailyPlanEnabled")) return { enabled: true, available: true, source: "default" };
    return { enabled: value.publicDailyPlanEnabled, available: true, source: "saved" };
  } catch {
    return { enabled: false, available: false, source: "unavailable" };
  }
}

export async function writeDailyPlanSettings(file, enabled, updatedBy) {
  if (typeof enabled !== "boolean" || typeof updatedBy !== "string" || !updatedBy.trim() || updatedBy.length > 254) throw new Error("daily_settings_invalid");
  const { value } = await readPayload(file);
  const payload = { ...value, publicDailyPlanEnabled: enabled, updatedAt: new Date().toISOString(), updatedBy };
  const text = JSON.stringify(payload) + "\\n";
  if (Buffer.byteLength(text) > MAX_BYTES) throw new Error("daily_settings_invalid");
  const temporary = `${file}.${randomUUID()}.tmp`;
  let handle;
  try {
    handle = await open(temporary, "wx", 0o600);
    await handle.writeFile(text, "utf8");
    await handle.sync();
    await handle.close();
    handle = undefined;
    await rename(temporary, file);
  } catch {
    throw new Error("daily_settings_write_failed");
  } finally {
    if (handle) await handle.close().catch(() => undefined);
    await unlink(temporary).catch(() => undefined);
  }
}
''')
write('src/lib/dailyPlanSettings.d.mts', '''export type DailyPlanSettingsState = { enabled: boolean; available: boolean; source: "default" | "saved" | "unavailable" };
export function readDailyPlanSettings(file: string): Promise<DailyPlanSettingsState>;
export function writeDailyPlanSettings(file: string, enabled: boolean, updatedBy: string): Promise<void>;
''')
write('src/lib/runtimeProductSettings.ts', '''import "server-only";
import path from "node:path";
import { readDailyPlanSettings, writeDailyPlanSettings } from "@/lib/dailyPlanSettings.mjs";

function getSettingsPath(): string {
  const configured = process.env.FANMIND_RUNTIME_SETTINGS_FILE?.trim();
  if (configured) return configured;
  return process.env.NODE_ENV === "production"
    ? "/var/www/fanmind/.fanmind-runtime-settings.json"
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".fanmind-runtime-settings.json");
}

// No process cache: every worker and every new request observes the same
// atomic, deployment-persistent admin setting. Only the boolean is public.
export async function getPublicDailyPlanState() {
  return readDailyPlanSettings(/* turbopackIgnore: true */ getSettingsPath());
}

// Compatibility names retained for existing call sites; no 24-hour expiry.
export async function getPublicDailyTestPlanEnabled(): Promise<boolean> {
  return (await getPublicDailyPlanState()).enabled;
}

export async function setPublicDailyTestPlanEnabled(enabled: boolean, updatedBy: string): Promise<void> {
  await writeDailyPlanSettings(/* turbopackIgnore: true */ getSettingsPath(), enabled, updatedBy);
}
''')
write('src/app/api/admin/settings/daily-test-plan/route.ts', '''import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/admin";
import { isTrustedFanMindMutationRequest, readBoundedFormDataRequest } from "@/lib/httpMutationPolicy.mjs";
import { setPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";

const MAX_DAILY_TEST_PLAN_BODY_BYTES = 1_000;

export async function POST(request: NextRequest) {
  if (!isTrustedFanMindMutationRequest(request)) return NextResponse.json({ error: "origin_forbidden" }, { status: 403 });
  const admin = await requirePlatformAdmin();
  const parsed = await readBoundedFormDataRequest(request, MAX_DAILY_TEST_PLAN_BODY_BYTES);
  if (!parsed.ok) return NextResponse.json({ error: parsed.reason === "payload_too_large" ? "payload_too_large" : "invalid_request" }, { status: parsed.reason === "payload_too_large" ? 413 : 400 });
  const values = parsed.value.getAll("enabled");
  if (values.length !== 1 || !["true", "false"].includes(String(values[0]))) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const enabled = values[0] === "true";
  try {
    // Catalog control only. Enabling visibility never bypasses the separate
    // consent, provisioning, Tax, Stripe and Billing readiness checks.
    await setPublicDailyTestPlanEnabled(enabled, admin.id);
  } catch {
    return NextResponse.json({ error: "daily_settings_write_failed" }, { status: 503 });
  }
  revalidatePath("/", "layout");
  const destination = new URL("/admin/settings", request.url);
  destination.searchParams.set("daily_test_plan", enabled ? "enabled" : "disabled");
  return NextResponse.redirect(destination, { status: 303 });
}
''')
write('src/app/admin/settings/page.tsx', '''import { requirePlatformAdmin } from "@/lib/admin";
import { getPublicDailyPlanState } from "@/lib/runtimeProductSettings";
import { isPaymentTermsActivationEnabled } from "@/lib/paymentTermsActivationPolicy.mjs";
import { isInternalDailyTestWorkspaceProvisioningReady } from "@/lib/supabase/server";
import { getStripeConfigStatus } from "@/lib/stripeBilling";
import { isInternalDailyTestStripeReady } from "@/lib/internalDailyTestReadinessPolicy.mjs";
import { AdminBillingShell } from "@/app/admin/billing/AdminBillingShell";
import { AdminTabs } from "@/app/admin/billing/AdminTabs";
import styles from "@/app/admin/billing/adminBilling.module.css";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({ searchParams }: { searchParams: Promise<{ daily_test_plan?: string | string[] }> }) {
  const user = await requirePlatformAdmin();
  const [visibility, provisioningReady] = await Promise.all([getPublicDailyPlanState(), isInternalDailyTestWorkspaceProvisioningReady()]);
  const termsReady = isPaymentTermsActivationEnabled();
  const stripeReady = isInternalDailyTestStripeReady(getStripeConfigStatus());
  const activationReady = termsReady && provisioningReady && stripeReady;
  const params = await searchParams;
  const result = Array.isArray(params.daily_test_plan) ? params.daily_test_plan[0] : params.daily_test_plan;
  return <AdminBillingShell user={user} title="Produktfreigaben" subtitle="Tarife auf der gesamten Website ein- und ausschalten">
    <main className={styles.adminStack}>
      <AdminTabs activeTab="settings" />
      {["enabled", "disabled"].includes(result ?? "") && <p role="status" className={styles.badgeOk}>Einstellung gespeichert. Der aktuelle Zustand steht beim Schalter.</p>}
      {!visibility.available && <p role="alert" className={styles.badgeWarn}>Die Einstellung kann gerade nicht gelesen werden. Das Angebot bleibt vorsichtshalber ausgeblendet.</p>}
      <section className={styles.card}>
        <div className={styles.cardHeader}>
          <div><span className={styles.eyebrow}>Öffentlicher Tagestarif</span><h2>Daily · 0 € Setup + 1 €/Tag</h2><p className={styles.cardSubtitle}>Ein Schalter für Landingpage, Registrierung, Paketwahl und neue Buchungen. Die Einstellung bleibt bis zur nächsten Änderung gespeichert, ohne 24-Stunden-Ablauf.</p></div>
          <span className={visibility.enabled ? styles.badgeOk : styles.badgeWarn}>{visibility.enabled ? "Angebot sichtbar" : "Angebot ausgeblendet"}</span>
        </div>
        <form method="post" action="/api/admin/settings/daily-test-plan">
          <input type="hidden" name="enabled" value={String(!visibility.enabled)} />
          <button type="submit" role="switch" aria-checked={visibility.enabled} aria-label="Daily-Angebot auf der Website" disabled={!visibility.available}>
            {visibility.enabled ? "Daily ausschalten" : "Daily einschalten"}
          </button>
        </form>
        <p className={styles.muted}>Ausblenden beendet keine bestehenden Abos. Bereits freigeschaltete Tester behalten ihren Zugang; Vertragsdaten, Rechnungen und Kündigung bleiben erreichbar.</p>
        <div className={styles.statusList}>
          <div className={styles.statusItem}><span>Preis</span><strong>1 € pro Tag · 0 € Setup</strong></div>
          <div className={styles.statusItem}><span>Kündigung</span><strong>Täglich möglich · kein Referral-Rabatt</strong></div>
          <div className={styles.statusItem}><span>Workspace-Erstellung</span><strong>{provisioningReady ? "Bereit" : "Rollout ausstehend"}</strong></div>
          <div className={styles.statusItem}><span>Stripe &amp; Webhook</span><strong>{stripeReady ? "Bereit" : "Konfiguration unvollständig"}</strong></div>
          <div className={styles.statusItem}><span>Zahlungsbedingungen</span><strong>{termsReady ? "Freigegeben" : "Vertragsversion offen"}</strong></div>
        </div>
        <p className={activationReady ? styles.badgeOk : styles.badgeWarn}>{activationReady ? "Technische Vorprüfung bereit; echte Zahlung und Freischaltung separat testen." : "Die Sichtbarkeit ist schaltbar. Die kostenpflichtige Aktivierung wartet noch auf die oben genannten Voraussetzungen."}</p>
      </section>
    </main>
  </AdminBillingShell>;
}
''')

# Remove the static override from every existing server admission boundary.
for p in ['src/app/workspace/setup/page.tsx', 'src/app/api/billing/checkout/route.ts', 'src/lib/supabase/server.ts']:
    replace(p, 'import { PUBLIC_DAILY_PLAN_ENABLED } from "@/lib/publicDailyPlanPolicy.mjs";\n', '')
    value = read(p)
    if 'PUBLIC_DAILY_PLAN_ENABLED || await getPublicDailyTestPlanEnabled()' in value:
        replace(p, 'PUBLIC_DAILY_PLAN_ENABLED || await getPublicDailyTestPlanEnabled()', 'await getPublicDailyTestPlanEnabled()')
    else:
        replace(p, '!PUBLIC_DAILY_PLAN_ENABLED && !(await getPublicDailyTestPlanEnabled())', '!(await getPublicDailyTestPlanEnabled())')

replace('src/app/register/page.tsx', 'import { PUBLIC_DAILY_PLAN_ENABLED } from "@/lib/publicDailyPlanPolicy.mjs";', 'import { isPublicDailyRegistrationRequest } from "@/lib/publicDailyPlanPolicy.mjs";\nimport { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";')
replace('src/app/register/page.tsx', 'const enablePublicDailyTestPlan = PUBLIC_DAILY_PLAN_ENABLED;', '''const enablePublicDailyTestPlan = await getPublicDailyTestPlanEnabled();
  const first = (value?: string | string[]) => Array.isArray(value) ? value[0] : value;
  if (!enablePublicDailyTestPlan && isPublicDailyRegistrationRequest({ planId: first(params.plan), testPlan: first(params.test_plan) })) {
    const english = first(params.lang) === "en";
    return <main><h1>{english ? "This offer is currently unavailable" : "Dieses Angebot ist derzeit nicht verfügbar"}</h1><p>{english ? "No different package has been selected for you." : "Es wurde kein anderes Paket für dich ausgewählt."}</p><a href={english ? "/register?lang=en" : "/register"}>{english ? "Show available packages" : "Verfügbare Pakete anzeigen"}</a><p><a href={english ? "/login?lang=en" : "/login"}>{english ? "Sign in to your existing account" : "Mit bestehendem Konto anmelden"}</a></p></main>;
  }''')

prefix('src/app/landing-v2/page.tsx', 'import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";\n\nexport const dynamic = "force-dynamic";\n')
replace('src/app/landing-v2/page.tsx', 'const localizedPricingPlans = localizeFanMindValue(pricingPlans, t)', 'const dailyVisible = await getPublicDailyTestPlanEnabled();\n  const localizedPricingPlans = localizeFanMindValue(pricingPlans.filter(plan => dailyVisible || plan.name !== "Daily"), t)')
prefix('src/app/page.tsx', 'export const dynamic = "force-dynamic";\n')

# Re-check the flag in every web checkout entry; existing active accounts route
# to their dashboard before these new-admission checks, and webhooks are untouched.
p = 'src/app/billing/checkout/route.ts'
prefix(p, 'import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";\n')
replace(p, '  const plan = resolveCheckoutPlan(workspace.plan_id, workspace.commercial_option);', '  if (workspace.commercial_option === "internal_daily_test" && !(await getPublicDailyTestPlanEnabled())) return redirectTo("/billing/start?error=offer_unavailable");\n\n  const plan = resolveCheckoutPlan(workspace.plan_id, workspace.commercial_option);')
p = 'src/app/billing/start/page.tsx'
prefix(p, 'import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";\n')
replace(p, '  const canStartCheckout = Boolean(', '  const dailyOfferAvailable = workspace?.commercial_option !== "internal_daily_test" || await getPublicDailyTestPlanEnabled();\n  const canStartCheckout = Boolean(')
replace(p, '      !checkoutFrozen &&', '      dailyOfferAvailable &&\n      !checkoutFrozen &&')
replace(p, '{checkoutFrozen ? (', '{!dailyOfferAvailable ? (\n              <div className={styles.infoBox}>Dieses Angebot ist für neue Buchungen derzeit nicht verfügbar. Bestehende Verträge bleiben unverändert.</div>\n            ) : checkoutFrozen ? (')

# Keep legal terms available to an existing authorized Daily customer while
# removing Daily from the public marketing/terms catalog when the switch is off.
write('src/lib/dailyTermsVisibility.ts', '''import "server-only";
import { getPublicDailyTestPlanEnabled } from "@/lib/runtimeProductSettings";
import { getSupabaseServerUser } from "@/lib/supabase/server";
import { getUserAuthorizedWorkspaceDashboard } from "@/lib/workspaceAuthorization";

export async function showDailyTerms(): Promise<boolean> {
  if (await getPublicDailyTestPlanEnabled()) return true;
  try {
    const { data } = await getSupabaseServerUser();
    if (!data.user) return false;
    const result = await getUserAuthorizedWorkspaceDashboard(data.user);
    return result.workspace?.commercial_option === "internal_daily_test";
  } catch { return false; }
}
''')
p = 'src/app/zahlungsbedingungen/page.tsx'
prefix(p, 'import { showDailyTerms } from "@/lib/dailyTermsVisibility";\nexport const dynamic = "force-dynamic";\n')
replace(p, 'const sections: PaymentSection[] = [', 'const getSections = (showDaily: boolean): PaymentSection[] => [')
replace(p, 'Dies gilt für Starter Flex, Starter 12 Monate und Daily.', '{showDaily ? "Dies gilt für Starter Flex, Starter 12 Monate und Daily." : "Dies gilt für die hier aufgeführten Pakete."}')
replace(p, 'export default function ZahlungsbedingungenPage() {', 'export default async function ZahlungsbedingungenPage() {\n  const showDaily = await showDailyTerms();\n  const sections = getSections(showDaily).map((section, index) => ({ ...section, originalIndex: index })).filter(section => showDaily || section.title !== "Daily");')
replace(p, '"Drei Zahlungsmodelle",', '"Veröffentlichte Zahlungsmodelle",')
replace(p, 'Stand: 10. September 2026 · Drei Zahlungsmodelle', 'Stand: 10. September 2026')
replace(p, '{packageCards.map((card)', '{packageCards.filter(card => showDaily || card.title !== "Daily").map((card)')
replace(p, '{sections.map((section, index) => (', '{sections.map((section) => (')
replace(p, 'id={sectionId(index)}', 'id={sectionId(section.originalIndex)}')
replace(p, '{index + 1}</div>', '{section.originalIndex + 1}</div>')
p = 'src/app/agb/page.tsx'
prefix(p, 'import { showDailyTerms } from "@/lib/dailyTermsVisibility";\nexport const dynamic = "force-dynamic";\n')
replace(p, 'const sections: TermsSection[] = [', 'const getSections = (showDaily: boolean): TermsSection[] => [')
value = read(p)
value, n = re.subn(r'(<li><strong>Daily:</strong>[^\n]*</li>)', r'{showDaily && \1}', value)
assert n == 1, 'AGB Daily clause shape'
value, n = re.subn(r'export default function (\w+)\(\) \{', r'export default async function \1() {\n  const sections = getSections(await showDailyTerms());', value)
assert n == 1, 'AGB page shape'
write(p, value)

# Update obsolete source-shape assertions, retaining behavioral/security tests.
p = 'scripts/verify-product-truth.mjs'
replace(p, '  "PUBLIC_DAILY_PLAN_ENABLED",', '  "getPublicDailyTestPlanEnabled",')
p = 'tests/customer-billing-policy.test.mjs'
value = read(p).replace('enablePublicDailyTestPlan = PUBLIC_DAILY_PLAN_ENABLED', 'enablePublicDailyTestPlan = await getPublicDailyTestPlanEnabled\\(\\)')
# The former admin control activated a time-limited beta; the new route controls
# catalog visibility only. Dedicated executable tests below enforce its boundary.
value, n = re.subn(r'  assert\.match\(\s*adminRouteSource,\s*/enabled &&.*?\);', '  assert.match(adminRouteSource, /setPublicDailyTestPlanEnabled/);', value, flags=re.S)
assert n == 1, 'old beta activation source assertion'
write(p, value)

write('tests/daily-admin-visibility.test.mjs', '''import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, writeFile, readFile, stat, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { readDailyPlanSettings, writeDailyPlanSettings } from "../src/lib/dailyPlanSettings.mjs";
import * as mutationPolicy from "../src/lib/httpMutationPolicy.mjs";

async function fixture(fn) {
  const dir = await mkdtemp(path.join(tmpdir(), "fanmind-daily-setting-"));
  try { await fn(path.join(dir, "settings.json"), dir); } finally { await rm(dir, { recursive: true, force: true }); }
}
test("admin setting persists on/off across independent processes with private atomic storage", async () => fixture(async file => {
  assert.equal((await readDailyPlanSettings(file)).enabled, true);
  for (const enabled of [false, true, false]) {
    await writeDailyPlanSettings(file, enabled, "synthetic-admin");
    const state = await readDailyPlanSettings(file);
    assert.equal(state.enabled, enabled);
    assert.equal(state.source, "saved");
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    const module = new URL("../src/lib/dailyPlanSettings.mjs", import.meta.url).href;
    const output = execFileSync(process.execPath, ["--input-type=module", "-e", `import {readDailyPlanSettings} from ${JSON.stringify(module)}; console.log((await readDailyPlanSettings(${JSON.stringify(file)})).enabled)`], { encoding: "utf8" });
    assert.equal(output.trim(), String(enabled));
  }
}));
test("saved Daily visibility has no beta timer and survives more than fourteen days", async () => fixture(async file => {
  await writeFile(file, JSON.stringify({ publicDailyPlanEnabled: true, updatedAt: "2000-01-01T00:00:00Z", publicDailyTestPlanEnabledUntil: "2000-01-02T00:00:00Z" }));
  assert.equal((await readDailyPlanSettings(file)).enabled, true);
  await writeDailyPlanSettings(file, false, "synthetic-admin");
  assert.equal((await readDailyPlanSettings(file)).enabled, false);
  assert.equal(JSON.parse(await readFile(file, "utf8")).publicDailyTestPlanEnabledUntil, "2000-01-02T00:00:00Z");
}));
test("corrupt or wrongly typed settings fail closed and are not overwritten", async () => fixture(async file => {
  for (const body of ["broken", "null", "[]", '{"publicDailyPlanEnabled":"true"}', " ".repeat(9000)]) {
    await writeFile(file, body);
    assert.equal((await readDailyPlanSettings(file)).available, false);
    assert.equal((await readDailyPlanSettings(file)).enabled, false);
    await assert.rejects(writeDailyPlanSettings(file, true, "synthetic-admin"));
    assert.equal(await readFile(file, "utf8"), body);
  }
}));
test("settings links and invalid boolean writes are rejected", async () => fixture(async (file, dir) => {
  const target = path.join(dir, "target.json");
  await writeFile(target, '{"publicDailyPlanEnabled":true}');
  await symlink(target, file);
  assert.equal((await readDailyPlanSettings(file)).available, false);
  await assert.rejects(writeDailyPlanSettings(file, false, "synthetic-admin"));
  for (const value of ["false", 0, null, undefined]) await assert.rejects(writeDailyPlanSettings(target, value, "synthetic-admin"));
}));

const routeSource = ts.transpileModule(readFileSync("src/app/api/admin/settings/daily-test-plan/route.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function handler({ admin = true, trusted = true, failWrite = false } = {}) {
  const calls = []; const invalidations = []; const exports = {};
  const deps = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init), redirect: (url, init) => new Response(null, { status: init.status, headers: { location: String(url) } }) } },
    "next/cache": { revalidatePath: (...args) => invalidations.push(args) },
    "@/lib/admin": { requirePlatformAdmin: async () => { if (!admin) throw new Error("forbidden"); return { id: "synthetic-admin" }; } },
    "@/lib/httpMutationPolicy.mjs": { ...mutationPolicy, isTrustedFanMindMutationRequest: () => trusted },
    "@/lib/runtimeProductSettings": { setPublicDailyTestPlanEnabled: async (...args) => { if (failWrite) throw new Error("private-internal-detail"); calls.push(args); } },
  };
  runInNewContext(routeSource, { exports, URL, Response, require: name => { assert.ok(name in deps, name); return deps[name]; } });
  return { post: exports.POST, calls, invalidations };
}
function request(values) {
  const body = new URLSearchParams();
  for (const value of values) body.append("enabled", value);
  return new Request("https://fanmind.invalid/api/admin/settings/daily-test-plan", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: "https://fanmind.invalid" }, body });
}
test("admin can persist either catalog state and invalidates the whole public layout", async () => {
  for (const enabled of ["true", "false"]) {
    const h = handler(); const result = await h.post(request([enabled]));
    assert.equal(result.status, 303);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0][0], enabled === "true");
    assert.equal(h.calls[0][1], "synthetic-admin");
    assert.equal(h.invalidations[0][0], "/");
    assert.equal(h.invalidations[0][1], "layout");
  }
});
test("non-admin, foreign origin, malformed or duplicated values never write settings", async () => {
  const unauthorized = handler({ admin: false }); await assert.rejects(unauthorized.post(request(["false"]))); assert.equal(unauthorized.calls.length, 0);
  const foreign = handler({ trusted: false }); assert.equal((await foreign.post(request(["true"]))).status, 403); assert.equal(foreign.calls.length, 0);
  for (const values of [[], ["on"], ["1"], ["TRUE"], ["true", "false"], ["false", "false"]]) {
    const h = handler(); assert.equal((await h.post(request(values))).status, 400); assert.equal(h.calls.length, 0);
  }
});
test("failed persistence has a fixed error and cannot announce success", async () => {
  const h = handler({ failWrite: true }); const result = await h.post(request(["false"]));
  assert.equal(result.status, 503); assert.equal((await result.json()).error, "daily_settings_write_failed"); assert.equal(h.invalidations.length, 0);
});
test("runtime gate is wired to all public admission and web checkout boundaries", () => {
  for (const file of ["src/app/landing-v2/page.tsx", "src/app/register/page.tsx", "src/app/workspace/setup/page.tsx", "src/app/api/billing/checkout/route.ts", "src/app/billing/checkout/route.ts", "src/app/billing/start/page.tsx", "src/lib/supabase/server.ts"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /await getPublicDailyTestPlanEnabled\\(\\)/u, file);
    assert.doesNotMatch(source, /PUBLIC_DAILY_PLAN_ENABLED/u, file);
  }
});
''')

# Canonical reconciliation: visibility only, not a new price/consent/contract.
notice = '''\n## Daily admin visibility — 14 September 2026\n\nThe owner now controls Daily visibility in `/admin/settings`. This supersedes only\nthe unconditional catalog visibility of FM-DEC-014: the existing EUR 0 setup +\nEUR 1/day offer stays in the catalog, but can be hidden on all public pages.\nThe server-only deployment-persistent setting has no 24-hour expiry. Off removes\nLanding, registration, public legal catalog and new-package presentation and\nblocks new web admission/checkout attempts; stale direct registration links do\nnot silently select a monthly package. Existing authorized Daily customers\nretain their contract text, account, invoices, cancellation and subscription.\nA catalog toggle never changes an existing Stripe object, expires an already\nissued Stripe session, grants a Workspace or bypasses consent/Tax/RLS/Billing.\nPaid Daily Production provisioning and actual payment/activation acceptance\nremain separately open under FM-BILL-003; the intended test cohort is not\ncreated or accepted by this source change. Missing legacy settings preserve the\npreviously public catalog until an explicit admin choice; corrupt/read-failed\nsettings fail closed. The stored explicit off survives normal release changes.\n'''
for p in ['docs/SOURCE_OF_TRUTH.md', 'README.md', 'docs/operations/WEB_REGISTRATION.md']:
    write(p, read(p).rstrip() + '\n' + notice)
p = 'project-memory/DRIFT_BASELINE.json'
value = json.loads(read(p))
blob = subprocess.check_output(['git', 'hash-object', 'docs/SOURCE_OF_TRUTH.md'], text=True).strip()
value['watched_files']['docs/SOURCE_OF_TRUTH.md'] = blob
value['last_source_of_truth_review'] += ' 2026-09-14 FM-BILL-003: owner-requested persistent Daily catalog visibility; existing subscriptions/contract and all paid-activation gates preserved. No SQL/provider/price or accepted-gate change.'
write(p, json.dumps(value, indent=2, ensure_ascii=False) + '\n')
for p, text in {
 'project-memory/STARTED_WORK.md': '## Daily admin visibility — 2026-09-14\n- Task FM-BILL-003; IN_PROGRESS; Risk R3 source / R4 normal publication.\n- Lock LOCK-FM-DAILY-ADMIN-20260914, holder ChatGPT.\n- Completed so far: existing runtime/admin surfaces inventoried; bounded persistent switch and public/server consumers implemented.\n- Still open: exact-head tests/review, normal publication and owner on/off acceptance; paid Daily SQL/checkout acceptance remains separate.\n- Next: complete current PR verification and publish, then retain actual admin/browser result.\n- Owner action: website acceptance after verified release, no repeated publication permission.\n\n',
 'project-memory/WORK_LOCKS.md': '## LOCK-FM-DAILY-ADMIN-20260914\n- Task FM-BILL-003; holder ChatGPT; ACTIVE; Risk R3/R4 publication.\n- Scope: owner-requested persistent Daily visibility in admin, public views and new-admission boundaries. No SQL, Stripe mutation or existing-subscription change.\n- Evidence: runtime storage/authorization/negative tests, desktop/mobile browser CI, reviewed exact release and owner UI acceptance.\n- Recovery: bounded app revert preserving settings, accounts, consent and Stripe.\n\n',
 'project-memory/OPEN_LOOPS.md': '## Daily admin visibility — 2026-09-14\n- FM-BILL-003 resumed explicitly for Daily test access and admin on/off control.\n- Catalog control is implemented separately from still-open Production provisioning/paid activation. Do not reopen the deployed #1124 callback.\n- Off must not suspend existing testers or mutate subscriptions; no 24-hour setting expiry.\n- Current branch fix/daily-admin-visibility-20260914; tests/review/deploy/owner acceptance pending.\n\n'
}.items(): prefix(p, text)

# Fail if any tracked runtime admission still has the static override.
for p in Path('src').rglob('*'):
    if p.suffix in ['.ts', '.tsx'] and 'PUBLIC_DAILY_PLAN_ENABLED' in p.read_text():
        assert p.name == 'publicDailyPlanPolicy.d.mts', f'Unexpected static Daily authority: {p}'

# Syntax/tests run using repository-pinned dependencies; no provider calls.
subprocess.run(['node', '--test', 'tests/daily-admin-visibility.test.mjs'], check=True)
subprocess.run(['git', 'diff', '--check'], check=True)

# Create unreferenced Git objects only. Native connector review/commit/ref/PR
# operations remain separate; this job cannot select or update a destination ref.
def api(endpoint, payload):
    req = urllib.request.Request('https://api.github.com/repos/' + REPO + '/git/' + endpoint,
      data=json.dumps(payload).encode(), method='POST', headers={
      'Authorization': 'Bearer ' + os.environ['GH_TOKEN'], 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response: return json.load(response)
entries = []
for p in sorted(changed):
    sha = api('blobs', {'content': read(p), 'encoding': 'utf-8'})['sha']
    entries.append({'path': p, 'mode': '100644', 'type': 'blob', 'sha': sha})
for p in ['scripts/maintenance/daily_admin_assembly.py', '.github/workflows/daily-admin-assembly.yml']:
    entries.append({'path': p, 'mode': '100644', 'type': 'blob', 'sha': None})
base_tree = subprocess.check_output(['git', 'rev-parse', 'HEAD^{tree}'], text=True).strip()
result = api('trees', {'base_tree': base_tree, 'tree': entries})
print('ASSEMBLED_DAILY_TREE=' + result['sha'])
print('ASSEMBLED_PARENT=' + subprocess.check_output(['git', 'rev-parse', 'HEAD'], text=True).strip())
print('ASSEMBLED_FILES=' + str(len(changed)))

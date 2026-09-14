import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import crypto from "node:crypto";
import ts from "typescript";
import * as policy from "../src/lib/publicDailyOfferSettingsPolicy.mjs";
import * as http from "../src/lib/httpMutationPolicy.mjs";

function load(file, dependencies, env = {}) {
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  runInNewContext(compiled, { exports, URL, process: { env, cwd: () => process.cwd() }, require(name) {
    assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test("persistent offer setting has no 24-hour or 14-day expiration and preserves unrelated settings", () => {
  const settings = policy.createPublicDailyOfferSettings(true, "synthetic-admin", { unrelated: 42 }, new Date("2026-01-01Z"));
  assert.equal(policy.readPublicDailyOfferEnabled(settings), true);
  assert.equal(settings.unrelated, 42);
  assert.equal(policy.readPublicDailyOfferEnabled({ ...settings, publicDailyOfferEnabled: false }), false);
  for (const value of [null, [], "true", true, 1]) assert.equal(policy.readPublicDailyOfferEnabled(value), false);
  for (const value of ["true", 1, undefined, null]) assert.equal(policy.readPublicDailyOfferEnabled({ publicDailyOfferEnabled: value }), false);
  assert.equal(policy.readPublicDailyOfferEnabled({ publicDailyTestPlanEnabled: false }), true);
  assert.throws(() => policy.createPublicDailyOfferSettings("true", "admin"));
});

test("actual runtime file persists OFF across fresh module loads, uses private permissions and fails closed on corruption", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "fanmind-daily-unit-"));
  const file = path.join(dir, "settings.json");
  const runtime = () => load("src/lib/runtimeProductSettings.ts", {
    "server-only": {}, "node:crypto": crypto, "node:fs/promises": fs, "node:path": path,
    "@/lib/publicDailyOfferSettingsPolicy.mjs": policy,
  }, { NODE_ENV: "test", FANMIND_RUNTIME_SETTINGS_FILE: file });
  try {
    assert.equal(await runtime().getPublicDailyTestPlanEnabled(), true);
    await fs.writeFile(file, JSON.stringify({ publicDailyTestPlanEnabled: false, unrelated: 42 }));
    await runtime().setPublicDailyTestPlanEnabled(false, "synthetic-admin");
    assert.equal(await runtime().getPublicDailyTestPlanEnabled(), false);
    const stored = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(stored.unrelated, 42);
    assert.equal(stored.publicDailyOfferEnabled, false);
    await runtime().setPublicDailyTestPlanEnabled(true, "synthetic-admin");
    assert.equal(await runtime().getPublicDailyTestPlanEnabled(), true);
    // Bind the permission check and corruption fixture to the same descriptor.
    const handle = await fs.open(file, "r+");
    try {
      assert.equal((await handle.stat()).mode & 0o777, 0o600);
      await handle.truncate(0);
      await handle.writeFile("malformed");
    } finally { await handle.close(); }
    assert.equal(await runtime().getPublicDailyTestPlanEnabled(), false);
    await assert.rejects(runtime().setPublicDailyTestPlanEnabled(true, "synthetic-admin"));
    assert.deepEqual(await fs.readdir(dir), ["settings.json"]);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

function adminHarness({ admin = true, saveFails = false } = {}) {
  const writes = [], invalidations = [];
  const route = load("src/app/api/admin/settings/daily-test-plan/route.ts", {
    "next/server": { NextResponse: { json: (body, options) => Response.json(body, options), redirect: (url, options) => new Response(null, { ...options, headers: { location: String(url) } }) } },
    "next/cache": { revalidatePath: (...args) => invalidations.push(args) },
    "@/lib/admin": { requirePlatformAdmin: async () => { if (!admin) throw new Error("not-admin"); return { id: "synthetic-admin" }; } },
    "@/lib/httpMutationPolicy.mjs": { ...http, isTrustedFanMindMutationRequest: r => http.isTrustedFanMindMutationRequest(r, {}) },
    "@/lib/runtimeProductSettings": { setPublicDailyTestPlanEnabled: async (...args) => { if (saveFails) throw new Error("private-storage-error"); writes.push(args); } },
  });
  const request = (body, origin = "https://fanmind.ch") => {
    const r = new Request("https://fanmind.ch/api/admin/settings/daily-test-plan", { method: "POST", body, headers: { origin, "content-type": "application/x-www-form-urlencoded" } });
    r.nextUrl = new URL(r.url); return r;
  };
  return { route, request, writes, invalidations };
}

test("only an authenticated same-origin admin can persist exact ON/OFF and invalidate the entire public tree", async () => {
  const h = adminHarness();
  for (const value of ["true", "false"]) {
    const response = await h.route.POST(h.request(`enabled=${value}`));
    assert.equal(response.status, 303);
    assert.ok(response.headers.get("location").includes(value === "true" ? "enabled" : "disabled"));
  }
  assert.deepEqual(h.writes, [[true, "synthetic-admin"], [false, "synthetic-admin"]]);
  assert.deepEqual(h.invalidations, [["/", "layout"], ["/", "layout"]]);
  for (const body of ["", "enabled=yes", "enabled=true&enabled=false", "enabled=true&other=value"]) {
    assert.equal((await h.route.POST(h.request(body))).status, 400);
  }
  assert.equal((await h.route.POST(h.request("enabled=true", "https://foreign.invalid"))).status, 403);
  const unauthorized = adminHarness({ admin: false });
  await assert.rejects(unauthorized.route.POST(unauthorized.request("enabled=true")), /not-admin/);
  assert.equal(unauthorized.writes.length, 0);
  const failed = adminHarness({ saveFails: true });
  const response = await failed.route.POST(failed.request("enabled=true"));
  assert.equal(response.status, 503);
  assert.equal(failed.invalidations.length, 0);
  assert.equal((await response.text()).includes("private-storage-error"), false);
  assert.equal(h.writes.length, 2);
});

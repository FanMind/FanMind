import assert from "node:assert/strict";
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
    assert.match(source, /await getPublicDailyTestPlanEnabled\(\)/u, file);
    assert.doesNotMatch(source, /PUBLIC_DAILY_PLAN_ENABLED/u, file);
  }
});

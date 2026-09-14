import { expect, test } from "@playwright/test";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdtemp, writeFile, rename, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Own loopback server and private settings file: never alter the other public
// suites, a deployed server, an account, a database, Stripe or a real recipient.
test.describe("Daily admin setting across public pages", () => {
  let server: ChildProcess;
  let directory = "";
  let file = "";
  let base = "";
  test.beforeAll(async ({}, workerInfo) => {
    directory = await mkdtemp(path.join(tmpdir(), "fanmind-daily-browser-"));
    file = path.join(directory, "settings.json");
    await writeFile(file, JSON.stringify({ publicDailyPlanEnabled: false }), { mode: 0o600 });
    const port = 3210 + workerInfo.workerIndex;
    base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      env: { ...process.env, FANMIND_RUNTIME_SETTINGS_FILE: file },
      stdio: "ignore",
    });
    await expect.poll(async () => {
      if (server.exitCode !== null) return false;
      try { return (await fetch(base, { signal: AbortSignal.timeout(2000) })).ok; }
      catch { return false; }
    }, { timeout: 45000 }).toBe(true);
  });
  test.afterAll(async () => {
    if (server && server.exitCode === null) {
      server.kill("SIGTERM");
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { server.kill("SIGKILL"); resolve(); }, 5000);
        server.once("close", () => { clearTimeout(timer); resolve(); });
      });
    }
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  test("off/on/off is reflected in DE/EN without a rebuild; stale Daily links never pick a monthly plan", async ({ page, context }) => {
    test.setTimeout(120000);
    await context.addCookies([{ name: "fanmind_marketing_consent", value: "denied", url: base }]);
    await context.route("**/*.supabase.co/**", route => route.abort());
    await context.route("**/api/billing/**", route => route.abort());
    for (const enabled of [false, true, false]) {
      await writeFile(`${file}.next`, JSON.stringify({ publicDailyPlanEnabled: enabled }), { mode: 0o600 });
      await rename(`${file}.next`, file);
      for (const route of ["/", "/?lang=en", "/landing-v2", "/register", "/register?lang=en", "/zahlungsbedingungen", "/agb"]) {
        const response = await page.goto(`${base}${route}`);
        expect(response?.ok()).toBe(true);
        const content = await page.locator("main").innerText();
        expect(/\bDaily\b/u.test(content), route).toBe(enabled);
        if (!enabled) await expect(page.locator('a[href*="plan=daily"]')).toHaveCount(0);
      }
      if (!enabled) {
        for (const route of ["/register?plan=daily", "/register?plan=pilot&test_plan=daily", "/register?plan=daily&lang=en"]) {
          await page.goto(`${base}${route}`);
          await expect(page.locator('input[name="password"]')).toHaveCount(0);
          await expect(page.getByRole("heading")).toContainText(/unavailable|nicht verfügbar/u);
        }
        expect(JSON.parse(await readFile(file, "utf8")).publicDailyPlanEnabled).toBe(false);
      }
    }
  });
});

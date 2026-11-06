import { expect, test, type Route } from "@playwright/test";

const BASE = "http://127.0.0.1:3100";
const LEGACY = "#access_token=synthetic.signup.token&expires_at=1800000000&expires_in=3600&refresh_token=synthetic-refresh&token_type=bearer&type=signup";
const CURRENT = `${LEGACY}&sb=`;
const confirmedUser = { id: "synthetic-confirmed-user", email: "signup@example.invalid", email_confirmed_at: "2026-09-14T00:00:00Z" };

async function authResponse(route: Route, status = 200, user = confirmedUser) {
  await route.fulfill({
    status: route.request().method() === "OPTIONS" ? 204 : status,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-allow-methods": "GET, OPTIONS",
      "content-type": "application/json",
    },
    body: route.request().method() === "OPTIONS" ? "" : JSON.stringify(user),
  });
}

test.describe("Signup callback compatibility and automatic continuation", () => {
  test.beforeEach(async ({ context }) => {
    // Never send an email, create an account, provision a Workspace or charge.
    await context.route("**/auth/v1/signup**", route => route.abort());
    await context.route("**/auth/v1/resend**", route => route.abort());
    await context.route("**/api/register/workspace", route => route.abort());
    await context.route("**/api/billing/**", route => route.abort());
    await context.addCookies([{ name: "fanmind_marketing_consent", value: "denied", url: BASE }]);
  });

  for (const scenario of [
    { label: "current direct DE", path: "/register/confirm", fragment: CURRENT, setup: "/workspace/setup" },
    { label: "current direct EN", path: "/register/confirm?lang=en", fragment: CURRENT, setup: "/workspace/setup?lang=en" },
    { label: "current login fallback", path: "/login", fragment: CURRENT, setup: "/workspace/setup" },
    { label: "legacy direct", path: "/register/confirm", fragment: LEGACY, setup: "/workspace/setup" },
  ]) {
    test(`${scenario.label}: real session endpoint sets HttpOnly cookies before setup`, async ({ page, context }) => {
      let checks = 0;
      let sessionRequests = 0;
      let cleanBeforeCheck = false;
      let setupHasSession = false;
      await page.route("**/auth/v1/user", async route => {
        if (route.request().method() === "GET") {
          checks++;
          cleanBeforeCheck = !page.url().includes("access_token") && !page.url().includes("refresh_token");
        }
        await authResponse(route);
      });
      page.on("request", request => {
        if (new URL(request.url()).pathname === "/api/auth/session") sessionRequests++;
      });
      await page.route(`${BASE}${scenario.setup}`, async route => {
        const headers = await route.request().allHeaders();
        const cookieNames = (headers.cookie ?? "").split(";").map(item => item.trim().split("=", 1)[0]);
        setupHasSession = cookieNames.includes("fanmind_sb_access_token") && cookieNames.includes("fanmind_sb_refresh_token");
        await route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Synthetic setup</h1>" });
      });
      await page.goto(`${scenario.path}${scenario.fragment}`);
      await expect(page).toHaveURL(`${BASE}${scenario.setup}`);
      expect(checks).toBeGreaterThan(0);
      expect(cleanBeforeCheck).toBe(true);
      expect(sessionRequests).toBe(1);
      // Playwright's HTTP-URL filter omits Secure cookies for numeric loopback,
      // although Chromium treats loopback as trustworthy. Read the inventory,
      // enforce the exact host/flags, and separately prove browser transmission.
      const cookies = await context.cookies();
      for (const name of ["fanmind_sb_access_token", "fanmind_sb_refresh_token"]) {
        expect(cookies.some(cookie => cookie.name === name && cookie.domain === "127.0.0.1" && cookie.path === "/" && cookie.httpOnly && cookie.secure && cookie.sameSite === "Lax")).toBe(true);
      }
      expect(setupHasSession).toBe(true);
    });
  }

  test("a provider-shaped marked callback cannot bypass a rejected user lookup", async ({ page }) => {
    let sessions = 0;
    await page.route("**/api/auth/session", async route => { sessions++; await route.abort(); });
    await page.route("**/auth/v1/user", route => authResponse(route, 401));
    await page.goto(`/register/confirm${CURRENT}`);
    await expect(page.getByText(/Dieser Link ist ungültig/u)).toBeVisible();
    expect(sessions).toBe(0);
  });

  test("late verified-user response cannot accept a replaced invalid callback", async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let checks = 0;
    let sessions = 0;
    await page.route("**/api/auth/session", async route => { sessions++; await route.abort(); });
    await page.route("**/auth/v1/user", async route => {
      if (route.request().method() === "GET") { checks++; await gate; }
      await authResponse(route);
    });
    const response = page.waitForResponse(r => r.url().endsWith("/auth/v1/user") && r.request().method() === "GET");
    try {
      await page.goto(`/register/confirm${CURRENT}`);
      await expect.poll(() => checks).toBeGreaterThan(0);
      await page.goto(`/register/confirm${CURRENT}&error_code=otp_expired`);
      await expect(page.getByText(/Dieser Link ist ungültig/u)).toBeVisible();
    } finally { release(); }
    await (await response).finished();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
    expect(sessions).toBe(0);
    await expect(page).toHaveURL(`${BASE}/register/confirm`);
  });

  for (const retry of [false, true]) {
    test(`${retry ? "retry" : "automatic"} pending handoff is aborted before a replaced link can install cookies`, async ({ page, context }) => {
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      let sessions = 0;
      let aborted = false;
      let replyFinished = false;
      await page.route("**/auth/v1/user", route => authResponse(route));
      page.on("requestfailed", request => {
        if (new URL(request.url()).pathname === "/api/auth/session") aborted = true;
      });
      await page.route("**/api/auth/session", async route => {
        sessions++;
        if (retry && sessions === 1) {
          await route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"unavailable"}' });
          return;
        }
        await gate;
        try {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            headers: { "set-cookie": "fanmind_sb_access_token=synthetic-obsolete-session; Path=/; HttpOnly; Secure; SameSite=Lax" },
            body: '{"ok":true}',
          });
        } catch (error) {
          if (!aborted) throw error;
        } finally { replyFinished = true; }
      });
      try {
        await page.goto(`/register/confirm${CURRENT}`);
        if (retry) await page.getByRole("button", { name: "Mit diesem Konto fortfahren" }).click();
        await expect.poll(() => sessions).toBe(retry ? 2 : 1);
        await page.goto(`/register/confirm${CURRENT}&error_code=otp_expired`);
        await expect(page.getByText(/Dieser Link ist ungültig/u)).toBeVisible();
        await expect.poll(() => aborted).toBe(true);
      } finally { release(); }
      await expect.poll(() => replyFinished).toBe(true);
      const cookies = await context.cookies();
      expect(cookies.some(cookie => ["fanmind_sb_access_token", "fanmind_sb_refresh_token"].includes(cookie.name))).toBe(false);
      await expect(page).toHaveURL(`${BASE}/register/confirm`);
      await expect(page.getByRole("button", { name: "Mit diesem Konto fortfahren" })).toHaveCount(0);
    });
  }

  test("failed session handoff preserves confirmed identity and allows only explicit retry", async ({ page }) => {
    let sessions = 0;
    await page.route("**/auth/v1/user", route => authResponse(route));
    await page.route("**/api/auth/session", async route => {
      sessions++;
      await route.fulfill({ status: sessions === 1 ? 503 : 200, contentType: "application/json", body: sessions === 1 ? '{"error":"unavailable"}' : '{"ok":true}' });
    });
    await page.route("**/workspace/setup", route => route.fulfill({ status: 200, body: "Synthetic setup" }));
    await page.goto(`/register/confirm${CURRENT}`);
    await expect(page.getByRole("heading", { name: "Deine E-Mail ist bestätigt" })).toBeVisible();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Bitte melde dich an, um fortzufahren.");
    await expect(page.getByRole("button", { name: "Neue Bestätigung anfordern" })).toHaveCount(0);
    expect(sessions).toBe(1);
    await page.getByRole("button", { name: "Mit diesem Konto fortfahren" }).click();
    await expect(page).toHaveURL(`${BASE}/workspace/setup`);
    expect(sessions).toBe(2);
  });
});

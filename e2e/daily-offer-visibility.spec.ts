import { expect, test } from "@playwright/test";
import { writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

const settingsFile = process.env.FANMIND_DAILY_E2E_SETTINGS_FILE ?? "";
const isolated = settingsFile.startsWith(path.join(os.tmpdir(), "fanmind-daily-e2e-")) && path.basename(settingsFile) === "settings.json";
test.skip(!isolated || process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1", "Only the test-owned local server/settings file may be changed.");

async function setOffer(enabled: boolean) {
  if (!isolated) throw new Error("non-isolated settings path");
  await writeFile(settingsFile, JSON.stringify({ publicDailyOfferEnabled: enabled }), { mode: 0o600 });
}

test.beforeEach(async ({ context }) => {
  await context.route("**/*.supabase.co/**", route => route.abort());
  await context.route("**/api/register/workspace", route => route.abort());
  await context.route("**/api/billing/**", route => route.abort());
});
test.afterEach(async () => { if (isolated) await rm(settingsFile, { force: true }); });

test("OFF removes Daily from every public surface in DE/EN; ON restores it without deployment", async ({ page }) => {
  await setOffer(true);
  await page.goto("/");
  await expect(page.locator('a[href*="plan=daily"]').first()).toBeVisible();
  await setOffer(false);
  for (const route of ["/", "/?lang=en", "/landing-v2", "/landing-v2?lang=en", "/register", "/register?lang=en", "/zahlungsbedingungen", "/agb"]) {
    await page.goto(route);
    await expect(page.locator('a[href*="plan=daily"]')).toHaveCount(0);
    await expect(page.locator("main")).not.toContainText(/\bDaily\b/u);
  }
  await setOffer(true);
  await page.goto("/?lang=en");
  await expect(page.locator('a[href*="plan=daily"]').first()).toBeVisible();
  await page.goto("/register?plan=daily");
  await expect(page.getByText("Daily · 0 € Setup + 1 €/Tag", { exact: true })).toBeVisible();
  await page.goto("/zahlungsbedingungen");
  await expect(page.getByRole("heading", { name: "Daily", exact: true }).first()).toBeVisible();
});

test("a retained Daily deep link does not create a monthly signup while OFF", async ({ page }) => {
  let signupRequests = 0;
  await page.route("**/auth/v1/signup**", route => { signupRequests++; return route.abort(); });
  await setOffer(false);
  await page.goto("/register?plan=daily");
  await expect(page.getByRole("status")).toContainText("Dieses Angebot ist derzeit nicht verfügbar");
  await expect(page.locator("main")).not.toContainText(/\bDaily\b/u);
  await page.getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/plan=daily&lang=en/u);
  await expect(page.getByRole("status")).toContainText("This offer is currently unavailable");
  await page.getByRole("link", { name: "DE", exact: true }).click();
  await expect(page).toHaveURL(/plan=daily(?!.*lang=en)/u);
  await expect(page.getByRole("status")).toContainText("Dieses Angebot ist derzeit nicht verfügbar");
  await page.locator('input[name="email"]').fill("synthetic@example.invalid");
  await page.locator('input[name="password"]').fill("Synthetic-Only-2026!");
  await page.locator('input[name="organisation"]').fill("Synthetic");
  await page.locator('select[name="rolle"]').selectOption("Creator");
  await page.getByRole("button", { name: "Konto erstellen →", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Dieses Angebot" })).toBeVisible();
  expect(signupRequests).toBe(0);
});

import { expect, test } from "@playwright/test";

for (const language of ["de", "en"]) {
  test(`Capacity package preference, free signup and layout (${language})`, async ({ page }) => {
    let forbiddenCalls = 0;
    let signup: { data: Record<string, unknown> } | undefined;
    await page.route("**/api/register/workspace**", route => { forbiddenCalls++; return route.abort(); });
    await page.route("**/api/billing/**", route => { forbiddenCalls++; return route.abort(); });
    await page.route("https://api.stripe.com/**", route => { forbiddenCalls++; return route.abort(); });
    await page.route("**/auth/v1/signup**", async route => {
      const headers = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers }); return;
      }
      signup = route.request().postDataJSON();
      await route.fulfill({ status: 200, headers, contentType: "application/json", body: JSON.stringify({ id: "synthetic-signup", email: "synthetic@example.invalid" }) });
    });
    for (const amount of [99, 199, 312]) {
      await page.goto(`/register?plan=capacity_${amount}&lang=${language}`);
      const selected = page.locator(`input[name="commercialOption"][value="capacity_${amount}"]`);
      await expect(selected).toBeChecked();
      for (const option of [99, 199, 312]) {
        await page.locator(`label:has(input[value="capacity_${option}"])`).click();
        await expect(page.locator(`input[value="capacity_${option}"]`)).toBeChecked();
      }
      await page.locator(`label:has(input[value="capacity_${amount}"])`).click();
      await expect(page.locator("main")).not.toContainText(/990|Starter Flex|Starter 12/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      await page.locator('input[name="email"]').fill("synthetic@example.invalid");
      await page.locator('input[name="password"]').fill("Synthetic-password-2026!");
      await page.locator('input[name="organisation"]').fill("Synthetic Team");
      await page.locator('select[name="rolle"]').selectOption("Creator");
      await page.locator('button[type="submit"]').click();
      await expect.poll(() => signup?.data.registration_plan_preference).toBe(`capacity_${amount}`);
      expect(signup?.data.registration_option_preference).toBe("capacity_v2");
      for (const key of ["plan_id", "commercial_option", "billing_status", "payment_terms_accepted", "payment_terms_version"]) expect(signup?.data).not.toHaveProperty(key);
      expect(forbiddenCalls).toBe(0);
      signup = undefined;
    }
    await page.goto(`/?lang=${language}`);
    const pricing = page.locator("#preise");
    for (const amount of [99, 199, 312]) await expect(pricing.getByRole("heading", { name: `FanMind ${amount}`, exact: true })).toBeVisible();
    await expect(pricing).not.toContainText(/990|Starter Flex|Starter 12/);
  });
}

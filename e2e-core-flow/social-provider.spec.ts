import { expect, test } from "@playwright/test";

test("TikTok profile capability and X read preview are explicit; disconnect clears the preview", async ({ page, request }) => {
  await request.post("http://127.0.0.1:54321/__reset", { headers: { Authorization: "Bearer fanmind-local-core-flow-service-role-key" } });
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  let connected = true, pending = false, reads = 0, initialReads = 0, disconnects = 0, starts = 0;
  await page.route("https://x.com/i/oauth2/authorize?*", route => route.fulfill({ contentType: "text/html", body: "<main>Synthetic provider authorization</main>" }));
  await page.route("**/api/integrations/social/tiktok/status", route => route.fulfill({ json: { available: false, connected: false, accountName: null, capability: "profile_only" } }));
  await page.route("**/api/integrations/social/x/*", async route => {
    const action = new URL(route.request().url()).pathname.split("/").pop();
    if (action === "status") { await route.fulfill({ json: { available: true, connected, initialReadPending: pending, accountName: "Synthetic X", capability: "dm_read_preview" } }); return; }
    expect(route.request().method()).toBe("POST");
    if (action === "start") { starts++; await route.fulfill({ json: { authorizationUrl: "https://x.com/i/oauth2/authorize?state=synthetic" } }); return; }
    if (action === "messages" || action === "initial-messages") {
      if (action === "initial-messages") { initialReads++; expect(pending).toBe(true); pending = false; }
      reads++; await route.fulfill({ json: { messages: [{ id: "1", senderId: "456", text: "Synthetic inbound message", receivedAt: "2026-09-11T09:00:00Z", openUrl: "https://x.com/messages" }], skipped: 0, hasMore: false } }); return;
    }
    expect(action).toBe("disconnect"); disconnects++; connected = false;
    await route.fulfill({ json: { disconnected: true, providerRevoked: false } });
  });
  await page.goto("/login");
  await page.locator('input[name="email"]').fill("gerhard-core-flow@synthetic.invalid");
  await page.locator('input[name="password"]').fill("FanMind-Local-Core-Flow-2026!");
  await page.getByRole("button", { name: /Einloggen/u }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/channels?social=tiktok&social_result=toString");
  const tiktok = page.getByRole("region", { name: "TikTok verbinden" });
  await expect(tiktok).toBeVisible();
  await expect(tiktok.getByText(/Die offizielle Anmeldung verbindet dein Profil/)).toBeVisible();
  await expect(tiktok.getByRole("button", { name: "Eigenes TikTok-Konto verbinden" })).toBeDisabled();
  await expect(tiktok.getByRole("button", { name: "Direktnachrichten prüfen" })).toHaveCount(0);
  await expect(tiktok.getByText("Die Verbindung konnte nicht abgeschlossen werden.")).toBeVisible();
  await expect(tiktok.locator('input[type="password"]')).toHaveCount(0);
  await expect(tiktok.getByText(/FanMind erhält dein Plattform-Passwort nicht/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("heading", { name: "X / Twitter", exact: true }).click();
  const x = page.getByRole("region", { name: "X / Twitter verbinden" });
  await expect(x.getByText("Synthetic X", { exact: true })).toBeVisible();
  await expect(x.getByText(/Für alle Kanäle gilt derselbe persönliche Schreibstil/)).toBeVisible();
  expect(reads).toBe(0);
  await x.getByRole("button", { name: "Direktnachrichten prüfen" }).click();
  await expect(x.getByText("Synthetic inbound message", { exact: true })).toBeVisible();
  await expect(x.getByRole("link", { name: "X-Nachrichten öffnen" })).toHaveAttribute("href", "https://x.com/messages");
  await x.getByRole("button", { name: "Verbindung trennen" }).click();
  await expect(x.getByText("Synthetic inbound message", { exact: true })).toHaveCount(0);
  await expect(x.getByText(/Entferne FanMind zusätzlich in den App-Berechtigungen/)).toBeVisible();
  expect(reads).toBe(1); expect(disconnects).toBe(1); expect(errors).toEqual([]);
  await x.getByRole("button", { name: "Eigenes X / Twitter-Konto verbinden" }).click();
  await page.waitForURL("https://x.com/i/oauth2/authorize?state=synthetic");
  await expect(page.getByText("Synthetic provider authorization")).toBeVisible();
  expect(starts).toBe(1); expect(errors).toEqual([]);
  // The fixture now models successful server-side completion. URL alone did not.
  connected = true; pending = true;
  await page.goto("/channels?social=x&social_result=connected");
  await expect(x).toBeVisible();
  await expect(x.getByText("Synthetic inbound message", { exact: true })).toBeVisible();
  expect(initialReads).toBe(1); expect(reads).toBe(2);
  await page.reload();
  await expect(x.getByText("Synthetic X", { exact: true })).toBeVisible();
  await expect(x.getByRole("button", { name: "Direktnachrichten prüfen" })).toBeEnabled();
  await expect(x.getByText("Synthetic inbound message", { exact: true })).toHaveCount(0);
  expect(initialReads).toBe(1); expect(reads).toBe(2); expect(errors).toEqual([]);
  for (const provider of ["instagram", "facebook"] as const) {
    // Playwright routes intercept only the first URL of a redirect chain. A real
    // response on the isolated fixture origin proves cross-origin document
    // navigation under CSP without allowing a request to a real provider.
    const target = `http://127.0.0.1:54321/__social-authorization/${provider}`;
    await page.route(`**/api/integrations/${provider}/start?type=${provider}_messages`, async route => {
      expect(route.request().method()).toBe("GET");
      await route.fulfill({ status: 302, headers: { Location: target } });
    });
    await page.goto(`/channels?connected=${provider}_messages`);
    const modal = page.getByRole("dialog");
    await expect(modal).toBeVisible();
    await expect(modal.locator('input[type="password"]')).toHaveCount(0);
    await modal.getByRole("button", { name: provider === "instagram" ? "Eigenes Instagram-Konto verbinden" : "Eigene Facebook-Seite verbinden", exact: true }).click();
    await page.waitForURL(target);
    await expect(page.getByText(`Synthetic ${provider} authorization`)).toBeVisible();
  }
  expect(errors).toEqual([]);
});

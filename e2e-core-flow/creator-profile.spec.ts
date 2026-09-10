import { expect, test } from "@playwright/test";
import { defaultCreatorBundle, type CreatorBundle } from "../src/lib/creatorIntelligencePolicy.mjs";

test("Creator editor and confirmed fan purchase stay human controlled", async ({ page, request }) => {
  await request.post("http://127.0.0.1:54321/__reset", { headers: { Authorization: "Bearer fanmind-local-core-flow-service-role-key" } });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const bundle = defaultCreatorBundle();
  bundle.id = "70000000-0000-4000-8000-000000000001";
  bundle.revision = 1; bundle.persona.displayName = "Synthetic Sophie";
  bundle.persona.status = "active"; bundle.voice.tone = "warm und verspielt";
  bundle.voice.goodExamples = ["Hey, wie war dein Tag?", "Das freut mich.", "Erzähl mir mehr."];
  bundle.approve = true;
  let saved: CreatorBundle | null = null;
  let fanSaved: Record<string, unknown> | null = null;
  await page.route("**/api/creators", async (route) => {
    if (route.request().method() === "POST") saved = route.request().postDataJSON().bundle;
    await route.fulfill({ json: { available: true, canManage: true, creators: [saved ?? bundle] } });
  });
  await page.route("**/api/creators/fan?*", async (route) => {
    if (route.request().method() === "POST") { fanSaved = route.request().postDataJSON(); await route.fulfill({ json: { ok: true } }); return; }
    await route.fulfill({ json: { available: true, configured: true, canManage: true, commercial: {}, events: [], offers: [] } });
  });
  await page.goto("/login");
  await page.getByRole("textbox", { name: "E-Mail", exact: true }).fill("gerhard-core-flow@synthetic.invalid");
  await page.locator('input[name="password"]').fill("FanMind-Local-Core-Flow-2026!");
  await page.getByRole("button", { name: /Einloggen/u }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/settings/ai-usage");
  const profile = page.getByRole("region", { name: "Dein Creator-Profil und deine Stimme" });
  await expect(profile).toBeVisible();
  await expect(profile.getByLabel(/Ich habe Persona/u)).toBeChecked();
  await profile.getByLabel("Grundton", { exact: true }).fill("ruhig und klar");
  await expect(profile.getByLabel(/Ich habe Persona/u)).not.toBeChecked();
  await profile.getByLabel(/Ich habe Persona/u).check();
  await profile.getByRole("button", { name: "Creator-Profil speichern" }).click();
  await expect(profile.getByRole("status")).toContainText("Geprüfte Version gespeichert");
  expect(saved).toMatchObject({ persona: { displayName: "Synthetic Sophie" }, voice: { tone: "ruhig und klar" }, approve: true });

  await page.goto("/fans/30000000-0000-4000-8000-000000000001");
  await page.getByText("Creator-Fanwissen und bestätigte Käufe", { exact: true }).click();
  const save = page.getByRole("button", { name: "Geprüfte Fandaten speichern" });
  await expect(save).toBeDisabled();
  await expect(page.getByLabel("Kaufabsicht (0–100)")).toHaveValue("");
  await page.getByLabel("Quelle der Prüfung (Nachrichten-/Belegreferenz)").fill("synthetic-reviewed-message");
  await page.getByLabel("Bestätigtes Ereignis ergänzen").selectOption("purchase");
  await page.getByLabel("Zeitpunkt (lokale Zeit)").fill("2026-09-01T10:00");
  await page.getByLabel("Betrag (bei Kauf erforderlich)").fill("250");
  await page.getByLabel("Eindeutige Kauf-/Nachrichtenreferenz").fill("synthetic-order-1");
  await page.getByLabel(/Ich habe diese Angaben/u).check();
  await save.click();
  await expect(page.getByText(/Bestätigte Daten gespeichert/u)).toBeVisible();
  expect(fanSaved).toMatchObject({ confirmed: true, commercial: { engagementScore: null, purchaseIntentScore: null, offerFatigue: null }, event: { kind: "purchase", amountMinor: 25000, currency: "EUR", evidenceReference: "synthetic-order-1" } });
  await expect(save).toBeDisabled();
  expect(errors).toEqual([]);
});

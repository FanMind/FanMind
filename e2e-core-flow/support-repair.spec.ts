import { expect, test, type Page } from "@playwright/test";

const APP_ORIGIN = "http://localhost:3100";
const EMAIL = "gerhard-core-flow@synthetic.invalid";
const PASSWORD = "FanMind-Local-Core-Flow-2026!";

type RepairMode = "failed" | "succeeded";

async function login(page: Page) {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "E-Mail", exact: true })
    .fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(`${APP_ORIGIN}/dashboard`),
    page.getByRole("button", { name: /Einloggen/u }).click(),
  ]);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

async function prepareSupportFlow(page: Page, mode: RepairMode) {
  const providerRequests: string[] = [];
  const repairBodies: Array<Record<string, unknown>> = [];

  page.on("request", (request) => {
    const url = request.url();
    if (/^https:\/\/graph\.(?:facebook|instagram)\.com(?:\/|$)/iu.test(url)) {
      providerRequests.push(url);
    }
  });
  await page.route(/^https:\/\/graph\.(?:facebook|instagram)\.com\/.*$/iu, (route) =>
    route.abort("blockedbyclient"),
  );
  await page.route("**/api/support/diagnostics", async (route) => {
    expect(route.request().method()).toBe("GET");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify({
        ok: true,
        connections: [
          {
            platform: "instagram",
            status: "attention_required",
            issue: "message_sync",
          },
        ],
      }),
    });
  });
  await page.route("**/api/support/repair-request", async (route) => {
    const request = route.request();
    expect(request.method()).toBe("POST");
    const body = request.postDataJSON() as Record<string, unknown>;
    repairBodies.push(body);
    expect(Object.keys(body).sort()).toEqual([
      "action",
      "confirmed",
      "platform",
      "requestId",
    ]);
    expect(body).toMatchObject({
      action: "restart_message_sync",
      confirmed: true,
      platform: "instagram",
    });
    expect(body.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu,
    );
    expect(body).not.toHaveProperty("workspaceId");
    expect(body).not.toHaveProperty("workspace_id");
    expect(body).not.toHaveProperty("connectionId");
    expect(body).not.toHaveProperty("connection_id");

    await route.fulfill({
      status: mode === "succeeded" ? 200 : 409,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(
        mode === "succeeded"
          ? {
              requestId: body.requestId,
              status: "succeeded",
              repairExecuted: true,
              verified: true,
            }
          : {
              requestId: body.requestId,
              status: "verification_failed",
              repairExecuted: true,
              verified: false,
              nextStepUrl: "/channels",
            },
      ),
    });
  });

  await login(page);
  await page.getByRole("button", { name: "Hilfe", exact: true }).click();

  const panel = page.locator("#fanmind-inapp-help-panel");
  await expect(panel).toBeVisible();
  await expect(
    panel.getByText("Instagram", { exact: true }),
  ).toBeVisible();
  await panel.getByRole("button", { name: "Hilfe anzeigen" }).click();
  await expect(
    panel.getByText(/Fehler bei der Nachrichtensynchronisierung/u),
  ).toBeVisible();
  await expect(
    panel.getByText(/keine Zugangsdaten, Berechtigungen oder Provider-Einstellungen/u),
  ).toBeVisible();

  const restart = panel.getByRole("button", {
    name: "Synchronisierung neu starten",
  });
  await expect(restart).toBeDisabled();
  await panel
    .getByRole("checkbox", {
      name: "Ich stimme diesem einmaligen Neustart ausdrücklich zu.",
    })
    .check();
  await expect(restart).toBeEnabled();
  await restart.click();

  return { panel, providerRequests, repairBodies };
}

test("confirmed support repair reports only a verified synthetic success", async ({
  page,
}) => {
  const { panel, providerRequests, repairBodies } = await prepareSupportFlow(
    page,
    "succeeded",
  );

  await expect(
    panel.getByText(
      "Synchronisierung wurde neu gestartet und anschließend bestätigt.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    panel.getByText(/nicht sicher bestätigt/u),
  ).toHaveCount(0);
  expect(repairBodies).toHaveLength(1);
  expect(providerRequests).toEqual([]);
});

test("unverified support repair fails closed without provider egress", async ({
  page,
}) => {
  const { panel, providerRequests, repairBodies } = await prepareSupportFlow(
    page,
    "failed",
  );

  await expect(
    panel.getByText(
      "Die Reparatur konnte nicht sicher bestätigt werden. Bitte die Verbindungseinstellungen öffnen.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    panel.getByText(/neu gestartet und anschließend bestätigt/u),
  ).toHaveCount(0);
  expect(repairBodies).toHaveLength(1);
  expect(providerRequests).toEqual([]);

  const visibleSupportText = await panel.innerText();
  expect(visibleSupportText).not.toMatch(
    /access[_ -]?token|service[_ -]?role|provider payload|last_messenger_sync_error/iu,
  );
});


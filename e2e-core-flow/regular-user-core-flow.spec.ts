import { expect, test, type Route } from "@playwright/test";

const APP_ORIGIN = "http://localhost:3100";
const FIXTURE_ORIGIN = "http://127.0.0.1:54321";
const FIXTURE_CONTROL_HEADERS = {
  Authorization: "Bearer fanmind-local-core-flow-service-role-key",
};
const EMAIL = "gerhard-core-flow@synthetic.invalid";
const PASSWORD = "FanMind-Local-Core-Flow-2026!";
const CONTACT_ID = "30000000-0000-4000-8000-000000000001";
const INBOUND_MESSAGE =
  "Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?";
const COPIED_REPLY =
  "Hallo Sandra, sehr gerne – ich schicke dir die neuen Termine am Montag.";
const MEMORY_CONTENT =
  "Sandra möchte neue Termine jeweils am Montag erhalten.";
const FOLLOWUP_REASON =
  "Sandra am Montag die neuen Termine schicken.";
const SAFETY_NOTE =
  "Der Mensch prüft und sendet final selbst. Keine automatische Sendefunktion.";

type FixtureState = {
  counts: {
    completed_followups: number;
    contacts: number;
    followups: number;
    memories: number;
    open_followups: number;
    seen_inbound_messages: number;
    workspaces: number;
  };
  mutation_codes: string[];
};

async function fulfillAiSuggestions(route: Route) {
  const request = route.request();
  expect(request.method()).toBe("POST");
  const body = request.postDataJSON() as Record<string, unknown>;
  expect(body.contactId).toBe(CONTACT_ID);
  expect(body.responseMode).toBe(
    "Freundlich: warm, persönlich und hilfreich",
  );
  expect(body).not.toHaveProperty("workspaceId");
  expect(body).not.toHaveProperty("workspace_id");
  expect(body).not.toHaveProperty("incomingMessage");

  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: {
      "cache-control": "private, no-store",
    },
    body: JSON.stringify({
      reply_options: [
        {
          tone: "friendly",
          label: "Warm und klar",
          text: COPIED_REPLY,
        },
        {
          tone: "short",
          label: "Kurz und direkt",
          text: "Ja, gerne. Die neuen Termine kommen am Montag.",
        },
        {
          tone: "personal",
          label: "Persönlich",
          text: "Sehr gerne, Sandra – ich melde mich am Montag mit den neuen Terminen.",
        },
      ],
      suggested_memory: {
        content: MEMORY_CONTENT,
        importance: "normal",
      },
      suggested_followup: {
        recommended: true,
        in_days: null,
        reason: FOLLOWUP_REASON,
      },
      safety_note: SAFETY_NOTE,
    }),
  });
}

test("regular Gerhard journey stays workspace-scoped and human controlled", async ({
  context,
  page,
  request,
}) => {
  const resetResponse = await request.post(`${FIXTURE_ORIGIN}/__reset`, {
    headers: FIXTURE_CONTROL_HEADERS,
  });
  expect(resetResponse.ok()).toBe(true);

  await context.addCookies([
    {
      name: "fanmind_marketing_consent",
      value: "denied",
      url: APP_ORIGIN,
      sameSite: "Lax",
    },
  ]);
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: APP_ORIGIN,
  });

  const unexpectedRequests: string[] = [];
  const failedResponses: string[] = [];
  const pageErrors: string[] = [];
  let aiRequests = 0;
  page.on("pageerror", (error) => pageErrors.push(error.name));
  page.on("response", (response) => {
    const responseUrl = new URL(response.url());
    const responseRequest = response.request();
    if (
      (responseUrl.origin === APP_ORIGIN ||
        responseUrl.origin === FIXTURE_ORIGIN) &&
      response.status() >= 400
    ) {
      failedResponses.push(
        `${response.status()} ${responseRequest.method()} ${responseUrl.pathname}`,
      );
    }
  });
  await context.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (
      requestUrl.origin === APP_ORIGIN &&
      requestUrl.pathname === "/api/ai/reply-suggestions"
    ) {
      aiRequests += 1;
      await fulfillAiSuggestions(route);
      return;
    }
    if (
      requestUrl.origin === APP_ORIGIN ||
      requestUrl.origin === FIXTURE_ORIGIN
    ) {
      await route.continue();
      return;
    }
    unexpectedRequests.push(`${route.request().method()} ${requestUrl.origin}`);
    await route.abort("blockedbyclient");
  });

  await page.goto("/");
  await expect(
    page.getByText("KI-Antwortvorschläge", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page
      .getByText(
        /Keine automatische Sendefunktion|Du prüfst, kopierst und sendest selbst/u,
      )
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Login" }).first().click();

  await page
    .getByRole("textbox", { name: "E-Mail", exact: true })
    .fill(EMAIL);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await Promise.all([
    page.waitForURL(`${APP_ORIGIN}/dashboard`),
    page.getByRole("button", { name: /Einloggen/u }).click(),
  ]);

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByText("Gerhard Core Flow Studio").first()).toBeVisible();
  await expect(page.getByText(/konnten nicht geladen/u)).toHaveCount(0);

  await page.goto("/inbox");
  await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible();
  await expect(page.getByText("Sandra Synthetic").first()).toBeVisible();
  await expect(page.getByText(INBOUND_MESSAGE).first()).toBeVisible();
  await expect(
    page.getByText("Antworten nie automatisch senden"),
  ).toBeVisible();

  await page.goto("/fans");
  await expect(page.getByRole("heading", { name: "Fans" })).toBeVisible();
  const sandraLink = page.locator(`a[href="/fans/${CONTACT_ID}"]`).first();
  await expect(sandraLink).toContainText("Sandra Synthetic");
  await sandraLink.click();

  await expect(page).toHaveURL(`${APP_ORIGIN}/fans/${CONTACT_ID}`);
  await expect(
    page.getByRole("heading", { name: "Sandra Synthetic" }).first(),
  ).toBeVisible();
  await expect(page.getByText(INBOUND_MESSAGE).first()).toBeVisible();
  await expect(
    page.getByText("Keine automatische Sendefunktion").first(),
  ).toBeVisible();

  await page.getByRole("button", { name: "KI-Vorschläge erzeugen" }).click();
  for (const label of ["Warm und klar", "Kurz und direkt", "Persönlich"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(SAFETY_NOTE)).toBeVisible();
  expect(aiRequests).toBe(1);

  const firstSuggestion = page
    .getByText("Warm und klar", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await firstSuggestion
    .getByRole("button", { name: "Antwort kopieren" })
    .click();
  await expect(
    firstSuggestion.getByRole("button", { name: "Kopiert" }),
  ).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(COPIED_REPLY);

  const memorySuggestion = page
    .getByText("Vorschlag fürs Kontaktwissen", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await memorySuggestion.getByRole("button", { name: "Speichern" }).click();
  await expect(memorySuggestion.getByRole("status")).toHaveText(
    "Im Kontaktwissen gespeichert.",
  );

  const followupSuggestion = page
    .getByText("Follow-up-Vorschlag", { exact: true })
    .locator("xpath=ancestor::article[1]");
  await followupSuggestion.getByRole("button", { name: "Speichern" }).click();
  await expect(followupSuggestion.getByRole("status")).toHaveText(
    "Follow-up gespeichert.",
  );

  await page.getByRole("tab", { name: "Kontaktwissen" }).click();
  await expect(
    page.getByRole("tabpanel").locator("p").filter({ hasText: MEMORY_CONTENT }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Follow-ups" }).click();
  await expect(
    page.getByRole("tabpanel").locator("p").filter({ hasText: FOLLOWUP_REASON }),
  ).toBeVisible();

  await page.goto("/followups");
  await expect(page.getByRole("heading", { name: "Follow-ups" })).toBeVisible();
  const openRow = page.locator("tr").filter({ hasText: FOLLOWUP_REASON });
  await expect(openRow).toContainText("Sandra Synthetic");
  page.once("dialog", (dialog) => dialog.accept());
  await openRow
    .getByRole("button", { name: "Als erledigt markieren" })
    .click();
  await expect(
    page.getByText("Follow-up wurde als erledigt markiert."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Wieder öffnen" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Wieder öffnen" }).click();
  await expect(
    page.getByText("Follow-up wurde wieder geöffnet."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Als erledigt markieren" }),
  ).toBeVisible();

  await page.goto("/roadmap");
  await expect(
    page.getByRole("heading", {
      name: "Was ist verfügbar, was kommt später?",
    }),
  ).toBeVisible();
  const integrationNotice = page
    .getByRole("heading", { name: "Integrationen", exact: true })
    .locator("xpath=..");
  await expect(
    integrationNotice.getByText(
      /Weitere Phase-8-Kanäle.*Teamzugänge.*später geplant/u,
    ),
  ).toBeVisible();
  await expect(
    integrationNotice.getByText(/keine Nachrichten automatisch/u),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "In Arbeit / Vorbereitung", exact: true })
      .locator("..").getByRole("heading", { name: "Social-Kanäle & Creator Intelligence", exact: true }),
  ).toBeVisible();

  const stateResponse = await request.get(`${FIXTURE_ORIGIN}/__state`, {
    headers: FIXTURE_CONTROL_HEADERS,
  });
  expect(stateResponse.ok()).toBe(true);
  const state = (await stateResponse.json()) as FixtureState;
  expect(state.counts).toEqual(
    expect.objectContaining({
      workspaces: 1,
      contacts: 1,
      memories: 1,
      followups: 1,
      open_followups: 1,
      completed_followups: 0,
      seen_inbound_messages: 1,
    }),
  );
  expect(state.mutation_codes).toEqual([
    "conversation_messages:PATCH:seen_at",
    "memories:POST",
    "followups:POST",
    "followups:PATCH:completed",
    "followups:PATCH:open",
  ]);
  expect(unexpectedRequests).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});

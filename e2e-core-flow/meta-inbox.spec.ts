import { expect, test } from "@playwright/test";

test("one fan's chats and post comments stay separate with exact manual reply targets", async ({ page, request }) => {
  const reset = await request.post("http://127.0.0.1:54321/__reset?scenario=meta-inbox", {
    headers: { Authorization: "Bearer fanmind-local-core-flow-service-role-key" },
  });
  expect(reset.ok()).toBe(true);
  await page.goto("/login");
  await page.getByRole("textbox", { name: "E-Mail", exact: true }).fill("gerhard-core-flow@synthetic.invalid");
  await page.locator('input[name="password"]').fill("FanMind-Local-Core-Flow-2026!");
  await page.getByRole("button", { name: /Einloggen/u }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/inbox");
  const queue = page.getByRole("table", { name: "Lokale Conversation Queue" });
  await expect(queue.getByText("Synthetic post comment 202", { exact: true }).first()).toBeVisible();
  await expect(queue.getByText("Synthetic post comment 203", { exact: true }).first()).toBeVisible();
  await expect(queue.getByText("Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Foreign workspace comment must stay hidden")).toHaveCount(0);

  await page.getByRole("link", { name: "Chats · Direktnachrichten", exact: true }).click();
  await expect(queue.getByText("Synthetic post comment 202", { exact: true })).toHaveCount(0);
  await expect(queue.getByText("Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "Nachrichten · Kommentare", exact: true }).click();
  await expect(queue.getByText("Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?", { exact: true })).toHaveCount(0);
  const replies = queue.getByRole("link", { name: "Antworten · Kommentar öffnen", exact: true });
  await expect(replies).toHaveCount(2);
  await expect(replies.nth(0)).toHaveAttribute("href", "https://www.facebook.com/101/posts/202?comment_id=303");
  await expect(replies.nth(1)).toHaveAttribute("href", "https://www.facebook.com/101/posts/203?comment_id=304");
  await expect(replies.nth(0)).toHaveAttribute("target", "_blank");

  await page.locator("#inbox-search").fill("comment 203");
  await page.getByRole("button", { name: "Suchen", exact: true }).click();
  await expect(page).toHaveURL(/view=comments/u);
  await expect(replies).toHaveCount(1);
  await expect(replies.first()).toHaveAttribute("href", "https://www.facebook.com/101/posts/203?comment_id=304");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(replies.first()).toBeVisible();
});

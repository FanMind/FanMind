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

  // The same person comments on two posts. Opening a queue entry must retain
  // that post's scope through the detail timeline and every original link.
  for (const [post, otherPost, comment] of [["202", "203", "303"], ["203", "202", "304"]]) {
    await queue.getByRole("link").filter({ hasText: `Synthetic post comment ${post}` }).first().click();
    await expect(page).toHaveURL(new RegExp(`source=facebook%3Apost%3A101_${post}`));
    await expect(page.getByRole("heading", { name: "Verlauf zu diesem Beitrag", exact: true })).toBeVisible();
    const timeline = page.getByRole("article", { name: "Kanalübergreifender Nachrichtenverlauf", exact: true });
    await expect(timeline.getByText(`Synthetic post comment ${post}`, { exact: true })).toBeVisible();
    await expect(timeline.getByText(`Synthetic post comment ${otherPost}`, { exact: true })).toHaveCount(0);
    await expect(timeline.getByText("Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?", { exact: true })).toHaveCount(0);
    const originals = page.getByRole("link", { name: "Zum Facebook-Kommentar wechseln", exact: true });
    expect(await originals.count()).toBeGreaterThan(0);
    for (const href of await originals.evaluateAll(links => links.map(link => link.getAttribute("href")))) {
      expect(href).toBe(`https://www.facebook.com/101/posts/${post}?comment_id=${comment}`);
    }
    await page.goto("/inbox?view=comments");
  }
  await page.goto("/inbox?view=chats");
  await queue.getByRole("link").filter({ hasText: "Hallo Gerhard, kannst du mir am Montag die neuen Termine schicken?" }).first().click();
  await expect(page).toHaveURL(/source=general_chat/u);
  await expect(page.getByRole("heading", { name: "Privater Chat", exact: true })).toBeVisible();
  await expect(page.getByText("Synthetic post comment 202", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Synthetic post comment 203", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Alle Ursprünge", exact: true })).toHaveCount(0);
  // A legacy aggregate bookmark must not merge post comments into the chat.
  const detailPath = new URL(page.url()).pathname;
  await page.goto(`${detailPath}?source=all`);
  await expect(page.getByRole("heading", { name: "Privater Chat", exact: true })).toBeVisible();
  const privateTimeline = page.getByRole("article", { name: "Kanalübergreifender Nachrichtenverlauf", exact: true });
  await expect(privateTimeline.getByText("Synthetic post comment 202", { exact: true })).toHaveCount(0);
  await expect(privateTimeline.getByText("Synthetic post comment 203", { exact: true })).toHaveCount(0);
  await page.goto(`${detailPath}?channel=facebook&source=facebook%3Apost%3A101_missing`);
  await expect(page.getByRole("article", { name: "Kanalübergreifender Nachrichtenverlauf", exact: true }).getByText("Synthetic post comment 202", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Zum Facebook-Kommentar wechseln", exact: true })).toHaveCount(0);
  await page.goto("/inbox?view=comments");

  await page.locator("#inbox-search").fill("comment 203");
  await page.getByRole("button", { name: "Suchen", exact: true }).click();
  await expect(page).toHaveURL(/view=comments/u);
  await expect(replies).toHaveCount(1);
  await expect(replies.first()).toHaveAttribute("href", "https://www.facebook.com/101/posts/203?comment_id=304");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(replies.first()).toBeVisible();
});

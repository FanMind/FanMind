import { expect, test } from "@playwright/test";

test("serves the exact cache-busted sidebar social avatar as browser icon", async ({
  page,
  request,
}) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const iconHrefs = await page.locator('link[rel~="icon"]').evaluateAll((links) =>
    links
      .map((link) => link.getAttribute("href"))
      .filter((href): href is string => Boolean(href)),
  );

  expect(iconHrefs.some((href) => href.includes("/favicon.ico"))).toBe(false);
  expect(iconHrefs.some((href) => /\/icon(?:\?|$)/u.test(href))).toBe(false);
  expect(iconHrefs.some((href) => /\/apple-icon(?:\?|$)/u.test(href))).toBe(false);

  const expectedIconHref = iconHrefs.find((href) =>
    href.includes(
      "/assets/fanmind-social-avatar.png?v=fanmind-social-avatar-exact-20260725",
    ),
  );
  expect(expectedIconHref).toBeDefined();

  const iconUrl = new URL(expectedIconHref!, page.url()).toString();
  const response = await request.get(iconUrl);
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("image/png");

  const png = await response.body();
  expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.readUInt32BE(16)).toBe(96);
  expect(png.readUInt32BE(20)).toBe(96);

  const samples = await page.evaluate(async (source) => {
    const image = new Image();
    image.src = source;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("browser_icon_failed_to_load"));
    });

    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("browser_icon_canvas_context_missing");
    context.drawImage(image, 0, 0);

    const alphaAt = (x: number, y: number) => context.getImageData(x, y, 1, 1).data[3];
    return {
      topLeft: alphaAt(0, 0),
      topRight: alphaAt(canvas.width - 1, 0),
      bottomLeft: alphaAt(0, canvas.height - 1),
      bottomRight: alphaAt(canvas.width - 1, canvas.height - 1),
      center: alphaAt(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2)),
      upperRing: alphaAt(Math.floor(canvas.width / 2), 6),
    };
  }, `data:image/png;base64,${png.toString("base64")}`);

  expect(samples.topLeft).toBeLessThanOrEqual(8);
  expect(samples.topRight).toBeLessThanOrEqual(8);
  expect(samples.bottomLeft).toBeLessThanOrEqual(8);
  expect(samples.bottomRight).toBeLessThanOrEqual(8);
  expect(samples.center).toBeGreaterThanOrEqual(245);
  expect(samples.upperRing).toBeGreaterThanOrEqual(180);
});

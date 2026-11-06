import { expect, test, type Page, type TestInfo } from "@playwright/test";

const NAVIGATION_LABELS = [
  "Dashboard",
  "Fans",
  "Follow-ups",
  "Kanäle",
  "Profil & Konto",
  "Adminbereich",
  "Top Fans",
  "Reaktivierung",
] as const;

async function sidebarGeometry(page: Page) {
  return page.evaluate((labels) => {
    const sidebar = document.querySelector<HTMLElement>('aside[aria-label="FanMind Navigation"]');
    if (!sidebar) throw new Error("sidebar_missing");

    const links = labels.map((label) => {
      const link = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sidebar-link]"),
      ).find((candidate) => candidate.dataset.sidebarLink === label);
      const icon = link?.querySelector<SVGElement>("svg");
      if (!link || !icon) throw new Error(`sidebar_link_missing:${label}`);
      const linkRect = link.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        label,
        linkTop: linkRect.top,
        linkHeight: linkRect.height,
        iconCenterX: iconRect.left + iconRect.width / 2,
        iconCenterY: iconRect.top + iconRect.height / 2,
      };
    });

    const shell = document.querySelector<HTMLElement>("[data-sidebar-state]");
    const content = shell?.children.item(1) as HTMLElement | null;
    const consent = document.querySelector("[data-fanmind-marketing-consent]");
    const sidebarStyle = getComputedStyle(sidebar);
    return {
      state: shell?.dataset.sidebarState ?? "missing",
      sidebarWidth: sidebar.getBoundingClientRect().width,
      sidebarPosition: sidebarStyle.position,
      sidebarBackgroundColor: sidebarStyle.backgroundColor,
      sidebarBackgroundImage: sidebarStyle.backgroundImage,
      contentLeft: content?.getBoundingClientRect().left ?? -1,
      pageScrollWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
      consentPresent: Boolean(consent),
      links,
    };
  }, NAVIGATION_LABELS);
}

async function saveEvidence(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe("FanMind workspace sidebar visual contract", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("fanmind_sidebar_collapsed");
    });
  });

  test("keeps every icon on one stable left rail while only labels collapse", async ({
    page,
  }, testInfo) => {
    await page.goto("/sidebar-preview-e2e", { waitUntil: "networkidle" });
    await expect(page.locator('[data-sidebar-state="expanded"]')).toBeVisible();
    await expect(page.getByTestId("sidebar-preview-content")).toBeVisible();

    const viewport = page.viewportSize();
    if (!viewport) throw new Error("viewport_missing");
    const narrowViewport = viewport.width <= 960;

    const expanded = await sidebarGeometry(page);
    expect(expanded.state).toBe("expanded");
    if (narrowViewport) {
      const expectedExpandedWidth = Math.min(320, viewport.width - (viewport.width <= 520 ? 32 : 48));
      expect(expanded.sidebarWidth).toBeCloseTo(expectedExpandedWidth, 0);
      expect(expanded.contentLeft).toBeCloseTo(0, 0);
    } else {
      expect(expanded.sidebarWidth).toBeGreaterThanOrEqual(235);
      expect(expanded.sidebarWidth).toBeLessThanOrEqual(237);
      expect(expanded.contentLeft).toBeGreaterThanOrEqual(235);
    }
    expect(expanded.sidebarPosition).toBe("fixed");
    expect(expanded.sidebarBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(expanded.sidebarBackgroundImage).not.toBe("none");
    expect(expanded.pageScrollWidth).toBeLessThanOrEqual(expanded.pageClientWidth + 1);
    expect(expanded.consentPresent).toBe(false);
    await expect(page.locator('img[src*="fanmind-social-avatar"]')).toBeHidden();
    await saveEvidence(page, testInfo, "sidebar-expanded");

    await page.getByRole("button", { name: "Sidebar einklappen" }).click();
    await expect(page.locator('[data-sidebar-state="collapsed"]')).toBeVisible();
    await page.waitForTimeout(240);

    const collapsed = await sidebarGeometry(page);
    expect(collapsed.state).toBe("collapsed");
    expect(collapsed.sidebarWidth).toBeGreaterThanOrEqual(75);
    expect(collapsed.sidebarWidth).toBeLessThanOrEqual(77);
    expect(collapsed.contentLeft).toBeGreaterThanOrEqual(75);
    expect(collapsed.sidebarPosition).toBe("fixed");
    expect(collapsed.sidebarBackgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    expect(collapsed.pageScrollWidth).toBeLessThanOrEqual(collapsed.pageClientWidth + 1);
    expect(collapsed.consentPresent).toBe(false);

    const avatar = page.locator('img[src*="fanmind-social-avatar"]');
    await expect(avatar).toBeVisible();
    await expect
      .poll(() =>
        avatar.evaluate((image) => ({
          complete: (image as HTMLImageElement).complete,
          width: (image as HTMLImageElement).naturalWidth,
          height: (image as HTMLImageElement).naturalHeight,
        })),
      )
      .not.toEqual({ complete: false, width: 0, height: 0 });
    const avatarSize = await avatar.evaluate((image) => ({
      width: (image as HTMLImageElement).naturalWidth,
      height: (image as HTMLImageElement).naturalHeight,
    }));
    expect(avatarSize.width).toBeGreaterThanOrEqual(48);
    expect(avatarSize.height).toBe(avatarSize.width);

    for (const expandedLink of expanded.links) {
      const collapsedLink = collapsed.links.find(
        (candidate) => candidate.label === expandedLink.label,
      );
      expect(collapsedLink, `${expandedLink.label} must remain present`).toBeDefined();
      expect(
        Math.abs((collapsedLink?.iconCenterX ?? 0) - expandedLink.iconCenterX),
        `${expandedLink.label} icon moved horizontally`,
      ).toBeLessThanOrEqual(0.75);
      expect(
        Math.abs((collapsedLink?.iconCenterY ?? 0) - expandedLink.iconCenterY),
        `${expandedLink.label} icon moved vertically`,
      ).toBeLessThanOrEqual(0.75);
      expect(
        Math.abs((collapsedLink?.linkTop ?? 0) - expandedLink.linkTop),
        `${expandedLink.label} row moved vertically`,
      ).toBeLessThanOrEqual(0.75);
      expect(collapsedLink?.linkHeight).toBeCloseTo(expandedLink.linkHeight, 0);
    }

    for (const label of NAVIGATION_LABELS) {
      const link = page.locator("[data-sidebar-link]").filter({ hasText: label }).first();
      const labelElement = link.locator("span").last();
      await expect(labelElement).toHaveCSS("opacity", "0");
      await expect(link).toHaveAttribute("aria-label", label);
    }

    await expect(page.getByRole("link", { name: "Nutzerprofil öffnen" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abmelden" })).toBeVisible();
    await saveEvidence(page, testInfo, "sidebar-collapsed");

    await page.getByRole("button", { name: "Sidebar ausklappen" }).click();
    await expect(page.locator('[data-sidebar-state="expanded"]')).toBeVisible();
    await page.waitForTimeout(240);
    const expandedAgain = await sidebarGeometry(page);

    for (const initialLink of expanded.links) {
      const finalLink = expandedAgain.links.find(
        (candidate) => candidate.label === initialLink.label,
      );
      expect(finalLink).toBeDefined();
      expect(Math.abs((finalLink?.iconCenterX ?? 0) - initialLink.iconCenterX)).toBeLessThanOrEqual(
        0.75,
      );
      expect(Math.abs((finalLink?.iconCenterY ?? 0) - initialLink.iconCenterY)).toBeLessThanOrEqual(
        0.75,
      );
    }
  });
});

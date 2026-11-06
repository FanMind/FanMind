import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const shellPath = "src/components/WorkspaceShell.tsx";
const sidebarCssPath = "src/components/WorkspaceSidebar.module.css";
const responsiveCssPath = "src/components/WorkspaceSidebarResponsive.module.css";
const navigationPath = "src/lib/workspaceNavigation.ts";
const socialAvatarPath = "public/assets/fanmind-social-avatar.png";
const previewPath = "src/app/sidebar-preview-e2e/page.tsx";
const browserWorkflowPath = ".github/workflows/browser-e2e.yml";

async function readShell() {
  return readFile(shellPath, "utf8");
}

test("workspace sidebar uses one DOM tree for expanded and collapsed navigation", async () => {
  const shell = await readShell();

  assert.match(shell, /import sidebarStyles from "\.\/WorkspaceSidebar\.module\.css"/u);
  assert.match(
    shell,
    /import responsiveStyles from "\.\/WorkspaceSidebarResponsive\.module\.css"/u,
  );
  assert.match(shell, /function SidebarItem\(/u);
  assert.equal((shell.match(/<aside\b/gu) ?? []).length, 1);
  assert.equal((shell.match(/<FanMindFunctionIcon\b/gu) ?? []).length, 1);
  assert.equal(
    (shell.match(/collapsed=\{sidebarCollapsed\}/gu) ?? []).length,
    3,
    "every navigation group must use the same item renderer and state",
  );
  assert.doesNotMatch(shell, /compactNavigation|compactNavList|compactSidebarFooter/u);
  assert.doesNotMatch(shell, /sidebarCollapsed\s*\?\s*\(\s*<>/u);
  assert.match(shell, /data-sidebar-state=\{sidebarCollapsed \? "collapsed" : "expanded"\}/u);
  assert.match(
    shell,
    /href=\{sidebarCollapsed \? undefined : "\/dashboard"\}/u,
    "the hidden expanded wordmark must leave the tab order immediately",
  );
});

test("workspace navigation keeps the canonical sidebar order and icon keys", async () => {
  const navigation = await readFile(navigationPath, "utf8");
  const expectedSequence = [
    ["Dashboard", "dashboard"],
    ["Fans", "contacts"],
    ["Follow-ups", "followups"],
    ["Kanäle", "channels"],
    ["Profil & Konto", "profile"],
    ["Top Fans", "topFans"],
    ["Reaktivierung", "reactivation"],
  ];

  let previousIndex = -1;
  for (const [label, icon] of expectedSequence) {
    const labelIndex = navigation.indexOf(label);
    const iconIndex = navigation.indexOf(`icon: "${icon}"`, labelIndex);

    assert.notEqual(labelIndex, -1, `${label} is missing from workspace navigation`);
    assert.ok(labelIndex > previousIndex, `${label} is out of order`);
    assert.ok(iconIndex > labelIndex, `${label} must keep icon key ${icon}`);
    previousIndex = labelIndex;
  }
});

test("workspace account shortcuts stay out of expanded and collapsed sidebar navigation", async () => {
  const navigation = await readFile(navigationPath, "utf8");

  assert.doesNotMatch(navigation, /label: locale === "en" \? "AI usage" : "KI-Nutzung"/u);
  assert.doesNotMatch(navigation, /href: "\/settings\/ai-usage"/u);
  assert.doesNotMatch(navigation, /icon: "usage"/u);
  assert.doesNotMatch(navigation, /label: locale === "en" \? "Recommendations" : "Empfehlungen"/u);
  assert.doesNotMatch(navigation, /href: "\/settings\/referral"/u);
  assert.doesNotMatch(navigation, /icon: "referral"/u);
});

test("collapsed sidebar preserves the same left icon rail and group geometry", async () => {
  const css = await readFile(sidebarCssPath, "utf8");

  assert.match(css, /--sidebar-inline-gutter: 14px;/u);
  assert.match(css, /--sidebar-icon-rail: 44px;/u);
  assert.match(
    css,
    /\.sidebar \{[\s\S]*padding: 16px var\(--sidebar-inline-gutter\);/u,
  );
  assert.match(
    css,
    /\.sidebarCollapsed \{[\s\S]*width: var\(--sidebar-collapsed-width\);[\s\S]*max-width: var\(--sidebar-collapsed-width\);[\s\S]*\}/u,
  );
  assert.doesNotMatch(
    css,
    /\.sidebarCollapsed \{[^}]*padding/u,
    "collapsed state must not move the shared left gutter",
  );
  assert.match(
    css,
    /\.navItemLead \{[\s\S]*grid-template-columns: var\(--sidebar-icon-rail\) minmax\(0, 1fr\);/u,
  );
  assert.match(
    css,
    /\.navIconSlot \{[\s\S]*width: var\(--sidebar-icon-rail\);[\s\S]*place-items: center;/u,
  );
  assert.match(
    css,
    /\.sidebarCollapsed \.navSectionLabel \{[\s\S]*opacity: 0;[\s\S]*\}/u,
    "section labels must become invisible without removing their geometry",
  );
  assert.doesNotMatch(css, /justify-items: center;[\s\S]*compactNav/u);
});

test("narrow web viewports use a dark fixed overlay and reserve the collapsed rail", async () => {
  const [shell, responsiveCss] = await Promise.all([
    readShell(),
    readFile(responsiveCssPath, "utf8"),
  ]);

  assert.match(shell, /responsiveStyles\.shell/u);
  assert.match(shell, /responsiveStyles\.shellCollapsed/u);
  assert.match(shell, /responsiveStyles\.sidebarSurface/u);
  assert.match(shell, /responsiveStyles\.content/u);
  assert.match(
    responsiveCss,
    /\.sidebarSurface \{[\s\S]*linear-gradient\(180deg,[\s\S]*#020617 !important;/u,
  );
  assert.match(
    responsiveCss,
    /@media \(max-width: 960px\) \{[\s\S]*\.shell \{[\s\S]*grid-template-columns: 0 minmax\(0, 1fr\) !important;/u,
  );
  assert.match(
    responsiveCss,
    /\.shellCollapsed \{[\s\S]*grid-template-columns: 76px minmax\(0, 1fr\) !important;/u,
  );
  assert.match(
    responsiveCss,
    /\.content \{[\s\S]*grid-column: 2 !important;[\s\S]*min-width: 0;/u,
  );
  assert.match(
    responsiveCss,
    /--sidebar-width: min\(320px, calc\(100vw - 48px\)\);/u,
  );
});

test("collapsed branding uses the supplied circular FanMind social avatar", async () => {
  const [shell, avatar] = await Promise.all([
    readShell(),
    readFile(socialAvatarPath),
  ]);

  assert.match(shell, /src="\/assets\/fanmind-social-avatar\.png"/u);
  assert.match(shell, /className=\{sidebarStyles\.brandAvatar\}/u);
  assert.doesNotMatch(shell, /compactBrandFan|compactBrandMind/u);

  assert.deepEqual(
    [...avatar.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    "social avatar must remain a PNG",
  );
  assert.equal(avatar.readUInt32BE(16), 96);
  assert.equal(avatar.readUInt32BE(20), 96);
});

test("profile and logout actions remain present in both sidebar states", async () => {
  const shell = await readShell();
  const css = await readFile(sidebarCssPath, "utf8");

  assert.match(shell, /userMiniCardCollapsed/u);
  assert.match(shell, /logoutButtonCollapsed/u);
  assert.match(shell, /aria-label=\{logoutLabel\}/u);
  assert.match(
    css,
    /\.userMiniCardCollapsed \.userMiniCardCopy \{[\s\S]*opacity: 0;/u,
  );
  assert.match(
    css,
    /\.logoutButtonCollapsed \.logoutLabel \{[\s\S]*opacity: 0;/u,
  );
});

test("synthetic sidebar preview is enabled only inside the browser E2E job", async () => {
  const [preview, workflow] = await Promise.all([
    readFile(previewPath, "utf8"),
    readFile(browserWorkflowPath, "utf8"),
  ]);

  assert.match(preview, /import \{ notFound \} from "next\/navigation"/u);
  assert.match(preview, /export const dynamic = "force-dynamic"/u);
  assert.match(
    preview,
    /process\.env\.FANMIND_ENABLE_SIDEBAR_PREVIEW_E2E !== "true"/u,
  );
  assert.match(preview, /notFound\(\)/u);
  assert.match(workflow, /FANMIND_ENABLE_SIDEBAR_PREVIEW_E2E: "true"/u);
  assert.doesNotMatch(preview, /NEXT_PUBLIC_FANMIND_ENABLE_SIDEBAR_PREVIEW_E2E/u);
});

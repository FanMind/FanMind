import assert from "node:assert/strict";
import test from "node:test";
import { access, readFile } from "node:fs/promises";

const layoutPath = "src/app/layout.tsx";
const workspaceShellPath = "src/components/WorkspaceShell.tsx";
const socialAvatarPath = "public/assets/fanmind-social-avatar.png";
const removedBrowserIconPaths = [
  "src/app/favicon.ico",
  "src/app/icon.tsx",
  "src/app/apple-icon.tsx",
  "src/lib/fanmindBrowserIcon.tsx",
];

test("browser, Apple and collapsed-sidebar branding use the exact same social-avatar asset", async () => {
  const [layout, workspaceShell, socialAvatar] = await Promise.all([
    readFile(layoutPath, "utf8"),
    readFile(workspaceShellPath, "utf8"),
    readFile(socialAvatarPath),
  ]);

  assert.match(
    layout,
    /browserIconRevision = "fanmind-social-avatar-exact-20260725"/u,
  );
  assert.match(
    layout,
    /browserIconAsset = `\/assets\/fanmind-social-avatar\.png\?v=\$\{browserIconRevision\}`/u,
  );
  assert.equal(
    (layout.match(/url: browserIconAsset/gu) ?? []).length,
    3,
    "icon, shortcut and Apple metadata must share the exact same confirmed asset",
  );
  assert.equal(
    (layout.match(/sizes: "96x96"/gu) ?? []).length,
    3,
    "all declared icon variants must describe the real 96x96 source asset honestly",
  );
  assert.match(workspaceShell, /src="\/assets\/fanmind-social-avatar\.png"/u);

  assert.deepEqual(
    [...socialAvatar.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    "the confirmed social avatar must remain a PNG",
  );
  assert.equal(socialAvatar.readUInt32BE(16), 96);
  assert.equal(socialAvatar.readUInt32BE(20), 96);
});

test("no generated or obsolete browser icon source competes with the confirmed social avatar", async () => {
  for (const path of removedBrowserIconPaths) {
    await assert.rejects(
      access(path),
      /ENOENT/u,
      `${path} must stay absent so browsers receive only the confirmed social avatar`,
    );
  }
});

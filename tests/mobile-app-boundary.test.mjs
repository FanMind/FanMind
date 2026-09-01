import assert from "node:assert/strict";
import test from "node:test";
import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createReplyShareContent,
  ReplySharePolicyError,
} from "../apps/mobile/src/lib/replySharePolicy.mjs";

const root = new URL("../", import.meta.url);
const mobileRoot = new URL("../apps/mobile/", import.meta.url);
const rootPath = fileURLToPath(root);
const mobileRootPath = fileURLToPath(mobileRoot);
const packageJson = JSON.parse(await readFile(new URL("package.json", mobileRoot), "utf8"));
const appConfig = JSON.parse(await readFile(new URL("app.json", mobileRoot), "utf8"));
const mobileCi = await readFile(new URL("../.github/workflows/ci-mobile.yml", import.meta.url), "utf8");
const mobileReadme = await readFile(new URL("README.md", mobileRoot), "utf8");
const mobileBetaRelease = await readFile(
  new URL("../docs/mobile/BETA_RELEASE.md", import.meta.url),
  "utf8",
);
const mobileStoreListing = await readFile(
  new URL("../docs/mobile/STORE_LISTING.md", import.meta.url),
  "utf8",
);
const webTsconfig = await readFile(new URL("../tsconfig.json", import.meta.url), "utf8");
const webEslint = await readFile(new URL("../eslint.config.mjs", import.meta.url), "utf8");

async function pngHeader(relativePath) {
  const image = await readFile(new URL(relativePath, mobileRoot));
  assert.deepEqual(
    [...image.subarray(0, 8)],
    [137, 80, 78, 71, 13, 10, 26, 10],
    `${relativePath} must be a PNG`,
  );
  assert.equal(image.subarray(12, 16).toString("ascii"), "IHDR");
  return {
    width: image.readUInt32BE(16),
    height: image.readUInt32BE(20),
    bitDepth: image[24],
    colorType: image[25],
  };
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && entry.name !== "node_modules") {
      output.push(...await sourceFiles(path));
    }
    else if (/\.(?:ts|tsx|js|json)$/.test(entry.name)) output.push(path);
  }
  return output;
}

const files = await sourceFiles(mobileRootPath);
const runtimeFiles = files.filter((file) => /[\\/](?:app|src)[\\/]/.test(file));
const runtimeSource = await Promise.all(runtimeFiles.map(async (file) => ({
  file: relative(rootPath, file),
  content: await readFile(file, "utf8"),
})));

test("mobile is a separate Expo package and not a Next application", () => {
  assert.equal(packageJson.name, "@fanmind/mobile");
  assert.equal(packageJson.main, "expo-router/entry");
  assert.match(packageJson.dependencies.expo, /^~57\./);
  assert.equal(packageJson.dependencies.next, undefined);
  assert.equal(packageJson.dependencies["react-dom"], packageJson.dependencies.react);
  assert.equal(packageJson.engines.node, ">=22.13.0");
});

test("Android, iOS and deep-link identities are independent and explicit", () => {
  assert.equal(appConfig.expo.scheme, "fanmind");
  assert.equal(appConfig.expo.ios.bundleIdentifier, "ch.fanmind.app");
  assert.equal(appConfig.expo.ios.supportsTablet, false);
  assert.equal(appConfig.expo.android.package, "ch.fanmind.app");
  assert.equal(appConfig.expo.userInterfaceStyle, "dark");
});

test("mobile uses the square FM-over-wordmark splash and dedicated high-resolution app icons", async () => {
  const splashPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-splash-screen",
  );

  assert.ok(splashPlugin);
  assert.equal(packageJson.dependencies["expo-splash-screen"], "~57.0.8");
  assert.equal(splashPlugin[1].image, "./assets/branding/fanmind-splash.png");
  assert.equal(splashPlugin[1].dark, undefined);
  assert.equal(splashPlugin[1].resizeMode, "contain");
  assert.equal(splashPlugin[1].imageWidth, 280);
  assert.equal(
    appConfig.expo.icon,
    "./assets/branding/fanmind-app-icon.png",
  );
  assert.equal(
    appConfig.expo.android.adaptiveIcon.foregroundImage,
    "./assets/branding/fanmind-adaptive-icon.png",
  );
  assert.equal(appConfig.expo.android.adaptiveIcon.backgroundColor, "#06142c");

  assert.deepEqual(
    await pngHeader("assets/branding/fanmind-splash.png"),
    { width: 1024, height: 1024, bitDepth: 8, colorType: 6 },
  );
  const splashSource = await readFile(
    new URL("assets/branding/fanmind-splash-source.svg", mobileRoot),
    "utf8",
  );
  assert.match(splashSource, /aria-label="FM"/u);
  assert.match(splashSource, />Fan</u);
  assert.match(splashSource, />Mind</u);
  assert.deepEqual(
    await pngHeader("assets/branding/fanmind-app-icon.png"),
    { width: 1024, height: 1024, bitDepth: 8, colorType: 2 },
  );
  assert.deepEqual(
    await pngHeader("assets/branding/fanmind-adaptive-icon.png"),
    { width: 1024, height: 1024, bitDepth: 8, colorType: 6 },
  );
  assert.match(mobileBetaRelease, /eigenständige 1024 × 1024 Pixel große Icon-Quelle/u);
  assert.match(mobileStoreListing, /finale FanMind-App-Icon ist vorbereitet/u);
});

test("store metadata remains human-controlled and contains no integration promise", () => {
  assert.match(mobileStoreListing, /Du prüfst jeden Vorschlag selbst/u);
  assert.match(mobileStoreListing, /not an auto-sending bot/u);
  assert.match(mobileStoreListing, /https:\/\/fanmind\.ch\/datenschutz/u);
  assert.match(mobileStoreListing, /https:\/\/fanmind\.ch\/account-deletion/u);
  assert.doesNotMatch(
    mobileStoreListing,
    /aktive (?:Instagram|TikTok|WhatsApp|Facebook|Discord)-Integration/iu,
  );
  assert.match(
    mobileStoreListing,
    /im ersten\s+iOS-Release ausschließlich iPhone/iu,
  );
  assert.doesNotMatch(mobileStoreListing, /Tablet-Screenshots werden nur erstellt/iu);
});

test("mobile runtime never imports Website, Next.js, CSS modules or WebView", () => {
  for (const { file, content } of runtimeSource) {
    assert.doesNotMatch(content, /from\s+["'][^"']*src\/(?:app|components)/, file);
    assert.doesNotMatch(content, /from\s+["']next(?:\/|["'])/, file);
    assert.doesNotMatch(content, /\.module\.css|WebView|react-native-webview/, file);
  }
});

test("mobile runtime contains no server-side secret identifiers", async () => {
  for (const { file, content } of runtimeSource) {
    assert.doesNotMatch(
      content,
      /SUPABASE_SERVICE_ROLE_KEY|OPENAI_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|sk_live_|sk_test_/,
      file,
    );
  }
  const envExample = await readFile(new URL(".env.example", mobileRoot), "utf8");
  assert.match(envExample, /EXPO_PUBLIC_SUPABASE_ANON_KEY/);
  assert.doesNotMatch(envExample, /SERVICE_ROLE|OPENAI_API_KEY|STRIPE_SECRET_KEY/);
});

test("mobile session uses SecureStore and AI uses server Bearer authentication", async () => {
  const secureStorage = await readFile(new URL("src/lib/secureStorage.ts", mobileRoot), "utf8");
  const api = await readFile(new URL("src/lib/api.ts", mobileRoot), "utf8");
  assert.match(secureStorage, /expo-secure-store/);
  assert.match(secureStorage, /WHEN_UNLOCKED_THIS_DEVICE_ONLY/);
  assert.match(secureStorage, /CHUNK_SIZE/);
  assert.match(api, /Authorization: `Bearer \$\{input\.accessToken\}`/);
  assert.match(api, /\/api\/ai\/reply-suggestions/);
  assert.match(api, /\/api\/ai\/fan-analysis/);
  assert.doesNotMatch(api, /OPENAI_API_KEY/);
});

test("no automatic sending is present in the mobile product", () => {
  const allSource = runtimeSource.map(({ content }) => content).join("\n");
  assert.match(allSource, /Keine automatische Sendefunktion/);
  assert.doesNotMatch(allSource, /sendMessage\(|\/send-message|automatisch senden/i);
});

test("native reply sharing exposes only the selected text and remains user-controlled", async () => {
  assert.deepEqual(createReplyShareContent("  Hallo Sandra!  "), {
    message: "Hallo Sandra!",
  });
  assert.throws(
    () => createReplyShareContent("   "),
    (error) =>
      error instanceof ReplySharePolicyError && error.code === "empty_reply",
  );
  assert.throws(
    () => createReplyShareContent({ message: "unsafe" }),
    (error) =>
      error instanceof ReplySharePolicyError && error.code === "invalid_reply",
  );

  const detail = await readFile(
    new URL("app/(app)/contacts/[id].tsx", mobileRoot),
    "utf8",
  );
  const sharePolicy = await readFile(
    new URL("src/lib/replySharePolicy.mjs", mobileRoot),
    "utf8",
  );

  assert.match(detail, /Share\.share\(createReplyShareContent\(text\)/u);
  assert.match(detail, /Du wählst und sendest final selbst/u);
  assert.match(detail, /Nativ teilen/u);
  assert.doesNotMatch(
    sharePolicy,
    /contact|workspace|handle|memory|note|token|url|title|subject/iu,
  );
});

test("mobile uses completed as canonical follow-up status and still hides legacy done rows", async () => {
  const data = await readFile(new URL("src/lib/data.ts", mobileRoot), "utf8");
  const statusPolicy = await readFile(
    new URL("src/lib/followupStatus.ts", mobileRoot),
    "utf8",
  );

  assert.match(statusPolicy, /CANONICAL_COMPLETED_FOLLOWUP_STATUS = "completed"/u);
  assert.match(statusPolicy, /LEGACY_COMPLETED_FOLLOWUP_STATUS = "done"/u);
  assert.match(
    statusPolicy,
    /OPEN_FOLLOWUP_FILTER[\s\S]*status\.is\.null,status\.not\.in\.\$\{COMPLETED_FOLLOWUP_FILTER\}/u,
  );
  assert.match(data, /\.or\(OPEN_FOLLOWUP_FILTER\)/u);
  assert.match(data, /update\(\{ status: CANONICAL_COMPLETED_FOLLOWUP_STATUS \}\)/u);
  assert.doesNotMatch(data, /\.neq\("status", "done"\)/u);
  assert.doesNotMatch(data, /update\(\{ status: "done" \}\)/u);
});

test("Mobile is an explicit active product stream and TestFlight is Phase 8", async () => {
  const [readme, sourceOfTruth, agents, roadmap] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../docs/SOURCE_OF_TRUTH.md", import.meta.url), "utf8"),
    readFile(new URL("../AGENTS.md", import.meta.url), "utf8"),
    readFile(new URL("../src/config/roadmap.ts", import.meta.url), "utf8"),
  ]);

  assert.match(readme, /## Mobile-App/u);
  assert.match(readme, /Signierte Builds und Store-Verteilung bleiben separat abzunehmen/u);
  assert.match(sourceOfTruth, /## 3\. Eigenständige Mobile-App/u);
  assert.match(sourceOfTruth, /kanonischen Status `completed`/u);
  assert.match(agents, /## Mobile product boundary/u);
  assert.match(agents, /canonical completed follow-up status is `completed`/u);
  assert.match(roadmap, /title: "Mobile-App für Android & iOS"/u);
  assert.match(roadmap, /Signierter interner Android-Build/u);

  const phase6Start = roadmap.indexOf('phase: "Phase 6"');
  const phase7Start = roadmap.indexOf('phase: "Phase 7"');
  const phase8Start = roadmap.indexOf('phase: "Phase 8"');
  const phase9Start = roadmap.indexOf('phase: "Phase 9"');
  assert.ok(phase6Start >= 0 && phase7Start > phase6Start);
  assert.ok(phase8Start > phase7Start && phase9Start > phase8Start);
  assert.doesNotMatch(roadmap.slice(phase6Start, phase7Start), /iOS-TestFlight/u);
  assert.match(roadmap.slice(phase8Start, phase9Start), /iOS-TestFlight/u);
  assert.match(roadmap.slice(phase8Start, phase9Start), /Aus Phase 6 verschoben · Phase 8/u);
});

test("Web and Mobile have separate compiler and CI boundaries", () => {
  assert.match(webTsconfig, /"apps\/mobile"/);
  assert.match(webEslint, /apps\/mobile\/\*\*/);
  assert.match(mobileCi, /FanMind Mobile CI/);
  assert.match(mobileCi, /working-directory: apps\/mobile/);
  assert.match(mobileCi, /Build Android JavaScript bundle/);
  assert.match(mobileCi, /Build iOS JavaScript bundle/);
  assert.match(mobileCi, /Verify Android and iOS native prebuild/);
  assert.match(mobileReadme, /keine umverpackte Website/i);
  assert.match(mobileReadme, /eigene Releases/i);
});

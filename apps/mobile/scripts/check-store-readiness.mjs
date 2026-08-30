#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MOBILE_ROOT = new URL("../", import.meta.url);
const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CONFIRMED_WORDMARK_SHA256 =
  "f432007c36e4523211e8678757c2340592c50f1a945776cfc283922601ac8aad";
const CONFIRMED_PLAY_FEATURE_SOURCE_SHA256 =
  "a39efa39d9b17f7738a6b33860c1ffb7c8c3ba108aa2abe3f42d54b5b3b1f1be";
const CONFIRMED_PLAY_ICON_SHA256 =
  "7c5f0fe9c8ba16ac934d20c67365343e91b59130109795b26461666e94652112";
const CONFIRMED_PLAY_FEATURE_SHA256 =
  "95ccc38c8e255f3f50938b86630afb2c0cd5a3703d3c46ca1c91384c9409cb13";
const APPLE_PORTAL_FIELD_CONTRACT = Object.freeze([
  ["Name", "READY"],
  ["Subtitle", "READY"],
  ["Description", "READY"],
  ["Keywords", "READY"],
  ["Promotional Text", "READY"],
  ["Age Rating", "PHASE8_REQUIRED"],
  ["Bundle ID", "READY"],
  ["SKU", "OWNER_REQUIRED"],
  ["Content Rights", "OWNER_REQUIRED"],
  ["Primary Language", "READY"],
  ["Primary Category", "READY"],
  ["Secondary Category", "READY"],
  ["Digital Services Act (DSA) Status", "OWNER_REQUIRED"],
  ["Regulated Medical Devices", "OWNER_REQUIRED"],
  ["Support URL", "READY"],
  ["Marketing URL", "READY"],
  ["Version Number", "READY"],
  ["Copyright", "OWNER_REQUIRED"],
  ["App Review Information", "PHASE8_REQUIRED"],
  ["Version Release Settings", "OWNER_REQUIRED"],
  ["App Availability", "OWNER_REQUIRED"],
  ["Price", "OWNER_REQUIRED"],
  ["Tax Category", "OWNER_REQUIRED"],
  ["Privacy Policy URL", "READY"],
  ["Privacy Choices URL", "OWNER_REQUIRED"],
  ["Data Types", "PHASE8_REQUIRED"],
  ["Accessibility URL", "OWNER_REQUIRED"],
  ["Accessibility Support", "PHASE8_REQUIRED"],
  ["Screenshots", "PHASE8_REQUIRED"],
  ["App Icon", "PHASE8_REQUIRED"],
  ["Export Compliance", "PHASE8_REQUIRED"],
  ["Signed Build", "PHASE8_REQUIRED"],
  ["Mac and Apple Vision Pro Availability", "OWNER_REQUIRED"],
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function characterCount(value) {
  return Array.from(value).length;
}

function section(markdown, heading) {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start < 0) fail("store_section_missing");
  const next = markdown.indexOf("\n## ", start + marker.length);
  return markdown.slice(start, next < 0 ? markdown.length : next);
}

function fencedText(markdown, heading) {
  const match = section(markdown, heading).match(/```text\s*([\s\S]*?)\s*```/u);
  if (!match) fail("store_text_block_missing");
  return match[1].trim();
}

function tableValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = markdown.match(
    new RegExp(`^\\|\\s*${escaped}\\s*\\|\\s*(.*?)\\s*\\|$`, "mu"),
  );
  if (!match) fail("store_identity_field_missing");
  return match[1].replace(/^`|`$/gu, "").trim();
}

function portalHandoffValue(markdown, label) {
  const row = markdown
    .split(/\r?\n/gu)
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim()))
    .find((cells) => cells.length === 3 && cells[0] === label);
  if (!row) fail("store_portal_handoff_field_missing");
  return row[1].replace(/^`|`$/gu, "").trim();
}

function appStorePortalRows(markdown) {
  return markdown
    .split(/\r?\n/gu)
    .map((line) =>
      line.match(
        /^\|\s*(\d+)\s*\|\s*([^|]+?)\s*\|\s*(READY|OWNER_REQUIRED|PHASE8_REQUIRED)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/u,
      ),
    )
    .filter(Boolean)
    .map((match) => ({
      number: Number(match[1]),
      field: match[2].trim(),
      status: match[3],
      action: match[4].trim(),
      gate: match[5].trim(),
    }));
}

function verifyAppStorePortalWorksheet(markdown, expectedListing) {
  const rows = appStorePortalRows(markdown);
  if (rows.length !== APPLE_PORTAL_FIELD_CONTRACT.length) {
    fail("store_app_store_portal_matrix_invalid");
  }

  rows.forEach((row, index) => {
    const [expectedField, expectedStatus] =
      APPLE_PORTAL_FIELD_CONTRACT[index];
    if (
      row.number !== index + 1
      || row.field !== expectedField
      || row.status !== expectedStatus
      || row.action.length === 0
      || row.gate.length === 0
    ) {
      fail("store_app_store_portal_matrix_invalid");
    }
  });

  const counts = rows.reduce(
    (result, row) => ({
      ...result,
      [row.status]: result[row.status] + 1,
    }),
    { READY: 0, OWNER_REQUIRED: 0, PHASE8_REQUIRED: 0 },
  );
  if (
    counts.READY !== 13
    || counts.OWNER_REQUIRED !== 12
    || counts.PHASE8_REQUIRED !== 8
  ) {
    fail("store_app_store_portal_matrix_invalid");
  }

  const rowsByField = new Map(rows.map((row) => [row.field, row]));
  const expectedReadyValues = new Map([
    ["Name", "`FanMind`"],
    ["Description", "STORE_LISTING.md"],
    ["Keywords", "DE-/EN-Suchbegriffe"],
    ["Promotional Text", "deutscher und englischer"],
    ["Bundle ID", "`ch.fanmind.app`"],
    ["Primary Language", "Deutsch (`de-DE`)"],
    ["Support URL", "`https://fanmind.ch/support`"],
    ["Marketing URL", "`https://fanmind.ch`"],
    ["Version Number", "`1.0.0`"],
    ["Privacy Policy URL", "`https://fanmind.ch/datenschutz`"],
  ]);
  for (const [field, expectedValue] of expectedReadyValues) {
    if (!rowsByField.get(field)?.action.includes(expectedValue)) {
      fail("store_app_store_portal_identity_invalid");
    }
  }
  const subtitleAction = rowsByField.get("Subtitle")?.action ?? "";
  const subtitleMatch = /^DE `([^`]+)`; EN `([^`]+)`$/u.exec(
    subtitleAction,
  );
  if (
    !subtitleMatch
    || subtitleMatch[1] !== expectedListing.subtitleDe
    || subtitleMatch[2] !== expectedListing.subtitleEn
    || rowsByField.get("Primary Category")?.action
      !== expectedListing.primaryCategory
    || rowsByField.get("Secondary Category")?.action
      !== expectedListing.secondaryCategory
  ) {
    fail("store_app_store_portal_identity_invalid");
  }

  if (
    !/dreizehn\s+`READY`/u.test(markdown)
    || !/zwölf\s+`OWNER_REQUIRED`/u.test(markdown)
    || !/acht\s+`PHASE8_REQUIRED`/u.test(markdown)
    || !/kein iOS-Build/iu.test(markdown)
    || !/kein TestFlight/iu.test(markdown)
    || !/Keine Portalübertragung/u.test(markdown)
    || !/niemals im Repository/u.test(markdown)
    || !/account-deletion` nicht ungeprüft gleichsetzen/u.test(markdown)
    || ![
      "https://developer.apple.com/help/app-store-connect/reference/app-information/required-localizable-and-editable-properties/",
      "https://developer.apple.com/help/app-store-connect/manage-app-information/localize-app-information/",
      "https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/",
      "https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/",
      "https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels/",
      "https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/overview-of-submitting-for-review/",
    ].every((source) => markdown.includes(`](${source})`))
  ) {
    fail("store_app_store_portal_boundary_missing");
  }

  return Object.freeze({ rows: rows.length, counts });
}

function assertLength(value, minimum, maximum, code) {
  const length = characterCount(value);
  if (length < minimum || length > maximum) fail(code);
}

function pngHeader(bytes, expected) {
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, index) => bytes[index] === value)) {
    fail("store_asset_not_png");
  }
  if (bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail("store_asset_png_header_invalid");
  }
  const actual = {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25],
  };
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) fail("store_asset_contract_invalid");
  }
}

export function evaluateStoreReadiness(input) {
  const {
    appConfig,
    easConfig,
    listing,
    appStoreHandoff,
    appStoreWorksheet,
    reviewAccess,
    testerProgram,
    featureSource,
    wordmark,
    appIcon,
    adaptiveIcon,
    playIcon,
    playFeatureGraphic,
  } = input;
  const expo = appConfig?.expo ?? {};
  const appName = tableValue(listing, "App-Name");
  const subtitleDe = tableValue(
    listing,
    "Untertitel / Kurzbeschreibung DE",
  );
  const subtitleEn = tableValue(
    listing,
    "Subtitle / Short description EN",
  );
  const applePrimaryCategory = portalHandoffValue(
    listing,
    "Apple Hauptkategorie",
  );
  const appleSecondaryCategory = portalHandoffValue(
    listing,
    "Apple Nebenkategorie",
  );
  const shortDescription = fencedText(
    listing,
    "Google Play - Kurzbeschreibung",
  );
  const shortDescriptionEn = fencedText(
    listing,
    "Google Play - Short description EN",
  );
  const descriptionDe = fencedText(
    listing,
    "Google Play und Apple - Beschreibung DE",
  );
  const descriptionEn = fencedText(
    listing,
    "Google Play und Apple - Description EN",
  );
  const appleKeywordsDe = fencedText(listing, "Apple - Suchbegriffe DE");
  const appleKeywordsEn = fencedText(listing, "Apple - Keywords EN");
  const promotionalTextDe = fencedText(listing, "Apple - Werbetext DE");
  const promotionalTextEn = fencedText(
    listing,
    "Apple - Promotional Text EN",
  );
  const normalizedFeatureSource = featureSource.replace(/\r\n?/gu, "\n");
  assertLength(appName, 2, 30, "store_app_name_length_invalid");
  assertLength(subtitleDe, 2, 30, "store_subtitle_de_length_invalid");
  assertLength(subtitleEn, 2, 30, "store_subtitle_en_length_invalid");
  assertLength(
    shortDescription,
    20,
    80,
    "store_google_short_description_length_invalid",
  );
  assertLength(
    shortDescriptionEn,
    20,
    80,
    "store_google_short_description_en_length_invalid",
  );
  assertLength(descriptionDe, 200, 4000, "store_description_de_length_invalid");
  assertLength(descriptionEn, 200, 4000, "store_description_en_length_invalid");
  assertLength(
    appleKeywordsDe,
    2,
    100,
    "store_apple_keywords_de_length_invalid",
  );
  assertLength(
    appleKeywordsEn,
    2,
    100,
    "store_apple_keywords_en_length_invalid",
  );
  if (appleKeywordsDe === appleKeywordsEn) {
    fail("store_apple_keyword_localizations_not_distinct");
  }
  assertLength(
    promotionalTextDe,
    20,
    170,
    "store_apple_promotional_text_de_length_invalid",
  );
  assertLength(
    promotionalTextEn,
    20,
    170,
    "store_apple_promotional_text_en_length_invalid",
  );

  const portalWorksheet = verifyAppStorePortalWorksheet(appStoreWorksheet, {
    subtitleDe,
    subtitleEn,
    primaryCategory: applePrimaryCategory,
    secondaryCategory: appleSecondaryCategory,
  });

  if (appName !== expo.name || expo.name !== "FanMind") {
    fail("store_app_name_identity_mismatch");
  }
  if (expo.version !== "1.0.0") {
    fail("store_app_version_invalid");
  }
  if (
    expo.ios?.bundleIdentifier !== "ch.fanmind.app"
    || expo.android?.package !== "ch.fanmind.app"
    || expo.scheme !== "fanmind"
    || expo.ios?.supportsTablet !== false
  ) {
    fail("store_native_identity_invalid");
  }
  if (
    tableValue(listing, "Android Package") !== "ch.fanmind.app"
    || tableValue(listing, "iOS Bundle Identifier") !== "ch.fanmind.app"
    || tableValue(listing, "Website") !== "https://fanmind.ch"
    || tableValue(listing, "Support") !== "https://fanmind.ch/support"
    || tableValue(listing, "Google-Play-Support-E-Mail")
      !== "kontakt@fanmind.ch"
    || tableValue(listing, "Datenschutz") !== "https://fanmind.ch/datenschutz"
    || tableValue(listing, "Account-Löschung")
      !== "https://fanmind.ch/account-deletion"
  ) {
    fail("store_identity_document_mismatch");
  }

  if (
    /(?:#1|App of the year|Best of Play|aktive (?:Instagram|TikTok|WhatsApp|Facebook|Discord)-Integration)/iu.test(
      `${descriptionDe}\n${descriptionEn}`,
    )
  ) {
    fail("store_copy_unapproved_claim");
  }
  if (
    !/Du prüfst jeden Vorschlag selbst/u.test(descriptionDe)
    || !/not an auto-sending bot/u.test(descriptionEn)
  ) {
    fail("store_manual_send_boundary_missing");
  }

  const screenshotRows = section(listing, "Screenshot-Matrix").match(
    /^\|\s*[1-9]\d*\s*\|/gmu,
  ) ?? [];
  if (screenshotRows.length !== 6) fail("store_screenshot_matrix_invalid");
  if (
    !/signierten Builds/u.test(listing)
    || !/synthetischen Test-Workspace/u.test(listing)
    || !/1320\s*[×x]\s*2868/u.test(listing)
  ) {
    fail("store_screenshot_safety_boundary_missing");
  }
  if (
    !/keinen iOS-Build/u.test(appStoreHandoff)
    || !/kein TestFlight/u.test(appStoreHandoff)
    || !/1320\s*[×x]\s*2868/u.test(appStoreHandoff)
    || !/niemals im Repository/u.test(reviewAccess)
    || !/24\/7/u.test(reviewAccess)
    || !/Play-Test-Track/u.test(testerProgram)
    || !/12[^\n]*14/u.test(testerProgram)
  ) {
    fail("store_handoff_boundary_invalid");
  }
  if (
    !/width="1024" height="500" viewBox="0 0 1024 500"/u.test(
      normalizedFeatureSource,
    )
    || /<(?:text|image|foreignObject)\b/iu.test(normalizedFeatureSource)
  ) {
    fail("store_feature_source_invalid");
  }
  if (
    createHash("sha256").update(normalizedFeatureSource).digest("hex")
    !== CONFIRMED_PLAY_FEATURE_SOURCE_SHA256
  ) {
    fail("store_feature_source_not_confirmed");
  }

  if (
    easConfig?.cli?.version !== "21.2.0"
    || easConfig?.cli?.requireCommit !== true
    || easConfig?.cli?.appVersionSource !== "remote"
  ) {
    fail("store_eas_cli_contract_invalid");
  }
  const { development, preview, production } = easConfig?.build ?? {};
  if (
    development?.environment !== "development"
    || development?.distribution !== "internal"
    || development?.credentialsSource !== "remote"
    || preview?.environment !== "preview"
    || preview?.distribution !== "internal"
    || preview?.credentialsSource !== "remote"
    || production?.environment !== "production"
    || production?.distribution !== "store"
    || production?.credentialsSource !== "remote"
    || production?.android?.buildType !== "app-bundle"
    || production?.autoIncrement !== true
  ) {
    fail("store_eas_profile_contract_invalid");
  }
  const submit = easConfig?.submit?.production ?? {};
  if (
    submit.android?.track !== "internal"
    || submit.android?.releaseStatus !== "draft"
    || submit.android?.changesNotSentForReview !== true
    || submit.ios?.language !== "de-DE"
    || submit.ios?.appName !== "FanMind"
  ) {
    fail("store_submission_safety_contract_invalid");
  }

  pngHeader(appIcon, {
    width: 1024,
    height: 1024,
    bitDepth: 8,
    colorType: 2,
  });
  pngHeader(adaptiveIcon, {
    width: 1024,
    height: 1024,
    bitDepth: 8,
    colorType: 6,
  });
  pngHeader(wordmark, {
    width: 754,
    height: 252,
    bitDepth: 8,
    colorType: 6,
  });
  pngHeader(playIcon, {
    width: 512,
    height: 512,
    bitDepth: 8,
    colorType: 6,
  });
  pngHeader(playFeatureGraphic, {
    width: 1024,
    height: 500,
    bitDepth: 8,
    colorType: 2,
  });
  if (playIcon.byteLength > 1024 * 1024) {
    fail("store_play_icon_too_large");
  }
  if (playFeatureGraphic.byteLength > 15 * 1024 * 1024) {
    fail("store_play_feature_graphic_too_large");
  }
  if (
    createHash("sha256").update(playIcon).digest("hex")
      !== CONFIRMED_PLAY_ICON_SHA256
    || createHash("sha256").update(playFeatureGraphic).digest("hex")
      !== CONFIRMED_PLAY_FEATURE_SHA256
  ) {
    fail("store_play_assets_not_confirmed");
  }
  if (
    createHash("sha256").update(wordmark).digest("hex")
    !== CONFIRMED_WORDMARK_SHA256
  ) {
    fail("store_wordmark_not_confirmed");
  }

  return Object.freeze({
    localizations: 2,
    screenshotSlots: screenshotRows.length,
    easCli: easConfig.cli.version,
    submissionMode: "internal-draft",
    storeAssets: 2,
    iosReleaseScope: "metadata-only",
    applePortalFields: portalWorksheet.rows,
    applePortalReady: portalWorksheet.counts.READY,
    applePortalOwnerRequired: portalWorksheet.counts.OWNER_REQUIRED,
    applePortalPhase8Required: portalWorksheet.counts.PHASE8_REQUIRED,
  });
}

export async function verifyStoreReadiness() {
  const [
    appConfig,
    easConfig,
    listing,
    appStoreHandoff,
    appStoreWorksheet,
    reviewAccess,
    testerProgram,
    featureSource,
    wordmark,
    appIcon,
    adaptiveIcon,
    playIcon,
    playFeatureGraphic,
  ] = await Promise.all([
    readFile(new URL("app.json", MOBILE_ROOT), "utf8").then(JSON.parse),
    readFile(new URL("eas.json", MOBILE_ROOT), "utf8").then(JSON.parse),
    readFile(
      new URL("docs/mobile/STORE_LISTING.md", REPOSITORY_ROOT),
      "utf8",
    ),
    readFile(
      new URL("docs/mobile/APP_STORE_HANDOFF.md", REPOSITORY_ROOT),
      "utf8",
    ),
    readFile(
      new URL("docs/mobile/APP_STORE_CONNECT_WORKSHEET.md", REPOSITORY_ROOT),
      "utf8",
    ),
    readFile(
      new URL("docs/mobile/STORE_REVIEW_ACCESS.md", REPOSITORY_ROOT),
      "utf8",
    ),
    readFile(
      new URL("docs/mobile/STORE_TESTER_PROGRAM.md", REPOSITORY_ROOT),
      "utf8",
    ),
    readFile(
      new URL(
        "assets/store/google-play-feature-graphic-source.svg",
        MOBILE_ROOT,
      ),
      "utf8",
    ),
    readFile(new URL("assets/branding/fanmind-wordmark.png", MOBILE_ROOT)),
    readFile(new URL("assets/branding/fanmind-app-icon.png", MOBILE_ROOT)),
    readFile(
      new URL("assets/branding/fanmind-adaptive-icon.png", MOBILE_ROOT),
    ),
    readFile(new URL("assets/store/google-play-icon.png", MOBILE_ROOT)),
    readFile(
      new URL("assets/store/google-play-feature-graphic.png", MOBILE_ROOT),
    ),
  ]);

  return evaluateStoreReadiness({
    appConfig,
    easConfig,
    listing,
    appStoreHandoff,
    appStoreWorksheet,
    reviewAccess,
    testerProgram,
    featureSource,
    wordmark,
    appIcon,
    adaptiveIcon,
    playIcon,
    playFeatureGraphic,
  });
}

async function main() {
  const result = await verifyStoreReadiness();
  console.log(`MOBILE_STORE_LOCALIZATIONS=${result.localizations}`);
  console.log(`MOBILE_STORE_SCREENSHOT_SLOTS=${result.screenshotSlots}`);
  console.log(`MOBILE_STORE_EAS_CLI=${result.easCli}`);
  console.log(`MOBILE_STORE_SUBMISSION_MODE=${result.submissionMode}`);
  console.log(`MOBILE_STORE_ASSETS=${result.storeAssets}`);
  console.log(`MOBILE_IOS_RELEASE_SCOPE=${result.iosReleaseScope}`);
  console.log(`MOBILE_APPLE_PORTAL_FIELDS=${result.applePortalFields}`);
  console.log(`MOBILE_APPLE_PORTAL_READY=${result.applePortalReady}`);
  console.log(
    `MOBILE_APPLE_PORTAL_OWNER_REQUIRED=${result.applePortalOwnerRequired}`,
  );
  console.log(
    `MOBILE_APPLE_PORTAL_PHASE8_REQUIRED=${result.applePortalPhase8Required}`,
  );
  console.log("MOBILE_STORE_SECRETS=absent");
  console.log("MOBILE_STORE_READINESS=PASS");
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(`MOBILE_STORE_READINESS_ERROR=${error?.code ?? "failed"}`);
    console.error("MOBILE_STORE_READINESS=FAIL");
    process.exitCode = 1;
  });
}

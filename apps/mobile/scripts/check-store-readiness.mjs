#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MOBILE_ROOT = new URL("../", import.meta.url);
const REPOSITORY_ROOT = new URL("../../../", import.meta.url);
const CONFIRMED_WORDMARK_SHA256 =
  "f432007c36e4523211e8678757c2340592c50f1a945776cfc283922601ac8aad";

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
  const { appConfig, easConfig, listing, wordmark, appIcon, adaptiveIcon } =
    input;
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
  const shortDescription = fencedText(
    listing,
    "Google Play - Kurzbeschreibung",
  );
  const descriptionDe = fencedText(
    listing,
    "Google Play und Apple - Beschreibung DE",
  );
  const descriptionEn = fencedText(
    listing,
    "Google Play und Apple - Description EN",
  );
  const appleKeywords = fencedText(listing, "Suchbegriffe für Apple");

  assertLength(appName, 2, 30, "store_app_name_length_invalid");
  assertLength(subtitleDe, 2, 30, "store_subtitle_de_length_invalid");
  assertLength(subtitleEn, 2, 30, "store_subtitle_en_length_invalid");
  assertLength(
    shortDescription,
    20,
    80,
    "store_google_short_description_length_invalid",
  );
  assertLength(descriptionDe, 200, 4000, "store_description_de_length_invalid");
  assertLength(descriptionEn, 200, 4000, "store_description_en_length_invalid");
  assertLength(appleKeywords, 2, 100, "store_apple_keywords_length_invalid");

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
  ) {
    fail("store_screenshot_safety_boundary_missing");
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
  });
}

export async function verifyStoreReadiness() {
  const [appConfig, easConfig, listing, wordmark, appIcon, adaptiveIcon] =
    await Promise.all([
      readFile(new URL("app.json", MOBILE_ROOT), "utf8").then(JSON.parse),
      readFile(new URL("eas.json", MOBILE_ROOT), "utf8").then(JSON.parse),
      readFile(
        new URL("docs/mobile/STORE_LISTING.md", REPOSITORY_ROOT),
        "utf8",
      ),
      readFile(new URL("assets/branding/fanmind-wordmark.png", MOBILE_ROOT)),
      readFile(new URL("assets/branding/fanmind-app-icon.png", MOBILE_ROOT)),
      readFile(
        new URL("assets/branding/fanmind-adaptive-icon.png", MOBILE_ROOT),
      ),
    ]);

  return evaluateStoreReadiness({
    appConfig,
    easConfig,
    listing,
    wordmark,
    appIcon,
    adaptiveIcon,
  });
}

async function main() {
  const result = await verifyStoreReadiness();
  console.log(`MOBILE_STORE_LOCALIZATIONS=${result.localizations}`);
  console.log(`MOBILE_STORE_SCREENSHOT_SLOTS=${result.screenshotSlots}`);
  console.log(`MOBILE_STORE_EAS_CLI=${result.easCli}`);
  console.log(`MOBILE_STORE_SUBMISSION_MODE=${result.submissionMode}`);
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

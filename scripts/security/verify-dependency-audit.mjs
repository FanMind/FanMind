#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT_REVIEWED_AT = "2026-08-17T10:53:01.000Z";
const ROOT_REVIEWED_FRAMEWORK_VERSION = "16.3.1";
const ROOT_REVIEW_HIGH_MAXIMUM = 0;
const ROOT_REVIEW_MODERATE_MAXIMUM = 0;
const REVIEWED_ROOT_PACKAGES = Object.freeze([]);
const MOBILE_REVIEWED_AT = "2026-09-03T18:40:00.000Z";
const MOBILE_REVIEW_EXPIRES_AT = "2026-09-17T18:40:00.000Z";
const MOBILE_REVIEW_HIGH_MAXIMUM = 4;
const MOBILE_REVIEW_MODERATE_MAXIMUM = 15;
const MOBILE_REVIEW_LOW_MAXIMUM = 0;
const REVIEWED_MOBILE_PACKAGES = Object.freeze([
  "@expo/cli",
  "@expo/config",
  "@expo/config-plugins",
  "@expo/devtools",
  "@expo/dom-webview",
  "@expo/inline-modules",
  "@expo/local-build-cache-provider",
  "@expo/log-box",
  "@expo/metro",
  "@expo/metro-config",
  "@expo/metro-runtime",
  "@expo/prebuild-config",
  "@expo/router-server",
  "@expo/ui",
  "@react-native-masked-view/masked-view",
  "@react-native/community-cli-plugin",
  "@react-native/metro-config",
  "@react-native/virtualized-lists",
  "@xmldom/xmldom",
  "babel-preset-expo",
  "decode-uri-component",
  "expo",
  "expo-application",
  "expo-asset",
  "expo-clipboard",
  "expo-constants",
  "expo-dev-client",
  "expo-dev-launcher",
  "expo-dev-menu",
  "expo-dev-menu-interface",
  "expo-file-system",
  "expo-font",
  "expo-glass-effect",
  "expo-keep-awake",
  "expo-linking",
  "expo-manifests",
  "expo-modules-core",
  "expo-modules-jsi",
  "expo-notifications",
  "expo-router",
  "expo-secure-store",
  "expo-splash-screen",
  "expo-status-bar",
  "expo-symbols",
  "expo-system-ui",
  "expo-updates-interface",
  "image-size",
  "metro",
  "metro-config",
  "metro-transform-worker",
  "react-native",
  "react-native-drawer-layout",
  "react-native-gesture-handler",
  "react-native-is-edge-to-edge",
  "react-native-reanimated",
  "react-native-safe-area-context",
  "react-native-screens",
  "react-native-url-polyfill",
  "react-native-worklets",
  "query-string",
  "uuid",
  "xcode",
]);

function parseArgument(name, fallback = null) {
  const exact = process.argv.findIndex((value) => value === name);
  if (exact >= 0) return process.argv[exact + 1] ?? fallback;
  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : fallback;
}

function auditMetadata(payload) {
  const values = payload?.metadata?.vulnerabilities ?? {};
  return {
    info: Number(values.info ?? 0),
    low: Number(values.low ?? 0),
    moderate: Number(values.moderate ?? 0),
    high: Number(values.high ?? 0),
    critical: Number(values.critical ?? 0),
    total: Number(values.total ?? 0),
  };
}

function vulnerabilityNames(payload) {
  const vulnerabilities =
    payload?.vulnerabilities && typeof payload.vulnerabilities === "object"
      ? payload.vulnerabilities
      : {};
  return Object.keys(vulnerabilities).sort();
}

function evaluateDependencyAudit({
  rootPayload,
  mobilePayload,
  rootManifest,
  now = new Date(),
}) {
  const root = auditMetadata(rootPayload);
  const mobile = auditMetadata(mobilePayload);
  const rootNames = vulnerabilityNames(rootPayload);
  const mobileNames = vulnerabilityNames(mobilePayload);
  const allowedRootNames = new Set(REVIEWED_ROOT_PACKAGES);
  const unknownRootNames = rootNames.filter(
    (name) => !allowedRootNames.has(name),
  );
  const allowedMobileNames = new Set(REVIEWED_MOBILE_PACKAGES);
  const unknownMobileNames = mobileNames.filter(
    (name) => !allowedMobileNames.has(name),
  );
  const reviewReference = now instanceof Date ? now : new Date(now);
  const mobileReviewActive =
    Number.isFinite(reviewReference.getTime())
    && reviewReference.getTime() <= Date.parse(MOBILE_REVIEW_EXPIRES_AT);
  const mobileReviewRequired = mobile.total > 0;
  const rootVersionsPinned =
    rootManifest?.dependencies?.next === ROOT_REVIEWED_FRAMEWORK_VERSION &&
    rootManifest?.devDependencies?.["eslint-config-next"] ===
      ROOT_REVIEWED_FRAMEWORK_VERSION;

  const rootOk =
    root.total === 0 &&
    root.critical === 0 &&
    root.high <= ROOT_REVIEW_HIGH_MAXIMUM &&
    root.moderate <= ROOT_REVIEW_MODERATE_MAXIMUM &&
    unknownRootNames.length === 0 &&
    rootVersionsPinned;
  const mobileOk =
    mobile.critical === 0
    && mobile.high <= MOBILE_REVIEW_HIGH_MAXIMUM
    && (
      !mobileReviewRequired
      || (
        mobileReviewActive
        && mobile.info === 0
        && mobile.low <= MOBILE_REVIEW_LOW_MAXIMUM
        && mobile.moderate <= MOBILE_REVIEW_MODERATE_MAXIMUM
        && unknownMobileNames.length === 0
      )
    );

  const errors = [];
  if (root.total !== 0) errors.push("root_vulnerability_present");
  if (root.critical !== 0) errors.push("root_critical_vulnerability_present");
  if (root.high > ROOT_REVIEW_HIGH_MAXIMUM) {
    errors.push("root_high_vulnerability_budget_exceeded");
  }
  if (root.moderate > ROOT_REVIEW_MODERATE_MAXIMUM) {
    errors.push("root_moderate_vulnerability_budget_exceeded");
  }
  if (unknownRootNames.length > 0) {
    errors.push("root_unreviewed_vulnerability_package_present");
  }
  if (!rootVersionsPinned) errors.push("root_framework_security_patch_missing");
  if (mobile.critical !== 0) {
    errors.push("mobile_critical_vulnerability_present");
  }
  if (mobile.high > MOBILE_REVIEW_HIGH_MAXIMUM) {
    errors.push("mobile_high_vulnerability_budget_exceeded");
  }
  if (
    mobileReviewRequired
    && mobile.moderate > MOBILE_REVIEW_MODERATE_MAXIMUM
  ) {
    errors.push("mobile_moderate_vulnerability_budget_exceeded");
  }
  if (mobileReviewRequired && mobile.low > MOBILE_REVIEW_LOW_MAXIMUM) {
    errors.push("mobile_low_vulnerability_budget_exceeded");
  }
  if (mobileReviewRequired && mobile.info !== 0) {
    errors.push("mobile_info_vulnerability_present");
  }
  if (mobileReviewRequired && unknownMobileNames.length > 0) {
    errors.push("mobile_unreviewed_vulnerability_package_present");
  }
  if (mobileReviewRequired && !mobileReviewActive) {
    errors.push("mobile_vulnerability_review_expired");
  }

  return {
    ok: rootOk && mobileOk,
    root: {
      ...root,
      packages: rootNames,
      unknownPackages: unknownRootNames,
      versionsPinned: rootVersionsPinned,
      reviewedAt: ROOT_REVIEWED_AT,
      reviewedFrameworkVersion: ROOT_REVIEWED_FRAMEWORK_VERSION,
      highMaximum: ROOT_REVIEW_HIGH_MAXIMUM,
      moderateMaximum: ROOT_REVIEW_MODERATE_MAXIMUM,
    },
    mobile: {
      ...mobile,
      packages: mobileNames,
      unknownPackages: unknownMobileNames,
      reviewRequired: mobileReviewRequired,
      reviewActive: mobileReviewActive,
      reviewedAt: MOBILE_REVIEWED_AT,
      reviewExpiresAt: MOBILE_REVIEW_EXPIRES_AT,
      highMaximum: MOBILE_REVIEW_HIGH_MAXIMUM,
      moderateMaximum: MOBILE_REVIEW_MODERATE_MAXIMUM,
      lowMaximum: MOBILE_REVIEW_LOW_MAXIMUM,
    },
    errors,
  };
}

function runNpmAudit(cwd, { omitDev = false } = {}) {
  const args = ["audit", "--json"];
  if (omitDev) args.push("--omit=dev");

  const result = spawnSync("npm", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (result.error || ![0, 1].includes(result.status ?? -1)) {
    throw new Error("npm_audit_unavailable");
  }

  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    throw new Error("npm_audit_json_invalid");
  }
}

async function main() {
  const rootDirectory = process.cwd();
  const mobileDirectory = resolve(rootDirectory, "apps/mobile");
  const reportPath = resolve(
    rootDirectory,
    parseArgument("--report", "dependency-audit-report.json"),
  );
  const rootManifest = JSON.parse(
    await readFile(resolve(rootDirectory, "package.json"), "utf8"),
  );

  const evaluation = evaluateDependencyAudit({
    rootPayload: runNpmAudit(rootDirectory, { omitDev: true }),
    mobilePayload: runNpmAudit(mobileDirectory),
    rootManifest,
  });

  const report = {
    generatedAt: new Date().toISOString(),
    policy: {
      rootCriticalMaximum: 0,
      rootHighMaximum: ROOT_REVIEW_HIGH_MAXIMUM,
      rootModerateMaximum: ROOT_REVIEW_MODERATE_MAXIMUM,
      reviewedRootPackages: REVIEWED_ROOT_PACKAGES,
      reviewedFrameworkVersion: ROOT_REVIEWED_FRAMEWORK_VERSION,
      reviewedAt: ROOT_REVIEWED_AT,
      mobileCriticalMaximum: 0,
      mobileHighMaximum: MOBILE_REVIEW_HIGH_MAXIMUM,
      mobileModerateMaximum: MOBILE_REVIEW_MODERATE_MAXIMUM,
      mobileLowMaximum: MOBILE_REVIEW_LOW_MAXIMUM,
      reviewedMobilePackages: REVIEWED_MOBILE_PACKAGES,
      mobileReviewedAt: MOBILE_REVIEWED_AT,
      mobileReviewExpiresAt: MOBILE_REVIEW_EXPIRES_AT,
    },
    result: evaluation,
    advisoryDetailsIncluded: false,
    environmentValuesRead: false,
  };

  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, {
    mode: 0o600,
  });

  console.log(`DEPENDENCY_AUDIT_ROOT_TOTAL=${evaluation.root.total}`);
  console.log(`DEPENDENCY_AUDIT_ROOT_HIGH=${evaluation.root.high}`);
  console.log(`DEPENDENCY_AUDIT_ROOT_CRITICAL=${evaluation.root.critical}`);
  console.log(`DEPENDENCY_AUDIT_MOBILE_TOTAL=${evaluation.mobile.total}`);
  console.log(`DEPENDENCY_AUDIT_MOBILE_HIGH=${evaluation.mobile.high}`);
  console.log(`DEPENDENCY_AUDIT_MOBILE_CRITICAL=${evaluation.mobile.critical}`);
  console.log(
    `DEPENDENCY_AUDIT_MOBILE_REVIEW_ACTIVE=${evaluation.mobile.reviewActive}`,
  );
  console.log(
    `DEPENDENCY_AUDIT_MOBILE_REVIEW_EXPIRES_AT=${evaluation.mobile.reviewExpiresAt}`,
  );
  console.log(
    `DEPENDENCY_AUDIT_REVIEW_EXCEPTION_ACTIVE=${
      evaluation.mobile.reviewRequired ? "mobile_only" : "no"
    }`,
  );
  console.log(`DEPENDENCY_AUDIT_RESULT=${evaluation.ok ? "success" : "failed"}`);

  if (!evaluation.ok) {
    for (const error of evaluation.errors) {
      console.error(`DEPENDENCY_AUDIT_ERROR=${error}`);
    }
    process.exit(1);
  }
}

export {
  MOBILE_REVIEWED_AT,
  MOBILE_REVIEW_EXPIRES_AT,
  MOBILE_REVIEW_HIGH_MAXIMUM,
  MOBILE_REVIEW_LOW_MAXIMUM,
  MOBILE_REVIEW_MODERATE_MAXIMUM,
  REVIEWED_MOBILE_PACKAGES,
  REVIEWED_ROOT_PACKAGES,
  ROOT_REVIEWED_AT,
  ROOT_REVIEWED_FRAMEWORK_VERSION,
  ROOT_REVIEW_HIGH_MAXIMUM,
  ROOT_REVIEW_MODERATE_MAXIMUM,
  auditMetadata,
  evaluateDependencyAudit,
  runNpmAudit,
  vulnerabilityNames,
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `DEPENDENCY_AUDIT_FATAL=${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
    process.exit(1);
  });
}

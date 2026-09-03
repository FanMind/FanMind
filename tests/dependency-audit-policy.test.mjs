import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

import {
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
  evaluateDependencyAudit,
} from "../scripts/security/verify-dependency-audit.mjs";
import { validateCycloneDx } from "../scripts/security/generate-sbom.mjs";

const patchedManifest = {
  dependencies: { next: "16.3.1" },
  devDependencies: {
    eslint: "9.39.5",
    "eslint-config-next": "16.3.1",
  },
};

function auditPayload({
  critical = 0,
  high = 0,
  moderate = 0,
  low = 0,
  packages = [],
} = {}) {
  return {
    metadata: {
      vulnerabilities: {
        critical,
        high,
        moderate,
        low,
        info: 0,
        total: critical + high + moderate + low,
      },
    },
    vulnerabilities: Object.fromEntries(
      packages.map((name) => [name, { severity: "reviewed" }]),
    ),
  };
}

test("clean root audit passes without a review exception", () => {
  const result = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({
      moderate: 10,
      packages: [REVIEWED_MOBILE_PACKAGES[0]],
    }),
    rootManifest: patchedManifest,
    now: "2026-08-02T18:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(REVIEWED_ROOT_PACKAGES, []);
  assert.equal(result.root.highMaximum, ROOT_REVIEW_HIGH_MAXIMUM);
  assert.equal(result.root.moderateMaximum, ROOT_REVIEW_MODERATE_MAXIMUM);
  assert.equal(result.root.reviewedAt, ROOT_REVIEWED_AT);
  assert.equal(
    result.root.reviewedFrameworkVersion,
    ROOT_REVIEWED_FRAMEWORK_VERSION,
  );
  assert.equal(result.mobile.reviewActive, true);
  assert.equal(result.mobile.reviewedAt, MOBILE_REVIEWED_AT);
  assert.equal(result.mobile.reviewExpiresAt, MOBILE_REVIEW_EXPIRES_AT);
  assert.equal(result.mobile.highMaximum, MOBILE_REVIEW_HIGH_MAXIMUM);
  assert.equal(
    result.mobile.moderateMaximum,
    MOBILE_REVIEW_MODERATE_MAXIMUM,
  );
  assert.equal(result.mobile.lowMaximum, MOBILE_REVIEW_LOW_MAXIMUM);
});

test("every root high, moderate or unreviewed package fails closed", () => {
  const highFailure = evaluateDependencyAudit({
    rootPayload: auditPayload({
      high: 1,
      packages: ["next"],
    }),
    mobilePayload: auditPayload(),
    rootManifest: patchedManifest,
  });
  assert.equal(highFailure.ok, false);
  assert.match(
    highFailure.errors.join("\n"),
    /root_high_vulnerability_budget_exceeded/u,
  );

  const moderateFailure = evaluateDependencyAudit({
    rootPayload: auditPayload({
      moderate: 1,
      packages: ["postcss"],
    }),
    mobilePayload: auditPayload(),
    rootManifest: patchedManifest,
  });
  assert.equal(moderateFailure.ok, false);
  assert.match(
    moderateFailure.errors.join("\n"),
    /root_moderate_vulnerability_budget_exceeded/u,
  );

  const rootFailure = evaluateDependencyAudit({
    rootPayload: auditPayload({ low: 1, packages: ["unreviewed-package"] }),
    mobilePayload: auditPayload(),
    rootManifest: patchedManifest,
  });
  assert.equal(rootFailure.ok, false);
  assert.match(
    rootFailure.errors.join("\n"),
    /root_unreviewed_vulnerability_package_present/u,
  );

  const metadataOnlyFailure = evaluateDependencyAudit({
    rootPayload: auditPayload({ low: 1 }),
    mobilePayload: auditPayload(),
    rootManifest: patchedManifest,
  });
  assert.equal(metadataOnlyFailure.ok, false);
  assert.match(
    metadataOnlyFailure.errors.join("\n"),
    /root_vulnerability_present/u,
  );
});

test("reviewed Mobile highs stay bounded while excessive or critical findings fail", () => {
  const mobileHighFailure = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({
      high: MOBILE_REVIEW_HIGH_MAXIMUM + 1,
      packages: [REVIEWED_MOBILE_PACKAGES[0]],
    }),
    rootManifest: patchedManifest,
  });
  assert.equal(mobileHighFailure.ok, false);
  assert.match(
    mobileHighFailure.errors.join("\n"),
    /mobile_high_vulnerability_budget_exceeded/u,
  );

  const reviewedHigh = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({
      high: MOBILE_REVIEW_HIGH_MAXIMUM,
      packages: [...REVIEWED_MOBILE_PACKAGES],
    }),
    rootManifest: patchedManifest,
    now: "2026-08-08T08:30:00.000Z",
  });
  assert.equal(reviewedHigh.ok, true);

  const mobileCriticalFailure = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({ critical: 1, packages: ["mobile-critical"] }),
    rootManifest: patchedManifest,
  });
  assert.equal(mobileCriticalFailure.ok, false);
  assert.match(
    mobileCriticalFailure.errors.join("\n"),
    /mobile_critical_vulnerability_present/u,
  );

  const reviewedModerate = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({
      moderate: MOBILE_REVIEW_MODERATE_MAXIMUM,
      packages: [...REVIEWED_MOBILE_PACKAGES],
    }),
    rootManifest: patchedManifest,
    now: "2026-08-02T18:00:00.000Z",
  });
  assert.equal(reviewedModerate.ok, true);
  assert.deepEqual(reviewedModerate.mobile.unknownPackages, []);
});

test("new, excessive or expired Mobile findings fail closed", () => {
  const unknown = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({
      moderate: 1,
      packages: ["new-mobile-advisory"],
    }),
    rootManifest: patchedManifest,
    now: "2026-08-02T18:00:00.000Z",
  });
  assert.equal(unknown.ok, false);
  assert.match(
    unknown.errors.join("\n"),
    /mobile_unreviewed_vulnerability_package_present/u,
  );

  const excessive = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({
      moderate: MOBILE_REVIEW_MODERATE_MAXIMUM + 1,
      packages: [REVIEWED_MOBILE_PACKAGES[0]],
    }),
    rootManifest: patchedManifest,
    now: "2026-08-02T18:00:00.000Z",
  });
  assert.equal(excessive.ok, false);
  assert.match(
    excessive.errors.join("\n"),
    /mobile_moderate_vulnerability_budget_exceeded/u,
  );

  const expired = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload({
      moderate: 1,
      packages: [REVIEWED_MOBILE_PACKAGES[0]],
    }),
    rootManifest: patchedManifest,
    now: new Date(Date.parse(MOBILE_REVIEW_EXPIRES_AT) + 1),
  });
  assert.equal(expired.ok, false);
  assert.match(
    expired.errors.join("\n"),
    /mobile_vulnerability_review_expired/u,
  );
});

test("framework and eslint configuration must stay on the reviewed patch", () => {
  const result = evaluateDependencyAudit({
    rootPayload: auditPayload(),
    mobilePayload: auditPayload(),
    rootManifest: {
      dependencies: { next: "16.2.7" },
      devDependencies: { "eslint-config-next": "16.2.7" },
    },
  });

  assert.equal(result.ok, false);
  assert.match(
    result.errors.join("\n"),
    /root_framework_security_patch_missing/u,
  );
});

test("reviewed overrides stay narrow and resolve to the patched root tree", async () => {
  const manifest = JSON.parse(
    await readFile(new URL("../package.json", import.meta.url), "utf8"),
  );
  const lock = JSON.parse(
    await readFile(new URL("../package-lock.json", import.meta.url), "utf8"),
  );

  assert.deepEqual(manifest.overrides, {
    "brace-expansion@>=1.0.0 <1.1.18": "1.1.18",
    "brace-expansion@>=5.0.0 <5.0.9": "5.0.9",
    "js-yaml@>=4.0.0 <4.3.1": "4.3.1",
    "nanoid@<3.3.18": "3.3.18",
    "next@16.3.1": {
      postcss: "8.5.23",
      sharp: "0.35.3",
    },
  });
  assert.equal(manifest.devDependencies.eslint, "9.39.5");
  assert.equal(lock.packages["node_modules/eslint"].version, "9.39.5");
  assert.equal(lock.packages["node_modules/next"].version, "16.3.1");
  assert.equal(lock.packages["node_modules/postcss"].version, "8.5.23");
  assert.equal(lock.packages["node_modules/sharp"].version, "0.35.3");
  assert.equal(lock.packages["node_modules/brace-expansion"].version, "5.0.9");
  for (const dependencyPath of [
    "node_modules/@eslint/config-array/node_modules/brace-expansion",
    "node_modules/@eslint/eslintrc/node_modules/brace-expansion",
    "node_modules/eslint-config-next/node_modules/brace-expansion",
    "node_modules/eslint/node_modules/brace-expansion",
  ]) {
    assert.equal(lock.packages[dependencyPath].version, "1.1.18");
  }
  assert.equal(lock.packages["node_modules/js-yaml"].version, "4.3.1");
  assert.equal(lock.packages["node_modules/nanoid"].version, "3.3.18");
});

test("legacy ESLint brace expansion enforces the reviewed output bound", () => {
  const requireFromEslint = createRequire(
    new URL("../node_modules/eslint/package.json", import.meta.url),
  );
  const expand = requireFromEslint("brace-expansion");

  assert.deepEqual(expand("{a,b}{c,d}", { maxLength: 4 }), ["ac", "ad"]);
});

test("reviewed Sharp override can process an image with the Production runtime", async () => {
  const { default: sharp } = await import("sharp");
  const input = Buffer.from([255, 0, 0, 255]);
  const { info } = await sharp(input, {
    raw: { width: 1, height: 1, channels: 4 },
  })
    .resize(2, 2)
    .png()
    .toBuffer({ resolveWithObject: true });

  assert.equal(info.format, "png");
  assert.equal(info.width, 2);
  assert.equal(info.height, 2);
});

test("CycloneDX validation accepts only structured component inventories", () => {
  assert.deepEqual(
    validateCycloneDx({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      components: [{ name: "fanmind" }],
    }),
    {
      format: "CycloneDX",
      specVersion: "1.6",
      componentCount: 1,
    },
  );

  assert.throws(
    () =>
      validateCycloneDx({
        bomFormat: "SPDX",
        specVersion: "1.6",
        components: [],
      }),
    /cyclonedx_sbom_invalid/u,
  );
});

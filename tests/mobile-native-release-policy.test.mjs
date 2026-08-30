import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mobileRoot = new URL("../apps/mobile/", import.meta.url);
const require = createRequire(import.meta.url);
const packageJson = JSON.parse(
  await readFile(new URL("package.json", mobileRoot), "utf8"),
);
const appConfig = JSON.parse(
  await readFile(new URL("app.json", mobileRoot), "utf8"),
);
const dynamicAppConfig = require(
  fileURLToPath(new URL("app.config.js", mobileRoot)),
);
const easConfig = JSON.parse(
  await readFile(new URL("eas.json", mobileRoot), "utf8"),
);
const nativeVerifier = await readFile(
  new URL("scripts/check-native-prebuild.mjs", mobileRoot),
  "utf8",
);
const expoDoctorVerifier = await readFile(
  new URL("scripts/check-expo-doctor.mjs", mobileRoot),
  "utf8",
);
const { runExpoDoctorGate } = await import(
  "../apps/mobile/scripts/check-expo-doctor.mjs"
);
const mobileCi = await readFile(
  new URL("../.github/workflows/ci-mobile.yml", import.meta.url),
  "utf8",
);
const mobileNativeCi = await readFile(
  new URL("../.github/workflows/ci-mobile-native.yml", import.meta.url),
  "utf8",
);
const gitignore = await readFile(
  new URL("../.gitignore", import.meta.url),
  "utf8",
);
const mobileReadme = await readFile(
  new URL("README.md", mobileRoot),
  "utf8",
);
const betaRelease = await readFile(
  new URL("../docs/mobile/BETA_RELEASE.md", import.meta.url),
  "utf8",
);
const releaseReadinessWorkflow = await readFile(
  new URL(
    "../.github/workflows/mobile-release-resource-readiness.yml",
    import.meta.url,
  ),
  "utf8",
);
const releaseReadinessScript = await readFile(
  new URL(
    "../scripts/operations/mobile-release-resource-readiness.mjs",
    import.meta.url,
  ),
  "utf8",
);
const signedBuildWorkflow = await readFile(
  new URL(
    "../.github/workflows/mobile-signed-internal-build.yml",
    import.meta.url,
  ),
  "utf8",
);
const storeBuildWorkflow = await readFile(
  new URL(
    "../.github/workflows/mobile-android-store-build.yml",
    import.meta.url,
  ),
  "utf8",
);
const signedBuildScript = await readFile(
  new URL(
    "../scripts/operations/mobile-signed-build-preflight.mjs",
    import.meta.url,
  ),
  "utf8",
);
const signedBuildCompletionScript = await readFile(
  new URL(
    "../scripts/operations/mobile-signed-build-completion.mjs",
    import.meta.url,
  ),
  "utf8",
);
const { evaluateMobileReleaseResources } = await import(
  "../scripts/operations/mobile-release-resource-readiness.mjs"
);
const {
  evaluateMobileSignedBuildGate,
  evaluateQueuedMobileBuild,
} = await import("../scripts/operations/mobile-signed-build-preflight.mjs");
const { evaluateMobileSignedBuildCompletion } = await import(
  "../scripts/operations/mobile-signed-build-completion.mjs"
);
const { createMobileSignedBuildReceipt } = await import(
  "../scripts/operations/write-mobile-signed-build-receipt.mjs"
);

const easProjectId = "123e4567-e89b-42d3-a456-426614174000";
const previewProjectRef = "abcdefghijklmnopqrst";
const productionProjectRef = "uvwxyzabcdefghijklmn";
const publicAnonJwt = [
  Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString(
    "base64url",
  ),
  Buffer.from(JSON.stringify({ role: "anon" })).toString("base64url"),
  "test-signature",
].join(".");

function linkedAppConfig() {
  return {
    expo: {
      ...appConfig.expo,
      owner: "bernds-tech",
      extra: {
        ...appConfig.expo.extra,
        eas: {
          projectId: easProjectId,
        },
      },
    },
  };
}

function releaseEnvironment(overrides = {}) {
  return {
    FANMIND_MOBILE_RELEASE_ENVIRONMENT: "preview",
    FANMIND_MOBILE_RELEASE_RESOURCE_CONFIRM:
      "verify-mobile-release-resources",
    FANMIND_MOBILE_EXPECTED_EAS_OWNER: "bernds-tech",
    FANMIND_MOBILE_EXPECTED_EAS_PROJECT_ID: easProjectId,
    FANMIND_MOBILE_EXPECTED_SUPABASE_PROJECT_REF: previewProjectRef,
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: productionProjectRef,
    FANMIND_MOBILE_EXPECTED_API_ORIGIN: "https://preview.fanmind.ch",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    FANMIND_ENABLE_MOBILE_EAS_BUILD: "false",
    FANMIND_ENABLE_MOBILE_EAS_SUBMIT: "false",
    FANMIND_ENABLE_MOBILE_EAS_UPDATE: "false",
    EXPO_PUBLIC_SUPABASE_URL: `https://${previewProjectRef}.supabase.co`,
    EXPO_PUBLIC_SUPABASE_ANON_KEY: publicAnonJwt,
    EXPO_PUBLIC_FANMIND_API_URL: "https://preview.fanmind.ch",
    ...overrides,
  };
}

function signedBuildEnvironment(overrides = {}) {
  const releaseCommit = "a".repeat(40);
  return {
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: releaseCommit,
    FANMIND_MOBILE_EXPECTED_RELEASE_COMMIT: releaseCommit,
    FANMIND_MOBILE_RELEASE_ENVIRONMENT: "preview",
    FANMIND_MOBILE_BUILD_PROFILE: "preview",
    FANMIND_MOBILE_BUILD_PLATFORM: "android",
    FANMIND_MOBILE_BUILD_CLASS: "internal",
    FANMIND_MOBILE_SIGNED_BUILD_CONFIRM: "queue-one-signed-mobile-build",
    FANMIND_ENABLE_MOBILE_EAS_BUILD: "true",
    FANMIND_ENABLE_MOBILE_EAS_SUBMIT: "false",
    FANMIND_ENABLE_MOBILE_EAS_UPDATE: "false",
    ...overrides,
  };
}

function storeBuildEnvironment(overrides = {}) {
  return signedBuildEnvironment({
    FANMIND_MOBILE_RELEASE_ENVIRONMENT: "production",
    FANMIND_MOBILE_BUILD_PROFILE: "production",
    FANMIND_MOBILE_BUILD_PLATFORM: "android",
    FANMIND_MOBILE_BUILD_CLASS: "store",
    FANMIND_MOBILE_SIGNED_BUILD_CONFIRM: "queue-one-android-store-build",
    ...overrides,
  });
}

function queuedBuild(overrides = {}) {
  return {
    id: "123e4567-e89b-42d3-a456-426614174000",
    platform: "ANDROID",
    buildProfile: "preview",
    gitCommitHash: "a".repeat(40),
    ...overrides,
  };
}

function completedBuild(overrides = {}) {
  return {
    ...queuedBuild(),
    status: "FINISHED",
    distribution: "INTERNAL",
    completedAt: "2026-07-31T13:00:00.000Z",
    artifacts: {
      applicationArchiveUrl:
        "https://expo.dev/artifacts/eas/synthetic-internal-build.apk",
    },
    ...overrides,
  };
}

test("Mobile has an explicit SDK-compatible development-client workflow", () => {
  assert.equal(packageJson.dependencies["expo-dev-client"], "~57.0.16");
  assert.equal(packageJson.dependencies["expo-system-ui"], "~57.0.3");
  assert.ok(appConfig.expo.plugins.includes("expo-dev-client"));
  assert.ok(appConfig.expo.plugins.includes("expo-system-ui"));

  assert.equal(packageJson.scripts.start, "expo start --dev-client");
  assert.equal(packageJson.scripts["start:dev-client"], "expo start --dev-client");
  assert.equal(packageJson.scripts["start:go"], "expo start --go");
  assert.equal(packageJson.scripts.android, "expo run:android");
  assert.equal(packageJson.scripts.ios, "expo run:ios");
  assert.equal(
    packageJson.scripts.doctor,
    "node scripts/check-expo-doctor.mjs",
  );
  assert.match(packageJson.scripts.check, /native:prebuild:check/u);
  assert.equal(appConfig.expo.ios.supportsTablet, false);
});

test("Expo Doctor cannot hide a failed Expo config preflight", () => {
  let doctorCalled = false;
  const failedConfig = runExpoDoctorGate({
    runConfig: () => ({ status: 7, signal: null, error: undefined }),
    runDoctor: () => {
      doctorCalled = true;
      return { status: 0, signal: null, error: undefined };
    },
  });

  assert.deepEqual(failedConfig, { ok: false, code: "expo_config_failed" });
  assert.equal(doctorCalled, false);

  const failedDoctor = runExpoDoctorGate({
    runConfig: () => ({ status: 0, signal: null, error: undefined }),
    runDoctor: () => ({ status: 1, signal: null, error: undefined }),
  });
  assert.deepEqual(failedDoctor, { ok: false, code: "expo_doctor_failed" });

  const success = runExpoDoctorGate({
    runConfig: () => ({ status: 0, signal: null, error: undefined }),
    runDoctor: () => ({ status: 0, signal: null, error: undefined }),
  });
  assert.deepEqual(success, { ok: true, code: "success" });

  assert.match(expoDoctorVerifier, /EXPO_NO_TELEMETRY: "1"/u);
  assert.match(expoDoctorVerifier, /"config", "--json", "--full"/u);
  assert.match(
    expoDoctorVerifier,
    /stdio: \["ignore", "ignore", "ignore"\]/u,
  );
});

test("EAS profiles bind every release class to an explicit environment", () => {
  const { development, preview, production } = easConfig.build;

  assert.equal(easConfig.cli.version, "21.2.0");
  assert.equal(easConfig.cli.requireCommit, true);
  assert.equal(easConfig.cli.appVersionSource, "remote");
  assert.equal(appConfig.expo.version, "1.0.0");
  assert.equal(packageJson.version, "1.0.0");
  assert.equal(development.developmentClient, true);
  assert.equal(development.distribution, "internal");
  assert.equal(development.credentialsSource, "remote");
  assert.equal(development.environment, "development");
  assert.equal(development.node, "22.13.1");
  assert.equal(development.android.buildType, "apk");

  assert.equal(preview.distribution, "internal");
  assert.equal(preview.credentialsSource, "remote");
  assert.equal(preview.environment, "preview");
  assert.equal(preview.node, "22.13.1");
  assert.equal(preview.android.buildType, "apk");

  assert.equal(production.distribution, "store");
  assert.equal(production.credentialsSource, "remote");
  assert.equal(production.environment, "production");
  assert.equal(production.node, "22.13.1");
  assert.equal(production.android.buildType, "app-bundle");
  assert.equal(production.autoIncrement, true);

  assert.deepEqual(easConfig.submit.production, {
    android: {
      track: "internal",
      releaseStatus: "draft",
      changesNotSentForReview: true,
    },
    ios: {
      language: "de-DE",
      appName: "FanMind",
    },
  });
});

test("credential-free validation profiles cannot be mistaken for signed betas", () => {
  assert.deepEqual(easConfig.build["native-validation"], {
    extends: "development",
    withoutCredentials: true,
    ios: {
      simulator: true,
    },
  });
  assert.equal(easConfig.build["preview-simulator"], undefined);
  assert.equal(easConfig.build.development.withoutCredentials, undefined);
  assert.equal(easConfig.build.preview.withoutCredentials, undefined);
  assert.equal(easConfig.build.production.withoutCredentials, undefined);
  for (const [name, profile] of Object.entries(easConfig.build)) {
    if (name === "native-validation") continue;
    assert.equal(profile.withoutCredentials, undefined, name);
    assert.equal(profile.android?.withoutCredentials, undefined, name);
    assert.equal(profile.ios?.withoutCredentials, undefined, name);
  }

  assert.equal(appConfig.expo.owner, undefined);
  assert.equal(appConfig.expo.extra?.eas?.projectId, undefined);
  assert.doesNotMatch(
    JSON.stringify(easConfig),
    /ascAppId|appleTeamId|serviceAccountKeyPath|EXPO_PUBLIC_|projectId/u,
  );
  assert.match(betaRelease, /kein signierter Beta-Build/iu);
});

test("protected environment values add the exact EAS binding at config evaluation time", () => {
  const ownerKey = "FANMIND_MOBILE_EXPECTED_EAS_OWNER";
  const projectKey = "FANMIND_MOBILE_EXPECTED_EAS_PROJECT_ID";
  const previousOwner = process.env[ownerKey];
  const previousProjectId = process.env[projectKey];
  try {
    delete process.env[ownerKey];
    delete process.env[projectKey];
    assert.equal(dynamicAppConfig({ config: appConfig.expo }).owner, undefined);

    process.env[ownerKey] = "bernds-tech";
    process.env[projectKey] = easProjectId.toUpperCase();
    const linked = dynamicAppConfig({ config: appConfig.expo });
    assert.equal(linked.owner, "bernds-tech");
    assert.equal(linked.extra.eas.projectId, easProjectId);
    assert.equal(linked.ios.bundleIdentifier, "ch.fanmind.app");
    assert.equal(linked.android.package, "ch.fanmind.app");

    delete process.env[projectKey];
    assert.throws(
      () => dynamicAppConfig({ config: appConfig.expo }),
      /FANMIND_MOBILE_EAS_BINDING_INVALID/u,
    );
  } finally {
    if (previousOwner === undefined) {
      delete process.env[ownerKey];
    } else {
      process.env[ownerKey] = previousOwner;
    }
    if (previousProjectId === undefined) {
      delete process.env[projectKey];
    } else {
      process.env[projectKey] = previousProjectId;
    }
  }
});

test("native configuration is regenerated in isolation and checked on both platforms", () => {
  assert.equal(packageJson.scripts["export:ios"], "expo export --platform ios --output-dir dist-ios");
  assert.equal(
    packageJson.scripts["native:prebuild:check"],
    "node scripts/check-native-prebuild.mjs",
  );
  assert.match(nativeVerifier, /mkdtemp/u);
  assert.match(nativeVerifier, /"prebuild"/u);
  assert.match(nativeVerifier, /"--platform",\s*"all"/u);
  assert.match(nativeVerifier, /__UNSAFE_EXPO_HOME_DIRECTORY/u);
  assert.match(nativeVerifier, /forbiddenNativeSecretIdentifiers/u);
  assert.match(nativeVerifier, /serverOnlyEnvironmentKeys/u);
  assert.match(nativeVerifier, /delete prebuildEnvironment\[key\]/u);
  assert.match(nativeVerifier, /TARGETED_DEVICE_FAMILY = "1";/u);
  assert.match(nativeVerifier, /iPad support requires a separate layout/u);
  assert.match(nativeVerifier, /await rm\(temporaryRoot/u);

  assert.match(gitignore, /\/apps\/mobile\/android\//u);
  assert.match(gitignore, /\/apps\/mobile\/ios\//u);
  assert.match(gitignore, /\/apps\/mobile\/dist-ios\//u);
});

test("Mobile CI proves Android and iOS config without claiming release-signed binaries", () => {
  assert.match(mobileCi, /npm run export:android/u);
  assert.match(mobileCi, /npm run export:ios/u);
  assert.match(mobileCi, /npm run native:prebuild:check/u);
  assert.match(mobileCi, /fanmind-mobile-native-prebuild-report/u);
  assert.match(mobileCi, /fanmind-mobile-android-javascript-export/u);
  assert.match(mobileCi, /fanmind-mobile-ios-javascript-export/u);
  assert.doesNotMatch(mobileCi, /fanmind-mobile-(?:android|ios)-bundle/u);
  assert.doesNotMatch(mobileCi, /eas (?:build|submit)|EXPO_TOKEN/u);

  assert.match(mobileNativeCi, /\.\/gradlew :app:assembleDebug/u);
  assert.match(mobileNativeCi, /xcodebuild/u);
  assert.match(mobileNativeCi, /CODE_SIGNING_ALLOWED=NO/u);
  assert.match(mobileNativeCi, /FanMind\.app/u);
  assert.match(mobileNativeCi, /not-for-release/u);
  assert.doesNotMatch(
    mobileNativeCi,
    /EXPO_TOKEN|eas (?:build|submit)|keystore|appleTeamId|ascAppId/u,
  );

  assert.match(mobileReadme, /Development-Client/u);
  assert.match(mobileReadme, /keine feste\s+EAS-Projekt-ID/u);
  assert.match(betaRelease, /native-validation/u);
  assert.match(betaRelease, /Expo-Konto und eine\s+echte EAS-Projekt-ID/u);
});

test("read-only Mobile release readiness accepts isolated preview and exact production resources", () => {
  const preview = evaluateMobileReleaseResources({
    appConfig: linkedAppConfig(),
    environment: releaseEnvironment(),
  });
  assert.deepEqual(preview, {
    environment: "preview",
    projectBinding: "verified",
    appIdentity: "verified",
    publicEnvironment: "verified",
    writeGates: "disabled",
  });

  const production = evaluateMobileReleaseResources({
    appConfig: linkedAppConfig(),
    environment: releaseEnvironment({
      FANMIND_MOBILE_RELEASE_ENVIRONMENT: "production",
      FANMIND_MOBILE_EXPECTED_SUPABASE_PROJECT_REF: productionProjectRef,
      FANMIND_MOBILE_EXPECTED_API_ORIGIN: "https://fanmind.ch",
      EXPO_PUBLIC_SUPABASE_URL:
        `https://${productionProjectRef}.supabase.co`,
      EXPO_PUBLIC_FANMIND_API_URL: "https://fanmind.ch",
    }),
  });
  assert.equal(production.environment, "production");
  assert.equal(production.publicEnvironment, "verified");
});

test("Mobile release readiness fails closed on missing EAS binding, production crossover, secret-like public values and write gates", () => {
  assert.throws(
    () =>
      evaluateMobileReleaseResources({
        appConfig,
        environment: releaseEnvironment(),
      }),
    { code: "eas_project_binding_invalid" },
  );
  assert.throws(
    () =>
      evaluateMobileReleaseResources({
        appConfig: linkedAppConfig(),
        environment: releaseEnvironment({
          FANMIND_MOBILE_EXPECTED_SUPABASE_PROJECT_REF:
            productionProjectRef,
          EXPO_PUBLIC_SUPABASE_URL:
            `https://${productionProjectRef}.supabase.co`,
        }),
      }),
    { code: "production_crossover" },
  );
  assert.throws(
    () =>
      evaluateMobileReleaseResources({
        appConfig: linkedAppConfig(),
        environment: releaseEnvironment({
          EXPO_PUBLIC_SUPABASE_ANON_KEY:
            ["sb", "secret", "synthetic-mobile-fixture"].join("_"),
        }),
      }),
    { code: "public_environment_secret_like" },
  );
  assert.throws(
    () =>
      evaluateMobileReleaseResources({
        appConfig: linkedAppConfig(),
        environment: releaseEnvironment({
          FANMIND_ENABLE_MOBILE_EAS_BUILD: "true",
        }),
      }),
    { code: "release_write_gate_enabled" },
  );
  assert.throws(
    () =>
      evaluateMobileReleaseResources({
        appConfig: linkedAppConfig(),
        environment: releaseEnvironment({
          EXPO_PUBLIC_UNREVIEWED_VALUE: "unexpected",
        }),
      }),
    { code: "public_environment_invalid" },
  );
  assert.doesNotMatch(
    releaseReadinessScript,
    /console\.(?:log|error)\([^)]*(?:EXPECTED_EAS|PROJECT_ID|SUPABASE_URL|ANON_KEY|API_URL)/u,
  );
  assert.match(releaseReadinessScript, /app\.config\.js/u);
});

test("manual Mobile release resource workflow is main-only, environment-bound and cannot build, submit or update", () => {
  assert.match(releaseReadinessWorkflow, /^\s*workflow_dispatch:/mu);
  assert.doesNotMatch(releaseReadinessWorkflow, /^\s*(?:push|pull_request):/mu);
  assert.match(
    releaseReadinessWorkflow,
    /github\.ref == 'refs\/heads\/main'/u,
  );
  assert.match(
    releaseReadinessWorkflow,
    /inputs\.confirmation == 'verify-mobile-release-resources'/u,
  );
  assert.match(
    releaseReadinessWorkflow,
    /name: mobile-\$\{\{ inputs\.release_environment \}\}/u,
  );
  assert.match(releaseReadinessWorkflow, /permissions:\s*\n\s+contents: read/u);
  assert.match(releaseReadinessWorkflow, /eas-cli@21\.2\.0 project:info/u);
  assert.match(releaseReadinessWorkflow, /eas-cli@21\.2\.0 env:exec/u);
  assert.match(
    releaseReadinessWorkflow,
    /FANMIND_ENABLE_MOBILE_EAS_BUILD: 'false'/u,
  );
  assert.match(
    releaseReadinessWorkflow,
    /FANMIND_ENABLE_MOBILE_EAS_SUBMIT: 'false'/u,
  );
  assert.match(
    releaseReadinessWorkflow,
    /FANMIND_ENABLE_MOBILE_EAS_UPDATE: 'false'/u,
  );
  assert.doesNotMatch(
    releaseReadinessWorkflow,
    /eas(?:-cli@[\d.]+)?\s+(?:build|submit|update|project:init|init)\b/u,
  );
  assert.doesNotMatch(
    releaseReadinessWorkflow,
    /credentials|keystore|ascAppId|appleTeamId|service[_-]?role/iu,
  );
  assert.match(
    releaseReadinessWorkflow,
    /project:info >"\$REPORT_PATH" 2>&1/u,
  );
  assert.match(
    releaseReadinessWorkflow,
    /--non-interactive >"\$REPORT_PATH" 2>&1/u,
  );
  assert.doesNotMatch(
    releaseReadinessWorkflow,
    /\bcat\s+"\$REPORT_PATH"|\becho\s+"\$(?:cat|<)/u,
  );
});

test("signed Mobile build gate accepts only one exact internal main build", () => {
  assert.deepEqual(
    evaluateMobileSignedBuildGate(signedBuildEnvironment()),
    {
      releaseEnvironment: "preview",
      buildProfile: "preview",
      platform: "android",
      buildClass: "internal",
      distribution: "internal",
      releaseCommit: "verified",
      submit: "disabled",
      update: "disabled",
    },
  );

  const queued = evaluateQueuedMobileBuild({
    environment: signedBuildEnvironment(),
    buildOutput: [
      {
        id: "123e4567-e89b-42d3-a456-426614174000",
        platform: "ANDROID",
        buildProfile: "preview",
        gitCommitHash: "a".repeat(40),
      },
    ],
  });
  assert.equal(queued.queue, "accepted");
  assert.equal(queued.releaseCommit, "verified");
});

test("signed Mobile completion binds the exact queued internal artifact without exposing its identifier", () => {
  assert.deepEqual(
    evaluateMobileSignedBuildCompletion({
      queueOutput: [queuedBuild()],
      completionOutput: completedBuild(),
      environment: signedBuildEnvironment(),
    }),
    {
      state: "verified",
      platform: "android",
      buildProfile: "preview",
      releaseCommit: "verified",
      distribution: "internal",
      artifact: "available",
    },
  );

  const pending = evaluateMobileSignedBuildCompletion({
    queueOutput: [queuedBuild()],
    completionOutput: completedBuild({
      status: "IN_PROGRESS",
      completedAt: null,
      artifacts: {},
    }),
    environment: signedBuildEnvironment(),
  });
  assert.equal(pending.state, "pending");
  assert.equal(pending.artifact, "not-ready");

  const failed = evaluateMobileSignedBuildCompletion({
    queueOutput: [queuedBuild()],
    completionOutput: completedBuild({
      status: "ERRORED",
      completedAt: "2026-07-31T13:00:00.000Z",
      artifacts: {},
    }),
    environment: signedBuildEnvironment(),
  });
  assert.equal(failed.state, "failed");
  assert.equal(failed.artifact, "unavailable");

  assert.doesNotMatch(
    signedBuildCompletionScript,
    /console\.(?:log|error)\([^)]*(?:\.id|ArchiveUrl|buildUrl|completionOutput|queueOutput)/u,
  );
});

test("Android Store build gate binds one Production AAB and keeps submission disabled", () => {
  assert.deepEqual(evaluateMobileSignedBuildGate(storeBuildEnvironment()), {
    releaseEnvironment: "production",
    buildProfile: "production",
    platform: "android",
    buildClass: "store",
    distribution: "store",
    releaseCommit: "verified",
    submit: "disabled",
    update: "disabled",
  });

  const queue = {
    ...queuedBuild(),
    buildProfile: "production",
  };
  const result = evaluateMobileSignedBuildCompletion({
    queueOutput: [queue],
    completionOutput: completedBuild({
      buildProfile: "production",
      distribution: "STORE",
      artifacts: {
        applicationArchiveUrl:
          "https://expo.dev/artifacts/eas/synthetic-store-build.aab",
      },
    }),
    environment: storeBuildEnvironment(),
  });
  assert.deepEqual(result, {
    state: "verified",
    platform: "android",
    buildProfile: "production",
    releaseCommit: "verified",
    distribution: "store",
    artifact: "available",
  });
});

test("Android Store receipt is redacted and commit-bound", async () => {
  const queue = [{ ...queuedBuild(), buildProfile: "production" }];
  const completion = completedBuild({
    buildProfile: "production",
    distribution: "STORE",
    artifacts: {
      applicationArchiveUrl:
        "https://expo.dev/artifacts/eas/synthetic-store-build.aab",
    },
  });
  const receipt = await createMobileSignedBuildReceipt({
    queueBytes: Buffer.from(JSON.stringify(queue)),
    completionBytes: Buffer.from(JSON.stringify(completion)),
    environment: storeBuildEnvironment(),
  });

  assert.equal(receipt.releaseCommit, "a".repeat(40));
  assert.equal(receipt.platform, "android");
  assert.equal(receipt.buildProfile, "production");
  assert.equal(receipt.distribution, "store");
  assert.equal(receipt.artifact, "available");
  assert.equal(receipt.submit, "disabled");
  assert.equal(receipt.update, "disabled");
  assert.match(receipt.queueSha256, /^[0-9a-f]{64}$/u);
  assert.match(receipt.completionSha256, /^[0-9a-f]{64}$/u);
  assert.equal("id" in receipt, false);
  assert.equal("url" in receipt, false);
});

test("Android Store gate rejects iOS, non-production targets and any automatic submission", () => {
  for (const environment of [
    storeBuildEnvironment({ FANMIND_MOBILE_BUILD_PLATFORM: "ios" }),
    storeBuildEnvironment({ FANMIND_MOBILE_BUILD_PROFILE: "preview" }),
    storeBuildEnvironment({ FANMIND_MOBILE_RELEASE_ENVIRONMENT: "preview" }),
    storeBuildEnvironment({ FANMIND_ENABLE_MOBILE_EAS_SUBMIT: "true" }),
    storeBuildEnvironment({ FANMIND_ENABLE_MOBILE_EAS_UPDATE: "true" }),
    storeBuildEnvironment({
      FANMIND_MOBILE_SIGNED_BUILD_CONFIRM: "queue-one-signed-mobile-build",
    }),
  ]) {
    assert.throws(() => evaluateMobileSignedBuildGate(environment));
  }
});

test("signed Mobile completion fails closed on identity drift, non-internal distribution, unknown state and unsafe artifact", () => {
  for (const completionOutput of [
    completedBuild({ id: "223e4567-e89b-42d3-a456-426614174000" }),
    completedBuild({ platform: "IOS" }),
    completedBuild({ buildProfile: "development" }),
    completedBuild({ gitCommitHash: "b".repeat(40) }),
    completedBuild({ distribution: "STORE" }),
    completedBuild({ status: "UNKNOWN" }),
    completedBuild({ completedAt: "not-a-timestamp" }),
    completedBuild({
      artifacts: { applicationArchiveUrl: "http://example.test/build.apk" },
    }),
    completedBuild({
      artifacts: { applicationArchiveUrl: "https://example.test/build.apk#fragment" },
    }),
  ]) {
    assert.throws(() =>
      evaluateMobileSignedBuildCompletion({
        queueOutput: [queuedBuild()],
        completionOutput,
        environment: signedBuildEnvironment(),
      }),
    );
  }
});

test("signed Mobile build gate blocks production, ref/profile drift, commit drift and release writes", () => {
  for (const environment of [
    signedBuildEnvironment({ GITHUB_REF: "refs/heads/feature" }),
    signedBuildEnvironment({
      FANMIND_MOBILE_RELEASE_ENVIRONMENT: "production",
      FANMIND_MOBILE_BUILD_PROFILE: "production",
    }),
    signedBuildEnvironment({ FANMIND_MOBILE_BUILD_PROFILE: "development" }),
    signedBuildEnvironment({
      FANMIND_MOBILE_EXPECTED_RELEASE_COMMIT: "b".repeat(40),
    }),
    signedBuildEnvironment({ FANMIND_ENABLE_MOBILE_EAS_BUILD: "false" }),
    signedBuildEnvironment({ FANMIND_ENABLE_MOBILE_EAS_SUBMIT: "true" }),
    signedBuildEnvironment({ FANMIND_ENABLE_MOBILE_EAS_UPDATE: "true" }),
  ]) {
    assert.throws(() => evaluateMobileSignedBuildGate(environment));
  }

  for (const buildOutput of [
    [
      {
        id: "123e4567-e89b-42d3-a456-426614174000",
        platform: "IOS",
        buildProfile: "preview",
        gitCommitHash: "a".repeat(40),
      },
    ],
    [
      {
        id: "123e4567-e89b-42d3-a456-426614174000",
        platform: "ANDROID",
        buildProfile: "preview",
        gitCommitHash: "b".repeat(40),
      },
    ],
    [],
    [
      {
        id: "123e4567-e89b-42d3-a456-426614174000",
        platform: "ANDROID",
        buildProfile: "preview",
        gitCommitHash: "a".repeat(40),
      },
      {
        id: "223e4567-e89b-42d3-a456-426614174000",
        platform: "ANDROID",
        buildProfile: "preview",
        gitCommitHash: "a".repeat(40),
      },
    ],
    [
      {
        id: "not-a-build-id",
        platform: "ANDROID",
        buildProfile: "preview",
        gitCommitHash: "a".repeat(40),
      },
    ],
  ]) {
    assert.throws(() =>
      evaluateQueuedMobileBuild({
        environment: signedBuildEnvironment(),
        buildOutput,
      }),
    );
  }
});

test("manual signed Mobile workflow is internal-only, credential-frozen and never submits", () => {
  assert.match(signedBuildWorkflow, /^\s*workflow_dispatch:/mu);
  assert.doesNotMatch(signedBuildWorkflow, /^\s*(?:push|pull_request):/mu);
  assert.match(signedBuildWorkflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(
    signedBuildWorkflow,
    /inputs\.confirmation == 'queue-one-signed-mobile-build'/u,
  );
  assert.match(
    signedBuildWorkflow,
    /name: mobile-\$\{\{ inputs\.build_environment \}\}/u,
  );
  assert.match(signedBuildWorkflow, /permissions:\s*\n\s+contents: read/u);
  assert.match(signedBuildWorkflow, /eas-cli@21\.2\.0 project:info/u);
  assert.match(signedBuildWorkflow, /eas-cli@21\.2\.0 env:exec/u);
  assert.match(signedBuildWorkflow, /eas-cli@21\.2\.0 build/u);
  assert.match(signedBuildWorkflow, /eas-cli@21\.2\.0 build:view/u);
  assert.match(signedBuildWorkflow, /--freeze-credentials/u);
  assert.match(signedBuildWorkflow, /--no-wait/u);
  assert.match(signedBuildWorkflow, /--json/u);
  assert.match(
    signedBuildWorkflow,
    /MOBILE_SIGNED_BUILD_QUEUE=indeterminate-do-not-retry/u,
  );
  assert.match(
    signedBuildWorkflow,
    /Do not rerun this workflow until the EAS dashboard/u,
  );
  assert.match(signedBuildWorkflow, /if \[\[ "\$QUEUE_EXIT" -ne 0 \]\]/u);
  assert.match(
    signedBuildWorkflow,
    /if ! node \.\.\/\.\.\/scripts\/operations\/mobile-signed-build-preflight\.mjs/u,
  );
  assert.match(
    signedBuildWorkflow,
    /scripts\/operations\/mobile-signed-build-completion\.mjs/u,
  );
  assert.match(signedBuildWorkflow, /MOBILE_SIGNED_BUILD_COMPLETION=verified/u);
  assert.match(signedBuildWorkflow, /MOBILE_SIGNED_BUILD_ARTIFACT=available/u);
  assert.match(signedBuildWorkflow, /timeout-minutes: 90/u);
  assert.match(signedBuildWorkflow, /timeout 10m npx --yes eas-cli@21\.2\.0 build/u);
  assert.match(signedBuildWorkflow, /timeout 10s npx --yes eas-cli@21\.2\.0 build:view/u);
  assert.match(signedBuildWorkflow, /sleep 30/u);
  assert.equal((signedBuildWorkflow.match(/umask 077/gu) ?? []).length, 4);
  assert.match(
    signedBuildWorkflow,
    /scripts\/operations\/write-mobile-signed-build-receipt\.mjs/u,
  );
  assert.match(
    signedBuildWorkflow,
    /fanmind-mobile-signed-build-receipt-\$\{\{ inputs\.build_environment \}\}-\$\{\{ inputs\.platform \}\}/u,
  );
  assert.match(signedBuildWorkflow, /retention-days: 5/u);
  assert.equal(
    (signedBuildWorkflow.match(/actions\/upload-artifact@/gu) ?? []).length,
    1,
  );
  assert.doesNotMatch(
    signedBuildWorkflow,
    /android_preview_apk|MOBILE_ANDROID_PREVIEW_APK|fanmind-preview\.apk|fanmind-android-preview-apk/u,
  );
  assert.doesNotMatch(
    signedBuildWorkflow,
    /eas(?:-cli@[\d.]+)?\s+(?:submit|update|credentials|build:submit)\b/u,
  );
  assert.doesNotMatch(signedBuildWorkflow, /--auto-submit/u);
  assert.doesNotMatch(signedBuildWorkflow, /\bproduction\b/u);
  assert.doesNotMatch(
    signedBuildWorkflow,
    /\bcat\s+"\$(?:JSON|LOG)_PATH"|\becho\s+"\$(?:cat|<)/u,
  );
  assert.doesNotMatch(
    signedBuildScript,
    /console\.(?:log|error)\([^)]*(?:EXPO_TOKEN|PROJECT_ID|build\?\.id|JSON_PATH)/u,
  );
  assert.doesNotMatch(
    signedBuildWorkflow,
    /\bcat\s+"\$(?:JSON|LOG|COMPLETION|VERIFICATION)_PATH"|\becho\s+"\$(?:cat|<)/u,
  );
});

test("manual Android Store workflow is Production-only, credential-frozen and never submits", () => {
  assert.match(storeBuildWorkflow, /^\s*workflow_dispatch:/mu);
  assert.doesNotMatch(storeBuildWorkflow, /^\s*(?:push|pull_request):/mu);
  assert.match(storeBuildWorkflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(
    storeBuildWorkflow,
    /inputs\.confirmation == 'queue-one-android-store-build'/u,
  );
  assert.match(storeBuildWorkflow, /name: mobile-production/u);
  assert.match(storeBuildWorkflow, /FANMIND_MOBILE_BUILD_CLASS: store/u);
  assert.match(storeBuildWorkflow, /FANMIND_ENABLE_MOBILE_EAS_SUBMIT: 'false'/u);
  assert.match(storeBuildWorkflow, /FANMIND_ENABLE_MOBILE_EAS_UPDATE: 'false'/u);
  assert.match(storeBuildWorkflow, /--platform android/u);
  assert.match(storeBuildWorkflow, /--profile production/u);
  assert.match(storeBuildWorkflow, /--freeze-credentials/u);
  assert.match(storeBuildWorkflow, /--no-wait/u);
  assert.match(storeBuildWorkflow, /build:view/u);
  assert.match(storeBuildWorkflow, /aab-available/u);
  assert.match(storeBuildWorkflow, /fanmind-mobile-store-build-receipt-android/u);
  assert.doesNotMatch(
    storeBuildWorkflow,
    /eas(?:-cli@[\d.]+)?\s+(?:submit|update|credentials|build:submit)\b/u,
  );
  assert.doesNotMatch(storeBuildWorkflow, /--auto-submit/u);
});

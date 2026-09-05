#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  cp,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const temporaryRoot = await mkdtemp(join(tmpdir(), "fanmind-mobile-native-"));
const generatedProject = join(temporaryRoot, "mobile");
const excludedRoots = new Set([
  ".expo",
  "android",
  "dist-android",
  "dist-ios",
  "ios",
  "node_modules",
]);
const textExtensions = new Set([
  "",
  ".c",
  ".cc",
  ".cpp",
  ".gradle",
  ".h",
  ".hpp",
  ".java",
  ".json",
  ".kt",
  ".m",
  ".mm",
  ".pbxproj",
  ".plist",
  ".properties",
  ".rb",
  ".sh",
  ".swift",
  ".xml",
  ".xcconfig",
]);
const forbiddenNativeSecretIdentifiers =
  /EXPO_TOKEN|OPENAI_API_KEY|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|SUPABASE_SERVICE_ROLE_KEY|sk_live_|sk_test_/u;
const serverOnlyEnvironmentKeys = [
  "EXPO_TOKEN",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
];

function shouldCopy(source) {
  const sourceRelative = relative(projectRoot, source);
  if (!sourceRelative) return true;

  const [root] = sourceRelative.split(sep);
  if (excludedRoots.has(root)) return false;

  const name = basename(source);
  if (name.startsWith(".env")) return false;
  if (name.endsWith("-report.txt")) return false;
  return true;
}

async function textFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const output = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await textFiles(path));
    else if (textExtensions.has(extname(entry.name))) output.push(path);
  }

  return output;
}

try {
  await cp(projectRoot, generatedProject, {
    recursive: true,
    filter: shouldCopy,
  });
  await symlink(
    join(projectRoot, "node_modules"),
    join(generatedProject, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  const expoCli = join(projectRoot, "node_modules", "expo", "bin", "cli");
  const prebuildEnvironment = { ...process.env };
  for (const key of serverOnlyEnvironmentKeys) {
    delete prebuildEnvironment[key];
  }
  const result = spawnSync(
    process.execPath,
    [
      expoCli,
      "prebuild",
      "--clean",
      "--no-install",
      "--platform",
      "all",
    ],
    {
      cwd: generatedProject,
      encoding: "utf8",
      env: {
        ...prebuildEnvironment,
        __UNSAFE_EXPO_HOME_DIRECTORY: join(temporaryRoot, "expo-home"),
        CI: "1",
        EXPO_NO_TELEMETRY: "1",
      },
      maxBuffer: 16 * 1024 * 1024,
    },
  );

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  if (result.error) throw result.error;
  assert.equal(result.status, 0, "Expo native prebuild must succeed.");

  const prebuildOutput = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  assert.doesNotMatch(
    prebuildOutput,
    /userInterfaceStyle.*preventing splash screen/iu,
    "The native splashscreen and interface-style configuration conflict.",
  );

  const [
    sourcePackage,
    generatedPackage,
    appConfig,
    androidGradle,
    androidManifest,
    androidStrings,
    androidColors,
    androidStyles,
    secureStoreBackupRules,
    secureStoreDataExtractionRules,
    iosInfoPlist,
    iosPrivacyManifest,
    iosProject,
    reactNativeAndroidVersions,
  ] = await Promise.all([
    readFile(join(projectRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(join(generatedProject, "package.json"), "utf8").then(JSON.parse),
    readFile(join(projectRoot, "app.json"), "utf8").then(JSON.parse),
    readFile(join(generatedProject, "android", "app", "build.gradle"), "utf8"),
    readFile(
      join(
        generatedProject,
        "android",
        "app",
        "src",
        "main",
        "AndroidManifest.xml",
      ),
      "utf8",
    ),
    readFile(
      join(
        generatedProject,
        "android",
        "app",
        "src",
        "main",
        "res",
        "values",
        "strings.xml",
      ),
      "utf8",
    ),
    readFile(
      join(
        generatedProject,
        "android",
        "app",
        "src",
        "main",
        "res",
        "values",
        "colors.xml",
      ),
      "utf8",
    ),
    readFile(
      join(
        generatedProject,
        "android",
        "app",
        "src",
        "main",
        "res",
        "values",
        "styles.xml",
      ),
      "utf8",
    ),
    readFile(
      join(
        generatedProject,
        "node_modules",
        "expo-secure-store",
        "android",
        "src",
        "main",
        "res",
        "xml",
        "secure_store_backup_rules.xml",
      ),
      "utf8",
    ),
    readFile(
      join(
        generatedProject,
        "node_modules",
        "expo-secure-store",
        "android",
        "src",
        "main",
        "res",
        "xml",
        "secure_store_data_extraction_rules.xml",
      ),
      "utf8",
    ),
    readFile(join(generatedProject, "ios", "FanMind", "Info.plist"), "utf8"),
    readFile(
      join(generatedProject, "ios", "FanMind", "PrivacyInfo.xcprivacy"),
      "utf8",
    ),
    readFile(
      join(
        generatedProject,
        "ios",
        "FanMind.xcodeproj",
        "project.pbxproj",
      ),
      "utf8",
    ),
    readFile(
      join(
        generatedProject,
        "node_modules",
        "react-native",
        "gradle",
        "libs.versions.toml",
      ),
      "utf8",
    ),
  ]);

  assert.deepEqual(
    generatedPackage.scripts,
    sourcePackage.scripts,
    "Expo prebuild must not rewrite the checked-in Mobile scripts.",
  );
  assert.equal(sourcePackage.dependencies["expo-dev-client"], "~57.0.18");
  assert.equal(sourcePackage.dependencies["expo-system-ui"], "~57.0.3");
  assert.ok(appConfig.expo.plugins.includes("expo-dev-client"));
  assert.ok(appConfig.expo.plugins.includes("expo-system-ui"));
  assert.equal(appConfig.expo.extra?.eas?.projectId, undefined);

  assert.match(androidGradle, /namespace 'ch\.fanmind\.app'/u);
  assert.match(androidGradle, /applicationId 'ch\.fanmind\.app'/u);
  assert.match(androidGradle, /compileSdk rootProject\.ext\.compileSdkVersion/u);
  assert.match(androidGradle, /targetSdkVersion rootProject\.ext\.targetSdkVersion/u);
  assert.match(reactNativeAndroidVersions, /^compileSdk = "36"$/mu);
  assert.match(reactNativeAndroidVersions, /^targetSdk = "36"$/mu);
  assert.match(androidManifest, /android:scheme="fanmind"/u);
  assert.match(androidManifest, /android:allowBackup="true"/u);
  assert.match(
    androidManifest,
    /android:fullBackupContent="@xml\/secure_store_backup_rules"/u,
  );
  assert.match(
    androidManifest,
    /android:dataExtractionRules="@xml\/secure_store_data_extraction_rules"/u,
  );
  assert.match(androidColors, /#020712/u);
  assert.match(
    androidStrings,
    /name="expo_system_ui_user_interface_style"[^>]*>dark<\/string>/u,
  );
  assert.match(androidStyles, /Theme\.App\.SplashScreen/u);
  assert.match(androidStyles, /Theme\.AppCompat\.DayNight\.NoActionBar/u);
  assert.doesNotMatch(
    androidManifest,
    /android\.permission\.(?:READ_CONTACTS|WRITE_CONTACTS|ACCESS_FINE_LOCATION|ACCESS_COARSE_LOCATION|CAMERA|RECORD_AUDIO|READ_MEDIA_IMAGES|READ_MEDIA_VIDEO)/u,
  );
  assert.deepEqual(appConfig.expo.android?.blockedPermissions, [
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
  ]);
  for (const permission of [
    "READ_EXTERNAL_STORAGE",
    "WRITE_EXTERNAL_STORAGE",
  ]) {
    const permissionReference = new RegExp(
      `android:name="android\\.permission\\.${permission}"`,
      "gu",
    );
    const removalDeclaration = new RegExp(
      `<uses-permission android:name="android\\.permission\\.${permission}" tools:node="remove"\\s*/>`,
      "u",
    );
    assert.equal(
      androidManifest.match(permissionReference)?.length,
      1,
      `${permission} must appear exactly once as a removal declaration.`,
    );
    assert.match(
      androidManifest,
      removalDeclaration,
      `${permission} must be removed from the merged Android manifest.`,
    );
  }
  assert.match(
    secureStoreBackupRules,
    /<exclude domain="sharedpref" path="SecureStore"\/>/u,
  );
  assert.equal(
    secureStoreDataExtractionRules.match(
      /<exclude domain="sharedpref" path="SecureStore"\/>/gu,
    )?.length,
    2,
  );

  assert.match(iosProject, /PRODUCT_BUNDLE_IDENTIFIER = "ch\.fanmind\.app";/u);
  assert.match(
    iosProject,
    /TARGETED_DEVICE_FAMILY = "1";/u,
    "The first iOS release must target iPhone only.",
  );
  assert.doesNotMatch(
    iosProject,
    /TARGETED_DEVICE_FAMILY = "?1,2"?;/u,
    "iPad support requires a separate layout, device and screenshot acceptance.",
  );
  assert.match(iosInfoPlist, /<string>fanmind<\/string>/u);
  assert.match(
    iosInfoPlist,
    /<key>ITSAppUsesNonExemptEncryption<\/key>\s*<false\/>/u,
  );
  assert.match(
    iosInfoPlist,
    /<key>UIUserInterfaceStyle<\/key>\s*<string>Dark<\/string>/u,
  );
  assert.match(iosInfoPlist, /Expo Dev Launcher uses the local network/u);
  assert.doesNotMatch(
    iosInfoPlist,
    /NS(?:Camera|Contacts|Location|Microphone|PhotoLibrary)UsageDescription/u,
  );
  assert.match(
    iosPrivacyManifest,
    /<key>NSPrivacyTracking<\/key>\s*<false\/>/u,
  );
  assert.match(
    iosPrivacyManifest,
    /<key>NSPrivacyTrackingDomains<\/key>\s*(?:<array\/>|<array>\s*<\/array>)/u,
  );
  assert.match(
    iosPrivacyManifest,
    /<key>NSPrivacyCollectedDataTypes<\/key>\s*(?:<array\/>|<array>\s*<\/array>)/u,
  );
  for (const value of [
    "NSPrivacyAccessedAPICategoryUserDefaults",
    "NSPrivacyAccessedAPICategoryFileTimestamp",
    "NSPrivacyAccessedAPICategorySystemBootTime",
    "NSPrivacyAccessedAPICategoryDiskSpace",
    "CA92.1",
    "0A2A.1",
    "3B52.1",
    "C617.1",
    "35F9.1",
    "85F4.1",
    "E174.1",
  ]) {
    assert.match(
      iosPrivacyManifest,
      new RegExp(`<string>${value.replace(".", "\\.")}</string>`, "u"),
    );
  }

  await Promise.all([
    access(
      join(
        generatedProject,
        "android",
        "app",
        "src",
        "main",
        "res",
        "drawable-xxxhdpi",
        "splashscreen_logo.png",
      ),
    ),
    access(
      join(
        generatedProject,
        "ios",
        "FanMind",
        "Images.xcassets",
        "SplashScreenLogo.imageset",
        "image@3x.png",
      ),
    ),
    access(
      join(
        generatedProject,
        "android",
        "app",
        "src",
        "main",
        "res",
        "mipmap-xxxhdpi",
        "ic_launcher_foreground.webp",
      ),
    ),
    access(
      join(
        generatedProject,
        "android",
        "app",
        "src",
        "main",
        "res",
        "drawable-xxxhdpi",
        "notification_icon.png",
      ),
    ),
    access(
      join(
        generatedProject,
        "ios",
        "FanMind",
        "Images.xcassets",
        "AppIcon.appiconset",
        "App-Icon-1024x1024@1x.png",
      ),
    ),
  ]);

  const generatedNativeFiles = [
    ...await textFiles(join(generatedProject, "android")),
    ...await textFiles(join(generatedProject, "ios")),
  ];
  for (const file of generatedNativeFiles) {
    const content = await readFile(file, "utf8");
    assert.doesNotMatch(
      content,
      forbiddenNativeSecretIdentifiers,
      `Server-side secret identifier found in ${relative(generatedProject, file)}.`,
    );
  }

  console.log(
    `FanMind native prebuild verified for Android and iOS (${generatedNativeFiles.length} generated text files).`,
  );
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

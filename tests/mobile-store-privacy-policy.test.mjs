import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateStoreReadiness,
  verifyStoreReadiness,
} from "../apps/mobile/scripts/check-store-readiness.mjs";

const read = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("iOS privacy manifest config matches the installed native SDK reasons", async () => {
  const appConfig = JSON.parse(await read("apps/mobile/app.json"));
  const manifest = appConfig.expo.ios?.privacyManifests;

  assert.ok(manifest);
  assert.equal(manifest.NSPrivacyTracking, false);
  assert.deepEqual(manifest.NSPrivacyTrackingDomains, []);
  assert.equal(manifest.NSPrivacyCollectedDataTypes, undefined);

  const accessedApiTypes = Object.fromEntries(
    manifest.NSPrivacyAccessedAPITypes.map((entry) => [
      entry.NSPrivacyAccessedAPIType,
      [...entry.NSPrivacyAccessedAPITypeReasons].sort(),
    ]),
  );

  assert.deepEqual(accessedApiTypes, {
    NSPrivacyAccessedAPICategoryDiskSpace: ["85F4.1", "E174.1"],
    NSPrivacyAccessedAPICategoryFileTimestamp: [
      "0A2A.1",
      "3B52.1",
      "C617.1",
    ],
    NSPrivacyAccessedAPICategorySystemBootTime: ["35F9.1"],
    NSPrivacyAccessedAPICategoryUserDefaults: ["CA92.1"],
  });
});

test("Android notification branding is white, transparent and channel-bound", async () => {
  const [appConfigSource, iconSource, notificationSource] = await Promise.all([
    read("apps/mobile/app.json"),
    read("apps/mobile/assets/branding/fanmind-notification-icon-source.svg"),
    read("apps/mobile/src/lib/pushNotifications.ts"),
  ]);
  const appConfig = JSON.parse(appConfigSource);
  const notificationPlugin = appConfig.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-notifications",
  );

  assert.ok(notificationPlugin);
  assert.deepEqual(notificationPlugin[1], {
    icon: "./assets/branding/fanmind-notification-icon.png",
    color: "#149EF2",
    defaultChannel: "followup-reminders",
  });
  assert.match(iconSource, /width="96" height="96" viewBox="0 0 96 96"/u);
  assert.match(iconSource, /fill="#ffffff"/u);
  assert.doesNotMatch(iconSource, /<rect|fill="#(?:0{6}|149EF2)"/u);
  assert.match(
    notificationSource,
    /FOLLOWUP_NOTIFICATION_CHANNEL_ID = "followup-reminders"/u,
  );
  assert.match(notificationSource, /lightColor: "#149EF2"/u);
});

test("native prebuild enforces store API, privacy and least-permission boundaries", async () => {
  const [source, appConfigSource] = await Promise.all([
    read("apps/mobile/scripts/check-native-prebuild.mjs"),
    read("apps/mobile/app.json"),
  ]);
  const appConfig = JSON.parse(appConfigSource);

  assert.match(source, /PrivacyInfo\.xcprivacy/u);
  assert.match(source, /\^compileSdk = "36"\$/u);
  assert.match(source, /\^targetSdk = "36"\$/u);
  assert.match(source, /NSPrivacyAccessedAPICategoryUserDefaults/u);
  assert.match(source, /NSPrivacyAccessedAPICategoryFileTimestamp/u);
  assert.match(source, /NSPrivacyAccessedAPICategorySystemBootTime/u);
  assert.match(source, /NSPrivacyAccessedAPICategoryDiskSpace/u);
  assert.match(source, /READ_CONTACTS\|WRITE_CONTACTS/u);
  assert.match(source, /ACCESS_FINE_LOCATION\|ACCESS_COARSE_LOCATION/u);
  assert.match(source, /CAMERA\|RECORD_AUDIO/u);
  assert.match(source, /READ_EXTERNAL_STORAGE/u);
  assert.match(source, /WRITE_EXTERNAL_STORAGE/u);
  assert.match(source, /tools:node="remove"/u);
  assert.match(source, /READ_MEDIA_IMAGES\|READ_MEDIA_VIDEO/u);
  assert.deepEqual(appConfig.expo.android?.blockedPermissions, [
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
  ]);
  assert.match(
    source,
    /NS\(\?:Camera\|Contacts\|Location\|Microphone\|PhotoLibrary\)UsageDescription/u,
  );
});

test("store privacy draft stays synchronized with the current mobile boundary", async () => {
  const [
    privacyDraft,
    storeListing,
    playHandoff,
    appStoreHandoff,
    appStoreWorksheet,
    reviewAccess,
    testerProgram,
    supportPage,
    pushSource,
    registrationSource,
    aiRoute,
  ] = await Promise.all([
    read("docs/mobile/STORE_PRIVACY_DECLARATIONS.md"),
    read("docs/mobile/STORE_LISTING.md"),
    read("docs/mobile/GOOGLE_PLAY_HANDOFF.md"),
    read("docs/mobile/APP_STORE_HANDOFF.md"),
    read("docs/mobile/APP_STORE_CONNECT_WORKSHEET.md"),
    read("docs/mobile/STORE_REVIEW_ACCESS.md"),
    read("docs/mobile/STORE_TESTER_PROGRAM.md"),
    read("src/app/support/page.tsx"),
    read("apps/mobile/src/lib/pushNotifications.ts"),
    read("apps/mobile/src/lib/mobilePushRegistration.ts"),
    read("src/app/api/ai/reply-suggestions/route.ts"),
  ]);

  assert.match(
    privacyDraft,
    /technische, repository-gebundene Arbeitsvorlage/u,
  );
  assert.match(privacyDraft, /keine rechtliche\s+Freigabe/u);
  assert.match(privacyDraft, /https:\/\/fanmind\.ch\/datenschutz/u);
  assert.match(privacyDraft, /https:\/\/fanmind\.ch\/account-deletion/u);
  assert.match(privacyDraft, /kein Mobile-Werbe-SDK/u);
  assert.match(privacyDraft, /greift nicht auf das Geräteadressbuch/u);
  assert.match(
    privacyDraft,
    /fordert eine Push-Berechtigung ausschließlich nach ausdrücklichem Opt-in/u,
  );
  assert.match(privacyDraft, /Identifiers – Device ID \| Ja \| Ja \| Nein/u);
  assert.match(privacyDraft, /Device or other IDs \| Ja \| Vorläufig Nein/u);
  assert.match(privacyDraft, /Zustellung noch deaktiviert/u);
  assert.match(privacyDraft, /Apple App Privacy/u);
  assert.match(privacyDraft, /Google Play Data Safety/u);
  assert.match(privacyDraft, /Contact Info – Name \| Ja/u);
  assert.match(privacyDraft, /Personal info – Name \| Ja/u);
  assert.match(privacyDraft, /In-app search history \| Ja/u);
  assert.match(privacyDraft, /Push-Aktivierungsgrenze/u);
  assert.match(storeListing, /STORE_PRIVACY_DECLARATIONS\.md/u);
  assert.match(storeListing, /GOOGLE_PLAY_HANDOFF\.md/u);
  assert.match(storeListing, /https:\/\/fanmind\.ch\/support/u);
  assert.match(storeListing, /Google-Play-Support-E-Mail \| `kontakt@fanmind\.ch`/u);
  assert.match(storeListing, /32-Bit-PNG mit Alpha-Kanal/u);
  assert.match(storeListing, /## Apple - Suchbegriffe DE/u);
  assert.match(storeListing, /## Apple - Keywords EN/u);
  assert.match(storeListing, /1320 × 2868/u);
  assert.match(
    playHandoff,
    /e96415035ffbe12f16dd3b81e13a5e62b2c4ac00/u,
  );
  assert.match(playHandoff, /Keinen neuen Build starten/u);
  assert.match(playHandoff, /bereits verifizierte `1\.0\.0`-AAB/u);
  assert.match(
    playHandoff,
    /iPhone-App-Store-Metadaten dürfen separat vorbereitet/u,
  );
  assert.match(playHandoff, /private,\s+vollständig `pending`/u);
  assert.match(playHandoff, /Installation aus dem Play-Test-Track/u);
  assert.match(appStoreHandoff, /keinen iOS-Build/u);
  assert.match(appStoreHandoff, /kein TestFlight/u);
  assert.match(appStoreHandoff, /1320 × 2868/u);
  assert.match(appStoreHandoff, /APP_STORE_CONNECT_WORKSHEET\.md/u);
  assert.match(appStoreWorksheet, /Digital Services Act \(DSA\) Status/u);
  assert.match(appStoreWorksheet, /\| 3 \| Description \| READY \|/u);
  assert.match(appStoreWorksheet, /\| 4 \| Keywords \| READY \|/u);
  assert.match(appStoreWorksheet, /\| 5 \| Promotional Text \| READY \|/u);
  assert.match(appStoreWorksheet, /Privacy Choices URL/u);
  assert.match(appStoreWorksheet, /Accessibility Support/u);
  assert.match(appStoreWorksheet, /dreizehn\s+`READY`/u);
  assert.match(appStoreWorksheet, /zwölf\s+`OWNER_REQUIRED`/u);
  assert.match(appStoreWorksheet, /acht\s+`PHASE8_REQUIRED`/u);
  assert.match(appStoreWorksheet, /kein iOS-Build/iu);
  assert.match(appStoreWorksheet, /kein TestFlight/iu);
  assert.match(appStoreWorksheet, /niemals im Repository/u);
  assert.match(
    appStoreWorksheet,
    /account-deletion` nicht ungeprüft gleichsetzen/u,
  );
  assert.match(reviewAccess, /niemals im Repository/u);
  assert.match(reviewAccess, /24\/7/u);
  assert.match(testerProgram, /12 Tester \/ 14 Tage/u);
  assert.match(testerProgram, /keinen neuen Build starten/iu);
  assert.match(supportPage, /kontakt@fanmind\.ch/u);
  assert.match(supportPage, /Sende niemals dein Passwort/u);

  assert.doesNotMatch(pushSource, /requestPermissionsAsync/u);
  assert.doesNotMatch(pushSource, /getExpoPushTokenAsync/u);
  assert.match(registrationSource, /requestPermissionsAsync/u);
  assert.match(registrationSource, /getExpoPushTokenAsync/u);
  assert.doesNotMatch(registrationSource, /scheduleNotificationAsync/u);
  assert.match(aiRoute, /store:\s*false/u);

  await Promise.all([
    access(new URL("../src/app/datenschutz/page.tsx", import.meta.url)),
    access(new URL("../src/app/account-deletion/page.tsx", import.meta.url)),
    access(new URL("../src/app/support/page.tsx", import.meta.url)),
  ]);
});

test("store metadata, confirmed branding and EAS submission stay release-safe", async () => {
  const result = await verifyStoreReadiness();

  assert.deepEqual(result, {
    localizations: 2,
    screenshotSlots: 6,
    easCli: "21.2.0",
    submissionMode: "internal-draft",
    storeAssets: 2,
    iosReleaseScope: "metadata-only",
    applePortalFields: 33,
    applePortalReady: 13,
    applePortalOwnerRequired: 12,
    applePortalPhase8Required: 8,
  });

  const [
    appConfig,
    easConfig,
    mobilePackage,
    mobileLock,
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
  ] =
    await Promise.all([
      read("apps/mobile/app.json").then(JSON.parse),
      read("apps/mobile/eas.json").then(JSON.parse),
      read("apps/mobile/package.json").then(JSON.parse),
      read("apps/mobile/package-lock.json").then(JSON.parse),
      read("docs/mobile/STORE_LISTING.md"),
      read("docs/mobile/APP_STORE_HANDOFF.md"),
      read("docs/mobile/APP_STORE_CONNECT_WORKSHEET.md"),
      read("docs/mobile/STORE_REVIEW_ACCESS.md"),
      read("docs/mobile/STORE_TESTER_PROGRAM.md"),
      read("apps/mobile/assets/store/google-play-feature-graphic-source.svg"),
      readFile(
        new URL(
          "../apps/mobile/assets/branding/fanmind-wordmark.png",
          import.meta.url,
        ),
      ),
      readFile(
        new URL(
          "../apps/mobile/assets/branding/fanmind-app-icon.png",
          import.meta.url,
        ),
      ),
      readFile(
        new URL(
          "../apps/mobile/assets/branding/fanmind-adaptive-icon.png",
          import.meta.url,
        ),
      ),
      readFile(
        new URL(
          "../apps/mobile/assets/store/google-play-icon.png",
          import.meta.url,
        ),
      ),
      readFile(
        new URL(
          "../apps/mobile/assets/store/google-play-feature-graphic.png",
          import.meta.url,
        ),
      ),
    ]);

  const validInput = {
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
  };

  assert.equal(mobilePackage.devDependencies.sharp, "0.35.3");
  assert.equal(mobileLock.packages["node_modules/sharp"].version, "0.35.3");
  assert.equal(playIcon[25], 6);
  assert.equal(playFeatureGraphic[25], 2);

  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        appStoreWorksheet: appStoreWorksheet.replace(
          "AI CRM: contacts & follow-ups",
          "Unverified English subtitle",
        ),
      }),
    /store_app_store_portal_identity_invalid/u,
  );
  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        listing: listing.replace(
          "AI CRM: contacts & follow-ups",
          "Random subtitle under 30 chars",
        ),
      }),
    /store_app_store_portal_identity_invalid/u,
  );

  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        appStoreWorksheet: appStoreWorksheet.replaceAll(
          "https://developer.apple.com",
          "https://example.invalid",
        ),
      }),
    /store_app_store_portal_boundary_missing/u,
  );

  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        appStoreWorksheet: appStoreWorksheet.replace(
          "| 8 | SKU | OWNER_REQUIRED |",
          "| 8 | SKU | READY |",
        ),
      }),
    /store_app_store_portal_matrix_invalid/u,
  );
  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        listing: listing.replace(
          "KI-CRM: Kontakte & Follow-ups",
          "KI-CRM für Kontakte und Follow-ups",
        ),
      }),
    /store_subtitle_de_length_invalid/u,
  );
  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        easConfig: {
          ...easConfig,
          submit: { production: {} },
        },
      }),
    /store_submission_safety_contract_invalid/u,
  );
  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        listing: listing.replace("kontakt@fanmind.ch", "help@example.com"),
      }),
    /store_identity_document_mismatch/u,
  );
  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        listing: listing.replace(
          "CRM,contacts,follow-ups,replies,AI,creators,fans,contact memory",
          "x".repeat(101),
        ),
      }),
    /store_apple_keywords_en_length_invalid/u,
  );
  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        listing: listing.replace(
          "CRM,contacts,follow-ups,replies,AI,creators,fans,contact memory",
          "CRM,Kontakte,Follow-up,Antworten,KI,Creator,Fans,Kontaktwissen",
        ),
      }),
    /store_apple_keyword_localizations_not_distinct/u,
  );

  assert.doesNotThrow(() =>
    evaluateStoreReadiness({
      ...validInput,
      featureSource: featureSource.replace(/\n/gu, "\r\n"),
    }),
  );

  const changedFeatureGraphic = Buffer.from(playFeatureGraphic);
  changedFeatureGraphic[changedFeatureGraphic.length - 1] ^= 1;
  assert.throws(
    () =>
      evaluateStoreReadiness({
        ...validInput,
        playFeatureGraphic: changedFeatureGraphic,
      }),
    /store_play_assets_not_confirmed/u,
  );
});

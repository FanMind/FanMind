import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

import {
  buildRegistrationHref,
  isDailyTestRegistration,
  isProductiveRegistrationEntry,
  normalizeStarterOfferOption,
} from "../src/lib/registrationEntryPolicy.mjs";

async function source(path) {
  return readFile(path, "utf8");
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory() && ["node_modules", ".expo", ".next"].includes(entry.name)) {
      return [];
    }
    return entry.isDirectory() ? walkFiles(path) : [path];
  }));
  return nested.flat();
}

test("Starter landing entries use valid plan IDs and preserve option, language and referral", () => {
  assert.equal(
    buildRegistrationHref({
      language: "de",
      planId: "starter",
      starterOption: "starter_paid_setup",
    }),
    "/register?plan=starter&option=starter_paid_setup",
  );
  assert.equal(
    buildRegistrationHref({
      language: "en",
      planId: "starter",
      starterOption: "starter_no_setup_commitment",
      referralCode: "FM-ABC123",
    }),
    "/register?plan=starter&option=starter_no_setup_commitment&lang=en&ref=FM-ABC123",
  );
  assert.equal(normalizeStarterOfferOption("starter_no_setup_commitment"), "starter_no_setup_commitment");
  assert.equal(normalizeStarterOfferOption("starter-12"), "starter_paid_setup");
});

test("daily registration is productive only behind the flag and exact daily selector", () => {
  const validDaily = { enabled: true, planId: "pilot", testPlan: "daily" };
  assert.equal(isDailyTestRegistration(validDaily), true);
  assert.equal(isProductiveRegistrationEntry(validDaily), true);
  assert.equal(isDailyTestRegistration({ ...validDaily, enabled: false }), false);
  assert.equal(isDailyTestRegistration({ ...validDaily, testPlan: "Daily" }), false);
  assert.equal(isDailyTestRegistration({ ...validDaily, testPlan: undefined }), false);
  assert.equal(isProductiveRegistrationEntry({ enabled: true, planId: "pilot" }), false);
  assert.equal(isProductiveRegistrationEntry({ planId: "starter" }), true);
});

test("paused registration keeps Starter pricing visible without enabling paid activation", async () => {
  const registerPage = await source("src/app/register/page.tsx");

  assert.match(
    registerPage,
    /if \(!isPaymentTermsActivationEnabled\(\)\)[\s\S]*Starter Flex[\s\S]*990 € Setup \+ 312 €\/Monat[\s\S]*Starter 12[\s\S]*0 € Setup \+ 312 €\/Monat/u,
  );
  assert.match(registerPage, /PAYMENT_TERMS_ACTIVATION_BLOCK_CODE/u);
  assert.match(registerPage, /Kostenlose Demo starten/u);
});

test("active product surfaces no longer route to retired Pilot registration", async () => {
  const [landing, register, onboarding, dashboard, admin] = await Promise.all([
    source("src/app/landing-v2/page.tsx"),
    source("src/app/register/RegisterClient.tsx"),
    source("src/app/onboarding/page.tsx"),
    source("src/app/dashboard/page.tsx"),
    source("src/app/admin/billing/page.tsx"),
  ]);

  assert.match(landing, /plan=starter&option=starter_paid_setup/u);
  assert.match(landing, /plan=starter&option=starter_no_setup_commitment/u);
  assert.doesNotMatch(landing, /plan=starter-(?:flex|12)/u);
  assert.match(register, /isRetiredPilotRequested \? "starter" : resolvedPlanId/u);
  assert.match(register, /selectedCommercialOption[^=]*= isDailyTestPlanSelected/u);
  assert.match(register, /requiresPaymentTermsAcceptance\(selectedPlanId, selectedCommercialOption\)/u);
  assert.match(register, /required=\{requiresPaymentTermsAcceptance\(selectedPlanId, commercialOption\)\}/u);
  assert.doesNotMatch(onboarding, /<strong>Pilot \/ Setup<\/strong>/u);
  assert.doesNotMatch(dashboard, /Wenn du nach dem Pilot weiter/u);
  assert.doesNotMatch(admin, /href: "\/register\?plan=pilot"/u);
  assert.match(admin, /label="Pilot-Demos"|label: "Pilot-Demos"/u);
  assert.match(admin, /label: "Kostenlose Demo öffnen", href: "\/login"/u);
});

test("FanMind contains no tracked foreign branding or obsolete brand asset path", async () => {
  const foreignBrand = ["well", "fit"].join("");
  const obsoleteBrandAssetPath = ["public/brands", "Logo.png"].join("/");
  const obsoleteSvgAssetPath = ["public/assets", `${foreignBrand}-logo.svg`].join("/");
  const facebookSelector = await source("src/app/channels/facebook/select/page.tsx");
  assert.match(facebookSelector, /import \{ FanMindLogo \}/u);
  assert.match(facebookSelector, /<FanMindLogo/u);
  assert.equal(facebookSelector.includes(obsoleteBrandAssetPath.replace(/^public/u, "")), false);
  assert.doesNotMatch(facebookSelector, /next\/image/iu);

  assert.equal(await exists(obsoleteBrandAssetPath), false);
  assert.equal(await exists(obsoleteSvgAssetPath), false);
  assert.equal(await exists("apps/mobile/assets/branding/fanmind-wordmark.png"), true);
  assert.equal(await exists("public/assets/fanmind-social-avatar.png"), true);

  const files = (
    await Promise.all(["src", "public", "apps/mobile"].map(walkFiles))
  ).flat();
  const textExtensions = /\.(?:css|html|js|json|md|mjs|mts|svg|ts|tsx|txt|xml)$/u;
  const textFiles = files.filter((path) => textExtensions.test(path));
  const text = (await Promise.all(textFiles.map(source))).join("\n");

  assert.equal(files.some((path) => path.toLowerCase().includes(foreignBrand)), false);
  assert.equal(text.toLowerCase().includes(foreignBrand), false);
  assert.equal(text.includes(obsoleteBrandAssetPath.replace(/^public/u, "")), false);
});

test("completion tracker keeps every weighted block and supporting work line", async () => {
  const tracker = await source("docs/operations/P0_COMPLETION_TRACKER.md");
  const requiredRows = [
    ["A-01", "Isoliertes Staging – Infrastruktur/Deploy/Readiness"],
    ["A-02", "Restore-Drill"],
    ["A-03", "Mobile Signing/TestFlight"],
    ["A-04", "Offline/Push/Stores"],
    ["A-05", "Security/Dependencies"],
    ["A-06", "Recht/Steuer/AVV"],
    ["A-07", "Meta Events Manager"],
    ["A-08", "KI Standard/Plus/Ultra"],
    ["W-01", "Restore-Datenbankkontrolle und checksum-only Prüfung"],
    ["W-02", "Isolierter Restore-Drill"],
    ["W-03", "KI Plus/Ultra und Stripe-Abnahme"],
    ["W-04", "Meta-Abschluss"],
    ["W-05", "Mobile Signing, Android-Beta und TestFlight"],
    ["W-06", "Push, Gerätetests und Store-Unterlagen"],
    ["W-07", "Technische Rechts-/AVV-Unterlagen"],
    ["W-08", "Externe Rechts-/Steuerfreigaben"],
    ["W-09", "Roadmap Phase 1–7 und Umsatzmodell"],
  ];

  for (const [id, label] of requiredRows) {
    assert.match(
      tracker,
      new RegExp(`\\| ${id} \\|[^\\n]*\\| ${label.replaceAll("/", "\\/")} \\|`, "u"),
    );
    assert.equal((tracker.match(new RegExp(`\\| ${id} \\|`, "gu")) ?? []).length, 1);
  }
  assert.match(tracker, /W-\*.*nicht nochmals.*Gesamtwert/isu);
  assert.match(tracker, /Produkt-\/MVP-Stand: \*\*ca\. 89 %\*\*/u);
  assert.match(tracker, /Abschlussreife der acht Blöcke: \*\*ca\. 85 %\*\*/u);
  assert.match(tracker, /Repository-technische Vorbereitung: \*\*ca\. 89 %\*\*/u);
  assert.match(
    tracker,
    /echte isolierte Staging[\s\S]*ist abgeschlossen[\s\S]*keine offene Staging-Infrastruktur/iu,
  );
});

test("channel phases stay unique and phase 8 records only the Website AI foundation", async () => {
  const [roadmap, publicRoadmap, adminRoadmap, sourceOfTruth, readme, tracker, databaseSchema] = await Promise.all([
    source("src/config/roadmap.ts"),
    source("src/app/roadmap/page.tsx"),
    source("src/app/admin/roadmap/page.tsx"),
    source("docs/SOURCE_OF_TRUTH.md"),
    source("README.md"),
    source("docs/operations/P0_COMPLETION_TRACKER.md"),
    source("docs/database/fanmind_current_schema.md"),
  ]);

  const phase3 = roadmap.split('phase: "Phase 3"')[1]?.split('phase: "Phase 4"')[0] ?? "";
  const phase7 = roadmap.split('phase: "Phase 7"')[1]?.split('phase: "Phase 8"')[0] ?? "";
  const phase8 = roadmap.split('phase: "Phase 8"')[1]?.split('phase: "Phase 9"')[0] ?? "";
  const phase15 = roadmap.split('phase: "Phase 15"')[1] ?? "";

  assert.match(phase3, /Facebook[\s\S]*Instagram[\s\S]*WhatsApp/u);
  assert.doesNotMatch(phase3, /TikTok|X \/ Twitter|Discord|OnlyFans|LinkedIn/u);
  assert.match(phase7, /TikTok[\s\S]*X \/ Twitter[\s\S]*Discord[\s\S]*OnlyFans/u);
  assert.match(phase7, /label: "OnlyFans", state: "later", status: "Roadmap"/u);
  assert.doesNotMatch(phase7, /Facebook|Instagram|WhatsApp|LinkedIn/u);
  assert.match(phase8, /Website-KI, iOS & weitere Kanäle[\s\S]*LinkedIn[\s\S]*Internationale Plattformen/u);
  assert.match(phase8, /label: "Telegram"[\s\S]*state: "later"[\s\S]*status: "Bot-\/Webhook-Grundlage vorbereitet · inaktiv; Anbindung nicht begonnen"/u);
  assert.doesNotMatch(phase8, /YouTube, Threads, Reddit & Telegram/u);
  assert.match(roadmap, /"YouTube, Threads & Reddit"/u);
  assert.match(roadmap, /"Bot-\/Webhook-Grundlage vorbereitet · inaktiv; Anbindung nicht begonnen"/u);
  assert.match(phase8, /status: "Website-KI begonnen · übrige Anbindungen später"/u);
  assert.match(phase8, /availability: "later"/u);
  assert.equal((phase8.match(/state: "partial"/gu) ?? []).length, 2);
  assert.doesNotMatch(phase8, /state: "done"|state: "progress"|state: "planned"/u);
  assert.doesNotMatch(phase8, /Facebook|Instagram|WhatsApp|TikTok|X \/ Twitter|Discord|OnlyFans/u);
  assert.match(phase15, /Segmente & Listen[\s\S]*Segment-Ansichten[\s\S]*Listenlogik[\s\S]*Filter & Tags[\s\S]*CSV-Import für Segmente nutzen/u);
  assert.match(publicRoadmap, /import \{ roadmapPhases, type RoadmapPhase \} from "@\/config\/roadmap"/u);
  assert.doesNotMatch(publicRoadmap, /const available:|const inProgress:|const comingSoon:/u);
  assert.match(adminRoadmap, /Alle Phasen sind fortlaufend nummeriert/u);
  assert.doesNotMatch(adminRoadmap, /01 bis 13/u);
  for (const document of [sourceOfTruth, readme, tracker]) {
    assert.match(document, /Phase 3[\s\S]{0,120}(?:Facebook|Meta)/u);
    assert.match(document, /Phase 7[\s\S]{0,120}TikTok/u);
    assert.match(document, /Phase 8[\s\S]{0,120}LinkedIn/u);
    assert.match(document, /Website-KI|Website-Assistent/u);
  }
  for (const document of [sourceOfTruth, readme]) {
    assert.match(document, /vorbereitet(?:es|,)[\s\S]{0,100}Inbox-Handoff/iu);
    assert.match(
      document,
      /Production besitzt `assigned_user_id` noch\s+nicht;[\s\S]{0,180}fehlende Spalte[\s\S]{0,180}fail-closed/u,
    );
    assert.match(
      document,
      /erst nach einem getrennten, in[\s\S]{0,30}Staging\s+abgenommenen Datenbank-, RLS- und Spaltenrechte-Rollout aktiviert/u,
    );
    assert.doesNotMatch(
      document,
      /Manuelles Inbox-Handoff: autorisierte Workspace-Mitglieder können/u,
    );
  }
  const conversationsSchema = databaseSchema
    .split("### `conversations`")[1]
    ?.split("### `conversation_messages`")[0] ?? "";
  const currentConversationFields = conversationsSchema.split("Rollout-Hinweis:")[0] ?? "";
  assert.doesNotMatch(currentConversationFields, /assigned_user_id/u);
  assert.match(conversationsSchema, /assigned_user_id[\s\S]*noch nicht zum aktuellen Production-[\s\S]*Schema/u);
  assert.match(conversationsSchema, /RLS- und Spaltenrechte[\s\S]*Staging/u);
});

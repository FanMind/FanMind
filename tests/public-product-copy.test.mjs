import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const publicProductFiles = [
  "src/app/landing-v2/page.tsx",
  "src/components/landing/ProductShowcaseSection.tsx",
  "src/app/roadmap/page.tsx",
];

async function readPublicProductCopy() {
  const entries = await Promise.all(
    publicProductFiles.map(async (file) => [file, await readFile(file, "utf8")]),
  );
  return new Map(entries);
}

function assertNoPublicTerm(copyByFile, pattern, explanation) {
  for (const [file, copy] of copyByFile) {
    assert.doesNotMatch(copy, pattern, `${file}: ${explanation}`);
  }
}

test("public product surfaces use the released terminology", async () => {
  const copyByFile = await readPublicProductCopy();

  assertNoPublicTerm(
    copyByFile,
    /Fan-Gedächtnis/iu,
    "nutzerseitig muss Kontaktwissen statt Fan-Gedächtnis verwendet werden",
  );
  assertNoPublicTerm(
    copyByFile,
    /\bMemory\b/u,
    "nutzerseitig muss Kontaktwissen statt Memory verwendet werden",
  );
  assertNoPublicTerm(
    copyByFile,
    /\bMVP(?:-|\b)/iu,
    "öffentliche Produktflächen dürfen keinen internen MVP-Jargon verwenden",
  );
  assertNoPublicTerm(
    copyByFile,
    /Pilot anfragen/iu,
    "das eingestellte entgeltliche Pilotangebot darf nicht als CTA zurückkehren",
  );
});

test("public product surfaces keep contact knowledge visible", async () => {
  const copyByFile = await readPublicProductCopy();
  const combined = [...copyByFile.values()].join("\n");

  assert.match(combined, /Kontaktwissen/u);
  assert.match(combined, /keine Nachrichten automatisch|keine automatische Sendefunktion/iu);
});

test("public login does not render internal Sandra demo fallback guidance", async () => {
  const loginPage = await readFile("src/app/login/page.tsx", "utf8");

  assert.doesNotMatch(
    loginPage,
    /Du kannst den kontrollierten Sandra-Demo-Zugang über \/login\?demo=1 nutzen\./u,
  );
  assert.doesNotMatch(
    loginPage,
    /Bitte nutze \/login\?demo=1 als Fallback\./u,
  );
  assert.doesNotMatch(loginPage, /Sandra-Demo-Fallback öffnen/u);
});


test("public landing keeps follow-ups active and WhatsApp coming soon", async () => {
  const landing = await readFile("src/app/landing-v2/page.tsx", "utf8");
  const translations = [
    await readFile("src/lib/landingEnglishCopy.ts", "utf8"),
    await readFile("src/lib/fanmindCopy.ts", "utf8"),
  ].join("\n");

  assert.doesNotMatch(
    landing,
    /title: "Manuelle Follow-ups"[\s\S]{0,240}showComingSoonMark: true/u,
    "aktive manuelle Follow-ups dürfen keine Coming-Soon-Markierung tragen",
  );
  assert.doesNotMatch(
    landing,
    /title: "4\. Follow-ups"[\s\S]{0,360}showComingSoonMark: true/u,
    "aktive Follow-up-Funktionskarte darf keine Coming-Soon-Markierung tragen",
  );
  assert.doesNotMatch(
    landing,
    /title: "Follow-up planen"[\s\S]{0,520}showComingSoonMark: true/u,
    "aktiver Follow-up-Schritt darf keine Coming-Soon-Markierung tragen",
  );
  assert.match(
    landing,
    /title: "Follow-ups",\s*status: "Aktiv",\s*text: "Nachfassaktionen vorbereiten\."/u,
  );
  assert.match(
    landing,
    /platform: "whatsapp", title: "WhatsApp",[^\n]*status: "Coming Soon"/u,
  );
  assert.doesNotMatch(
    landing,
    /Facebook, Instagram und WhatsApp werden nur als vorbereitete Beta-Workflows/u,
  );
  assert.match(
    landing,
    /Facebook und Instagram werden nur als vorbereitete Beta-Workflows gezeigt/u,
  );
  assert.match(
    landing,
    /WhatsApp, TikTok, X, Discord, Kampagnen, Analytics\/Reichweite sowie Rollen\/Rechte bleiben Roadmap/u,
  );
  assert.doesNotMatch(
    translations,
    /Facebook, Instagram und WhatsApp werden nur als vorbereitete Beta-Workflows/u,
  );
  assert.match(
    translations,
    /Facebook and Instagram are shown only as prepared beta workflows/u,
  );
  assert.match(
    translations,
    /WhatsApp, TikTok, X, Discord, campaigns, analytics and reach, and roles and permissions remain on the roadmap/u,
  );
  assert.match(landing, /platform: "onlyfans", title: "OnlyFans"/u);
  assert.match(landing, /Phase 8 · noch nicht begonnen/u);
});

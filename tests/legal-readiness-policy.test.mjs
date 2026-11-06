import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function source(path) {
  return readFile(resolve(root, path), "utf8");
}

test("public legal pages contain no internal placeholders and use current product terms", async () => {
  const files = await Promise.all(
    [
      "src/app/impressum/page.tsx",
      "src/app/datenschutz/page.tsx",
      "src/app/avv/page.tsx",
      "src/app/agb/page.tsx",
      "src/app/zahlungsbedingungen/page.tsx",
      "src/app/referral-bedingungen/page.tsx",
    ].map(source),
  );

  for (const content of files) {
    assert.doesNotMatch(
      content,
      /TODO:|\[BITTE FINAL EINTRAGEN|kontakt@fanmind\.de|FanMind e\.U\./iu,
    );
  }

  const privacy = files[1];
  assert.doesNotMatch(privacy, /\b(?:Memory|Memories|Fan-Analyse)\b/iu);
  assert.match(privacy, /Kontaktwissen/u);
  assert.match(privacy, /Copy-&-Open-Assistent/u);
});

test("privacy copy stays aligned with the PageView-only Meta scope", async () => {
  const [privacy, policy, helper, register, inquiry] = await Promise.all([
    source("src/app/datenschutz/page.tsx"),
    source("src/lib/metaPixelPolicy.mjs"),
    source("src/lib/metaPixel.ts"),
    source("src/app/register/RegisterClient.tsx"),
    source("src/components/landing/FooterInquiryForm.tsx"),
  ]);

  assert.match(policy, /META_PIXEL_ACTIVE_EVENTS = Object\.freeze\(\["PageView"\]\)/u);
  assert.match(helper, /MetaPixelActiveEventName/u);
  assert.match(
    privacy,
    /ausschließlich das Standardevent\s*<code>PageView<\/code>/u,
  );
  assert.doesNotMatch(privacy, /<code>(?:CompleteRegistration|Lead)<\/code>/u);
  assert.doesNotMatch(register, /trackMetaPixelEvent/u);
  assert.doesNotMatch(inquiry, /trackMetaPixelEvent/u);
});

test("public retention statements map to implemented technical boundaries", async () => {
  const [
    privacy,
    retention,
    metaPolicy,
    deletionPolicy,
    demoRoute,
    diagnosticWorker,
    backupPolicy,
  ] = await Promise.all([
    source("src/app/datenschutz/page.tsx"),
    source("docs/legal/RETENTION_REGISTER.md"),
    source("src/lib/metaPixelPolicy.mjs"),
    source("src/lib/accountDeletionPolicy.mjs"),
    source("src/app/api/demo/start/route.ts"),
    source("scripts/operations/webhook-diagnostic-retention.mjs"),
    source("scripts/operations/backup-retention.mjs"),
  ]);

  assert.match(metaPolicy, /180 \* 24 \* 60 \* 60/u);
  assert.match(privacy, /höchstens 180 Tage/u);
  assert.match(deletionPolicy, /ACCOUNT_DELETION_PROCESSING_DAYS = 30/u);
  assert.match(privacy, /Bearbeitungsziel von höchstens 30 Tagen/u);
  assert.match(demoRoute, /DEMO_DURATION_MS = 60 \* 60 \* 1000/u);
  assert.match(privacy, /Demo-Zugänge laufen nach einer Stunde ab/u);
  assert.match(diagnosticWorker, /DEFAULT_RETENTION_DAYS = 30/u);
  assert.match(privacy, /Diagnosen werden standardmäßig nach 30 Tagen gelöscht/u);
  assert.match(
    backupPolicy,
    /database: Object\.freeze\(\{ daily: 1, weekly: 1, monthly: 1 \}\)/u,
  );
  assert.match(retention, /Offsite-Backups/u);
  assert.match(retention, /Entscheidung offen/u);
  assert.match(
    privacy,
    /eine vollständig ausgeführte zeitliche Offsite-Löschregel bleibt vor Vertragsfreigabe nachzuweisen/u,
  );
  assert.match(
    privacy,
    /Eine EU-Senderegion ist daher kein Nachweis für EU-Datenspeicherung/u,
  );
});

test("AVV working draft covers Article 28 annexes without claiming signature readiness", async () => {
  const [draft, status] = await Promise.all([
    source("docs/legal/AVV_WORKING_DRAFT.md"),
    source("docs/LEGAL_COMPLETION_STATUS.md"),
  ]);

  assert.match(draft, /\*\*nicht unterschriftsreif\*\*/u);
  assert.match(draft, /Art\. 28 DSGVO/u);
  for (const heading of [
    "Rollen und Parteien",
    "Gegenstand, Zweck und Dauer",
    "Datenarten",
    "Betroffene Personengruppen",
    "Technische und organisatorische Maßnahmen",
    "Unterauftragsverarbeiter und weitere Empfänger",
    "Noch erforderliche Abschlussentscheidungen",
  ]) {
    assert.match(draft, new RegExp(heading, "u"));
  }
  for (const provider of [
    "Exoscale",
    "Supabase",
    "OpenAI",
    "Stripe",
    "Meta",
    "Resend",
  ]) {
    assert.match(draft, new RegExp(provider, "u"));
  }

  assert.match(
    status,
    /-\s*\[x\]\s*technische und fachliche AVV-Arbeitsfassung/iu,
  );
  assert.match(
    status,
    /-\s*\[ \]\s*rechtsgeprüfte und unterzeichnungsfähige AVV/iu,
  );
});

test("external legal evidence stays account-specific and fail-closed", async () => {
  const [register, evidence, verifier, hasher, packageSource, gitignore] =
    await Promise.all([
      source("docs/legal/EXTERNAL_APPROVAL_REGISTER.md"),
      source("docs/legal/external-approval-evidence.json"),
      source("scripts/verify-legal-external-evidence.mjs"),
      source("scripts/legal/hash-external-evidence.mjs"),
      source("package.json"),
      source(".gitignore"),
    ]);

  const parsed = JSON.parse(evidence);
  const assertTransitionReady = (
    control,
    {
      allowPendingValue = false,
      requireValueWhenConfirmed = false,
      requiredDateField,
      requiredVersionField,
    },
  ) => {
    assert.ok(["pending", "confirmed", "not_applicable"].includes(control.status));
    if (control.status === "pending") {
      assert.equal(control.evidenceRef, null);
      if ("value" in control && !allowPendingValue) assert.equal(control.value, null);
      return;
    }
    assert.match(control.evidenceRef, /^sha256:[a-f0-9]{64}$/u);
    assert.match(control[requiredDateField], /^\d{4}-\d{2}-\d{2}$/u);
    if (requiredVersionField) {
      assert.equal(typeof control[requiredVersionField], "string");
      assert.ok(control[requiredVersionField].trim().length > 0);
    }
    if (control.status === "confirmed" && requireValueWhenConfirmed) {
      assert.equal(typeof control.value, "string");
      assert.ok(control.value.trim().length > 0);
    }
  };

  assert.equal(parsed.schemaVersion, 1);
  assert.equal(parsed.operator.legalName, "Brigitte Erika Guggenberger");
  assert.equal(parsed.operator.legalForm, "Einzelunternehmen");
  for (const key of [
    "vatId",
    "companyRegisterNumber",
    "companyRegisterCourt",
    "gisaNumber",
  ]) {
    assertTransitionReady(parsed.operator[key], {
      requireValueWhenConfirmed: true,
      requiredDateField: "confirmedAt",
    });
  }
  assertTransitionReady(parsed.operator.taxMode, {
    allowPendingValue: true,
    requireValueWhenConfirmed: true,
    requiredDateField: "confirmedAt",
  });
  for (const key of [
    "legalReview",
    "taxReview",
    "retentionDecision",
    "customerDpa",
  ]) {
    assertTransitionReady(parsed.approvals[key], {
      requiredDateField: "approvedAt",
      requiredVersionField: "reviewedVersion",
    });
  }
  assert.deepEqual(
    parsed.providers.map(({ id }) => id),
    ["exoscale", "supabase", "openai", "stripe", "meta", "resend"],
  );
  for (const provider of parsed.providers) {
    assertTransitionReady(provider.dpa, {
      requiredDateField: "acceptedAt",
      requiredVersionField: "documentVersion",
    });
    assertTransitionReady(provider.dataLocation, {
      requireValueWhenConfirmed: true,
      requiredDateField: "confirmedAt",
    });
    assertTransitionReady(provider.transferAssessment, {
      requiredDateField: "approvedAt",
      requiredVersionField: "reviewedVersion",
    });
  }

  assert.match(register, /Supabase[\s\S]*PandaDoc/iu);
  assert.match(register, /Resend[\s\S]*US-Speicher/iu);
  assert.match(register, /Wer die AVV unterschreibt/u);
  assert.match(register, /Steuerberatung[\s\S]*Rechts-\/Datenschutzberatung/u);
  assert.match(register, /SHA-256-Prüfsumme/u);
  assert.match(verifier, /--require-complete/u);
  assert.match(verifier, /requiredVersionField/u);
  assert.match(verifier, /requiredDateField/u);
  assert.match(verifier, /LEGAL_EXTERNAL_EVIDENCE_READY/u);
  assert.match(hasher, /O_NOFOLLOW/u);
  assert.match(hasher, /LEGAL_EXTERNAL_EVIDENCE_PRIVATE_CONTENT_OUTPUT=false/u);
  assert.match(
    packageSource,
    /"legal:evidence:hash":\s*"node scripts\/legal\/hash-external-evidence\.mjs"/u,
  );
  assert.match(
    packageSource,
    /"legal:evidence:require-complete":\s*"node scripts\/verify-legal-external-evidence\.mjs --require-complete"/u,
  );
  assert.match(gitignore, /\/docs\/legal\/private-evidence\//u);
});

test("both production release checks include every public legal route", async () => {
  const scripts = await Promise.all([
    source("scripts/final-go-live-preflight.mjs"),
    source("scripts/smoke-public-routes.mjs"),
  ]);

  for (const script of scripts) {
    for (const route of [
      "/impressum",
      "/datenschutz",
      "/avv",
      "/agb",
      "/zahlungsbedingungen",
    ]) {
      assert.match(script, new RegExp(`"${route}"`, "u"));
    }
  }
});

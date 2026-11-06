#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultRegisterPath = resolve(
  root,
  "docs/legal/external-approval-evidence.json",
);

const groupLabels = Object.freeze({
  tax: "Steuerberatung und Register",
  legal: "Rechts- und Datenschutzberatung",
  joint: "Gemeinsame Fristenentscheidung",
  customerDpa: "AVV und Kundenannahme",
  provider: "Anbieterkonten",
});

const operatorTasks = Object.freeze([
  ["vatId", "tax", "UID-Bescheid, FinanzOnline-Bestätigung oder fachlich bestätigte Nichtanwendbarkeit"],
  ["companyRegisterNumber", "tax", "Firmenbuchauszug oder fachlich bestätigte Nichteintragung"],
  ["companyRegisterCourt", "tax", "Firmenbuchauszug oder fachlich bestätigte Nichtanwendbarkeit"],
  ["gisaNumber", "tax", "GISA-Auszug oder fachlich bestätigte Angabepflicht beziehungsweise Nichtanwendbarkeit"],
  ["taxMode", "tax", "schriftliche Steuerfreigabe für Steuermodus, Checkout, Angebot und Rechnung"],
]);

const approvalTasks = Object.freeze([
  ["legalReview", "legal", "versionsbezogene Rechts- und Datenschutzfreigabe der öffentlichen Texte"],
  ["taxReview", "tax", "versionsbezogene Steuerfreigabe der Betreiber-, Rechnungs- und Fristenangaben"],
  ["retentionDecision", "joint", "schriftlich bestätigte Endfristen samt Fristbeginn, Ausnahmen und Sperrpflichten"],
  ["customerDpa", "customerDpa", "unterzeichnungsfähige AVV-Fassung und wirksame Annahme durch FanMind und den jeweiligen B2B-Kunden"],
]);

const providerLabels = Object.freeze({
  exoscale: "Exoscale",
  supabase: "Supabase",
  openai: "OpenAI",
  stripe: "Stripe",
  meta: "Meta",
  resend: "Resend",
});

const allowedStatuses = new Set(["pending", "confirmed", "not_applicable"]);
const groupOrder = ["tax", "legal", "joint", "customerDpa", "provider"];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireControl(control, id) {
  if (
    !control
    || typeof control !== "object"
    || Array.isArray(control)
    || !allowedStatuses.has(control.status)
  ) {
    fail(`handoff_control_invalid_${id.replaceAll(".", "_")}`);
  }
  return control;
}

function hasValidCompletionEvidence(
  control,
  {
    requireValueWhenConfirmed = false,
    requiredDateField = null,
    requiredVersionField = null,
  } = {},
) {
  if (control.status === "pending") return false;
  if (
    typeof control.evidenceRef !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(control.evidenceRef)
  ) {
    return false;
  }

  if (
    requiredDateField
    && !/^\d{4}-\d{2}-\d{2}$/u.test(String(control[requiredDateField]))
  ) {
    return false;
  }
  if (
    requiredVersionField
    && (
      typeof control[requiredVersionField] !== "string"
      || control[requiredVersionField].trim().length === 0
    )
  ) {
    return false;
  }
  if (
    control.status === "confirmed"
    && requireValueWhenConfirmed
    && (typeof control.value !== "string" || control.value.trim().length === 0)
  ) {
    return false;
  }
  return true;
}

function collectTask(tasks, control, task, options) {
  if (!hasValidCompletionEvidence(control, options)) tasks.push(task);
}

export function buildExternalEvidenceHandoff(evidence) {
  if (
    !evidence
    || typeof evidence !== "object"
    || Array.isArray(evidence)
    || !/^\d{4}-\d{2}-\d{2}$/u.test(String(evidence.asOf))
  ) {
    fail("handoff_register_invalid");
  }

  const tasks = [];
  let totalControls = 0;

  for (const [key, group, request] of operatorTasks) {
    const id = `operator.${key}`;
    const control = requireControl(evidence.operator?.[key], id);
    totalControls += 1;
    collectTask(tasks, control, { group, id, request }, {
      requireValueWhenConfirmed: true,
      requiredDateField: "confirmedAt",
    });
  }

  for (const [key, group, request] of approvalTasks) {
    const id = `approvals.${key}`;
    const control = requireControl(evidence.approvals?.[key], id);
    totalControls += 1;
    collectTask(tasks, control, { group, id, request }, {
      requiredDateField: "approvedAt",
      requiredVersionField: "reviewedVersion",
    });
  }

  if (!Array.isArray(evidence.providers)) fail("handoff_providers_invalid");
  const providersById = new Map(
    evidence.providers.map((provider) => [provider?.id, provider]),
  );
  if (
    providersById.size !== Object.keys(providerLabels).length
    || evidence.providers.length !== providersById.size
  ) {
    fail("handoff_providers_invalid");
  }

  for (const [providerId, providerLabel] of Object.entries(providerLabels)) {
    const provider = providersById.get(providerId);
    if (!provider || typeof provider !== "object") {
      fail(`handoff_provider_missing_${providerId}`);
    }
    if (provider.serviceStatus === "inactive") continue;
    if (![
      "production",
      "prepared",
      "conditional",
    ].includes(provider.serviceStatus)) {
      fail(`handoff_provider_status_invalid_${providerId}`);
    }

    for (const [key, group, request, options] of [
      ["dpa", "provider", `${providerLabel}: kontobezogene DPA-Fassung und wirksame Annahme`, {
        requiredDateField: "acceptedAt",
        requiredVersionField: "documentVersion",
      }],
      ["dataLocation", "provider", `${providerLabel}: tatsächlich verwendete Produktionsregion beziehungsweise belastbare Datenstandortangabe`, {
        requireValueWhenConfirmed: true,
        requiredDateField: "confirmedAt",
      }],
      ["transferAssessment", "legal", `${providerLabel}: versionsbezogene Rollen-, Unterauftrags- und Transferprüfung`, {
        requiredDateField: "approvedAt",
        requiredVersionField: "reviewedVersion",
      }],
    ]) {
      const id = `provider.${providerId}.${key}`;
      const control = requireControl(provider[key], id);
      totalControls += 1;
      collectTask(tasks, control, { group, id, request }, options);
    }
  }

  return Object.freeze({
    asOf: evidence.asOf,
    pendingControls: tasks.length,
    totalControls,
    tasks: Object.freeze(tasks.map((task) => Object.freeze(task))),
  });
}

export function formatExternalEvidenceHandoff(handoff) {
  const lines = [
    "# FanMind – externe Freigabe-Aufgaben",
    "",
    `Registerstand: ${handoff.asOf}`,
    `Offen: ${handoff.pendingControls} von ${handoff.totalControls} Kontrollen`,
    "",
    "Diese Liste enthält weder Beleginhalte noch Dateipfade, Kontokennungen, Werte oder Beweis-Hashes.",
  ];

  for (const group of groupOrder) {
    const tasks = handoff.tasks.filter((task) => task.group === group);
    if (tasks.length === 0) continue;
    lines.push("", `## ${groupLabels[group]} (${tasks.length})`, "");
    for (const task of tasks) {
      lines.push(`- [ ] \`${task.id}\` – ${task.request}`);
    }
  }

  if (handoff.pendingControls === 0) {
    lines.push("", "Keine offenen Kontrollen im Register.");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  if (process.argv.length !== 2) fail("handoff_usage_invalid");
  let evidence;
  try {
    evidence = JSON.parse(await readFile(defaultRegisterPath, "utf8"));
  } catch {
    fail("handoff_register_invalid");
  }
  const handoff = buildExternalEvidenceHandoff(evidence);
  console.log("LEGAL_EXTERNAL_EVIDENCE_HANDOFF=valid");
  console.log(`LEGAL_EXTERNAL_EVIDENCE_HANDOFF_AS_OF=${handoff.asOf}`);
  console.log(
    `LEGAL_EXTERNAL_EVIDENCE_HANDOFF_PENDING=${handoff.pendingControls}`,
  );
  console.log(
    `LEGAL_EXTERNAL_EVIDENCE_HANDOFF_TOTAL=${handoff.totalControls}`,
  );
  console.log("");
  process.stdout.write(formatExternalEvidenceHandoff(handoff));
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    const code =
      typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
        ? error.code
        : "handoff_failed";
    console.error(`LEGAL_EXTERNAL_EVIDENCE_HANDOFF_ERROR=${code}`);
    console.error("LEGAL_EXTERNAL_EVIDENCE_PRIVATE_CONTENT_OUTPUT=false");
    process.exitCode = 1;
  });
}

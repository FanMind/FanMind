#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultEvidencePath = resolve(
  root,
  "docs/legal/external-approval-evidence.json",
);
const allowedStatuses = new Set(["pending", "confirmed", "not_applicable"]);
const requiredProviderIds = [
  "exoscale",
  "supabase",
  "openai",
  "stripe",
  "meta",
  "resend",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgument(name, fallback = null) {
  const exact = process.argv.findIndex((value) => value === name);
  if (exact >= 0) return process.argv[exact + 1] ?? fallback;
  const prefix = `${name}=`;
  const inline = process.argv.find((value) => value.startsWith(prefix));
  return inline ? inline.slice(prefix.length) : fallback;
}

function validateControl(
  control,
  id,
  {
    allowValueWhenPending = false,
    requireValueWhenConfirmed = false,
    requiredDateField = null,
    requiredVersionField = null,
  } = {},
) {
  assert(control && typeof control === "object", `${id}: missing control`);
  assert(
    allowedStatuses.has(control.status),
    `${id}: invalid status ${String(control.status)}`,
  );

  const completed = control.status !== "pending";
  if (completed) {
    assert(
      typeof control.evidenceRef === "string"
        && /^sha256:[a-f0-9]{64}$/u.test(control.evidenceRef),
      `${id}: completed controls require a sha256 evidence reference`,
    );
    if (requiredDateField) {
      assert(
        /^\d{4}-\d{2}-\d{2}$/u.test(String(control[requiredDateField])),
        `${id}: ${requiredDateField} must be YYYY-MM-DD when completed`,
      );
    }
    if (requiredVersionField) {
      assert(
        typeof control[requiredVersionField] === "string"
          && control[requiredVersionField].trim().length > 0,
        `${id}: ${requiredVersionField} is required when completed`,
      );
    }
  }

  if (control.status === "confirmed" && requireValueWhenConfirmed) {
    assert(
      typeof control.value === "string" && control.value.trim().length > 0,
      `${id}: confirmed value is missing`,
    );
  }

  if (
    control.status === "pending"
    && "value" in control
    && !allowValueWhenPending
  ) {
    assert(control.value === null, `${id}: pending value must stay null`);
  }

  return completed;
}

export function validateExternalEvidence(evidence) {
  assert(evidence.schemaVersion === 1, "unsupported evidence schema version");
  assert(
    /^\d{4}-\d{2}-\d{2}$/u.test(String(evidence.asOf)),
    "asOf must be YYYY-MM-DD",
  );
  assert(
    evidence.operator?.legalName === "Brigitte Erika Guggenberger",
    "canonical operator name changed",
  );
  assert(
    evidence.operator?.legalForm === "Einzelunternehmen",
    "canonical legal form changed",
  );
  assert(
    evidence.operator?.businessName === "FanMind",
    "canonical business name changed",
  );

  const controls = [];
  for (const key of [
    "vatId",
    "companyRegisterNumber",
    "companyRegisterCourt",
    "gisaNumber",
  ]) {
    controls.push({
      id: `operator.${key}`,
      complete: validateControl(evidence.operator[key], `operator.${key}`, {
        requireValueWhenConfirmed: true,
        requiredDateField: "confirmedAt",
      }),
    });
  }
  controls.push({
    id: "operator.taxMode",
    complete: validateControl(evidence.operator.taxMode, "operator.taxMode", {
      allowValueWhenPending: true,
      requireValueWhenConfirmed: true,
      requiredDateField: "confirmedAt",
    }),
  });

  for (const key of [
    "legalReview",
    "taxReview",
    "retentionDecision",
    "customerDpa",
  ]) {
    controls.push({
      id: `approvals.${key}`,
      complete: validateControl(evidence.approvals?.[key], `approvals.${key}`, {
        requiredDateField: "approvedAt",
        requiredVersionField: "reviewedVersion",
      }),
    });
  }

  assert(Array.isArray(evidence.providers), "providers must be an array");
  assert(
    evidence.providers.length === requiredProviderIds.length,
    "provider register must contain exactly the required providers",
  );

  for (const providerId of requiredProviderIds) {
    const provider = evidence.providers.find(({ id }) => id === providerId);
    assert(provider, `provider.${providerId}: missing`);
    assert(
      ["production", "prepared", "conditional", "inactive"].includes(
        provider.serviceStatus,
      ),
      `provider.${providerId}: invalid service status`,
    );

    if (provider.serviceStatus === "inactive") continue;

    controls.push({
      id: `provider.${providerId}.dpa`,
      complete: validateControl(
        provider.dpa,
        `provider.${providerId}.dpa`,
        {
          requiredDateField: "acceptedAt",
          requiredVersionField: "documentVersion",
        },
      ),
    });
    controls.push({
      id: `provider.${providerId}.dataLocation`,
      complete: validateControl(
        provider.dataLocation,
        `provider.${providerId}.dataLocation`,
        {
          requireValueWhenConfirmed: true,
          requiredDateField: "confirmedAt",
        },
      ),
    });
    controls.push({
      id: `provider.${providerId}.transferAssessment`,
      complete: validateControl(
        provider.transferAssessment,
        `provider.${providerId}.transferAssessment`,
        {
          requiredDateField: "approvedAt",
          requiredVersionField: "reviewedVersion",
        },
      ),
    });
  }

  const incomplete = controls.filter(({ complete }) => !complete);
  return {
    asOf: evidence.asOf,
    controls,
    incomplete,
    completeCount: controls.length - incomplete.length,
    ready: incomplete.length === 0,
  };
}

async function main() {
  const evidenceArgument = parseArgument("--evidence");
  const evidencePath = evidenceArgument
    ? resolve(process.cwd(), evidenceArgument)
    : defaultEvidencePath;
  const raw = await readFile(evidencePath, "utf8");
  const result = validateExternalEvidence(JSON.parse(raw));

  console.log("LEGAL_EXTERNAL_EVIDENCE_SCHEMA=valid");
  console.log(`LEGAL_EXTERNAL_EVIDENCE_AS_OF=${result.asOf}`);
  console.log(`LEGAL_EXTERNAL_EVIDENCE_CONTROLS=${result.controls.length}`);
  console.log(`LEGAL_EXTERNAL_EVIDENCE_COMPLETE=${result.completeCount}`);
  console.log(`LEGAL_EXTERNAL_EVIDENCE_PENDING=${result.incomplete.length}`);
  console.log(`LEGAL_EXTERNAL_EVIDENCE_READY=${result.ready}`);

  if (process.argv.includes("--require-complete") && !result.ready) {
    console.error(
      `LEGAL_EXTERNAL_EVIDENCE_BLOCKERS=${result.incomplete
        .map(({ id }) => id)
        .join(",")}`,
    );
    process.exitCode = 1;
  }
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(
      `LEGAL_EXTERNAL_EVIDENCE_ERROR=${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
    process.exitCode = 1;
  });
}

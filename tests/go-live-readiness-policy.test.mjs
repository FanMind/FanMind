import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  REQUIRED_PUBLIC_HEALTH_COMPONENTS,
  evaluatePublicHealth,
} from "../scripts/public-health-policy.mjs";

const roadmapPath = "src/config/roadmap.ts";
const sourceTruthPath = "docs/SOURCE_OF_TRUTH.md";
const smokeScriptPath = "scripts/final-go-live-preflight.mjs";
const deploySmokePath = "scripts/smoke-public-routes.mjs";
const truthPolicyPath = "scripts/public-product-truth.mjs";
const healthPolicyPath = "scripts/public-health-policy.mjs";
const workflowPath = ".github/workflows/final-go-live-readiness.yml";
const deployWorkflowPath = ".github/workflows/deploy-fanmind.yml";
const runbookPath = "docs/operations/FINAL_GO_LIVE_SMOKE_TEST.md";
const salesFiles = [
  "docs/sales/FANMIND_SALES_ONE_PAGER.md",
  "docs/sales/FANMIND_DEMO_SCRIPT.md",
  "docs/sales/FANMIND_OBJECTION_HANDLING.md",
];

async function read(path) {
  return readFile(path, "utf8");
}

function healthyRequiredChecks() {
  return REQUIRED_PUBLIC_HEALTH_COMPONENTS.map((component) => ({
    component,
    status: "healthy",
  }));
}

test("roadmap separates completed technical foundations from external staging resources", async () => {
  const roadmap = await read(roadmapPath);

  assert.match(roadmap, /label: "Operations-Grundlage", state: "done", status: "Produktiv aktiv"/);
  assert.match(roadmap, /label: "Release-Checks", state: "done", status: "Automatisch aktiv"/);
  assert.match(roadmap, /label: "Produktions- und Testdaten trennen", state: "partial", status: "Technik fertig · externe Ressourcen offen"/);
  assert.match(roadmap, /label: "Umgebungs-Governance", state: "done", status: "Fail-closed aktiv"/);
});

test("go-live and deploy smoke gates share live truth and blocking-only health policies", async () => {
  const [goLive, deploySmoke, truthPolicy, healthPolicy, deployWorkflow] = await Promise.all([
    read(smokeScriptPath),
    read(deploySmokePath),
    read(truthPolicyPath),
    read(healthPolicyPath),
    read(deployWorkflowPath),
  ]);

  assert.doesNotMatch(goLive, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);
  assert.doesNotMatch(deploySmoke, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/u);
  assert.match(goLive, /public-product-truth\.mjs/u);
  assert.match(deploySmoke, /public-product-truth\.mjs/u);
  assert.match(goLive, /public-health-policy\.mjs/u);
  assert.match(deploySmoke, /public-health-policy\.mjs/u);
  assert.match(deploySmoke, /\/api\/version/u);
  assert.match(deploySmoke, /\/api\/health/u);
  assert.match(deploySmoke, /live German product truth/u);
  assert.match(deployWorkflow, /npm run smoke:public/u);
  assert.match(
    deployWorkflow,
    /FANMIND_EXPECTED_RUNTIME_ENVIRONMENT=production/u,
  );
  assert.match(healthPolicy, /OPTIONAL_PUBLIC_HEALTH_COMPONENTS/u);
  assert.match(healthPolicy, /email_config/u);

  for (const required of [
    "Starter Flex",
    "990 € Setup + 312 €/Monat",
    "Starter 12 Monate",
    "0 € Setup + 312 €/Monat",
    "Kontaktwissen",
  ]) {
    assert.match(truthPolicy, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }

  for (const forbidden of [
    "Fan-Gedächtnis",
    "Pilot anfragen",
    "Pilot / Setup",
    "299 €/Monat",
    "499 €/Monat",
    "Agency ab 990 €/Monat",
    "zzgl. USt.",
    "MVP-Workspace",
  ]) {
    assert.match(truthPolicy, new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }
});

test("optional email configuration never blocks an otherwise healthy production release", () => {
  const result = evaluatePublicHealth({
    status: "degraded",
    checks: [
      ...healthyRequiredChecks(),
      { component: "email_config", status: "unknown" },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
  assert.match(result.detail, /Pflichtkomponenten healthy/u);
  assert.match(result.warnings.join(" "), /email_config.*unknown/u);
});

test("missing or unhealthy required components block deployment", () => {
  const missing = evaluatePublicHealth({
    status: "healthy",
    checks: healthyRequiredChecks().filter(
      (check) => check.component !== "supabase_database",
    ),
  });
  assert.equal(missing.ok, false);
  assert.match(missing.errors.join(" "), /Pflichtkomponente fehlt: supabase_database/u);

  const unhealthy = evaluatePublicHealth({
    status: "degraded",
    checks: healthyRequiredChecks().map((check) =>
      check.component === "openai_config"
        ? { ...check, status: "unavailable" }
        : check,
    ),
  });
  assert.equal(unhealthy.ok, false);
  assert.match(unhealthy.errors.join(" "), /openai_config ist unavailable/u);
});

test("final readiness workflow runs only after a successful deploy or manual dispatch", async () => {
  const [workflow, preflight, runbook] = await Promise.all([
    read(workflowPath),
    read(smokeScriptPath),
    read(runbookPath),
  ]);

  assert.match(workflow, /workflows:\s*\n\s*- Deploy FanMind/);
  assert.match(workflow, /github\.event\.workflow_run\.conclusion == 'success'/);
  assert.match(workflow, /FANMIND_EXPECTED_RUNTIME_ENVIRONMENT: production/u);
  assert.match(workflow, /npm run smoke:go-live:public/);
  assert.match(preflight, /payload\?\.runtimeEnvironment === expectedRuntimeEnvironment/u);
  assert.match(runbook, /FANMIND_EXPECTED_RUNTIME_ENVIRONMENT=production/u);
  assert.match(runbook, /runtimeEnvironment=production/u);
});

test("sales and final smoke documents preserve product guardrails", async () => {
  const documents = await Promise.all([runbookPath, ...salesFiles].map(read));
  const combined = documents.join("\n");

  assert.match(combined, /keine automatische Send/u);
  assert.match(combined, /312 € pro Monat/u);
  assert.match(combined, /Referral-Billing.*deaktiviert/us);
  assert.match(combined, /Stripe-Webhook 200/u);
});

test("phase 4 stays technically complete while sales handoff waits for phase 7", async () => {
  const [roadmap, sourceTruth] = await Promise.all([
    read(roadmapPath),
    read(sourceTruthPath),
  ]);

  assert.match(roadmap, /title: "Produktions- & Billing-Basis"/u);
  assert.match(roadmap, /status: "Technisch abgeschlossen"/u);
  assert.match(roadmap, /availability: "done"/u);
  assert.match(roadmap, /label: "Produktionsfreigabe", state: "done", status: "Erledigt"/u);
  assert.match(roadmap, /label: "Finaler Go-Live-Smoke-Test", state: "done", status: "Erledigt"/u);
  assert.doesNotMatch(roadmap, /Verkaufsstart freigegeben/u);
  assert.match(
    roadmap,
    /number: "07"[\s\S]*status: "Finaler Technikblock vor Verkaufsübergabe"[\s\S]*availability: "later"[\s\S]*label: "Verkaufsübergabe", state: "later", status: "Nach technischer Abnahme Phase 3 \+ Phase 7"/u,
  );
  assert.match(
    roadmap,
    /number: "08"[\s\S]*status: "Website-KI begonnen · übrige Anbindungen später"[\s\S]*label: "Einbettbarer Website-KI-Assistent"[\s\S]*state: "partial"[\s\S]*label: "Vollständige Phase-8-Umsetzung nach Abschluss von Phase 7"/u,
  );
  assert.doesNotMatch(roadmap, /Steuerberater-Bestätigung/u);

  assert.match(sourceTruth, /Stand: 16\. August 2026/u);
  assert.match(
    sourceTruth,
    /Die technische Verkaufsübergabe erfolgt erst nach realer technischer Abnahme[\s\S]*Phase-3- und Phase-7-Kanäle/u,
  );
  assert.match(
    sourceTruth,
    /Phase 4 ist deshalb keine[\s\S]*Verkaufsfreigabe mehr[\s\S]*Produktions- und Billing-Basis/u,
  );
  assert.match(
    sourceTruth,
    /Web-Staging-[\s\S]*Runtime mit eigenem `fanmind-staging`-Runner[\s\S]*DNS-\/TLS-Bindung[\s\S]*Exoscale-Ziel sind vorhanden/u,
  );
  assert.match(
    sourceTruth,
    /isolierte Stripe-Testkatalog[\s\S]*read-only nachgewiesen[\s\S]*signierte mutationsfreie Bindungs-Smoke[\s\S]*echte Stripe-Testzustellung und der Billing-Lifecycle bleiben getrennt[\s\S]*offen/u,
  );
  assert.doesNotMatch(sourceTruth, /Phase 4 – Erledigt \/ Verkaufsstart freigegeben/u);
});

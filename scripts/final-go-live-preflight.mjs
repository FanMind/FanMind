#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import { evaluatePublicHealth } from "./public-health-policy.mjs";
import {
  PUBLIC_PRODUCT_TRUTH_RULES,
  evaluatePublicProductTruth,
  visibleText,
} from "./public-product-truth.mjs";

const baseUrl = (process.env.FANMIND_GO_LIVE_BASE_URL || "https://fanmind.ch").replace(/\/$/, "");
const expectedCommit = process.env.FANMIND_EXPECTED_RELEASE_COMMIT?.trim() || "";
const expectedRuntimeEnvironment =
  process.env.FANMIND_EXPECTED_RUNTIME_ENVIRONMENT?.trim() || "";
const reportPath = process.env.FANMIND_GO_LIVE_REPORT_PATH?.trim() || "";
const attempts = Number(process.env.FANMIND_GO_LIVE_ATTEMPTS || 5);
const delayMs = Number(process.env.FANMIND_GO_LIVE_DELAY_MS || 3000);
const timeoutMs = Number(process.env.FANMIND_GO_LIVE_TIMEOUT_MS || 15000);

const results = [];
const failures = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addResult(name, ok, detail) {
  results.push({ name, ok, detail });
  const prefix = ok ? "GO_LIVE_OK" : "GO_LIVE_ERROR";
  const line = `${prefix} ${name}: ${detail}`;
  if (ok) console.log(line);
  else {
    console.error(line);
    failures.push(line);
  }
}

async function request(path) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(timeoutMs),
        headers: { "User-Agent": "FanMind-Final-Go-Live-Preflight/1.0" },
      });

      if (response.status < 200 || response.status >= 400) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await sleep(delayMs);
    }
  }

  throw lastError instanceof Error ? lastError : new Error("unknown request error");
}

function assertText(name, text, rules) {
  const result = evaluatePublicProductTruth(text, rules);
  addResult(name, result.ok, result.detail);
}

const publicRoutes = [
  "/",
  "/?lang=en",
  "/login",
  "/register",
  "/roadmap",
  "/impressum",
  "/datenschutz",
  "/avv",
  "/agb",
  "/zahlungsbedingungen",
  "/referral-bedingungen",
];

const pageHtml = new Map();

for (const route of publicRoutes) {
  try {
    const response = await request(route);
    pageHtml.set(route, await response.text());
    addResult(`route ${route}`, true, `HTTP ${response.status}`);
  } catch (error) {
    addResult(`route ${route}`, false, error instanceof Error ? error.message : "unknown error");
  }
}

try {
  const response = await request("/api/version");
  const payload = await response.json();
  const liveCommit = typeof payload?.releaseCommit === "string" ? payload.releaseCommit : "";

  if (!liveCommit || liveCommit === "unknown") {
    addResult("release commit", false, "kein gültiger Release-Commit");
  } else if (expectedCommit && liveCommit !== expectedCommit) {
    addResult("release commit", false, `${liveCommit} statt ${expectedCommit}`);
  } else {
    addResult("release commit", true, liveCommit);
  }

  addResult(
    "production environment",
    payload?.environment === "production",
    payload?.environment === "production" ? "production" : `unerwartet: ${String(payload?.environment)}`,
  );
  if (expectedRuntimeEnvironment) {
    addResult(
      "runtime environment",
      payload?.runtimeEnvironment === expectedRuntimeEnvironment,
      payload?.runtimeEnvironment === expectedRuntimeEnvironment
        ? expectedRuntimeEnvironment
        : `unerwartet: ${String(payload?.runtimeEnvironment)}`,
    );
  }
} catch (error) {
  addResult("version endpoint", false, error instanceof Error ? error.message : "unknown error");
}

try {
  const response = await request("/api/health");
  const payload = await response.json();
  const health = evaluatePublicHealth(payload);
  addResult("health", health.ok, health.detail);
  for (const warning of health.warnings) {
    console.warn(`GO_LIVE_WARNING health: ${warning}`);
  }
} catch (error) {
  addResult("health endpoint", false, error instanceof Error ? error.message : "unknown error");
}

const germanLanding = visibleText(pageHtml.get("/") || "");
const englishLanding = visibleText(pageHtml.get("/?lang=en") || "");
const registerPage = visibleText(pageHtml.get("/register") || "");

assertText(
  "deutsche Landingpage",
  germanLanding,
  PUBLIC_PRODUCT_TRUTH_RULES.germanLanding,
);
assertText(
  "englische Landingpage",
  englishLanding,
  PUBLIC_PRODUCT_TRUTH_RULES.englishLanding,
);
assertText(
  "Registrierung und Preis",
  registerPage,
  PUBLIC_PRODUCT_TRUTH_RULES.registration,
);

const report = {
  checkedAt: new Date().toISOString(),
  baseUrl,
  expectedCommit: expectedCommit || null,
  expectedRuntimeEnvironment: expectedRuntimeEnvironment || null,
  success: failures.length === 0,
  results,
};

if (reportPath) {
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

if (failures.length) {
  console.error(`Final go-live preflight failed with ${failures.length} error(s).`);
  process.exit(1);
}

console.log(`Final go-live preflight passed with ${results.length} checks on ${baseUrl}.`);

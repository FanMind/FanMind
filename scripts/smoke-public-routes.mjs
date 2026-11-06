#!/usr/bin/env node

import { evaluatePublicHealth } from "./public-health-policy.mjs";
import { validateVersionPayload } from "./monitor-public-uptime.mjs";
import {
  PUBLIC_PRODUCT_TRUTH_RULES,
  evaluatePublicProductTruth,
  visibleText,
} from "./public-product-truth.mjs";

const baseUrl = (
  process.env.FANMIND_SMOKE_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://fanmind.ch"
).replace(/\/$/, "");

const expectedCommit = process.env.FANMIND_EXPECTED_RELEASE_COMMIT?.trim() || "";
const expectedRuntimeEnvironment =
  process.env.FANMIND_EXPECTED_RUNTIME_ENVIRONMENT?.trim() || "";
const routes = [
  "/",
  "/?lang=en",
  "/login",
  "/register",
  "/roadmap",
  "/agb",
  "/datenschutz",
  "/impressum",
  "/avv",
  "/zahlungsbedingungen",
  "/referral-bedingungen",
  "/support",
  "/api/version",
  "/api/health",
];

const attempts = Number(process.env.FANMIND_SMOKE_ATTEMPTS || 5);
const timeoutMs = Number(process.env.FANMIND_SMOKE_TIMEOUT_MS || 15_000);
const delayMs = Number(process.env.FANMIND_SMOKE_DELAY_MS || 3_000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchRoute(route) {
  const response = await fetch(`${baseUrl}${route}`, {
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: { "User-Agent": "FanMind-Production-Smoke/2.0" },
  });

  if (response.status < 200 || response.status >= 400) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }

  if (route === "/api/version") {
    const payload = await response.json().catch(() => null);
    validateVersionPayload(payload, {
      expectedCommit,
      expectedRuntimeEnvironment,
    });

    return { status: response.status, body: payload };
  }

  if (route === "/api/health") {
    const payload = await response.json().catch(() => null);
    const health = evaluatePublicHealth(payload);
    if (!health.ok) {
      throw new Error(`/api/health blocking check failed: ${health.detail}`);
    }
    for (const warning of health.warnings) {
      console.warn(`SMOKE_WARNING /api/health: ${warning}`);
    }
    console.log(`SMOKE_OK /api/health policy: ${health.detail}`);
    return { status: response.status, body: payload };
  }

  return { status: response.status, body: await response.text() };
}

function assertPublicTruth(name, html, rules) {
  const result = evaluatePublicProductTruth(visibleText(html), rules);
  if (!result.ok) throw new Error(`${name}: ${result.detail}`);
}

const failures = [];
const bodies = new Map();

for (const route of routes) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await fetchRoute(route);
      bodies.set(route, result.body);
      console.log(`SMOKE_OK ${route} HTTP ${result.status}`);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      console.warn(
        `SMOKE_RETRY ${route} attempt ${attempt}/${attempts}: ${error instanceof Error ? error.message : "unknown error"}`,
      );
      if (attempt < attempts) await sleep(delayMs);
    }
  }

  if (lastError) {
    failures.push(
      `${route}: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
    );
  }
}

if (!failures.length) {
  try {
    assertPublicTruth(
      "deutsche Landingpage",
      bodies.get("/") || "",
      PUBLIC_PRODUCT_TRUTH_RULES.germanLanding,
    );
    console.log("SMOKE_OK live German product truth");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "German product truth failed");
  }

  try {
    assertPublicTruth(
      "englische Landingpage",
      bodies.get("/?lang=en") || "",
      PUBLIC_PRODUCT_TRUTH_RULES.englishLanding,
    );
    console.log("SMOKE_OK live English product truth");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "English product truth failed");
  }

  try {
    assertPublicTruth(
      "Registrierung und Preis",
      bodies.get("/register") || "",
      PUBLIC_PRODUCT_TRUTH_RULES.registration,
    );
    console.log("SMOKE_OK live registration product truth");
  } catch (error) {
    failures.push(error instanceof Error ? error.message : "Registration product truth failed");
  }
}

if (failures.length) {
  for (const failure of failures) console.error(`SMOKE_ERROR ${failure}`);
  console.error(`Public smoke test failed for ${failures.length} check(s).`);
  process.exit(1);
}

console.log(
  `Public smoke test passed for ${routes.length} routes plus live product truth on ${baseUrl}.`,
);

#!/usr/bin/env node

import { lstat, open, realpath } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const privateRoot = resolve(root, "docs/operations/private-ai-evals");
const MAX_FILE_BYTES = 1_000_000;
const MIN_CASES = 12;
const MAX_CASES = 120;
const TIERS = Object.freeze(["standard", "plus", "ultra"]);
const SEGMENTS = Object.freeze(["creator", "business"]);
const LOCALES = Object.freeze(["de", "en"]);
const SCENARIOS = Object.freeze([
  "reply_suggestion",
  "contact_knowledge",
  "follow_up",
]);
const SCORE_FIELDS = Object.freeze([
  "groundedness",
  "relevance",
  "tone",
  "safety",
]);

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function requireObject(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

function requireExactKeys(value, expected, code) {
  const keys = Object.keys(requireObject(value, code)).sort();
  const allowed = [...expected].sort();
  if (keys.length !== allowed.length || keys.some((key, index) => key !== allowed[index])) {
    fail(code);
  }
}

function requireEnum(value, allowed, code) {
  if (typeof value !== "string" || !allowed.includes(value)) fail(code);
  return value;
}

function requireScore(value) {
  if (!Number.isInteger(value) || value < 1 || value > 5) {
    fail("quality_eval_score_invalid");
  }
  return value;
}

function isIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function normalizeReview(review) {
  requireExactKeys(
    review,
    [...SCORE_FIELDS, "manualSendBoundary", "privacySafe"],
    "quality_eval_review_fields_invalid",
  );
  if (
    typeof review.manualSendBoundary !== "boolean"
    || typeof review.privacySafe !== "boolean"
  ) {
    fail("quality_eval_boundary_invalid");
  }
  const scores = Object.fromEntries(
    SCORE_FIELDS.map((field) => [field, requireScore(review[field])]),
  );
  return Object.freeze({
    ...scores,
    manualSendBoundary: review.manualSendBoundary,
    privacySafe: review.privacySafe,
  });
}

function normalizeCandidate(candidate) {
  requireExactKeys(
    candidate,
    ["tier", "reviews"],
    "quality_eval_candidate_fields_invalid",
  );
  const tier = requireEnum(candidate.tier, TIERS, "quality_eval_tier_invalid");
  if (
    !Array.isArray(candidate.reviews)
    || candidate.reviews.length < 2
    || candidate.reviews.length > 5
  ) {
    fail("quality_eval_review_count_invalid");
  }
  return Object.freeze({
    tier,
    reviews: Object.freeze(candidate.reviews.map(normalizeReview)),
  });
}

function normalizeCase(entry, seenIds) {
  requireExactKeys(
    entry,
    ["id", "segment", "locale", "scenario", "candidates"],
    "quality_eval_case_fields_invalid",
  );
  if (
    typeof entry.id !== "string"
    || !/^case-[a-z0-9-]{3,48}$/u.test(entry.id)
    || seenIds.has(entry.id)
  ) {
    fail("quality_eval_case_id_invalid");
  }
  seenIds.add(entry.id);
  const segment = requireEnum(
    entry.segment,
    SEGMENTS,
    "quality_eval_segment_invalid",
  );
  const locale = requireEnum(entry.locale, LOCALES, "quality_eval_locale_invalid");
  const scenario = requireEnum(
    entry.scenario,
    SCENARIOS,
    "quality_eval_scenario_invalid",
  );
  if (!Array.isArray(entry.candidates) || entry.candidates.length !== TIERS.length) {
    fail("quality_eval_candidates_invalid");
  }
  const candidates = entry.candidates.map(normalizeCandidate);
  if (new Set(candidates.map(({ tier }) => tier)).size !== TIERS.length) {
    fail("quality_eval_candidates_invalid");
  }
  if (new Set(candidates.map(({ reviews }) => reviews.length)).size !== 1) {
    fail("quality_eval_review_count_mismatch");
  }
  return Object.freeze({ segment, locale, scenario, candidates: Object.freeze(candidates) });
}

function basisPoints(numerator, denominator) {
  return Math.round((numerator * 10_000) / denominator);
}

function requireCoverage(cases, field, values) {
  const present = new Set(cases.map((entry) => entry[field]));
  if (values.some((value) => !present.has(value))) {
    fail(`quality_eval_${field}_coverage_incomplete`);
  }
}

export function evaluateAiReplyQualityResults(input) {
  requireExactKeys(
    input,
    ["schemaVersion", "asOf", "datasetRef", "cases"],
    "quality_eval_root_fields_invalid",
  );
  if (input.schemaVersion !== 1) fail("quality_eval_schema_version_invalid");
  if (!isIsoDate(input.asOf)) {
    fail("quality_eval_date_invalid");
  }
  if (
    typeof input.datasetRef !== "string"
    || !/^sha256:[a-f0-9]{64}$/u.test(input.datasetRef)
  ) {
    fail("quality_eval_dataset_ref_invalid");
  }
  if (
    !Array.isArray(input.cases)
    || input.cases.length < MIN_CASES
    || input.cases.length > MAX_CASES
  ) {
    fail("quality_eval_case_count_invalid");
  }

  const seenIds = new Set();
  const cases = input.cases.map((entry) => normalizeCase(entry, seenIds));
  requireCoverage(cases, "segment", SEGMENTS);
  requireCoverage(cases, "locale", LOCALES);
  requireCoverage(cases, "scenario", SCENARIOS);

  const accumulators = Object.fromEntries(
    TIERS.map((tier) => [tier, { score: 0, maximum: 0, boundaryPasses: 0, reviews: 0, topCases: 0 }]),
  );

  for (const entry of cases) {
    const caseScores = {};
    for (const candidate of entry.candidates) {
      let candidateScore = 0;
      for (const review of candidate.reviews) {
        const total = SCORE_FIELDS.reduce((sum, field) => sum + review[field], 0);
        candidateScore += total;
        const target = accumulators[candidate.tier];
        target.score += total;
        target.maximum += SCORE_FIELDS.length * 5;
        target.reviews += 1;
        if (review.safety >= 4 && review.manualSendBoundary && review.privacySafe) {
          target.boundaryPasses += 1;
        }
      }
      caseScores[candidate.tier] = candidateScore;
    }
    const topScore = Math.max(...Object.values(caseScores));
    for (const tier of TIERS) {
      if (caseScores[tier] === topScore) accumulators[tier].topCases += 1;
    }
  }

  const tiers = Object.freeze(
    TIERS.map((tier) => {
      const value = accumulators[tier];
      return Object.freeze({
        tier,
        reviews: value.reviews,
        scoreBps: basisPoints(value.score, value.maximum),
        boundaryPassBps: basisPoints(value.boundaryPasses, value.reviews),
        topCaseBps: basisPoints(value.topCases, cases.length),
      });
    }),
  );

  return Object.freeze({
    asOf: input.asOf,
    cases: cases.length,
    coverage: "complete",
    tiers,
    activation: "none",
  });
}

export function formatAiReplyQualityResult(result) {
  const lines = [
    "AI_REPLY_QUALITY_EVAL_SCHEMA=valid",
    `AI_REPLY_QUALITY_EVAL_AS_OF=${result.asOf}`,
    `AI_REPLY_QUALITY_EVAL_CASES=${result.cases}`,
    `AI_REPLY_QUALITY_EVAL_COVERAGE=${result.coverage}`,
  ];
  for (const tier of result.tiers) {
    lines.push(
      `AI_REPLY_QUALITY_EVAL_TIER=${tier.tier} REVIEWS=${tier.reviews} SCORE_BPS=${tier.scoreBps} BOUNDARY_PASS_BPS=${tier.boundaryPassBps} TOP_CASE_BPS=${tier.topCaseBps}`,
    );
  }
  lines.push("AI_REPLY_QUALITY_EVAL_VALID=true");
  lines.push("AI_REPLY_QUALITY_EVAL_ACTIVATION=none");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== "--input" || !argv[1] || argv[1].startsWith("-")) {
    fail("quality_eval_usage_invalid");
  }
  return resolve(root, argv[1]);
}

async function readPrivateInput(inputPath) {
  let privateDirectory;
  let resolvedInput;
  try {
    const original = await lstat(inputPath);
    if (original.isSymbolicLink()) fail("quality_eval_input_invalid");
    [privateDirectory, resolvedInput] = await Promise.all([
      realpath(privateRoot),
      realpath(inputPath),
    ]);
  } catch (error) {
    if (error?.code?.startsWith?.("quality_eval_")) throw error;
    fail("quality_eval_input_invalid");
  }
  if (!resolvedInput.startsWith(`${privateDirectory}${sep}`) || !resolvedInput.endsWith(".json")) {
    fail("quality_eval_input_boundary_invalid");
  }

  let handle;
  try {
    handle = await open(resolvedInput, "r");
    const details = await handle.stat();
    if (!details.isFile() || details.size <= 0 || details.size > MAX_FILE_BYTES) {
      fail("quality_eval_input_invalid");
    }
    const content = await handle.readFile("utf8");
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      fail("quality_eval_input_invalid");
    }
    return JSON.parse(content);
  } catch (error) {
    if (error?.code?.startsWith?.("quality_eval_")) throw error;
    fail("quality_eval_input_invalid");
  } finally {
    await handle?.close();
  }
}

async function main() {
  const inputPath = parseArgs(process.argv.slice(2));
  const result = evaluateAiReplyQualityResults(await readPrivateInput(inputPath));
  process.stdout.write(formatAiReplyQualityResult(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    const code =
      typeof error?.code === "string" && /^quality_eval_[a-z0-9_]+$/u.test(error.code)
        ? error.code
        : "quality_eval_failed";
    console.error(`AI_REPLY_QUALITY_EVAL_ERROR=${code}`);
    console.error("AI_REPLY_QUALITY_EVAL_PRIVATE_CONTENT_OUTPUT=false");
    console.error("AI_REPLY_QUALITY_EVAL_ACTIVATION=none");
    process.exitCode = 1;
  });
}

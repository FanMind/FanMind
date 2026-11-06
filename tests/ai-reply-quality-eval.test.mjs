import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  evaluateAiReplyQualityResults,
  formatAiReplyQualityResult,
} from "../scripts/operations/ai-reply-quality-eval.mjs";

function review(score, overrides = {}) {
  return {
    groundedness: score,
    relevance: score,
    tone: score,
    safety: score,
    manualSendBoundary: true,
    privacySafe: true,
    ...overrides,
  };
}

function validInput() {
  const segments = ["creator", "business"];
  const locales = ["de", "en"];
  const scenarios = ["reply_suggestion", "contact_knowledge", "follow_up"];
  return {
    schemaVersion: 1,
    asOf: "2026-07-31",
    datasetRef: `sha256:${"a".repeat(64)}`,
    cases: Array.from({ length: 12 }, (_, index) => ({
      id: `case-synthetic-${String(index + 1).padStart(3, "0")}`,
      segment: segments[index % segments.length],
      locale: locales[Math.floor(index / 2) % locales.length],
      scenario: scenarios[index % scenarios.length],
      candidates: [
        { tier: "standard", reviews: [review(3), review(3)] },
        { tier: "plus", reviews: [review(4), review(4)] },
        { tier: "ultra", reviews: [review(5), review(5)] },
      ],
    })),
  };
}

test("quality evaluation aggregates complete blinded numeric reviews without activation", () => {
  const result = evaluateAiReplyQualityResults(validInput());
  assert.equal(result.cases, 12);
  assert.equal(result.coverage, "complete");
  assert.equal(result.activation, "none");
  assert.deepEqual(result.tiers, [
    {
      tier: "standard",
      reviews: 24,
      scoreBps: 6000,
      boundaryPassBps: 0,
      topCaseBps: 0,
    },
    {
      tier: "plus",
      reviews: 24,
      scoreBps: 8000,
      boundaryPassBps: 10000,
      topCaseBps: 0,
    },
    {
      tier: "ultra",
      reviews: 24,
      scoreBps: 10000,
      boundaryPassBps: 10000,
      topCaseBps: 10000,
    },
  ]);
});

test("quality evaluation rejects raw content and incomplete coverage", () => {
  const rawPrompt = validInput();
  rawPrompt.cases[0].prompt = "PRIVATE PROMPT";
  assert.throws(
    () => evaluateAiReplyQualityResults(rawPrompt),
    { code: "quality_eval_case_fields_invalid" },
  );

  const rawReply = validInput();
  rawReply.cases[0].candidates[0].reply = "PRIVATE REPLY";
  assert.throws(
    () => evaluateAiReplyQualityResults(rawReply),
    { code: "quality_eval_candidate_fields_invalid" },
  );

  const incomplete = validInput();
  incomplete.cases = incomplete.cases.map((entry) => ({ ...entry, locale: "de" }));
  assert.throws(
    () => evaluateAiReplyQualityResults(incomplete),
    { code: "quality_eval_locale_coverage_incomplete" },
  );
});

test("quality evaluation rejects malformed provenance, duplicate cases and review drift", () => {
  const badHash = validInput();
  badHash.datasetRef = "sha256:invalid";
  assert.throws(
    () => evaluateAiReplyQualityResults(badHash),
    { code: "quality_eval_dataset_ref_invalid" },
  );

  const impossibleDate = validInput();
  impossibleDate.asOf = "2026-02-31";
  assert.throws(
    () => evaluateAiReplyQualityResults(impossibleDate),
    { code: "quality_eval_date_invalid" },
  );

  const duplicate = validInput();
  duplicate.cases[1].id = duplicate.cases[0].id;
  assert.throws(
    () => evaluateAiReplyQualityResults(duplicate),
    { code: "quality_eval_case_id_invalid" },
  );

  const missingTier = validInput();
  missingTier.cases[0].candidates[2].tier = "plus";
  assert.throws(
    () => evaluateAiReplyQualityResults(missingTier),
    { code: "quality_eval_candidates_invalid" },
  );

  const reviewDrift = validInput();
  reviewDrift.cases[0].candidates[0].reviews.push(review(3));
  assert.throws(
    () => evaluateAiReplyQualityResults(reviewDrift),
    { code: "quality_eval_review_count_mismatch" },
  );
});

test("formatted quality result omits private references and cannot claim tier readiness", () => {
  const input = validInput();
  const output = formatAiReplyQualityResult(evaluateAiReplyQualityResults(input));
  assert.match(output, /AI_REPLY_QUALITY_EVAL_VALID=true/u);
  assert.match(output, /AI_REPLY_QUALITY_EVAL_ACTIVATION=none/u);
  assert.doesNotMatch(
    output,
    /sha256:|case-synthetic|PRIVATE|REVIEWER_ID|PROVIDER_MODEL/iu,
  );
  assert.doesNotMatch(output, /READY|automaticallyBookable|stripe/iu);
});

test("quality evaluator has no provider, billing or network execution path", async () => {
  const source = await readFile(
    new URL("../scripts/operations/ai-reply-quality-eval.mjs", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(source, /openai|stripe|fetch\s*\(|https?:\/\//iu);
  assert.match(source, /AI_REPLY_QUALITY_EVAL_PRIVATE_CONTENT_OUTPUT=false/u);
  assert.match(source, /docs\/operations\/private-ai-evals/u);
});

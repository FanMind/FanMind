import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AI_ANALYSIS_INPUT_CHAR_LIMIT,
  AI_ANALYSIS_MAX_MESSAGE_ROW_LIMIT,
  AI_ANALYSIS_MEMORY_ROW_LIMIT,
  AI_ANALYSIS_MESSAGE_ROW_LIMIT,
  AI_ANALYSIS_OUTPUT_TOKEN_LIMIT,
  AI_ANALYSIS_RATE_LIMIT_MAX,
  AI_ANALYSIS_RATE_LIMIT_WINDOW_MS,
  AI_REPLY_ANALYSIS_REPORT_CHAR_LIMIT,
  AI_REPLY_COMPANY_PROMPT_CHAR_LIMIT,
  AI_REPLY_INPUT_CHAR_LIMIT,
  AI_REPLY_PROMPT_PROFILE_CHAR_LIMIT,
  AI_REPLY_PROMPT_PROFILE_NAME_CHAR_LIMIT,
  AI_REPLY_OUTPUT_TOKEN_LIMIT,
  AI_REPLY_RESPONSE_MODE_CHAR_LIMIT,
  buildBoundedFanAnalysisPayload,
  buildBoundedReplySuggestionContext,
} from "../src/lib/aiExecutionPolicy.mjs";

const replyRoutePath = "src/app/api/ai/reply-suggestions/route.ts";
const analysisActionPath = "src/app/fans/[id]/analysisActions.ts";
const legacyActionsPath = "src/app/fans/actions.ts";
const supabaseServerPath = "src/lib/supabase/server.ts";
const sourceOfTruthPath = "docs/SOURCE_OF_TRUTH.md";
const securityChecklistPath = "docs/SECURITY_RLS_SECRETS_CHECK.md";

test("analysis context is deterministic, bounded and prioritizes recent data", () => {
  const messages = Array.from({ length: 80 }, (_, index) => ({
    direction: "inbound",
    channel: "manual",
    origin: "dm",
    author: "Fan",
    text: `message-${String(index).padStart(2, "0")}:` + "x".repeat(5_000),
    mediaPresent: false,
    createdAt: new Date(index * 1_000).toISOString(),
  }));
  const memories = Array.from({ length: 30 }, (_, index) => ({
    type: "note",
    content: `memory-${String(index).padStart(2, "0")}:` + "y".repeat(5_000),
    importance: "normal",
    createdAt: new Date(index * 1_000).toISOString(),
  }));

  const result = buildBoundedFanAnalysisPayload({
    language: "en",
    analysisMode: "detailed",
    additionalInstruction: "z".repeat(2_000),
    contact: {
      displayName: "d".repeat(1_000),
      handle: "h".repeat(1_000),
      sourcePlatform: "manual",
      contactLanguage: "en",
      status: "active",
      tags: Array.from({ length: 40 }, (_, index) => `tag-${index}-` + "t".repeat(100)),
      summary: "s".repeat(5_000),
      internalNotes: "i".repeat(10_000),
    },
    messages,
    contactKnowledge: memories,
  });

  assert.equal(result.inputChars, JSON.stringify(result.payload).length);
  assert.ok(result.inputChars <= AI_ANALYSIS_INPUT_CHAR_LIMIT);
  assert.ok(result.payload.messages.length <= 50);
  assert.ok(result.payload.contactKnowledge.length <= 20);
  assert.ok(result.payload.messages.every((message) => message.text.length <= 2_000));
  assert.ok(result.payload.contactKnowledge.every((memory) => memory.content.length <= 1_000));
  assert.equal(result.payload.additionalInstruction?.length, 500);
  assert.match(result.payload.messages.at(-1)?.text ?? "", /^message-79:/u);
  assert.doesNotMatch(result.payload.messages[0]?.text ?? "", /^message-(?:0[0-9]|[12][0-9]):/u);
  assert.match(result.payload.contactKnowledge[0]?.content ?? "", /^memory-00:/u);
});

test("analysis context accepts the approved Ultra ceiling without changing storage", () => {
  const result = buildBoundedFanAnalysisPayload({
    messageLimit: 150,
    messages: Array.from({ length: 200 }, (_, index) => ({
      direction: "inbound",
      text: `message-${index}`,
    })),
  });

  assert.equal(AI_ANALYSIS_MAX_MESSAGE_ROW_LIMIT, 150);
  assert.equal(result.payload.messages.length, 150);
  assert.equal(result.payload.messages[0].text, "message-50");
  assert.equal(result.payload.messages.at(-1).text, "message-199");
});

test("serialized budgets remain strict for escape-heavy content", () => {
  const escapeHeavy = "\"\n\t".repeat(10_000);
  const analysis = buildBoundedFanAnalysisPayload({
    contact: {
      displayName: escapeHeavy,
      tags: Array(20).fill(escapeHeavy),
      summary: escapeHeavy,
      internalNotes: escapeHeavy,
    },
    messages: Array.from({ length: 50 }, () => ({ text: escapeHeavy })),
    contactKnowledge: Array.from({ length: 20 }, () => ({
      content: escapeHeavy,
    })),
    additionalInstruction: escapeHeavy,
  });
  assert.ok(analysis.inputChars <= AI_ANALYSIS_INPUT_CHAR_LIMIT);

  assert.throws(
    () =>
      buildBoundedReplySuggestionContext({
        incomingMessage: escapeHeavy.slice(0, 4_000),
        conversationContext: escapeHeavy.slice(0, 36_000),
        messageLimit: 150,
        analysisReport: escapeHeavy.slice(0, 12_000),
        responseInstruction: escapeHeavy.slice(0, 1_000),
      }),
    /total budget/u,
  );
});

test("reply context bounds trusted contact fields and returns exact usage size", () => {
  const result = buildBoundedReplySuggestionContext({
    contactId: "contact-1",
    displayName: "d".repeat(1_000),
    handle: "h".repeat(1_000),
    sourcePlatform: "manual",
    language: "de",
    status: "active",
    tags: Array(40).fill("t".repeat(100)),
    summary: "s".repeat(5_000),
    conversationContext: "p".repeat(36_000),
    messageLimit: 150,
    incomingMessage: "i".repeat(4_000),
    responseMode: "m".repeat(80),
    responseInstruction: "r".repeat(1_000),
    companyPrompt: "c".repeat(AI_REPLY_COMPANY_PROMPT_CHAR_LIMIT),
    promptProfileName: "n".repeat(AI_REPLY_PROMPT_PROFILE_NAME_CHAR_LIMIT),
    promptProfilePrompt: "q".repeat(AI_REPLY_PROMPT_PROFILE_CHAR_LIMIT),
    analysisReport: "a".repeat(12_000),
  });

  assert.equal(result.inputChars, JSON.stringify(result.context).length);
  assert.ok(result.inputChars <= AI_REPLY_INPUT_CHAR_LIMIT);
  assert.equal(result.context.displayName.length, 160);
  assert.equal(result.context.handle?.length, 160);
  assert.equal(result.context.tags.length, 20);
  assert.equal(result.context.summary?.length, 2_000);
  assert.equal(result.context.conversationContext.length, 36_000);
  assert.equal(result.context.analysisReport?.length, AI_REPLY_ANALYSIS_REPORT_CHAR_LIMIT);
  assert.equal(result.context.responseMode.length, AI_REPLY_RESPONSE_MODE_CHAR_LIMIT);
  assert.equal(result.context.companyPrompt?.length, AI_REPLY_COMPANY_PROMPT_CHAR_LIMIT);
  assert.equal(result.context.promptProfileName?.length, AI_REPLY_PROMPT_PROFILE_NAME_CHAR_LIMIT);
  assert.equal(result.context.promptProfilePrompt?.length, AI_REPLY_PROMPT_PROFILE_CHAR_LIMIT);
});

test("reply context rejects escape-heavy input above the serialized budget", () => {
  assert.throws(
    () =>
      buildBoundedReplySuggestionContext({
        contactId: "contact-1",
        conversationContext: "\"".repeat(36_000),
        messageLimit: 150,
        incomingMessage: "\"".repeat(4_000),
        responseInstruction: "\"".repeat(1_000),
        analysisReport: "\"".repeat(12_000),
      }),
    /AI reply input exceeds its total budget/u,
  );
});

test("productive AI entry points enforce lifecycle guards, limits and output budgets before OpenAI", async () => {
  const [
    replyRoute,
    analysisAction,
    legacyActions,
    supabaseServer,
    sourceOfTruth,
    securityChecklist,
  ] = await Promise.all([
    readFile(replyRoutePath, "utf8"),
    readFile(analysisActionPath, "utf8"),
    readFile(legacyActionsPath, "utf8"),
    readFile(supabaseServerPath, "utf8"),
    readFile(sourceOfTruthPath, "utf8"),
    readFile(securityChecklistPath, "utf8"),
  ]);

  assert.equal(AI_ANALYSIS_RATE_LIMIT_MAX, 10);
  assert.equal(AI_ANALYSIS_RATE_LIMIT_WINDOW_MS, 10 * 60 * 1_000);
  assert.equal(AI_ANALYSIS_OUTPUT_TOKEN_LIMIT, 2_048);
  assert.equal(AI_ANALYSIS_MESSAGE_ROW_LIMIT, 50);
  assert.equal(AI_ANALYSIS_MAX_MESSAGE_ROW_LIMIT, 150);
  assert.equal(AI_ANALYSIS_MEMORY_ROW_LIMIT, 20);
  assert.equal(AI_REPLY_OUTPUT_TOKEN_LIMIT, 2_048);
  assert.equal(AI_REPLY_ANALYSIS_REPORT_CHAR_LIMIT, 12_000);

  assert.match(replyRoute, /isWorkspaceArchivedAfterSubscriptionEnd/u);
  assert.doesNotMatch(replyRoute, /evaluateAiExecutionGate/u);
  assert.match(replyRoute, /getResolvedWorkspaceAiTier/u);
  assert.match(replyRoute, /getRecentContactConversationMessages/u);
  assert.match(replyRoute, /getAiTierConfig/u);
  assert.doesNotMatch(
    replyRoute,
    /payload\.(?:pastedChatContext|analysisReport)/u,
  );
  assert.match(replyRoute, /buildBoundedReplySuggestionContext/u);
  assert.match(
    replyRoute,
    /hasUsableAnalysisReportContext[\s\S]*review_status === "rejected"[\s\S]*const analysisReport = hasUsableAnalysisReportContext\(analysisResult\.report\)/u,
  );
  assert.match(replyRoute, /max_output_tokens: AI_REPLY_OUTPUT_TOKEN_LIMIT/u);
  assert.ok(
    replyRoute.indexOf("isWorkspaceArchivedAfterSubscriptionEnd(workspace)")
      < replyRoute.indexOf("const incomingMessage"),
  );
  assert.ok(
    replyRoute.indexOf("const incomingMessage")
      < replyRoute.indexOf("await consumeSharedRateLimit"),
  );
  assert.ok(
    replyRoute.indexOf("await consumeSharedRateLimit")
      < replyRoute.indexOf("fetch(OPENAI_RESPONSES_URL"),
  );

  assert.match(analysisAction, /isWorkspaceArchivedAfterSubscriptionEnd/u);
  assert.doesNotMatch(analysisAction, /evaluateAiExecutionGate/u);
  assert.doesNotMatch(analysisAction, /responseBody\?\.error\?\.message/u);
  assert.match(
    analysisAction,
    /scope: "ai_analysis_workspace_user"[\s\S]*maxRequests: AI_ANALYSIS_RATE_LIMIT_MAX[\s\S]*windowMs: AI_ANALYSIS_RATE_LIMIT_WINDOW_MS/u,
  );
  assert.match(analysisAction, /buildBoundedFanAnalysisPayload/u);
  assert.match(
    analysisAction,
    /max_output_tokens: AI_ANALYSIS_OUTPUT_TOKEN_LIMIT/u,
  );
  assert.ok(
    analysisAction.indexOf("isWorkspaceArchivedAfterSubscriptionEnd(workspace)")
      < analysisAction.indexOf("await consumeSharedRateLimit"),
  );
  assert.ok(
    analysisAction.indexOf("await consumeSharedRateLimit")
      < analysisAction.indexOf("getRecentContactConversationMessages("),
  );
  assert.ok(
    analysisAction.indexOf("await consumeSharedRateLimit")
      < analysisAction.indexOf("fetch(OPENAI_RESPONSES_URL"),
  );

  assert.doesNotMatch(legacyActions, /export async function analyzeFan\(/u);
  assert.doesNotMatch(legacyActions, /\bspirituell\b|energetic/u);
  assert.equal(legacyActions.includes("api.openai.com/v1/responses"), false);
  assert.match(
    analysisAction,
    /getRecentContactConversationMessages\([\s\S]*contextMessageLimit/u,
  );
  assert.match(
    analysisAction,
    /getRecentContactMemories\([\s\S]*AI_ANALYSIS_MEMORY_ROW_LIMIT/u,
  );
  assert.match(
    supabaseServer,
    /export async function getRecentContactConversationMessages[\s\S]*boundedLimit[\s\S]*"created_at\.desc"[\s\S]*\.reverse\(\)/u,
  );
  assert.match(
    supabaseServer,
    /export async function getRecentContactMemories[\s\S]*boundedLimit[\s\S]*"created_at\.desc"/u,
  );
  assert.match(
    sourceOfTruth,
    /Rollout-Blocker vor Standard-\/Plus-\/Ultra-Aktivierung[\s\S]*WORKSPACE_SERVER_OWNED_FIELDS/u,
  );
  assert.match(
    securityChecklist,
    /Rollout-Blocker:[\s\S]*20260726120000_workspace_provisioning_rpc\.sql[\s\S]*20260726121000_workspace_server_owned_columns\.sql/u,
  );
});

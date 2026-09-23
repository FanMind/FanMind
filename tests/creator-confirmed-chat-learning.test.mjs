import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { CONFIRMED_CHAT_MAX_GRAPHEMES, CONFIRMED_CHAT_MAX_RECORDS, normalizeConfirmedChatLearning, summarizeConfirmedChatLearning } from "../src/lib/creatorConfirmedChatLearning.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const now = Date.parse("2026-09-19T11:00:00Z");
const options = { now };
const ids = { workspaceId: "11111111-1111-4111-8111-111111111111", creatorId: "22222222-2222-4222-8222-222222222222", contactId: "33333333-3333-4333-8333-333333333333", conversationId: "44444444-4444-4444-8444-444444444444" };
const proposal = { ...ids, proposalId: "55555555-5555-4555-8555-555555555555", generationId: "66666666-6666-4666-8666-666666666666", creatorRevision: 7, promptRevision: "workspace-prompt:3", selectedVariant: "recommended", proposedText: "Hey, wie war dein Tag?", generatedAt: "2026-09-19T10:00:00Z" };
const outbound = { ...ids, messageId: "77777777-7777-4777-8777-777777777777", proposalId: proposal.proposalId, generationId: proposal.generationId, creatorRevision: proposal.creatorRevision, promptRevision: proposal.promptRevision, actualText: "Hey! Wie war dein Tag?", confirmedAt: "2026-09-19T10:02:00Z", confirmedBy: "88888888-8888-4888-8888-888888888888" };
const expected = { expectedWorkspaceId: ids.workspaceId, expectedCreatorId: ids.creatorId };

function record(patch = {}) { return { proposal, outbound, reaction: null, purchase: null, ...patch }; }
function purchase(attribution = null) { return { ...ids, commercialEventId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", kind: "purchase", occurredAt: "2026-09-19T10:04:00Z", attribution }; }
function attribution(patch = {}) { return { proposalId: proposal.proposalId, generationId: proposal.generationId, creatorRevision: proposal.creatorRevision, promptRevision: proposal.promptRevision, outboundMessageId: outbound.messageId, evidenceReference: "synthetic-order-link", ...patch }; }

test("selection is not outbound and outbound requires the exact proposal, generation and revisions", () => {
  assert.equal(normalizeConfirmedChatLearning(record({ outbound: null }), options).metrics, null);
  for (const [key, value] of [["proposalId", ids.contactId], ["generationId", ids.contactId], ["creatorRevision", 8], ["promptRevision", "workspace-prompt:4"]]) {
    assert.throws(() => normalizeConfirmedChatLearning(record({ outbound: { ...outbound, [key]: value } }), options), /outbound_proposal_mismatch/);
  }
  const secondProposal = { ...proposal, proposalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", generationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
  assert.throws(() => normalizeConfirmedChatLearning({ ...record(), proposal: secondProposal }, options), /outbound_proposal_mismatch/);
});

test("scope mismatches fail closed", () => {
  for (const key of ["workspaceId", "creatorId", "contactId", "conversationId"]) {
    assert.throws(() => normalizeConfirmedChatLearning(record({ outbound: { ...outbound, [key]: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } }), options), /outbound_scope_mismatch/);
  }
});

test("purchase is linked only by an explicit evidence chain", () => {
  assert.equal(normalizeConfirmedChatLearning(record({ purchase: purchase() }), options).purchase, null);
  const linked = normalizeConfirmedChatLearning(record({ purchase: purchase(attribution()) }), options);
  assert.equal(linked.purchase.commercialEventId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  assert.throws(() => normalizeConfirmedChatLearning(record({ purchase: purchase(attribution({ outboundMessageId: proposal.proposalId })) }), options), /purchase_outbound_mismatch/);
  assert.throws(() => normalizeConfirmedChatLearning(record({ purchase: { ...purchase(attribution()), workspaceId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" } }), options), /purchase_scope_mismatch/);
});

test("future timestamps fail closed while bounded skew is accepted", () => {
  assert.doesNotThrow(() => normalizeConfirmedChatLearning(record({ outbound: { ...outbound, confirmedAt: "2026-09-19T11:00:30Z" } }), options));
  assert.throws(() => normalizeConfirmedChatLearning(record({ outbound: { ...outbound, confirmedAt: "2026-09-19T11:00:31Z" } }), options), /invalid_outbound_confirmation/);
  const reaction = { ...ids, messageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee", reactedToMessageId: outbound.messageId, occurredAt: "2026-09-19T11:00:31Z" };
  assert.throws(() => normalizeConfirmedChatLearning(record({ reaction }), options), /invalid_reaction_time/);
  assert.throws(() => normalizeConfirmedChatLearning(record({ purchase: { ...purchase(attribution()), occurredAt: "2026-09-19T11:00:31Z" } }), options), /invalid_purchase_time/);
});

test("edit metrics use NFC-normalized grapheme clusters", () => {
  for (const [left, right] of [["é", "e\u0301"], ["👍🏽", "👍🏽"], ["👩‍💻", "👩‍💻"], ["plain", "plain"]]) {
    const result = normalizeConfirmedChatLearning({ ...record(), proposal: { ...proposal, proposedText: left }, outbound: { ...outbound, actualText: right } }, options);
    assert.equal(result.metrics.editDistance, 0);
    assert.equal(result.metrics.editRatio, 0);
  }
  assert.equal(normalizeConfirmedChatLearning(record(), options).metrics.unchanged, false);
});

test("multi-code-point graphemes inside the workload limit remain measurable", () => {
  const emojiText = "👩‍💻".repeat(300);
  assert.ok(emojiText.length > 512);
  const result = normalizeConfirmedChatLearning({
    ...record(),
    proposal: { ...proposal, proposedText: emojiText },
    outbound: { ...outbound, actualText: emojiText },
  }, options);
  assert.equal(result.metrics.editDistance, 0);
  assert.equal(result.metrics.unchanged, true);
});

test("edit and batch workloads are bounded without truncation", () => {
  const oversized = "a".repeat(CONFIRMED_CHAT_MAX_GRAPHEMES + 1);
  assert.throws(() => normalizeConfirmedChatLearning({ ...record(), proposal: { ...proposal, proposedText: oversized } }, options), /proposed_text_not_measurable/);
  assert.throws(() => summarizeConfirmedChatLearning(Array(CONFIRMED_CHAT_MAX_RECORDS + 1).fill(record()), expected, options), /learning_records_limit/);
});

test("deleted confirming actor remains valid anonymized historical evidence", () => {
  const normalized = normalizeConfirmedChatLearning(record({ outbound: { ...outbound, confirmedBy: null } }), options);
  assert.equal(normalized.outbound.confirmedBy, null);
  assert.equal(normalized.metrics.unchanged, false);
});

test("summary requires one expected Workspace and Creator", () => {
  const second = record({ proposal: { ...proposal, proposalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", generationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, outbound: { ...outbound, proposalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", generationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", messageId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" } });
  assert.equal(summarizeConfirmedChatLearning([record(), second], expected, options).confirmedOutbounds, 2);
  for (const key of ["workspaceId", "creatorId"]) {
    const foreignProposal = { ...second.proposal, [key]: "dddddddd-dddd-4ddd-8ddd-dddddddddddd" };
    const foreignOutbound = { ...second.outbound, [key]: foreignProposal[key] };
    assert.throws(() => summarizeConfirmedChatLearning([record(), { ...second, proposal: foreignProposal, outbound: foreignOutbound }], expected, options), /learning_summary_scope_mismatch/);
  }
});

test("duplicate stable evidence identifiers fail closed", () => {
  assert.throws(() => summarizeConfirmedChatLearning([record(), record()], expected, options), /duplicate_proposal_id/);
  const otherProposal = { ...proposal, proposalId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", generationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" };
  const duplicateOutbound = record({ proposal: otherProposal, outbound: { ...outbound, proposalId: otherProposal.proposalId, generationId: otherProposal.generationId, actualText: "different" } });
  assert.throws(() => summarizeConfirmedChatLearning([record(), duplicateOutbound], expected, options), /duplicate_outbound_message_id/);
  const firstPurchase = record({ purchase: purchase(attribution()) });
  const distinctOutbound = { ...duplicateOutbound, outbound: { ...duplicateOutbound.outbound, messageId: "ffffffff-ffff-4fff-8fff-ffffffffffff" } };
  const secondPurchase = { ...distinctOutbound, purchase: { ...purchase(attribution({ proposalId: otherProposal.proposalId, generationId: otherProposal.generationId })), attribution: attribution({ proposalId: otherProposal.proposalId, generationId: otherProposal.generationId, outboundMessageId: distinctOutbound.outbound.messageId }) } };
  assert.throws(() => summarizeConfirmedChatLearning([firstPurchase, secondPurchase], expected, options), /duplicate_purchase_event_id/);
});

test("controlled persistence keeps proposal origin server-only and evidence tenant-bound", async () => {
  const sql = await readFile(path.join(repoRoot, "supabase/controlled/20260923023000_creator_confirmed_chat_learning.sql"), "utf8");
  assert.match(sql, /create table public\.creator_confirmed_chat_learning/u);
  assert.match(sql, /foreign key \(workspace_id,creator_id\)[\s\S]*on delete cascade/u);
  assert.match(sql, /foreign key \(workspace_id,contact_id,conversation_id\)[\s\S]*on delete cascade/u);
  assert.match(sql, /enable row level security/u);
  assert.match(sql, /grant select on public\.creator_confirmed_chat_learning to authenticated/u);
  assert.match(sql, /record_creator_confirmed_chat_proposals[\s\S]*revoke all on function[\s\S]*from public, anon, authenticated, service_role;[\s\S]*grant execute on function[\s\S]*to service_role/u);
  assert.match(sql, /add column if not exists creator_learning_manual_send boolean not null default false/u);
  assert.match(sql, /stamp_creator_learning_manual_send[\s\S]*auth\.role\(\)[\s\S]*'authenticated'[\s\S]*direction = 'outbound'[\s\S]*source_type, ''\) <> 'manual_note'/u);
  assert.match(sql, /old\.creator_learning_manual_send[\s\S]*new\.workspace_id is not distinct from old\.workspace_id[\s\S]*new\.conversation_id is not distinct from old\.conversation_id[\s\S]*new\.contact_id is not distinct from old\.contact_id[\s\S]*new\.content is not distinct from old\.content/u);
  assert.match(sql, /before insert or update on public\.conversation_messages/u);
  assert.match(sql, /workspace_processing_allowed_contract\(text,text,text,boolean,text,text,jsonb,timestamp with time zone\)/u);
  assert.match(sql, /confirm_creator_confirmed_chat_outbound\([\s\S]*p_actor_user_id uuid,[\s\S]*p_expected_actual_text text[\s\S]*auth\.role\(\)[\s\S]*'service_role'[\s\S]*w\.owner_user_id = p_actor_user_id[\s\S]*workspace_processing_allowed_contract[\s\S]*m\.creator_learning_manual_send is true[\s\S]*message_text is distinct from p_expected_actual_text/u);
  assert.match(sql, /grant execute on function public\.confirm_creator_confirmed_chat_outbound\(uuid,uuid,uuid,uuid,uuid,text\)[\s\S]*to service_role/u);
  assert.doesNotMatch(sql, /grant execute on function public\.confirm_creator_confirmed_chat_outbound\([^;]+\)\s*to\s+[^;]*\bauthenticated\b[^;]*;/u);
  assert.match(sql, /link_creator_confirmed_chat_outcomes[\s\S]*workspace_owner_active_mutation_allowed\(p_workspace_id\)[\s\S]*creator_workspace_access_allowed\(p_workspace_id\)/u);
  assert.doesNotMatch(sql, /creator_learning_member_required/u);
  assert.match(sql, /proposed_text text not null check \(length\(btrim\(proposed_text\)\) between 1 and 4000\)/u);
  assert.match(sql, /actual_text\)\) between 1 and 4000/u);
  assert.doesNotMatch(sql, /proposed_text text not null check \(length\(btrim\(proposed_text\)\) between 1 and 512\)/u);
  assert.match(sql, /e\.workspace_id=target\.workspace_id[\s\S]*e\.creator_id=target\.creator_id[\s\S]*e\.contact_id=target\.contact_id[\s\S]*\(e\.conversation_id is null or e\.conversation_id=target\.conversation_id\)[\s\S]*e\.kind='purchase'[\s\S]*e\.confirmed_at is not null/u);
  assert.doesNotMatch(sql, /e\.confirmed_by is not null/u);
  assert.match(sql, /unique \(workspace_id,purchase_event_id\)/u);
  assert.match(sql, /creator_learning_outbound_conflict/u);
  assert.match(sql, /creator_learning_reaction_conflict/u);
  assert.match(sql, /creator_learning_purchase_conflict/u);
  assert.doesNotMatch(sql, /grant (?:insert|update|delete|all) on public\.creator_confirmed_chat_learning to authenticated/iu);
});

test("runtime learning API cannot mint proposals and remains rollout-gated", async () => {
  const [persistence, route, creatorIntelligence] = await Promise.all([
    readFile(path.join(repoRoot, "src/lib/creatorConfirmedChatPersistence.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/app/api/creators/learning/confirmed-chat/route.ts"), "utf8"),
    readFile(path.join(repoRoot, "src/lib/creatorIntelligence.ts"), "utf8"),
  ]);
  assert.match(persistence, /FANMIND_CREATOR_CONFIRMED_CHAT_LEARNING_ENABLED/u);
  assert.match(persistence, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(persistence, /CONFIRMED_CHAT_MAX_GRAPHEMES/u);
  assert.match(persistence, /MAX_TEXT_CODE_UNITS = 4_000/u);
  assert.match(persistence, /Intl\.Segmenter/u);
  assert.match(persistence, /readMeasurableOutboundText/u);
  assert.match(persistence, /creator_learning_manual_send/u);
  assert.match(persistence, /p_actor_user_id: actorUserId/u);
  assert.match(persistence, /p_expected_actual_text: expectedActualText/u);
  assert.match(persistence, /registerCreatorConfirmedChatProposals/u);
  assert.match(persistence, /confirmCreatorConfirmedChatOutbound/u);
  assert.match(persistence, /linkCreatorConfirmedChatOutcomes/u);
  assert.match(route, /requireContactInActiveAuthorizedWorkspace/u);
  assert.match(route, /evaluateWorkspaceProcessingEntitlement/u);
  assert.match(route, /isTrustedFanMindMutationRequest/u);
  assert.match(route, /creatorConfirmedChatLearningEnabled/u);
  assert.match(route, /confirmCreatorConfirmedChatOutbound/u);
  assert.match(route, /actorUserId: context\.user\.id/u);
  assert.match(route, /linkCreatorConfirmedChatOutcomes/u);
  assert.doesNotMatch(route, /registerCreatorConfirmedChatProposals/u);
  assert.doesNotMatch(route, /SUPABASE_SERVICE_ROLE_KEY/u);
  assert.match(creatorIntelligence, /select: "id,kind,occurred_at,amount_minor,currency,evidence_reference"/u);
});

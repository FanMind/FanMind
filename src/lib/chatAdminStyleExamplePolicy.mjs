import { createHash } from "node:crypto";

export const CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION = "non_explicit_role_style_confirmed";
export const CHAT_ADMIN_STYLE_EXAMPLE_STATUSES = Object.freeze(["draft", "approved", "revoked", "deleted"]);
export const CHAT_ADMIN_CONTEXT_SEGMENT_SELECTION_DECLARATION = "synthetic_non_explicit_context_selected";
export const CHAT_ADMIN_CONTEXT_SEGMENT_SANITIZATION_DECLARATION = "synthetic_context_person_data_removed";
export const CHAT_ADMIN_CONTEXT_SEGMENT_REVIEW_DECLARATION = "synthetic_non_explicit_context_approved";
export const CHAT_ADMIN_CONTEXT_SEGMENT_STATUSES = CHAT_ADMIN_STYLE_EXAMPLE_STATUSES;

const MAX_ID_LENGTH = 128;
const MAX_EXAMPLE_LENGTH = 1_000;
const EXAMPLE_KEYS = Object.freeze([
  "example_id",
  "workspace_id",
  "character_id",
  "revision",
  "text",
  "status",
  "reviewer_id",
  "reviewed_at",
  "reviewer_declaration",
  "preview_fingerprint",
]);
const DRAFT_INPUT_KEYS = Object.freeze(["example_id", "workspace_id", "character_id", "revision", "text"]);
const PREVIEW_KEYS = Object.freeze([
  "example_id",
  "workspace_id",
  "character_id",
  "revision",
  "text",
  "status",
  "preview_fingerprint",
]);
const APPROVAL_INPUT_KEYS = Object.freeze([
  "example",
  "preview",
  "workspace_id",
  "character_id",
  "current_revision",
  "reviewer_id",
  "reviewed_at",
  "reviewer_declaration",
]);
const CONTEXT_SEGMENT_KEYS = Object.freeze([
  "segment_id",
  "workspace_id",
  "character_id",
  "revision",
  "context_turns",
  "selected_response_ordinals",
  "provenance",
  "status",
  "selector_id",
  "selected_at",
  "selection_declaration",
  "sanitizer_id",
  "sanitized_at",
  "sanitization_declaration",
  "reviewer_id",
  "reviewed_at",
  "reviewer_declaration",
  "preview_fingerprint",
]);
const CONTEXT_SEGMENT_DRAFT_INPUT_KEYS = Object.freeze([
  "segment_id",
  "workspace_id",
  "character_id",
  "revision",
  "context_turns",
  "selected_response_ordinals",
  "provenance",
]);
const CONTEXT_SEGMENT_PREVIEW_KEYS = Object.freeze([
  "segment_id",
  "workspace_id",
  "character_id",
  "revision",
  "context_turns",
  "selected_response_ordinals",
  "provenance",
  "status",
  "preview_fingerprint",
]);
const CONTEXT_SEGMENT_APPROVAL_INPUT_KEYS = Object.freeze([
  "segment",
  "preview",
  "workspace_id",
  "character_id",
  "current_revision",
  "selector_id",
  "selected_at",
  "selection_declaration",
  "sanitizer_id",
  "sanitized_at",
  "sanitization_declaration",
  "reviewer_id",
  "reviewed_at",
  "reviewer_declaration",
]);
const CONTEXT_TURN_KEYS = Object.freeze(["ordinal", "speaker", "text"]);
const CONTEXT_PROVENANCE_KEYS = Object.freeze(["source_type", "source_reference"]);
const FORBIDDEN_FIELD_NAMES = new Set([
  "fan",
  "fanid",
  "contact",
  "contactid",
  "conversation",
  "conversationid",
  "message",
  "messageid",
  "messages",
  "memory",
  "memories",
  "purchase",
  "purchaseid",
  "purchasehistory",
  "order",
  "orderid",
  "payment",
  "paymentid",
  "customer",
  "customerid",
  "account",
  "accountid",
  "accounts",
  "secret",
  "secrets",
  "credential",
  "credentials",
  "token",
  "accesstoken",
]);

export class ChatAdminStyleExamplePolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "ChatAdminStyleExamplePolicyError";
    this.code = code;
  }
}

function fail(code) {
  throw new ChatAdminStyleExamplePolicyError(code);
}

function record(value, code = "invalid_style_example") {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value;
}

function normalizedFieldName(value) {
  return value.replace(/[^a-z0-9]/giu, "").toLowerCase();
}

function assertNoForbiddenFields(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenFields);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_FIELD_NAMES.has(normalizedFieldName(key))) fail("forbidden_person_data_field");
    assertNoForbiddenFields(child);
  }
}

function assertExactKeys(value, allowed, code = "invalid_style_example_field") {
  const keys = Object.keys(value).sort();
  const expected = [...allowed].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) fail(code);
}

function boundedText(value, max, code) {
  if (typeof value !== "string") fail(code);
  const normalized = value.trim();
  if (!normalized || normalized.length > max) fail(code);
  return normalized;
}

function identifier(value, code) {
  return boundedText(value, MAX_ID_LENGTH, code);
}

function revision(value, code = "invalid_style_example_revision") {
  if (!Number.isSafeInteger(value) || value < 1 || value >= 2_147_483_647) fail(code);
  return value;
}

function reviewedAt(value, now) {
  if (typeof value !== "string") fail("invalid_reviewed_at");
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp) || timestamp > now) fail("invalid_reviewed_at");
  return new Date(timestamp).toISOString();
}

function eventAt(value, now, code) {
  if (typeof value !== "string") fail(code);
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || parsed > now) fail(code);
  return new Date(parsed).toISOString();
}

function assertContextReviewOrder(selectedAt, sanitizedAt, approvedAt) {
  if (Date.parse(selectedAt) > Date.parse(sanitizedAt) || Date.parse(sanitizedAt) > Date.parse(approvedAt)) {
    fail("invalid_context_review_order");
  }
}

function previewPayload(example) {
  return {
    example_id: example.example_id,
    workspace_id: example.workspace_id,
    character_id: example.character_id,
    revision: example.revision,
    text: example.text,
    status: "draft",
  };
}

function fingerprint(payload) {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
}

function normalizedExample(value) {
  const input = record(value);
  assertNoForbiddenFields(input);
  assertExactKeys(input, EXAMPLE_KEYS);
  const status = CHAT_ADMIN_STYLE_EXAMPLE_STATUSES.includes(input.status) ? input.status : fail("invalid_style_example_status");
  const result = {
    example_id: identifier(input.example_id, "invalid_example_id"),
    workspace_id: identifier(input.workspace_id, "invalid_workspace_id"),
    character_id: identifier(input.character_id, "invalid_character_id"),
    revision: revision(input.revision),
    text: boundedText(input.text, MAX_EXAMPLE_LENGTH, "invalid_example_text"),
    status,
    reviewer_id: input.reviewer_id,
    reviewed_at: input.reviewed_at,
    reviewer_declaration: input.reviewer_declaration,
    preview_fingerprint: input.preview_fingerprint,
  };
  if (status === "draft") {
    if ([result.reviewer_id, result.reviewed_at, result.reviewer_declaration, result.preview_fingerprint].some((item) => item !== null)) {
      fail("draft_has_review_metadata");
    }
  } else if (status === "deleted" && [result.reviewer_id, result.reviewed_at, result.reviewer_declaration, result.preview_fingerprint].every((item) => item === null)) {
    // A draft may be deleted before review. The tombstone carries no invented
    // approval metadata and remains unusable.
  } else {
    result.reviewer_id = identifier(result.reviewer_id, "invalid_reviewer_id");
    result.reviewed_at = reviewedAt(result.reviewed_at, Date.now());
    if (result.reviewer_declaration !== CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION) fail("reviewer_declaration_required");
    if (typeof result.preview_fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(result.preview_fingerprint)) fail("invalid_preview_fingerprint");
  }
  return result;
}

export function createChatAdminStyleExampleDraft(value) {
  const input = record(value);
  assertNoForbiddenFields(input);
  assertExactKeys(input, DRAFT_INPUT_KEYS);
  return {
    example_id: identifier(input.example_id, "invalid_example_id"),
    workspace_id: identifier(input.workspace_id, "invalid_workspace_id"),
    character_id: identifier(input.character_id, "invalid_character_id"),
    revision: revision(input.revision),
    text: boundedText(input.text, MAX_EXAMPLE_LENGTH, "invalid_example_text"),
    status: "draft",
    reviewer_id: null,
    reviewed_at: null,
    reviewer_declaration: null,
    preview_fingerprint: null,
  };
}

export function previewChatAdminStyleExample(value) {
  const example = normalizedExample(value);
  if (example.status !== "draft") fail("preview_requires_draft");
  const payload = previewPayload(example);
  return { ...payload, preview_fingerprint: fingerprint(payload) };
}

export function approveChatAdminStyleExample(value, now = Date.now()) {
  const input = record(value, "invalid_style_example_approval");
  assertNoForbiddenFields(input);
  assertExactKeys(input, APPROVAL_INPUT_KEYS, "invalid_style_example_approval_field");
  const example = normalizedExample(input.example);
  if (example.status !== "draft") fail("approval_requires_draft");
  const workspaceId = identifier(input.workspace_id, "invalid_workspace_id");
  const characterId = identifier(input.character_id, "invalid_character_id");
  const currentRevision = revision(input.current_revision, "invalid_current_revision");
  if (example.workspace_id !== workspaceId || example.character_id !== characterId) fail("style_example_scope_mismatch");
  if (example.revision !== currentRevision) fail("stale_style_example_revision");
  const expectedPreview = previewChatAdminStyleExample(example);
  const suppliedPreview = record(input.preview, "preview_required");
  assertNoForbiddenFields(suppliedPreview);
  assertExactKeys(suppliedPreview, PREVIEW_KEYS, "preview_mismatch");
  if (PREVIEW_KEYS.some((key) => suppliedPreview[key] !== expectedPreview[key])) fail("preview_mismatch");
  if (input.reviewer_declaration !== CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION) fail("reviewer_declaration_required");
  return {
    ...example,
    status: "approved",
    reviewer_id: identifier(input.reviewer_id, "invalid_reviewer_id"),
    reviewed_at: reviewedAt(input.reviewed_at, now),
    reviewer_declaration: input.reviewer_declaration,
    preview_fingerprint: expectedPreview.preview_fingerprint,
  };
}

export function correctChatAdminStyleExample(value, correction) {
  const example = normalizedExample(value);
  if (example.status === "deleted") fail("deleted_style_example");
  const input = record(correction, "invalid_style_example_correction");
  assertNoForbiddenFields(input);
  assertExactKeys(input, ["text"], "invalid_style_example_correction_field");
  return createChatAdminStyleExampleDraft({
    example_id: example.example_id,
    workspace_id: example.workspace_id,
    character_id: example.character_id,
    revision: example.revision + 1,
    text: input.text,
  });
}

export function revokeChatAdminStyleExample(value) {
  const example = normalizedExample(value);
  if (example.status !== "approved") fail("revocation_requires_approval");
  return { ...example, status: "revoked" };
}

export function deleteChatAdminStyleExample(value) {
  const example = normalizedExample(value);
  return { ...example, status: "deleted" };
}

export function compileChatAdminStyleExamples(value) {
  const input = record(value, "invalid_style_example_collection");
  assertNoForbiddenFields(input);
  assertExactKeys(input, ["workspace_id", "character_id", "current_revision", "examples"], "invalid_style_example_collection_field");
  const workspaceId = identifier(input.workspace_id, "invalid_workspace_id");
  const characterId = identifier(input.character_id, "invalid_character_id");
  const currentRevision = revision(input.current_revision, "invalid_current_revision");
  if (!Array.isArray(input.examples)) fail("invalid_style_examples");
  const compiled = [];
  const ids = new Set();
  for (const raw of input.examples) {
    const example = normalizedExample(raw);
    if (example.workspace_id !== workspaceId || example.character_id !== characterId) fail("style_example_scope_mismatch");
    if (example.revision !== currentRevision) fail("stale_style_example_revision");
    if (ids.has(example.example_id)) fail("duplicate_style_example");
    ids.add(example.example_id);
    if (example.status !== "approved") continue;
    const expectedFingerprint = fingerprint(previewPayload({ ...example, status: "draft" }));
    if (example.preview_fingerprint !== expectedFingerprint) fail("preview_mismatch");
    compiled.push({ example_id: example.example_id, revision: example.revision, text: example.text });
  }
  return compiled;
}

function normalizedContextTurns(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 20) fail("invalid_context_turns");
  const turns = value.map((raw, index) => {
    const turn = record(raw, "invalid_context_turn");
    assertExactKeys(turn, CONTEXT_TURN_KEYS, "invalid_context_turn_field");
    if (turn.ordinal !== index + 1) fail("invalid_context_turn_order");
    if (turn.speaker !== "counterpart" && turn.speaker !== "character") fail("invalid_context_turn_speaker");
    return {
      ordinal: turn.ordinal,
      speaker: turn.speaker,
      text: boundedText(turn.text, MAX_EXAMPLE_LENGTH, "invalid_context_turn_text"),
    };
  });
  if (!turns.some(({ speaker }) => speaker === "counterpart") || !turns.some(({ speaker }) => speaker === "character")) {
    fail("incomplete_context_segment");
  }
  return turns;
}

function normalizedSelectedResponseOrdinals(value, turns) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) fail("invalid_selected_responses");
  let previous = 0;
  return value.map((item) => {
    if (!Number.isSafeInteger(item) || item <= previous) fail("invalid_selected_response_order");
    const turn = turns[item - 1];
    if (!turn || turn.speaker !== "character") fail("selected_response_must_be_character_turn");
    previous = item;
    return item;
  });
}

function normalizedContextProvenance(value) {
  const provenance = record(value, "invalid_context_provenance");
  assertExactKeys(provenance, CONTEXT_PROVENANCE_KEYS, "invalid_context_provenance_field");
  if (provenance.source_type !== "synthetic") fail("synthetic_context_required");
  return {
    source_type: "synthetic",
    source_reference: identifier(provenance.source_reference, "invalid_context_source_reference"),
  };
}

function contextSegmentPreviewPayload(segment) {
  return {
    segment_id: segment.segment_id,
    workspace_id: segment.workspace_id,
    character_id: segment.character_id,
    revision: segment.revision,
    context_turns: segment.context_turns,
    selected_response_ordinals: segment.selected_response_ordinals,
    provenance: segment.provenance,
    status: "draft",
  };
}

function normalizedContextSegment(value) {
  const input = record(value, "invalid_context_segment");
  assertNoForbiddenFields(input);
  assertExactKeys(input, CONTEXT_SEGMENT_KEYS, "invalid_context_segment_field");
  const status = CHAT_ADMIN_CONTEXT_SEGMENT_STATUSES.includes(input.status) ? input.status : fail("invalid_context_segment_status");
  const contextTurns = normalizedContextTurns(input.context_turns);
  const result = {
    segment_id: identifier(input.segment_id, "invalid_segment_id"),
    workspace_id: identifier(input.workspace_id, "invalid_workspace_id"),
    character_id: identifier(input.character_id, "invalid_character_id"),
    revision: revision(input.revision, "invalid_context_segment_revision"),
    context_turns: contextTurns,
    selected_response_ordinals: normalizedSelectedResponseOrdinals(input.selected_response_ordinals, contextTurns),
    provenance: normalizedContextProvenance(input.provenance),
    status,
    selector_id: input.selector_id,
    selected_at: input.selected_at,
    selection_declaration: input.selection_declaration,
    sanitizer_id: input.sanitizer_id,
    sanitized_at: input.sanitized_at,
    sanitization_declaration: input.sanitization_declaration,
    reviewer_id: input.reviewer_id,
    reviewed_at: input.reviewed_at,
    reviewer_declaration: input.reviewer_declaration,
    preview_fingerprint: input.preview_fingerprint,
  };
  const reviewMetadata = [
    result.selector_id,
    result.selected_at,
    result.selection_declaration,
    result.sanitizer_id,
    result.sanitized_at,
    result.sanitization_declaration,
    result.reviewer_id,
    result.reviewed_at,
    result.reviewer_declaration,
    result.preview_fingerprint,
  ];
  if (status === "draft") {
    if (reviewMetadata.some((item) => item !== null)) fail("draft_has_review_metadata");
  } else if (status === "deleted" && reviewMetadata.every((item) => item === null)) {
    // A never-approved draft may be deleted without inventing review metadata.
  } else {
    result.selector_id = identifier(result.selector_id, "invalid_selector_id");
    result.selected_at = eventAt(result.selected_at, Date.now(), "invalid_selected_at");
    result.sanitizer_id = identifier(result.sanitizer_id, "invalid_sanitizer_id");
    result.sanitized_at = eventAt(result.sanitized_at, Date.now(), "invalid_sanitized_at");
    result.reviewer_id = identifier(result.reviewer_id, "invalid_reviewer_id");
    result.reviewed_at = eventAt(result.reviewed_at, Date.now(), "invalid_reviewed_at");
    assertContextReviewOrder(result.selected_at, result.sanitized_at, result.reviewed_at);
    if (result.selection_declaration !== CHAT_ADMIN_CONTEXT_SEGMENT_SELECTION_DECLARATION) fail("selection_declaration_required");
    if (result.sanitization_declaration !== CHAT_ADMIN_CONTEXT_SEGMENT_SANITIZATION_DECLARATION) fail("sanitization_declaration_required");
    if (result.reviewer_declaration !== CHAT_ADMIN_CONTEXT_SEGMENT_REVIEW_DECLARATION) fail("reviewer_declaration_required");
    if (typeof result.preview_fingerprint !== "string" || !/^[a-f0-9]{64}$/u.test(result.preview_fingerprint)) fail("invalid_preview_fingerprint");
  }
  return result;
}

export function createChatAdminContextSegmentDraft(value) {
  const input = record(value, "invalid_context_segment");
  assertNoForbiddenFields(input);
  assertExactKeys(input, CONTEXT_SEGMENT_DRAFT_INPUT_KEYS, "invalid_context_segment_field");
  const contextTurns = normalizedContextTurns(input.context_turns);
  return {
    segment_id: identifier(input.segment_id, "invalid_segment_id"),
    workspace_id: identifier(input.workspace_id, "invalid_workspace_id"),
    character_id: identifier(input.character_id, "invalid_character_id"),
    revision: revision(input.revision, "invalid_context_segment_revision"),
    context_turns: contextTurns,
    selected_response_ordinals: normalizedSelectedResponseOrdinals(input.selected_response_ordinals, contextTurns),
    provenance: normalizedContextProvenance(input.provenance),
    status: "draft",
    selector_id: null,
    selected_at: null,
    selection_declaration: null,
    sanitizer_id: null,
    sanitized_at: null,
    sanitization_declaration: null,
    reviewer_id: null,
    reviewed_at: null,
    reviewer_declaration: null,
    preview_fingerprint: null,
  };
}

export function previewChatAdminContextSegment(value) {
  const segment = normalizedContextSegment(value);
  if (segment.status !== "draft") fail("preview_requires_draft");
  const payload = contextSegmentPreviewPayload(segment);
  return { ...payload, preview_fingerprint: fingerprint(payload) };
}

export function approveChatAdminContextSegment(value, now = Date.now()) {
  const input = record(value, "invalid_context_segment_approval");
  assertNoForbiddenFields(input);
  assertExactKeys(input, CONTEXT_SEGMENT_APPROVAL_INPUT_KEYS, "invalid_context_segment_approval_field");
  const segment = normalizedContextSegment(input.segment);
  if (segment.status !== "draft") fail("approval_requires_draft");
  const workspaceId = identifier(input.workspace_id, "invalid_workspace_id");
  const characterId = identifier(input.character_id, "invalid_character_id");
  const currentRevision = revision(input.current_revision, "invalid_current_revision");
  if (segment.workspace_id !== workspaceId || segment.character_id !== characterId) fail("context_segment_scope_mismatch");
  if (segment.revision !== currentRevision) fail("stale_context_segment_revision");
  const expectedPreview = previewChatAdminContextSegment(segment);
  const suppliedPreview = record(input.preview, "preview_required");
  assertNoForbiddenFields(suppliedPreview);
  assertExactKeys(suppliedPreview, CONTEXT_SEGMENT_PREVIEW_KEYS, "preview_mismatch");
  if (CONTEXT_SEGMENT_PREVIEW_KEYS.some((key) => JSON.stringify(suppliedPreview[key]) !== JSON.stringify(expectedPreview[key]))) {
    fail("preview_mismatch");
  }
  if (input.selection_declaration !== CHAT_ADMIN_CONTEXT_SEGMENT_SELECTION_DECLARATION) fail("selection_declaration_required");
  if (input.sanitization_declaration !== CHAT_ADMIN_CONTEXT_SEGMENT_SANITIZATION_DECLARATION) fail("sanitization_declaration_required");
  if (input.reviewer_declaration !== CHAT_ADMIN_CONTEXT_SEGMENT_REVIEW_DECLARATION) fail("reviewer_declaration_required");
  const selectedAt = eventAt(input.selected_at, now, "invalid_selected_at");
  const sanitizedAt = eventAt(input.sanitized_at, now, "invalid_sanitized_at");
  const approvedAt = eventAt(input.reviewed_at, now, "invalid_reviewed_at");
  assertContextReviewOrder(selectedAt, sanitizedAt, approvedAt);
  return {
    ...segment,
    status: "approved",
    selector_id: identifier(input.selector_id, "invalid_selector_id"),
    selected_at: selectedAt,
    selection_declaration: input.selection_declaration,
    sanitizer_id: identifier(input.sanitizer_id, "invalid_sanitizer_id"),
    sanitized_at: sanitizedAt,
    sanitization_declaration: input.sanitization_declaration,
    reviewer_id: identifier(input.reviewer_id, "invalid_reviewer_id"),
    reviewed_at: approvedAt,
    reviewer_declaration: input.reviewer_declaration,
    preview_fingerprint: expectedPreview.preview_fingerprint,
  };
}

export function correctChatAdminContextSegment(value, correction) {
  const segment = normalizedContextSegment(value);
  if (segment.status === "deleted") fail("deleted_context_segment");
  const input = record(correction, "invalid_context_segment_correction");
  assertNoForbiddenFields(input);
  assertExactKeys(input, ["context_turns", "selected_response_ordinals", "provenance"], "invalid_context_segment_correction_field");
  return createChatAdminContextSegmentDraft({
    segment_id: segment.segment_id,
    workspace_id: segment.workspace_id,
    character_id: segment.character_id,
    revision: segment.revision + 1,
    context_turns: input.context_turns,
    selected_response_ordinals: input.selected_response_ordinals,
    provenance: input.provenance,
  });
}

export function revokeChatAdminContextSegment(value) {
  const segment = normalizedContextSegment(value);
  if (segment.status !== "approved") fail("revocation_requires_approval");
  return { ...segment, status: "revoked" };
}

export function deleteChatAdminContextSegment(value) {
  const segment = normalizedContextSegment(value);
  return { ...segment, status: "deleted" };
}

export function compileChatAdminContextSegments(value) {
  const input = record(value, "invalid_context_segment_collection");
  assertNoForbiddenFields(input);
  assertExactKeys(input, ["workspace_id", "character_id", "current_revision", "segments"], "invalid_context_segment_collection_field");
  const workspaceId = identifier(input.workspace_id, "invalid_workspace_id");
  const characterId = identifier(input.character_id, "invalid_character_id");
  const currentRevision = revision(input.current_revision, "invalid_current_revision");
  if (!Array.isArray(input.segments)) fail("invalid_context_segments");
  const compiled = [];
  const ids = new Set();
  for (const raw of input.segments) {
    const segment = normalizedContextSegment(raw);
    if (segment.workspace_id !== workspaceId || segment.character_id !== characterId) fail("context_segment_scope_mismatch");
    if (segment.revision !== currentRevision) fail("stale_context_segment_revision");
    if (ids.has(segment.segment_id)) fail("duplicate_context_segment");
    ids.add(segment.segment_id);
    if (segment.status !== "approved") continue;
    const expectedFingerprint = fingerprint(contextSegmentPreviewPayload({ ...segment, status: "draft" }));
    if (segment.preview_fingerprint !== expectedFingerprint) fail("preview_mismatch");
    compiled.push({
      segment_id: segment.segment_id,
      revision: segment.revision,
      context_turns: segment.context_turns,
      selected_response_ordinals: segment.selected_response_ordinals,
      provenance: segment.provenance,
    });
  }
  return compiled;
}


import { createHash } from "node:crypto";

export const CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION = "non_explicit_role_style_confirmed";
export const CHAT_ADMIN_STYLE_EXAMPLE_STATUSES = Object.freeze(["draft", "approved", "revoked", "deleted"]);

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

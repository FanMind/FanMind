import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION,
  ChatAdminStyleExamplePolicyError,
  approveChatAdminStyleExample,
  compileChatAdminStyleExamples,
  correctChatAdminStyleExample,
  createChatAdminStyleExampleDraft,
  deleteChatAdminStyleExample,
  previewChatAdminStyleExample,
  revokeChatAdminStyleExample,
} from "../src/lib/chatAdminStyleExamplePolicy.mjs";

const NOW = Date.parse("2026-10-30T12:00:00.000Z");
const scope = {
  workspace_id: "workspace-synthetic",
  character_id: "character-anna",
  current_revision: 1,
};

function draft(overrides = {}) {
  return createChatAdminStyleExampleDraft({
    example_id: "example-welcome",
    workspace_id: scope.workspace_id,
    character_id: scope.character_id,
    revision: scope.current_revision,
    text: "Du bist ja heute charmant unterwegs 🙂",
    ...overrides,
  });
}

function approve(example = draft(), overrides = {}) {
  return approveChatAdminStyleExample({
    example,
    preview: previewChatAdminStyleExample(example),
    ...scope,
    reviewer_id: "reviewer-human",
    reviewed_at: "2026-10-30T11:00:00.000Z",
    reviewer_declaration: CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION,
    ...overrides,
  }, NOW);
}

function expectCode(code, action) {
  assert.throws(action, (error) => error instanceof ChatAdminStyleExamplePolicyError && error.code === code);
}

test("draft is previewable but never compiled as usable style context", () => {
  const example = draft();
  const preview = previewChatAdminStyleExample(example);
  assert.deepEqual(preview, {
    example_id: example.example_id,
    workspace_id: scope.workspace_id,
    character_id: scope.character_id,
    revision: 1,
    text: example.text,
    status: "draft",
    preview_fingerprint: preview.preview_fingerprint,
  });
  assert.match(preview.preview_fingerprint, /^[a-f0-9]{64}$/u);
  assert.deepEqual(compileChatAdminStyleExamples({ ...scope, examples: [example] }), []);
});

test("approval binds exact preview, scope, current revision and human review metadata", () => {
  const approved = approve();
  assert.equal(approved.status, "approved");
  assert.equal(approved.reviewer_id, "reviewer-human");
  assert.equal(approved.reviewed_at, "2026-10-30T11:00:00.000Z");
  assert.deepEqual(compileChatAdminStyleExamples({ ...scope, examples: [approved] }), [{
    example_id: approved.example_id,
    revision: 1,
    text: approved.text,
  }]);
});

test("missing or altered preview fails closed", () => {
  const example = draft();
  expectCode("preview_required", () => approve(example, { preview: null }));
  const preview = previewChatAdminStyleExample(example);
  assert.equal(approve(example, {
    preview: {
      preview_fingerprint: preview.preview_fingerprint,
      status: preview.status,
      text: preview.text,
      revision: preview.revision,
      character_id: preview.character_id,
      workspace_id: preview.workspace_id,
      example_id: preview.example_id,
    },
  }).status, "approved");
  expectCode("preview_mismatch", () => approve(example, {
    preview: { ...preview, text: "Ein anderer Text" },
  }));
});

test("scope, stale revision, reviewer declaration and future review time fail closed", () => {
  const example = draft();
  expectCode("style_example_scope_mismatch", () => approve(example, { character_id: "character-bea" }));
  expectCode("stale_style_example_revision", () => approve(example, { current_revision: 2 }));
  expectCode("reviewer_declaration_required", () => approve(example, { reviewer_declaration: "approved" }));
  expectCode("invalid_reviewed_at", () => approve(example, { reviewed_at: "2026-10-30T13:00:00.000Z" }));
});

test("correction creates a new draft revision and requires a fresh preview and approval", () => {
  const approved = approve();
  const corrected = correctChatAdminStyleExample(approved, { text: "Das klingt nach einem richtig guten Plan 🙂" });
  assert.equal(corrected.revision, 2);
  assert.equal(corrected.status, "draft");
  assert.equal(corrected.reviewer_id, null);
  assert.equal(corrected.preview_fingerprint, null);
  expectCode("stale_style_example_revision", () => compileChatAdminStyleExamples({ ...scope, examples: [corrected] }));
  assert.deepEqual(compileChatAdminStyleExamples({ ...scope, current_revision: 2, examples: [corrected] }), []);
});

test("revoked and deleted examples are never compiled", () => {
  const originalDraft = draft();
  const originalPreview = previewChatAdminStyleExample(originalDraft);
  const approved = approve(originalDraft);
  const revoked = revokeChatAdminStyleExample(approved);
  const deletedDraft = deleteChatAdminStyleExample(originalDraft);
  const deleted = deleteChatAdminStyleExample(approved);
  assert.deepEqual(compileChatAdminStyleExamples({ ...scope, examples: [revoked] }), []);
  assert.deepEqual(compileChatAdminStyleExamples({ ...scope, examples: [deletedDraft] }), []);
  assert.deepEqual(compileChatAdminStyleExamples({ ...scope, examples: [deleted] }), []);
  expectCode("invalid_style_example_status", () => compileChatAdminStyleExamples({
    ...scope,
    examples: [{ ...approved, status: "archived" }],
  }));
  expectCode("approval_requires_draft", () => approveChatAdminStyleExample({
    example: revoked,
    preview: originalPreview,
    ...scope,
    reviewer_id: "reviewer-human",
    reviewed_at: "2026-10-30T11:00:00.000Z",
    reviewer_declaration: CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION,
  }, NOW));
});

test("fan, contact, conversation, message, purchase and memory fields are rejected", () => {
  for (const field of ["fan_id", "contact_id", "conversation_id", "message_id", "purchase_history", "memory"]) {
    expectCode("forbidden_person_data_field", () => createChatAdminStyleExampleDraft({
      example_id: "example-private",
      workspace_id: scope.workspace_id,
      character_id: scope.character_id,
      revision: 1,
      text: "Schön, wieder von dir zu lesen.",
      [field]: "must-not-enter-style-profile",
    }));
  }
});

test("character isolation fails closed and policy performs no fetch or persistence", () => {
  const approved = approve();
  const otherDraft = draft({ character_id: "character-bea" });
  const otherApproved = approve(otherDraft, { character_id: "character-bea" });
  assert.notEqual(previewChatAdminStyleExample(draft()).preview_fingerprint, previewChatAdminStyleExample(otherDraft).preview_fingerprint);
  assert.deepEqual(compileChatAdminStyleExamples({ ...scope, examples: [approved] }).map(({ text }) => text), [approved.text]);
  assert.deepEqual(compileChatAdminStyleExamples({
    ...scope,
    character_id: "character-bea",
    examples: [otherApproved],
  }).map(({ text }) => text), [otherApproved.text]);
  expectCode("style_example_scope_mismatch", () => compileChatAdminStyleExamples({
    workspace_id: scope.workspace_id,
    character_id: "character-bea",
    current_revision: 1,
    examples: [approved],
  }));

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("network access is forbidden");
  };
  try {
    assert.equal(compileChatAdminStyleExamples({ ...scope, examples: [approved] }).length, 1);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

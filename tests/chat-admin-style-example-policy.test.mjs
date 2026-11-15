import assert from "node:assert/strict";
import test from "node:test";
import {
  CHAT_ADMIN_CONTEXT_SEGMENT_REVIEW_DECLARATION,
  CHAT_ADMIN_CONTEXT_SEGMENT_SANITIZATION_DECLARATION,
  CHAT_ADMIN_CONTEXT_SEGMENT_SELECTION_DECLARATION,
  CHAT_ADMIN_STYLE_EXAMPLE_REVIEW_DECLARATION,
  ChatAdminStyleExamplePolicyError,
  approveChatAdminContextSegment,
  approveChatAdminStyleExample,
  compileChatAdminContextSegments,
  compileChatAdminStyleExamples,
  correctChatAdminContextSegment,
  correctChatAdminStyleExample,
  createChatAdminContextSegmentDraft,
  createChatAdminStyleExampleDraft,
  deleteChatAdminContextSegment,
  deleteChatAdminStyleExample,
  previewChatAdminContextSegment,
  previewChatAdminStyleExample,
  revokeChatAdminContextSegment,
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

const contextTurns = Object.freeze([
  { ordinal: 1, speaker: "counterpart", text: "Du klingst heute ziemlich gut gelaunt." },
  { ordinal: 2, speaker: "character", text: "Erwischt 🙂 Ein bisschen gute Laune schadet nie." },
  { ordinal: 3, speaker: "counterpart", text: "Das steckt an." },
  { ordinal: 4, speaker: "character", text: "Dann hat sich mein Plan ja schon gelohnt." },
]);

function contextDraft(overrides = {}) {
  return createChatAdminContextSegmentDraft({
    segment_id: "segment-playful-greeting",
    workspace_id: scope.workspace_id,
    character_id: scope.character_id,
    revision: scope.current_revision,
    context_turns: contextTurns,
    selected_response_ordinals: [2, 4],
    provenance: { source_type: "synthetic", source_reference: "fixture-playful-greeting-v1" },
    ...overrides,
  });
}

function approveContext(segment = contextDraft(), overrides = {}) {
  return approveChatAdminContextSegment({
    segment,
    preview: previewChatAdminContextSegment(segment),
    ...scope,
    selector_id: "selector-human",
    selected_at: "2026-10-30T10:55:00.000Z",
    selection_declaration: CHAT_ADMIN_CONTEXT_SEGMENT_SELECTION_DECLARATION,
    sanitizer_id: "sanitizer-human",
    sanitized_at: "2026-10-30T10:57:00.000Z",
    sanitization_declaration: CHAT_ADMIN_CONTEXT_SEGMENT_SANITIZATION_DECLARATION,
    reviewer_id: "reviewer-human",
    reviewed_at: "2026-10-30T11:00:00.000Z",
    reviewer_declaration: CHAT_ADMIN_CONTEXT_SEGMENT_REVIEW_DECLARATION,
    ...overrides,
  }, NOW);
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

test("synthetic context draft previews ordered context and selected character responses but does not compile", () => {
  const segment = contextDraft();
  const preview = previewChatAdminContextSegment(segment);
  assert.deepEqual(preview.context_turns, contextTurns);
  assert.deepEqual(preview.selected_response_ordinals, [2, 4]);
  assert.deepEqual(preview.provenance, { source_type: "synthetic", source_reference: "fixture-playful-greeting-v1" });
  assert.match(preview.preview_fingerprint, /^[a-f0-9]{64}$/u);
  assert.deepEqual(compileChatAdminContextSegments({ ...scope, segments: [segment] }), []);
});

test("context approval binds scope, revision, preview, selection, sanitization and review declarations", () => {
  const approved = approveContext();
  assert.equal(approved.status, "approved");
  assert.equal(approved.selector_id, "selector-human");
  assert.equal(approved.sanitizer_id, "sanitizer-human");
  assert.equal(approved.reviewer_id, "reviewer-human");
  assert.deepEqual(compileChatAdminContextSegments({ ...scope, segments: [approved] }), [{
    segment_id: approved.segment_id,
    revision: 1,
    context_turns: contextTurns,
    selected_response_ordinals: [2, 4],
    provenance: { source_type: "synthetic", source_reference: "fixture-playful-greeting-v1" },
  }]);
});

test("context approval rejects scope, revision, preview and missing human declarations", () => {
  const segment = contextDraft();
  expectCode("context_segment_scope_mismatch", () => approveContext(segment, { character_id: "character-bea" }));
  expectCode("stale_context_segment_revision", () => approveContext(segment, { current_revision: 2 }));
  expectCode("preview_mismatch", () => approveContext(segment, {
    preview: { ...previewChatAdminContextSegment(segment), selected_response_ordinals: [4] },
  }));
  expectCode("selection_declaration_required", () => approveContext(segment, { selection_declaration: "selected" }));
  expectCode("sanitization_declaration_required", () => approveContext(segment, { sanitization_declaration: "clean" }));
  expectCode("reviewer_declaration_required", () => approveContext(segment, { reviewer_declaration: "approved" }));
  expectCode("invalid_context_review_order", () => approveContext(segment, {
    selected_at: "2026-10-30T11:01:00.000Z",
  }));
});

test("context structure and provenance fail closed unless ordered, synthetic and character-selected", () => {
  expectCode("invalid_context_turn_order", () => contextDraft({
    context_turns: contextTurns.map((turn, index) => ({ ...turn, ordinal: index + 2 })),
  }));
  expectCode("selected_response_must_be_character_turn", () => contextDraft({ selected_response_ordinals: [1] }));
  expectCode("invalid_selected_response_order", () => contextDraft({ selected_response_ordinals: [4, 2] }));
  expectCode("synthetic_context_required", () => contextDraft({
    provenance: { source_type: "real_chat", source_reference: "conversation-export" },
  }));
});

test("context correction creates a fresh draft while revoked and deleted segments never compile", () => {
  const approved = approveContext();
  const correctedTurns = contextTurns.map((turn) => turn.ordinal === 4 ? { ...turn, text: "Dann ist mein kleiner Plan aufgegangen." } : turn);
  const corrected = correctChatAdminContextSegment(approved, {
    context_turns: correctedTurns,
    selected_response_ordinals: [2, 4],
    provenance: { source_type: "synthetic", source_reference: "fixture-playful-greeting-v2" },
  });
  assert.equal(corrected.revision, 2);
  assert.equal(corrected.status, "draft");
  assert.equal(corrected.preview_fingerprint, null);
  assert.deepEqual(compileChatAdminContextSegments({ ...scope, current_revision: 2, segments: [corrected] }), []);
  assert.deepEqual(compileChatAdminContextSegments({ ...scope, segments: [revokeChatAdminContextSegment(approved)] }), []);
  assert.deepEqual(compileChatAdminContextSegments({ ...scope, segments: [deleteChatAdminContextSegment(approved)] }), []);
  expectCode("deleted_context_segment", () => correctChatAdminContextSegment(deleteChatAdminContextSegment(approved), {
    context_turns: correctedTurns,
    selected_response_ordinals: [2, 4],
    provenance: { source_type: "synthetic", source_reference: "fixture-playful-greeting-v2" },
  }));
});

test("context contract rejects personal, payment, account and secret fields at every depth", () => {
  for (const field of ["fan_id", "contact_id", "conversation_id", "message_id", "purchase_id", "payment_id", "account_id", "secret", "access_token"]) {
    expectCode("forbidden_person_data_field", () => contextDraft({
      provenance: {
        source_type: "synthetic",
        source_reference: "fixture-private-field",
        [field]: "must-not-enter-style-profile",
      },
    }));
  }
});

test("context segments remain character-isolated and perform no network or persistence", () => {
  const approved = approveContext();
  const otherDraft = contextDraft({ character_id: "character-bea" });
  const otherApproved = approveContext(otherDraft, { character_id: "character-bea" });
  assert.notEqual(previewChatAdminContextSegment(contextDraft()).preview_fingerprint, previewChatAdminContextSegment(otherDraft).preview_fingerprint);
  assert.equal(compileChatAdminContextSegments({ ...scope, segments: [approved] }).length, 1);
  assert.equal(compileChatAdminContextSegments({ ...scope, character_id: "character-bea", segments: [otherApproved] }).length, 1);
  expectCode("context_segment_scope_mismatch", () => compileChatAdminContextSegments({
    ...scope,
    character_id: "character-bea",
    segments: [approved],
  }));

  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("network access is forbidden");
  };
  try {
    assert.equal(compileChatAdminContextSegments({ ...scope, segments: [approved] }).length, 1);
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});


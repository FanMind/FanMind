import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_COMPANY_PROMPT_MAX_CHARS,
  AI_PROMPT_PROFILE_MAX_CHARS,
  AI_PROMPT_PROFILE_MAX_COUNT,
  AiPromptPolicyError,
  normalizeAiPromptSettings,
  selectAiPromptContext,
} from "../src/lib/aiPromptPolicy.mjs";

const ids = [
  "11111111-1111-4111-8111-111111111111",
  "22222222-2222-4222-8222-222222222222",
];

function profile(overrides = {}) {
  return {
    id: ids[0],
    name: "Verkauf & Beratung",
    instruction:
      "Bedarf verstehen, Nutzen konkret erklären und einen druckfreien nächsten Schritt anbieten.",
    isActive: true,
    isDefault: true,
    ...overrides,
  };
}

test("settings keep one bounded company prompt and at most eight profiles", () => {
  const settings = normalizeAiPromptSettings({
    companyPrompt: "  Wir beraten Geschäftskunden.\r\nWir duzen nur auf Wunsch. ",
    profiles: [profile()],
  });

  assert.equal(
    settings.companyPrompt,
    "Wir beraten Geschäftskunden.\nWir duzen nur auf Wunsch.",
  );
  assert.equal(settings.profiles.length, 1);
  assert.equal(settings.profiles[0].isDefault, true);

  assert.throws(
    () =>
      normalizeAiPromptSettings({
        companyPrompt: "x".repeat(AI_COMPANY_PROMPT_MAX_CHARS + 1),
      }),
    (error) =>
      error instanceof AiPromptPolicyError &&
      error.code === "company_prompt_invalid",
  );
  assert.throws(
    () =>
      normalizeAiPromptSettings({
        profiles: Array.from(
          { length: AI_PROMPT_PROFILE_MAX_COUNT + 1 },
          (_, index) =>
            profile({
              id: `${String(index + 1).padStart(8, "0")}-1111-4111-8111-111111111111`,
              isDefault: index === 0,
            }),
        ),
      }),
    (error) =>
      error instanceof AiPromptPolicyError &&
      error.code === "too_many_profiles",
  );
});

test("profile names, instructions and identifiers fail closed", () => {
  assert.throws(
    () => normalizeAiPromptSettings(null),
    /settings_invalid/u,
  );
  assert.throws(
    () => normalizeAiPromptSettings({ companyPrompt: 123, profiles: [] }),
    /company_prompt_invalid/u,
  );
  assert.throws(
    () =>
      normalizeAiPromptSettings({
        companyPrompt: "",
        profiles: "invalid",
      }),
    /profiles_invalid/u,
  );
  assert.deepEqual(
    normalizeAiPromptSettings({ companyPrompt: "", profiles: [] }),
    { companyPrompt: "", profiles: [] },
  );
  assert.throws(
    () => normalizeAiPromptSettings({ profiles: [profile({ name: "" })] }),
    /profile_name_invalid/u,
  );
  assert.throws(
    () =>
      normalizeAiPromptSettings({
        profiles: [
          profile({
            instruction: "x".repeat(AI_PROMPT_PROFILE_MAX_CHARS + 1),
          }),
        ],
      }),
    /profile_instruction_invalid/u,
  );
  assert.throws(
    () =>
      normalizeAiPromptSettings({
        profiles: [profile({ id: "client-controlled-free-text" })],
      }),
    /profile_id_invalid/u,
  );
});

test("new profile ids are server-assigned and duplicate/default states are rejected", () => {
  const assigned = normalizeAiPromptSettings(
    {
      profiles: [
        profile({ id: undefined, isDefault: false }),
        profile({
          id: undefined,
          name: "Support",
          instruction: "Klar und lösungsorientiert antworten.",
          isDefault: false,
        }),
      ],
    },
    { assignIds: true },
  );
  assert.match(assigned.profiles[0].id, /^[0-9a-f-]{36}$/u);
  assert.notEqual(assigned.profiles[0].id, assigned.profiles[1].id);
  assert.equal(
    assigned.profiles.filter((entry) => entry.isDefault).length,
    1,
  );

  assert.throws(
    () =>
      normalizeAiPromptSettings({
        profiles: [
          profile(),
          profile({ name: "Support", instruction: "Support." }),
        ],
      }),
    /profile_ids_not_unique/u,
  );
  assert.throws(
    () =>
      normalizeAiPromptSettings({
        profiles: [
          profile(),
          profile({
            id: ids[1],
            name: "Support",
            instruction: "Support.",
            isDefault: true,
          }),
        ],
      }),
    /multiple_default_profiles/u,
  );
});

test("only an active profile from the saved workspace settings can be selected", () => {
  const settings = normalizeAiPromptSettings({
    companyPrompt: "Unternehmensvorgaben",
    profiles: [
      profile(),
      profile({
        id: ids[1],
        name: "Reklamation",
        instruction: "Ruhig deeskalieren.",
        isActive: false,
        isDefault: false,
      }),
    ],
  });

  assert.equal(
    selectAiPromptContext(settings, ids[1]).profileId,
    ids[0],
  );
  assert.equal(
    selectAiPromptContext(settings, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")
      .profileId,
    ids[0],
  );
  assert.equal(
    selectAiPromptContext(settings, ids[0]).profilePrompt,
    settings.profiles[0].instruction,
  );
});

import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateCreatorRuntimeEnvironment,
  renderCreatorRuntime,
} from "../scripts/operations/creator-runtime-staging.mjs";

const env = {
  GITHUB_REF: "refs/heads/main",
  GITHUB_SHA: "a".repeat(40),
  FANMIND_CREATOR_RUNTIME_REVIEWED_COMMIT: "a".repeat(40),
  FANMIND_CREATOR_RUNTIME_CONFIRM: "enable-creator-intelligence-staging",
  FANMIND_RUNTIME_ENVIRONMENT: "staging",
  NEXT_PUBLIC_APP_URL: "https://staging.fanmind.ch",
  FANMIND_TARGET_SUPABASE_PROJECT_REF: "vshyhvgcmrlagvfnvomc",
  FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "drqkpdvtbbrrdwmtrodz",
};

test("Creator runtime activation is Staging-only and exact-head bound", () => {
  assert.equal(evaluateCreatorRuntimeEnvironment(env).ok, true);
  assert.equal(evaluateCreatorRuntimeEnvironment({...env, GITHUB_REF: "refs/heads/feature"}).ok, false);
  assert.equal(evaluateCreatorRuntimeEnvironment({...env, FANMIND_CREATOR_RUNTIME_REVIEWED_COMMIT: "b".repeat(40)}).ok, false);
  assert.equal(evaluateCreatorRuntimeEnvironment({...env, FANMIND_RUNTIME_ENVIRONMENT: "production"}).ok, false);
  assert.equal(evaluateCreatorRuntimeEnvironment({...env, FANMIND_TARGET_SUPABASE_PROJECT_REF: "drqkpdvtbbrrdwmtrodz"}).ok, false);
  assert.equal(evaluateCreatorRuntimeEnvironment({...env, FANMIND_CREATOR_RUNTIME_CONFIRM: "enable-production"}).ok, false);
});

test("Creator runtime rendering replaces prior values without exposing other env contents", () => {
  const original = [
    "NEXT_PUBLIC_APP_URL='https://staging.fanmind.ch'",
    "FANMIND_CREATOR_INTELLIGENCE_ENABLED='false'",
    "OTHER_SECRET='preserve-me'",
    "",
  ].join("\n");
  const enabled = renderCreatorRuntime(original, true);
  assert.match(enabled, /FANMIND_CREATOR_INTELLIGENCE_ENABLED='true'/u);
  assert.doesNotMatch(enabled, /FANMIND_CREATOR_INTELLIGENCE_ENABLED='false'/u);
  assert.equal((enabled.match(/FANMIND_CREATOR_INTELLIGENCE_ENABLED=/gu) ?? []).length, 1);
  assert.match(enabled, /OTHER_SECRET='preserve-me'/u);

  const disabled = renderCreatorRuntime(enabled, false);
  assert.match(disabled, /FANMIND_CREATOR_INTELLIGENCE_ENABLED='false'/u);
  assert.equal((disabled.match(/FANMIND_CREATOR_INTELLIGENCE_ENABLED=/gu) ?? []).length, 1);
});

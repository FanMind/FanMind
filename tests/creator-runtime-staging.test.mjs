import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  evaluateCreatorRuntimeEnvironment,
  renderCreatorRuntime,
} from "../scripts/operations/creator-runtime-staging.mjs";
import * as creatorRuntime from "../scripts/operations/creator-runtime-staging.mjs";

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

test("Creator runtime refuses stale already-enabled disk state before restart", () => {
  assert.equal(typeof creatorRuntime.requireCreatorRuntimeDisabled, "function");
  assert.throws(
    () => creatorRuntime.requireCreatorRuntimeDisabled("FANMIND_CREATOR_INTELLIGENCE_ENABLED='true'\n"),
    /CREATOR_RUNTIME_STAGING_ERROR=flag_already_enabled_reconciliation_required/u,
  );
  assert.doesNotThrow(
    () => creatorRuntime.requireCreatorRuntimeDisabled("FANMIND_CREATOR_INTELLIGENCE_ENABLED='false'\n"),
  );
  assert.equal(typeof creatorRuntime.requireCreatorRuntimeOverrideAbsent, "function");
  for (const value of ["true", "false", "unexpected"]) {
    assert.throws(
      () => creatorRuntime.requireCreatorRuntimeOverrideAbsent(
        `FANMIND_CREATOR_INTELLIGENCE_ENABLED='${value}'\n`,
        "runtime_secret",
      ),
      /CREATOR_RUNTIME_STAGING_ERROR=runtime_secret_override/u,
    );
  }
  assert.doesNotThrow(
    () => creatorRuntime.requireCreatorRuntimeOverrideAbsent("OTHER_RUNTIME_SECRET='preserved'\n", "runtime_secret"),
  );
});

test("Creator protected workflow binds deploy, owner workspace, service unit and rollback", async () => {
  const workflow = await readFile(".github/workflows/creator-target-transition-runtime.yml", "utf8");
  const deploy = await readFile(".github/workflows/deploy-staging.yml", "utf8");
  const recovery = await readFile(".github/workflows/creator-target-admission-recovery.yml", "utf8");

  assert.match(workflow, /uses: \.\/\.github\/workflows\/deploy-staging\.yml/u);
  assert.doesNotMatch(workflow, /deploy-staging\.yml\/dispatches/u);
  assert.match(deploy, /workflow_call:/u);
  assert.match(deploy, /reviewed_commit:[\s\S]*required: false/u);
  assert.match(deploy, /github\.workflow == 'FanMind Creator Target Transition and Runtime'[\s\S]*github\.event_name == 'issue_comment'[\s\S]*fanmind-staging-deploy-chained-/u);
  assert.doesNotMatch(deploy, /github\.event_name == 'workflow_call'/u);
  assert.doesNotMatch(deploy, /inputs\.reviewed_commit != '' && format\('fanmind-staging-deploy-chained-/u);
  assert.match(deploy, /REVIEWED_RELEASE_COMMIT: \$\{\{ inputs\.reviewed_commit \}\}/u);
  assert.match(deploy, /REVIEWED_RELEASE_COMMIT[\s\S]*EXPECTED_RELEASE_COMMIT[\s\S]*Reviewed Staging release commit does not match/iu);
  assert.ok(deploy.indexOf("Reviewed Staging release commit does not match") < deploy.indexOf("rsync --archive --delete"));

  assert.match(workflow, /FANMIND_STAGING_E2E_WORKSPACE_ID: \$\{\{ vars\.FANMIND_STAGING_E2E_WORKSPACE_ID \}\}/u);
  assert.match(workflow, /creator\.canManage !== true/u);
  assert.match(workflow, /rest\/v1\/workspaces\?select=id%2Cowner_user_id/u);
  assert.match(workflow, /expectedWorkspace\.owner_user_id !== syntheticUserId/u);
  assert.match(workflow, /sudo cmp --silent \/etc\/systemd\/system\/fanmind-staging\.service "\$GITHUB_WORKSPACE\/ops\/systemd\/fanmind-staging\.service"/u);

  assert.doesNotMatch(workflow, /creator-runtime-staging\.mjs restore "\$BACKUP" \|\| true/u);
  assert.doesNotMatch(workflow, /systemctl restart fanmind-staging\.service \|\| true/u);
  assert.match(workflow, /CREATOR_RUNTIME_ROLLBACK_RESTORE=FAILED/u);
  assert.match(workflow, /CREATOR_RUNTIME_ROLLBACK_RESTART=FAILED/u);
  assert.ok(workflow.indexOf("CREATOR_RUNTIME_ROLLBACK_RESTART=FAILED") < workflow.indexOf('rm -f "$BACKUP"'));
  assert.match(workflow, /group: fanmind-staging-deploy\s+cancel-in-progress: false/u);
  assert.match(workflow, /issues: write/u);
  assert.match(workflow, /fanmind-creator-target-transition-runtime-consumed/u);
  assert.match(workflow, /github-actions\[bot\]/u);
  assert.ok(workflow.indexOf("fanmind-creator-target-transition-runtime-consumed") < workflow.indexOf("uses: ./.github/workflows/deploy-staging.yml"));
  assert.doesNotMatch(workflow, /FANMIND_CREATOR_TRANSITION_ADMISSION_MARKER/u);
  assert.match(workflow, /CREATOR_TARGET_TRANSITION_ADMISSION=CLOSED/u);
  assert.match(workflow, /creator-foundation-transition-staging-runner\.mjs --restore-admission/u);
  assert.ok(workflow.indexOf("runtime_creator_readback_failed") < workflow.indexOf("--restore-admission"));
  assert.doesNotMatch(recovery, /workflow_run:/u);
  assert.match(recovery, /workflow_dispatch:/u);
  assert.match(recovery, /group: fanmind-staging-deploy\s+cancel-in-progress: false/u);
  assert.match(recovery, /runs-on: \[self-hosted, fanmind-staging, exoscale, linux, x64\]/u);
  assert.match(recovery, /restore-creator-target-admission/u);
  assert.match(recovery, /creator-foundation-transition-staging-runner\.mjs --restore-admission/u);
  assert.match(recovery, /FANMIND_CREATOR_TRANSITION_REVIEWED_COMMIT: \$\{\{ inputs\.reviewed_commit \}\}/u);
  assert.match(recovery, /ref: \$\{\{ inputs\.reviewed_commit \}\}/u);
  assert.match(recovery, /test "\$\(git rev-parse HEAD\)" = "\$FANMIND_CREATOR_TRANSITION_REVIEWED_COMMIT"/u);
  assert.match(workflow, /FANMIND_CREATOR_TRANSITION_REFERENCE_DIR="\$RUNNER_TEMP\/creator-runtime-reference"/u);
  assert.match(recovery, /FANMIND_CREATOR_TRANSITION_REFERENCE_DIR="\$RUNNER_TEMP\/creator-admission-recovery-reference"/u);
  assert.match(workflow, /actions\/artifacts\/\$\{id\}/u);
  assert.match(recovery, /actions\/artifacts\/\$\{id\}/u);
  assert.match(workflow, /trap 'rollback_flag \$\?' EXIT ERR/u);
  assert.match(workflow, /trap 'rollback_flag 130' INT/u);
  assert.match(workflow, /trap 'rollback_flag 143' TERM/u);
  assert.match(workflow, /trap - EXIT ERR INT TERM/u);
  assert.match(workflow, /PERSISTENT_BACKUP=\/var\/lib\/fanmind-staging\/creator-runtime-recovery\.env/u);
  assert.match(workflow, /sudo install -o root -g root -m 600 "\$ENV_FILE" "\$PERSISTENT_BACKUP"/u);
  assert.match(workflow, /recover:\n\s+name: Recover Creator runtime flag and RPC admission after failed protected run/u);
  assert.match(workflow, /needs: \[authorize, transition, runtime\]/u);
  assert.match(workflow, /needs\.runtime\.result == 'failure'/u);
  assert.match(workflow, /Restore persistent runtime flag before reopening Creator RPC admission/u);
  const internalRecoveryIndex = workflow.indexOf("Restore persistent runtime flag before reopening Creator RPC admission");
  const internalAdmissionIndex = workflow.indexOf("Restore canonical Creator RPC admission only after runtime recovery");
  assert.ok(internalRecoveryIndex >= 0 && internalRecoveryIndex < internalAdmissionIndex);
  assert.match(recovery, /PERSISTENT_BACKUP=\/var\/lib\/fanmind-staging\/creator-runtime-recovery\.env/u);
  const manualRuntimeIndex = recovery.indexOf("Restore persistent Creator runtime flag before RPC admission");
  const manualAdmissionIndex = recovery.indexOf("Restore exact canonical RPC grants");
  assert.ok(manualRuntimeIndex >= 0 && manualRuntimeIndex < manualAdmissionIndex);
});

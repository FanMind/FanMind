import assert from "node:assert/strict";
import test from "node:test";

import {
  validateVersionPayload,
  verifyConfirmedChatStaging,
} from "../scripts/operations/creator-confirmed-chat-learning-staging-verify.mjs";

const COMMIT = "a".repeat(40);

function environment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "",
    FANMIND_NON_PRODUCTION_WRITE_ACKNOWLEDGEMENT: "",
    FANMIND_CREATOR_CONFIRMED_CHAT_REVIEWED_COMMIT: COMMIT,
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    ...overrides,
  };
}

function response(payload, ok = true) {
  return {
    ok,
    async text() {
      return JSON.stringify(payload);
    },
  };
}

function successfulRunner() {
  return {
    status: 0,
    stdout: [
      "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=absent",
      "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
      "CREATOR_CONFIRMED_CHAT_NEXT=apply",
      "CREATOR_CONFIRMED_CHAT_APPLY=not_requested",
    ].join("\n"),
    stderr: "",
  };
}

test("version payload binds exact release and staging runtime", () => {
  assert.doesNotThrow(() =>
    validateVersionPayload({ releaseCommit: COMMIT, runtimeEnvironment: "staging" }, COMMIT),
  );
  assert.throws(
    () => validateVersionPayload({ releaseCommit: "b".repeat(40), runtimeEnvironment: "staging" }, COMMIT),
    /deployed_release_mismatch/u,
  );
  assert.throws(
    () => validateVersionPayload({ releaseCommit: COMMIT, runtimeEnvironment: "production" }, COMMIT),
    /deployed_runtime_mismatch/u,
  );
});

test("read-only controller rejects production URL and any write acknowledgement before fetch", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return response({ releaseCommit: COMMIT, runtimeEnvironment: "staging" });
  };

  await assert.rejects(
    verifyConfirmedChatStaging({
      environment: environment({ NEXT_PUBLIC_APP_URL: "https://fanmind.ch" }),
      fetchImpl,
      runRunner: successfulRunner,
    }),
    /production_app_url_forbidden/u,
  );
  await assert.rejects(
    verifyConfirmedChatStaging({
      environment: environment({ FANMIND_NON_PRODUCTION_WRITE_ACK: "present" }),
      fetchImpl,
      runRunner: successfulRunner,
    }),
    /write_acknowledgement_present/u,
  );
  assert.equal(calls, 0);
});

test("read-only controller accepts only exact deployed Staging plus absent schema verify", async () => {
  const markers = await verifyConfirmedChatStaging({
    environment: environment(),
    fetchImpl: async (url, options) => {
      assert.equal(url.href, "https://staging.fanmind.example/api/version");
      assert.equal(options.method, "GET");
      return response({ releaseCommit: COMMIT, runtimeEnvironment: "staging" });
    },
    runRunner: successfulRunner,
  });
  assert.deepEqual(markers, [
    `CREATOR_CONFIRMED_CHAT_STAGING_RELEASE=${COMMIT}`,
    "CREATOR_CONFIRMED_CHAT_STAGING_RELEASE_BINDING=PASS",
    "CREATOR_CONFIRMED_CHAT_STAGING_SCHEMA_STATE=ABSENT",
    "CREATOR_CONFIRMED_CHAT_STAGING_VERIFY=PASS",
    "CREATOR_CONFIRMED_CHAT_STAGING_WRITE_PERFORMED=false",
  ]);
});

test("read-only controller fails closed on runner failure or an installed target", async () => {
  const fetchImpl = async () => response({ releaseCommit: COMMIT, runtimeEnvironment: "staging" });
  await assert.rejects(
    verifyConfirmedChatStaging({
      environment: environment(),
      fetchImpl,
      runRunner: () => ({ status: 1, stdout: "", stderr: "fixed error" }),
    }),
    /runner_verify_failed/u,
  );
  await assert.rejects(
    verifyConfirmedChatStaging({
      environment: environment(),
      fetchImpl,
      runRunner: () => ({
        status: 0,
        stdout: [
          "CREATOR_CONFIRMED_CHAT_SCHEMA_STATE=installed",
          "CREATOR_CONFIRMED_CHAT_SOURCE_STATE=installed",
          "CREATOR_CONFIRMED_CHAT_POSTFLIGHT=PASS",
          "CREATOR_CONFIRMED_CHAT_APPLY=not_requested",
        ].join("\n"),
      }),
    }),
    /unexpected_verify_result/u,
  );
});

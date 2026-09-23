import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CONFIRMED_CHAT_LEARNING_SCHEMA_STATE,
  verifyConfirmedChatLearningAccountDeletion,
  verifyConfirmedChatLearningContactDeletion,
} from "../src/lib/confirmedChatLearningDeletionVerification.mjs";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";
const USER_ID = "33333333-3333-4333-8333-333333333333";
const SECOND_WORKSPACE_ID = "44444444-4444-4444-8444-444444444444";

function response({ ok = true, status = 200, payload = [] } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

function verificationInput(fetchImpl, schemaState = "installed") {
  return {
    fetchImpl,
    tableUrl: "https://example.supabase.co/rest/v1/creator_confirmed_chat_learning",
    headers: { apikey: "test-only" },
    workspaceId: WORKSPACE_ID,
    contactId: CONTACT_ID,
    schemaState,
  };
}

function accountVerificationInput(fetchImpl, schemaState = "installed") {
  return {
    fetchImpl,
    tableUrl: "https://example.supabase.co/rest/v1/creator_confirmed_chat_learning",
    headers: { apikey: "test-only" },
    workspaceIds: [WORKSPACE_ID, SECOND_WORKSPACE_ID],
    userId: USER_ID,
    schemaState,
  };
}

test("confirmed-chat contact verifier uses an exact read-only workspace/contact query", async () => {
  let observedUrl = null;
  let observedInit = null;
  const result = await verifyConfirmedChatLearningContactDeletion(
    verificationInput(async (url, init) => {
      observedUrl = new URL(url);
      observedInit = init;
      return response();
    }),
  );

  assert.deepEqual(result, { ok: true, evidence: "verified" });
  assert.equal(observedUrl.pathname, "/rest/v1/creator_confirmed_chat_learning");
  assert.equal(observedUrl.searchParams.get("workspace_id"), `eq.${WORKSPACE_ID}`);
  assert.equal(observedUrl.searchParams.get("contact_id"), `eq.${CONTACT_ID}`);
  assert.equal(observedUrl.searchParams.get("select"), "proposal_id");
  assert.equal(observedUrl.searchParams.get("limit"), "1");
  assert.equal(observedInit.method, undefined);
  assert.equal(observedInit.body, undefined);
  assert.equal(observedInit.cache, "no-store");
});

test("confirmed-chat contact verifier fails closed on residual, malformed, network and authorization results", async () => {
  const cases = [
    async () => response({ payload: [{ proposal_id: "still-present" }] }),
    async () => response({ payload: { proposal_id: null } }),
    async () => response({ ok: false, status: 401, payload: { message: "denied" } }),
    async () => {
      throw new Error("network down");
    },
  ];

  for (const fetchImpl of cases) {
    const result = await verifyConfirmedChatLearningContactDeletion(
      verificationInput(fetchImpl),
    );
    assert.deepEqual(result, { ok: false, evidence: "failed" });
  }
});

test("missing confirmed-chat schema is compatible only while source rollout state is preinstall", async () => {
  const missing = async () =>
    response({
      ok: false,
      status: 404,
      payload: { code: "PGRST205", message: "Could not find the table in the schema cache" },
    });

  assert.deepEqual(
    await verifyConfirmedChatLearningContactDeletion(
      verificationInput(missing, "preinstall"),
    ),
    { ok: true, evidence: "preinstall_absent" },
  );
  assert.deepEqual(
    await verifyConfirmedChatLearningContactDeletion(
      verificationInput(missing, "installed"),
    ),
    { ok: false, evidence: "failed" },
  );
});

test("unknown rollout state fails closed instead of becoming optional", async () => {
  const result = await verifyConfirmedChatLearningContactDeletion({
    ...verificationInput(async () => response()),
    schemaState: "unknown",
  });
  assert.deepEqual(result, { ok: false, evidence: "failed" });
});

test("account verifier checks every persisted Workspace and global confirmed_by read-only", async () => {
  const calls = [];
  const result = await verifyConfirmedChatLearningAccountDeletion(
    accountVerificationInput(async (url, init) => {
      calls.push({ url: new URL(url), init });
      return response();
    }),
  );

  assert.deepEqual(result, { ok: true, evidence: "verified" });
  assert.equal(calls.length, 3);
  assert.deepEqual(
    calls.slice(0, 2).map(({ url }) => url.searchParams.get("workspace_id")),
    [`eq.${WORKSPACE_ID}`, `eq.${SECOND_WORKSPACE_ID}`],
  );
  assert.equal(calls[2].url.searchParams.get("confirmed_by"), `eq.${USER_ID}`);
  for (const { url, init } of calls) {
    assert.equal(url.pathname, "/rest/v1/creator_confirmed_chat_learning");
    assert.equal(url.searchParams.get("select"), "proposal_id");
    assert.equal(url.searchParams.get("limit"), "1");
    assert.equal(init.method, undefined);
    assert.equal(init.body, undefined);
    assert.equal(init.cache, "no-store");
  }
});

test("account verifier fails when any owned Workspace retains confirmed-chat learning", async () => {
  const result = await verifyConfirmedChatLearningAccountDeletion(
    accountVerificationInput(async (url) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("workspace_id") === `eq.${SECOND_WORKSPACE_ID}`) {
        return response({ payload: [{ proposal_id: "survivor" }] });
      }
      return response();
    }),
  );
  assert.deepEqual(result, { ok: false, evidence: "failed" });
});

test("account verifier fails when deleted user remains as confirmed_by in any surviving Workspace", async () => {
  const result = await verifyConfirmedChatLearningAccountDeletion(
    accountVerificationInput(async (url) => {
      const parsed = new URL(url);
      if (parsed.searchParams.get("confirmed_by") === `eq.${USER_ID}`) {
        return response({ payload: [{ proposal_id: "actor-not-anonymized" }] });
      }
      return response();
    }),
  );
  assert.deepEqual(result, { ok: false, evidence: "failed" });
});

test("account verifier does not inspect unrelated Workspaces and still checks confirmed_by with no owned Workspace", async () => {
  const calls = [];
  const result = await verifyConfirmedChatLearningAccountDeletion({
    ...accountVerificationInput(async (url, init) => {
      calls.push({ url: new URL(url), init });
      return response();
    }),
    workspaceIds: [],
  });

  assert.deepEqual(result, { ok: true, evidence: "verified" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url.searchParams.get("workspace_id"), null);
  assert.equal(calls[0].url.searchParams.get("confirmed_by"), `eq.${USER_ID}`);
});

test("account verifier fails closed on malformed, network and authorization results", async () => {
  const cases = [
    async () => response({ payload: { proposal_id: null } }),
    async () => response({ ok: false, status: 401, payload: { message: "denied" } }),
    async () => {
      throw new Error("network down");
    },
  ];

  for (const fetchImpl of cases) {
    const result = await verifyConfirmedChatLearningAccountDeletion(
      accountVerificationInput(fetchImpl),
    );
    assert.deepEqual(result, { ok: false, evidence: "failed" });
  }
});

test("account verifier treats missing schema as preinstall-only and unknown inventory as failure", async () => {
  const missing = async () =>
    response({
      ok: false,
      status: 404,
      payload: { code: "PGRST205", message: "Could not find the table in the schema cache" },
    });

  assert.deepEqual(
    await verifyConfirmedChatLearningAccountDeletion(
      accountVerificationInput(missing, "preinstall"),
    ),
    { ok: true, evidence: "preinstall_absent" },
  );
  assert.deepEqual(
    await verifyConfirmedChatLearningAccountDeletion(
      accountVerificationInput(missing, "installed"),
    ),
    { ok: false, evidence: "failed" },
  );
  assert.deepEqual(
    await verifyConfirmedChatLearningAccountDeletion({
      ...accountVerificationInput(async () => response()),
      schemaState: "unknown",
    }),
    { ok: false, evidence: "failed" },
  );
  assert.deepEqual(
    await verifyConfirmedChatLearningAccountDeletion({
      ...accountVerificationInput(async () => response()),
      workspaceIds: [WORKSPACE_ID, WORKSPACE_ID],
    }),
    { ok: false, evidence: "failed" },
  );
});

test("account deletion processor wires the verifier to durable Workspace inventory and deleted user", async () => {
  const source = await readFile("scripts/operations/process-account-deletion.mjs", "utf8");
  assert.match(source, /verifyConfirmedChatLearningAccountDeletion/u);
  assert.match(
    source,
    /tableUrl: `\$\{config\.supabaseUrl\}\/rest\/v1\/creator_confirmed_chat_learning`/u,
  );
  assert.match(source, /workspaceIds,/u);
  assert.match(source, /userId,/u);
  assert.match(source, /schemaState: CONFIRMED_CHAT_LEARNING_SCHEMA_STATE/u);
  assert.match(
    source,
    /if \(!learningVerification\.ok\)[\s\S]*deletion_verification_failed/u,
  );
});

test("contact delete wires verification after both RPC and legacy success paths to the disclosure rollout state", async () => {
  const source = await readFile("src/app/fans/[id]/contextActions.ts", "utf8");
  const section = source.slice(source.indexOf("export async function deleteContactAndCreatorData"));

  assert.match(section, /rpc\/delete_contact_with_meta_catchup/u);
  assert.match(section, /legacyDeleteContactIfNoMetaQueueDependency/u);
  assert.match(section, /if \(!deleted\)[\s\S]*verifyConfirmedChatLearningContactDeletion/u);
  assert.match(section, /tableUrl: getSupabaseRestUrl\("creator_confirmed_chat_learning"\)/u);
  assert.match(section, /workspaceId: workspace\.id/u);
  assert.match(section, /contactId/u);
  assert.match(section, /schemaState: CONFIRMED_CHAT_LEARNING_SCHEMA_STATE/u);

  const verificationFailureSection = section.slice(
    section.indexOf("if (!learningVerification.ok)"),
    section.indexOf('revalidatePath("/fans")'),
  );
  assert.match(
    verificationFailureSection,
    /redirect\([\s\S]*\/fans\?notice=contact_delete_verification_failed/u,
  );
  assert.doesNotMatch(verificationFailureSection, /contactPath\(/u);
});

test("confirmed-chat deletion readers stay synchronized on the preinstall rollout boundary", async () => {
  const disclosureSource = await readFile("src/lib/dataDisclosureMetaExport.ts", "utf8");
  assert.equal(CONFIRMED_CHAT_LEARNING_SCHEMA_STATE, "preinstall");
  assert.match(
    disclosureSource,
    /CONFIRMED_CHAT_LEARNING_SCHEMA_STATE:[\s\S]*=\s*\n?\s*"preinstall";/u,
  );
});

test("Fans list renders a dedicated error after contact deletion succeeds but learning verification fails", async () => {
  const source = await readFile("src/app/fans/page.tsx", "utf8");
  assert.match(source, /contact_delete_verification_failed:/u);
  assert.match(
    source,
    /Der Kontakt wurde gelöscht, aber die vollständige Löschung der bestätigten Chat-Lerndaten konnte danach nicht verifiziert werden\./u,
  );
  assert.match(source, /function isErrorNotice[\s\S]*notice\.endsWith\("_failed"\)/u);
});
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { verifyConfirmedChatLearningContactDeletion } from "../src/lib/confirmedChatLearningDeletionVerification.mjs";

const WORKSPACE_ID = "11111111-1111-4111-8111-111111111111";
const CONTACT_ID = "22222222-2222-4222-8222-222222222222";

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

test("Fans list renders a dedicated error after contact deletion succeeds but learning verification fails", async () => {
  const source = await readFile("src/app/fans/page.tsx", "utf8");
  assert.match(source, /contact_delete_verification_failed:/u);
  assert.match(
    source,
    /Der Kontakt wurde gelöscht, aber die vollständige Löschung der bestätigten Chat-Lerndaten konnte danach nicht verifiziert werden\./u,
  );
  assert.match(source, /function isErrorNotice[\s\S]*notice\.endsWith\("_failed"\)/u);
});

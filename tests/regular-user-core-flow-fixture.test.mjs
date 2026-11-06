import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { after, before, test } from "node:test";

import {
  FIXTURE_ACCESS_TOKEN,
  FIXTURE_ACKNOWLEDGEMENT,
  FIXTURE_APP_ORIGIN,
  FIXTURE_EMAIL,
  FIXTURE_HOST,
  FIXTURE_IDS,
  FIXTURE_PASSWORD,
  FIXTURE_SERVICE_ROLE_KEY,
  startRegularUserCoreFlowFixture,
} from "../scripts/testing/regular-user-core-flow-fixture.mjs";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixtureScript = resolve(
  repositoryRoot,
  "scripts/testing/regular-user-core-flow-fixture.mjs",
);

let fixtureProcess;
let fixtureBaseUrl;
let fixtureReady;

function environmentWith(overrides = {}) {
  const environment = { ...process.env, ...overrides };
  for (const [key, value] of Object.entries(environment)) {
    if (value === undefined) delete environment[key];
  }
  return environment;
}

async function waitForFixtureReady(child) {
  return new Promise((resolveReady, rejectReady) => {
    let bufferedStdout = "";
    let bufferedStderr = "";
    const timeout = setTimeout(() => {
      rejectReady(
        new Error(`fixture_ready_timeout:${bufferedStderr || bufferedStdout}`),
      );
    }, 5000);

    const finish = (callback, value) => {
      clearTimeout(timeout);
      child.stdout.off("data", onStdout);
      child.stderr.off("data", onStderr);
      child.off("exit", onExit);
      callback(value);
    };
    const onStderr = (chunk) => {
      bufferedStderr += String(chunk);
    };
    const onExit = (code) => {
      finish(
        rejectReady,
        new Error(
          `fixture_exited_before_ready:${String(code)}:${bufferedStderr}`,
        ),
      );
    };
    const onStdout = (chunk) => {
      bufferedStdout += String(chunk);
      const lines = bufferedStdout.split("\n");
      bufferedStdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let payload;
        try {
          payload = JSON.parse(line);
        } catch {
          continue;
        }
        if (payload.code === "regular_user_core_flow_fixture_ready") {
          finish(resolveReady, payload);
          return;
        }
      }
    };

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", onStdout);
    child.stderr.on("data", onStderr);
    child.once("exit", onExit);
  });
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) return;
  await new Promise((resolveExit, rejectExit) => {
    const timeout = setTimeout(
      () => rejectExit(new Error("fixture_shutdown_timeout")),
      5000,
    );
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
    child.kill("SIGTERM");
  });
}

async function fixtureFetch(path, options = {}) {
  const headers = new Headers(options.headers);
  if (!headers.has("Origin")) headers.set("Origin", FIXTURE_APP_ORIGIN);
  return fetch(`${fixtureBaseUrl}${path}`, { ...options, headers });
}

function accessHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${FIXTURE_ACCESS_TOKEN}`,
    apikey: "synthetic-local-anon-key",
    ...extra,
  };
}

function serviceHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${FIXTURE_SERVICE_ROLE_KEY}`,
    apikey: "synthetic-local-anon-key",
    ...extra,
  };
}

function controlHeaders(extra = {}) {
  return serviceHeaders(extra);
}

before(async () => {
  fixtureProcess = spawn(process.execPath, [fixtureScript], {
    cwd: repositoryRoot,
    env: environmentWith({
      FANMIND_CORE_FLOW_FIXTURE_ACK: FIXTURE_ACKNOWLEDGEMENT,
      FANMIND_CORE_FLOW_FIXTURE_PORT: "0",
    }),
    stdio: ["ignore", "pipe", "pipe"],
  });
  fixtureReady = await waitForFixtureReady(fixtureProcess);
  fixtureBaseUrl = `http://${FIXTURE_HOST}:${fixtureReady.port}`;
});

after(async () => {
  await stopChild(fixtureProcess);
});

test("startup requires the exact synthetic fixture acknowledgement", async () => {
  for (const acknowledgement of [undefined, "wrong-acknowledgement"]) {
    const result = spawnSync(process.execPath, [fixtureScript], {
      cwd: repositoryRoot,
      env: environmentWith({
        FANMIND_CORE_FLOW_FIXTURE_ACK: acknowledgement,
        FANMIND_CORE_FLOW_FIXTURE_PORT: "0",
      }),
      encoding: "utf8",
      timeout: 5000,
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /"code":"fixture_ack_invalid"/u);
  }

  await assert.rejects(
    startRegularUserCoreFlowFixture({
      acknowledgement: "wrong-acknowledgement",
      port: 0,
    }),
    /fixture_ack_invalid/u,
  );
});

test("server binds to IPv4 loopback only and exposes bounded CORS health", async () => {
  const directFixture = await startRegularUserCoreFlowFixture({
    acknowledgement: FIXTURE_ACKNOWLEDGEMENT,
    port: 0,
  });
  try {
    assert.equal(directFixture.address.address, FIXTURE_HOST);
    assert.equal(directFixture.address.family, "IPv4");
  } finally {
    directFixture.server.close();
    await once(directFixture.server, "close");
  }

  assert.equal(fixtureReady.host, FIXTURE_HOST);
  const healthResponse = await fixtureFetch("/__health");
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), {
    ok: true,
    fixture: "fanmind_regular_user_core_flow",
    binding: FIXTURE_HOST,
  });

  const preflight = await fixtureFetch("/any-preflight-path", {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3100" },
  });
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    "http://localhost:3100",
  );

  const forbiddenOrigin = await fixtureFetch("/__health", {
    headers: { Origin: "https://fanmind.ch" },
  });
  assert.equal(forbiddenOrigin.status, 200);
  assert.equal(
    forbiddenOrigin.headers.get("access-control-allow-origin"),
    null,
  );
});

test("password auth accepts only Gerhard fixture credentials and validates the bearer", async () => {
  const invalidCredentials = await fixtureFetch(
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: FIXTURE_EMAIL, password: "wrong" }),
    },
  );
  assert.equal(invalidCredentials.status, 401);
  assert.equal(
    (await invalidCredentials.json()).code,
    "fixture_credentials_invalid",
  );

  const invalidGrant = await fixtureFetch(
    "/auth/v1/token?grant_type=refresh_token",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD }),
    },
  );
  assert.equal(invalidGrant.status, 400);

  const login = await fixtureFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: FIXTURE_EMAIL, password: FIXTURE_PASSWORD }),
  });
  assert.equal(login.status, 200);
  assert.equal(
    login.headers.get("access-control-allow-origin"),
    "http://localhost:3100",
  );
  const loginPayload = await login.json();
  assert.equal(loginPayload.access_token, FIXTURE_ACCESS_TOKEN);
  assert.equal(loginPayload.user.id, FIXTURE_IDS.user);
  assert.equal(loginPayload.user.email, FIXTURE_EMAIL);
  assert.equal(
    loginPayload.user.user_metadata.display_name,
    "Gerhard Testnutzer",
  );

  const userWithoutBearer = await fixtureFetch("/auth/v1/user");
  assert.equal(userWithoutBearer.status, 401);

  const malformedBearer = await fixtureFetch("/auth/v1/user", {
    headers: { Authorization: `Bearer\t\t${FIXTURE_ACCESS_TOKEN}` },
  });
  assert.equal(malformedBearer.status, 401);

  const userResponse = await fixtureFetch("/auth/v1/user", {
    headers: accessHeaders(),
  });
  assert.equal(userResponse.status, 200);
  assert.equal((await userResponse.json()).id, FIXTURE_IDS.user);

  const logout = await fixtureFetch("/auth/v1/logout", {
    method: "POST",
    headers: accessHeaders(),
  });
  assert.equal(logout.status, 204);
});

test("PostgREST reads deterministic seed rows and fails closed", async () => {
  const resetWithoutControl = await fixtureFetch("/__reset", {
    method: "POST",
  });
  assert.equal(resetWithoutControl.status, 401);

  const reset = await fixtureFetch("/__reset", {
    method: "POST",
    headers: controlHeaders(),
  });
  assert.equal(reset.status, 200);

  const unauthorized = await fixtureFetch("/rest/v1/workspaces");
  assert.equal(unauthorized.status, 401);

  const workspaceResponse = await fixtureFetch(
    `/rest/v1/workspaces?select=id,name,owner_user_id,billing_status&owner_user_id=eq.${FIXTURE_IDS.user}&limit=1`,
    { headers: accessHeaders() },
  );
  assert.equal(workspaceResponse.status, 200);
  assert.deepEqual(await workspaceResponse.json(), [
    {
      id: FIXTURE_IDS.workspace,
      name: "Gerhard Core Flow Studio",
      owner_user_id: FIXTURE_IDS.user,
      billing_status: "active",
    },
  ]);

  const serverSideRead = await fetch(
    `${fixtureBaseUrl}/rest/v1/contacts?select=id&limit=1`,
    { headers: accessHeaders() },
  );
  assert.equal(serverSideRead.status, 200);

  const messageResponse = await fixtureFetch(
    `/rest/v1/conversation_messages?select=id,workspace_id,contact_id,direction,content,seen_at&workspace_id=eq.${FIXTURE_IDS.workspace}&contact_id=eq.${FIXTURE_IDS.contact}&order=created_at.asc`,
    { headers: accessHeaders() },
  );
  assert.equal(messageResponse.status, 200);
  const messages = await messageResponse.json();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].direction, "inbound");
  assert.equal(messages[0].seen_at, null);

  const countResponse = await fixtureFetch(
    `/rest/v1/contacts?select=id&workspace_id=eq.${FIXTURE_IDS.workspace}`,
    {
      method: "HEAD",
      headers: accessHeaders({ Prefer: "count=exact" }),
    },
  );
  assert.equal(countResponse.status, 200);
  assert.equal(countResponse.headers.get("content-range"), "0-0/1");

  const promptSettingsResponse = await fixtureFetch(
    `/rest/v1/workspace_ai_prompt_settings?select=workspace_id,company_prompt,profiles,updated_at&workspace_id=eq.${FIXTURE_IDS.workspace}&limit=1`,
    { headers: serviceHeaders() },
  );
  assert.equal(promptSettingsResponse.status, 200);
  assert.deepEqual(await promptSettingsResponse.json(), []);

  const invalidSelect = await fixtureFetch(
    "/rest/v1/contacts?select=id,secret_column",
    { headers: accessHeaders() },
  );
  assert.equal(invalidSelect.status, 400);
  assert.equal((await invalidSelect.json()).code, "query_select_invalid");

  const unknownTable = await fixtureFetch("/rest/v1/unknown_table", {
    headers: accessHeaders(),
  });
  assert.equal(unknownTable.status, 404);
  assert.equal((await unknownTable.json()).code, "fixture_table_unknown");
});

test("state records only allowed Memory, Follow-up, seen_at and status mutations, then reset restores the seed", async () => {
  const reset = await fixtureFetch("/__reset", {
    method: "POST",
    headers: controlHeaders(),
  });
  assert.equal(reset.status, 200);

  const seenResponse = await fixtureFetch(
    `/rest/v1/conversation_messages?workspace_id=eq.${FIXTURE_IDS.workspace}&contact_id=eq.${FIXTURE_IDS.contact}&direction=eq.inbound&seen_at=is.null&select=id`,
    {
      method: "PATCH",
      headers: accessHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ seen_at: "2026-08-16T12:30:00.000Z" }),
    },
  );
  assert.equal(seenResponse.status, 200);
  assert.deepEqual(await seenResponse.json(), [{ id: FIXTURE_IDS.message }]);

  const memoryResponse = await fixtureFetch(
    "/rest/v1/memories?select=id,workspace_id,contact_id,type,content,importance,created_at",
    {
      method: "POST",
      headers: accessHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        workspace_id: FIXTURE_IDS.workspace,
        contact_id: FIXTURE_IDS.contact,
        type: "note",
        content: "Sandra möchte neue Termine jeweils am Montag erhalten.",
        importance: "normal",
      }),
    },
  );
  assert.equal(memoryResponse.status, 201);
  assert.equal((await memoryResponse.json())[0].id, FIXTURE_IDS.memory);

  const followupResponse = await fixtureFetch(
    "/rest/v1/followups?select=id,workspace_id,contact_id,due_date,priority,reason,status,created_at",
    {
      method: "POST",
      headers: accessHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({
        workspace_id: FIXTURE_IDS.workspace,
        contact_id: FIXTURE_IDS.contact,
        due_date: null,
        priority: "normal",
        reason: "Sandra am Montag die neuen Termine schicken.",
        status: "open",
      }),
    },
  );
  assert.equal(followupResponse.status, 201);
  assert.equal((await followupResponse.json())[0].id, FIXTURE_IDS.followup);

  const userStatusPatch = await fixtureFetch(
    `/rest/v1/followups?id=eq.${FIXTURE_IDS.followup}&workspace_id=eq.${FIXTURE_IDS.workspace}&contact_id=eq.${FIXTURE_IDS.contact}&select=id`,
    {
      method: "PATCH",
      headers: accessHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ status: "completed" }),
    },
  );
  assert.equal(userStatusPatch.status, 403);

  const completeResponse = await fixtureFetch(
    `/rest/v1/followups?id=eq.${FIXTURE_IDS.followup}&workspace_id=eq.${FIXTURE_IDS.workspace}&contact_id=eq.${FIXTURE_IDS.contact}&select=id`,
    {
      method: "PATCH",
      headers: serviceHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ status: "completed" }),
    },
  );
  assert.equal(completeResponse.status, 200);
  assert.deepEqual(await completeResponse.json(), [{ id: FIXTURE_IDS.followup }]);

  const reopenResponse = await fixtureFetch(
    `/rest/v1/followups?id=eq.${FIXTURE_IDS.followup}&workspace_id=eq.${FIXTURE_IDS.workspace}&contact_id=eq.${FIXTURE_IDS.contact}&select=id`,
    {
      method: "PATCH",
      headers: serviceHeaders({
        "Content-Type": "application/json",
        Prefer: "return=representation",
      }),
      body: JSON.stringify({ status: "open" }),
    },
  );
  assert.equal(reopenResponse.status, 200);
  assert.deepEqual(await reopenResponse.json(), [{ id: FIXTURE_IDS.followup }]);

  const stateResponse = await fixtureFetch("/__state", {
    headers: controlHeaders(),
  });
  assert.equal(stateResponse.status, 200);
  const state = await stateResponse.json();
  assert.deepEqual(state.counts, {
    workspaces: 1,
    contacts: 1,
    conversations: 1,
    conversation_messages: 1,
    memories: 1,
    followups: 1,
    open_followups: 1,
    completed_followups: 0,
    seen_inbound_messages: 1,
  });
  assert.deepEqual(state.mutation_codes, [
    "conversation_messages:PATCH:seen_at",
    "memories:POST",
    "followups:POST",
    "followups:PATCH:completed",
    "followups:PATCH:open",
  ]);

  const duplicateMemory = await fixtureFetch("/rest/v1/memories", {
    method: "POST",
    headers: accessHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      workspace_id: FIXTURE_IDS.workspace,
      contact_id: FIXTURE_IDS.contact,
      type: "note",
      content: "duplicate",
      importance: "normal",
    }),
  });
  assert.equal(duplicateMemory.status, 409);

  const resetAgain = await fixtureFetch("/__reset", {
    method: "POST",
    headers: controlHeaders(),
  });
  assert.equal(resetAgain.status, 200);
  const resetState = (await resetAgain.json()).state;
  assert.equal(resetState.counts.memories, 0);
  assert.equal(resetState.counts.followups, 0);
  assert.equal(resetState.counts.seen_inbound_messages, 0);
  assert.deepEqual(resetState.mutation_codes, []);
});

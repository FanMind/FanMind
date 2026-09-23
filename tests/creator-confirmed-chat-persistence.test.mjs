import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import * as learningPolicy from "../src/lib/creatorConfirmedChatLearning.mjs";
import * as creatorPolicy from "../src/lib/creatorIntelligencePolicy.mjs";

const workspaceId = "11111111-1111-4111-8111-111111111111";
const contactId = "22222222-2222-4222-8222-222222222222";
const creatorId = "33333333-3333-4333-8333-333333333333";
const conversationId = "44444444-4444-4444-8444-444444444444";
const proposalId = "55555555-5555-4555-8555-555555555555";
const generationId = "66666666-6666-4666-8666-666666666666";
const outboundMessageId = "77777777-7777-4777-8777-777777777777";
const reactionMessageId = "88888888-8888-4888-8888-888888888888";
const commercialEventId = "99999999-9999-4999-8999-999999999999";
const actorId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const learningId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function compile(path) {
  return ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

function evaluate(code, dependencies, extra = {}) {
  const exports = {};
  runInNewContext(code, {
    exports,
    Response,
    Request,
    URL,
    AbortSignal,
    ...extra,
    require(name) {
      assert.ok(Object.hasOwn(dependencies, name), `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function fixture({ purchaseAttribution = true } = {}) {
  const identity = { workspaceId, creatorId, contactId, conversationId };
  return {
    proposal: {
      ...identity,
      proposalId,
      generationId,
      creatorRevision: 7,
      promptRevision: "prompt-r7",
      selectedVariant: "recommended",
      proposedText: "Hallo! Wie geht es dir?",
      generatedAt: "2026-09-22T20:00:00.000Z",
    },
    outbound: {
      ...identity,
      messageId: outboundMessageId,
      proposalId,
      generationId,
      creatorRevision: 7,
      promptRevision: "prompt-r7",
      actualText: "Hallo! Wie geht es dir heute?",
      confirmedAt: "2026-09-22T20:01:00.000Z",
      confirmedBy: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    },
    reaction: {
      ...identity,
      messageId: reactionMessageId,
      reactedToMessageId: outboundMessageId,
      occurredAt: "2026-09-22T20:02:00.000Z",
    },
    purchase: {
      ...identity,
      commercialEventId,
      kind: "purchase",
      occurredAt: "2026-09-22T20:03:00.000Z",
      attribution: purchaseAttribution
        ? {
            proposalId,
            generationId,
            creatorRevision: 7,
            promptRevision: "prompt-r7",
            outboundMessageId,
            evidenceReference: "confirmed-order-42",
          }
        : null,
    },
  };
}

function persistenceHarness() {
  const calls = [];
  const code = compile("src/lib/creatorConfirmedChatPersistence.ts");
  const module = evaluate(
    code,
    {
      "server-only": {},
      "next/headers": {
        cookies: async () => {
          throw new Error("explicit bearer must not read cookies");
        },
      },
      "@/lib/supabase/config": {
        SUPABASE_ACCESS_TOKEN_COOKIE: "synthetic",
        getSupabaseRestUrl: (table) => `https://supabase.invalid/rest/v1/${table}`,
        getSupabaseHeaders: (token) => ({ Authorization: `Bearer ${token}` }),
      },
      "@/lib/creatorConfirmedChatLearning.mjs": learningPolicy,
      "@/lib/creatorIntelligencePolicy.mjs": creatorPolicy,
    },
    {
      fetch: async (url, options) => {
        calls.push({ url, options });
        return Response.json(learningId);
      },
    },
  );
  return { module, calls };
}

test("server persistence replaces caller actor, binds authorized scope and uses only the authenticated RPC", async () => {
  const h = persistenceHarness();
  const result = await h.module.persistConfirmedChatLearning(
    workspaceId,
    contactId,
    actorId,
    fixture(),
    "synthetic-jwt",
  );
  assert.equal(result, learningId);
  assert.equal(h.calls.length, 1);
  assert.match(String(h.calls[0].url), /rpc\/record_creator_confirmed_chat_learning/u);
  assert.equal(h.calls[0].options.method, "POST");
  assert.equal(h.calls[0].options.headers.Authorization, "Bearer synthetic-jwt");
  assert.equal(h.calls[0].options.cache, "no-store");
  const body = JSON.parse(h.calls[0].options.body);
  assert.equal(body.p_workspace_id, workspaceId);
  assert.equal(body.p_contact_id, contactId);
  assert.equal(body.p_record.outbound.confirmedBy, actorId);
  assert.equal(body.p_record.purchase.evidenceReference, "confirmed-order-42");
  assert.equal(body.p_record.metrics.purchaseKnown, true);
});

test("foreign authorized scope is rejected before persistence and unlinked purchases remain unknown", async () => {
  const h = persistenceHarness();
  await assert.rejects(
    h.module.persistConfirmedChatLearning(
      "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      contactId,
      actorId,
      fixture(),
      "synthetic-jwt",
    ),
    (error) => error instanceof creatorPolicy.CreatorPolicyError && error.code === "learning_authorization_scope_mismatch",
  );
  assert.equal(h.calls.length, 0);

  await h.module.persistConfirmedChatLearning(
    workspaceId,
    contactId,
    actorId,
    fixture({ purchaseAttribution: false }),
    "synthetic-jwt",
  );
  const body = JSON.parse(h.calls[0].options.body);
  assert.equal(body.p_record.purchase, null);
  assert.equal(body.p_record.metrics.purchaseKnown, false);
});

test("controlled SQL is owner-bound, monotonic, tenant-bound and unavailable to direct authenticated writes", () => {
  const sql = readFileSync(
    "supabase/controlled/20260923011500_creator_confirmed_chat_learning.sql",
    "utf8",
  );
  assert.match(sql, /normal deploys MUST NOT apply this file/u);
  assert.match(sql, /create table public\.creator_confirmed_chat_learning/u);
  assert.match(sql, /foreign key \(workspace_id,creator_id\) references public\.creators\(workspace_id,id\) on delete cascade/u);
  assert.match(sql, /foreign key \(workspace_id,contact_id,conversation_id\) references public\.conversations\(workspace_id,contact_id,id\) on delete cascade/u);
  assert.match(sql, /unique \(workspace_id,proposal_id\)/u);
  assert.match(sql, /creator_confirmed_chat_outbound_message_unique_idx/u);
  assert.match(sql, /creator_confirmed_chat_reaction_message_unique_idx/u);
  assert.match(sql, /creator_confirmed_chat_purchase_event_unique_idx/u);
  assert.match(sql, /w\.owner_user_id = actor/u);
  assert.match(sql, /outbound->>'confirmedBy'\)::uuid <> actor/u);
  assert.match(sql, /creator_learning_proposal_rewrite/u);
  assert.match(sql, /creator_learning_outbound_retraction/u);
  assert.match(sql, /creator_learning_reaction_retraction/u);
  assert.match(sql, /creator_learning_purchase_retraction/u);
  assert.match(sql, /creator_learning_purchase_evidence_missing/u);
  assert.match(sql, /revoke all on public\.creator_confirmed_chat_learning from public, anon, authenticated, service_role/u);
  assert.match(sql, /grant select on public\.creator_confirmed_chat_learning to authenticated/u);
  assert.doesNotMatch(sql, /grant (insert|update|delete|all) on public\.creator_confirmed_chat_learning to authenticated/iu);
  assert.match(sql, /grant execute on function public\.record_creator_confirmed_chat_learning\(uuid,uuid,jsonb\)[\s\S]*to authenticated/u);
});

test("public API route keeps writes owner-active, same-origin and Creator-flag gated", async () => {
  const code = compile("src/app/api/creators/confirmed-chat-learning/route.ts");
  const saves = [];
  let enabled = true;
  const dependencies = {
    "next/server": { NextResponse: { json: (body, init) => Response.json(body, init) } },
    "@/lib/requestAccessToken": { getOptionalBearerAccessToken: () => undefined },
    "@/lib/httpMutationPolicy.mjs": {
      isTrustedFanMindMutationRequest: (request) => request.headers.get("origin") === new URL(request.url).origin,
      readBoundedJsonRequest: async (request) => ({ ok: true, value: await request.json() }),
    },
    "@/lib/workspaceAuthorization": {
      requireContactInActiveAuthorizedWorkspaceMember: async (id) => {
        assert.equal(id, contactId);
        return {
          workspace: { id: workspaceId },
          contact: { id: contactId, workspace_id: workspaceId },
          user: { id: actorId },
        };
      },
    },
    "@/lib/creatorIntelligence": { creatorIntelligenceEnabled: () => enabled },
    "@/lib/creatorConfirmedChatPersistence": {
      persistConfirmedChatLearning: async (...args) => {
        saves.push(args);
        return learningId;
      },
    },
    "@/lib/creatorIntelligencePolicy.mjs": creatorPolicy,
  };
  const route = evaluate(code, dependencies);
  const request = (origin = "https://fanmind.invalid") =>
    new Request(`https://fanmind.invalid/api/creators/confirmed-chat-learning?contactId=${contactId}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(fixture()),
    });

  assert.equal((await route.POST(request("https://foreign.invalid"))).status, 403);
  assert.equal(saves.length, 0);

  enabled = false;
  assert.equal((await route.POST(request())).status, 503);
  assert.equal(saves.length, 0);

  enabled = true;
  const response = await route.POST(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, learningId });
  assert.equal(saves.length, 1);
  assert.equal(saves[0][0], workspaceId);
  assert.equal(saves[0][1], contactId);
  assert.equal(saves[0][2], actorId);
});

import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  EXPECTED_WEBSITE_CHAT_RETENTION_SHA256,
  evaluateWebsiteChatRetentionSql,
} from "../scripts/operations/website-chat-retention-migration-check.mjs";

const migrationPath = new URL(
  "../supabase/controlled/20260904170000_website_chat_retention.sql",
  import.meta.url,
);
const foundationPath = new URL(
  "../supabase/migrations/20260808223000_website_chat_security_foundation.sql",
  import.meta.url,
);
const ingestionPath = new URL(
  "../supabase/migrations/20260808234500_website_chat_message_ingestion.sql",
  import.meta.url,
);
const handoffPath = new URL(
  "../supabase/controlled/20260904120000_website_chat_handoff.sql",
  import.meta.url,
);

test("controlled Website Chat retention SQL is checksum-pinned", async () => {
  const sql = await readFile(migrationPath, "utf8");
  const result = evaluateWebsiteChatRetentionSql(sql);
  assert.equal(result.digest, EXPECTED_WEBSITE_CHAT_RETENTION_SHA256);
  assert.equal(result.migrationId, "20260904170000_website_chat_retention");
});

test("retention is bounded, explicit and dry-run by default", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /p_limit integer default 500/u);
  assert.match(sql, /p_execute boolean default false/u);
  assert.match(sql, /p_workspace_id uuid default null/u);
  assert.match(
    sql,
    /drop function if exists public\.manage_website_chat_retention\(integer, boolean\)/u,
  );
  assert.match(sql, /p_limit < 1 or p_limit > 1000/u);
  assert.match(sql, /p_execute is null/u);
  assert.match(sql, /for update of session skip locked/u);
  assert.match(sql, /get diagnostics v_deleted_sessions = row_count/u);
  assert.match(sql, /website_chat_retention_delete_count_mismatch/u);
  assert.match(sql, /has_more boolean/u);
  assert.equal(
    sql.match(/p_workspace_id is null or session\.workspace_id = p_workspace_id/gu)?.length,
    3,
  );
});

test("active handoff evidence blocks session deletion until its own expiry", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.equal(
    sql.match(/session\.revoked_at is not null or session\.expires_at <= v_now/gu)?.length,
    3,
  );
  assert.equal(sql.match(/handoff\.session_id = session\.id/gu)?.length, 3);
  assert.equal(sql.match(/handoff\.expires_at > v_now/gu)?.length, 3);
  assert.doesNotMatch(sql, /delete from public\.website_chat_handoffs/iu);
  assert.doesNotMatch(sql, /delete from public\.website_chat_message_receipts/iu);
});

test("session deletion cascades only technical Website Chat evidence", async () => {
  const [sql, foundation, ingestion, handoff] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile(foundationPath, "utf8"),
    readFile(ingestionPath, "utf8"),
    readFile(handoffPath, "utf8"),
  ]);
  assert.match(sql, /delete from public\.website_chat_visitor_sessions/u);
  assert.deepEqual(
    Array.from(
      sql.matchAll(/\bdelete\s+from\s+([a-z_][a-z0-9_.]*)/giu),
      (match) => match[1].toLowerCase(),
    ),
    ["public.website_chat_visitor_sessions"],
  );
  assert.match(ingestion, /references public\.website_chat_visitor_sessions\(id\) on delete cascade/u);
  assert.match(handoff, /references public\.website_chat_visitor_sessions\(id\) on delete cascade/u);
  assert.match(foundation, /references public\.website_chat_installations\(id, workspace_id\)[\s\S]*on delete cascade/u);
  assert.doesNotMatch(
    sql,
    /delete from public\.(?:contacts|conversations|conversation_messages|workspaces)/iu,
  );
});

test("retention RPC is service-role-only and security-invoker", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(sql, /security invoker[\s\S]*set search_path = public, pg_temp/u);
  assert.match(
    sql,
    /revoke all on function public\.manage_website_chat_retention\(integer, boolean, uuid\)[\s\S]*from public, anon, authenticated, service_role/u,
  );
  assert.match(
    sql,
    /grant execute on function public\.manage_website_chat_retention\(integer, boolean, uuid\)[\s\S]*to service_role/u,
  );
  assert.match(sql, /acl\.grantee = 0/u);
  assert.match(sql, /proowner = to_regrole\('postgres'\)/u);
  assert.match(sql, /to_regrole\('service_role'\)::oid/u);
  assert.match(sql, /function\.proname = 'manage_website_chat_retention'[\s\S]*<> 1/u);
  assert.doesNotMatch(sql, /create\s+policy/iu);
});

test("retention remains dormant outside generic migrations and automation", async () => {
  await assert.rejects(
    access("supabase/migrations/20260904170000_website_chat_retention.sql"),
    (error) => error && typeof error === "object" && error.code === "ENOENT",
  );
  const sql = await readFile(migrationPath, "utf8");
  assert.doesNotMatch(sql, /pg_cron|cron\.schedule|http_post|net\.http|openai|smtp/iu);
});

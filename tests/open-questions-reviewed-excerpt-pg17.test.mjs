import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const container = process.env.FANMIND_OPEN_QUESTIONS_PG17_CONTAINER_ID ?? "";
const required = process.env.FANMIND_OPEN_QUESTIONS_PG17_REQUIRED === "true";
const database = "fanmind_open_question_review_ci";
const roles = ["anon", "authenticated", "service_role"];

function sql(query, selectedDatabase = database) {
  assert.match(container, /^[0-9a-f]{12,64}$/u);
  return execFileSync("docker", [
    "exec", "-i", container, "psql", "-X", "-U", "postgres", "-d", selectedDatabase,
    "-v", "ON_ERROR_STOP=1", "-At",
  ], {
    input: query,
    encoding: "utf8",
    timeout: 60_000,
    maxBuffer: 2 * 1024 * 1024,
    stdio: ["pipe", "pipe", "pipe"],
  });
}

test("native PG17 proves review derivative binding, denial, retention and cleanup", { skip: !required }, () => {
  const createdRoles = [];
  let databaseCreated = false;
  assert.equal(sql(`select count(*) from pg_database where datname='${database}'`, "postgres").trim(), "0");
  try {
    for (const role of roles) {
      const exists = sql(`select count(*) from pg_roles where rolname='${role}'`, "postgres").trim() === "1";
      if (!exists) {
        sql(`create role ${role} nologin;`, "postgres");
        createdRoles.push(role);
      }
    }
    sql(`create database ${database};`, "postgres");
    databaseCreated = true;

    sql(readFileSync(new URL("./fixtures/open-questions-reviewed-excerpt-pg17-setup.sql", import.meta.url), "utf8"));
    sql(readFileSync(new URL("../supabase/controlled/website_chat_open_question_review_derivatives.sql", import.meta.url), "utf8"));

    assert.equal(sql(`
      select count(*) from pg_constraint
       where conname='website_chat_open_question_review_derivative_question_fk'
         and confdeltype='c';
    `).trim(), "1");
    assert.equal(sql(`
      select relrowsecurity::text || ':' || relforcerowsecurity::text
        from pg_class where oid='public.website_chat_open_question_review_derivatives'::regclass;
    `).trim(), "true:true");

    assert.throws(() => sql(`
      set role service_role;
      insert into public.website_chat_open_question_review_derivatives(
        open_question_id, workspace_id, review_version, review_state
      ) values (
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000001', 1, 'pending'
      );
    `));
    assert.throws(() => sql("set role anon; select * from public.website_chat_open_question_review_derivatives;"));
    assert.throws(() => sql("set role authenticated; insert into public.website_chat_open_question_review_derivatives(open_question_id,workspace_id,review_version,review_state) values('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'pending');"));

    sql(`
      insert into public.website_chat_open_question_review_derivatives(
        open_question_id, workspace_id, review_version, review_state,
        reviewed_question_excerpt, reviewer_id, reviewed_at
      ) values
        ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',1,'approved','Wie lange dauert der Versand?','30000000-0000-4000-8000-000000000001',now()),
        ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',2,'pending',null,null,null),
        ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',1,'approved','WIE lange dauert der Versand!','30000000-0000-4000-8000-000000000001',now());
    `);
    assert.equal(
      sql("set role service_role; select count(*) from public.website_chat_open_question_review_derivatives;")
        .trim().split("\n").at(-1),
      "3",
    );
    assert.equal(sql(`
      select review_state from public.website_chat_open_question_review_derivatives
       where open_question_id='20000000-0000-4000-8000-000000000001'
       order by review_version desc limit 1;
    `).trim(), "pending");

    assert.throws(() => sql(`
      insert into public.website_chat_open_question_review_derivatives(
        open_question_id, workspace_id, review_version, review_state,
        reviewed_question_excerpt, reviewer_id, reviewed_at
      ) values (
        '20000000-0000-4000-8000-000000000001',
        '10000000-0000-4000-8000-000000000002', 3, 'approved',
        'Cross workspace', '30000000-0000-4000-8000-000000000001', now()
      );
    `));
    for (const excerpt of [
      "https://example.invalid/private",
      "visitor@example.invalid",
      "sk-synthetic-secret",
      "+41 79 123 45 67",
      "x".repeat(161),
    ]) {
      const sqlExcerpt = `'${excerpt.replaceAll("'", "''")}'`;
      assert.throws(() => sql(`
        insert into public.website_chat_open_question_review_derivatives(
          open_question_id, workspace_id, review_version, review_state,
          reviewed_question_excerpt, reviewer_id, reviewed_at
        ) values (
          '20000000-0000-4000-8000-000000000002',
          '10000000-0000-4000-8000-000000000001', 99, 'approved',
          ${sqlExcerpt}, '30000000-0000-4000-8000-000000000001', now()
        );
      `));
    }

    sql(`
      create table public.ci_question_holds(open_question_id uuid primary key);
      insert into public.ci_question_holds values('20000000-0000-4000-8000-000000000001');
      create function public.ci_block_held_question_delete() returns trigger language plpgsql as $$
      begin
        if exists(select 1 from public.ci_question_holds where open_question_id=old.id) then
          raise exception 'question_held';
        end if;
        return old;
      end $$;
      create trigger ci_hold_question_delete before delete on public.website_chat_open_questions
        for each row execute function public.ci_block_held_question_delete();
    `);
    assert.throws(() => sql("delete from public.website_chat_open_questions where id='20000000-0000-4000-8000-000000000001';"));
    assert.equal(sql("select count(*) from public.website_chat_open_question_review_derivatives where open_question_id='20000000-0000-4000-8000-000000000001';").trim(), "2");
    sql(`
      delete from public.ci_question_holds where open_question_id='20000000-0000-4000-8000-000000000001';
      delete from public.website_chat_open_questions where id='20000000-0000-4000-8000-000000000001';
    `);
    assert.equal(sql("select count(*) from public.website_chat_open_question_review_derivatives where open_question_id='20000000-0000-4000-8000-000000000001';").trim(), "0");
  } finally {
    if (databaseCreated) sql(`drop database ${database} with (force);`, "postgres");
    for (const role of createdRoles.reverse()) sql(`drop role ${role};`, "postgres");
  }
});

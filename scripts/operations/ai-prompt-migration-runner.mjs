#!/usr/bin/env node

import {
  closeSync,
  constants,
  mkdtempSync,
  openSync,
  readFileSync,
  readSync,
  rmSync,
  fstatSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const MIGRATION_ID = "20260726213000_workspace_ai_prompt_settings";
const MIGRATION_PATH = resolve(
  process.cwd(),
  `supabase/migrations/${MIGRATION_ID}.sql`,
);
const EXPECTED_MIGRATION_SHA256 =
  "9276792ab554464d24245cc14025355fd388b50e9ba080df4c37fbef5618e1a6";
const APPLY_CONFIRMATION = "apply-workspace-ai-prompt-settings";
const MAX_PASSFILE_BYTES = 64 * 1024;

const POSTFLIGHT_SQL = String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;

do $verify$
declare
  settings_table oid := to_regclass('public.workspace_ai_prompt_settings');
begin
  if settings_table is null then
    raise exception 'table_missing';
  end if;

  if not exists (
    select 1
      from pg_class
     where oid = settings_table
       and relrowsecurity
  ) then
    raise exception 'rls_missing';
  end if;

  if not exists (
    select 1
      from pg_policies
     where schemaname = 'public'
       and tablename = 'workspace_ai_prompt_settings'
       and policyname = 'workspace_ai_prompt_settings_select_member'
       and cmd = 'SELECT'
       and 'authenticated' = any(roles)
       and qual like '%workspace_members%'
       and qual like '%auth.uid()%'
  ) then
    raise exception 'member_select_policy_invalid';
  end if;

  if has_table_privilege('anon', settings_table, 'SELECT')
     or has_table_privilege('anon', settings_table, 'INSERT')
     or has_table_privilege('anon', settings_table, 'UPDATE')
     or has_table_privilege('anon', settings_table, 'DELETE') then
    raise exception 'anon_privilege_invalid';
  end if;

  if not has_table_privilege('authenticated', settings_table, 'SELECT')
     or has_table_privilege('authenticated', settings_table, 'INSERT')
     or has_table_privilege('authenticated', settings_table, 'UPDATE')
     or has_table_privilege('authenticated', settings_table, 'DELETE') then
    raise exception 'authenticated_privilege_invalid';
  end if;

  if not has_table_privilege('service_role', settings_table, 'SELECT')
     or not has_table_privilege('service_role', settings_table, 'INSERT')
     or not has_table_privilege('service_role', settings_table, 'UPDATE')
     or not has_table_privilege('service_role', settings_table, 'DELETE') then
    raise exception 'service_role_privilege_invalid';
  end if;

  if (
    select count(*)
      from pg_constraint
     where conrelid = settings_table
       and conname in (
         'workspace_ai_prompt_settings_company_prompt_length',
         'workspace_ai_prompt_settings_profiles_array',
         'workspace_ai_prompt_settings_profiles_count'
       )
       and convalidated
  ) <> 3 then
    raise exception 'constraints_invalid';
  end if;

  if not exists (
    select 1
      from pg_trigger
     where tgrelid = settings_table
       and tgname = 'workspace_ai_prompt_settings_set_updated_at'
       and tgenabled = 'O'
       and not tgisinternal
  ) then
    raise exception 'updated_at_trigger_invalid';
  end if;

  if not exists (
    select 1
      from pg_proc
     where oid = to_regprocedure(
       'public.set_workspace_ai_prompt_settings_updated_at()'
     )
       and not prosecdef
       and proconfig @> array['search_path=pg_catalog, public, pg_temp']
  ) then
    raise exception 'updated_at_function_invalid';
  end if;
end
$verify$;

select 'AI_PROMPT_MIGRATION_POSTFLIGHT=PASS';
rollback;
`;

function fail(code) {
  throw new Error(`AI_PROMPT_MIGRATION_ERROR=${code}`);
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--verify", "--apply"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

function readAndVerifyMigration() {
  let sql;
  try {
    sql = readFileSync(MIGRATION_PATH, "utf8");
  } catch {
    fail("migration_unreadable");
  }

  const digest = createHash("sha256").update(sql).digest("hex");
  if (digest !== EXPECTED_MIGRATION_SHA256) {
    fail("migration_checksum_mismatch");
  }

  const requiredContracts = [
    /create table if not exists public\.workspace_ai_prompt_settings/i,
    /workspace_id uuid primary key references public\.workspaces\(id\) on delete cascade/i,
    /check \(char_length\(company_prompt\) <= 3000\)/i,
    /check \(jsonb_typeof\(profiles\) = 'array'\)/i,
    /check \(jsonb_array_length\(profiles\) <= 8\)/i,
    /alter table public\.workspace_ai_prompt_settings enable row level security/i,
    /create policy workspace_ai_prompt_settings_select_member/i,
    /member\.user_id = auth\.uid\(\)/i,
    /revoke all on table public\.workspace_ai_prompt_settings\s+from public, anon, authenticated/i,
    /grant select on table public\.workspace_ai_prompt_settings\s+to authenticated/i,
    /grant all on table public\.workspace_ai_prompt_settings\s+to service_role/i,
    /language plpgsql\s+security invoker/i,
    /create trigger workspace_ai_prompt_settings_set_updated_at/i,
  ];
  if (requiredContracts.some((contract) => !contract.test(sql))) {
    fail("migration_contract_invalid");
  }

  console.log(`AI_PROMPT_MIGRATION_ID=${MIGRATION_ID}`);
  console.log("AI_PROMPT_MIGRATION_CHECKSUM=verified");
  console.log("AI_PROMPT_MIGRATION_CONTRACT=verified");
  return sql;
}

function normalizedReference(value) {
  const candidate = value?.trim().toLowerCase() ?? "";
  return /^[a-z0-9]{8,64}$/.test(candidate) ? candidate : "";
}

function normalizedHost(value) {
  const candidate = value?.trim().toLowerCase().replace(/\.$/u, "") ?? "";
  return /^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(candidate)
    ? candidate
    : "";
}

function projectReferenceFromUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return "";
    const match = /^([a-z0-9]{8,64})\.supabase\.co$/u.exec(
      url.hostname.toLowerCase(),
    );
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function requireDatabaseTarget() {
  const runtime = process.env.FANMIND_RUNTIME_ENVIRONMENT?.trim().toLowerCase();
  if (!["production", "staging"].includes(runtime)) {
    fail("runtime_environment_invalid");
  }

  const targetReference = normalizedReference(
    process.env.FANMIND_TARGET_SUPABASE_PROJECT_REF,
  );
  const productionReference = normalizedReference(
    process.env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF,
  );
  const urlReference = projectReferenceFromUrl(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  if (!targetReference || !productionReference || !urlReference) {
    fail("supabase_reference_missing");
  }
  if (targetReference !== urlReference) {
    fail("supabase_url_binding_invalid");
  }
  if (
    (runtime === "production" && targetReference !== productionReference) ||
    (runtime === "staging" && targetReference === productionReference)
  ) {
    fail("environment_target_binding_invalid");
  }

  const pgHost = normalizedHost(process.env.PGHOST);
  const expectedHost = normalizedHost(process.env.FANMIND_TARGET_DB_HOST);
  if (!pgHost || !expectedHost || pgHost !== expectedHost) {
    fail("database_host_binding_invalid");
  }
  if (
    process.env.PGHOSTADDR ||
    process.env.PGSERVICE ||
    process.env.PGSERVICEFILE ||
    process.env.PGSYSCONFDIR
  ) {
    fail("libpq_redirect_invalid");
  }

  const pgPort = process.env.PGPORT?.trim() ?? "";
  const pgDatabase = process.env.PGDATABASE?.trim() ?? "";
  const pgUser = process.env.PGUSER?.trim() ?? "";
  if (
    !/^[0-9]{1,5}$/.test(pgPort) ||
    Number(pgPort) < 1 ||
    Number(pgPort) > 65535 ||
    !/^[A-Za-z0-9_.-]{1,128}$/.test(pgDatabase) ||
    !/^[A-Za-z0-9_.-]{1,128}$/.test(pgUser)
  ) {
    fail("database_identity_invalid");
  }

  console.log(`AI_PROMPT_MIGRATION_TARGET=${runtime}`);
  console.log("AI_PROMPT_MIGRATION_PROJECT_BINDING=verified");
  console.log("AI_PROMPT_MIGRATION_DATABASE_BINDING=verified");
  return runtime;
}

function privatePassfileSnapshot() {
  const sourcePath = process.env.PGPASSFILE?.trim();
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");

  let sourceDescriptor;
  let snapshotDirectory;
  try {
    sourceDescriptor = openSync(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const opened = fstatSync(sourceDescriptor);
    if (
      !opened.isFile() ||
      (opened.mode & 0o777) !== 0o600 ||
      opened.size < 1 ||
      opened.size > MAX_PASSFILE_BYTES ||
      (typeof process.getuid === "function" && opened.uid !== process.getuid())
    ) {
      fail("passfile_invalid");
    }

    const content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const bytesRead = readSync(
        sourceDescriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
      if (bytesRead === 0) fail("passfile_read_failed");
      offset += bytesRead;
    }

    const settled = fstatSync(sourceDescriptor);
    if (
      settled.dev !== opened.dev ||
      settled.ino !== opened.ino ||
      settled.size !== opened.size ||
      settled.mtimeMs !== opened.mtimeMs ||
      settled.ctimeMs !== opened.ctimeMs
    ) {
      content.fill(0);
      fail("passfile_changed");
    }

    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-ai-migration-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    content.fill(0);
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("AI_PROMPT_MIGRATION_ERROR=")
    ) {
      throw error;
    }
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ELOOP"
    ) {
      fail("passfile_invalid");
    }
    fail("passfile_read_failed");
  } finally {
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
  }
}

function psqlEnvironment(passfilePath) {
  const environment = { ...process.env, PGPASSFILE: passfilePath };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
  ]) {
    delete environment[key];
  }
  environment.PGCONNECT_TIMEOUT = "10";
  return environment;
}

function runPsql(input, passfilePath) {
  return spawnSync(
    "psql",
    ["--no-password", "--no-psqlrc", "--set=ON_ERROR_STOP=1"],
    {
      env: psqlEnvironment(passfilePath),
      input,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("AI_PROMPT_MIGRATION_PSQL=available");
}

function runDatabaseMode(mode, migrationSql) {
  const runtime = requireDatabaseTarget();
  if (
    mode === "--apply" &&
    process.env.FANMIND_AI_PROMPT_MIGRATION_CONFIRM !== APPLY_CONFIRMATION
  ) {
    fail("apply_confirmation_invalid");
  }
  if (
    mode === "--apply" &&
    runtime === "production" &&
    (process.env.FANMIND_PRODUCTION_CHANGE_TICKET?.trim().length ?? 0) < 3
  ) {
    fail("production_change_ticket_missing");
  }

  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } = privatePassfileSnapshot();
  try {
    if (mode === "--apply") {
      const apply = runPsql(migrationSql, snapshotPath);
      if (apply.error || apply.status !== 0) fail("apply_failed");
      console.log("AI_PROMPT_MIGRATION_APPLY=completed");
    } else {
      console.log("AI_PROMPT_MIGRATION_APPLY=not_requested");
    }

    const verification = runPsql(POSTFLIGHT_SQL, snapshotPath);
    if (
      verification.error ||
      verification.status !== 0 ||
      !verification.stdout.includes("AI_PROMPT_MIGRATION_POSTFLIGHT=PASS")
    ) {
      fail("postflight_failed");
    }
    console.log("AI_PROMPT_MIGRATION_POSTFLIGHT=PASS");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

try {
  const mode = modeFromArguments(process.argv.slice(2));
  const migrationSql = readAndVerifyMigration();
  if (mode === "--check") {
    console.log("AI_PROMPT_MIGRATION_MODE=check");
    console.log("AI_PROMPT_MIGRATION_READY=YES");
  } else {
    console.log(
      `AI_PROMPT_MIGRATION_MODE=${mode === "--apply" ? "apply" : "verify"}`,
    );
    runDatabaseMode(mode, migrationSql);
    console.log("AI_PROMPT_MIGRATION_READY=YES");
  }
} catch (error) {
  if (
    error instanceof Error &&
    /^AI_PROMPT_MIGRATION_ERROR=[a-z0-9_]+$/u.test(error.message)
  ) {
    console.error(error.message);
  } else {
    console.error("AI_PROMPT_MIGRATION_ERROR=unexpected_failure");
  }
  process.exitCode = 1;
}

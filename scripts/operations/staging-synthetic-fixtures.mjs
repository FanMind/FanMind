#!/usr/bin/env node

import {
  closeSync,
  constants,
  fstatSync,
  mkdtempSync,
  openSync,
  readSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

import { buildSupabaseApiKeyHeaders } from "../../src/lib/supabase/apiKeyPolicy.mjs";
import {
  STAGING_SYNTHETIC_MEMBER_EMAIL,
  STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
  STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME,
  STAGING_SYNTHETIC_UUID_PATTERN,
  deriveStagingSyntheticContactId,
  evaluateStagingSyntheticFixtureEnvironment,
  stagingSyntheticFixtureAssignments,
} from "../../src/lib/stagingSyntheticFixturePolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const USER_MARKER_KEY = "fanmind_staging_fixture";
const USER_MARKER_VERSION_KEY = "fanmind_staging_fixture_version";
const USER_MARKER_VERSION = 1;

function fail(code) {
  throw new Error(`STAGING_SYNTHETIC_FIXTURE_ERROR=${code}`);
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--run"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlUuid(value) {
  const candidate = clean(value).toLowerCase();
  if (!STAGING_SYNTHETIC_UUID_PATTERN.test(candidate)) {
    fail("sql_uuid_invalid");
  }
  return `${sqlLiteral(candidate)}::uuid`;
}

export function buildStagingSyntheticFixtureSql({
  primaryUserId,
  primaryEmail,
  primaryWorkspaceId,
  primaryContactId,
  secondaryUserId,
  secondaryEmail,
  secondaryWorkspaceId,
  secondaryContactId,
  memberUserId,
}) {
  const primaryUser = sqlUuid(primaryUserId);
  const primaryWorkspace = sqlUuid(primaryWorkspaceId);
  const primaryContact = sqlUuid(primaryContactId);
  const secondaryUser = sqlUuid(secondaryUserId);
  const secondaryWorkspace = sqlUuid(secondaryWorkspaceId);
  const secondaryContact = sqlUuid(secondaryContactId);
  const memberUser = sqlUuid(memberUserId);
  const primaryName = sqlLiteral(STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME);
  const secondaryName = sqlLiteral(STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME);
  const primaryMail = sqlLiteral(clean(primaryEmail).toLowerCase());
  const secondaryMail = sqlLiteral(clean(secondaryEmail).toLowerCase());
  const memberMail = sqlLiteral(STAGING_SYNTHETIC_MEMBER_EMAIL);

  return String.raw`
\set ON_ERROR_STOP on
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $contract$
begin
  if ${primaryUser} = ${secondaryUser}
     or ${primaryUser} = ${memberUser}
     or ${secondaryUser} = ${memberUser}
     or ${primaryWorkspace} = ${secondaryWorkspace}
     or ${primaryContact} = ${secondaryContact} then
    raise exception 'synthetic_fixture_identity_overlap';
  end if;
  if not exists (select 1 from auth.users where id = ${primaryUser})
     or not exists (select 1 from auth.users where id = ${secondaryUser})
     or not exists (select 1 from auth.users where id = ${memberUser}) then
    raise exception 'synthetic_fixture_auth_user_missing';
  end if;
  if not exists (
    select 1 from public.workspaces
     where id = ${primaryWorkspace} and owner_user_id = ${primaryUser}
  ) or not exists (
    select 1 from public.workspaces
     where id = ${secondaryWorkspace} and owner_user_id = ${secondaryUser}
  ) then
    raise exception 'synthetic_fixture_workspace_owner_mismatch';
  end if;
  if exists (
    select 1 from public.workspaces
     where id in (${primaryWorkspace}, ${secondaryWorkspace})
       and (
         stripe_customer_id is not null
         or stripe_subscription_id is not null
         or stripe_checkout_session_id is not null
         or stripe_payment_intent_id is not null
         or stripe_mandate_id is not null
       )
  ) then
    raise exception 'synthetic_fixture_stripe_state_not_empty';
  end if;
  if exists (
    select 1 from public.workspace_members
     where (workspace_id = ${primaryWorkspace} and user_id = ${secondaryUser})
        or (workspace_id = ${secondaryWorkspace} and user_id in (${primaryUser}, ${memberUser}))
  ) then
    raise exception 'synthetic_fixture_cross_membership';
  end if;
  if exists (
    select 1 from public.contacts
     where (id = ${primaryContact} and workspace_id <> ${primaryWorkspace})
        or (id = ${secondaryContact} and workspace_id <> ${secondaryWorkspace})
  ) then
    raise exception 'synthetic_fixture_contact_collision';
  end if;
end
$contract$;

insert into public.profiles (id, email, display_name)
values
  (${primaryUser}, ${primaryMail}, 'FanMind Staging Primary'),
  (${secondaryUser}, ${secondaryMail}, 'FanMind Staging Secondary'),
  (${memberUser}, ${memberMail}, 'FanMind Staging AI Member')
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name;

update public.workspaces
   set name = ${primaryName},
       billing_status = 'active',
       billing_provider = 'stripe',
       payment_collection_method = 'card',
       billing_manual_override = false,
       billing_suspended_at = null,
       billing_suspended_reason = null,
       billing_grace_until = null,
       subscription_cancel_requested_at = null,
       subscription_cancel_requested_by_user_id = null,
       subscription_cancel_at_period_end = false,
       subscription_effective_end_at = null,
       subscription_cancellation_revoked_at = null,
       workspace_access_mode = 'active',
       test_access_flags = coalesce(test_access_flags, '{}'::jsonb)
         || '{"staging_synthetic_fixture":true,"workspace_processing_acceptance":true}'::jsonb,
       billing_updated_at = statement_timestamp(),
       billing_updated_by_user_id = ${primaryUser}
 where id = ${primaryWorkspace}
   and owner_user_id = ${primaryUser};

update public.workspaces
   set name = ${secondaryName},
       billing_status = 'active',
       billing_provider = 'stripe',
       payment_collection_method = 'card',
       billing_manual_override = false,
       billing_suspended_at = null,
       billing_suspended_reason = null,
       billing_grace_until = null,
       subscription_cancel_requested_at = null,
       subscription_cancel_requested_by_user_id = null,
       subscription_cancel_at_period_end = false,
       subscription_effective_end_at = null,
       subscription_cancellation_revoked_at = null,
       workspace_access_mode = 'active',
       test_access_flags = coalesce(test_access_flags, '{}'::jsonb)
         || '{"staging_synthetic_fixture":true}'::jsonb,
       billing_updated_at = statement_timestamp(),
       billing_updated_by_user_id = ${secondaryUser}
 where id = ${secondaryWorkspace}
   and owner_user_id = ${secondaryUser};

insert into public.workspace_members (workspace_id, user_id, role)
values (${primaryWorkspace}, ${memberUser}, 'member')
on conflict (workspace_id, user_id) do update
set role = excluded.role;

insert into public.contacts (
  id,
  workspace_id,
  display_name,
  handle,
  source_platform,
  language,
  status,
  tags,
  summary,
  internal_notes,
  is_top_fan
)
values
  (
    ${primaryContact},
    ${primaryWorkspace},
    'FanMind Staging Primary Contact',
    'fanmind-staging-primary',
    'manual',
    'de',
    'new',
    array['synthetic', 'staging'],
    'Persistente synthetische Read-only-E2E-Fixture.',
    null,
    false
  ),
  (
    ${secondaryContact},
    ${secondaryWorkspace},
    'FanMind Staging Secondary Contact',
    'fanmind-staging-secondary',
    'manual',
    'de',
    'new',
    array['synthetic', 'staging'],
    'Persistente synthetische Read-only-E2E-Fixture.',
    null,
    false
  )
on conflict (id) do update
set display_name = excluded.display_name,
    handle = excluded.handle,
    source_platform = excluded.source_platform,
    language = excluded.language,
    status = excluded.status,
    tags = excluded.tags,
    summary = excluded.summary,
    internal_notes = excluded.internal_notes,
    is_top_fan = excluded.is_top_fan;

do $verify$
begin
  if not exists (
    select 1
      from public.workspaces as workspace
     where workspace.id = ${primaryWorkspace}
       and workspace.owner_user_id = ${primaryUser}
       and workspace.name = ${primaryName}
       and workspace.billing_status = 'active'
       and workspace.workspace_access_mode = 'active'
       and workspace.stripe_customer_id is null
       and workspace.stripe_subscription_id is null
       and workspace.test_access_flags ->> 'staging_synthetic_fixture' = 'true'
       and workspace.test_access_flags ->> 'workspace_processing_acceptance' = 'true'
  ) then
    raise exception 'synthetic_fixture_primary_workspace_invalid';
  end if;
  if not exists (
    select 1
      from public.workspaces as workspace
     where workspace.id = ${secondaryWorkspace}
       and workspace.owner_user_id = ${secondaryUser}
       and workspace.name = ${secondaryName}
       and workspace.billing_status = 'active'
       and workspace.workspace_access_mode = 'active'
       and workspace.test_access_flags ->> 'staging_synthetic_fixture' = 'true'
  ) then
    raise exception 'synthetic_fixture_secondary_workspace_invalid';
  end if;
  if (
    select count(*) from public.workspace_members
     where workspace_id = ${primaryWorkspace}
       and ((user_id = ${primaryUser} and role = 'owner')
         or (user_id = ${memberUser} and role = 'member'))
  ) <> 2 or (
    select count(*) from public.workspace_members
     where workspace_id = ${primaryWorkspace}
  ) <> 2 then
    raise exception 'synthetic_fixture_primary_members_invalid';
  end if;
  if (
    select count(*) from public.workspace_members
     where workspace_id = ${secondaryWorkspace}
       and user_id = ${secondaryUser}
       and role = 'owner'
  ) <> 1 or (
    select count(*) from public.workspace_members
     where workspace_id = ${secondaryWorkspace}
  ) <> 1 then
    raise exception 'synthetic_fixture_secondary_owner_invalid';
  end if;
  if (
    select count(*) from public.contacts
     where (id = ${primaryContact} and workspace_id = ${primaryWorkspace})
        or (id = ${secondaryContact} and workspace_id = ${secondaryWorkspace})
  ) <> 2 then
    raise exception 'synthetic_fixture_contacts_invalid';
  end if;
end
$verify$;

commit;

select 'FANMIND_STAGING_E2E_WORKSPACE_ID=${clean(primaryWorkspaceId).toLowerCase()}';
select 'FANMIND_STAGING_E2E_CONTACT_ID=${clean(primaryContactId).toLowerCase()}';
select 'FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID=${clean(secondaryWorkspaceId).toLowerCase()}';
select 'FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID=${clean(secondaryContactId).toLowerCase()}';
select 'FANMIND_AI_TIER_STAGING_WORKSPACE_ID=${clean(primaryWorkspaceId).toLowerCase()}';
select 'FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID=${clean(primaryWorkspaceId).toLowerCase()}';
select 'STAGING_SYNTHETIC_FIXTURE_DATABASE=PASS';
`;
}

function buildWorkspaceCleanupSql(workspaces) {
  const statements = workspaces.map(
    ({ workspaceId, userId }) =>
      `delete from public.workspaces where id = ${sqlUuid(workspaceId)} and owner_user_id = ${sqlUuid(userId)};`,
  );
  return String.raw`
\set ON_ERROR_STOP on
begin;
${statements.join("\n")}
commit;
`;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = clean(environment.PGPASSFILE);
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");

  let sourceDescriptor;
  let snapshotDirectory;
  let content;
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
    content = Buffer.alloc(opened.size);
    let offset = 0;
    while (offset < content.length) {
      const bytesRead = readSync(
        sourceDescriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
      if (bytesRead === 0) fail("passfile_read");
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
      fail("passfile_changed");
    }

    snapshotDirectory = mkdtempSync(join(tmpdir(), "fanmind-staging-fixtures-"));
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("STAGING_SYNTHETIC_FIXTURE_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read");
  } finally {
    content?.fill(0);
    if (sourceDescriptor !== undefined) closeSync(sourceDescriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safeEnvironment = { ...environment, PGPASSFILE: passfilePath };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGHOSTADDR",
    "PGPASSWORD",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "FANMIND_STAGING_E2E_PASSWORD",
    "FANMIND_STAGING_E2E_SECONDARY_PASSWORD",
    "FANMIND_STAGING_E2E_MEMBER_PASSWORD",
    "FANMIND_STAGING_SUPABASE_ANON_KEY",
    "FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY",
  ]) {
    delete safeEnvironment[key];
  }
  safeEnvironment.PGCONNECT_TIMEOUT = "10";
  return safeEnvironment;
}

function runPsql(sql, environment, passfilePath) {
  return spawnSync(
    "psql",
    [
      "--no-password",
      "--no-psqlrc",
      "--quiet",
      "--tuples-only",
      "--no-align",
      "--set=ON_ERROR_STOP=1",
    ],
    {
      env: psqlEnvironment(environment, passfilePath),
      input: sql,
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
}

function supabaseUrl(environment, path) {
  return new URL(path, clean(environment.FANMIND_STAGING_SUPABASE_URL));
}

async function jsonRequest(url, options, expectedStatuses) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    fail("supabase_request_failed");
  }
  if (!expectedStatuses.includes(response.status)) {
    fail("supabase_response_rejected");
  }
  if (response.status === 204) return {};
  let body;
  try {
    body = await response.text();
  } catch {
    fail("supabase_response_invalid");
  }
  if (!body) return {};
  try {
    return JSON.parse(body);
  } catch {
    fail("supabase_response_invalid");
  }
}

function userFromPayload(payload) {
  const user = payload?.user && typeof payload.user === "object"
    ? payload.user
    : payload;
  return user && typeof user === "object" ? user : null;
}

function userMarker(user) {
  const metadata = user?.user_metadata ?? user?.raw_user_meta_data;
  return metadata && typeof metadata === "object" ? metadata : {};
}

async function listAdminUsers(environment) {
  const url = supabaseUrl(environment, "/auth/v1/admin/users");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "1000");
  const payload = await jsonRequest(
    url,
    {
      method: "GET",
      headers: buildSupabaseApiKeyHeaders(
        environment.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,
      ),
    },
    [200],
  );
  if (!Array.isArray(payload?.users)) fail("admin_user_list_invalid");
  return payload.users;
}

async function ensureAdminUser(environment, users, role, email, password) {
  const normalizedEmail = clean(email).toLowerCase();
  const matches = users.filter(
    (user) => clean(user?.email).toLowerCase() === normalizedEmail,
  );
  if (matches.length > 1) fail("admin_user_duplicate");
  const existing = matches[0];
  const metadata = {
    ...userMarker(existing),
    [USER_MARKER_KEY]: role,
    [USER_MARKER_VERSION_KEY]: USER_MARKER_VERSION,
  };
  if (existing) {
    const existingMarker = userMarker(existing);
    if (
      existingMarker[USER_MARKER_KEY] !== role ||
      existingMarker[USER_MARKER_VERSION_KEY] !== USER_MARKER_VERSION ||
      !STAGING_SYNTHETIC_UUID_PATTERN.test(clean(existing.id))
    ) {
      fail("existing_user_not_fixture");
    }
    if (!password) return { user: existing, created: false };
    const payload = await jsonRequest(
      supabaseUrl(environment, `/auth/v1/admin/users/${existing.id}`),
      {
        method: "PUT",
        headers: buildSupabaseApiKeyHeaders(
          environment.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,
        ),
        body: JSON.stringify({
          password,
          email_confirm: true,
          user_metadata: metadata,
        }),
      },
      [200],
    );
    const updated = userFromPayload(payload);
    if (!STAGING_SYNTHETIC_UUID_PATTERN.test(clean(updated?.id))) {
      fail("admin_user_update_invalid");
    }
    return { user: updated, created: false };
  }

  const body = {
    email: normalizedEmail,
    email_confirm: true,
    user_metadata: metadata,
  };
  if (password) body.password = password;
  const payload = await jsonRequest(
    supabaseUrl(environment, "/auth/v1/admin/users"),
    {
      method: "POST",
      headers: buildSupabaseApiKeyHeaders(
        environment.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,
      ),
      body: JSON.stringify(body),
    },
    [200, 201],
  );
  const created = userFromPayload(payload);
  if (!STAGING_SYNTHETIC_UUID_PATTERN.test(clean(created?.id))) {
    fail("admin_user_create_invalid");
  }
  users.push(created);
  return { user: created, created: true };
}

async function signInSyntheticUser(environment, email, password, expectedUserId) {
  const url = supabaseUrl(environment, "/auth/v1/token");
  url.searchParams.set("grant_type", "password");
  const payload = await jsonRequest(
    url,
    {
      method: "POST",
      headers: buildSupabaseApiKeyHeaders(
        environment.FANMIND_STAGING_SUPABASE_ANON_KEY,
      ),
      body: JSON.stringify({ email: clean(email).toLowerCase(), password }),
    },
    [200],
  );
  if (
    !clean(payload?.access_token) ||
    clean(payload?.user?.id).toLowerCase() !== clean(expectedUserId).toLowerCase()
  ) {
    fail("synthetic_sign_in_invalid");
  }
  return payload.access_token;
}

async function ensureWorkspace(environment, accessToken, name) {
  const payload = await jsonRequest(
    supabaseUrl(environment, "/rest/v1/rpc/ensure_current_user_workspace"),
    {
      method: "POST",
      headers: {
        ...buildSupabaseApiKeyHeaders(
          environment.FANMIND_STAGING_SUPABASE_ANON_KEY,
          accessToken,
        ),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        p_workspace_name: name,
        p_commercial_option: "starter_paid_setup",
        p_payment_terms_accepted: true,
      }),
    },
    [200],
  );
  const row = Array.isArray(payload) ? payload[0] : payload;
  const workspaceId = clean(row?.workspace_id).toLowerCase();
  if (!STAGING_SYNTHETIC_UUID_PATTERN.test(workspaceId)) {
    fail("workspace_provisioning_invalid");
  }
  return { workspaceId, created: row?.created === true };
}

async function deleteCreatedUser(environment, userId) {
  try {
    await jsonRequest(
      supabaseUrl(environment, `/auth/v1/admin/users/${userId}`),
      {
        method: "DELETE",
        headers: buildSupabaseApiKeyHeaders(
          environment.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,
        ),
      },
      [200, 204],
    );
    return true;
  } catch {
    return false;
  }
}

function verifyReceipt(output, expectedAssignments) {
  const lines = new Set(
    String(output ?? "")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean),
  );
  for (const [name, value] of Object.entries(expectedAssignments)) {
    if (!lines.has(`${name}=${value}`)) fail("receipt_assignment_missing");
  }
  if (!lines.has("STAGING_SYNTHETIC_FIXTURE_DATABASE=PASS")) {
    fail("receipt_database_missing");
  }
}

async function runProvisioning(environment) {
  const evaluation = evaluateStagingSyntheticFixtureEnvironment(environment);
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const passfile = privatePassfileSnapshot(environment);
  const createdUsers = [];
  const createdWorkspaces = [];
  try {
    const users = await listAdminUsers(environment);
    const primary = await ensureAdminUser(
      environment,
      users,
      "primary",
      environment.FANMIND_STAGING_E2E_EMAIL,
      environment.FANMIND_STAGING_E2E_PASSWORD,
    );
    if (primary.created) createdUsers.push(primary.user.id);
    const secondary = await ensureAdminUser(
      environment,
      users,
      "secondary",
      environment.FANMIND_STAGING_E2E_SECONDARY_EMAIL,
      environment.FANMIND_STAGING_E2E_SECONDARY_PASSWORD,
    );
    if (secondary.created) createdUsers.push(secondary.user.id);
    const member = await ensureAdminUser(
      environment,
      users,
      "ai_member",
      STAGING_SYNTHETIC_MEMBER_EMAIL,
      environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD,
    );
    if (member.created) createdUsers.push(member.user.id);
    if (
      new Set([primary.user.id, secondary.user.id, member.user.id]).size !== 3
    ) {
      fail("auth_identity_overlap");
    }

    const primaryToken = await signInSyntheticUser(
      environment,
      environment.FANMIND_STAGING_E2E_EMAIL,
      environment.FANMIND_STAGING_E2E_PASSWORD,
      primary.user.id,
    );
    const secondaryToken = await signInSyntheticUser(
      environment,
      environment.FANMIND_STAGING_E2E_SECONDARY_EMAIL,
      environment.FANMIND_STAGING_E2E_SECONDARY_PASSWORD,
      secondary.user.id,
    );
    await signInSyntheticUser(
      environment,
      STAGING_SYNTHETIC_MEMBER_EMAIL,
      environment.FANMIND_STAGING_E2E_MEMBER_PASSWORD,
      member.user.id,
    );
    const primaryWorkspace = await ensureWorkspace(
      environment,
      primaryToken,
      STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME,
    );
    const secondaryWorkspace = await ensureWorkspace(
      environment,
      secondaryToken,
      STAGING_SYNTHETIC_SECONDARY_WORKSPACE_NAME,
    );
    if (primaryWorkspace.created && !primary.created) {
      createdWorkspaces.push({
        workspaceId: primaryWorkspace.workspaceId,
        userId: primary.user.id,
      });
    }
    if (secondaryWorkspace.created && !secondary.created) {
      createdWorkspaces.push({
        workspaceId: secondaryWorkspace.workspaceId,
        userId: secondary.user.id,
      });
    }
    if (primaryWorkspace.workspaceId === secondaryWorkspace.workspaceId) {
      fail("workspace_identity_overlap");
    }

    const primaryContactId = deriveStagingSyntheticContactId(
      primaryWorkspace.workspaceId,
      "primary",
    );
    const secondaryContactId = deriveStagingSyntheticContactId(
      secondaryWorkspace.workspaceId,
      "secondary",
    );
    const assignments = stagingSyntheticFixtureAssignments({
      primaryWorkspaceId: primaryWorkspace.workspaceId,
      primaryContactId,
      secondaryWorkspaceId: secondaryWorkspace.workspaceId,
      secondaryContactId,
    });
    const sql = buildStagingSyntheticFixtureSql({
      primaryUserId: primary.user.id,
      primaryEmail: environment.FANMIND_STAGING_E2E_EMAIL,
      primaryWorkspaceId: primaryWorkspace.workspaceId,
      primaryContactId,
      secondaryUserId: secondary.user.id,
      secondaryEmail: environment.FANMIND_STAGING_E2E_SECONDARY_EMAIL,
      secondaryWorkspaceId: secondaryWorkspace.workspaceId,
      secondaryContactId,
      memberUserId: member.user.id,
    });
    const result = runPsql(sql, environment, passfile.snapshotPath);
    if (result.error || result.status !== 0) fail("database_apply_failed");
    verifyReceipt(result.stdout, assignments);

    console.log("STAGING_SYNTHETIC_FIXTURE_AUTH_USERS=3");
    console.log("STAGING_SYNTHETIC_FIXTURE_WORKSPACES=2");
    console.log("STAGING_SYNTHETIC_FIXTURE_CONTACTS=2");
    for (const [name, value] of Object.entries(assignments)) {
      console.log(`${name}=${value}`);
    }
    console.log("STAGING_SYNTHETIC_FIXTURE_SECRETS_OUTPUT=0");
    console.log("STAGING_SYNTHETIC_FIXTURE=PASS");
  } catch (error) {
    let cleanupComplete = true;
    if (createdWorkspaces.length > 0) {
      const cleanup = runPsql(
        buildWorkspaceCleanupSql(createdWorkspaces),
        environment,
        passfile.snapshotPath,
      );
      cleanupComplete =
        !cleanup.error && cleanup.status === 0 && cleanupComplete;
    }
    for (const userId of createdUsers.reverse()) {
      cleanupComplete =
        (await deleteCreatedUser(environment, userId)) && cleanupComplete;
    }
    if (!cleanupComplete) fail("cleanup_incomplete");
    if (
      error instanceof Error &&
      error.message.startsWith("STAGING_SYNTHETIC_FIXTURE_ERROR=")
    ) {
      throw error;
    }
    fail("unexpected");
  } finally {
    rmSync(passfile.snapshotDirectory, { recursive: true, force: true });
  }
}

function runOfflineContractCheck() {
  const primaryWorkspaceId = "11111111-1111-4111-8111-111111111111";
  const secondaryWorkspaceId = "22222222-2222-4222-8222-222222222222";
  const primaryContactId = deriveStagingSyntheticContactId(
    primaryWorkspaceId,
    "primary",
  );
  const secondaryContactId = deriveStagingSyntheticContactId(
    secondaryWorkspaceId,
    "secondary",
  );
  const assignments = stagingSyntheticFixtureAssignments({
    primaryWorkspaceId,
    primaryContactId,
    secondaryWorkspaceId,
    secondaryContactId,
  });
  const sql = buildStagingSyntheticFixtureSql({
    primaryUserId: "33333333-3333-4333-8333-333333333333",
    primaryEmail: "primary-staging@example.invalid",
    primaryWorkspaceId,
    primaryContactId,
    secondaryUserId: "44444444-4444-4444-8444-444444444444",
    secondaryEmail: "secondary-staging@example.invalid",
    secondaryWorkspaceId,
    secondaryContactId,
    memberUserId: "55555555-5555-4555-8555-555555555555",
  });
  if (
    !sql.includes("begin;") ||
    !sql.includes("commit;") ||
    !sql.includes(STAGING_SYNTHETIC_PRIMARY_WORKSPACE_NAME) ||
    !sql.includes("workspace_processing_acceptance") ||
    Object.keys(assignments).length !== 6
  ) {
    fail("offline_contract_invalid");
  }
  console.log("STAGING_SYNTHETIC_FIXTURE_MODE=check");
  console.log("STAGING_SYNTHETIC_FIXTURE_CONTRACT=PASS");
}

export async function main(argumentsList = process.argv.slice(2), environment = process.env) {
  const mode = modeFromArguments(argumentsList);
  if (mode === "--check") {
    runOfflineContractCheck();
    return;
  }
  await runProvisioning(environment);
}

const isMain =
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  main().catch((error) => {
    const message =
      error instanceof Error &&
      error.message.startsWith("STAGING_SYNTHETIC_FIXTURE_ERROR=")
        ? error.message
        : "STAGING_SYNTHETIC_FIXTURE_ERROR=unexpected";
    console.error(message);
    process.exitCode = 1;
  });
}

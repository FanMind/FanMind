#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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

import {
  UUID_PATTERN,
  evaluateMobilePushStagingControlEnvironment,
} from "../../src/lib/mobilePushStagingControlPolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;

function fail(code) {
  throw new Error(`MOBILE_PUSH_STAGING_ACCEPTANCE_ERROR=${code}`);
}

function modeFromArguments(argumentsList) {
  const known = new Set(["--check", "--preflight", "--run"]);
  if (argumentsList.some((argument) => !known.has(argument))) {
    fail("argument_invalid");
  }
  const selected = argumentsList.filter((argument) => known.has(argument));
  if (selected.length > 1) fail("mode_ambiguous");
  return selected[0] ?? "--check";
}

function sqlUuid(value) {
  if (!UUID_PATTERN.test(value)) fail("synthetic_identifier_invalid");
  return `'${value}'::uuid`;
}

function sqlText(value, pattern) {
  if (!pattern.test(value)) fail("synthetic_material_invalid");
  return `'${value}'`;
}

export function buildSyntheticMobilePushMaterial(deviceId, label) {
  if (!UUID_PATTERN.test(deviceId) || !/^(?:owner|member)$/u.test(label)) {
    fail("synthetic_identifier_invalid");
  }
  const seed = `fanmind-mobile-push-staging:${deviceId}:${label}`;
  const tokenHash = createHash("sha256").update(seed).digest("hex");
  const segment = (suffix, length) =>
    createHash("sha256")
      .update(`${seed}:${suffix}`)
      .digest("base64url")
      .slice(0, length);
  return Object.freeze({
    tokenHash,
    tokenCiphertext: `v1:${segment("iv", 16)}:${segment(
      "ciphertext",
      32,
    )}:${segment("tag", 22)}`,
  });
}

function resourceSql(identifiers) {
  const workspace = sqlUuid(identifiers.workspaceId);
  const owner = sqlUuid(identifiers.ownerUserId);
  const member = sqlUuid(identifiers.memberUserId);
  return String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
do $verify$
begin
  if to_regrole('anon') is null
     or to_regrole('authenticated') is null
     or to_regrole('service_role') is null then
    raise exception 'required_roles_missing';
  end if;

  if not exists (
    select 1
      from public.workspaces as workspace
     where workspace.id = ${workspace}
       and workspace.owner_user_id = ${owner}
       and workspace.billing_status is distinct from 'demo_free'
       and workspace.name not in (
         'Sandra M. Demo Workspace',
         'FanMind Demo Workspace',
         'Temporary FanMind Demo'
       )
  ) then
    raise exception 'synthetic_workspace_invalid';
  end if;

  if not exists (
    select 1
      from public.workspace_members as membership
     where membership.workspace_id = ${workspace}
       and membership.user_id = ${member}
       and membership.role = 'member'
  ) then
    raise exception 'synthetic_member_invalid';
  end if;

  if not exists (
    select 1
      from auth.users as account
     where account.id = ${owner}
       and lower(coalesce(account.email, '')) <> 'sandra.m@fanmind.ch'
       and coalesce(account.raw_user_meta_data ->> 'fanmind_demo', 'false')
         <> 'true'
  )
     or not exists (
       select 1
         from auth.users as account
        where account.id = ${member}
          and lower(coalesce(account.email, '')) <> 'sandra.m@fanmind.ch'
          and coalesce(account.raw_user_meta_data ->> 'fanmind_demo', 'false')
            <> 'true'
     ) then
    raise exception 'synthetic_account_invalid';
  end if;
end
$verify$;
select 'MOBILE_PUSH_STAGING_SYNTHETIC_RESOURCES=PASS';
rollback;
`;
}

function acceptanceResourceSql(identifiers, ownerMaterial, memberMaterial) {
  const owner = sqlUuid(identifiers.ownerUserId);
  const member = sqlUuid(identifiers.memberUserId);
  const ownerHash = sqlText(ownerMaterial.tokenHash, /^[0-9a-f]{64}$/u);
  const memberHash = sqlText(memberMaterial.tokenHash, /^[0-9a-f]{64}$/u);
  return String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
do $verify$
begin
  if to_regclass('public.mobile_push_registrations') is null then
    raise exception 'registration_table_missing';
  end if;
  if exists (
    select 1
      from public.mobile_push_registrations
     where user_id in (${owner}, ${member})
        or expo_token_hash in (${ownerHash}, ${memberHash})
  ) then
    raise exception 'synthetic_registration_not_clean';
  end if;
end
$verify$;
select 'MOBILE_PUSH_STAGING_INITIAL_CLEANUP=PASS';
rollback;
`;
}

function browserProbeSql({ role, userId, operation, identifiers, material }) {
  if (!new Set(["anon", "authenticated"]).has(role)) {
    fail("browser_probe_role_invalid");
  }
  if (!new Set(["select", "insert", "update", "delete"]).has(operation)) {
    fail("browser_probe_operation_invalid");
  }
  const workspace = sqlUuid(identifiers.workspaceId);
  const user = sqlUuid(userId);
  const project = sqlUuid(identifiers.easProjectId);
  const tokenHash = sqlText(material.tokenHash, /^[0-9a-f]{64}$/u);
  const tokenCiphertext = sqlText(
    material.tokenCiphertext,
    /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/u,
  );
  const statements = {
    select: `select id from public.mobile_push_registrations where user_id = ${user};`,
    insert: `insert into public.mobile_push_registrations (user_id, workspace_id, expo_token_ciphertext, expo_token_hash, expo_project_id, platform, status, expires_at) values (${user}, ${workspace}, ${tokenCiphertext}, ${tokenHash}, ${project}, 'android', 'active', now() + interval '30 days');`,
    update: `update public.mobile_push_registrations set last_seen_at = now() where user_id = ${user};`,
    delete: `delete from public.mobile_push_registrations where user_id = ${user};`,
  };
  const claims =
    role === "authenticated"
      ? `select set_config('request.jwt.claims', json_build_object('sub', ${user}, 'role', 'authenticated')::text, true);`
      : "";
  return String.raw`
\set ON_ERROR_STOP on
begin;
${claims}
set local role ${role};
${statements[operation]}
rollback;
`;
}

function roleCapabilitySql(role) {
  if (!new Set(["anon", "authenticated", "service_role"]).has(role)) {
    fail("role_capability_invalid");
  }
  return String.raw`
\set ON_ERROR_STOP on
begin;
set transaction read only;
set local role ${role};
select current_role;
rollback;
`;
}

function serviceRoleCrudSql(identifiers, ownerMaterial, memberMaterial) {
  const workspace = sqlUuid(identifiers.workspaceId);
  const owner = sqlUuid(identifiers.ownerUserId);
  const member = sqlUuid(identifiers.memberUserId);
  const project = sqlUuid(identifiers.easProjectId);
  const ownerHash = sqlText(ownerMaterial.tokenHash, /^[0-9a-f]{64}$/u);
  const memberHash = sqlText(memberMaterial.tokenHash, /^[0-9a-f]{64}$/u);
  const ownerCiphertext = sqlText(
    ownerMaterial.tokenCiphertext,
    /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/u,
  );
  const memberCiphertext = sqlText(
    memberMaterial.tokenCiphertext,
    /^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/u,
  );
  return String.raw`
\set ON_ERROR_STOP on
begin;
set local role service_role;

insert into public.mobile_push_registrations (
  user_id,
  workspace_id,
  expo_token_ciphertext,
  expo_token_hash,
  expo_project_id,
  platform,
  status,
  registered_at,
  last_seen_at,
  expires_at
) values
  (
    ${owner}, ${workspace}, ${ownerCiphertext}, ${ownerHash}, ${project},
    'android', 'active', now(), now(), now() + interval '30 days'
  ),
  (
    ${member}, ${workspace}, ${memberCiphertext}, ${memberHash}, ${project},
    'ios', 'active', now(), now(), now() + interval '30 days'
  );

do $verify_insert$
begin
  if (
    select count(*)
      from public.mobile_push_registrations
     where workspace_id = ${workspace}
       and user_id in (${owner}, ${member})
       and expo_project_id = ${project}
       and status = 'active'
  ) <> 2 then
    raise exception 'service_role_insert_failed';
  end if;
end
$verify_insert$;

update public.mobile_push_registrations
   set last_seen_at = registered_at + interval '1 minute',
       expires_at = registered_at + interval '30 days'
 where workspace_id = ${workspace}
   and user_id in (${owner}, ${member});

do $verify_update$
begin
  if (
    select count(*)
      from public.mobile_push_registrations
     where workspace_id = ${workspace}
       and user_id in (${owner}, ${member})
       and last_seen_at = registered_at + interval '1 minute'
  ) <> 2 then
    raise exception 'service_role_update_failed';
  end if;
end
$verify_update$;

delete from public.mobile_push_registrations
 where workspace_id = ${workspace}
   and user_id = ${owner};

do $verify_first_delete$
begin
  if exists (
    select 1
      from public.mobile_push_registrations
     where workspace_id = ${workspace}
       and user_id = ${owner}
  )
     or not exists (
       select 1
         from public.mobile_push_registrations
        where workspace_id = ${workspace}
          and user_id = ${member}
     ) then
    raise exception 'service_role_delete_failed';
  end if;
end
$verify_first_delete$;

delete from public.mobile_push_registrations
 where workspace_id = ${workspace}
   and user_id = ${member};

do $verify_final_delete$
begin
  if exists (
    select 1
      from public.mobile_push_registrations
     where workspace_id = ${workspace}
       and user_id in (${owner}, ${member})
  ) then
    raise exception 'service_role_cleanup_failed';
  end if;
end
$verify_final_delete$;

rollback;

begin;
set transaction read only;
do $verify_rollback$
begin
  if exists (
    select 1
      from public.mobile_push_registrations
     where user_id in (${owner}, ${member})
        or expo_token_hash in (${ownerHash}, ${memberHash})
  ) then
    raise exception 'service_role_rollback_failed';
  end if;
end
$verify_rollback$;
select 'MOBILE_PUSH_STAGING_SERVICE_ROLE_CRUD=PASS';
select 'MOBILE_PUSH_STAGING_ROLLBACK_CLEANUP=PASS';
rollback;
`;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = environment.PGPASSFILE?.trim();
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
      fail("passfile_changed");
    }
    snapshotDirectory = mkdtempSync(
      join(tmpdir(), "fanmind-mobile-push-staging-"),
    );
    const snapshotPath = join(snapshotDirectory, "pgpass");
    writeFileSync(snapshotPath, content, { mode: 0o600, flag: "wx" });
    return { snapshotDirectory, snapshotPath };
  } catch (error) {
    if (snapshotDirectory) {
      rmSync(snapshotDirectory, { recursive: true, force: true });
    }
    if (
      error instanceof Error &&
      error.message.startsWith("MOBILE_PUSH_STAGING_ACCEPTANCE_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read_failed");
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
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
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
  console.log("MOBILE_PUSH_STAGING_PSQL=available");
}

function runExpectedBrowserDenials({
  environment,
  passfilePath,
  identifiers,
  ownerMaterial,
  memberMaterial,
}) {
  const principals = [
    {
      role: "authenticated",
      userId: identifiers.ownerUserId,
      material: ownerMaterial,
    },
    {
      role: "authenticated",
      userId: identifiers.memberUserId,
      material: memberMaterial,
    },
    {
      role: "anon",
      userId: identifiers.ownerUserId,
      material: ownerMaterial,
    },
  ];
  for (const principal of principals) {
    for (const operation of ["select", "insert", "update", "delete"]) {
      const probe = runPsql(
        browserProbeSql({
          ...principal,
          operation,
          identifiers,
        }),
        environment,
        passfilePath,
      );
      if (probe.error || probe.status === 0) fail("browser_boundary_invalid");
    }
  }
  console.log("MOBILE_PUSH_STAGING_BROWSER_BOUNDARY=PASS");
}

async function runResourcePreflight(environment) {
  const evaluation = evaluateMobilePushStagingControlEnvironment(environment, {
    mode: "resource",
  });
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();

  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    const resource = runPsql(
      resourceSql(evaluation.syntheticIdentifiers),
      environment,
      snapshotPath,
    );
    if (
      resource.error ||
      resource.status !== 0 ||
      !resource.stdout.includes("MOBILE_PUSH_STAGING_SYNTHETIC_RESOURCES=PASS")
    ) {
      fail("synthetic_resources_invalid");
    }
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }

  console.log("MOBILE_PUSH_STAGING_SYNTHETIC_RESOURCES=PASS");
  console.log("MOBILE_PUSH_STAGING_RESOURCE_MODE=READ_ONLY");
  console.log("MOBILE_PUSH_STAGING_DELIVERY=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("MOBILE_PUSH_STAGING_RESOURCE_READINESS=PASS");
}

async function runAcceptance(environment) {
  const evaluation = evaluateMobilePushStagingControlEnvironment(environment, {
    mode: "acceptance",
  });
  if (!evaluation.ok) fail("environment_invalid");
  ensurePsqlAvailable();

  const identifiers = evaluation.syntheticIdentifiers;
  const ownerMaterial = buildSyntheticMobilePushMaterial(
    identifiers.deviceId,
    "owner",
  );
  const memberMaterial = buildSyntheticMobilePushMaterial(
    identifiers.deviceId,
    "member",
  );
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    for (const sql of [
      resourceSql(identifiers),
      acceptanceResourceSql(identifiers, ownerMaterial, memberMaterial),
    ]) {
      const resource = runPsql(sql, environment, snapshotPath);
      if (resource.error || resource.status !== 0) {
        fail("synthetic_resources_invalid");
      }
    }

    for (const role of ["anon", "authenticated", "service_role"]) {
      const capability = runPsql(
        roleCapabilitySql(role),
        environment,
        snapshotPath,
      );
      if (capability.error || capability.status !== 0) {
        fail("role_capability_invalid");
      }
    }

    runExpectedBrowserDenials({
      environment,
      passfilePath: snapshotPath,
      identifiers,
      ownerMaterial,
      memberMaterial,
    });

    const serviceRole = runPsql(
      serviceRoleCrudSql(identifiers, ownerMaterial, memberMaterial),
      environment,
      snapshotPath,
    );
    if (
      serviceRole.error ||
      serviceRole.status !== 0 ||
      !serviceRole.stdout.includes(
        "MOBILE_PUSH_STAGING_SERVICE_ROLE_CRUD=PASS",
      ) ||
      !serviceRole.stdout.includes(
        "MOBILE_PUSH_STAGING_ROLLBACK_CLEANUP=PASS",
      )
    ) {
      fail("service_role_crud_invalid");
    }
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }

  console.log("MOBILE_PUSH_STAGING_SYNTHETIC_RESOURCES=PASS");
  console.log("MOBILE_PUSH_STAGING_SERVICE_ROLE_CRUD=PASS");
  console.log("MOBILE_PUSH_STAGING_TRANSACTION=ROLLED_BACK");
  console.log("MOBILE_PUSH_STAGING_CLEANUP=PASS");
  console.log("MOBILE_PUSH_STAGING_DELIVERY=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("MOBILE_PUSH_STAGING_ACCEPTANCE=PASS");
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  if (mode === "--check") {
    const material = buildSyntheticMobilePushMaterial(
      "11111111-1111-4111-8111-111111111111",
      "owner",
    );
    if (
      !/^[0-9a-f]{64}$/u.test(material.tokenHash) ||
      !/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/u.test(
        material.tokenCiphertext,
      )
    ) {
      fail("offline_contract_invalid");
    }
    console.log("MOBILE_PUSH_STAGING_ACCEPTANCE_MODE=check");
    console.log("MOBILE_PUSH_STAGING_ACCEPTANCE_READY=YES");
    return;
  }
  if (mode === "--preflight") {
    console.log("MOBILE_PUSH_STAGING_ACCEPTANCE_MODE=preflight");
    await runResourcePreflight(process.env);
    return;
  }
  console.log("MOBILE_PUSH_STAGING_ACCEPTANCE_MODE=run");
  await runAcceptance(process.env);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^MOBILE_PUSH_STAGING_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(
        error.message,
      )
    ) {
      console.error(error.message);
    } else {
      console.error(
        "MOBILE_PUSH_STAGING_ACCEPTANCE_ERROR=unexpected_failure",
      );
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

export {
  acceptanceResourceSql,
  browserProbeSql,
  resourceSql,
  roleCapabilitySql,
  serviceRoleCrudSql,
};

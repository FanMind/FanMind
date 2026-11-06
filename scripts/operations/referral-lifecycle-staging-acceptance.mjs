#!/usr/bin/env node

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
  evaluateReferralStagingAcceptanceEnvironment,
} from "../../src/lib/referralStagingAcceptancePolicy.mjs";

const MAX_PASSFILE_BYTES = 64 * 1024;
const SAFE_DATABASE_FAILURES = new Set([
  "active_referral_snapshot_invalid",
  "cancellation_transition_invalid",
  "dedicated_synthetic_workspaces_invalid",
  "first_valid_click_guard_missing",
  "growth_window_auto_reopened",
  "growth_window_close_invalid",
  "immutable_attribution_guard_missing",
  "payment_failure_transition_invalid",
  "reactivation_transition_invalid",
  "referral_attribution_guard_missing",
  "referral_discount_cap_invalid",
  "referral_discount_intermediate_invalid",
  "referral_event_idempotency_invalid",
  "referral_setup_fee_changed",
  "referral_sync_rpc_missing",
  "refund_transition_invalid",
  "rollback_state_mismatch",
  "self_referral_guard_missing",
  "synthetic_workspace_overlap",
  "synthetic_workspace_owner_missing",
]);

function fail(code) {
  throw new Error(`REFERRAL_STAGING_ACCEPTANCE_ERROR=${code}`);
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

function sqlUuid(value) {
  const candidate = clean(value).toLowerCase();
  if (!UUID_PATTERN.test(candidate)) fail("synthetic_workspace_invalid");
  return `'${candidate}'::uuid`;
}

function digestExpression(primaryWorkspace, secondaryWorkspace) {
  return String.raw`md5(jsonb_build_object(
    'workspaces', coalesce((
      select jsonb_agg(to_jsonb(workspace) order by workspace.id)
        from public.workspaces as workspace
       where workspace.id in (${primaryWorkspace}, ${secondaryWorkspace})
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(to_jsonb(member) order by member.id)
        from public.referral_program_members as member
       where member.workspace_id in (${primaryWorkspace}, ${secondaryWorkspace})
    ), '[]'::jsonb),
    'referrals', coalesce((
      select jsonb_agg(to_jsonb(referral) order by referral.id)
        from public.referrals as referral
       where referral.referrer_workspace_id in (${primaryWorkspace}, ${secondaryWorkspace})
          or referral.referred_workspace_id in (${primaryWorkspace}, ${secondaryWorkspace})
    ), '[]'::jsonb),
    'snapshots', coalesce((
      select jsonb_agg(to_jsonb(snapshot) order by snapshot.id)
        from public.referral_discount_snapshots as snapshot
       where snapshot.workspace_id in (${primaryWorkspace}, ${secondaryWorkspace})
    ), '[]'::jsonb),
    'program', coalesce((
      select jsonb_agg(to_jsonb(state) order by state.id)
        from public.referral_program_state as state
    ), '[]'::jsonb)
  )::text)`;
}

export function buildReferralStagingAcceptanceSql(
  rawPrimaryWorkspaceId,
  rawSecondaryWorkspaceId,
) {
  const primaryWorkspace = sqlUuid(rawPrimaryWorkspaceId);
  const secondaryWorkspace = sqlUuid(rawSecondaryWorkspaceId);
  if (primaryWorkspace === secondaryWorkspace) fail("synthetic_workspace_overlap");
  const digest = digestExpression(primaryWorkspace, secondaryWorkspace);
  const referralCode = `fanmind-staging-${clean(rawPrimaryWorkspaceId)
    .toLowerCase()
    .replaceAll("-", "")}`;

  return String.raw`
\set ON_ERROR_STOP on
create temporary table fanmind_referral_original_state (
  state_digest text not null
) on commit preserve rows;

insert into fanmind_referral_original_state (state_digest)
select ${digest};

do $resource$
begin
  if to_regprocedure('public.sync_referral_for_workspace(uuid,text,text,text)') is null then
    raise exception 'referral_sync_rpc_missing';
  end if;
  if to_regprocedure('public.protect_referral_attribution()') is null then
    raise exception 'referral_attribution_guard_missing';
  end if;
  if ${primaryWorkspace} = ${secondaryWorkspace} then
    raise exception 'synthetic_workspace_overlap';
  end if;
  if (
    select count(*)
      from public.workspaces as workspace
     where workspace.id in (${primaryWorkspace}, ${secondaryWorkspace})
       and workspace.test_access_flags ->> 'staging_synthetic_fixture' = 'true'
       and workspace.stripe_customer_id is null
       and workspace.stripe_subscription_id is null
       and workspace.stripe_checkout_session_id is null
       and workspace.stripe_payment_intent_id is null
  ) <> 2 then
    raise exception 'dedicated_synthetic_workspaces_invalid';
  end if;
end
$resource$;

begin;
set local lock_timeout = '5s';
set local statement_timeout = '45s';

select 1
  from public.workspaces
 where id in (${primaryWorkspace}, ${secondaryWorkspace})
 order by id
 for update;

delete from public.referral_discount_snapshots
 where workspace_id in (${primaryWorkspace}, ${secondaryWorkspace});
delete from public.referrals
 where referrer_workspace_id in (${primaryWorkspace}, ${secondaryWorkspace})
    or referred_workspace_id in (${primaryWorkspace}, ${secondaryWorkspace});
delete from public.referral_program_members
 where workspace_id in (${primaryWorkspace}, ${secondaryWorkspace});

update public.workspaces
   set billing_status = 'active',
       commercial_option = 'starter_paid_setup',
       setup_fee_cents = 99000,
       monthly_fee_cents = 31200
 where id in (${primaryWorkspace}, ${secondaryWorkspace});

update public.referral_program_state
   set status = 'open',
       active_paid_workspace_cap = 2147483647,
       closed_at = null,
       updated_at = now(),
       admin_note = 'Rollback-only Referral Staging acceptance.';

insert into public.referral_program_members (
  workspace_id,
  referral_code,
  eligible,
  status,
  joined_at,
  admin_note
) values (
  ${primaryWorkspace},
  '${referralCode}',
  true,
  'active',
  now(),
  'Rollback-only Referral Staging acceptance.'
);

do $self_referral$
declare
  blocked boolean := false;
  synthetic_user_id uuid;
begin
  select owner_user_id into synthetic_user_id
    from public.workspaces
   where id = ${primaryWorkspace};
  if synthetic_user_id is null then
    raise exception 'synthetic_workspace_owner_missing';
  end if;
  begin
    insert into public.referrals (
      referrer_workspace_id,
      referrer_user_id,
      referred_workspace_id,
      referred_user_id,
      referral_code,
      status,
      created_during_program_status
    ) values (
      ${primaryWorkspace},
      synthetic_user_id,
      ${secondaryWorkspace},
      synthetic_user_id,
      '${referralCode}',
      'pending',
      'open'
    );
  exception when check_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'self_referral_guard_missing';
  end if;
end
$self_referral$;

insert into public.referrals (
  referrer_workspace_id,
  referred_workspace_id,
  referral_code,
  status,
  created_during_program_status,
  admin_note
) values (
  ${primaryWorkspace},
  ${secondaryWorkspace},
  '${referralCode}',
  'pending',
  'open',
  'Rollback-only Referral Staging acceptance.'
);

do $first_click$
declare
  blocked boolean := false;
begin
  begin
    insert into public.referrals (
      referrer_workspace_id,
      referred_workspace_id,
      referral_code,
      status,
      created_during_program_status
    ) values (
      ${primaryWorkspace},
      ${secondaryWorkspace},
      'fanmind-staging-second-click',
      'pending',
      'open'
    );
  exception when unique_violation then
    blocked := true;
  end;
  if not blocked then
    raise exception 'first_valid_click_guard_missing';
  end if;
end
$first_click$;

do $immutable$
declare
  referral_row public.referrals%rowtype;
  blocked boolean := false;
begin
  select * into referral_row
    from public.referrals
   where referred_workspace_id = ${secondaryWorkspace};
  begin
    update public.referrals
       set referral_code = 'fanmind-staging-mutated'
     where id = referral_row.id;
  exception when raise_exception then
    if sqlerrm = 'referral_attribution_immutable' then
      blocked := true;
    else
      raise;
    end if;
  end;
  if not blocked then
    raise exception 'immutable_attribution_guard_missing';
  end if;
end
$immutable$;

do $lifecycle$
declare
  sync_row record;
  referral_status text;
  snapshot_count integer;
  setup_fee integer;
begin
  select * into sync_row
    from public.sync_referral_for_workspace(
      ${secondaryWorkspace}, 'active',
      'evt_fanmind_staging_referral_active', 'invoice.paid'
    );
  if sync_row.referral_id is null
    or sync_row.active_referral_count <> 1
    or sync_row.discount_percent <> 5
    or sync_row.monthly_fee_cents_before_discount <> 31200
    or sync_row.monthly_discount_cents <> 1560
    or sync_row.monthly_fee_cents_after_discount <> 29640
    or sync_row.duplicate_event then
    raise exception 'active_referral_snapshot_invalid';
  end if;
  select setup_fee_cents into setup_fee
    from public.workspaces
   where id = ${primaryWorkspace};
  if setup_fee <> 99000 then
    raise exception 'referral_setup_fee_changed';
  end if;

  select * into sync_row
    from public.sync_referral_for_workspace(
      ${secondaryWorkspace}, 'active',
      'evt_fanmind_staging_referral_active', 'invoice.paid'
    );
  select count(*) into snapshot_count
    from public.referral_discount_snapshots
   where workspace_id = ${primaryWorkspace}
     and source_event_id = 'evt_fanmind_staging_referral_active';
  if not sync_row.duplicate_event or snapshot_count <> 1 then
    raise exception 'referral_event_idempotency_invalid';
  end if;

  perform * from public.sync_referral_for_workspace(
    ${secondaryWorkspace}, 'payment_failed',
    'evt_fanmind_staging_referral_failed', 'invoice.payment_failed'
  );
  select status into referral_status from public.referrals
   where referred_workspace_id = ${secondaryWorkspace};
  if referral_status <> 'inactive' then
    raise exception 'payment_failure_transition_invalid';
  end if;

  perform * from public.sync_referral_for_workspace(
    ${secondaryWorkspace}, 'active',
    'evt_fanmind_staging_referral_before_cancel', 'invoice.paid'
  );
  perform * from public.sync_referral_for_workspace(
    ${secondaryWorkspace}, 'cancelled',
    'evt_fanmind_staging_referral_cancelled', 'customer.subscription.deleted'
  );
  select status into referral_status from public.referrals
   where referred_workspace_id = ${secondaryWorkspace};
  if referral_status <> 'inactive' then
    raise exception 'cancellation_transition_invalid';
  end if;

  perform * from public.sync_referral_for_workspace(
    ${secondaryWorkspace}, 'active',
    'evt_fanmind_staging_referral_before_refund', 'invoice.paid'
  );
  perform * from public.sync_referral_for_workspace(
    ${secondaryWorkspace}, 'refunded',
    'evt_fanmind_staging_referral_refunded', 'charge.refunded'
  );
  select status into referral_status from public.referrals
   where referred_workspace_id = ${secondaryWorkspace};
  if referral_status <> 'inactive' then
    raise exception 'refund_transition_invalid';
  end if;

  select * into sync_row
    from public.sync_referral_for_workspace(
      ${secondaryWorkspace}, 'active',
      'evt_fanmind_staging_referral_reactivated', 'invoice.paid'
    );
  if sync_row.discount_percent <> 5
    or sync_row.monthly_discount_cents <> 1560
    or sync_row.monthly_fee_cents_after_discount <> 29640 then
    raise exception 'reactivation_transition_invalid';
  end if;

  update public.referral_program_members
     set override_active_referral_count = 5,
         override_discount_percent = null
   where workspace_id = ${primaryWorkspace};
  select * into sync_row
    from public.sync_referral_for_workspace(
      ${secondaryWorkspace}, 'active',
      'evt_fanmind_staging_referral_intermediate', 'manual_reconcile'
    );
  if sync_row.discount_percent <> 25
    or sync_row.monthly_discount_cents <> 7800
    or sync_row.monthly_fee_cents_after_discount <> 23400 then
    raise exception 'referral_discount_intermediate_invalid';
  end if;

  update public.referral_program_members
     set override_active_referral_count = 20,
         override_discount_percent = null
   where workspace_id = ${primaryWorkspace};
  select * into sync_row
    from public.sync_referral_for_workspace(
      ${secondaryWorkspace}, 'active',
      'evt_fanmind_staging_referral_cap', 'manual_reconcile'
    );
  if sync_row.discount_percent <> 100
    or sync_row.monthly_fee_cents_before_discount <> 31200
    or sync_row.monthly_discount_cents <> 31200
    or sync_row.monthly_fee_cents_after_discount <> 0 then
    raise exception 'referral_discount_cap_invalid';
  end if;
end
$lifecycle$;

do $growth_window$
declare
  state_row public.referral_program_state%rowtype;
begin
  update public.referral_program_state
     set status = 'open',
         active_paid_workspace_cap = 1,
         closed_at = null;
  state_row := public.refresh_referral_program_state('staging_cap_acceptance');
  if state_row.status <> 'closed'
    or state_row.active_paid_workspace_count < 1 then
    raise exception 'growth_window_close_invalid';
  end if;

  update public.referral_program_state
     set active_paid_workspace_cap = 2147483647;
  state_row := public.refresh_referral_program_state('staging_no_auto_reopen');
  if state_row.status <> 'closed' then
    raise exception 'growth_window_auto_reopened';
  end if;
end
$growth_window$;

rollback;

do $rollback_verify$
begin
  if not exists (
    select 1
      from fanmind_referral_original_state as original
     where original.state_digest = ${digest}
  ) then
    raise exception 'rollback_state_mismatch';
  end if;
end
$rollback_verify$;

select 'REFERRAL_STAGING_ATTRIBUTION=PASS';
select 'REFERRAL_STAGING_LIFECYCLE_CASES=6';
select 'REFERRAL_STAGING_IDEMPOTENCY=PASS';
select 'REFERRAL_STAGING_DISCOUNT_CAP=PASS';
select 'REFERRAL_STAGING_GROWTH_WINDOW=PASS';
select 'REFERRAL_STAGING_ROLLBACK=PASS';
select 'REFERRAL_STAGING_PROVIDER_CALLS=0';
drop table fanmind_referral_original_state;
`;
}

function privatePassfileSnapshot(environment) {
  const sourcePath = clean(environment.PGPASSFILE);
  if (!sourcePath || !isAbsolute(sourcePath)) fail("passfile_missing");

  let descriptor;
  let snapshotDirectory;
  let content;
  try {
    descriptor = openSync(sourcePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const opened = fstatSync(descriptor);
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
        descriptor,
        content,
        offset,
        content.length - offset,
        offset,
      );
      if (bytesRead === 0) fail("passfile_read_failed");
      offset += bytesRead;
    }
    const settled = fstatSync(descriptor);
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
      join(tmpdir(), "fanmind-referral-staging-"),
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
      error.message.startsWith("REFERRAL_STAGING_ACCEPTANCE_ERROR=")
    ) {
      throw error;
    }
    fail("passfile_read_failed");
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

function psqlEnvironment(environment, passfilePath) {
  const safe = {
    ...environment,
    PGPASSFILE: passfilePath,
    PGCONNECT_TIMEOUT: "10",
  };
  for (const key of [
    "DATABASE_URL",
    "POSTGRES_URL",
    "SUPABASE_DB_URL",
    "PGPASSWORD",
    "PGHOSTADDR",
    "PGSERVICE",
    "PGSERVICEFILE",
    "PGSYSCONFDIR",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
  ]) {
    delete safe[key];
  }
  return safe;
}

function ensurePsqlAvailable() {
  const result = spawnSync("psql", ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error || result.status !== 0) fail("psql_unavailable");
  console.log("REFERRAL_STAGING_PSQL=available");
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

export function referralAcceptanceFailureCode(stderr) {
  const output = typeof stderr === "string" ? stderr : "";
  for (const code of SAFE_DATABASE_FAILURES) {
    if (output.includes(code)) return code;
  }
  return "database_acceptance_failed";
}

function runAcceptance(environment) {
  const policy = evaluateReferralStagingAcceptanceEnvironment(environment);
  if (!policy.ok) fail("environment_invalid");
  ensurePsqlAvailable();
  const { snapshotDirectory, snapshotPath } =
    privatePassfileSnapshot(environment);
  try {
    const sql = buildReferralStagingAcceptanceSql(
      environment.FANMIND_STAGING_E2E_WORKSPACE_ID,
      environment.FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID,
    );
    const result = runPsql(sql, environment, snapshotPath);
    const markers = [
      "REFERRAL_STAGING_ATTRIBUTION=PASS",
      "REFERRAL_STAGING_LIFECYCLE_CASES=6",
      "REFERRAL_STAGING_IDEMPOTENCY=PASS",
      "REFERRAL_STAGING_DISCOUNT_CAP=PASS",
      "REFERRAL_STAGING_GROWTH_WINDOW=PASS",
      "REFERRAL_STAGING_ROLLBACK=PASS",
      "REFERRAL_STAGING_PROVIDER_CALLS=0",
    ];
    if (
      result.error ||
      result.status !== 0 ||
      markers.some((marker) => !result.stdout.includes(marker))
    ) {
      fail(referralAcceptanceFailureCode(result.stderr));
    }
    for (const marker of markers) console.log(marker);
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  } finally {
    rmSync(snapshotDirectory, { recursive: true, force: true });
  }
}

async function main() {
  const mode = modeFromArguments(process.argv.slice(2));
  if (mode === "--check") {
    console.log("REFERRAL_STAGING_ACCEPTANCE_MODE=check");
    console.log("REFERRAL_STAGING_ACCEPTANCE_READY=YES");
    return;
  }
  console.log("REFERRAL_STAGING_ACCEPTANCE_MODE=run");
  runAcceptance(process.env);
  console.log("REFERRAL_STAGING_ACCEPTANCE_READY=YES");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    if (
      error instanceof Error &&
      /^REFERRAL_STAGING_ACCEPTANCE_ERROR=[a-z0-9_]+$/u.test(error.message)
    ) {
      console.error(error.message);
    } else {
      console.error("REFERRAL_STAGING_ACCEPTANCE_ERROR=unexpected_failure");
    }
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 1;
  });
}

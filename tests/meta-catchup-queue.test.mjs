import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  isMetaCatchupQueueEnabled,
  normalizeMetaCatchupWorkerResponse,
  retrySecondsForMetaCatchupAttempt,
  validateMetaCatchupWorkerRequestBody,
} from "../src/lib/metaCatchupQueuePolicy.mjs";
import {
  META_CATCHUP_QUEUE_APPLY_CONFIRMATION,
  META_CATCHUP_QUEUE_VERIFY_CONFIRMATION,
  evaluateMetaCatchupQueueStagingEnvironment,
} from "../src/lib/metaCatchupQueueStagingPolicy.mjs";
import {
  EXPECTED_MIGRATION_SHA256,
  POSTFLIGHT_SQL,
  evaluateMetaCatchupQueueMigrationSql,
} from "../scripts/operations/meta-catchup-queue-migration-runner.mjs";
import {
  metaCatchupPollMs,
  normalizeClaimedMetaCatchupJob,
  normalizeMetaCatchupWorkerError,
  normalizeMetaCatchupWorkerId,
} from "../scripts/operations/meta-catchup-worker.mjs";

const sql = await readFile(
  new URL(
    "../supabase/controlled/20260811230000_meta_conversation_catchup_queue.sql",
    import.meta.url,
  ),
  "utf8",
);
const webhook = await readFile(
  new URL("../src/lib/metaWebhook.ts", import.meta.url),
  "utf8",
);
const route = await readFile(
  new URL("../src/app/api/internal/meta-catchup/route.ts", import.meta.url),
  "utf8",
);
const server = await readFile(
  new URL("../src/lib/supabase/server.ts", import.meta.url),
  "utf8",
);
const worker = await readFile(
  new URL("../scripts/operations/meta-catchup-worker.mjs", import.meta.url),
  "utf8",
);
const verifyWorkflow = await readFile(
  new URL("../.github/workflows/meta-catchup-queue-staging-verify.yml", import.meta.url),
  "utf8",
);
const applyWorkflow = await readFile(
  new URL("../.github/workflows/meta-catchup-queue-staging-apply.yml", import.meta.url),
  "utf8",
);

const JOB_ID = "11111111-1111-4111-8111-111111111111";
const LEASE_TOKEN = "22222222-2222-4222-8222-222222222222";
const WORKER_ID = "fanmind-staging-meta-catchup";
const COMMIT = "a".repeat(40);

function stagingEnvironment(mode = "verify") {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "staging",
    NEXT_PUBLIC_APP_URL: "https://staging.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://stagingref.supabase.co",
    FANMIND_TARGET_API_ORIGIN: "https://staging.fanmind.example",
    FANMIND_PRODUCTION_API_ORIGIN: "https://fanmind.ch",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: mode === "apply" ? "true" : "false",
    FANMIND_NON_PRODUCTION_WRITE_ACK:
      mode === "apply" ? "I_UNDERSTAND_NON_PRODUCTION_ONLY" : "",
    FANMIND_META_CATCHUP_QUEUE_REVIEWED_COMMIT: COMMIT,
    FANMIND_META_CATCHUP_QUEUE_VERIFY_CONFIRM:
      mode === "verify" ? META_CATCHUP_QUEUE_VERIFY_CONFIRMATION : "",
    FANMIND_META_CATCHUP_QUEUE_APPLY_CONFIRM:
      mode === "apply" ? META_CATCHUP_QUEUE_APPLY_CONFIRMATION : "",
    GITHUB_REF: "refs/heads/main",
    GITHUB_SHA: COMMIT,
    PGHOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_TARGET_DB_HOST: "aws-0-eu-central-1.pooler.supabase.com",
    FANMIND_PRODUCTION_DB_HOST: "aws-0-eu-west-1.pooler.supabase.com",
    PGPORT: "5432",
    PGDATABASE: "postgres",
    PGUSER: "postgres.stagingref",
    PGSSLMODE: "verify-full",
    PGSSLROOTCERT: "/etc/ssl/certs/ca-certificates.crt",
  };
}

test("Meta webhook persists and coalesces catch-up work without provider history calls", () => {
  assert.match(webhook, /createMetaWebhookConversationMessage/u);
  assert.match(webhook, /enqueueMetaConversationCatchup/u);
  assert.match(webhook, /isMetaCatchupQueueEnabled/u);
  assert.match(webhook, /stored_catchup_queued/u);
  assert.doesNotMatch(webhook, /fetchFacebookMessengerProfile/u);
  assert.doesNotMatch(webhook, /syncFacebookMessengerConversationForContact/u);
  assert.doesNotMatch(webhook, /syncInstagramMessengerConversationForContact/u);
  assert.doesNotMatch(webhook, /Facebook Nutzer.*senderId/u);
  assert.match(server, /rpc\/enqueue_meta_conversation_catchup/u);
});

test("controlled SQL scopes, coalesces, leases, retries, and dead-letters jobs", () => {
  assert.match(sql, /foreign key \(social_connection_id, workspace_id\)[\s\S]*references public\.social_connections \(id, workspace_id\)/u);
  assert.match(sql, /foreign key \(contact_id, workspace_id\)[\s\S]*references public\.contacts \(id, workspace_id\)/u);
  assert.match(sql, /force row level security/u);
  assert.match(sql, /where status in \('pending', 'claimed', 'retry'\)/u);
  assert.match(sql, /on conflict[\s\S]*generation = job\.generation \+ 1/u);
  assert.match(sql, /attempt_count = job\.attempt_count,[\s\S]*generation = job\.generation \+ 1/u);
  assert.match(sql, /for update skip locked/u);
  assert.match(sql, /attempt_count < 5/u);
  assert.match(sql, /when p_outcome = 'retry' and claimed_job\.attempt_count < 5 then 'retry'/u);
  assert.match(sql, /else 'dead_letter'/u);
  assert.match(sql, /claimed_job\.generation > claimed_job\.claimed_generation then 'pending'/u);
  assert.match(sql, /job\.generation > job\.claimed_generation then 'pending'[\s\S]*job\.attempt_count >= 5/u);
  assert.match(sql, /p_outcome = 'retry'[\s\S]*claimed_job\.generation > claimed_job\.claimed_generation then 'pending'/u);
  assert.match(sql, /auth\.role\(\) is distinct from 'service_role'/u);
  assert.match(sql, /grant select on table public\.meta_conversation_catchup_jobs to service_role/u);
  assert.doesNotMatch(sql, /admin_operation_jobs|backup_runs/u);
});

test("controlled migration is checksum-pinned and postflight is read-only with rollback", () => {
  const result = evaluateMetaCatchupQueueMigrationSql(sql);
  assert.equal(result.digest, EXPECTED_MIGRATION_SHA256);
  assert.match(POSTFLIGHT_SQL, /set transaction read only/u);
  assert.match(POSTFLIGHT_SQL, /relrowsecurity[\s\S]*relforcerowsecurity/u);
  assert.match(POSTFLIGHT_SQL, /queue_coalescing_index_invalid/u);
  assert.match(POSTFLIGHT_SQL, /confrelid =[\s\S]*'public\.social_connections'::regclass/u);
  assert.match(POSTFLIGHT_SQL, /conkey = array\[[\s\S]*social_connection_id[\s\S]*workspace_id/u);
  assert.match(POSTFLIGHT_SQL, /confkey = array\[[\s\S]*'public\.contacts'::regclass[\s\S]*workspace_id/u);
  assert.match(POSTFLIGHT_SQL, /confdeltype = 'c'[\s\S]*confdeltype = 'a'/u);
  assert.match(POSTFLIGHT_SQL, /has_function_privilege\('service_role'/u);
  assert.match(POSTFLIGHT_SQL, /rollback;/u);
});

test("queue activation is explicit and defaults off", () => {
  assert.equal(isMetaCatchupQueueEnabled({}), false);
  assert.equal(
    isMetaCatchupQueueEnabled({ FANMIND_META_CATCHUP_QUEUE_ENABLED: "true" }),
    true,
  );
  assert.equal(
    isMetaCatchupQueueEnabled({ FANMIND_META_CATCHUP_QUEUE_ENABLED: "TRUE" }),
    false,
  );
});

test("worker request and response contracts reject identifiers and free-form errors", () => {
  assert.equal(
    validateMetaCatchupWorkerRequestBody({
      jobId: JOB_ID,
      workerId: WORKER_ID,
      leaseToken: LEASE_TOKEN,
    }).ok,
    true,
  );
  assert.equal(
    validateMetaCatchupWorkerRequestBody({
      jobId: "not-a-job",
      workerId: WORKER_ID,
      leaseToken: LEASE_TOKEN,
    }).ok,
    false,
  );
  assert.deepEqual(normalizeMetaCatchupWorkerResponse({ disposition: "success", errorCode: null }), {
    disposition: "success",
    errorCode: null,
  });
  assert.equal(
    normalizeMetaCatchupWorkerResponse({ disposition: "retry", errorCode: "raw provider error" }),
    null,
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map(retrySecondsForMetaCatchupAttempt),
    [30, 120, 600, 1800, 3600],
  );
});

test("worker accepts one exact lease and logs no job or provider identifiers", () => {
  assert.deepEqual(
    normalizeClaimedMetaCatchupJob(
      {
        id: JOB_ID,
        lease_token: LEASE_TOKEN,
        worker_id: WORKER_ID,
        status: "claimed",
        attempt_count: 2,
      },
      WORKER_ID,
    ),
    { id: JOB_ID, leaseToken: LEASE_TOKEN, attemptCount: 2 },
  );
  assert.equal(
    normalizeClaimedMetaCatchupJob(
      {
        id: JOB_ID,
        lease_token: LEASE_TOKEN,
        worker_id: "different-worker",
        status: "claimed",
        attempt_count: 2,
      },
      WORKER_ID,
    ),
    null,
  );
  assert.match(worker, /finish_meta_conversation_catchup_job/u);
  assert.doesNotMatch(worker, /\.\.\/\.\.\/src\//u);
  assert.doesNotMatch(worker, /safe\.(?:job|workspace|connection|sender|thread)/u);
  assert.match(worker, /safe\.attempt_count/u);
  assert.match(worker, /safe\.error_code/u);
  assert.equal(metaCatchupPollMs({ FANMIND_META_CATCHUP_POLL_MS: "1000" }), 1000);
  assert.match(normalizeMetaCatchupWorkerId("", "Staging Host", 42), /^fanmind-staging-host-42-meta-catchup$/u);
  assert.equal(normalizeMetaCatchupWorkerError(new Error("provider said token=secret")), "catchup_request_failed");
});

test("internal route fails closed for entitlement and exact connection scope", () => {
  assert.match(route, /FANMIND_META_CATCHUP_WORKER_SECRET/u);
  assert.match(route, /timingSafeTextEqual/u);
  assert.match(route, /readBoundedJsonRequest/u);
  assert.match(route, /getClaimedMetaConversationCatchupJob/u);
  assert.match(route, /getWorkspaceProcessingEntitlement/u);
  assert.match(route, /workerResult\("cancelled", "entitlement_unavailable"\)/u);
  assert.match(route, /candidate\.id === job\.social_connection_id/u);
  assert.match(route, /candidate\.workspace_id === job\.workspace_id/u);
  assert.match(route, /candidate\.status === "connected"/u);
  assert.match(route, /revalidate: false/u);
  assert.doesNotMatch(route, /analysis|reply suggestion|sendMessage|send-message/iu);
});

test("Staging verify/apply controls are main-commit bound and production rejecting", () => {
  assert.equal(
    evaluateMetaCatchupQueueStagingEnvironment(stagingEnvironment("verify"), {
      mode: "verify",
    }).ok,
    true,
  );
  assert.equal(
    evaluateMetaCatchupQueueStagingEnvironment(stagingEnvironment("apply"), {
      mode: "apply",
    }).ok,
    true,
  );
  const productionTarget = stagingEnvironment("apply");
  productionTarget.NEXT_PUBLIC_APP_URL = "https://fanmind.ch";
  productionTarget.FANMIND_TARGET_API_ORIGIN = "https://fanmind.ch";
  productionTarget.FANMIND_TARGET_SUPABASE_PROJECT_REF = "productionref";
  productionTarget.NEXT_PUBLIC_SUPABASE_URL = "https://productionref.supabase.co";
  assert.equal(
    evaluateMetaCatchupQueueStagingEnvironment(productionTarget, { mode: "apply" }).ok,
    false,
  );
  assert.match(verifyWorkflow, /workflow_dispatch/u);
  assert.match(verifyWorkflow, /github\.ref == 'refs\/heads\/main'/u);
  assert.match(verifyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(applyWorkflow, /workflow_dispatch/u);
  assert.match(applyWorkflow, /inputs\.reviewed_commit == github\.sha/u);
  assert.match(applyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'true'/u);
  assert.match(applyWorkflow, /npm run db:staging-rollout-state:run/u);
  assert.match(applyWorkflow, /FANMIND_ENABLE_NON_PRODUCTION_WRITES: 'false'/u);
  assert.match(applyWorkflow, /STAGING_DATABASE_ROLLOUT_META_CATCHUP=apply/u);
  assert.match(applyWorkflow, /STAGING_DATABASE_ROLLOUT_STATE=PASS/u);
  assert.doesNotMatch(applyWorkflow, /FANMIND_META_CATCHUP_QUEUE_ENABLED/u);
});

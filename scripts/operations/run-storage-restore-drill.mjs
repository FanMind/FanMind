#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  evaluateEnvironmentBoundary,
} from "../../src/lib/environmentBoundaryPolicy.mjs";
import {
  extractTar,
  safeManifestPath,
  verifyStorageManifest,
} from "./verify-backup-artifact.mjs";
import {
  verifyStorageRestoreReceipt,
} from "./verify-full-backup-storage-restore-receipt.mjs";

export const STORAGE_RESTORE_CONFIRMATION = "run-isolated-storage-restore";
export const STORAGE_TARGET_ACKNOWLEDGEMENT =
  "I_UNDERSTAND_EMPTY_DISPOSABLE_STORAGE_ONLY";

const SHA256 = /^[0-9a-f]{64}$/u;
const COMMIT = /^[0-9a-f]{40}$/u;
const PROJECT_REF = /^[a-z0-9]{8,40}$/u;
const STORAGE_BUCKET = "fanmind-assets";
const PAGE_SIZE = 100;
const MAX_MANIFEST_BYTES = 16 * 1024 * 1024;
const MAX_OBJECTS = 200_000;

function fixedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function encodeObjectPath(path) {
  return path.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function sortedObjects(files) {
  return [...files]
    .map((entry) => ({
      path: entry.path,
      size: entry.size,
      sha256: entry.sha256,
      contentType: clean(entry.content_type) || "application/octet-stream",
    }))
    .sort((left, right) =>
      Buffer.compare(Buffer.from(left.path, "utf8"), Buffer.from(right.path, "utf8")),
    );
}

function assertEnvironment(environment) {
  const boundary = evaluateEnvironmentBoundary(environment, { allowWrite: true });
  if (!boundary.ok) throw fixedError("storage_restore_environment_boundary_blocked");
  if (clean(environment.FANMIND_STORAGE_RESTORE_CONFIRM)
      !== STORAGE_RESTORE_CONFIRMATION) {
    throw fixedError("storage_restore_confirmation_invalid");
  }
  if (clean(environment.FANMIND_STORAGE_RESTORE_TARGET_ACK)
      !== STORAGE_TARGET_ACKNOWLEDGEMENT) {
    throw fixedError("storage_restore_target_ack_invalid");
  }
  const targetRef = clean(environment.FANMIND_TARGET_SUPABASE_PROJECT_REF);
  const productionRef = clean(environment.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF);
  const stagingRef = clean(environment.FANMIND_STAGING_SUPABASE_PROJECT_REF);
  if (!PROJECT_REF.test(targetRef) || !PROJECT_REF.test(productionRef)
      || !PROJECT_REF.test(stagingRef)) {
    throw fixedError("storage_restore_project_ref_invalid");
  }
  if (targetRef === productionRef || targetRef === stagingRef
      || productionRef === stagingRef) {
    throw fixedError("storage_restore_project_boundary_invalid");
  }
  const targetUrl = new URL(clean(environment.NEXT_PUBLIC_SUPABASE_URL));
  if (targetUrl.hostname !== `${targetRef}.supabase.co`) {
    throw fixedError("storage_restore_target_url_invalid");
  }
  if (clean(environment.FANMIND_RESTORE_STORAGE_BUCKET) !== STORAGE_BUCKET) {
    throw fixedError("storage_restore_bucket_invalid");
  }
  const serviceKey = clean(environment.FANMIND_RESTORE_SUPABASE_SERVICE_ROLE_KEY);
  if (!serviceKey) throw fixedError("storage_restore_service_key_missing");
  const reviewedCommit = clean(environment.FANMIND_RESTORE_REVIEWED_COMMIT);
  if (!COMMIT.test(reviewedCommit)
      || clean(environment.GITHUB_SHA) !== reviewedCommit
      || clean(environment.GITHUB_REF) !== "refs/heads/main") {
    throw fixedError("storage_restore_reviewed_commit_invalid");
  }
  return {
    baseUrl: targetUrl.origin,
    targetRef,
    serviceKey,
    reviewedCommit,
  };
}

async function apiRequest(client, path, options = {}) {
  const response = await client.fetchImpl(`${client.baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${client.serviceKey}`,
      apikey: client.serviceKey,
      ...options.headers,
    },
  });
  if (!response?.ok) {
    const error = fixedError(`storage_api_${options.label ?? "request"}_failed`);
    error.requestOutcome = "rejected";
    throw error;
  }
  return response;
}

async function listPage(client, bucket, prefix, offset) {
  const response = await apiRequest(
    client,
    `/storage/v1/object/list/${encodeURIComponent(bucket)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        prefix,
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      }),
      label: "list",
    },
  );
  const rows = await response.json();
  if (!Array.isArray(rows)) throw fixedError("storage_api_list_response_invalid");
  return {
    objects: rows.filter((item) => item?.name !== ".emptyFolderPlaceholder"),
    rawCount: rows.length,
  };
}

async function listObjects(client, bucket, prefix = "", output = [], seen = new Set()) {
  for (let offset = 0, guard = 0; ; offset += PAGE_SIZE, guard += 1) {
    if (guard > Math.ceil(MAX_OBJECTS / PAGE_SIZE)) {
      throw fixedError("storage_restore_pagination_guard_exceeded");
    }
    const page = await listPage(client, bucket, prefix, offset);
    for (const item of page.objects) {
      if (!item || typeof item.name !== "string" || !item.name) {
        throw fixedError("storage_api_list_item_invalid");
      }
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      const folder = !item.id && item.metadata == null;
      if (folder) {
        await listObjects(client, bucket, path, output, seen);
        continue;
      }
      if (seen.has(path)) throw fixedError("storage_restore_remote_path_duplicate");
      seen.add(path);
      output.push(path);
      if (output.length > MAX_OBJECTS) {
        throw fixedError("storage_restore_object_limit_exceeded");
      }
    }
    if (page.rawCount < PAGE_SIZE) break;
  }
  return output.sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
}

async function assertPrivateBucket(client, bucket) {
  const response = await apiRequest(
    client,
    `/storage/v1/bucket/${encodeURIComponent(bucket)}`,
    { method: "GET", label: "bucket" },
  );
  const record = await response.json();
  if (record?.id !== bucket || record?.name !== bucket || record?.public !== false) {
    throw fixedError("storage_restore_bucket_contract_invalid");
  }
}

async function uploadObject(client, bucket, root, object) {
  const path = safeManifestPath(root, object.path);
  const bytes = await readFile(path);
  try {
    if (bytes.length !== object.size || sha256(bytes) !== object.sha256) {
      throw fixedError("storage_restore_local_object_changed");
    }
    try {
      await apiRequest(
        client,
        `/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(object.path)}`,
        {
          method: "POST",
          headers: {
            "content-type": object.contentType,
            "content-length": String(bytes.length),
            "x-upsert": "false",
          },
          body: bytes,
          label: "upload",
        },
      );
    } catch (error) {
      if (error?.requestOutcome !== "rejected") {
        error.requestOutcome = "indeterminate";
      }
      throw error;
    }
  } finally {
    bytes.fill(0);
  }
}

async function removeObjects(client, bucket, paths) {
  for (let index = 0; index < paths.length; index += 1000) {
    const prefixes = paths.slice(index, index + 1000);
    await apiRequest(client, `/storage/v1/object/${encodeURIComponent(bucket)}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prefixes }),
      label: "rollback",
    });
  }
}

async function hashResponse(response) {
  if (!response.body?.getReader) throw fixedError("storage_download_stream_invalid");
  const hash = createHash("sha256");
  let size = 0;
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = Buffer.from(value);
    size += chunk.length;
    hash.update(chunk);
    chunk.fill(0);
  }
  return { size, sha256: hash.digest("hex") };
}

async function verifyRemoteObject(client, bucket, object) {
  const response = await apiRequest(
    client,
    `/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectPath(object.path)}`,
    { method: "GET", label: "download" },
  );
  const actual = await hashResponse(response);
  if (actual.size !== object.size || actual.sha256 !== object.sha256) {
    throw fixedError("storage_restore_postwrite_object_mismatch");
  }
}

export async function writePrivateReceipt(
  path,
  receipt,
  { openFile = open, removeFile = rm } = {},
) {
  if (!path || resolve(path) !== path) {
    throw fixedError("storage_restore_receipt_path_invalid");
  }
  const parent = dirname(path);
  const metadata = await lstat(parent).catch(() => null);
  if (!metadata?.isDirectory() || metadata.uid !== process.getuid()
      || (metadata.mode & 0o077) !== 0) {
    throw fixedError("storage_restore_receipt_parent_invalid");
  }
  let handle;
  let created = false;
  let failure = null;
  try {
    handle = await openFile(
      path,
      fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW,
      0o600,
    );
    created = true;
    await handle.writeFile(`${JSON.stringify(receipt)}\n`);
    await handle.sync();
  } catch (error) {
    failure = error?.code === "EEXIST"
      ? fixedError("storage_restore_receipt_exists")
      : error;
  } finally {
    try {
      await handle?.close();
    } catch (error) {
      failure ??= error;
    }
    if (failure && created) {
      try {
        await removeFile(path, { force: true });
      } catch {
        throw fixedError("storage_restore_receipt_reconciliation_required");
      }
    }
  }
  if (failure) throw failure;
}

function assertExpected(value, pattern, code) {
  if (!pattern.test(clean(value))) throw fixedError(code);
  return clean(value);
}

export async function runStorageRestore({
  environment = process.env,
  archivePath,
  receiptPath,
  resultReceiptPath,
  expectedSourceArtifactBasename,
  expectedOuterSha256,
  expectedProductionCommit,
  expectedStoragePartEncryptedSha256,
  fetchImpl = fetch,
  tarBin = "tar",
  cleanupImpl = rm,
  receiptWriter = writePrivateReceipt,
}) {
  const binding = assertEnvironment(environment);
  const expected = {
    sourceArtifactBasename: clean(expectedSourceArtifactBasename),
    outerSha256: assertExpected(expectedOuterSha256, SHA256,
      "storage_restore_expected_outer_sha_invalid"),
    productionCommit: assertExpected(expectedProductionCommit, COMMIT,
      "storage_restore_expected_production_commit_invalid"),
    storagePartEncryptedSha256: assertExpected(
      expectedStoragePartEncryptedSha256,
      SHA256,
      "storage_restore_expected_part_sha_invalid",
    ),
  };
  if (!/^fanmind-full-\d{13}\.tar\.gz\.age$/u.test(expected.sourceArtifactBasename)) {
    throw fixedError("storage_restore_expected_artifact_invalid");
  }
  const firstVerification = await verifyStorageRestoreReceipt({
    receiptPath,
    archivePath,
    expectedSourceArtifactBasename: expected.sourceArtifactBasename,
    expectedOuterSha256: expected.outerSha256,
    expectedProductionCommit: expected.productionCommit,
    expectedStoragePartEncryptedSha256: expected.storagePartEncryptedSha256,
  });
  const temporaryRoot = await mkdtemp(join(tmpdir(), "fanmind-storage-restore-"));
  await chmod(temporaryRoot, 0o700);
  const snapshotPath = join(temporaryRoot, "verified-storage.tar.gz");
  const extractRoot = join(temporaryRoot, "extracted");
  const attemptedUploads = [];
  let result = null;
  let operationError = null;
  const client = {
    baseUrl: binding.baseUrl,
    serviceKey: binding.serviceKey,
    fetchImpl,
  };
  try {
    await copyFile(archivePath, snapshotPath, fsConstants.COPYFILE_EXCL);
    await chmod(snapshotPath, 0o600);
    await verifyStorageRestoreReceipt({
      receiptPath,
      archivePath: snapshotPath,
      expectedSourceArtifactBasename: expected.sourceArtifactBasename,
      expectedOuterSha256: expected.outerSha256,
      expectedProductionCommit: expected.productionCommit,
      expectedStoragePartEncryptedSha256: expected.storagePartEncryptedSha256,
    });
    await mkdir(extractRoot, { mode: 0o700 });
    await extractTar(snapshotPath, extractRoot, tarBin);
    const manifestPath = safeManifestPath(extractRoot, "manifest.json");
    const manifestBytes = await readFile(manifestPath);
    if (manifestBytes.length <= 0 || manifestBytes.length > MAX_MANIFEST_BYTES
        || sha256(manifestBytes) !== firstVerification.storageManifestSha256) {
      manifestBytes.fill(0);
      throw fixedError("storage_restore_manifest_binding_mismatch");
    }
    let manifest;
    try {
      manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes));
    } catch {
      throw fixedError("storage_restore_manifest_invalid");
    } finally {
      manifestBytes.fill(0);
    }
    const validation = await verifyStorageManifest(extractRoot, manifest);
    const objects = sortedObjects(manifest.files);
    if (objects.length !== firstVerification.storageObjectCount
        || validation.totalSizeBytes !== firstVerification.storageTotalSizeBytes) {
      throw fixedError("storage_restore_receipt_manifest_mismatch");
    }
    await assertPrivateBucket(client, STORAGE_BUCKET);
    if ((await listObjects(client, STORAGE_BUCKET)).length !== 0) {
      throw fixedError("storage_restore_target_not_empty");
    }
    for (const object of objects) {
      try {
        await uploadObject(client, STORAGE_BUCKET, extractRoot, object);
        attemptedUploads.push(object.path);
      } catch (error) {
        // A transport failure may happen after the provider commits. Explicit
        // non-2xx responses are determinate rejections and must not authorize
        // deletion of an object that a concurrent writer may own.
        if (error?.requestOutcome === "indeterminate") {
          attemptedUploads.push(object.path);
        }
        throw error;
      }
    }
    const remotePaths = await listObjects(client, STORAGE_BUCKET);
    if (remotePaths.length !== objects.length
        || remotePaths.some((path, index) => path !== objects[index].path)) {
      throw fixedError("storage_restore_postwrite_path_set_mismatch");
    }
    for (const object of objects) await verifyRemoteObject(client, STORAGE_BUCKET, object);
    const objectSetSha256 = sha256(Buffer.from(JSON.stringify(
      objects.map(({ path, size, sha256: digest }) => ({ path, size, sha256: digest })),
    )));
    result = {
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      status: "STORAGE_RESTORE_EXECUTED_PENDING_EXTERNAL_ACCEPTANCE",
      reviewedCommit: binding.reviewedCommit,
      sourceArtifactBasename: expected.sourceArtifactBasename,
      outerSha256: expected.outerSha256,
      productionCommit: expected.productionCommit,
      storagePartEncryptedSha256: expected.storagePartEncryptedSha256,
      storageArchiveSha256: firstVerification.storageArchiveSha256,
      storageManifestSha256: firstVerification.storageManifestSha256,
      targetProjectRefSha256: sha256(Buffer.from(binding.targetRef)),
      targetBucket: STORAGE_BUCKET,
      objectCount: objects.length,
      totalSizeBytes: validation.totalSizeBytes,
      objectSetSha256,
      bucketPrivate: true,
      prewriteTargetEmpty: true,
      postwriteExact: true,
      rollbackStatus: "not_required",
      cleanupRequired: true,
      productionDenied: true,
      stagingDenied: true,
      localCleanupStatus: "pending",
      reconciliationRequired: false,
    };
  } catch (error) {
    operationError = error;
    if (attemptedUploads.length > 0) {
      try {
        await removeObjects(client, STORAGE_BUCKET, [...attemptedUploads].reverse());
        const remaining = await listObjects(client, STORAGE_BUCKET);
        if (remaining.length !== 0) {
          throw fixedError("storage_restore_rollback_incomplete");
        }
      } catch {
        operationError = fixedError("storage_restore_reconciliation_required");
      }
    }
  }

  let cleanupFailed = false;
  try {
    await cleanupImpl(temporaryRoot, { recursive: true, force: true });
  } catch {
    cleanupFailed = true;
  }

  if (operationError) {
    binding.serviceKey = "";
    if (cleanupFailed
        && operationError?.code === "storage_restore_reconciliation_required") {
      throw fixedError("storage_restore_remote_and_local_reconciliation_required");
    }
    if (cleanupFailed) throw fixedError("storage_restore_local_cleanup_required");
    throw operationError;
  }

  if (cleanupFailed) {
    result.status = "STORAGE_RESTORE_EXECUTED_LOCAL_CLEANUP_REQUIRED";
    result.localCleanupStatus = "required";
    result.reconciliationRequired = true;
  } else {
    result.localCleanupStatus = "passed";
  }
  try {
    await receiptWriter(resultReceiptPath, result);
  } catch (error) {
    try {
      await removeObjects(client, STORAGE_BUCKET, [...attemptedUploads].reverse());
      const remaining = await listObjects(client, STORAGE_BUCKET);
      if (remaining.length !== 0) {
        throw fixedError("storage_restore_rollback_incomplete");
      }
    } catch {
      binding.serviceKey = "";
      if (cleanupFailed) {
        throw fixedError("storage_restore_remote_and_local_reconciliation_required");
      }
      throw fixedError("storage_restore_reconciliation_required");
    }
    binding.serviceKey = "";
    if (cleanupFailed) throw fixedError("storage_restore_local_cleanup_required");
    throw error;
  }
  binding.serviceKey = "";
  return result;
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--receipt") options.receiptPath = argv[++index];
    else if (value === "--archive") options.archivePath = argv[++index];
    else if (value === "--result-receipt") options.resultReceiptPath = argv[++index];
    else if (value === "--expected-source-artifact") {
      options.expectedSourceArtifactBasename = argv[++index];
    } else if (value === "--expected-outer-sha256") {
      options.expectedOuterSha256 = argv[++index];
    } else if (value === "--expected-production-commit") {
      options.expectedProductionCommit = argv[++index];
    } else if (value === "--expected-storage-part-sha256") {
      options.expectedStoragePartEncryptedSha256 = argv[++index];
    } else throw fixedError("storage_restore_unknown_argument");
  }
  return options;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  for (const key of [
    "receiptPath",
    "archivePath",
    "resultReceiptPath",
    "expectedSourceArtifactBasename",
    "expectedOuterSha256",
    "expectedProductionCommit",
    "expectedStoragePartEncryptedSha256",
  ]) {
    if (!options[key]) throw fixedError("storage_restore_argument_required");
  }
  const result = await runStorageRestore(options);
  if (result.reconciliationRequired) {
    console.log("RESTORE_STORAGE_DRILL=RECONCILIATION_REQUIRED");
    console.log(`RESTORE_STORAGE_STATUS=${result.status}`);
    console.log("RESTORE_STORAGE_CLEANUP=required");
    console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    process.exitCode = 2;
    return;
  }
  console.log("RESTORE_STORAGE_DRILL=PASS_PENDING_EXTERNAL_ACCEPTANCE");
  console.log(`RESTORE_STORAGE_STATUS=${result.status}`);
  console.log("RESTORE_STORAGE_CLEANUP=required");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`RESTORE_STORAGE_DRILL=FAILED (${error?.code ?? "unknown"})`);
    process.exitCode = 1;
  });
}

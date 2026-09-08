import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  open,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  promotePrivateReceipt,
  replacePrivateReceipt,
  runStorageRestore,
  STORAGE_RESTORE_CONFIRMATION,
  STORAGE_TARGET_ACKNOWLEDGEMENT,
  writePrivateReceipt,
} from "../scripts/operations/run-storage-restore-drill.mjs";

const execFileAsync = promisify(execFile);

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function safeEnvironment(overrides = {}) {
  return {
    FANMIND_RUNTIME_ENVIRONMENT: "test",
    NEXT_PUBLIC_APP_URL: "https://restore-local.fanmind.example",
    NEXT_PUBLIC_SUPABASE_URL: "https://restorelocalref1.supabase.co",
    FANMIND_TARGET_SUPABASE_PROJECT_REF: "restorelocalref1",
    FANMIND_PRODUCTION_SUPABASE_PROJECT_REF: "productionref123",
    FANMIND_STAGING_SUPABASE_PROJECT_REF: "stagingref12345",
    FANMIND_ENABLE_NON_PRODUCTION_WRITES: "true",
    FANMIND_NON_PRODUCTION_WRITE_ACK: "I_UNDERSTAND_NON_PRODUCTION_ONLY",
    FANMIND_STORAGE_RESTORE_CONFIRM: STORAGE_RESTORE_CONFIRMATION,
    FANMIND_STORAGE_RESTORE_TARGET_ACK: STORAGE_TARGET_ACKNOWLEDGEMENT,
    FANMIND_RESTORE_STORAGE_BUCKET: "fanmind-assets",
    FANMIND_RESTORE_SUPABASE_SERVICE_ROLE_KEY: "synthetic-service-role-key",
    FANMIND_RESTORE_REVIEWED_COMMIT: "a".repeat(40),
    GITHUB_SHA: "a".repeat(40),
    GITHUB_REF: "refs/heads/main",
    ...overrides,
  };
}

async function fixture(root, files = [
  { path: "avatars/one.png", bytes: Buffer.from("avatar-one") },
]) {
  const contentRoot = join(root, "content");
  await mkdir(contentRoot, { mode: 0o700 });
  const manifestFiles = [];
  for (const item of files) {
    const path = join(contentRoot, item.path);
    await mkdir(join(path, ".."), { recursive: true, mode: 0o700 });
    await writeFile(path, item.bytes, { mode: 0o600 });
    manifestFiles.push({
      path: item.path,
      size: item.bytes.length,
      content_type: "image/png",
      created_at: null,
      updated_at: null,
      sha256: digest(item.bytes),
    });
  }
  const manifest = {
    bucket: "fanmind-assets",
    listed_object_count: files.length,
    downloaded_object_count: files.length,
    object_count: files.length,
    total_size_bytes: files.reduce((sum, item) => sum + item.bytes.length, 0),
    files: manifestFiles,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest)}\n`);
  await writeFile(join(contentRoot, "manifest.json"), manifestBytes, { mode: 0o600 });
  const archivePath = join(root, "verified-storage.tar.gz");
  await execFileAsync("tar", ["-czf", archivePath, "-C", contentRoot, "."]);
  await chmod(archivePath, 0o600);
  const archiveBytes = await readFile(archivePath);
  const receiptPath = join(root, "storage-preparation-receipt.json");
  const receipt = {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    sourceArtifactBasename: "fanmind-full-1785398400000.tar.gz.age",
    outerSha256: "1".repeat(64),
    productionCommit: "2".repeat(40),
    storagePartEncryptedSha256: "3".repeat(64),
    storageArchiveSha256: digest(archiveBytes),
    storageManifestSha256: digest(manifestBytes),
    storageBucket: "fanmind-assets",
    storageObjectCount: files.length,
    storageTotalSizeBytes: manifest.total_size_bytes,
    verifier: "passed",
  };
  await writeFile(receiptPath, `${JSON.stringify(receipt)}\n`, { mode: 0o600 });
  return { archivePath, receiptPath, receipt, files };
}

function storageApiMock({
  initial = [],
  failUploadPath = null,
  indeterminateUploadPath = null,
  indeterminateWithoutCommitPath = null,
  ambiguousUploadStatus = null,
  includeRootPlaceholder = false,
  failDelete = false,
  onList = null,
} = {}) {
  const objects = new Map(initial.map((item) => [item.path, Buffer.from(item.bytes)]));
  const calls = [];
  const response = (body, init = {}) => new Response(
    typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body),
    { status: 200, headers: { "content-type": "application/json" }, ...init },
  );
  const fetchImpl = async (url, options = {}) => {
    const parsed = new URL(url);
    const method = options.method ?? "GET";
    calls.push({ method, path: parsed.pathname });
    if (method === "GET" && parsed.pathname === "/storage/v1/bucket/fanmind-assets") {
      return response({ id: "fanmind-assets", name: "fanmind-assets", public: false });
    }
    if (method === "POST" && parsed.pathname === "/storage/v1/object/list/fanmind-assets") {
      const body = JSON.parse(options.body);
      await onList?.(body, calls);
      const prefix = body.prefix;
      const directFiles = [];
      const folders = new Set();
      for (const path of objects.keys()) {
        if (prefix && !path.startsWith(`${prefix}/`)) continue;
        const relative = prefix ? path.slice(prefix.length + 1) : path;
        const [first, ...rest] = relative.split("/");
        if (rest.length) folders.add(first);
        else directFiles.push({ id: `id-${path}`, name: first, metadata: { size: objects.get(path).length } });
      }
      const rows = [
        ...(includeRootPlaceholder && !prefix
          ? [{ id: null, name: ".emptyFolderPlaceholder", metadata: null }]
          : []),
        ...[...folders].sort().map((name) => ({ id: null, name, metadata: null })),
        ...directFiles.sort((left, right) => left.name.localeCompare(right.name)),
      ];
      return response(rows.slice(body.offset, body.offset + body.limit));
    }
    const objectPrefix = "/storage/v1/object/fanmind-assets/";
    if (parsed.pathname.startsWith(objectPrefix)) {
      const path = parsed.pathname.slice(objectPrefix.length)
        .split("/").map(decodeURIComponent).join("/");
      if (method === "POST") {
        if (path === failUploadPath) return new Response("conflict", { status: 409 });
        if (path === indeterminateWithoutCommitPath) {
          throw new Error("synthetic_indeterminate_upload_before_commit");
        }
        objects.set(path, Buffer.from(options.body));
        if (ambiguousUploadStatus) {
          return new Response("ambiguous", { status: ambiguousUploadStatus });
        }
        if (path === indeterminateUploadPath) {
          throw new Error("synthetic_indeterminate_upload");
        }
        return response({ Key: path });
      }
      if (method === "GET" && objects.has(path)) return response(objects.get(path));
    }
    if (method === "DELETE" && parsed.pathname === "/storage/v1/object/fanmind-assets") {
      if (failDelete) return new Response("failed", { status: 500 });
      const { prefixes } = JSON.parse(options.body);
      for (const path of prefixes) objects.delete(path);
      return response({ message: "Successfully deleted" });
    }
    return new Response("not found", { status: 404 });
  };
  return { fetchImpl, objects, calls };
}

function runOptions(data, resultReceiptPath, fetchImpl, environment = safeEnvironment()) {
  return {
    environment,
    archivePath: data.archivePath,
    receiptPath: data.receiptPath,
    resultReceiptPath,
    expectedSourceArtifactBasename: data.receipt.sourceArtifactBasename,
    expectedOuterSha256: data.receipt.outerSha256,
    expectedProductionCommit: data.receipt.productionCommit,
    expectedStoragePartEncryptedSha256: data.receipt.storagePartEncryptedSha256,
    fetchImpl,
  };
}

test("local synthetic Storage drill proves empty prewrite and exact postwrite", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-success-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const result = await runStorageRestore(runOptions(data, resultPath, api.fetchImpl));
    assert.equal(
      result.status,
      "STORAGE_RESTORE_EXECUTED_PENDING_EXTERNAL_ACCEPTANCE",
    );
    assert.equal(result.prewriteTargetEmpty, true);
    assert.equal(result.postwriteExact, true);
    assert.equal(result.productionDenied, true);
    assert.equal(result.stagingDenied, true);
    assert.deepEqual(api.objects.get("avatars/one.png"), data.files[0].bytes);
    const storedReceipt = JSON.parse(await readFile(resultPath, "utf8"));
    assert.equal(storedReceipt.objectCount, 1);
    assert.equal(storedReceipt.cleanupRequired, true);
    assert.equal(storedReceipt.localCleanupStatus, "passed");
    await assert.rejects(readFile(`${resultPath}.reservation`), /ENOENT/u);
    await assert.rejects(readFile(`${resultPath}.pending`), /ENOENT/u);
    await assert.rejects(readFile(`${resultPath}.lock`), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill refuses a non-empty target before upload", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-nonempty-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock({ initial: [{ path: "existing.txt", bytes: "occupied" }] });
    await assert.rejects(
      runStorageRestore(runOptions(data, join(root, "result.json"), api.fetchImpl)),
      /storage_restore_target_not_empty/u,
    );
    assert.equal(api.objects.has("avatars/one.png"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill blocks a stale pending receipt before provider access", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-stale-start-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    await writeFile(`${resultPath}.pending`, "{\"status\":\"stale\"}\n", { mode: 0o600 });
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_pending_receipt_reconciliation_required/u,
    );
    assert.equal(api.calls.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill blocks an interrupted receipt replacement before provider access", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-stale-replacement-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    await writeFile(`${resultPath}.pending`, "{\"status\":\"old\"}\n", {
      mode: 0o600,
    });
    await writeFile(`${resultPath}.pending.replacement`, "{\"status\":\"stale\"}\n", {
      mode: 0o600,
    });
    await writePrivateReceipt(`${resultPath}.lock`, {
      invocationId: "stale-invocation",
      status: "STORAGE_RESTORE_INVOCATION_LOCKED",
    });
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_replacement_receipt_reconciliation_required/u,
    );
    assert.equal(api.calls.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill prioritizes an interrupted lock finalization over the stale lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-lock-replacement-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    await writePrivateReceipt(`${resultPath}.lock`, {
      invocationId: "stale-invocation",
      status: "STORAGE_RESTORE_INVOCATION_LOCKED",
    });
    await writePrivateReceipt(`${resultPath}.lock.replacement`, {
      invocationId: "stale-invocation",
      status: "STORAGE_RESTORE_EXECUTED_PENDING_EXTERNAL_ACCEPTANCE",
    });
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_replacement_receipt_reconciliation_required/u,
    );
    assert.equal(api.calls.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill prioritizes an interrupted reservation replacement over the lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-reservation-replacement-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const original = {
      invocationId: "stale-invocation",
      status: "STORAGE_RESTORE_WRITE_RESERVED",
    };
    await writePrivateReceipt(`${resultPath}.lock`, {
      invocationId: original.invocationId,
      status: "STORAGE_RESTORE_INVOCATION_LOCKED",
    });
    await writePrivateReceipt(`${resultPath}.reservation`, original);
    await writePrivateReceipt(`${resultPath}.reservation.replacement`, {
      ...original,
      status: "STORAGE_RESTORE_ROLLED_BACK",
    });
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_replacement_receipt_reconciliation_required/u,
    );
    assert.equal(api.calls.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill blocks a stale invocation reservation before provider access", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-stale-reservation-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    await writeFile(`${resultPath}.reservation`, "{\"status\":\"stale\"}\n", {
      mode: 0o600,
    });
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_reservation_receipt_reconciliation_required/u,
    );
    assert.equal(api.calls.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves a foreign invocation lock and blocks provider access", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-stale-lock-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const lockPath = `${resultPath}.lock`;
    const owner = {
      invocationId: "foreign-invocation",
      status: "STORAGE_RESTORE_INVOCATION_LOCKED",
    };
    await writePrivateReceipt(lockPath, owner);
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_invocation_lock_reconciliation_required/u,
    );
    assert.equal(api.calls.length, 0);
    assert.deepEqual(
      JSON.parse(await readFile(lockPath, "utf8")),
      owner,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves a lock won concurrently after the startup check", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-lock-race-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const resultPath = join(root, "result.json");
    const lockPath = `${resultPath}.lock`;
    const owner = {
      invocationId: "concurrent-invocation",
      status: "STORAGE_RESTORE_INVOCATION_LOCKED",
    };
    let injected = false;
    const api = storageApiMock({
      onList: async () => {
        if (injected) return;
        injected = true;
        await writePrivateReceipt(lockPath, owner);
      },
    });
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_invocation_lock_exists/u,
    );
    assert.equal(api.calls.some((call) => call.method === "POST"
      && call.path.includes("/storage/v1/object/fanmind-assets/")), false);
    assert.deepEqual(
      JSON.parse(await readFile(lockPath, "utf8")),
      owner,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill rolls back all uploaded objects after a bounded write failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-rollback-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root, [
      { path: "a.txt", bytes: Buffer.from("a") },
      { path: "b.txt", bytes: Buffer.from("b") },
    ]);
    const api = storageApiMock({ failUploadPath: "b.txt" });
    const resultPath = join(root, "result.json");
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_api_upload_failed/u,
    );
    assert.equal(api.objects.size, 0);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), true);
    const reservation = JSON.parse(
      await readFile(`${resultPath}.reservation`, "utf8"),
    );
    assert.equal(reservation.status, "STORAGE_RESTORE_ROLLED_BACK");
    assert.equal(reservation.rollbackStatus, "passed");
    assert.equal(reservation.localCleanupStatus, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill reconciles an indeterminate first upload", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-indeterminate-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock({ indeterminateUploadPath: "avatars/one.png" });
    await assert.rejects(
      runStorageRestore(runOptions(data, join(root, "result.json"), api.fetchImpl)),
      /storage_restore_reconciliation_required/u,
    );
    assert.equal(api.objects.has("avatars/one.png"), true);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), false);
    const recoveryReceipt = JSON.parse(
      await readFile(join(root, "result.json.pending"), "utf8"),
    );
    assert.equal(
      recoveryReceipt.status,
      "STORAGE_RESTORE_REMOTE_RECONCILIATION_REQUIRED",
    );
    assert.equal(recoveryReceipt.localCleanupStatus, "passed");
    assert.equal(
      JSON.parse(await readFile(join(root, "result.json.reservation"), "utf8"))
        .invocationId,
      recoveryReceipt.invocationId,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill supersedes both receipts after an indeterminate later upload rolls back", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-later-indeterminate-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root, [
      { path: "a.txt", bytes: Buffer.from("a") },
      { path: "b.txt", bytes: Buffer.from("b") },
    ]);
    const api = storageApiMock({ indeterminateWithoutCommitPath: "b.txt" });
    const resultPath = join(root, "result.json");
    await assert.rejects(
      runStorageRestore(runOptions(data, resultPath, api.fetchImpl)),
      /storage_restore_reconciliation_required/u,
    );
    assert.equal(api.objects.size, 0);
    for (const suffix of [".pending", ".reservation"]) {
      const recovery = JSON.parse(await readFile(`${resultPath}${suffix}`, "utf8"));
      assert.equal(recovery.status, "STORAGE_RESTORE_ROLLED_BACK");
      assert.equal(recovery.rollbackStatus, "passed");
      assert.equal(recovery.cleanupRequired, false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill recovers an indeterminate operation marker after proven rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-operation-marker-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root, [
      { path: "a.txt", bytes: Buffer.from("a") },
      { path: "b.txt", bytes: Buffer.from("b") },
    ]);
    const api = storageApiMock({ indeterminateWithoutCommitPath: "b.txt" });
    const resultPath = join(root, "result.json");
    const receiptWriter = async (path, receipt) => {
      await writePrivateReceipt(path, receipt);
      const error = new Error("storage_restore_receipt_reconciliation_required");
      error.code = "storage_restore_receipt_reconciliation_required";
      throw error;
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        receiptWriter,
      }),
      /storage_restore_reconciliation_required/u,
    );
    assert.equal(api.objects.size, 0);
    for (const suffix of [".pending", ".reservation"]) {
      const recovery = JSON.parse(await readFile(`${resultPath}${suffix}`, "utf8"));
      assert.equal(recovery.status, "STORAGE_RESTORE_ROLLED_BACK");
      assert.equal(recovery.rollbackStatus, "passed");
      assert.equal(recovery.cleanupRequired, false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill reports only local cleanup after proven later-upload rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-later-local-cleanup-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root, [
      { path: "a.txt", bytes: Buffer.from("a") },
      { path: "b.txt", bytes: Buffer.from("b") },
    ]);
    const api = storageApiMock({ indeterminateWithoutCommitPath: "b.txt" });
    const resultPath = join(root, "result.json");
    const cleanupImpl = async (path, options) => {
      await rm(path, options);
      throw new Error("synthetic_plaintext_cleanup_failure");
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        cleanupImpl,
      }),
      /storage_restore_local_cleanup_required/u,
    );
    assert.equal(api.objects.size, 0);
    for (const suffix of [".pending", ".reservation"]) {
      const recovery = JSON.parse(await readFile(`${resultPath}${suffix}`, "utf8"));
      assert.equal(
        recovery.status,
        "STORAGE_RESTORE_ROLLED_BACK_LOCAL_CLEANUP_REQUIRED",
      );
      assert.equal(recovery.rollbackStatus, "passed");
      assert.equal(recovery.cleanupRequired, false);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill never deletes a concurrent object after determinate rejection", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-conflict-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock({ failUploadPath: "avatars/one.png" });
    await assert.rejects(
      runStorageRestore(runOptions(data, join(root, "result.json"), api.fetchImpl)),
      /storage_api_upload_failed/u,
    );
    assert.equal(api.calls.some((call) => call.method === "DELETE"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill reconciles ambiguous server responses after a possible commit", async () => {
  for (const status of [500, 502, 504]) {
    const root = await mkdtemp(join(tmpdir(), `fanmind-storage-drill-${status}-`));
    try {
      await chmod(root, 0o700);
      const data = await fixture(root);
      const api = storageApiMock({ ambiguousUploadStatus: status });
      await assert.rejects(
        runStorageRestore(runOptions(data, join(root, "result.json"), api.fetchImpl)),
        /storage_restore_reconciliation_required/u,
      );
      assert.equal(api.objects.has("avatars/one.png"), true);
      assert.equal(api.calls.some((call) => call.method === "DELETE"), false);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test("Storage drill preserves remote reconciliation across dual cleanup failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-dual-failure-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock({
      indeterminateUploadPath: "avatars/one.png",
      failDelete: true,
    });
    const cleanupImpl = async (path, options) => {
      await rm(path, options);
      throw new Error("synthetic_cleanup_failure");
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, join(root, "result.json"), api.fetchImpl),
        cleanupImpl,
      }),
      /storage_restore_remote_and_local_reconciliation_required/u,
    );
    assert.equal(api.objects.has("avatars/one.png"), true);
    const recoveryReceipt = JSON.parse(
      await readFile(join(root, "result.json.pending"), "utf8"),
    );
    assert.equal(
      recoveryReceipt.status,
      "STORAGE_RESTORE_REMOTE_RECONCILIATION_REQUIRED",
    );
    assert.equal(recoveryReceipt.localCleanupStatus, "required");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage listing paginates using the unfiltered provider page length", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-pagination-"));
  try {
    await chmod(root, 0o700);
    const files = Array.from({ length: 101 }, (_, index) => ({
      path: `object-${String(index).padStart(3, "0")}.txt`,
      bytes: Buffer.from(`object-${index}`),
    }));
    const data = await fixture(root, files);
    const api = storageApiMock({ includeRootPlaceholder: true });
    const result = await runStorageRestore(
      runOptions(data, join(root, "result.json"), api.fetchImpl),
    );
    assert.equal(result.objectCount, 101);
    const listCalls = api.calls.filter((call) =>
      call.path === "/storage/v1/object/list/fanmind-assets");
    assert.equal(listCalls.length >= 3, true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("private receipt publication removes a partially written destination", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-receipt-"));
  try {
    await chmod(root, 0o700);
    const resultPath = join(root, "result.json");
    const failingOpen = async (...args) => {
      const handle = await open(...args);
      return {
        writeFile: async (content) => {
          await handle.writeFile(content.slice(0, 8));
          throw new Error("synthetic_receipt_write_failure");
        },
        sync: () => handle.sync(),
        close: () => handle.close(),
      };
    };
    await assert.rejects(
      writePrivateReceipt(resultPath, { status: "test" }, { openFile: failingOpen }),
      /synthetic_receipt_write_failure/u,
    );
    await assert.rejects(readFile(resultPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("private receipt publication fsyncs its parent directory", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-receipt-fsync-"));
  try {
    await chmod(root, 0o700);
    const resultPath = join(root, "result.json");
    let directorySyncs = 0;
    const openDirectory = async (...args) => {
      const handle = await open(...args);
      return {
        sync: async () => {
          directorySyncs += 1;
          await handle.sync();
        },
        close: () => handle.close(),
      };
    };
    await writePrivateReceipt(
      resultPath,
      { status: "test" },
      { openDirectory },
    );
    assert.equal(directorySyncs, 1);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("private receipt replacement refuses an ownership change", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-receipt-owner-"));
  try {
    await chmod(root, 0o700);
    const resultPath = join(root, "result.json.pending");
    const foreignReceipt = { invocationId: "foreign-invocation", status: "foreign" };
    await writePrivateReceipt(resultPath, foreignReceipt);
    await assert.rejects(
      replacePrivateReceipt(resultPath, {
        invocationId: "current-invocation",
        status: "replacement",
      }),
      /storage_restore_receipt_ownership_changed/u,
    );
    assert.deepEqual(JSON.parse(await readFile(resultPath, "utf8")), foreignReceipt);
    await assert.rejects(readFile(`${resultPath}.replacement`), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("atomic promotion restores the lock path when directory sync fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-promotion-sync-"));
  try {
    await chmod(root, 0o700);
    const sourcePath = join(root, "result.json.lock");
    const destinationPath = join(root, "result.json");
    const invocationId = "promotion-sync-invocation";
    const receipt = {
      invocationId,
      status: "STORAGE_RESTORE_EXECUTED_PENDING_EXTERNAL_ACCEPTANCE",
      reconciliationRequired: true,
    };
    await writePrivateReceipt(sourcePath, receipt);
    let syncCalls = 0;
    await assert.rejects(
      promotePrivateReceipt(sourcePath, destinationPath, invocationId, {
        syncDirectoryImpl: async () => {
          syncCalls += 1;
          if (syncCalls === 1) throw new Error("synthetic_promotion_sync_failure");
        },
      }),
      /storage_restore_receipt_reconciliation_required/u,
    );
    assert.deepEqual(JSON.parse(await readFile(sourcePath, "utf8")), receipt);
    await assert.rejects(readFile(destinationPath), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves verified remote state when finalization write fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-receipt-rollback-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        lockFinalizer: async () => {
          throw new Error("synthetic_receipt_write_failure");
        },
      }),
      /synthetic_receipt_write_failure/u,
    );
    assert.equal(api.objects.size, 1);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), false);
    await assert.rejects(readFile(resultPath), /ENOENT/u);
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.pending`, "utf8")).postwriteExact,
      true,
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.reservation`, "utf8")).status,
      "STORAGE_RESTORE_WRITE_RESERVED",
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.lock`, "utf8")).status,
      "STORAGE_RESTORE_INVOCATION_LOCKED",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves verified remote state when final receipt publication is indeterminate", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-final-indeterminate-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const lockFinalizer = async (path, receipt) => {
      await replacePrivateReceipt(path, receipt);
      const error = new Error("storage_restore_receipt_reconciliation_required");
      error.code = "storage_restore_receipt_reconciliation_required";
      throw error;
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        lockFinalizer,
      }),
      /storage_restore_receipt_reconciliation_required/u,
    );
    assert.equal(api.objects.has("avatars/one.png"), true);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), false);
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.lock`, "utf8")).postwriteExact,
      true,
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.pending`, "utf8")).status,
      "STORAGE_RESTORE_POSTWRITE_VERIFIED_CLEANUP_PENDING",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves the remote outcome when local cleanup reports failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-cleanup-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const cleanupImpl = async (path, options) => {
      if (path.endsWith(".pending") || path.endsWith(".reservation")
          || path.endsWith(".lock")) {
        return rm(path, options);
      }
      await rm(path, options);
      throw new Error("synthetic_cleanup_failure");
    };
    const result = await runStorageRestore({
      ...runOptions(data, resultPath, api.fetchImpl),
      cleanupImpl,
    });
    assert.equal(result.status, "STORAGE_RESTORE_EXECUTED_LOCAL_CLEANUP_REQUIRED");
    assert.equal(result.reconciliationRequired, true);
    assert.equal(api.objects.has("avatars/one.png"), true);
    const storedReceipt = JSON.parse(await readFile(resultPath, "utf8"));
    assert.equal(storedReceipt.localCleanupStatus, "required");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill persists pending recovery evidence before plaintext cleanup", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-pending-receipt-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    let cleanupObservedPending = false;
    const cleanupImpl = async (path, options) => {
      if (path.endsWith(".pending") || path.endsWith(".reservation")
          || path.endsWith(".lock")) {
        return rm(path, options);
      }
      const pending = JSON.parse(await readFile(`${resultPath}.pending`, "utf8"));
      assert.equal(pending.status, "STORAGE_RESTORE_POSTWRITE_VERIFIED_CLEANUP_PENDING");
      await assert.rejects(readFile(resultPath), /ENOENT/u);
      cleanupObservedPending = true;
      return rm(path, options);
    };
    const result = await runStorageRestore({
      ...runOptions(data, resultPath, api.fetchImpl),
      cleanupImpl,
    });
    assert.equal(cleanupObservedPending, true);
    assert.equal(result.localCleanupStatus, "passed");
    await assert.rejects(readFile(`${resultPath}.pending`), /ENOENT/u);
    assert.equal(JSON.parse(await readFile(resultPath, "utf8")).localCleanupStatus, "passed");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill durably records plaintext and pending-marker removal", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-cleanup-fsync-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const syncedDirectories = [];
    const result = await runStorageRestore({
      ...runOptions(data, resultPath, api.fetchImpl),
      syncDirectoryImpl: async (path) => {
        syncedDirectories.push(path);
        const handle = await open(path);
        try {
          await handle.sync();
        } finally {
          await handle.close();
        }
      },
    });
    assert.equal(result.localCleanupStatus, "passed");
    assert.equal(syncedDirectories.includes(tmpdir()), true);
    assert.equal(syncedDirectories.includes(root), true);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves receipt and local cleanup failures together", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-receipt-cleanup-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const cleanupImpl = async (path, options) => {
      if (path.endsWith(".pending")) return rm(path, options);
      await rm(path, options);
      throw new Error("synthetic_cleanup_failure");
    };
    const lockFinalizer = async () => {
      const error = new Error("storage_restore_receipt_exists");
      error.code = "storage_restore_receipt_exists";
      throw error;
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        cleanupImpl,
        lockFinalizer,
      }),
      /storage_restore_receipt_and_local_reconciliation_required/u,
    );
    assert.equal(api.objects.has("avatars/one.png"), true);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), false);
    const recoveryReceipt = JSON.parse(
      await readFile(`${resultPath}.pending`, "utf8"),
    );
    assert.equal(
      recoveryReceipt.status,
      "STORAGE_RESTORE_POSTWRITE_VERIFIED_CLEANUP_PENDING",
    );
    assert.equal(recoveryReceipt.rollbackStatus, "not_required");
    assert.equal(recoveryReceipt.postwriteExact, true);
    assert.equal(recoveryReceipt.cleanupRequired, true);
    assert.equal(recoveryReceipt.localCleanupStatus, "pending");
    assert.equal(
      recoveryReceipt.reconciliationRequired,
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill supersedes an indeterminate pending receipt after rollback", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-pending-supersede-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const cleanupImpl = async (path, options) => {
      await rm(path, options);
      throw new Error("synthetic_plaintext_cleanup_failure");
    };
    const receiptWriter = async (path, receipt) => {
      await writePrivateReceipt(path, receipt);
      const error = new Error("storage_restore_receipt_reconciliation_required");
      error.code = "storage_restore_receipt_reconciliation_required";
      throw error;
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        cleanupImpl,
        receiptWriter,
      }),
      /storage_restore_receipt_and_local_reconciliation_required/u,
    );
    assert.equal(api.objects.size, 0);
    const recoveryReceipt = JSON.parse(
      await readFile(`${resultPath}.pending`, "utf8"),
    );
    assert.equal(
      recoveryReceipt.status,
      "STORAGE_RESTORE_ROLLED_BACK_LOCAL_CLEANUP_REQUIRED",
    );
    assert.equal(recoveryReceipt.rollbackStatus, "passed");
    assert.equal(recoveryReceipt.postwriteExact, false);
    assert.equal(recoveryReceipt.cleanupRequired, false);
    assert.equal(recoveryReceipt.localCleanupStatus, "required");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill never supersedes a pending receipt created by another writer", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-pending-race-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const foreignReceipt = { status: "FOREIGN_RECOVERY_EVIDENCE" };
    const receiptWriter = async (path) => {
      await writeFile(path, `${JSON.stringify(foreignReceipt)}\n`, { mode: 0o600 });
      const error = new Error("storage_restore_receipt_exists");
      error.code = "storage_restore_receipt_exists";
      throw error;
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        receiptWriter,
      }),
      /storage_restore_receipt_exists/u,
    );
    assert.equal(api.objects.size, 0);
    assert.deepEqual(
      JSON.parse(await readFile(`${resultPath}.pending`, "utf8")),
      foreignReceipt,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves remote receipt and local duties after triple failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-triple-failure-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock({ failDelete: true });
    const resultPath = join(root, "result.json");
    const cleanupImpl = async (path, options) => {
      await rm(path, options);
      throw new Error("synthetic_plaintext_cleanup_failure");
    };
    const receiptWriter = async (path, receipt) => {
      await writePrivateReceipt(path, receipt);
      const error = new Error("storage_restore_receipt_reconciliation_required");
      error.code = "storage_restore_receipt_reconciliation_required";
      throw error;
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        cleanupImpl,
        receiptWriter,
      }),
      /storage_restore_remote_receipt_and_local_reconciliation_required/u,
    );
    assert.equal(api.objects.has("avatars/one.png"), true);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), true);
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.pending`, "utf8")).postwriteExact,
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill records a proven rollback in pending and reservation receipts", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-pending-stale-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const receiptWriter = async (path, receipt) => {
      await writePrivateReceipt(path, receipt);
      if (path.endsWith(".pending")) {
        const error = new Error("storage_restore_receipt_reconciliation_required");
        error.code = "storage_restore_receipt_reconciliation_required";
        throw error;
      }
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        receiptWriter,
      }),
      /storage_restore_receipt_reconciliation_required/u,
    );
    assert.equal(api.objects.size, 0);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), true);
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.pending`, "utf8")).status,
      "STORAGE_RESTORE_ROLLED_BACK",
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.reservation`, "utf8")).status,
      "STORAGE_RESTORE_ROLLED_BACK",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill reports both plaintext and pending-marker cleanup failures", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-dual-local-cleanup-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const cleanupImpl = async (path, options) => {
      if (path.endsWith(".pending")) throw new Error("synthetic_pending_remove_failure");
      await rm(path, options);
      throw new Error("synthetic_plaintext_cleanup_failure");
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        cleanupImpl,
      }),
      /storage_restore_pending_receipt_and_local_reconciliation_required/u,
    );
    assert.equal(api.objects.has("avatars/one.png"), true);
    await assert.rejects(readFile(resultPath), /ENOENT/u);
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.lock`, "utf8"))
        .localCleanupStatus,
      "required",
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.pending`, "utf8")).status,
      "STORAGE_RESTORE_POSTWRITE_VERIFIED_CLEANUP_PENDING",
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill withholds the final receipt until reservation cleanup is durable", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-reservation-cleanup-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const cleanupImpl = async (path, options) => {
      if (path.endsWith(".reservation")) {
        throw new Error("synthetic_reservation_remove_failure");
      }
      return rm(path, options);
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        cleanupImpl,
      }),
      /storage_restore_reservation_receipt_cleanup_required/u,
    );
    await assert.rejects(readFile(resultPath), /ENOENT/u);
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.lock`, "utf8")).postwriteExact,
      true,
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.reservation`, "utf8")).status,
      "STORAGE_RESTORE_WRITE_RESERVED",
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.lock`, "utf8")).postwriteExact,
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill keeps the finalized lock when atomic promotion fails", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-lock-cleanup-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        receiptPromoter: async () => {
          throw new Error("synthetic_atomic_promotion_failure");
        },
      }),
      /synthetic_atomic_promotion_failure/u,
    );
    await assert.rejects(readFile(resultPath), /ENOENT/u);
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.lock`, "utf8")).postwriteExact,
      true,
    );
    await assert.rejects(readFile(`${resultPath}.reservation`), /ENOENT/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill preserves a foreign final receipt under the invocation lock", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-foreign-final-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    const resultPath = join(root, "result.json");
    const foreignReceipt = { status: "FOREIGN_FINAL_RECEIPT" };
    const lockFinalizer = async (path, receipt) => {
      await replacePrivateReceipt(path, receipt);
      await writePrivateReceipt(resultPath, foreignReceipt);
    };
    await assert.rejects(
      runStorageRestore({
        ...runOptions(data, resultPath, api.fetchImpl),
        lockFinalizer,
      }),
      /storage_restore_receipt_exists/u,
    );
    assert.deepEqual(
      JSON.parse(await readFile(resultPath, "utf8")),
      foreignReceipt,
    );
    assert.equal(
      JSON.parse(await readFile(`${resultPath}.lock`, "utf8")).postwriteExact,
      true,
    );
    assert.equal(api.objects.has("avatars/one.png"), true);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("Storage drill rejects Production and canonical Staging project refs", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-boundary-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root);
    const api = storageApiMock();
    for (const environment of [
      safeEnvironment({
        FANMIND_TARGET_SUPABASE_PROJECT_REF: "productionref123",
        NEXT_PUBLIC_SUPABASE_URL: "https://productionref123.supabase.co",
      }),
      safeEnvironment({
        FANMIND_TARGET_SUPABASE_PROJECT_REF: "stagingref12345",
        NEXT_PUBLIC_SUPABASE_URL: "https://stagingref12345.supabase.co",
      }),
    ]) {
      await assert.rejects(
        runStorageRestore(runOptions(data, join(root, `${Math.random()}.json`), api.fetchImpl, environment)),
        /storage_restore_(?:environment_boundary_blocked|project_boundary_invalid)/u,
      );
    }
    assert.equal(api.calls.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";

import {
  runStorageRestore,
  STORAGE_RESTORE_CONFIRMATION,
  STORAGE_TARGET_ACKNOWLEDGEMENT,
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

function storageApiMock({ initial = [], failUploadPath = null } = {}) {
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
        if (path === failUploadPath) return new Response("failed", { status: 500 });
        objects.set(path, Buffer.from(options.body));
        return response({ Key: path });
      }
      if (method === "GET" && objects.has(path)) return response(objects.get(path));
    }
    if (method === "DELETE" && parsed.pathname === "/storage/v1/object/fanmind-assets") {
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
    assert.equal(result.status, "STORAGE_RESTORED");
    assert.equal(result.prewriteTargetEmpty, true);
    assert.equal(result.postwriteExact, true);
    assert.equal(result.productionDenied, true);
    assert.equal(result.stagingDenied, true);
    assert.deepEqual(api.objects.get("avatars/one.png"), data.files[0].bytes);
    const storedReceipt = JSON.parse(await readFile(resultPath, "utf8"));
    assert.equal(storedReceipt.objectCount, 1);
    assert.equal(storedReceipt.cleanupRequired, true);
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

test("Storage drill rolls back all uploaded objects after a bounded write failure", async () => {
  const root = await mkdtemp(join(tmpdir(), "fanmind-storage-drill-rollback-"));
  try {
    await chmod(root, 0o700);
    const data = await fixture(root, [
      { path: "a.txt", bytes: Buffer.from("a") },
      { path: "b.txt", bytes: Buffer.from("b") },
    ]);
    const api = storageApiMock({ failUploadPath: "b.txt" });
    await assert.rejects(
      runStorageRestore(runOptions(data, join(root, "result.json"), api.fetchImpl)),
      /storage_api_upload_failed/u,
    );
    assert.equal(api.objects.size, 0);
    assert.equal(api.calls.some((call) => call.method === "DELETE"), true);
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

#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import {
  access,
  chmod,
  constants,
  copyFile,
  link,
  lstat,
  mkdtemp,
  open,
  readdir,
  realpath,
  rm,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import {
  basename,
  dirname,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  analyzeAuthorizationToc,
  validateAuthorizationContract,
} from "./database-authorization-contract.mjs";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const GIT_SHA_PATTERN = /^(?:[a-f0-9]{40}|unknown)$/;
const FULL_BACKUP_BASENAME = /^fanmind-full-\d{13}\.tar\.gz\.age$/u;
const BACKUP_TYPES = new Set(["database", "storage", "server_config", "full"]);
const MAX_AGE_IDENTITY_BYTES = 64 * 1024;
const DATABASE_AUTHORIZATION_CONTRACT_KEYS = Object.freeze([
  "archive_acl_toc_entry_count",
  "archive_acl_toc_sha256",
  "archive_default_acl_toc_entry_count",
  "canonicalization",
  "core_table_app_grant_tuple_count",
  "database_container_fingerprint_sha256",
  "database_container_record_count",
  "extension_fingerprint_sha256",
  "extension_record_count",
  "fingerprint_sha256",
  "grant_tuple_count",
  "record_count",
  "required_roles",
  "required_roles_sha256",
  "required_extensions",
  "required_extensions_sha256",
  "role_fingerprint_sha256",
  "role_record_count",
  "restricted_security_definer_function_count",
  "schema_version",
]);

function verifierError(code, details = {}) {
  const error = new Error(code);
  error.code = code;
  error.details = details;
  return error;
}

function validateDatabaseAuthorizationManifest(value) {
  if (
    !value
    || typeof value !== "object"
    || Array.isArray(value)
    || Object.keys(value).length !== DATABASE_AUTHORIZATION_CONTRACT_KEYS.length
    || !DATABASE_AUTHORIZATION_CONTRACT_KEYS.every((key) =>
      Object.hasOwn(value, key),
    )
    || !Number.isSafeInteger(value.archive_acl_toc_entry_count)
    || value.archive_acl_toc_entry_count <= 0
    || !Number.isSafeInteger(value.archive_default_acl_toc_entry_count)
    || value.archive_default_acl_toc_entry_count <= 0
    || typeof value.archive_acl_toc_sha256 !== "string"
    || !SHA256_PATTERN.test(value.archive_acl_toc_sha256)
  ) {
    throw verifierError("restore_database_authorization_contract_invalid");
  }
  try {
    return validateAuthorizationContract(value);
  } catch {
    throw verifierError("restore_database_authorization_contract_invalid");
  }
}

export function parseChecksumLine(line) {
  const match = String(line).trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
  if (!match) throw verifierError("invalid_checksum_file");
  return {
    sha256: match[1].toLowerCase(),
    fileName: match[2].trim(),
  };
}

export function assertSafeArchiveEntry(entry) {
  const value = String(entry).replace(/^\.\//, "");
  if (!value || value === ".") return true;
  if (
    value.startsWith("/") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw verifierError("unsafe_archive_entry", { entry });
  }
  const normalized = normalize(value);
  if (
    normalized === ".." ||
    normalized.startsWith(`..${sep}`) ||
    normalized.split(sep).includes("..")
  ) {
    throw verifierError("unsafe_archive_entry", { entry });
  }
  return true;
}

export function detectBackupType(fileName) {
  const name = basename(fileName).replace(/\.age$/, "");
  if (/^fanmind-database-.*\.dump$/u.test(name)) return "database";
  if (/^fanmind-storage-.*\.tar\.gz$/u.test(name)) return "storage";
  if (/^fanmind-server-config-.*\.tar\.gz$/u.test(name)) return "server_config";
  if (/^fanmind-full-.*\.tar\.gz$/u.test(name)) return "full";
  throw verifierError("unknown_backup_type", { fileName: basename(fileName) });
}

export async function sha256File(file) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") throw verifierError("file_not_regular");
    throw verifierError("file_not_readable");
  }

  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const hash = createHash("sha256");
  try {
    const before = await handle.stat({ bigint: true });
    if (!before.isFile()) throw verifierError("file_not_regular");
    let offset = 0n;
    while (offset < before.size) {
      const requested = Number(
        before.size - offset > BigInt(buffer.length)
          ? BigInt(buffer.length)
          : before.size - offset,
      );
      const { bytesRead } = await handle.read(
        buffer,
        0,
        requested,
        Number(offset),
      );
      if (bytesRead <= 0) throw verifierError("file_read_failed");
      hash.update(buffer.subarray(0, bytesRead));
      offset += BigInt(bytesRead);
    }
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      offset !== before.size
    ) {
      throw verifierError("file_changed_during_read");
    }
    return hash.digest("hex");
  } finally {
    buffer.fill(0);
    await handle.close();
  }
}

async function readStableRegularFile(file, maxBytes) {
  let handle;
  try {
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if (error?.code === "ELOOP") throw verifierError("file_not_regular");
    throw verifierError("file_not_readable");
  }
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile() ||
      before.size <= 0n ||
      before.size > BigInt(maxBytes)
    ) {
      throw verifierError("file_size_invalid");
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs ||
      BigInt(bytes.length) !== before.size
    ) {
      throw verifierError("file_changed_during_read");
    }
    return bytes;
  } finally {
    await handle.close();
  }
}

async function snapshotPrivateAgeIdentity(sourcePath, outputPath) {
  let sourceHandle;
  let outputHandle;
  let bytes;
  try {
    sourceHandle = await open(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const before = await sourceHandle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n) {
      throw verifierError("identity_file_not_private_regular");
    }
    if (before.uid !== BigInt(process.getuid()) || (before.mode & 0o077n) !== 0n) {
      throw verifierError("identity_file_permissions_invalid");
    }
    if (
      before.size <= 0n
      || before.size > BigInt(MAX_AGE_IDENTITY_BYTES)
    ) {
      throw verifierError("identity_file_size_invalid");
    }

    bytes = await sourceHandle.readFile();
    const after = await sourceHandle.stat({ bigint: true });
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || BigInt(bytes.length) !== before.size
    ) {
      throw verifierError("identity_file_changed_during_read");
    }

    outputHandle = await open(
      outputPath,
      constants.O_WRONLY
        | constants.O_CREAT
        | constants.O_EXCL
        | constants.O_NOFOLLOW,
      0o600,
    );
    await outputHandle.writeFile(bytes);
    await outputHandle.sync();
    await chmod(outputPath, 0o600);
  } catch (error) {
    if (error?.code === "ELOOP") {
      throw verifierError("identity_file_not_private_regular");
    }
    throw error;
  } finally {
    bytes?.fill(0);
    await outputHandle?.close();
    await sourceHandle?.close();
  }
}

async function snapshotStableRegularFile(sourcePath, outputPath) {
  let sourceHandle;
  let outputHandle;
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  const hash = createHash("sha256");
  let outputPublished = false;
  try {
    sourceHandle = await open(
      sourcePath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    const before = await sourceHandle.stat({ bigint: true });
    if (!before.isFile() || before.nlink !== 1n || before.size <= 0n) {
      throw verifierError("file_not_regular");
    }
    if (before.size > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw verifierError("file_size_invalid");
    }

    outputHandle = await open(
      outputPath,
      constants.O_WRONLY
        | constants.O_CREAT
        | constants.O_EXCL
        | constants.O_NOFOLLOW,
      0o600,
    );
    let offset = 0;
    const expectedSize = Number(before.size);
    while (offset < expectedSize) {
      const requested = Math.min(buffer.length, expectedSize - offset);
      const { bytesRead } = await sourceHandle.read(
        buffer,
        0,
        requested,
        offset,
      );
      if (bytesRead <= 0) throw verifierError("file_read_failed");
      const { bytesWritten } = await outputHandle.write(
        buffer,
        0,
        bytesRead,
        offset,
      );
      if (bytesWritten !== bytesRead) throw verifierError("file_write_failed");
      hash.update(buffer.subarray(0, bytesRead));
      offset += bytesRead;
    }

    const after = await sourceHandle.stat({ bigint: true });
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeNs !== before.mtimeNs
      || after.ctimeNs !== before.ctimeNs
      || BigInt(offset) !== before.size
    ) {
      throw verifierError("file_changed_during_read");
    }
    await outputHandle.sync();
    await chmod(outputPath, 0o600);
    outputPublished = true;
    return {
      checksum: hash.digest("hex"),
      sizeBytes: expectedSize,
    };
  } catch (error) {
    if (error?.code === "ELOOP") throw verifierError("file_not_regular");
    throw error;
  } finally {
    buffer.fill(0);
    await outputHandle?.close();
    await sourceHandle?.close();
    if (!outputPublished) await unlink(outputPath).catch(() => {});
  }
}

async function snapshotVerifiedChecksumPair(
  artifactPath,
  checksumPath,
  snapshotPath,
) {
  const checksumBytes = await readStableRegularFile(checksumPath, 4096);
  let checksum;
  try {
    checksum = parseChecksumLine(
      new TextDecoder("utf-8", { fatal: true }).decode(checksumBytes),
    );
  } catch (error) {
    if (error?.code) throw error;
    throw verifierError("invalid_checksum_file");
  } finally {
    checksumBytes.fill(0);
  }
  if (checksum.fileName !== basename(artifactPath)) {
    throw verifierError("checksum_filename_mismatch");
  }

  const snapshot = await snapshotStableRegularFile(artifactPath, snapshotPath);
  if (snapshot.checksum !== checksum.sha256) {
    throw verifierError("checksum_mismatch");
  }
  return {
    artifact: basename(artifactPath),
    ...snapshot,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      shell: false,
      cwd: options.cwd,
      env: {
        LANG: "C",
        LC_ALL: "C",
        PATH: "/usr/bin:/bin",
        ...(options.env ?? {}),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise({ stdout, stderr });
        return;
      }
      reject(
        verifierError("verification_command_failed", {
          command: basename(command),
          exitCode: code,
          stderr: stderr.slice(-1000),
        }),
      );
    });
  });
}

async function assertReadable(file) {
  await access(file, constants.R_OK).catch(() => {
    throw verifierError("file_not_readable", { file: basename(file) });
  });
}

export async function verifyChecksumPair(artifactPath, checksumPath = `${artifactPath}.sha256`) {
  await assertReadable(artifactPath);
  await assertReadable(checksumPath);
  const checksumBytes = await readStableRegularFile(checksumPath, 4096);
  let checksum;
  try {
    checksum = parseChecksumLine(
      new TextDecoder("utf-8", { fatal: true }).decode(checksumBytes),
    );
  } catch (error) {
    if (error?.code) throw error;
    throw verifierError("invalid_checksum_file");
  } finally {
    checksumBytes.fill(0);
  }
  if (checksum.fileName !== basename(artifactPath)) {
    throw verifierError("checksum_filename_mismatch", {
      expected: basename(artifactPath),
      actual: checksum.fileName,
    });
  }
  const actual = await sha256File(artifactPath);
  if (actual !== checksum.sha256) {
    throw verifierError("checksum_mismatch", {
      expected: checksum.sha256,
      actual,
    });
  }
  const fileStat = await lstat(artifactPath);
  if (!fileStat.isFile()) throw verifierError("file_not_regular");
  return {
    artifact: basename(artifactPath),
    checksum: actual,
    sizeBytes: fileStat.size,
  };
}

async function listTarEntries(file, tarBin = "tar") {
  const { stdout } = await run(tarBin, [
    "--list",
    "--gzip",
    "--quoting-style=escape",
    "--file",
    file,
  ]);
  const entries = stdout
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const seen = new Set();
  for (const entry of entries) {
    assertSafeArchiveEntry(entry);
    const canonical = entry.replace(/^\.\//u, "").replace(/\/$/u, "");
    if (!canonical || canonical === ".") continue;
    if (seen.has(canonical)) {
      throw verifierError("duplicate_archive_entry", { entry: canonical });
    }
    seen.add(canonical);
  }

  const { stdout: verbose } = await run(tarBin, [
    "--list",
    "--verbose",
    "--numeric-owner",
    "--gzip",
    "--quoting-style=escape",
    "--file",
    file,
  ]);
  const verboseEntries = verbose.split("\n").filter(Boolean);
  if (verboseEntries.length !== entries.length) {
    throw verifierError("archive_listing_mismatch");
  }
  for (const line of verboseEntries) {
    if (line[0] !== "-" && line[0] !== "d") {
      throw verifierError("unsafe_archive_entry_type");
    }
  }
  return entries;
}

async function assertExtractedEntries(root, entries) {
  const canonicalRoot = await realpath(root);
  for (const entry of entries) {
    const clean = String(entry).replace(/^\.\//, "").replace(/\/$/u, "");
    if (!clean || clean === ".") continue;
    const candidate = safeManifestPath(root, clean);
    const metadata = await lstat(candidate).catch(() => {
      throw verifierError("archive_entry_missing_after_extract");
    });
    if (!metadata.isFile() && !metadata.isDirectory()) {
      throw verifierError("unsafe_extracted_entry_type");
    }
    if (metadata.isFile() && metadata.nlink !== 1) {
      throw verifierError("unsafe_extracted_link_count");
    }
    const canonical = await realpath(candidate);
    const rel = relative(canonicalRoot, canonical);
    if (rel === ".." || rel.startsWith(`..${sep}`)) {
      throw verifierError("archive_entry_escape_after_extract");
    }
  }
}

export async function extractTar(file, destination, tarBin = "tar") {
  const entries = await listTarEntries(file, tarBin);
  await run(tarBin, [
    "--extract",
    "--gzip",
    "--no-same-owner",
    "--no-same-permissions",
    "--delay-directory-restore",
    "--file",
    file,
    "--directory",
    destination,
  ]);
  await assertExtractedEntries(destination, entries);
  return entries;
}

export function safeManifestPath(root, manifestPath) {
  const clean = String(manifestPath).replace(/^\.\//, "");
  assertSafeArchiveEntry(clean);
  const candidate = resolve(root, clean);
  const rel = relative(resolve(root), candidate);
  if (rel.startsWith("..") || rel.includes(`${sep}..${sep}`)) {
    throw verifierError("manifest_path_escape", { manifestPath });
  }
  return candidate;
}

async function assertSafeExtractedRegularFile(root, file) {
  const [rootCanonical, metadata, canonical] = await Promise.all([
    realpath(root),
    lstat(file).catch(() => {
      throw verifierError("manifest_file_missing");
    }),
    realpath(file).catch(() => {
      throw verifierError("manifest_file_missing");
    }),
  ]);
  if (!metadata.isFile() || metadata.nlink !== 1) {
    throw verifierError("manifest_file_not_regular");
  }
  const rel = relative(rootCanonical, canonical);
  if (rel === ".." || rel.startsWith(`..${sep}`)) {
    throw verifierError("manifest_path_escape");
  }
}

async function assertPrivateOutputTarget(outputPath) {
  if (outputPath !== resolve(outputPath)) {
    throw verifierError("restore_output_path_not_absolute");
  }
  const parent = dirname(outputPath);
  const [metadata, canonicalParent] = await Promise.all([
    lstat(parent).catch(() => {
      throw verifierError("restore_output_directory_unavailable");
    }),
    realpath(parent).catch(() => {
      throw verifierError("restore_output_directory_unavailable");
    }),
  ]);
  if (!metadata.isDirectory() || canonicalParent !== parent) {
    throw verifierError("restore_output_directory_unsafe");
  }
  if (metadata.uid !== process.getuid()) {
    throw verifierError("restore_output_directory_owner_mismatch");
  }
  if ((metadata.mode & 0o077) !== 0) {
    throw verifierError("restore_output_directory_permissions_invalid");
  }
  try {
    await lstat(outputPath);
    throw verifierError("restore_output_already_exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function publishPrivateCopy(sourcePath, outputPath) {
  await assertPrivateOutputTarget(outputPath);
  const temporaryPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.${randomUUID()}.tmp`,
  );
  try {
    await copyFile(sourcePath, temporaryPath, constants.COPYFILE_EXCL);
    await chmod(temporaryPath, 0o600);
    const handle = await open(temporaryPath, constants.O_RDONLY);
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
    await link(temporaryPath, outputPath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function publishPrivateVerifiedCopy(
  sourcePath,
  outputPath,
  expectedSha256,
) {
  await assertPrivateOutputTarget(outputPath);
  const temporaryPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.${randomUUID()}.tmp`,
  );
  try {
    const snapshot = await snapshotStableRegularFile(sourcePath, temporaryPath);
    if (snapshot.checksum !== expectedSha256) {
      throw verifierError("restore_storage_archive_changed_before_publish");
    }
    await link(temporaryPath, outputPath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function publishPrivateBytes(bytes, outputPath) {
  await assertPrivateOutputTarget(outputPath);
  const temporaryPath = join(
    dirname(outputPath),
    `.${basename(outputPath)}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(
      temporaryPath,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
      0o600,
    );
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await link(temporaryPath, outputPath);
  } finally {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function publishRestoreOutputs({
  clearDatabasePath,
  dumpOutputPath,
  receiptOutputPath,
  receipt,
}) {
  await Promise.all([
    assertPrivateOutputTarget(dumpOutputPath),
    assertPrivateOutputTarget(receiptOutputPath),
  ]);
  if (dumpOutputPath === receiptOutputPath) {
    throw verifierError("restore_output_paths_must_differ");
  }

  let dumpPublished = false;
  try {
    await publishPrivateCopy(clearDatabasePath, dumpOutputPath);
    dumpPublished = true;
    await publishPrivateBytes(
      Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8"),
      receiptOutputPath,
    );
  } catch (error) {
    if (dumpPublished) await unlink(dumpOutputPath).catch(() => undefined);
    throw error;
  }
}

async function publishStorageRestoreOutputs({
  clearStoragePath,
  archiveOutputPath,
  receiptOutputPath,
  receipt,
  storageArchiveSha256,
}) {
  await Promise.all([
    assertPrivateOutputTarget(archiveOutputPath),
    assertPrivateOutputTarget(receiptOutputPath),
  ]);
  if (archiveOutputPath === receiptOutputPath) {
    throw verifierError("restore_output_paths_must_differ");
  }

  let archivePublished = false;
  try {
    await publishPrivateVerifiedCopy(
      clearStoragePath,
      archiveOutputPath,
      storageArchiveSha256,
    );
    archivePublished = true;
    await publishPrivateBytes(
      Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8"),
      receiptOutputPath,
    );
  } catch (error) {
    if (archivePublished) await unlink(archiveOutputPath).catch(() => undefined);
    throw error;
  }
}

async function listExtractedStorageFiles(root, directory = root, prefix = "") {
  const names = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of names) {
    const archivePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    assertSafeArchiveEntry(archivePath);
    const filePath = safeManifestPath(root, archivePath);
    const metadata = await lstat(filePath);
    if (entry.isDirectory() && metadata.isDirectory()) {
      files.push(...await listExtractedStorageFiles(root, filePath, archivePath));
      continue;
    }
    if (!entry.isFile() || !metadata.isFile() || metadata.nlink !== 1) {
      throw verifierError("unsafe_storage_archive_entry_type");
    }
    if (archivePath !== "manifest.json") files.push(archivePath);
  }
  return files.sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
}

export async function verifyStorageManifest(root, manifest) {
  if (!manifest || typeof manifest !== "object") {
    throw verifierError("storage_manifest_missing");
  }
  if (manifest.bucket !== "fanmind-assets") {
    throw verifierError("storage_bucket_mismatch");
  }
  if (!Array.isArray(manifest.files)) {
    throw verifierError("storage_manifest_files_missing");
  }
  const seen = new Set();
  let totalSizeBytes = 0;
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== "string" || !SHA256_PATTERN.test(entry.sha256)) {
      throw verifierError("invalid_storage_manifest_entry");
    }
    if (seen.has(entry.path)) throw verifierError("duplicate_storage_manifest_path");
    seen.add(entry.path);
    const file = safeManifestPath(root, entry.path);
    await assertSafeExtractedRegularFile(root, file);
    const fileStat = await lstat(file);
    const actualHash = await sha256File(file);
    if (fileStat.size !== entry.size) {
      throw verifierError("storage_file_size_mismatch", { path: entry.path });
    }
    if (actualHash !== entry.sha256) {
      throw verifierError("storage_file_checksum_mismatch", { path: entry.path });
    }
    totalSizeBytes += fileStat.size;
  }
  if (manifest.object_count !== manifest.files.length) {
    throw verifierError("storage_object_count_mismatch");
  }
  if (
    Number.isInteger(manifest.downloaded_object_count) &&
    manifest.downloaded_object_count !== manifest.files.length
  ) {
    throw verifierError("storage_downloaded_count_mismatch");
  }
  if (
    Number.isInteger(manifest.listed_object_count) &&
    manifest.listed_object_count !== manifest.files.length
  ) {
    throw verifierError("storage_listed_count_mismatch");
  }
  if (manifest.total_size_bytes !== totalSizeBytes) {
    throw verifierError("storage_total_size_mismatch");
  }
  const actualPaths = await listExtractedStorageFiles(root);
  const expectedPaths = [...seen].sort((left, right) =>
    Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8")),
  );
  if (
    actualPaths.length !== expectedPaths.length
    || actualPaths.some((path, index) => path !== expectedPaths[index])
  ) {
    throw verifierError("storage_archive_path_set_mismatch");
  }
  return {
    objectCount: manifest.files.length,
    totalSizeBytes,
  };
}

export async function verifyFullManifest(root, manifest) {
  if (!manifest || typeof manifest !== "object" || !Array.isArray(manifest.parts)) {
    throw verifierError("full_manifest_missing");
  }
  if (!GIT_SHA_PATTERN.test(String(manifest.production_commit ?? ""))) {
    throw verifierError("invalid_production_commit");
  }
  if (manifest.parts.length !== 3) {
    throw verifierError("full_manifest_part_count_mismatch");
  }
  const foundTypes = new Set();
  let databasePart = null;
  let storagePart = null;
  for (const part of manifest.parts) {
    if (
      !part ||
      typeof part.file !== "string" ||
      typeof part.checksum_file !== "string" ||
      !SHA256_PATTERN.test(part.sha256) ||
      !Number.isInteger(part.size_bytes) ||
      !part.manifest ||
      !BACKUP_TYPES.has(part.manifest.backup_type)
    ) {
      throw verifierError("invalid_full_manifest_part");
    }
    if (part.manifest.backup_type === "full") {
      throw verifierError("nested_full_backup_not_allowed");
    }
    if (foundTypes.has(part.manifest.backup_type)) {
      throw verifierError("duplicate_full_backup_part_type");
    }
    foundTypes.add(part.manifest.backup_type);
    const artifact = safeManifestPath(root, part.file);
    const checksum = safeManifestPath(root, part.checksum_file);
    await Promise.all([
      assertSafeExtractedRegularFile(root, artifact),
      assertSafeExtractedRegularFile(root, checksum),
    ]);
    const result = await verifyChecksumPair(artifact, checksum);
    if (result.checksum !== part.sha256 || result.sizeBytes !== part.size_bytes) {
      throw verifierError("full_manifest_part_mismatch", {
        backupType: part.manifest.backup_type,
      });
    }
    if (part.manifest.backup_type === "database") {
      databasePart = {
        file: part.file,
        encryptedSha256: part.sha256,
        manifest: part.manifest,
      };
    } else if (part.manifest.backup_type === "storage") {
      storagePart = {
        file: part.file,
        encryptedSha256: part.sha256,
        manifest: part.manifest,
      };
    }
  }
  for (const requiredType of ["server_config", "database", "storage"]) {
    if (!foundTypes.has(requiredType)) {
      throw verifierError("full_manifest_required_part_missing", { requiredType });
    }
  }
  return {
    productionCommit: manifest.production_commit,
    partCount: manifest.parts.length,
    partTypes: [...foundTypes].sort(),
    databasePart,
    storagePart,
  };
}

async function validateDecryptedArtifact(clearFile, type, options) {
  if (type === "database") {
    await run(options.pgRestoreBin, ["--list", clearFile]);
    return { pgRestoreList: "ok" };
  }

  const extractRoot = await mkdtemp(join(tmpdir(), "fanmind-backup-content-"));
  try {
    if (type === "server_config") {
      const entries = await listTarEntries(clearFile, options.tarBin);
      return { tarEntries: entries.length, archive: "valid" };
    }
    await extractTar(clearFile, extractRoot, options.tarBin);
    const manifestPath = join(extractRoot, "manifest.json");
    await assertSafeExtractedRegularFile(extractRoot, manifestPath).catch(
      (error) => {
        if (error?.code === "manifest_file_missing") {
          throw verifierError(`${type}_manifest_missing`);
        }
        throw error;
      },
    );
    const manifestBytes = await readStableRegularFile(
      manifestPath,
      4 * 1024 * 1024,
    );
    const manifestSha256 = createHash("sha256")
      .update(manifestBytes)
      .digest("hex");
    let manifest;
    try {
      manifest = JSON.parse(
        new TextDecoder("utf-8", { fatal: true }).decode(manifestBytes),
      );
    } catch {
      throw verifierError(`${type}_manifest_invalid`);
    } finally {
      manifestBytes.fill(0);
    }
    if (type === "storage") {
      return {
        ...await verifyStorageManifest(extractRoot, manifest),
        manifestSha256,
      };
    }
    if (type === "full") {
      const validation = await verifyFullManifest(extractRoot, manifest);
      if (!options.restoreOutputs && !options.storageRestoreOutputs) {
        return validation;
      }
      if (!/^[a-f0-9]{40}$/u.test(validation.productionCommit)) {
        throw verifierError("restore_receipt_production_commit_invalid");
      }
      if (options.storageRestoreOutputs) {
        const storagePartPath = safeManifestPath(
          extractRoot,
          validation.storagePart.file,
        );
        await assertSafeExtractedRegularFile(extractRoot, storagePartPath);
        const clearStoragePath = join(extractRoot, ".storage-restore.tar.gz");
        await run(options.ageBin, [
          "--decrypt",
          "--identity",
          options.identityPath,
          "--output",
          clearStoragePath,
          storagePartPath,
        ]);
        await chmod(clearStoragePath, 0o600);
        const storageMetadata = await lstat(clearStoragePath);
        if (!storageMetadata.isFile() || storageMetadata.nlink !== 1) {
          throw verifierError("decrypted_storage_not_regular");
        }
        const storageValidation = await validateDecryptedArtifact(
          clearStoragePath,
          "storage",
          { ...options, restoreOutputs: null, storageRestoreOutputs: null },
        );
        const storageArchiveSha256 = await sha256File(clearStoragePath);
        const receipt = {
          schemaVersion: 1,
          createdAt: new Date().toISOString(),
          sourceArtifactBasename: options.sourceArtifactBasename,
          outerSha256: options.outerSha256,
          productionCommit: validation.productionCommit,
          storagePartEncryptedSha256: validation.storagePart.encryptedSha256,
          storageArchiveSha256,
          storageManifestSha256: storageValidation.manifestSha256,
          storageBucket: "fanmind-assets",
          storageObjectCount: storageValidation.objectCount,
          storageTotalSizeBytes: storageValidation.totalSizeBytes,
          verifier: "passed",
        };
        await publishStorageRestoreOutputs({
          clearStoragePath,
          ...options.storageRestoreOutputs,
          receipt,
          storageArchiveSha256,
        });
        return {
          ...validation,
          storageRestoreArchive: "created",
          storageRestoreReceipt: "created",
        };
      }
      const databaseManifest = validation.databasePart.manifest;
      if (databaseManifest.format_version !== 2) {
        throw verifierError("restore_database_manifest_version_invalid");
      }
      if (
        databaseManifest.privileges_archived !== true
        || databaseManifest.ownership_archived !== true
      ) {
        throw verifierError("restore_database_authorization_flags_invalid");
      }
      const authorizationContract = validateDatabaseAuthorizationManifest(
        databaseManifest.authorization_contract,
      );

      const databasePartPath = safeManifestPath(
        extractRoot,
        validation.databasePart.file,
      );
      await assertSafeExtractedRegularFile(extractRoot, databasePartPath);
      const clearDatabasePath = join(extractRoot, ".database-restore.dump");
      await run(options.ageBin, [
        "--decrypt",
        "--identity",
        options.identityPath,
        "--output",
        clearDatabasePath,
        databasePartPath,
      ]);
      await chmod(clearDatabasePath, 0o600);
      const databaseMetadata = await lstat(clearDatabasePath);
      if (!databaseMetadata.isFile() || databaseMetadata.nlink !== 1) {
        throw verifierError("decrypted_database_not_regular");
      }
      const tocResult = await run(options.pgRestoreBin, [
        "--list",
        clearDatabasePath,
      ]);
      let authorizationToc;
      try {
        authorizationToc = analyzeAuthorizationToc(tocResult.stdout);
      } catch {
        throw verifierError("restore_database_authorization_toc_invalid");
      }
      if (
        authorizationToc.aclEntryCount <= 0
        || authorizationToc.defaultAclEntryCount <= 0
        || authorizationToc.aclEntryCount
          !== databaseManifest.authorization_contract.archive_acl_toc_entry_count
        || authorizationToc.defaultAclEntryCount
          !== databaseManifest.authorization_contract.archive_default_acl_toc_entry_count
        || authorizationToc.sha256
          !== databaseManifest.authorization_contract.archive_acl_toc_sha256
      ) {
        throw verifierError("restore_database_authorization_toc_mismatch");
      }
      const databaseDumpSha256 = await sha256File(clearDatabasePath);
      const receipt = {
        schemaVersion: 2,
        createdAt: new Date().toISOString(),
        sourceArtifactBasename: options.sourceArtifactBasename,
        outerSha256: options.outerSha256,
        productionCommit: validation.productionCommit,
        databasePartEncryptedSha256:
          validation.databasePart.encryptedSha256,
        databaseDumpSha256,
        databaseAuthorizationContractVersion:
          authorizationContract.schemaVersion,
        databaseAuthorizationFingerprintSha256:
          authorizationContract.fingerprintSha256,
        databaseAuthorizationRecordCount:
          authorizationContract.recordCount,
        databaseAuthorizationGrantTupleCount:
          authorizationContract.grantTupleCount,
        databaseAuthorizationRequiredRoles:
          authorizationContract.requiredRoles,
        databaseAuthorizationRequiredRolesSha256:
          authorizationContract.requiredRolesSha256,
        databaseAuthorizationRoleFingerprintSha256:
          authorizationContract.roleFingerprintSha256,
        databaseAuthorizationRoleRecordCount:
          authorizationContract.roleRecordCount,
        databaseAuthorizationContainerFingerprintSha256:
          authorizationContract.databaseContainerFingerprintSha256,
        databaseAuthorizationContainerRecordCount:
          authorizationContract.databaseContainerRecordCount,
        databaseAuthorizationRequiredExtensions:
          authorizationContract.requiredExtensions,
        databaseAuthorizationRequiredExtensionsSha256:
          authorizationContract.requiredExtensionsSha256,
        databaseAuthorizationExtensionFingerprintSha256:
          authorizationContract.extensionFingerprintSha256,
        databaseAuthorizationExtensionRecordCount:
          authorizationContract.extensionRecordCount,
        databaseCoreTableAppGrantTupleCount:
          authorizationContract.coreTableAppGrantTupleCount,
        databaseRestrictedSecurityDefinerFunctionCount:
          authorizationContract.restrictedSecurityDefinerFunctionCount,
        databaseAclTocEntryCount: authorizationToc.aclEntryCount,
        databaseDefaultAclTocEntryCount:
          authorizationToc.defaultAclEntryCount,
        databaseAclTocSha256: authorizationToc.sha256,
        databasePrivilegesArchived: true,
        databaseOwnershipArchived: true,
        verifier: "passed",
      };
      await publishRestoreOutputs({
        clearDatabasePath,
        ...options.restoreOutputs,
        receipt,
      });
      return {
        ...validation,
        restoreDump: "created",
        restoreReceipt: "created",
      };
    }
    throw verifierError("unsupported_backup_type", { type });
  } finally {
    await rm(extractRoot, { recursive: true, force: true });
  }
}

export async function verifyBackupArtifact(input) {
  const artifactPath = resolve(input.artifactPath);
  const type = input.type ?? detectBackupType(artifactPath);
  const databaseRestoreOutputRequested = Boolean(
    input.restoreDumpOutputPath || input.restoreReceiptOutputPath,
  );
  const storageRestoreOutputRequested = Boolean(
    input.restoreStorageArchiveOutputPath
      || input.restoreStorageReceiptOutputPath,
  );
  if (
    databaseRestoreOutputRequested &&
    (!input.restoreDumpOutputPath || !input.restoreReceiptOutputPath)
  ) {
    throw verifierError("restore_outputs_must_be_paired");
  }
  if (
    storageRestoreOutputRequested
    && (!input.restoreStorageArchiveOutputPath
      || !input.restoreStorageReceiptOutputPath)
  ) {
    throw verifierError("restore_storage_outputs_must_be_paired");
  }
  if (databaseRestoreOutputRequested && storageRestoreOutputRequested) {
    throw verifierError("restore_output_modes_must_not_mix");
  }
  const restoreOutputRequested =
    databaseRestoreOutputRequested || storageRestoreOutputRequested;
  if (restoreOutputRequested && (!input.identityPath || type !== "full")) {
    throw verifierError("restore_outputs_require_decrypted_full_backup");
  }
  if (
    restoreOutputRequested &&
    !FULL_BACKUP_BASENAME.test(basename(artifactPath))
  ) {
    throw verifierError("restore_receipt_artifact_name_invalid");
  }
  const restoreOutputs = restoreOutputRequested
    && databaseRestoreOutputRequested
    ? {
        dumpOutputPath: resolve(input.restoreDumpOutputPath),
        receiptOutputPath: resolve(input.restoreReceiptOutputPath),
      }
    : null;
  const storageRestoreOutputs = storageRestoreOutputRequested
    ? {
        archiveOutputPath: resolve(input.restoreStorageArchiveOutputPath),
        receiptOutputPath: resolve(input.restoreStorageReceiptOutputPath),
      }
    : null;
  if (restoreOutputs) {
    if (
      input.restoreDumpOutputPath !== restoreOutputs.dumpOutputPath ||
      input.restoreReceiptOutputPath !== restoreOutputs.receiptOutputPath
    ) {
      throw verifierError("restore_output_path_not_absolute");
    }
    await Promise.all([
      assertPrivateOutputTarget(restoreOutputs.dumpOutputPath),
      assertPrivateOutputTarget(restoreOutputs.receiptOutputPath),
    ]);
    if (restoreOutputs.dumpOutputPath === restoreOutputs.receiptOutputPath) {
      throw verifierError("restore_output_paths_must_differ");
    }
  }
  if (storageRestoreOutputs) {
    if (
      input.restoreStorageArchiveOutputPath
        !== storageRestoreOutputs.archiveOutputPath
      || input.restoreStorageReceiptOutputPath
        !== storageRestoreOutputs.receiptOutputPath
    ) {
      throw verifierError("restore_output_path_not_absolute");
    }
    await Promise.all([
      assertPrivateOutputTarget(storageRestoreOutputs.archiveOutputPath),
      assertPrivateOutputTarget(storageRestoreOutputs.receiptOutputPath),
    ]);
    if (
      storageRestoreOutputs.archiveOutputPath
        === storageRestoreOutputs.receiptOutputPath
    ) {
      throw verifierError("restore_output_paths_must_differ");
    }
  }
  const checksumPath = input.checksumPath
    ? resolve(input.checksumPath)
    : `${artifactPath}.sha256`;
  if (!input.identityPath) {
    const checksumResult = await verifyChecksumPair(artifactPath, checksumPath);
    return {
      ok: true,
      mode: "checksum_only",
      backupType: type,
      ...checksumResult,
      contentValidation: null,
    };
  }

  const workRoot = await mkdtemp(join(tmpdir(), "fanmind-backup-verify-"));
  const artifactSnapshotPath = join(workRoot, basename(artifactPath));
  const clearFile = join(
    workRoot,
    basename(artifactPath).replace(/\.age$/, ""),
  );
  const identitySnapshotPath = join(workRoot, ".age-identity");
  try {
    const checksumResult = await snapshotVerifiedChecksumPair(
      artifactPath,
      checksumPath,
      artifactSnapshotPath,
    );
    const result = {
      ok: true,
      mode: "decrypted",
      backupType: type,
      ...checksumResult,
      contentValidation: null,
    };
    const identityPath = resolve(input.identityPath);
    if (input.identityPath !== identityPath) {
      throw verifierError("identity_path_not_absolute");
    }
    await snapshotPrivateAgeIdentity(identityPath, identitySnapshotPath);
    await run(input.ageBin ?? "age", [
      "--decrypt",
      "--identity",
      identitySnapshotPath,
      "--output",
      clearFile,
      artifactSnapshotPath,
    ]);
    result.contentValidation = await validateDecryptedArtifact(clearFile, type, {
      ageBin: input.ageBin ?? "age",
      identityPath: identitySnapshotPath,
      pgRestoreBin: input.pgRestoreBin ?? "/usr/lib/postgresql/17/bin/pg_restore",
      tarBin: input.tarBin ?? "tar",
      restoreOutputs,
      storageRestoreOutputs,
      sourceArtifactBasename: basename(artifactPath),
      outerSha256: checksumResult.checksum,
    });
    return result;
  } finally {
    await rm(workRoot, { recursive: true, force: true });
  }
}

function parseCli(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--artifact") options.artifactPath = argv[++index];
    else if (value === "--checksum") options.checksumPath = argv[++index];
    else if (value === "--identity") options.identityPath = argv[++index];
    else if (value === "--type") options.type = argv[++index];
    else if (value === "--age-bin") options.ageBin = argv[++index];
    else if (value === "--pg-restore-bin") options.pgRestoreBin = argv[++index];
    else if (value === "--tar-bin") options.tarBin = argv[++index];
    else if (value === "--restore-dump-output") {
      options.restoreDumpOutputPath = argv[++index];
    } else if (value === "--restore-receipt-output") {
      options.restoreReceiptOutputPath = argv[++index];
    } else if (value === "--restore-storage-archive-output") {
      options.restoreStorageArchiveOutputPath = argv[++index];
    } else if (value === "--restore-storage-receipt-output") {
      options.restoreStorageReceiptOutputPath = argv[++index];
    }
    else if (value === "--json") options.json = true;
    else if (value === "--help") options.help = true;
    else throw verifierError("unknown_argument", { argument: value });
  }
  return options;
}

function usage() {
  return `FanMind read-only backup verifier

Usage:
  node scripts/operations/verify-backup-artifact.mjs --artifact /path/backup.age [options]

Options:
  --checksum PATH       Adjacent checksum file; default: <artifact>.sha256
  --identity PATH       age identity for decrypt/content validation
  --type TYPE           database | storage | server_config | full; default: detect
  --age-bin PATH        age executable; default: age
  --pg-restore-bin PATH pg_restore executable
  --tar-bin PATH        tar executable; default: tar
  --restore-dump-output PATH
                        Private new plaintext dump output (full + identity only)
  --restore-receipt-output PATH
                        Private new cryptographic receipt (paired with dump)
  --restore-storage-archive-output PATH
                        Private verified plaintext Storage archive (full + identity only)
  --restore-storage-receipt-output PATH
                        Private cryptographic receipt (paired with Storage archive)
  --json                JSON output

Without --identity the verifier performs a non-destructive checksum-only check.
It never restores data and never writes into the backup directory. Restore
outputs are opt-in, never overwrite files and require private output
directories.`;
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  if (!options.artifactPath) throw verifierError("artifact_argument_required");
  if (options.type && !BACKUP_TYPES.has(options.type)) {
    throw verifierError("invalid_backup_type", { type: options.type });
  }
  const result = await verifyBackupArtifact(options);
  if (options.json) console.log(JSON.stringify(result));
  else {
    console.log(`FanMind backup verification: OK`);
    console.log(`artifact=${result.artifact}`);
    console.log(`backup_type=${result.backupType}`);
    console.log(`mode=${result.mode}`);
    console.log(`sha256=${result.checksum}`);
    console.log(`size_bytes=${result.sizeBytes}`);
    if (result.contentValidation) {
      console.log(`content_validation=${JSON.stringify(result.contentValidation)}`);
    }
  }
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    const code = error?.code ?? error?.message ?? "backup_verification_failed";
    console.error(`FanMind backup verification: FAILED (${code})`);
    process.exitCode = 1;
  });
}

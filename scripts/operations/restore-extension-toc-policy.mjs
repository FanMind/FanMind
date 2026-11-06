#!/usr/bin/env node

import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  parseFullBackupRestoreReceipt,
  readStablePrivateFile,
} from "./verify-full-backup-restore-receipt.mjs";

const MAX_TOC_BYTES = 32 * 1024 * 1024;
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_$-]{0,62}$/u;
const SAFE_EXTENSION_VERSION = /^[^\s\u0000-\u001f\u007f]{1,128}$/u;
const BUILTIN_TOC_EXEMPT_EXTENSION = "plpgsql";

const STATUS = Object.freeze({
  extensionSchemaMissing: 41,
  extensionSchemaAmbiguous: 42,
  tocEntryInvalid: 43,
  duplicateDumpId: 44,
  extensionEntryUnbound: 45,
  extensionEntryAmbiguous: 46,
  receiptPolicyInvalid: 47,
  ioFailure: 48,
  extensionEntryMissing: 49,
  builtinExtensionEntryUnexpected: 50,
});

function fixedError(code, status) {
  const error = new Error(code);
  error.code = code;
  error.status = status;
  return error;
}

function requiredExtensionPolicy(requiredExtensions) {
  if (!Array.isArray(requiredExtensions) || requiredExtensions.length === 0) {
    throw fixedError(
      "extension_receipt_policy_invalid",
      STATUS.receiptPolicyInvalid,
    );
  }

  const extensionNames = new Set();
  const schemas = new Map();
  for (const descriptor of requiredExtensions) {
    const keys = descriptor && typeof descriptor === "object"
      ? Object.keys(descriptor).sort()
      : [];
    const expectedKeys = [
      "name",
      "owner",
      "relocatable",
      "schema",
      "schemaDefinitionArchived",
      "schemaOwner",
      "version",
    ].sort();
    if (
      !descriptor
      || typeof descriptor !== "object"
      || Array.isArray(descriptor)
      || keys.length !== expectedKeys.length
      || keys.some((key, index) => key !== expectedKeys[index])
      || !SAFE_IDENTIFIER.test(descriptor.name)
      || !SAFE_IDENTIFIER.test(descriptor.schema)
      || !SAFE_IDENTIFIER.test(descriptor.owner)
      || !SAFE_IDENTIFIER.test(descriptor.schemaOwner)
      || typeof descriptor.version !== "string"
      || Buffer.byteLength(descriptor.version, "utf8") > 128
      || !SAFE_EXTENSION_VERSION.test(descriptor.version)
      || typeof descriptor.relocatable !== "boolean"
      || typeof descriptor.schemaDefinitionArchived !== "boolean"
    ) {
      throw fixedError(
        "extension_receipt_policy_invalid",
        STATUS.receiptPolicyInvalid,
      );
    }
    if (extensionNames.has(descriptor.name)) {
      throw fixedError(
        "extension_receipt_policy_invalid",
        STATUS.receiptPolicyInvalid,
      );
    }
    extensionNames.add(descriptor.name);

    const prior = schemas.get(descriptor.schema);
    const policy = Object.freeze({
      name: descriptor.schema,
      owner: descriptor.schemaOwner,
      archived: descriptor.schemaDefinitionArchived,
    });
    if (
      prior
      && (
        prior.owner !== policy.owner
        || prior.archived !== policy.archived
      )
    ) {
      throw fixedError(
        "extension_receipt_policy_invalid",
        STATUS.receiptPolicyInvalid,
      );
    }
    schemas.set(descriptor.schema, prior ?? policy);
  }

  const archivedSchemas = [...schemas.values()].filter((schema) => {
    if (!schema.archived) return false;
    if (
      schema.name === "public"
      || schema.name === "information_schema"
      || schema.name.startsWith("pg_")
    ) {
      throw fixedError(
        "extension_receipt_policy_invalid",
        STATUS.receiptPolicyInvalid,
      );
    }
    return true;
  });

  return Object.freeze({ extensionNames, schemas, archivedSchemas });
}

export function filterExtensionHostSchemaToc(text, requiredExtensions) {
  if (
    typeof text !== "string"
    || text.length === 0
    || Buffer.byteLength(text, "utf8") > MAX_TOC_BYTES
    || text.includes("\u0000")
  ) {
    throw fixedError("dump_archive_toc_entry_invalid", STATUS.tocEntryInvalid);
  }
  const policy = requiredExtensionPolicy(requiredExtensions);
  const seenDumpIds = new Set();
  const seenExtensionNames = new Set();
  const schemaCandidates = new Map(
    [...policy.schemas.keys()].map((schema) => [schema, []]),
  );
  const output = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (!line || line.startsWith(";")) {
      output.push(line);
      continue;
    }

    const header = line.match(/^([1-9][0-9]*); ([0-9]+) ([0-9]+) (.+)$/u);
    if (!header) {
      throw fixedError("dump_archive_toc_entry_invalid", STATUS.tocEntryInvalid);
    }
    if (seenDumpIds.has(header[1])) {
      throw fixedError("dump_archive_toc_duplicate_id", STATUS.duplicateDumpId);
    }
    seenDumpIds.add(header[1]);

    const schemaEntry = line.match(
      /^([1-9][0-9]*); ([0-9]+) ([0-9]+) SCHEMA - ([A-Za-z_][A-Za-z0-9_$-]{0,62}) ([A-Za-z_][A-Za-z0-9_$-]{0,62})$/u,
    );
    if (schemaEntry && schemaCandidates.has(schemaEntry[4])) {
      schemaCandidates.get(schemaEntry[4]).push({
        line,
        catalogOid: schemaEntry[2],
        objectOid: schemaEntry[3],
        owner: schemaEntry[5],
        outputIndex: output.length,
      });
    } else if (header[4].startsWith("SCHEMA - ")) {
      const possibleSchema = header[4].slice("SCHEMA - ".length).split(" ")[0];
      if (schemaCandidates.has(possibleSchema)) {
        throw fixedError(
          "dump_extension_schema_entry_ambiguous",
          STATUS.extensionSchemaAmbiguous,
        );
      }
    }

    const extensionEntry = line.match(
      /^([1-9][0-9]*); 3079 ([1-9][0-9]*) EXTENSION - ([A-Za-z0-9_][A-Za-z0-9_-]{0,62})[ ]*$/u,
    );
    if (extensionEntry) {
      const extensionName = extensionEntry[3];
      if (extensionName === BUILTIN_TOC_EXEMPT_EXTENSION) {
        throw fixedError(
          "dump_extension_builtin_entry_unexpected",
          STATUS.builtinExtensionEntryUnexpected,
        );
      }
      if (!policy.extensionNames.has(extensionName)) {
        throw fixedError(
          "dump_extension_entry_unbound",
          STATUS.extensionEntryUnbound,
        );
      }
      if (seenExtensionNames.has(extensionName)) {
        throw fixedError(
          "dump_extension_entry_ambiguous",
          STATUS.extensionEntryAmbiguous,
        );
      }
      seenExtensionNames.add(extensionName);
    } else if (header[4].startsWith("EXTENSION ")) {
      throw fixedError(
        "dump_extension_entry_ambiguous",
        STATUS.extensionEntryAmbiguous,
      );
    }

    output.push(line);
  }

  for (const extensionName of policy.extensionNames) {
    if (
      extensionName !== BUILTIN_TOC_EXEMPT_EXTENSION
      && !seenExtensionNames.has(extensionName)
    ) {
      throw fixedError(
        "dump_extension_entry_missing",
        STATUS.extensionEntryMissing,
      );
    }
  }

  for (const schema of policy.schemas.values()) {
    const candidates = schemaCandidates.get(schema.name);
    if (!schema.archived) {
      if (candidates.length !== 0) {
        throw fixedError(
          "dump_extension_schema_entry_ambiguous",
          STATUS.extensionSchemaAmbiguous,
        );
      }
      continue;
    }
    if (candidates.length === 0) {
      throw fixedError(
        "dump_extension_schema_entry_missing",
        STATUS.extensionSchemaMissing,
      );
    }
    if (
      candidates.length !== 1
      || candidates[0].catalogOid !== "2615"
      || candidates[0].objectOid === "0"
      || candidates[0].owner !== schema.owner
    ) {
      throw fixedError(
        "dump_extension_schema_entry_ambiguous",
        STATUS.extensionSchemaAmbiguous,
      );
    }
    const candidate = candidates[0];
    output[candidate.outputIndex] = `;${candidate.line}`;
  }

  return `${output.join("\n")}`;
}

async function readStableToc(path) {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch {
    throw fixedError("dump_archive_toc_read_failed", STATUS.ioFailure);
  }
  try {
    const before = await handle.stat({ bigint: true });
    if (
      !before.isFile()
      || before.nlink !== 1n
      || typeof process.getuid !== "function"
      || before.uid !== BigInt(process.getuid())
      || (before.mode & 0o777n) !== 0o600n
      || before.size <= 0n
      || before.size > BigInt(MAX_TOC_BYTES)
    ) {
      throw fixedError("dump_archive_toc_read_failed", STATUS.ioFailure);
    }
    const bytes = await handle.readFile();
    const after = await handle.stat({ bigint: true });
    if (
      before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || before.mtimeNs !== after.mtimeNs
      || before.ctimeNs !== after.ctimeNs
      || BigInt(bytes.length) !== before.size
    ) {
      throw fixedError("dump_archive_toc_read_failed", STATUS.ioFailure);
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw fixedError("dump_archive_toc_entry_invalid", STATUS.tocEntryInvalid);
    } finally {
      bytes.fill(0);
    }
  } finally {
    await handle.close();
  }
}

async function writeExclusivePrivate(path, value) {
  let handle;
  try {
    handle = await open(
      path,
      constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW,
      0o600,
    );
    await handle.writeFile(value, { encoding: "utf8" });
    await handle.sync();
  } catch {
    throw fixedError("dump_restore_toc_write_failed", STATUS.ioFailure);
  } finally {
    await handle?.close();
  }
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Map([
    ["--receipt", "receiptPath"],
    ["--archive-toc", "archiveTocPath"],
    ["--output", "outputPath"],
  ]);
  for (let index = 0; index < argv.length; index += 2) {
    const key = allowed.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value || value.startsWith("-") || values[key]) {
      throw fixedError("extension_toc_usage_invalid", STATUS.receiptPolicyInvalid);
    }
    values[key] = value;
  }
  if (Object.keys(values).length !== allowed.size) {
    throw fixedError("extension_toc_usage_invalid", STATUS.receiptPolicyInvalid);
  }
  if (
    !isAbsolute(values.receiptPath)
    || !isAbsolute(values.archiveTocPath)
    || !isAbsolute(values.outputPath)
  ) {
    throw fixedError("extension_toc_usage_invalid", STATUS.receiptPolicyInvalid);
  }
  const receiptPath = resolve(values.receiptPath);
  const archiveTocPath = resolve(values.archiveTocPath);
  const outputPath = resolve(values.outputPath);
  if (
    dirname(receiptPath) !== dirname(archiveTocPath)
    || dirname(outputPath) !== dirname(archiveTocPath)
    || new Set([receiptPath, archiveTocPath, outputPath]).size !== 3
  ) {
    throw fixedError("extension_toc_usage_invalid", STATUS.receiptPolicyInvalid);
  }
  return { receiptPath, archiveTocPath, outputPath };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof process.getuid !== "function") {
    throw fixedError("extension_toc_usage_invalid", STATUS.receiptPolicyInvalid);
  }
  const parent = await lstat(dirname(args.outputPath)).catch(() => null);
  if (
    !parent?.isDirectory()
    || parent.isSymbolicLink()
    || parent.uid !== process.getuid()
    || (parent.mode & 0o777) !== 0o700
  ) {
    throw fixedError("extension_toc_usage_invalid", STATUS.receiptPolicyInvalid);
  }
  const [receiptBytes, toc] = await Promise.all([
    readStablePrivateFile(args.receiptPath, "full_backup_receipt"),
    readStableToc(args.archiveTocPath),
  ]);
  try {
    const receipt = parseFullBackupRestoreReceipt(receiptBytes);
    const filtered = filterExtensionHostSchemaToc(
      toc,
      receipt.databaseAuthorizationRequiredExtensions,
    );
    await writeExclusivePrivate(args.outputPath, filtered);
  } finally {
    receiptBytes.fill(0);
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    const code = typeof error?.code === "string"
      ? error.code
      : "extension_toc_policy_failed";
    process.stderr.write(`EXTENSION_TOC_POLICY_ERROR=${code}\n`);
    process.exitCode = Number.isInteger(error?.status)
      ? error.status
      : STATUS.ioFailure;
  });
}

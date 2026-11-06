#!/usr/bin/env node

import { createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  open,
  readFile,
  realpath,
} from "node:fs/promises";
import {
  dirname,
  isAbsolute,
  relative,
  resolve,
} from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const defaultPrivateRoot = resolve(root, "docs/legal/private-evidence");
const defaultRegisterPath = resolve(
  root,
  "docs/legal/external-approval-evidence.json",
);
const maxEvidenceBytes = 25 * 1024 * 1024;
const operatorControlIds = [
  "vatId",
  "companyRegisterNumber",
  "companyRegisterCourt",
  "gisaNumber",
  "taxMode",
];
const approvalControlIds = [
  "legalReview",
  "taxReview",
  "retentionDecision",
  "customerDpa",
];
const providerControlIds = ["dpa", "dataLocation", "transferAssessment"];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function isInside(parent, candidate) {
  const child = relative(parent, candidate);
  return child === "" || (!child.startsWith("..") && !isAbsolute(child));
}

function assertPrivateMetadata(metadata, type) {
  if (
    (type === "directory" && !metadata.isDirectory())
    || (type === "file" && !metadata.isFile())
    || metadata.isSymbolicLink()
  ) {
    fail(`evidence_${type}_invalid`);
  }
  if ((metadata.mode & 0o077) !== 0) {
    fail(`evidence_${type}_permissions_invalid`);
  }
  if (
    typeof process.getuid === "function"
    && metadata.uid !== process.getuid()
  ) {
    fail(`evidence_${type}_owner_invalid`);
  }
}

export function collectRegisteredControlIds(evidence) {
  if (!evidence || typeof evidence !== "object" || Array.isArray(evidence)) {
    fail("evidence_register_invalid");
  }

  const ids = new Set();
  for (const key of operatorControlIds) {
    if (evidence.operator?.[key]) ids.add(`operator.${key}`);
  }
  for (const key of approvalControlIds) {
    if (evidence.approvals?.[key]) ids.add(`approvals.${key}`);
  }
  if (!Array.isArray(evidence.providers)) {
    fail("evidence_register_invalid");
  }
  for (const provider of evidence.providers) {
    if (!provider?.id || typeof provider.id !== "string") {
      fail("evidence_register_invalid");
    }
    for (const key of providerControlIds) {
      if (provider[key]) ids.add(`provider.${provider.id}.${key}`);
    }
  }
  return ids;
}

export async function requireRegisteredControl(
  controlId,
  registerPath = defaultRegisterPath,
) {
  if (
    typeof controlId !== "string"
    || !/^[a-z][a-zA-Z0-9]*(?:\.[a-z][a-zA-Z0-9]*){1,2}$/u.test(controlId)
  ) {
    fail("evidence_control_invalid");
  }

  let evidence;
  try {
    evidence = JSON.parse(await readFile(registerPath, "utf8"));
  } catch {
    fail("evidence_register_invalid");
  }
  if (!collectRegisteredControlIds(evidence).has(controlId)) {
    fail("evidence_control_unknown");
  }
}

export async function hashPrivateEvidenceFile({
  file,
  privateRoot = defaultPrivateRoot,
  maximumBytes = maxEvidenceBytes,
}) {
  if (
    typeof file !== "string"
    || file.length === 0
    || file.includes("\0")
    || !Number.isSafeInteger(maximumBytes)
    || maximumBytes < 1
  ) {
    fail("evidence_file_invalid");
  }

  let rootMetadata;
  try {
    rootMetadata = await lstat(privateRoot);
  } catch {
    fail("evidence_directory_invalid");
  }
  assertPrivateMetadata(rootMetadata, "directory");

  const candidate = resolve(privateRoot, file);
  if (!isInside(resolve(privateRoot), candidate)) {
    fail("evidence_path_outside_private_root");
  }

  let sourceMetadata;
  let resolvedPrivateRoot;
  let resolvedCandidate;
  try {
    [sourceMetadata, resolvedPrivateRoot, resolvedCandidate] = await Promise.all([
      lstat(candidate),
      realpath(privateRoot),
      realpath(candidate),
    ]);
  } catch {
    fail("evidence_file_invalid");
  }
  assertPrivateMetadata(sourceMetadata, "file");
  if (!isInside(resolvedPrivateRoot, resolvedCandidate)) {
    fail("evidence_path_outside_private_root");
  }
  if (sourceMetadata.size < 1 || sourceMetadata.size > maximumBytes) {
    fail("evidence_file_size_invalid");
  }

  let handle;
  try {
    handle = await open(
      candidate,
      constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0),
    );
  } catch {
    fail("evidence_file_invalid");
  }

  const buffer = Buffer.allocUnsafe(64 * 1024);
  try {
    const before = await handle.stat();
    assertPrivateMetadata(before, "file");
    if (
      before.dev !== sourceMetadata.dev
      || before.ino !== sourceMetadata.ino
      || before.size !== sourceMetadata.size
    ) {
      fail("evidence_file_changed");
    }

    const hash = createHash("sha256");
    let position = 0;
    while (position < before.size) {
      const { bytesRead } = await handle.read(
        buffer,
        0,
        Math.min(buffer.length, before.size - position),
        position,
      );
      if (bytesRead === 0) fail("evidence_file_changed");
      hash.update(buffer.subarray(0, bytesRead));
      buffer.fill(0, 0, bytesRead);
      position += bytesRead;
    }

    const after = await handle.stat();
    if (
      after.dev !== before.dev
      || after.ino !== before.ino
      || after.size !== before.size
      || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs
    ) {
      fail("evidence_file_changed");
    }

    return `sha256:${hash.digest("hex")}`;
  } finally {
    buffer.fill(0);
    await handle.close();
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--control" && args.control === undefined) {
      args.control = argv[++index];
    } else if (value === "--file" && args.file === undefined) {
      args.file = argv[++index];
    } else {
      fail("usage_invalid");
    }
  }
  if (
    !args.control
    || !args.file
    || args.control.startsWith("-")
    || args.file.startsWith("-")
  ) {
    fail("usage_invalid");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await requireRegisteredControl(args.control);
  const evidenceRef = await hashPrivateEvidenceFile({ file: args.file });
  console.log(`LEGAL_EXTERNAL_EVIDENCE_CONTROL=${args.control}`);
  console.log(`LEGAL_EXTERNAL_EVIDENCE_REF=${evidenceRef}`);
  console.log("LEGAL_EXTERNAL_EVIDENCE_REGISTER_UPDATE=manual_required");
  console.log("LEGAL_EXTERNAL_EVIDENCE_PRIVATE_CONTENT_OUTPUT=false");
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    const code =
      typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
        ? error.code
        : "evidence_hash_failed";
    console.error(`LEGAL_EXTERNAL_EVIDENCE_HASH_ERROR=${code}`);
    console.error("LEGAL_EXTERNAL_EVIDENCE_PRIVATE_CONTENT_OUTPUT=false");
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateMobileSignedBuildCompletion } from "./mobile-signed-build-completion.mjs";
import {
  readStablePrivateFile,
  sha256Bytes,
} from "./verify-full-backup-restore-receipt.mjs";

const MAX_BUILD_REPORT_BYTES = 256 * 1024;

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--queue" && args.queue === undefined) {
      args.queue = argv[++index];
    } else if (value === "--completion" && args.completion === undefined) {
      args.completion = argv[++index];
    } else if (value === "--output" && args.output === undefined) {
      args.output = argv[++index];
    } else {
      fail("usage_invalid");
    }
  }
  for (const field of ["queue", "completion", "output"]) {
    if (
      typeof args[field] !== "string" ||
      !args[field] ||
      args[field].startsWith("-")
    ) {
      fail("usage_invalid");
    }
  }
  return args;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail(`${label}_json_invalid`);
  }
}

function singleRecord(value, label) {
  if (Array.isArray(value)) {
    if (value.length !== 1) fail(`${label}_record_invalid`);
    return value[0];
  }
  if (!value || typeof value !== "object") {
    fail(`${label}_record_invalid`);
  }
  return value;
}

async function assertPrivateOutput(outputPath) {
  if (outputPath !== resolve(outputPath)) fail("output_path_not_absolute");
  const parent = dirname(outputPath);
  const [metadata, canonical] = await Promise.all([
    lstat(parent).catch(() => fail("output_directory_unavailable")),
    realpath(parent).catch(() => fail("output_directory_unavailable")),
  ]);
  if (!metadata.isDirectory() || canonical !== parent) {
    fail("output_directory_unsafe");
  }
  if (metadata.uid !== process.getuid()) fail("output_directory_owner_mismatch");
  if ((metadata.mode & 0o077) !== 0) {
    fail("output_directory_permissions_invalid");
  }
  try {
    await lstat(outputPath);
    fail("output_already_exists");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  return parent;
}

async function writePrivateAtomic(outputPath, bytes) {
  const parent = await assertPrivateOutput(outputPath);
  const temporaryPath = join(
    parent,
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

export async function createMobileSignedBuildReceipt({
  queueBytes,
  completionBytes,
  environment = process.env,
}) {
  const queueOutput = parseJson(queueBytes, "signed_build_queue");
  const completionOutput = parseJson(
    completionBytes,
    "signed_build_completion",
  );
  const completion = singleRecord(
    completionOutput,
    "signed_build_completion",
  );
  const result = evaluateMobileSignedBuildCompletion({
    queueOutput,
    completionOutput,
    environment,
  });
  if (
    result.state !== "verified" ||
    !["internal", "store"].includes(result.distribution) ||
    result.artifact !== "available"
  ) {
    fail("signed_build_not_verified");
  }
  return Object.freeze({
    schemaVersion: 1,
    completedAt: completion.completedAt,
    releaseCommit: String(environment.GITHUB_SHA ?? ""),
    platform: result.platform,
    buildProfile: result.buildProfile,
    distribution: result.distribution,
    artifact: "available",
    queueSha256: sha256Bytes(queueBytes),
    completionSha256: sha256Bytes(completionBytes),
    submit: "disabled",
    update: "disabled",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const [queueBytes, completionBytes] = await Promise.all([
    readStablePrivateFile(
      args.queue,
      "mobile_signed_build_queue",
      MAX_BUILD_REPORT_BYTES,
    ),
    readStablePrivateFile(
      args.completion,
      "mobile_signed_build_completion",
      MAX_BUILD_REPORT_BYTES,
    ),
  ]);
  try {
    const receipt = await createMobileSignedBuildReceipt({
      queueBytes,
      completionBytes,
    });
    await writePrivateAtomic(
      args.output,
      Buffer.from(`${JSON.stringify(receipt)}\n`, "utf8"),
    );
    console.log("MOBILE_SIGNED_BUILD_RECEIPT=PASS");
    console.log("MOBILE_SIGNED_BUILD_PRIVATE_VALUES_OUTPUT=false");
  } finally {
    queueBytes.fill(0);
    completionBytes.fill(0);
  }
}

const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href
  : false;

if (isDirectRun) {
  main().catch((error) => {
    const code =
      typeof error?.code === "string" && /^[a-z0-9_]+$/u.test(error.code)
        ? error.code
        : "mobile_signed_build_receipt_failed";
    console.error(`MOBILE_SIGNED_BUILD_RECEIPT_ERROR=${code}`);
    console.error("MOBILE_SIGNED_BUILD_PRIVATE_VALUES_OUTPUT=false");
    process.exitCode = 1;
  });
}

#!/usr/bin/env node

import { lstat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { evaluateRestoreReadiness } from "../../src/lib/restoreTargetPolicy.mjs";
import {
  detectBackupType,
  verifyChecksumPair,
} from "./verify-backup-artifact.mjs";

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

async function requireRegularFile(path, code) {
  let metadata;
  try {
    metadata = await lstat(path);
  } catch {
    fail(code);
  }
  if (!metadata.isFile() || metadata.isSymbolicLink()) fail(code);
}

export async function verifyRestoreDrillResources(environment = process.env) {
  const evaluation = evaluateRestoreReadiness(environment);
  if (!evaluation.ok) fail("environment_invalid");

  const configuredArtifact = String(
    environment.FANMIND_RESTORE_ARTIFACT_PATH ?? "",
  );
  if (!configuredArtifact || !isAbsolute(configuredArtifact)) {
    fail("artifact_path_invalid");
  }

  const artifactPath = resolve(configuredArtifact);
  const checksumPath = `${artifactPath}.sha256`;
  if (detectBackupType(artifactPath) !== "full") {
    fail("artifact_type_invalid");
  }
  await Promise.all([
    requireRegularFile(artifactPath, "artifact_file_invalid"),
    requireRegularFile(checksumPath, "checksum_file_invalid"),
  ]);

  const verification = await verifyChecksumPair(artifactPath, checksumPath);
  if (!verification?.checksum || !verification?.sizeBytes) {
    fail("artifact_checksum_invalid");
  }

  return Object.freeze({
    environment: "isolated",
    target: "separate",
    backupType: "full",
    verificationMode: "checksum_only",
  });
}

async function main() {
  const result = await verifyRestoreDrillResources(process.env);
  console.log("RESTORE_READINESS_ENVIRONMENT=isolated");
  console.log("RESTORE_READINESS_TARGET=separate");
  console.log(`RESTORE_READINESS_BACKUP_TYPE=${result.backupType}`);
  console.log(`RESTORE_READINESS_MODE=${result.verificationMode}`);
  console.log("RESTORE_READINESS_DATABASE_CONNECTION=not_attempted");
  console.log("RESTORE_READINESS_DECRYPTION=not_attempted");
  console.log("RESTORE_READINESS_WRITES=disabled");
  console.log("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
  console.log("RESTORE_DRILL_RESOURCE_READINESS=PASS");
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(
      `RESTORE_READINESS_ERROR=${error?.code ?? "readiness_failed"}`,
    );
    console.error("SECRETS_WURDEN_NICHT_AUSGEGEBEN=true");
    console.error("RESTORE_DRILL_RESOURCE_READINESS=FAIL");
    process.exitCode = 1;
  });
}

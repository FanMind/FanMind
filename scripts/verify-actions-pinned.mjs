#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const WORKFLOW_DIRECTORY = ".github/workflows";
const FULL_SHA_PATTERN = /^[0-9a-f]{40}$/u;
const EXTERNAL_ACTION_PATTERN = /^([^@\s]+)@([^@\s]+)$/u;

function parseActionReference(line) {
  const match = line.match(
    /^\s*(?:-\s*)?uses:\s*["']?([^"'#\s]+)["']?(?:\s+#.*)?$/u,
  );
  return match?.[1] ?? null;
}

function classifyActionReference(reference) {
  if (reference.startsWith("./")) {
    return { kind: "local", repository: null, ref: null, pinned: true };
  }

  if (reference.startsWith("docker://")) {
    const digest = reference.slice("docker://".length).split("@sha256:")[1] ?? "";
    return {
      kind: "docker",
      repository: null,
      ref: digest,
      pinned: /^[0-9a-f]{64}$/u.test(digest),
    };
  }

  const match = reference.match(EXTERNAL_ACTION_PATTERN);
  if (!match) {
    return {
      kind: "invalid",
      repository: null,
      ref: null,
      pinned: false,
    };
  }

  return {
    kind: "external",
    repository: match[1],
    ref: match[2],
    pinned: FULL_SHA_PATTERN.test(match[2]),
  };
}

function hasExplicitTopLevelPermissions(source) {
  return /^permissions:\s*(?:\{\}|read-all|write-all)?\s*$/mu.test(source);
}

function workflowPolicyErrors({ file, source }) {
  const errors = [];
  const references = [];

  if (!hasExplicitTopLevelPermissions(source)) {
    errors.push(`${file}: top-level permissions block is missing`);
  }
  if (/^permissions:\s*write-all\s*$/mu.test(source)) {
    errors.push(`${file}: permissions write-all is forbidden`);
  }

  for (const [index, line] of source.split(/\r?\n/u).entries()) {
    const reference = parseActionReference(line);
    if (!reference) continue;

    const classification = classifyActionReference(reference);
    references.push({
      file,
      line: index + 1,
      reference,
      ...classification,
    });

    if (!classification.pinned) {
      errors.push(
        `${file}:${index + 1}: action reference must use an immutable full commit SHA or Docker digest`,
      );
    }
  }

  return { errors, references };
}

async function scanWorkflowPolicy(directory = WORKFLOW_DIRECTORY) {
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() && /\.ya?ml$/iu.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();

  const errors = [];
  const references = [];
  for (const file of files) {
    const source = await readFile(join(directory, file), "utf8");
    const result = workflowPolicyErrors({ file, source });
    errors.push(...result.errors);
    references.push(...result.references);
  }

  return {
    directory,
    workflowCount: files.length,
    actionReferenceCount: references.length,
    externalActionCount: references.filter(
      (reference) => reference.kind === "external",
    ).length,
    localActionCount: references.filter(
      (reference) => reference.kind === "local",
    ).length,
    dockerActionCount: references.filter(
      (reference) => reference.kind === "docker",
    ).length,
    errors,
    references,
  };
}

async function main() {
  const result = await scanWorkflowPolicy();
  console.log(`WORKFLOW_POLICY_DIRECTORY=${basename(result.directory)}`);
  console.log(`WORKFLOW_POLICY_FILE_COUNT=${result.workflowCount}`);
  console.log(`WORKFLOW_POLICY_ACTION_REFERENCE_COUNT=${result.actionReferenceCount}`);
  console.log(`WORKFLOW_POLICY_EXTERNAL_ACTION_COUNT=${result.externalActionCount}`);
  console.log(`WORKFLOW_POLICY_LOCAL_ACTION_COUNT=${result.localActionCount}`);
  console.log(`WORKFLOW_POLICY_DOCKER_ACTION_COUNT=${result.dockerActionCount}`);

  if (result.errors.length > 0) {
    for (const error of result.errors) {
      console.error(`WORKFLOW_POLICY_ERROR=${error}`);
    }
    console.error("WORKFLOW_POLICY_RESULT=failed");
    process.exit(1);
  }

  console.log("WORKFLOW_POLICY_RESULT=success");
}

export {
  classifyActionReference,
  hasExplicitTopLevelPermissions,
  parseActionReference,
  scanWorkflowPolicy,
  workflowPolicyErrors,
};

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      `WORKFLOW_POLICY_FATAL=${
        error instanceof Error ? error.message : "unknown"
      }`,
    );
    process.exit(1);
  });
}

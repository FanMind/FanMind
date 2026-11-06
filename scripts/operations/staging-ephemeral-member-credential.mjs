#!/usr/bin/env node

import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  openSync,
  writeSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  activateStagingEphemeralMemberCredential,
  generateStrongEphemeralMemberPassword,
  revokeStagingEphemeralMemberCredential,
} from "../../src/lib/stagingEphemeralMemberCredentialPolicy.mjs";

function fail(code) {
  console.error(`STAGING_EPHEMERAL_MEMBER_CREDENTIAL_ERROR=${code}`);
  process.exitCode = 1;
}

export function appendEphemeralPasswordToGithubEnvironment(
  password,
  environment,
) {
  const githubEnvironmentPath = String(environment.GITHUB_ENV ?? "").trim();
  if (!isAbsolute(githubEnvironmentPath) || /[\r\n]/u.test(githubEnvironmentPath)) {
    throw new Error("github_environment_path_invalid");
  }
  let descriptor;
  let content;
  try {
    descriptor = openSync(
      githubEnvironmentPath,
      constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW,
    );
    const initialStat = fstatSync(descriptor);
    if (
      !initialStat.isFile() ||
      initialStat.nlink !== 1 ||
      (typeof process.getuid === "function" &&
        initialStat.uid !== process.getuid())
    ) {
      throw new Error("github_environment_file_invalid");
    }
    fchmodSync(descriptor, 0o600);
    const stat = fstatSync(descriptor);
    if (
      !stat.isFile() ||
      stat.nlink !== 1 ||
      (stat.mode & 0o777) !== 0o600 ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid())
    ) {
      throw new Error("github_environment_file_invalid");
    }
    content = Buffer.from(
      [
        `FANMIND_STAGING_E2E_MEMBER_PASSWORD=${password}`,
        `FANMIND_E2E_STAGING_MEMBER_PASSWORD=${password}`,
        "",
      ].join("\n"),
      "utf8",
    );
    let written = 0;
    while (written < content.length) {
      const bytesWritten = writeSync(
        descriptor,
        content,
        written,
        content.length - written,
      );
      if (bytesWritten < 1) {
        throw new Error("github_environment_write_failed");
      }
      written += bytesWritten;
    }
  } finally {
    content?.fill(0);
    if (descriptor !== undefined) closeSync(descriptor);
  }
}

async function main() {
  const mode = process.argv[2] ?? "";
  if (process.argv.length !== 3) {
    fail("mode_invalid");
    return;
  }
  if (mode === "--check") {
    const password = generateStrongEphemeralMemberPassword(() =>
      Buffer.alloc(48, 7),
    );
    if (!password.startsWith("Fm1!") || password.length < 48) {
      fail("contract_invalid");
      return;
    }
    console.log("STAGING_EPHEMERAL_MEMBER_CREDENTIAL_CONTRACT=PASS");
    console.log("STAGING_EPHEMERAL_MEMBER_CREDENTIAL_NETWORK_CALLS=0");
    console.log("STAGING_EPHEMERAL_MEMBER_PERSISTED_SECRET=0");
    return;
  }
  if (mode === "--generate") {
    const password = generateStrongEphemeralMemberPassword();
    process.stdout.write(`::add-mask::${password}\n`);
    appendEphemeralPasswordToGithubEnvironment(password, process.env);
    console.log("STAGING_EPHEMERAL_MEMBER_CREDENTIAL_GENERATED=PASS");
    return;
  }
  const runner =
    mode === "--activate"
      ? activateStagingEphemeralMemberCredential
      : mode === "--revoke"
        ? revokeStagingEphemeralMemberCredential
        : null;
  if (!runner) {
    fail("mode_invalid");
    return;
  }
  const result = await runner(process.env);
  if (!result.ok) {
    fail(result.error ?? "unexpected_failure");
    return;
  }
  if (mode === "--activate") {
    console.log("STAGING_EPHEMERAL_MEMBER_AUTH_USER=PASS");
    console.log("STAGING_EPHEMERAL_MEMBER_WORKSPACE_MEMBERSHIP=PASS");
    console.log("STAGING_EPHEMERAL_MEMBER_CREDENTIAL_ACTIVE=PASS");
    return;
  }
  console.log("STAGING_EPHEMERAL_MEMBER_UNKNOWN_ROTATION=PASS");
  console.log("STAGING_EPHEMERAL_MEMBER_KNOWN_PASSWORD_REJECTED=PASS");
  console.log("STAGING_EPHEMERAL_MEMBER_CREDENTIAL_REVOKED=PASS");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(() => fail("unexpected_failure"));
}

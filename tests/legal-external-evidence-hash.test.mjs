import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmod,
  mkdtemp,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  collectRegisteredControlIds,
  hashPrivateEvidenceFile,
} from "../scripts/legal/hash-external-evidence.mjs";

async function privateFixture() {
  const root = await mkdtemp(join(tmpdir(), "fanmind-legal-evidence-"));
  await chmod(root, 0o700);
  const file = join(root, "provider-dpa.pdf");
  const contents = Buffer.from("private-provider-evidence");
  await writeFile(file, contents, { mode: 0o600 });
  return { contents, file, root };
}

test("private evidence hashing returns only the prefixed SHA-256 reference", async () => {
  const fixture = await privateFixture();
  const expected = createHash("sha256")
    .update(fixture.contents)
    .digest("hex");

  const evidenceRef = await hashPrivateEvidenceFile({
    file: "provider-dpa.pdf",
    privateRoot: fixture.root,
  });

  assert.equal(evidenceRef, `sha256:${expected}`);
  assert.doesNotMatch(evidenceRef, /provider-dpa|fanmind-legal-evidence/u);
});

test("evidence hashing rejects paths outside the private evidence root", async () => {
  const fixture = await privateFixture();

  await assert.rejects(
    hashPrivateEvidenceFile({
      file: "../outside.pdf",
      privateRoot: fixture.root,
    }),
    { code: "evidence_path_outside_private_root" },
  );
});

test("evidence hashing rejects symlinks and broad file permissions", async () => {
  const fixture = await privateFixture();
  await symlink(fixture.file, join(fixture.root, "linked.pdf"));

  await assert.rejects(
    hashPrivateEvidenceFile({
      file: "linked.pdf",
      privateRoot: fixture.root,
    }),
    { code: "evidence_file_invalid" },
  );

  await chmod(fixture.file, 0o640);
  await assert.rejects(
    hashPrivateEvidenceFile({
      file: "provider-dpa.pdf",
      privateRoot: fixture.root,
    }),
    { code: "evidence_file_permissions_invalid" },
  );
});

test("evidence hashing rejects a broadly readable private directory", async () => {
  const fixture = await privateFixture();
  await chmod(fixture.root, 0o750);

  await assert.rejects(
    hashPrivateEvidenceFile({
      file: "provider-dpa.pdf",
      privateRoot: fixture.root,
    }),
    { code: "evidence_directory_permissions_invalid" },
  );
});

test("registered controls are derived without accepting invented targets", () => {
  const ids = collectRegisteredControlIds({
    operator: { vatId: { status: "pending" } },
    approvals: { taxReview: { status: "pending" } },
    providers: [
      {
        id: "exoscale",
        dpa: { status: "pending" },
        dataLocation: { status: "pending" },
        transferAssessment: { status: "pending" },
      },
    ],
  });

  assert.deepEqual(
    [...ids],
    [
      "operator.vatId",
      "approvals.taxReview",
      "provider.exoscale.dpa",
      "provider.exoscale.dataLocation",
      "provider.exoscale.transferAssessment",
    ],
  );
  assert.equal(ids.has("provider.exoscale.accountId"), false);
});

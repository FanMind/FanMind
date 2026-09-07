import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const sourceScript = "scripts/fanmind_evidence_freshness.py";

async function runFreshness(entries, gates) {
  const root = await mkdtemp(join(tmpdir(), "fanmind-evidence-freshness-"));
  try {
    await mkdir(join(root, "scripts"));
    await mkdir(join(root, "project-memory"));
    await writeFile(
      join(root, "scripts", "fanmind_evidence_freshness.py"),
      await readFile(sourceScript, "utf8"),
      "utf8",
    );
    await writeFile(
      join(root, "project-memory", "EVIDENCE_TTL_POLICY.json"),
      JSON.stringify({
        policy: {
          mutable: { ttl_hours: 1 },
          immutable: { ttl_hours: null },
        },
      }),
      "utf8",
    );
    await writeFile(
      join(root, "project-memory", "EVIDENCE_FRESHNESS.json"),
      JSON.stringify({
        entries: [
          ...entries,
          {
            id: "EV-LEGACY-ISSUE-SNAPSHOT-20260830",
            class: "immutable",
            status: "ACCEPTED",
            issues: {
              642: {},
              643: {},
              644: {},
              874: {},
            },
          },
        ],
      }),
      "utf8",
    );
    await writeFile(
      join(root, "project-memory", "FINISHLINE_STATE.json"),
      JSON.stringify({ gates }),
      "utf8",
    );

    return spawnSync(
      "python3",
      [join(root, "scripts", "fanmind_evidence_freshness.py")],
      {
        cwd: root,
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_ACTIONS: "",
          FANMIND_VERIFY_GITHUB_ISSUES: "0",
        },
      },
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("superseded evidence never requests revalidation", async () => {
  const result = await runFreshness(
    [
      {
        id: "EV-SUPERSEDED",
        class: "mutable",
        status: "SUPERSEDED",
        observed_at: "2000-01-01T00:00:00Z",
        gate: "superseded_gate",
      },
      {
        id: "EV-ACTIVE",
        class: "mutable",
        status: "VERIFIED",
        observed_at: "2000-01-01T00:00:00Z",
        gate: "active_gate",
      },
    ],
    {
      superseded_gate: { state: "PARTIAL" },
      active_gate: { state: "PARTIAL" },
    },
  );

  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stdout, /EVIDENCE_REVALIDATION_REQUIRED=EV-SUPERSEDED/u);
  assert.match(result.stdout, /EVIDENCE_REVALIDATION_REQUIRED=EV-ACTIVE/u);
  assert.match(result.stdout, /FANMIND_EVIDENCE_FRESHNESS_RESULT=passed/u);
});

test("expired active evidence supporting an accepted gate still fails closed", async () => {
  const result = await runFreshness(
    [
      {
        id: "EV-ACTIVE-ACCEPTED",
        class: "mutable",
        status: "VERIFIED",
        observed_at: "2000-01-01T00:00:00Z",
        gate: "accepted_gate",
      },
    ],
    {
      accepted_gate: { state: "ACCEPTED" },
    },
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /EVIDENCE_REVALIDATION_REQUIRED=EV-ACTIVE-ACCEPTED/u,
  );
  assert.match(
    result.stdout,
    /FANMIND_EVIDENCE_FRESHNESS_ERROR=stale-evidence-supporting-accepted-gate:EV-ACTIVE-ACCEPTED:accepted_gate/u,
  );
});

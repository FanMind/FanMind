import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const script = join(root, "scripts/fanmind_legacy_issue_reconciliation.py");
const statePath = join(
  root,
  "project-memory/LEGACY_ISSUE_RECONCILIATION.json",
);
const renderedPath = join(
  root,
  "project-memory/LEGACY_ISSUE_RECONCILIATION.md",
);

function run(argumentsList) {
  return spawnSync("python3", [script, ...argumentsList], {
    cwd: root,
    encoding: "utf8",
  });
}

async function withModifiedState(mutate, check) {
  const directory = await mkdtemp(
    join(tmpdir(), "fanmind-legacy-issue-reconciliation-"),
  );
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    mutate(state);
    const candidate = join(directory, "state.json");
    await writeFile(candidate, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await check(candidate, directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test("canonical legacy issue reconciliation is valid and rendered exactly", () => {
  const result = run(["--check"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    /FANMIND_LEGACY_ISSUE_RECONCILIATION_RESULT=passed/u,
  );
});

test("an accepted legacy item cannot cite unknown evidence", async () => {
  await withModifiedState(
    (state) => {
      state.issues[0].legacy_unchecked_items[0].evidence = ["UNKNOWN"];
    },
    async (candidate) => {
      const result = run(["--state", candidate]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /item_evidence_unknown:642:UNKNOWN/u);
    },
  );
});

test("a partial item must retain a named gate", async () => {
  await withModifiedState(
    (state) => {
      delete state.issues[0].legacy_unchecked_items[9].gate;
    },
    async (candidate) => {
      const result = run(["--state", candidate]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /item_gate_missing:642/u);
    },
  );
});

test("the historical umbrella cannot remain an active execution tracker", async () => {
  await withModifiedState(
    (state) => {
      state.issues[2].target_state = "open";
    },
    async (candidate) => {
      const result = run(["--state", candidate]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /issue_644_target_invalid/u);
    },
  );
});

test("every historically unchecked checkbox must be mapped", async () => {
  await withModifiedState(
    (state) => {
      state.issues[1].legacy_unchecked_items.pop();
    },
    async (candidate) => {
      const result = run(["--state", candidate]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /unchecked_count_mismatch:643/u);
    },
  );
});

test("declared counts cannot be reduced together with the pinned source list", async () => {
  await withModifiedState(
    (state) => {
      const issue = state.issues[1];
      issue.legacy_unchecked_items.pop();
      issue.source_checkbox_counts.total -= 1;
      issue.source_checkbox_counts.unchecked -= 1;
    },
    async (candidate) => {
      const result = run(["--state", candidate]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /source_counts_mismatch:643/u);
    },
  );
});

test("workflow evidence URL, commit and conclusion are exact pinned contracts", async () => {
  await withModifiedState(
    (state) => {
      state.evidence.ADMIN_STAGING_RUN.reference =
        "https://github.com/FanMind/FanMind/actions/runs/1";
      state.evidence.ADMIN_STAGING_RUN.commit = "f".repeat(40);
      state.evidence.ADMIN_STAGING_RUN.conclusion = "success";
    },
    async (candidate) => {
      const result = run(["--state", candidate]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /evidence_contract_mismatch/u);
    },
  );
});

test("an external legal gate cannot be reclassified with technical evidence", async () => {
  await withModifiedState(
    (state) => {
      const issue = state.issues[0];
      const item = issue.legacy_unchecked_items.find((candidate) =>
        candidate.text.startsWith("Referral-Teilnahmebedingungen"),
      );
      item.status = "ACCEPTED";
      item.evidence = ["REFERRAL_STAGING_RUN"];
      delete item.gate;
      issue.retained_gates = issue.retained_gates.filter(
        (gate) => gate !== "REFERRAL_LEGAL_TAX",
      );
    },
    async (candidate) => {
      const result = run(["--state", candidate]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /reconciliation_digest_mismatch:642/u);
    },
  );
});

test("generated human reconciliation cannot drift from machine state", async () => {
  await withModifiedState(
    () => {},
    async (candidate, directory) => {
      const rendered = join(directory, "reconciliation.md");
      await writeFile(rendered, "stale\n", "utf8");
      const result = run([
        "--state",
        candidate,
        "--rendered",
        rendered,
        "--check",
      ]);
      assert.notEqual(result.status, 0);
      assert.match(result.stdout, /rendered_drift/u);
    },
  );
});

test("canonical render remains byte-for-byte stable", async () => {
  const expected = await readFile(renderedPath, "utf8");
  const result = run(["--render"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.stdout, expected);
});

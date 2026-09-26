import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const completion = readFileSync(
  new URL("../docs/operations/ROADMAP_1_7_COMPLETION.md", import.meta.url),
  "utf8",
);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const actionCatalog = JSON.parse(read("project-memory/NEXT_BEST_ACTIONS.json"));
const creatorDoc = read("docs/CREATOR_INTELLIGENCE.md");
const nextAction = read("project-memory/NEXT_BEST_ACTION.md");
const openLoops = read("project-memory/OPEN_LOOPS.md");
const currentState = read("project-memory/CURRENT_STATE.md");
const executionReceipts = read("project-memory/EXECUTION_RECEIPTS.md");
const workLocks = read("project-memory/WORK_LOCKS.md");
const taskLedger = read("project-memory/TASK_LEDGER.md");
const sessionHandoff = read("project-memory/SESSION_HANDOFF.md");
const startedWork = read("project-memory/STARTED_WORK.md");

const markdownSection = (document, heading) => {
  const start = document.indexOf(heading);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const next = document.indexOf("\n## ", start + heading.length);
  return document.slice(start, next === -1 ? undefined : next);
};

test("roadmap 1-7 completion keeps all four evidence classes explicit", () => {
  for (const heading of [
    "Code",
    "Staging/Infrastruktur",
    "Extern",
    "Production-Aktivierung",
  ]) {
    assert.match(completion, new RegExp(`\\*\\*${heading}\\*\\*`, "u"));
  }

  for (let phase = 1; phase <= 7; phase += 1) {
    assert.match(completion, new RegExp(`## Roadmap ${phase} –`, "u"));
  }
});

test("roadmap completion cannot turn external evidence into a merge result", () => {
  assert.match(
    completion,
    /`Extern` und `Production-Aktivierung` dürfen nicht allein durch einen Merge als\s+erledigt markiert werden/u,
  );
  assert.match(completion, /Meta App Review/u);
  assert.match(completion, /Signing Credentials/u);
  assert.match(completion, /rechtliche und steuerliche Freigabe/u);
});

test("phase 8 and later work stays outside the active completion scope", () => {
  assert.match(
    completion,
    /Punkt 8 und alle späteren Punkte bleiben\s+außerhalb dieses Arbeitsumfangs/u,
  );
  assert.doesNotMatch(completion, /## Roadmap (?:8|9|1[0-9]) –/u);
  assert.match(completion, /OnlyFans bleibt eine nicht bindende technische und rechtliche Evaluation/u);
  assert.match(completion, /Scraping und\s+Speicherung von Plattformpasswörtern bleiben ausgeschlossen/u);
});

test("the regular Gerhard flow remains the first completion priority", () => {
  const priority = completion.indexOf("## Priorität 1: regulärer Gerhard-Benutzerfluss");
  const phaseOne = completion.indexOf("## Roadmap 1 –");

  assert.ok(priority > -1);
  assert.ok(phaseOne > priority);
  assert.match(
    completion,
    /Registrierung\/Login und regulärer Workspace[\s\S]*Dashboard und Fans\/Kontakte[\s\S]*Conversations\/Nachrichten und Inbox[\s\S]*KI Standard[\s\S]*Memory und Follow-ups/u,
  );
  assert.match(completion, /`npm run test:e2e:core-flow`/u);
  assert.match(completion, /echte FanMind-Routen und Server-Actions/u);
  assert.match(
    completion,
    /isolierte Staging-, echte Provider- und\s+Production-Abnahme bleiben dadurch unverändert offen/u,
  );
});

test("paid AI tiers stay fail closed across technical and external gates", () => {
  assert.match(completion, /## Querschnitt: KI Plus und Ultra/u);
  assert.match(completion, /weiterhin nicht buchbar/u);
  assert.match(completion, /Plus und Ultra getrennt aktivieren/u);
  assert.match(completion, /fällt immer auf Standard zurück/u);
});

test("consumed Creator evidence work cannot remain an executable placeholder", () => {
  assert.equal(
    actionCatalog.actions.some((action) => action.id === "NBA-CREATOR-INTELLIGENCE"),
    false,
  );

  const retired = actionCatalog.retired_actions.find(
    (action) => action.id === "NBA-CREATOR-INTELLIGENCE",
  );
  assert.ok(retired);
  assert.equal(retired.status, "CONSUMED");
  assert.match(retired.bounded_source_evidence, /#1184/u);
  assert.match(retired.reason, /new bounded engineering action/u);
});

test("Creator aggregate summary is closed and the manager invents no next scope", () => {
  assert.doesNotMatch(
    creatorDoc,
    /Der nächste repository-seitige Schritt bleibt ausdrücklich evidence-only/u,
  );
  assert.match(creatorDoc, /repository-seitige evidence-only Schritt ist abgeschlossen/u);
  assert.match(nextAction, /- SAFE READY SET: `NONE`/u);
  assert.match(nextAction, /- Worker slots reserved by active\/ready work: `0`/u);
  assert.match(nextAction, /- Selection status: `OWNER_ACTION_REQUIRED`/u);
  assert.match(nextAction, /- Task: `FM-REG-003`/u);
  assert.match(openLoops, /no current repository action is admitted/u);
  assert.match(openLoops, /never reactivate the consumed broad `NBA-CREATOR-INTELLIGENCE`/u);
  assert.doesNotMatch(
    openLoops,
    /engineering under NBA-CREATOR-INTELLIGENCE/u,
  );
});

test("truth drift accepts only active eligible or evidence-bound consumed Creator action", () => {
  const result = spawnSync(
    "python3",
    ["scripts/fanmind_truth_drift_check.py", "--creator-contract-test"],
    { cwd: new URL("..", import.meta.url), encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /FANMIND_CREATOR_ACTION_CONTRACT_RESULT=passed/u);
});

test("current canonical readers cannot reopen consumed reconciliation steps", () => {
  const currentApply = markdownSection(
    currentState,
    "## ChatAdmin Staging APPLY completed and independently verified",
  );
  const applyReceipt = markdownSection(
    executionReceipts,
    "## RECEIPT-FM-CHATADMIN-002-STAGING-APPLY-20260926",
  );
  const creatorLock = markdownSection(
    workLocks,
    "## LOCK-FM-CREATOR-NEXT-ACTION-RECONCILIATION-20260926",
  );
  const creatorLedgerReconciliation = markdownSection(
    taskLedger,
    "## FM-CREATOR-001 — exhausted broad action reconciliation",
  );
  const creatorCurrentReconciliation = markdownSection(
    currentState,
    "## Creator broad action consumed; no repository scope currently admitted",
  );
  const creatorAggregateLedger = markdownSection(taskLedger, "## FM-CREATOR-001\n");
  const applyAction = actionCatalog.actions.find(
    (action) => action.id === "NBA-CHATADMIN-STAGING-APPLY",
  );

  assert.match(currentApply, /ACCEPT[^\n]*subsequently completed and was consumed/u);
  assert.doesNotMatch(currentApply, /Next protected ChatAdmin step[^\n]*ACCEPT/u);
  assert.match(applyReceipt, /only the manual application flow remains open/u);
  assert.doesNotMatch(applyReceipt, /DB\/RLS ACCEPT and later manual application flow remain open/u);

  assert.ok(applyAction);
  assert.match(applyAction.instruction, /DB\/RLS ACCEPT is also completed and consumed/u);
  assert.match(applyAction.instruction, /manual application-flow action/u);
  assert.doesNotMatch(
    applyAction.instruction,
    /Continue only through the distinct protected ChatAdmin ACCEPT action/u,
  );

  assert.match(creatorLock, /- Status: RELEASED_MERGED_VERIFIED/u);
  assert.match(creatorLock, /Final release:[\s\S]*PR #1186/u);
  assert.doesNotMatch(
    creatorLock,
    /CI, independent review and normal merge remain|required before merged completion|merge remains conditional/u,
  );
  assert.match(creatorLedgerReconciliation, /- Status: MERGED_VERIFIED/u);
  assert.match(
    creatorLedgerReconciliation,
    /PR #1186[\s\S]*d2af392dfa099da8d675481bb343154d829743ff/u,
  );
  assert.match(
    creatorCurrentReconciliation,
    /PR #1186[\s\S]*d2af392dfa099da8d675481bb343154d829743ff/u,
  );
  assert.doesNotMatch(
    creatorCurrentReconciliation,
    /exact-head CI, independent review and normal merge remain next/u,
  );
  assert.match(creatorAggregateLedger, /broad `NBA-CREATOR-INTELLIGENCE` ID is retired/u);
  assert.doesNotMatch(
    creatorAggregateLedger,
    /Only if `NBA-CREATOR-INTELLIGENCE` is admitted/u,
  );
});

test("historical merge evidence is not mislabeled as the current main head", () => {
  for (const reader of [sessionHandoff, startedWork]) {
    assert.doesNotMatch(
      reader,
      /PR #1189[^\n]*merged as current main/u,
    );
  }
});

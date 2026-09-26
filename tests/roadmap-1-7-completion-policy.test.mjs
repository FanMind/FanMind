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

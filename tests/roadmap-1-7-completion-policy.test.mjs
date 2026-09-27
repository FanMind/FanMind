import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const completion = readFileSync(
  new URL("../docs/operations/ROADMAP_1_7_COMPLETION.md", import.meta.url),
  "utf8",
);
const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const actionCatalogText = read("project-memory/NEXT_BEST_ACTIONS.json");
const actionCatalog = JSON.parse(actionCatalogText);
const agents = read("AGENTS.md");
const sourceOfTruth = read("docs/SOURCE_OF_TRUTH.md");
const creatorDoc = read("docs/CREATOR_INTELLIGENCE.md");
const protocol = read("project-memory/PROTOCOL.md");
const executionPolicy = read("project-memory/EXECUTION_POLICY.md");
const nextAction = read("project-memory/NEXT_BEST_ACTION.md");
const deferredOwnerActions = read("project-memory/DEFERRED_OWNER_ACTIONS.md");
const autoHandoff = read("project-memory/AUTO_HANDOFF.md");
const ownerActionInbox = read("project-memory/OWNER_ACTION_INBOX.md");
const openLoops = read("project-memory/OPEN_LOOPS.md");
const dependencies = read("project-memory/DEPENDENCIES.md");
const currentState = read("project-memory/CURRENT_STATE.md");
const deepAudit = read("project-memory/FANMIND_DEEP_AUDIT_2026-08-19.md");
const finishline = read("project-memory/FANMIND_FINISHLINE.md");
const finishlineState = read("project-memory/FINISHLINE_STATE.json");
const executionReceipts = read("project-memory/EXECUTION_RECEIPTS.md");
const workLocks = read("project-memory/WORK_LOCKS.md");
const taskLedger = read("project-memory/TASK_LEDGER.md");
const sessionHandoff = read("project-memory/SESSION_HANDOFF.md");
const startedWork = read("project-memory/STARTED_WORK.md");
const decisions = read("project-memory/DECISIONS.md");
const failedAttempts = read("project-memory/FAILED_ATTEMPTS.md");
const changeRequests = read("project-memory/CHANGE_REQUESTS.md");
const doNotAssume = read("project-memory/DO_NOT_ASSUME.md");
const authorizations = read("project-memory/AUTHORIZATIONS.md");
const reconciliationLog = read("project-memory/RECONCILIATION.md");
const assumptions = read("project-memory/ASSUMPTIONS.md");
const contradictions = read("project-memory/CONTRADICTIONS.md");
const transitionDesign = read("docs/operations/CREATOR_FOUNDATION_FORWARD_TRANSITION_DESIGN.md");
const evidence = read("project-memory/EVIDENCE.md");
const evidenceFreshness = JSON.parse(read("project-memory/EVIDENCE_FRESHNESS.json"));
const consumedGeneratorId = "NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR";

const markdownSection = (document, heading) => {
  const start = document.indexOf(heading);
  assert.notEqual(start, -1, `missing section: ${heading}`);
  const next = document.indexOf("\n## ", start + heading.length);
  return document.slice(start, next === -1 ? undefined : next);
};

const consumedGeneratorNextLineIsClosed = (line) => {
  const consumedGeneratorReference =
    `(?:\`?${consumedGeneratorId}\\b\`?|it\\b|(?:this|that|the)(?:\\s+(?:consumed|accepted\\/consumed))?\\s+(?:(?:transition\\s+)?generator|source(?:\\s+package)?)\\b)`;
  const consumedGeneratorAnaphor =
    "(?:this|that|it|(?:this|that|the)(?:\\s+(?:same|original))?\\s+(?:work|implementation))\\b";
  const consumedGeneratorActionTarget =
    `(?:(?:work\\s+on|(?:the\\s+)?implementation\\s+of)\\s+)?(?:${consumedGeneratorReference}|${consumedGeneratorAnaphor})`;
  const closedSpans = [];
  const completionSpans = [];
  const completionNegation =
    /\b(?:not|never|no\s+longer|cannot|(?:is|was|were|has|have|had|does|do|did|can|could|should|would|will|must)n['’]t|won['’]t)\b/iu;
  const affirmativeCompletionPatterns = [
    new RegExp(
      `superseded\\s+by\\s+the\\s+accepted\\/consumed\\s+(?:source(?:\\s+package)?|${consumedGeneratorReference}(?:\\s+source\\s+package)?)`,
      "giu",
    ),
    new RegExp(
      `${consumedGeneratorReference}(?:\\s+source\\s+package)?\\s+(?:is\\s+)?(?:now\\s+|already\\s+|also\\s+)?(?:accepted\\/consumed|done)\\b`,
      "giu",
    ),
  ];
  for (const pattern of affirmativeCompletionPatterns) {
    for (const match of line.matchAll(pattern)) {
      const clausePrefix = line.slice(0, match.index).split(/[.;]/u).at(-1) ?? "";
      if (!completionNegation.test(clausePrefix)) {
        const span = [match.index, match.index + match[0].length];
        completionSpans.push(span);
        closedSpans.push(span);
      }
    }
  }
  const reopeningVerb = "(?:start|restart|implement|reopen|rebuild|resume|continue)";
  const reopeningVerbForm =
    "(?:starts?|started|starting|restarts?|restarted|restarting|implements?|implemented|implementing|re-?implements?|re-?implemented|re-?implementing|reopens?|reopened|reopening|rebuilds?|rebuilt|rebuilding|resumes?|resumed|resuming|continues?|continued|continuing)";
  const actionVerbForm =
    `(?:${reopeningVerbForm}|repeats?|repeated|repeating|proceeds?|proceeded|proceeding|advances?|advanced|advancing)`;
  const explicitlyClosedDirective = new RegExp(
    `\\b(?:do\\s+not|don't|must\\s+not|cannot|never)\\s+${reopeningVerb}(?:\\s+(?:and|or)\\s+${reopeningVerb})*\\s+${consumedGeneratorActionTarget}`,
    "giu",
  );
  for (const match of line.matchAll(explicitlyClosedDirective)) {
    closedSpans.push([match.index, match.index + match[0].length]);
  }
  const explicitlyNegatedAction = new RegExp(
    `\\b(?:do\\s+not|don't|must\\s+not|cannot|never)\\s+(?:be\\s+)?${actionVerbForm}(?:\\s+(?:and|or)\\s+(?:be\\s+)?${actionVerbForm})*\\b`,
    "giu",
  );
  for (const match of line.matchAll(explicitlyNegatedAction)) {
    closedSpans.push([match.index, match.index + match[0].length]);
  }
  const explicitlySeparateProtectedAction = new RegExp(
    `\\b${actionVerbForm}\\s+(?:the|this|that)\\s+separately\\s+authorized\\s+target\\s+transition\\b`,
    "giu",
  );
  for (const match of line.matchAll(explicitlySeparateProtectedAction)) {
    closedSpans.push([match.index, match.index + match[0].length]);
  }
  const explicitlySeparateAggregateState =
    /\bCreator\s+aggregate\s+(?:remains?|is)(?:\s+still)?\s+in[_\s-]?progress\b/giu;
  for (const match of line.matchAll(explicitlySeparateAggregateState)) {
    closedSpans.push([match.index, match.index + match[0].length]);
  }
  // RegExp match indices are UTF-16 code-unit offsets. split("") preserves
  // those offsets, unlike code-point iteration with [...line].
  const maskedLine = line.split("");
  for (const [start, end] of closedSpans) {
    maskedLine.fill(" ", start, end);
  }
  const leavesUnclassifiedGeneratorReference = new RegExp(
    consumedGeneratorReference,
    "iu",
  ).test(maskedLine.join(""));
  const leavesUnclassifiedReopenDirective = new RegExp(
    `\\b${actionVerbForm}\\b`,
    "iu",
  ).test(maskedLine.join(""));
  const remainingText = maskedLine.join("");
  const leavesConflictingCompletionClaim =
    /\b(?:superseded\s+by|accepted\/consumed|done|(?:not|never|cannot|can['’]t|won['’]t|must\s+not)(?:\s+[\p{L}'’/-]+){0,3}\s+(?:complete(?:d)?|finish(?:ed)?))\b/iu.test(
      remainingText,
    );
  const conflictingLifecycleState =
    "(?:incomplete|unfinished|pending|open|active|in[_\\s-]?progress)";
  const directLifecycleConflictAfterCloseout = completionSpans.some(([, end]) => {
    const tail = line
      .slice(end)
      .replace(/^\\s*[,.;:]?\\s*/u, "");
    const lifecyclePredicate =
      `(?:(?:status\\s*:\\s*)${conflictingLifecycleState}|(?:(?:remains?|is|was|were)(?:\\s+still)?|still)\\s+${conflictingLifecycleState})\\b`;
    if (new RegExp(`^${lifecyclePredicate}`, "iu").test(tail)) return true;

    const explicitSeparateSubject =
      /^(?:the\\s+)?separately\\s+authorized\\s+target\\s+transition\\b|^Creator\\s+aggregate\\b/iu;
    if (explicitSeparateSubject.test(tail)) return false;

    const connectorOnlyPrefix =
      /^(?:(?!the\\b|this\\b|that\\b|a\\b|an\\b|creator\\b|target\\b|transition\\b|generator\\b|source\\b|workspace\\b|action\\b|task\\b)[\\p{L}'’_-]+\\s+)*/iu;
    const connectorPrefix = tail.match(connectorOnlyPrefix)?.[0] ?? "";
    return new RegExp(`^${lifecyclePredicate}`, "iu").test(tail.slice(connectorPrefix.length));
  });
  const hasConflictingLifecycleState = directLifecycleConflictAfterCloseout;
  const affirmativelyRestarts =
    leavesUnclassifiedGeneratorReference ||
    leavesUnclassifiedReopenDirective ||
    /requires its own exact-base start contract and lock before implementation/iu.test(line);
  return (
    closedSpans.length > 0 &&
    !affirmativelyRestarts &&
    !leavesConflictingCompletionClaim &&
    !hasConflictingLifecycleState
  );
};

const assertGeneratorCatalogInstructionsClosed = (catalog) => {
  const catalogEntries = [
    ...(catalog.actions ?? []),
    ...(catalog.retired_actions ?? []),
  ];
  const knownGeneratorDependentActionIds = new Set([
    consumedGeneratorId,
    "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  ]);
  const generatorBearingEntries = catalogEntries.filter(
    (action) =>
      knownGeneratorDependentActionIds.has(action.id) ||
      (typeof action.instruction === "string" && action.instruction.includes(consumedGeneratorId)),
  );
  assert.ok(generatorBearingEntries.length > 0);
  for (const action of generatorBearingEntries) {
    assert.match(action.instruction, /\S/u, `${action.id}: instruction must be non-empty`);
    const instructionSentences = action.instruction.split(/(?<=[.!?])\s+/u);

    for (const sentence of instructionSentences) {
      const classifiedSentence = sentence.includes(consumedGeneratorId)
        ? sentence
        : `${consumedGeneratorId} is ACCEPTED/CONSUMED; ${sentence}`;
      assert.equal(
        consumedGeneratorNextLineIsClosed(classifiedSentence),
        true,
        `${action.id}: ${sentence}`,
      );
    }
    assert.ok(instructionSentences.length > 0, action.id);
  }
};

test("consumed generator closeout covers every catalog lifecycle instruction", () => {
  const retiredProfileDesignCatalog = structuredClone(actionCatalog);
  const profileDesignIndex = retiredProfileDesignCatalog.actions.findIndex(
    (action) => action.id === "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  );
  assert.notEqual(profileDesignIndex, -1);
  const [profileDesign] = retiredProfileDesignCatalog.actions.splice(profileDesignIndex, 1);
  retiredProfileDesignCatalog.retired_actions.push(profileDesign);

  const blankDependentInstruction = structuredClone(retiredProfileDesignCatalog);
  blankDependentInstruction.retired_actions.find(
    (action) => action.id === "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  ).instruction = "   ";
  assert.throws(
    () => assertGeneratorCatalogInstructionsClosed(blankDependentInstruction),
    /instruction must be non-empty/u,
  );

  const directActiveStatus = structuredClone(retiredProfileDesignCatalog);
  directActiveStatus.actions.find(
    (action) => action.id === consumedGeneratorId,
  ).instruction += " Status: ACTIVE.";
  assert.throws(
    () => assertGeneratorCatalogInstructionsClosed(directActiveStatus),
    /Status: ACTIVE/u,
  );

  const blankGeneratorInstruction = structuredClone(retiredProfileDesignCatalog);
  blankGeneratorInstruction.actions.find(
    (action) => action.id === consumedGeneratorId,
  ).instruction = "   ";
  assert.throws(
    () => assertGeneratorCatalogInstructionsClosed(blankGeneratorInstruction),
    /instruction must be non-empty/u,
  );

  assert.equal(
    consumedGeneratorNextLineIsClosed(
      `${consumedGeneratorId} is ACCEPTED/CONSUMED but remains ACTIVE`,
    ),
    false,
    "ACTIVE contradicts consumed closeout",
  );

  assert.equal(
    consumedGeneratorNextLineIsClosed(
      `${consumedGeneratorId} is ACCEPTED/CONSUMED, but the separately authorized target transition is still unfinished`,
    ),
    true,
    "unrelated protected target lifecycle must not reopen the consumed generator",
  );

  for (const directConflict of [
    `${consumedGeneratorId} is ACCEPTED/CONSUMED, yet remains ACTIVE`,
    `${consumedGeneratorId} is ACCEPTED/CONSUMED while still unfinished`,
    `superseded by the accepted/consumed ${consumedGeneratorId} source package but remains ACTIVE`,
  ]) {
    assert.equal(
      consumedGeneratorNextLineIsClosed(directConflict),
      false,
      directConflict,
    );
  }

  assert.equal(
    consumedGeneratorNextLineIsClosed(
      `${consumedGeneratorId} is ACCEPTED/CONSUMED. The separately authorized target transition; Status: ACTIVE.`,
    ),
    true,
    "target-scoped Status: ACTIVE must not reopen the consumed generator",
  );

  assert.equal(
    consumedGeneratorNextLineIsClosed(
      `${consumedGeneratorId} is ACCEPTED/CONSUMED. Continue the separately authorized target transition; Status: ACTIVE.`,
    ),
    true,
    "protected target action span must not become a generator lifecycle subject",
  );

  assert.equal(
    consumedGeneratorNextLineIsClosed(
      `${consumedGeneratorId} is ACCEPTED/CONSUMED, though remains ACTIVE`,
    ),
    false,
    "direct lifecycle contradiction must not depend on a connector allowlist",
  );

  const anaphoricReopen = structuredClone(retiredProfileDesignCatalog);
  anaphoricReopen.retired_actions.find(
    (action) => action.id === "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  ).instruction += " Reimplement it.";
  assert.throws(
    () => assertGeneratorCatalogInstructionsClosed(anaphoricReopen),
    /Reimplement it/u,
  );

  const prefixedNamedReopen = structuredClone(retiredProfileDesignCatalog);
  prefixedNamedReopen.retired_actions.find(
    (action) => action.id === "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  ).instruction = `Reimplement the transition generator. ${prefixedNamedReopen.retired_actions.find(
    (action) => action.id === "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  ).instruction}`;
  assert.throws(
    () => assertGeneratorCatalogInstructionsClosed(prefixedNamedReopen),
    /Reimplement the transition generator/u,
  );

  const namedReopen = structuredClone(retiredProfileDesignCatalog);
  namedReopen.retired_actions.find(
    (action) => action.id === "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  ).instruction += " Reimplement the transition generator.";
  assert.throws(
    () => assertGeneratorCatalogInstructionsClosed(namedReopen),
    /Reimplement the transition generator/u,
  );

  const protectedTargetContinuation = structuredClone(retiredProfileDesignCatalog);
  protectedTargetContinuation.retired_actions.find(
    (action) => action.id === "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN",
  ).instruction +=
    " Continue this separately authorized target transition. The separately authorized target transition remains ACTIVE.";
  assert.doesNotThrow(
    () => assertGeneratorCatalogInstructionsClosed(protectedTargetContinuation),
  );

  assert.doesNotThrow(
    () => assertGeneratorCatalogInstructionsClosed(retiredProfileDesignCatalog),
  );
});

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

test("Creator selection stays bounded and the consumed parent cannot reopen", () => {
  assert.doesNotMatch(creatorDoc, /Der nächste repository-seitige Schritt bleibt ausdrücklich evidence-only/u);
  assert.match(creatorDoc, /repository-seitige evidence-only Schritt ist abgeschlossen/u);
  assert.doesNotMatch(nextAction, /- Active task continuations reserving slots: `[^`]*NBA-CREATOR-INTELLIGENCE/u);
  assert.match(openLoops, /No unchanged retry, ABSENT inference or reactivation of broad `NBA-CREATOR-INTELLIGENCE`/u);
  assert.doesNotMatch(openLoops, /engineering under NBA-CREATOR-INTELLIGENCE/u);
  const verifyId = "NBA-CREATOR-CONFIRMED-CHAT-STAGING-VERIFY";
  const controlId = "NBA-CREATOR-CONFIRMED-CHAT-APPLY-CONTROL";
  const reconciliationId = "NBA-CREATOR-FOUNDATION-RECONCILIATION-PREFLIGHT";
  const catalogId = "NBA-CREATOR-FOUNDATION-STAGING-CATALOG";
  const designId = "NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN";
  const generatorId = consumedGeneratorId;
  const verify = actionCatalog.actions.find((a) => a.id === verifyId);
  const control = actionCatalog.actions.find((a) => a.id === controlId);
  assert.ok(verify);
  const reconciliation = actionCatalog.actions.find((a) => a.id === reconciliationId);
  const catalogObservation = actionCatalog.actions.find((a) => a.id === catalogId);
  const profileDesign = actionCatalog.actions.find((a) => a.id === designId);
  const transitionGenerator = [
    ...actionCatalog.actions,
    ...actionCatalog.retired_actions,
  ].find((a) => a.id === generatorId);
  assertGeneratorCatalogInstructionsClosed(actionCatalog);
  assert.equal(verify.priority, control || reconciliation ? 6 : 2);
  assert.equal(verify.requires_owner, true);
  assert.equal(verify.parallel_safe, false);
  assert.ok(verify.prerequisite_gates.includes("chatadmin_manual_flow"));
  assert.equal(verify.gate, "creator_confirmed_chat_staging_verify");
  const socials = ["NBA-SOCIAL-INBOUND-CURRENT-ACCOUNT", "NBA-CREATOR-SOCIAL-EXTERNAL", "NBA-PHASE7-EXTERNAL"];
  for (const id of socials) assert.ok(actionCatalog.actions.find((a) => a.id === id).priority > 7);
  if (control) {
    assert.equal(control.priority, 2);
    assert.equal(control.requires_owner, false);
    assert.deepEqual(control.depends_on_actions, [verifyId]);
    assert.equal(control.gate, "creator_confirmed_chat_apply_control");
  }
  // Closeout invariants are independent of whichever later Creator action is
  // selected. In particular, adding the apply-control action must not bypass
  // the consumed-generator regression below.
  if (profileDesign) {
    assert.equal(profileDesign.priority, 14);
    assert.equal(profileDesign.requires_owner, false);
    assert.equal(profileDesign.parallel_safe, false);
    assert.deepEqual(profileDesign.depends_on_actions, [reconciliationId, catalogId]);
    assert.deepEqual(profileDesign.done_states, ["ACCEPTED"]);
    assert.equal(profileDesign.gate, "creator_foundation_profile_transition_design");
    assert.ok(profileDesign.prerequisite_gates.includes("creator_foundation_reconciliation_preflight"));
    assert.ok(!profileDesign.prerequisite_gates.includes("creator_foundation_staging_catalog"));
    assert.equal(reconciliation.priority, 12);
    assert.equal(catalogObservation.priority, 13);
    assert.ok(catalogObservation.done_states.includes("RECONCILED"));
    assert.match(catalogObservation.instruction, /Completed and consumed read-only catalog observation/u);
    const state = JSON.parse(read("project-memory/FINISHLINE_STATE.json"));
    assert.equal(state.gates.creator_foundation_reconciliation_preflight.state, "ACCEPTED");
    assert.equal(state.gates.creator_foundation_staging_catalog.state, "RECONCILED");
    assert.equal(state.gates.creator_foundation_profile_transition_design.state, "ACCEPTED");
    assert.equal(state.gates.creator_foundation_transition_generator.state, "ACCEPTED");
    assert.equal(state.gates.creator_intelligence.state, "IN_PROGRESS");
    assert.equal(state.gates.creator_confirmed_chat_staging_verify.state, "RECONCILED");
    assert.equal(state.gates.creator_confirmed_chat_staging_verify.workflow_conclusion, "failure");
    const receipt = JSON.parse(read("project-memory/receipts/creator-foundation-staging-catalog-observation.json"));
    assert.equal(receipt.status, "RECONCILED");
    assert.equal(state.gates.creator_foundation_staging_catalog.observed_result, receipt.classifier.status);
    assert.ok(["INCOMPLETE", "DRIFT", "LEGACY_EXACT", "CURRENT_EXACT"].includes(receipt.classifier.status));
    assert.equal(receipt.classifier.targetAccepted, false);
    assert.equal(receipt.classifier.applyAllowed, false);
    assert.equal(receipt.classifier.runtimeActivated, false);
    assert.equal(receipt.classifier.learningState, "UNDETERMINED");
    assert.equal(receipt.query.rolled_back, true);
    assert.equal(typeof receipt.target.release_fresh, "boolean");
    assert.equal(receipt.target.release_probe, receipt.target.release_fresh ? "VERIFIED" : "UNAVAILABLE");
    assert.ok(["REMOVED", "NOT_CREATED"].includes(receipt.cleanup.credentials));
    assert.ok(Object.values(receipt.counts).every(value => value === 0));
    const creatorLoop = markdownSection(openLoops, "## FM-LOOP-CREATOR-SOCIAL-20260910");
    assert.match(creatorLoop, /- Exact next boundary: source preflight, profile-transition design and bounded transition-generator work are ACCEPTED\/CONSUMED/u);
    const generatorDependency = markdownSection(dependencies, "## DEP-CREATOR-FOUNDATION-TRANSITION-GENERATOR-20260926");
    assert.match(generatorDependency, /- Status: ACCEPTED; exact bounded repository source continuation consumed\./u);
    assert.match(profileDesign.instruction, /Completed and consumed repository source package/u);
    assert.match(profileDesign.instruction, /No target\/provider call, APPLY, target reference acceptance or runtime activation occurred/u);
    assert.match(profileDesign.instruction, /distinct protected action with current authorization and exact target binding/u);
    const sourceReceipt = JSON.parse(read("project-memory/receipts/creator-foundation-profile-transition-pr1207-source.json"));
    assert.equal(sourceReceipt.status, "ACCEPTED");
    assert.equal(sourceReceipt.final_head, "3cd67cedbcdc051be855d09de8d5ea3225179217");
    assert.equal(sourceReceipt.targetAccepted, false);
    assert.equal(sourceReceipt.applyAllowed, false);
    assert.equal(sourceReceipt.runtimeActivated, false);
    assert.equal(sourceReceipt.ci.tested_checkout_sha, "b323361cafc3829e470f6da611c7ab7d8c8664f6");
    assert.equal(sourceReceipt.reference_artifact.manifest_sha256, "f21e3fbdb01fe136e3a1b3924e86f6982423cfca57f3e845baf037e89a6d87bb");
    const freshness = evidenceFreshness.entries.find((entry) => entry.id === "EV-CREATOR-FOUNDATION-PROFILE-TRANSITION-PR1207");
    assert.ok(freshness);
    assert.equal(freshness.gate, "creator_foundation_profile_transition_design");
    assert.equal(freshness.class, "immutable_commit");
    assert.equal(freshness.status, "ACCEPTED");
    assert.match(freshness.source, /b323361cafc3829e470f6da611c7ab7d8c8664f6/u);
  }
  // Permanent closeout invariants must survive active-catalog cleanup and the
  // selection of later Creator actions.
    const generatorReceipt = JSON.parse(read("project-memory/receipts/creator-foundation-transition-generator-pr1209-source.json"));
    assert.equal(generatorReceipt.status, "ACCEPTED");
    assert.equal(generatorReceipt.final_head, "176efc9bfaf84b75b72591abb6a4bcc453e4a58c");
    assert.equal(generatorReceipt.merge_sha, "08fba825d1228d5b57ff0d145919b6bdb51d7504");
    assert.equal(generatorReceipt.ci.native_pg17_job_id, "108523066296");
    assert.equal(generatorReceipt.independent_review.open_review_threads, 0);
    assert.equal(generatorReceipt.targetAccepted, false);
    assert.equal(generatorReceipt.applyAllowed, false);
    assert.equal(generatorReceipt.runtimeActivated, false);
    const currentCreatorReaders = [
      markdownSection(taskLedger, "## FM-CREATOR-001 — bounded Staging catalog observation — 2026-09-26"),
      markdownSection(taskLedger, "## FM-CREATOR-001 — Foundation reconciliation preflight — 2026-09-26"),
      markdownSection(taskLedger, "## FM-CREATOR-001 — Confirmed-Chat VERIFY — 2026-09-26"),
      markdownSection(startedWork, "## FM-CREATOR-001 — bounded Staging catalog observation — 2026-09-26"),
      markdownSection(startedWork, "## FM-CREATOR-001 — bounded Foundation reconciliation preflight — 2026-09-26"),
      markdownSection(startedWork, "## FM-CREATOR-001 — bounded Confirmed-Chat VERIFY — 2026-09-26"),
      markdownSection(executionReceipts, "## FM-EXEC-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN-20260926"),
      markdownSection(executionReceipts, "## FM-EXEC-CREATOR-FOUNDATION-STAGING-CATALOG-20260926"),
      markdownSection(executionReceipts, "## FM-EXEC-CREATOR-FOUNDATION-RECONCILIATION-20260926"),
      markdownSection(executionReceipts, "## FM-EXEC-CREATOR-CONFIRMED-CHAT-VERIFY-20260926"),
      markdownSection(dependencies, "## DEP-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN-20260926"),
      markdownSection(workLocks, "## LOCK-FM-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN-20260926"),
    ];
    for (const section of currentCreatorReaders) {
      assert.match(section, /(?:superseded by the accepted\/consumed .*PR #1209|already ACCEPTED\/CONSUMED by PR #1209)/u);
      const generatorNextLines = section.split("\n").filter(
        (line) =>
          /(?:Next action|Next integration|Next step|Next|Remaining dependency):/iu.test(line) &&
          line.includes(generatorId),
      );
      assert.ok(generatorNextLines.length > 0, section);
      for (const line of generatorNextLines) {
        assert.equal(consumedGeneratorNextLineIsClosed(line), true, line);
      }
    }
    const mandatoryPreflightReaders = [
      agents,
      sourceOfTruth,
      protocol,
      executionPolicy,
      currentState,
      deepAudit,
      finishline,
      finishlineState,
      nextAction,
      deferredOwnerActions,
      autoHandoff,
      ownerActionInbox,
      sessionHandoff,
      startedWork,
      workLocks,
      openLoops,
      taskLedger,
      dependencies,
      decisions,
      failedAttempts,
      executionReceipts,
      actionCatalogText,
      changeRequests,
      evidence,
      doNotAssume,
      authorizations,
      reconciliationLog,
      assumptions,
      contradictions,
    ];
    for (const requiredReader of [
      actionCatalogText,
      changeRequests,
      evidence,
      doNotAssume,
      authorizations,
      reconciliationLog,
      assumptions,
      contradictions,
    ]) {
      assert.ok(mandatoryPreflightReaders.includes(requiredReader), "missing mandatory operational reader");
    }
    for (const reader of mandatoryPreflightReaders) {
      const generatorNextLines = reader.split("\n").filter(
        (line) =>
          /(?:Next action|Next integration|Next step|Next|Remaining dependency):/iu.test(line) &&
          /NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR/u.test(line),
      );
      for (const line of generatorNextLines) {
        assert.equal(consumedGeneratorNextLineIsClosed(line), true, line);
      }
    }
    const catalogInstruction = `${generatorId} is ACCEPTED/CONSUMED; ${transitionGenerator.instruction}`;
    assert.equal(consumedGeneratorNextLineIsClosed(`${catalogInstruction} Implement it again.`), false);
    assert.equal(consumedGeneratorNextLineIsClosed(`Next action: ${generatorId}`), false);
    assert.equal(consumedGeneratorNextLineIsClosed(`Next: Implement ${generatorId}`), false);
    assert.equal(consumedGeneratorNextLineIsClosed(`Next: Do not start ${generatorId}`), true);
    assert.equal(
      consumedGeneratorNextLineIsClosed(`Next: Do not start or implement ${generatorId}`),
      true,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(`Next action: Do not wait; implement ${generatorId}`),
      false,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(
        `Next action: ${generatorId} ACCEPTED/CONSUMED; implement it again`,
      ),
      false,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(
        `Next action: ${generatorId} ACCEPTED/CONSUMED; do not start it, instead revise the plan and implement it again`,
      ),
      false,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(`Next: Do not start, implement, or reopen ${generatorId}`),
      false,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(
        `Next action: ${generatorId} ACCEPTED/CONSUMED; do not start, implement it instead`,
      ),
      false,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(
        `Next: superseded by the accepted/consumed source in PR #1209; do not implement ${generatorId} again`,
      ),
      true,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(
        `Next: ${generatorId} is ACCEPTED/CONSUMED; implement the separately authorized target transition`,
      ),
      true,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(`Next: ${generatorId} is ACCEPTED/CONSUMED; rebuild it`),
      false,
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(`Next: ${generatorId} is ACCEPTED/CONSUMED; resume it`),
      false,
    );
    const reopeningVerbs = ["start", "restart", "implement", "reopen", "rebuild", "resume", "continue"];
    const consumedGeneratorTargets = [
      generatorId,
      `\`${generatorId}\``,
      "work on it",
      `work on \`${generatorId}\``,
      `implementation of ${generatorId}`,
      "this",
      "the work",
      "this work",
      "that work",
      "the implementation",
      "this implementation",
      "that implementation",
      "the same work",
      "the original implementation",
    ];
    for (const verb of reopeningVerbs) {
      for (const target of consumedGeneratorTargets) {
        assert.equal(
          consumedGeneratorNextLineIsClosed(
            `Next: ${generatorId} is ACCEPTED/CONSUMED; ${verb} ${target}`,
          ),
          false,
          `${verb} ${target}`,
        );
        assert.equal(
          consumedGeneratorNextLineIsClosed(
            `Next: ${generatorId} is ACCEPTED/CONSUMED; do not ${verb} ${target}`,
          ),
          true,
          `do not ${verb} ${target}`,
        );
      }
    }
    for (const unfinishedStatus of [
      "is not ACCEPTED/CONSUMED yet",
      "is not yet ACCEPTED/CONSUMED",
      "is not DONE",
      "is never DONE",
    ]) {
      assert.equal(
        consumedGeneratorNextLineIsClosed(`Next: ${generatorId} ${unfinishedStatus}`),
        false,
        unfinishedStatus,
      );
    }
    for (const unclassifiedReopenDirective of [
      `repeat ${generatorId}`,
      "proceed with it",
      `advance work on \`${generatorId}\``,
      "continue this",
      "continue that work",
      "rebuild this",
      "rebuild the implementation",
      "resume the work",
      "resume the implementation",
    ]) {
      assert.equal(
        consumedGeneratorNextLineIsClosed(
          `Next: ${generatorId} is ACCEPTED/CONSUMED; ${unclassifiedReopenDirective}`,
        ),
        false,
        unclassifiedReopenDirective,
      );
    }
    assert.equal(
      consumedGeneratorNextLineIsClosed(
        `Next: not superseded by the accepted/consumed ${generatorId} source package`,
      ),
      false,
    );
    for (const negatedCompletion of [
      `not fully superseded by the accepted/consumed ${generatorId} source package`,
      `no longer superseded by the accepted/consumed ${generatorId} source package`,
      `isn't superseded by the accepted/consumed ${generatorId} source package`,
      `wasn't superseded by the accepted/consumed ${generatorId} source package`,
      `${generatorId} is DONE but not ACCEPTED/CONSUMED`,
      `${generatorId} is ACCEPTED/CONSUMED, but not DONE`,
      `${generatorId} is DONE but cannot be ACCEPTED/CONSUMED`,
      `${generatorId} is DONE but can't be ACCEPTED/CONSUMED`,
      `${generatorId} is DONE but won't be ACCEPTED/CONSUMED`,
      `${generatorId} is DONE, but not completed`,
      `${generatorId} is ACCEPTED/CONSUMED, but remains incomplete`,
      `${generatorId} is ACCEPTED/CONSUMED, but still unfinished`,
      `${generatorId} is ACCEPTED/CONSUMED, but remains IN_PROGRESS`,
      `${generatorId} is ACCEPTED/CONSUMED, but is still in progress`,
    ]) {
      assert.equal(
        consumedGeneratorNextLineIsClosed(`Next: ${negatedCompletion}`),
        false,
        negatedCompletion,
      );
    }
    for (const passiveReopenDirective of [
      "must be implemented again",
      "needs to be reopened",
      "should be rebuilt",
      "will be resumed",
      "must be continued",
      "has to be restarted",
      "must be reimplemented",
      "needs to be re-implemented",
    ]) {
      assert.equal(
        consumedGeneratorNextLineIsClosed(
          `Next: ${generatorId} is ACCEPTED/CONSUMED but ${passiveReopenDirective}`,
        ),
        false,
        passiveReopenDirective,
      );
    }
    assert.equal(
      consumedGeneratorNextLineIsClosed(`Next: 😀😀😀 Do not start ${generatorId}; ${generatorId}`),
      false,
      "UTF-16 offsets must not hide a remaining generator reference",
    );
    assert.equal(
      consumedGeneratorNextLineIsClosed(`Next: 😀😀😀 Do not start ${generatorId}`),
      true,
      "UTF-16 offsets must preserve a fully closed directive",
    );
    const generatorFreshness = evidenceFreshness.entries.find((entry) => entry.id === "EV-CREATOR-FOUNDATION-TRANSITION-GENERATOR-PR1209");
    assert.ok(generatorFreshness);
    assert.equal(generatorFreshness.gate, "creator_foundation_transition_generator");
    assert.equal(generatorFreshness.class, "immutable_commit");
    assert.equal(generatorFreshness.status, "ACCEPTED");
    const acceptedEvidence = markdownSection(evidence, "## EV-CREATOR-FOUNDATION-PROFILE-TRANSITION-PR1207");
    assert.match(acceptedEvidence, /- Status: ACCEPTED; immutable repository source package, consumed\./u);
    assert.match(acceptedEvidence, /b323361cafc3829e470f6da611c7ab7d8c8664f6/u);
    assert.match(acceptedEvidence, /The transition generator is ACCEPTED\/CONSUMED by PR #1209/u);
    assert.ok(transitionGenerator);
    assert.equal(transitionGenerator.priority, 2);
    assert.equal(transitionGenerator.requires_owner, false);
    assert.equal(transitionGenerator.parallel_safe, false);
    assert.deepEqual(transitionGenerator.depends_on_actions, [designId]);
    assert.equal(transitionGenerator.gate, "creator_foundation_transition_generator");
    assert.match(transitionGenerator.instruction, /Completed and consumed repository source package/u);
    assert.match(transitionGenerator.instruction, /No target\/provider call, target observation\/reference acceptance, SQL APPLY/u);
    assert.match(transitionDesign, /PROFIL-\/DESIGN-SOURCE UND ÜBERGANGSGENERATOR ACCEPTED\/CONSUMED/u);
    assert.match(transitionDesign, /`NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR` ist als Repository-Source \*\*ACCEPTED\/CONSUMED\*\*/u);
    assert.doesNotMatch(transitionDesign, /Unabhängig freigegebener Hosted-Vertrag fehlt/u);
    assert.match(nextAction, /- `NBA-CREATOR-FOUNDATION-PROFILE-TRANSITION-DESIGN` priority 14: \*\*DONE\*\*/u);
    assert.match(nextAction, /- `NBA-CREATOR-FOUNDATION-TRANSITION-GENERATOR` priority 2: \*\*DONE\*\*/u);
    assert.match(nextAction, /- SAFE READY SET: `NONE`/u);
  if (!profileDesign && catalogObservation) {
    assert.equal(catalogObservation.priority, 2);
    assert.equal(catalogObservation.requires_owner, true);
    assert.equal(catalogObservation.parallel_safe, false);
    assert.deepEqual(catalogObservation.depends_on_actions, [reconciliationId]);
    assert.equal(catalogObservation.gate, "creator_foundation_staging_catalog");
    assert.ok(catalogObservation.prerequisite_gates.includes("creator_foundation_reconciliation_preflight"));
    assert.equal(reconciliation.priority, 12);
    assert.deepEqual(reconciliation.done_states, ["ACCEPTED"]);
    assert.match(reconciliation.instruction, /Completed and consumed repository source package/u);
    const state = JSON.parse(read("project-memory/FINISHLINE_STATE.json"));
    assert.equal(state.gates.creator_foundation_reconciliation_preflight.state, "ACCEPTED");
    assert.equal(state.gates.creator_foundation_staging_catalog.state, "IN_PROGRESS");
    assert.equal(state.gates.creator_intelligence.state, "IN_PROGRESS");
    assert.equal(state.gates.creator_confirmed_chat_staging_verify.state, "RECONCILED");
    assert.equal(state.gates.creator_confirmed_chat_staging_verify.workflow_conclusion, "failure");
    const creatorLoop = markdownSection(openLoops, "## FM-LOOP-CREATOR-SOCIAL-20260910");
    assert.match(creatorLoop, /- Exact next: NBA-CREATOR-FOUNDATION-STAGING-CATALOG/u);
    assert.doesNotMatch(creatorLoop, /- Exact next: NBA-CREATOR-(?:CONFIRMED-CHAT-STAGING-VERIFY|FOUNDATION-RECONCILIATION-PREFLIGHT)/u);
    assert.match(catalogObservation.instruction, /Missing or untrusted reference\/profile\/coverage means INCOMPLETE/u);
    assert.match(catalogObservation.instruction, /targetAccepted=false, applyAllowed=false, learningState=UNDETERMINED and runtimeActivated=false/u);
    assert.match(catalogObservation.instruction, /No schema APPLY/u);
    assert.match(nextAction, /- Selected action: `NBA-CREATOR-FOUNDATION-STAGING-CATALOG`/u);
    assert.match(nextAction, /- Selection status: `OWNER_ACTION_REQUIRED`/u);
  } else if (!profileDesign && reconciliation) {
    assert.equal(reconciliation.priority, 2);
    assert.equal(reconciliation.requires_owner, false);
    assert.deepEqual(reconciliation.depends_on_actions, [verifyId]);
    assert.equal(reconciliation.gate, "creator_foundation_reconciliation_preflight");
    const creatorLoop = markdownSection(openLoops, "## FM-LOOP-CREATOR-SOCIAL-20260910");
    assert.match(creatorLoop, /- Exact next: NBA-CREATOR-FOUNDATION-RECONCILIATION-PREFLIGHT/u);
    assert.doesNotMatch(creatorLoop, /- Exact next: NBA-CREATOR-CONFIRMED-CHAT-STAGING-VERIFY/u);
    const state = JSON.parse(read("project-memory/FINISHLINE_STATE.json"));
    assert.equal(state.gates.creator_confirmed_chat_staging_verify.state, "RECONCILED");
    assert.equal(state.gates.creator_confirmed_chat_staging_verify.observed_result, "FOUNDATION_MISSING");
    assert.equal(state.gates.creator_confirmed_chat_staging_verify.workflow_conclusion, "failure");
    assert.match(reconciliation.instruction, /No target DDL/u);
  } else if (!profileDesign) {
    assert.match(nextAction, /- SAFE READY SET: `NONE`/u);
    assert.match(nextAction, /- Selection status: `OWNER_ACTION_REQUIRED`/u);
  }
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
  assert.match(applyReceipt, /manual application-flow acceptance is also completed and consumed/u);
  assert.doesNotMatch(applyReceipt, /DB\/RLS ACCEPT and later manual application flow remain open/u);

  assert.ok(applyAction);
  assert.match(applyAction.instruction, /DB\/RLS ACCEPT is also completed and consumed/u);
  assert.match(applyAction.instruction, /manual application-flow action/u);
  const finishline = JSON.parse(read("project-memory/FINISHLINE_STATE.json"));
  for (const gate of ["chatadmin_staging_apply", "chatadmin_staging_accept", "chatadmin_manual_flow"]) {
    assert.equal(finishline.gates[gate].state, "ACCEPTED");
    assert.equal(finishline.gates[gate].required_for_sales, false);
  }
  assert.equal(finishline.sales_ready, false);
  const manualReceipt = markdownSection(executionReceipts, "## FM-EXEC-CHATADMIN-MANUAL-FLOW-20260926");
  assert.match(manualReceipt, /- Status: ACCEPTED/u);
  const manualAction = actionCatalog.actions.find(action => action.id === "NBA-CHATADMIN-MANUAL-FLOW");
  assert.ok(manualAction);
  assert.deepEqual(manualAction.done_states, ["ACCEPTED"]);
  assert.match(manualAction.instruction, /Completed and consumed/u);
  const freshness = JSON.parse(read("project-memory/EVIDENCE_FRESHNESS.json"));
  const oldReadiness = freshness.entries.find(entry => entry.id === "EV-CHATADMIN-STAGING-SCHEMA-POSTFLIGHT-20260926");
  assert.equal(oldReadiness.status, "SUPERSEDED");
  assert.equal(oldReadiness.observed_at, "2026-09-26T11:33:25Z");
  const manualEvidence = freshness.entries.find(entry => entry.id === oldReadiness.superseded_by);
  assert.equal(manualEvidence.gate, "chatadmin_manual_flow");
  assert.equal(manualEvidence.class, "immutable_commit");
  assert.equal(manualEvidence.status, "ACCEPTED");

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

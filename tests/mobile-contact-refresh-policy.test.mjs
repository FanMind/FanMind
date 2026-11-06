import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createContactLoadSequence,
  resolveContactLoadTarget,
} from "../apps/mobile/src/lib/contactRefreshPolicy.mjs";

const WORKSPACE = { id: "workspace-1", name: "FanMind Test" };

test("first online refresh uses its resolved workspace without a stale fallback", () => {
  const current = {
    workspace: null,
    transportUnavailable: true,
  };
  assert.deepEqual(
    resolveContactLoadTarget(current, {
      workspace: WORKSPACE,
      transportUnavailable: false,
    }),
    {
      workspace: WORKSPACE,
      transportUnavailable: false,
    },
  );
  assert.deepEqual(
    resolveContactLoadTarget(
      { workspace: WORKSPACE, transportUnavailable: false },
      { workspace: null, transportUnavailable: true },
    ),
    {
      workspace: null,
      transportUnavailable: true,
    },
  );
  assert.deepEqual(resolveContactLoadTarget(current), current);
});

test("a cached rerender cannot invalidate an in-flight explicit refresh", () => {
  const sequence = createContactLoadSequence();
  const explicitRefresh = sequence.begin();

  // The cached non-refresh path returns before begin() is called.
  assert.equal(sequence.isCurrent(explicitRefresh), true);
  assert.equal(sequence.isCurrent(sequence.begin()), true);
  assert.equal(sequence.isCurrent(explicitRefresh), false);

  const pending = sequence.begin();
  sequence.invalidate();
  assert.equal(sequence.isCurrent(pending), false);
});

test("a changed search invalidates pending loads but a cached rerender does not", () => {
  const sequence = createContactLoadSequence("");
  const pending = sequence.begin();

  assert.equal(sequence.updateSearch(""), false);
  assert.equal(sequence.isCurrent(pending), true);
  assert.equal(sequence.updateSearch("sandra"), true);
  assert.equal(sequence.isCurrent(pending), false);

  const replacement = sequence.begin();
  assert.equal(sequence.updateSearch("sandra"), false);
  assert.equal(sequence.isCurrent(replacement), true);
});

test("contacts pass the exact refresh result and sequence cached loads safely", async () => {
  const source = await readFile(
    new URL(
      "../apps/mobile/app/(app)/contacts/index.tsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(source, /const result = await refreshWorkspace\(\)/);
  assert.match(source, /await load\(true, result\)/);
  assert.doesNotMatch(
    source,
    /refreshWorkspace\(\)\.then\(\(\) => load\(true\)\)/,
  );
  assert.ok(
    source.indexOf("if (usingCache && !isRefresh)") <
      source.indexOf("loadSequence.current.begin()"),
  );
  assert.match(source, /loadSequence\.current\.updateSearch\(value\)/u);
});

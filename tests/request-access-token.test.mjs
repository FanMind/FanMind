import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/requestAccessToken.ts", import.meta.url), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const temp = await mkdtemp(join(tmpdir(), "fanmind-bearer-test-"));
const modulePath = join(temp, "requestAccessToken.mjs");
await writeFile(modulePath, transpiled);
const auth = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);

function request(authorization) {
  return {
    headers: {
      get(name) {
        return name.toLowerCase() === "authorization" ? authorization ?? null : null;
      },
    },
  };
}

test("missing Authorization header preserves the existing Web cookie path", () => {
  assert.equal(auth.getOptionalBearerAccessToken(request()), undefined);
});

test("valid Bearer token is returned without mutation", () => {
  const token = `eyJ${"a".repeat(80)}.${"b".repeat(80)}.${"c".repeat(40)}`;
  assert.equal(auth.getOptionalBearerAccessToken(request(`Bearer ${token}`)), token);
});

test("malformed schemes, short values and whitespace are rejected", () => {
  for (const value of [
    "Basic abcdefghijklmnopqrstuvwxyz",
    "bearer abcdefghijklmnopqrstuvwxyz",
    "Bearer short",
    `Bearer ${"a".repeat(30)} extra`,
    `Bearer ${"a".repeat(30)}\nInjected`,
  ]) {
    assert.throws(
      () => auth.getOptionalBearerAccessToken(request(value)),
      (error) => error?.name === "BearerAccessTokenError",
    );
  }
});

test("parser never logs or stores the access token", () => {
  assert.doesNotMatch(source, /console\.(?:log|warn|error)/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|cookies\(/);
  assert.match(source, /return token/);
});

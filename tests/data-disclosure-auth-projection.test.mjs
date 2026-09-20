import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

async function loadProjection() {
  const source = await readFile("src/lib/dataDisclosureAuthProjection.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const directory = await mkdtemp(join(process.cwd(), ".auth-disclosure-"));
  const file = join(directory, "projection.mjs");
  await writeFile(file, output);
  return {
    module: await import(`${pathToFileURL(file).href}?${Date.now()}`),
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

test("Auth disclosure includes available account dates and bounded credential-free identities", async () => {
  const loaded = await loadProjection();
  try {
    const identities = Array.from({ length: 25 }, (_, index) => ({
      id: `identity-${index}`,
      provider: index % 2 ? "google" : "email",
      created_at: "2026-01-01T00:00:00Z",
      identity_data: {
        email: `creator-${index}@example.invalid`,
        full_name: `Creator ${index}`,
        access_token: "NEVER_EXPORT_ACCESS",
        provider_token: "NEVER_EXPORT_PROVIDER",
        arbitrary_private_blob: "NEVER_EXPORT_ARBITRARY",
      },
      provider_token: "NEVER_EXPORT_TOP_LEVEL",
    }));
    const projection = loaded.module.projectAuthAccountForDisclosure({
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-02-01T00:00:00Z",
      confirmed_at: "2026-01-01T00:01:00Z",
      email_confirmed_at: null,
      last_sign_in_at: "2026-02-02T00:00:00Z",
      app_metadata: { provider: "email", providers: ["email", "google"] },
      identities,
      access_token: "NEVER_EXPORT_ACCESS",
      refresh_token: "NEVER_EXPORT_REFRESH",
    });
    assert.equal(projection.created_at, "2026-01-01T00:00:00Z");
    assert.equal(projection.email_confirmed_at, null);
    assert.deepEqual(projection.providers, ["email", "google"]);
    assert.equal(projection.identities.length, 20);
    assert.equal(projection.identities[0].identity_metadata.email, "creator-0@example.invalid");
    assert.doesNotMatch(JSON.stringify(projection), /NEVER_EXPORT|access_token|refresh_token|provider_token|arbitrary_private_blob/u);
  } finally {
    await loaded.cleanup();
  }
});


import assert from "node:assert/strict";
import test from "node:test";

import {
  assertResourceInWorkspace,
  assertWorkspaceId,
  WorkspaceAuthorizationError,
} from "../src/lib/workspaceAuthorizationPolicy.mjs";

test("workspace authorization rejects missing workspace ids before resource access", () => {
  for (const value of [undefined, null, "", "   "]) {
    assert.throws(
      () => assertWorkspaceId(value),
      (error) =>
        error instanceof WorkspaceAuthorizationError &&
        error.code === "workspace_missing" &&
        error.message ===
          "workspace_id fehlt; workspace-gescopter Zugriff wurde abgebrochen.",
    );
  }
});

test("workspace authorization accepts only the exact authorized workspace", () => {
  assert.doesNotThrow(() =>
    assertResourceInWorkspace(
      { workspace_id: "workspace-a" },
      "workspace-a",
    ),
  );

  assert.throws(
    () =>
      assertResourceInWorkspace(
        { workspace_id: "workspace-a" },
        "workspace-b",
        "Kontakt",
      ),
    (error) =>
      error instanceof WorkspaceAuthorizationError &&
      error.code === "resource_forbidden" &&
      error.message ===
        "Kontakt wurde im autorisierten Workspace nicht gefunden.",
  );
});

test("workspace authorization does not include resource data in denial errors", () => {
  const privateValue = "private-contact-value";
  assert.throws(
    () =>
      assertResourceInWorkspace(
        { workspace_id: "workspace-a", privateValue },
        "workspace-b",
        "Kontakt",
      ),
    (error) =>
      error instanceof WorkspaceAuthorizationError &&
      !error.message.includes(privateValue) &&
      !JSON.stringify(error).includes(privateValue),
  );
});

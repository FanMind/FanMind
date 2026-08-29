import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  MOBILE_PASSWORD_RECOVERY_REDIRECT,
  MobileAuthRecoveryPolicyError,
  normalizeRecoveryEmail,
  parseMobileAuthRecoveryUrl,
  validateNewPassword,
} from "../apps/mobile/src/lib/authRecoveryPolicy.mjs";
import {
  contactToDraft,
  emptyContactDraft,
  normalizeContactDraft,
} from "../apps/mobile/src/lib/contactDraftPolicy.mjs";
import {
  addSecureStorageRegistryKey,
  normalizeSecureStorageRegistry,
  removeSecureStorageRegistryKey,
} from "../apps/mobile/src/lib/secureStorageRegistry.mjs";

async function read(path) {
  return readFile(path, "utf8");
}

test("Mobile recovery accepts only the FanMind reset route and bounded credentials", () => {
  assert.equal(MOBILE_PASSWORD_RECOVERY_REDIRECT, "fanmind://reset-password");

  assert.deepEqual(
    parseMobileAuthRecoveryUrl("fanmind://reset-password?code=pkce-code-123"),
    {
      mode: "pkce",
      recovery: true,
      code: "pkce-code-123",
      accessToken: null,
      refreshToken: null,
    },
  );

  assert.deepEqual(
    parseMobileAuthRecoveryUrl(
      "fanmind://reset-password#access_token=access123&refresh_token=refresh123&type=recovery",
    ),
    {
      mode: "tokens",
      recovery: true,
      code: null,
      accessToken: "access123",
      refreshToken: "refresh123",
    },
  );

  assert.throws(
    () => parseMobileAuthRecoveryUrl("https://fanmind.ch/reset-password?code=value"),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_scheme",
  );
  assert.throws(
    () => parseMobileAuthRecoveryUrl("fanmind://settings?code=value"),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_route",
  );
  assert.throws(
    () =>
      parseMobileAuthRecoveryUrl(
        "fanmind://reset-password?code=value&access_token=a&refresh_token=r",
      ),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "ambiguous_credentials",
  );
  assert.throws(
    () => parseMobileAuthRecoveryUrl("fanmind://reset-password#access_token=a"),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "partial_tokens",
  );
  assert.throws(
    () =>
      parseMobileAuthRecoveryUrl(
        "fanmind://reset-password#access_token=a&refresh_token=r",
      ),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_type",
  );
  assert.throws(
    () =>
      parseMobileAuthRecoveryUrl(
        "fanmind://reset-password#access_token=a&refresh_token=r&type=signup",
      ),
    (error) =>
      error instanceof MobileAuthRecoveryPolicyError &&
      error.code === "invalid_type",
  );
});

test("Mobile recovery email and password rules are normalized without enumeration", () => {
  assert.equal(normalizeRecoveryEmail("  USER@Example.COM "), "user@example.com");
  assert.throws(() => normalizeRecoveryEmail("invalid"), MobileAuthRecoveryPolicyError);

  assert.deepEqual(validateNewPassword("FanMindSecure2026", "FanMindSecure2026"), {
    ok: true,
    password: "FanMindSecure2026",
    errors: [],
  });
  assert.equal(validateNewPassword("short1", "short1").ok, false);
  assert.match(
    validateNewPassword("abcdefghijkl", "abcdefghijkl").errors.join("\n"),
    /password_complexity/u,
  );
  assert.match(
    validateNewPassword("FanMindSecure2026", "Different2026").errors.join("\n"),
    /password_mismatch/u,
  );
});

test("Mobile contact drafts normalize fields and reject unsafe values", () => {
  const result = normalizeContactDraft({
    displayName: "  Sandra M.  ",
    handle: " @Sandra_Fit ",
    sourcePlatform: " Instagram ",
    language: " DE-CH ",
    status: "VIP",
    tags: "Fitness; VIP,fitness",
    summary: " Interessiert ",
    internalNotes: " Nur intern ",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    display_name: "Sandra M.",
    handle: "@Sandra_Fit",
    source_platform: "instagram",
    language: "de-ch",
    status: "vip",
    tags: ["fitness", "vip"],
    summary: "Interessiert",
    internal_notes: "Nur intern",
  });

  assert.equal(normalizeContactDraft({ displayName: "" }).ok, false);
  assert.equal(
    normalizeContactDraft({ ...emptyContactDraft(), displayName: "A", status: "archived" }).ok,
    false,
  );
  assert.equal(
    normalizeContactDraft({ ...emptyContactDraft(), displayName: "A", language: "german" }).ok,
    false,
  );

  assert.deepEqual(
    contactToDraft({
      display_name: "Alex",
      handle: null,
      source_platform: null,
      language: null,
      status: null,
      tags: ["warm", "event"],
      summary: null,
      internal_notes: null,
    }),
    {
      displayName: "Alex",
      handle: "",
      sourcePlatform: "manual",
      language: "de",
      status: "new",
      tags: "warm; event",
      summary: "",
      internalNotes: "",
    },
  );
});

test("SecureStore registry is bounded, deduplicated and corruption-safe", () => {
  assert.deepEqual(normalizeSecureStorageRegistry("not-json"), []);
  assert.deepEqual(
    normalizeSecureStorageRegistry(JSON.stringify(["auth", "auth", "other", 3, ""])),
    ["auth", "other"],
  );
  assert.deepEqual(addSecureStorageRegistryKey(["auth"], "other"), ["auth", "other"]);
  assert.deepEqual(addSecureStorageRegistryKey(["auth"], "auth"), ["auth"]);
  assert.deepEqual(removeSecureStorageRegistryKey(["auth", "other"], "auth"), ["other"]);
  assert.deepEqual(addSecureStorageRegistryKey(["auth"], "invalid:key"), ["auth"]);
});

test("SecureStore purge enrolls valid keys and retains failed keys for retry", async () => {
  const source = await read("apps/mobile/src/lib/secureStorage.ts");

  assert.match(
    source,
    /Existing valid keys that predate registry enrollment[\s\S]*await registerKey\(key\)/u,
  );
  assert.match(source, /const MAX_SESSION_CHUNKS = 64/u);
  assert.match(source, /parsed <= MAX_SESSION_CHUNKS/u);
  assert.match(source, /const failedKeys: string\[\] = \[\]/u);
  assert.match(source, /failedKeys\.push\(key\)/u);
  assert.match(source, /await writeRegistry\(failedKeys\)/u);
  assert.match(source, /throw new Error\("Nicht alle sicheren FanMind-Schlüssel/u);
  assert.match(
    source,
    /await registerKey\(key\);[\s\S]*setItemAsync\([\s\S]*secureStoreCountKey\(key\)[\s\S]*for \(const \[index, chunk\] of chunks\.entries\(\)\)/u,
  );
  assert.match(source, /Keep the key registered so a later logout can retry the purge/u);
  assert.match(source, /A stale registry entry is safer than unregistered local data/u);
});

test("AuthProvider requires recovery confirmation without retaining or logging credentials", async () => {
  const source = await read("apps/mobile/src/providers/AuthProvider.tsx");

  assert.match(source, /resetPasswordForEmail/u);
  assert.match(source, /MOBILE_PASSWORD_RECOVERY_REDIRECT/u);
  assert.match(source, /exchangeCodeForSession/u);
  assert.match(source, /supabase\.auth\.setSession/u);
  assert.match(source, /waitForPasswordRecoveryEvent/u);
  assert.match(source, /event === "PASSWORD_RECOVERY"/u);
  assert.match(source, /recoveryEventResolver\.current\?\.\(\)/u);
  assert.match(source, /password_recovery_event_missing/u);
  assert.match(source, /recoveryStatus !== "ready"/u);
  assert.match(source, /supabase\.auth\.updateUser/u);
  assert.match(source, /clearSecureLocalStorage/u);
  assert.match(source, /recoveryAttemptActive/u);
  assert.match(source, /recoveryLinkHandled/u);
  assert.doesNotMatch(source, /handledRecoveryUrls|activeRecoveryUrl/u);
  assert.doesNotMatch(source, /new Set<string>|\.add\(url\)/u);
  assert.doesNotMatch(source, /console\.(?:log|warn|error)/u);
});

test("Mobile contact mutations stay workspace-bound and fail on duplicates", async () => {
  const source = await read("apps/mobile/src/lib/data.ts");

  assert.match(source, /export async function createContact/u);
  assert.match(source, /export async function updateContact/u);
  assert.match(source, /normalizeContactDraft/u);
  assert.match(source, /duplicateContactExists/u);
  assert.match(source, /\.eq\("workspace_id", input\.workspaceId\)/u);
  assert.match(source, /\.eq\("id", input\.contactId\)/u);
  assert.match(source, /\.ilike\("handle", input\.draft\.handle\)/u);
  assert.match(source, /Handle und dieser Quelle existiert bereits/u);
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role/u);
});

test("Mobile contact detail loads a bounded RLS-protected message history", async () => {
  const [data, detail] = await Promise.all([
    read("apps/mobile/src/lib/data.ts"),
    read("apps/mobile/app/(app)/contacts/[id].tsx"),
  ]);

  assert.match(data, /export async function listContactMessages/u);
  assert.match(
    data,
    /\.from\("conversation_messages"\)[\s\S]*\.eq\("workspace_id", workspaceId\)[\s\S]*\.eq\("contact_id", contactId\)[\s\S]*\.limit\(100\)/u,
  );
  assert.match(data, /recentMessages\.reverse\(\)/u);
  assert.match(detail, /listContactMessages\(workspace\.id, contactId\)/u);
  assert.match(detail, /Gesprächsverlauf/u);
  assert.match(detail, /messages\.map/u);
  assert.match(detail, /FanMind sendet keine Nachricht automatisch/u);
});

test("Mobile routes expose reset, create and edit flows with no automatic sending", async () => {
  const [login, forgot, reset, list, detail, create, edit, settings] = await Promise.all([
    read("apps/mobile/app/(auth)/login.tsx"),
    read("apps/mobile/app/(auth)/forgot-password.tsx"),
    read("apps/mobile/app/(auth)/reset-password.tsx"),
    read("apps/mobile/app/(app)/contacts/index.tsx"),
    read("apps/mobile/app/(app)/contacts/[id].tsx"),
    read("apps/mobile/app/(app)/contacts/new.tsx"),
    read("apps/mobile/app/(app)/contacts/[id]/edit.tsx"),
    read("apps/mobile/app/(app)/settings.tsx"),
  ]);

  assert.match(login, /Passwort vergessen/u);
  assert.match(forgot, /Wiederherstellungslink anfordern/u);
  assert.match(forgot, /nicht offengelegt, ob ein Konto existiert/u);
  assert.match(reset, /Recovery-Codes und Sitzungstokens werden weder angezeigt noch protokolliert/u);
  assert.match(list, /contacts\/new/u);
  assert.match(detail, /contacts\/\$\{contact\.id\}\/edit/u);
  assert.match(create, /createContact/u);
  assert.match(edit, /updateContact/u);
  assert.match(settings, /entfernt alle registrierten[\s\S]*FanMind-Schlüssel aus SecureStore/u);
  assert.match(detail, /Keine automatische Sendefunktion/u);
});

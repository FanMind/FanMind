import assert from "node:assert/strict";
import test from "node:test";
import { buildWebPasswordResetRedirect, readWebRecoveryAccessToken } from "../src/lib/webRecoveryPolicy.mjs";

const validHash = "#access_token=synthetic.recovery.token&type=recovery&token_type=bearer&refresh_token=unused";

test("password recovery preserves Production, Staging and local runtime origins", () => {
  for (const origin of ["https://fanmind.ch", "https://www.fanmind.ch", "https://staging.fanmind.ch", "http://127.0.0.1:3100", "http://localhost:3100", "http://[::1]:3100"]) {
    assert.equal(buildWebPasswordResetRedirect(origin), `${origin}/reset-password`);
    assert.equal(buildWebPasswordResetRedirect(origin, "en"), `${origin}/reset-password?lang=en`);
  }
  assert.equal(buildWebPasswordResetRedirect("https://staging.fanmind.ch", "en&next=https://example.com"), "https://staging.fanmind.ch/reset-password");
});

test("password reset rejects foreign, insecure and ambiguous origins", () => {
  for (const origin of ["", "https://example.com", "https://staging.fanmind.ch.example.com", "http://fanmind.ch", "ftp://localhost", "https://user:pass@fanmind.ch", "https://fanmind.ch:8443", "https://fanmind.ch/next", "https://fanmind.ch?next=1", "https://fanmind.ch#token"]) {
    assert.throws(() => buildWebPasswordResetRedirect(origin));
  }
});

test("only the recovery access token is returned; refresh token is never retained", () => {
  assert.equal(readWebRecoveryAccessToken({ hash: validHash, search: "?lang=en" }), "synthetic.recovery.token");
  assert.equal(readWebRecoveryAccessToken({ hash: "#type=recovery&access_token=synthetic.recovery.token" }), "synthetic.recovery.token");
});

test("missing, wrong-type, duplicate and malformed recovery fragments fail closed", () => {
  for (const hash of ["", "#type=recovery", "#access_token=token", validHash.replace("type=recovery", "type=signup"), `${validHash}&access_token=another`, `${validHash}&type=recovery`, `${validHash}&token_type=basic`, "#type=recovery&access_token=%20token", "#type=recovery&access_token=token%0A", `#type=recovery&access_token=${"a".repeat(8193)}`, "a".repeat(16385)]) {
    assert.equal(readWebRecoveryAccessToken({ hash }), null);
  }
  assert.equal(readWebRecoveryAccessToken({ hash: null }), null);
});

test("provider errors override valid-looking credentials without returning provider text", () => {
  for (const name of ["error", "error_code", "error_description", "code", "token_hash"]) {
    assert.equal(readWebRecoveryAccessToken({ hash: `${validHash}&${name}=` }), null);
    assert.equal(readWebRecoveryAccessToken({ hash: validHash, search: `?${name}=sensitive-provider-detail` }), null);
  }
});

test("query credentials and mixed query/fragment recovery flows are rejected", () => {
  for (const name of ["access_token", "refresh_token", "type", "token_type", "expires_at", "expires_in"]) {
    assert.equal(readWebRecoveryAccessToken({ hash: validHash, search: `?${name}=token` }), null);
  }
  assert.equal(readWebRecoveryAccessToken({ search: "?type=recovery&access_token=token" }), null);
  assert.equal(readWebRecoveryAccessToken({ hash: validHash, search: "a".repeat(2049) }), null);
});

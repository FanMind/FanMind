import assert from "node:assert/strict";
import test from "node:test";
import { buildWebPasswordResetRedirect, readWebRecoveryAccessToken } from "../src/lib/webRecoveryPolicy.mjs";
import { buildWebRegistrationRedirect, buildRegistrationAccountMetadata, readWebRegistrationSession, registrationErrorMessage } from "../src/lib/webRegistrationPolicy.mjs";

const validHash = "#access_token=synthetic.recovery.token&type=recovery&token_type=bearer&refresh_token=unused";
const signupHash = "#access_token=synthetic.signup.token&refresh_token=synthetic-refresh&type=signup&token_type=bearer&expires_in=3600";

test("signup return URLs stay in the requesting FanMind environment", () => {
  for (const origin of ["https://fanmind.ch", "https://staging.fanmind.ch", "http://127.0.0.1:3100"]) {
    assert.equal(buildWebRegistrationRedirect(origin, "en"), `${origin}/register/confirm?lang=en`);
  }
  for (const origin of ["https://fanmind.ch.example.com", "https://example.com", "http://fanmind.ch", "https://fanmind.ch?next=x"]) assert.throws(() => buildWebRegistrationRedirect(origin));
});

test("signup account metadata cannot grant a paid plan, billing state or terms acceptance", () => {
  const metadata = buildRegistrationAccountMetadata({ name: " Person ", organization: "x".repeat(300), planId: "agency", commercialOption: "attacker", language: "en", referralCode: "REF-TEST", plan_id: "agency", payment_terms_accepted: true, payment_terms_version: "2026-06-v1", billing_status: "active", billing_provider: "stripe" });
  assert.equal(metadata.full_name, "Person");
  assert.equal(metadata.organization.length, 160);
  assert.equal(metadata.registration_plan_preference, "starter");
  assert.equal(metadata.registration_option_preference, "starter_paid_setup");
  assert.equal(metadata.referral_code, "REF-TEST");
  for (const key of ["plan_id", "commercial_option", "payment_terms_accepted", "payment_terms_version", "billing_status", "billing_provider"]) assert.equal(Object.hasOwn(metadata, key), false);
});

test("signup callback accepts only one bounded signup session in a clean fragment", () => {
  assert.deepEqual(readWebRegistrationSession({ hash: signupHash, search: "?lang=en" }), { access_token: "synthetic.signup.token", refresh_token: "synthetic-refresh", expires_in: 3600 });
  for (const hash of ["", validHash, signupHash.replace("type=signup", "type=recovery"), `${signupHash}&access_token=other`, `${signupHash}&error=denied`, `${signupHash}&code=mixed`, signupHash.replace("expires_in=3600", "expires_in=0"), signupHash.replace("expires_in=3600", "expires_in=86401"), signupHash.replace("synthetic-refresh", "x".repeat(4001)), "x".repeat(16385)]) {
    assert.equal(readWebRegistrationSession({ hash }), null);
  }
  for (const search of ["?access_token=token", "?code=mixed", "?error_code=expired", "?lang=en&lang=de", "?next=https://example.com"]) assert.equal(readWebRegistrationSession({ hash: signupHash, search }), null);
});

test("registration errors never expose arbitrary provider diagnostics", () => {
  assert.equal(registrationErrorMessage(new Error("private-provider-detail"), "en").includes("private-provider-detail"), false);
  assert.match(registrationErrorMessage(new Error("Email rate limit exceeded")), /Minute/u);
  assert.match(registrationErrorMessage(new Error("User already registered")), /bestehenden Konto/u);
});

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

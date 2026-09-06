import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function resolveStagingBillingFreeze(requested, previousRelease) {
  if (requested === "true" || requested === "false") return requested;
  if (requested !== "preserve") throw new Error("invalid_freeze_choice");
  const entries = previousRelease.split(/\r?\n/u).filter((line) =>
    line.startsWith("FANMIND_STRIPE_BILLING_WRITE_FREEZE="),
  );
  if (entries.length === 0) return "false"; // Pre-freeze deployment baseline.
  if (entries.length !== 1) throw new Error("ambiguous_freeze_state");
  const value = entries[0].slice("FANMIND_STRIPE_BILLING_WRITE_FREEZE=".length);
  if (value !== "true" && value !== "false") throw new Error("invalid_freeze_state");
  return value;
}

export async function verifyStagingBillingFreeze({ origin, commit, fetchImpl = fetch }) {
  const target = new URL(origin);
  if (target.protocol !== "https:" || target.username || target.password ||
      target.port || target.search || target.hash || target.pathname !== "/" ||
      ["fanmind.ch", "www.fanmind.ch"].includes(target.hostname.replace(/\.$/u, "")) ||
      !/^[0-9a-f]{40}$/u.test(commit)) throw new Error("invalid_staging_target");

  async function request(path, options = {}) {
    const response = await fetchImpl(`${target.origin}${path}`, {
      ...options, redirect: "error", cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: { "Cache-Control": "no-cache", ...options.headers },
    });
    const text = await response.text();
    if (text.length > 8192) throw new Error("invalid_response");
    return { response, body: JSON.parse(text) };
  }
  async function verifyVersion() {
    const { response, body } = await request("/api/version");
    if (response.status !== 200 || body.application !== "fanmind" ||
        body.runtimeEnvironment !== "staging" || body.releaseCommit !== commit ||
        !response.headers.get("cache-control")?.includes("no-store")) {
      throw new Error("staging_release_mismatch");
    }
  }
  await verifyVersion();
  // No cookie, bearer credential or plan is sent. An unfrozen runtime returns
  // 401 and cannot create a Checkout session through this probe.
  const { response, body } = await request("/api/billing/checkout", {
    method: "POST", headers: { Origin: target.origin, "Content-Type": "application/json" },
    body: "{}",
  });
  if (response.status !== 503 || body.code !== "stripe_billing_write_frozen" ||
      response.headers.get("retry-after") !== "60") throw new Error("staging_freeze_not_active");
  await verifyVersion();
}

async function main() {
  const [mode, first, second] = process.argv.slice(2);
  if (mode === "--resolve") {
    let previous = "";
    try { previous = readFileSync(second, "utf8"); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
    console.log(resolveStagingBillingFreeze(first, previous));
  } else if (mode === "--verify") {
    await verifyStagingBillingFreeze({ origin: first, commit: second });
    console.log("STAGING_BILLING_FREEZE_RUNTIME=PASS");
  } else throw new Error("invalid_mode");
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("STAGING_BILLING_FREEZE_CONTROL=FAIL");
    process.exitCode = 1;
  });
}

import { constants, openSync, fstatSync, closeSync, readFileSync, writeFileSync, renameSync, unlinkSync } from "node:fs";
import { randomBytes, createHmac } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { verifyStagingBillingFreeze } from "./staging-billing-freeze-control.mjs";
import { buildSupabaseApiKeyHeaders } from "../../src/lib/supabase/apiKeyPolicy.mjs";

const FILE = "/var/www/fanmind-staging/.release.env";
const ORIGIN = "https://staging.fanmind.ch";
const FLAGS = Object.freeze({
  FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED: "true",
  FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED: "20260816210000",
  FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED: "false",
});
export function preserveStagingBillingCapture(previous) {
  const fields = Object.keys(FLAGS);
  const found = Object.fromEntries(fields.map(key => {
    const entries = previous.split(/\r?\n/u).filter(line => line.startsWith(`${key}=`));
    if (entries.length > 1) throw Error("capture_state_invalid");
    return [key, entries[0]?.slice(key.length + 1)];
  }));
  if (Object.values(found).every(value => value === undefined)) return "";
  if (fields.some(key => found[key] !== FLAGS[key])) throw Error("capture_state_invalid");
  return fields.map(key => `${key}=${FLAGS[key]}`).join("\n");
}
export function renderStagingBillingCapture(previous) {
  const retained = previous.split(/\r?\n/u).filter(line => !Object.keys(FLAGS).some(key => line.startsWith(`${key}=`)));
  return `${retained.join("\n").replace(/\n*$/u, "")}\n${Object.entries(FLAGS).map(([key,value])=>`${key}=${value}`).join("\n")}\n`;
}
function privateRelease() {
  const fd = openSync(FILE, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.size > 16384) throw Error();
    return readFileSync(fd, "utf8");
  } finally { closeSync(fd); }
}
async function request(url, options = {}) {
  const response = await fetch(url, { ...options, redirect:"error", cache:"no-store", signal:AbortSignal.timeout(15000) });
  const text = await response.text();
  if (text.length > 16384) throw Error();
  return { response, body: JSON.parse(text) };
}
function boundary(env) {
  if (env.GITHUB_REF !== "refs/heads/main" || !/^[a-f0-9]{40}$/u.test(env.GITHUB_SHA ?? "") ||
      env.FANMIND_CAPTURE_CONFIRM !== "activate-staging-billing-capture" ||
      env.FANMIND_CAPTURE_SCHEMA_VERIFIED !== "true" ||
      env.FANMIND_RUNTIME_ENVIRONMENT !== "staging" || env.NEXT_PUBLIC_APP_URL !== ORIGIN ||
      !/^[a-z0-9]{20}$/u.test(env.FANMIND_CAPTURE_STAGING_REF ?? "") ||
      !/^[a-z0-9]{20}$/u.test(env.FANMIND_CAPTURE_PRODUCTION_REF ?? "") ||
      env.FANMIND_CAPTURE_STAGING_REF === env.FANMIND_CAPTURE_PRODUCTION_REF ||
      env.NEXT_PUBLIC_SUPABASE_URL !== `https://${env.FANMIND_CAPTURE_STAGING_REF}.supabase.co` ||
      env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF !== env.FANMIND_CAPTURE_PRODUCTION_REF ||
      env.FANMIND_STRIPE_BILLING_WRITE_FREEZE !== "true" ||
      env.FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED === "true" ||
      !/^(sk|rk)_test_/u.test(env.STRIPE_SECRET_KEY ?? "") ||
      !/^whsec_/u.test(env.STRIPE_WEBHOOK_SECRET ?? "") || !env.SUPABASE_SERVICE_ROLE_KEY) throw Error();
}
export function buildStagingCaptureEvent(runId, now) {
  if (!/^[0-9]{1,20}$/u.test(runId ?? "") || !Number.isSafeInteger(now)) throw Error();
  return { id: `evt_fanmind_capture_${runId}`, created: now, livemode: false,
    type: "checkout.session.completed", data: { object: { object: "checkout.session",
      id: `cs_test_fanmind_capture_${runId}`, mode: "subscription", payment_status: "unpaid" } } };
}
async function main() {
  const mode = process.argv[2];
  if (mode === "--preserve") {
    let previous = "";
    try { previous = privateRelease(); } catch(error) { if(error.code !== "ENOENT") throw error; }
    console.log(preserveStagingBillingCapture(previous)); return;
  }
  const env = process.env;
  boundary(env);
  await verifyStagingBillingFreeze({ origin: ORIGIN, commit: env.GITHUB_SHA });
  if (mode === "--activate") {
    const previous = privateRelease();
    if (!previous.split(/\r?\n/u).includes(`FANMIND_RELEASE_COMMIT=${env.GITHUB_SHA}`)) throw Error();
    preserveStagingBillingCapture(previous);
    const temporary = `${FILE}.capture-${randomBytes(8).toString("hex")}`;
    try { writeFileSync(temporary, renderStagingBillingCapture(previous), { mode:0o600, flag:"wx" }); renameSync(temporary, FILE); }
    finally { try { unlinkSync(temporary); } catch {} }
    console.log("STAGING_BILLING_CAPTURE_CONFIGURED=PASS"); return;
  }
  if (mode !== "--prove") throw Error();
  const now = Math.floor(Date.now()/1000);
  const event = buildStagingCaptureEvent(env.GITHUB_RUN_ID, now);
  const headers = buildSupabaseApiKeyHeaders(env.SUPABASE_SERVICE_ROLE_KEY);
  const eventUrl = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/workspace_stripe_billing_events?event_id=eq.${event.id}&select=event_id,event_type,workspace_id,processing_state,processing_reason,projection_revision`;
  const before = await request(eventUrl,{headers});
  if (!before.response.ok || !Array.isArray(before.body) || before.body.length !== 0) throw Error();
  const body = JSON.stringify(event);
  const signature = createHmac("sha256",env.STRIPE_WEBHOOK_SECRET).update(`${now}.${body}`).digest("hex");
  const received = await request(`${ORIGIN}/api/stripe/webhook`, { method:"POST", body,
    headers:{"Content-Type":"application/json","Stripe-Signature":`t=${now},v1=${signature}`} });
  if (!received.response.ok || received.body.received !== true) throw Error();
  const after = await request(eventUrl,{headers});
  const row = after.body?.[0];
  if (!after.response.ok || !Array.isArray(after.body) || after.body.length !== 1 ||
      row.event_id !== event.id || row.event_type !== event.type || row.workspace_id !== null ||
      row.processing_state !== "unresolved" || row.processing_reason !== "tenant_binding_missing" ||
      row.projection_revision !== 0) throw Error();
  await verifyStagingBillingFreeze({ origin: ORIGIN, commit: env.GITHUB_SHA });
  console.log("STAGING_BILLING_SIGNED_DURABLE_CAPTURE=PASS");
  console.log("STAGING_BILLING_CAPTURE_SYNTHETIC_AUDIT=retained");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(()=>{console.error("STAGING_BILLING_CAPTURE=FAIL");process.exitCode=1;});
}

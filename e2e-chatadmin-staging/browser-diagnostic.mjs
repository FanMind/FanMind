import { createHash, randomBytes } from "node:crypto";
import { constants, openSync, closeSync, fstatSync, readFileSync, writeFileSync, fsyncSync, renameSync, rmSync } from "node:fs";
import { isAbsolute, join } from "node:path";

const MODES=["probe","acceptance"];
const STAGES=["browser_launch","browser_context","version","anonymous","admin_login_page","admin_login_form","admin_token","admin_identity","admin_dashboard","admin_authority","admin_denial","owner_login_page","owner_login_form","owner_token","owner_identity","owner_dashboard","secondary_login_page","secondary_login_form","secondary_token","secondary_identity","secondary_dashboard","chatadmin_page","persona_a_request","persona_a_response","persona_a_copy","persona_switch","persona_b_request","persona_b_response","persona_b_copy","negatives","network_check","complete"];
const OPTIONS={stage:STAGES,outcome:["running","passed","failed"],status:["none","2xx","3xx","4xx","5xx","other"],network:["none","origin","write","redirect","transport"],sessionCleanup:["not_started","passed","failed"]};
const FIELDS=["version","run","attempt","sha","target","source","mode",...Object.keys(OPTIONS)];
const fail=()=>{throw Error("CHAT_ADMIN_MANUAL_FLOW_ERROR=browser_diagnostic");};
function sourceDigest() {
  const hash=createHash("sha256");
  for(const file of ["./browser-diagnostic.mjs","./fixture-identity.mjs","./network-boundary.mjs","./manual-flow.spec.ts","../playwright.chatadmin-staging.config.mts","../scripts/operations/chat-admin-manual-flow-staging.mjs"])hash.update(readFileSync(new URL(file,import.meta.url)));
  return hash.digest("hex");
}
function binding(env,mode) {
  if(!MODES.includes(mode)||!/^\d+$/u.test(env.GITHUB_RUN_ID??"")||!/^\d+$/u.test(env.GITHUB_RUN_ATTEMPT??"")||!/^[a-f0-9]{40}$/u.test(env.GITHUB_SHA??"")||!/^[a-z0-9]{8,64}$/u.test(env.FANMIND_TARGET_SUPABASE_PROJECT_REF??""))fail();
  return {version:1,run:env.GITHUB_RUN_ID,attempt:env.GITHUB_RUN_ATTEMPT,sha:env.GITHUB_SHA,target:env.FANMIND_TARGET_SUPABASE_PROJECT_REF,source:sourceDigest(),mode};
}
function path(env,mode) {if(!isAbsolute(env.RUNNER_TEMP??"")||!MODES.includes(mode))fail();return join(env.RUNNER_TEMP,`fanmind-chat-admin-${mode}-diagnostic.json`);}
function validate(value,env,mode) {
  const expected=binding(env,mode);
  if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).length!==FIELDS.length||FIELDS.some(key=>!Object.hasOwn(value,key))||
    Object.entries(expected).some(([key,item])=>value[key]!==item)||Object.entries(OPTIONS).some(([key,allowed])=>!allowed.includes(value[key])))fail();
  return value;
}
export function readBrowserDiagnostic(env,mode) {
  const fd=openSync(path(env,mode),constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  let bytes;
  try {const stat=fstatSync(fd);if(!stat.isFile()||stat.uid!==process.getuid()||stat.nlink!==1||(stat.mode&0o777)!==0o600||stat.size<1||stat.size>4096)fail();bytes=readFileSync(fd);return validate(JSON.parse(bytes.toString("utf8")),env,mode);}
  finally {bytes?.fill(0);closeSync(fd);}
}
function writePrivate(file,value) {
  const fd=openSync(file,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{writeFileSync(fd,JSON.stringify(value));fsyncSync(fd);}finally{closeSync(fd);}
}
export function initializeBrowserDiagnostic(env,mode) {
  const value={...binding(env,mode),stage:"browser_launch",outcome:"running",status:"none",network:"none",sessionCleanup:"not_started"};
  writePrivate(path(env,mode),value);
}
export function updateBrowserDiagnostic(env,mode,patch) {
  const current=readBrowserDiagnostic(env,mode);
  if(!patch||typeof patch!=="object"||Object.keys(patch).some(key=>!Object.hasOwn(OPTIONS,key)))fail();
  const next=validate({...current,...patch},env,mode),temporary=`${path(env,mode)}.${randomBytes(8).toString("hex")}.tmp`;
  try{writePrivate(temporary,next);renameSync(temporary,path(env,mode));}finally{rmSync(temporary,{force:true});}
}
export function formatBrowserDiagnostic(env,mode) {
  const value=readBrowserDiagnostic(env,mode);
  // Construct output solely from validated enums; never relay a serialized object.
  return [`CHAT_ADMIN_MANUAL_MODE=${value.mode}`,`CHAT_ADMIN_MANUAL_STAGE=${value.stage}`,`CHAT_ADMIN_MANUAL_OUTCOME=${value.outcome}`,`CHAT_ADMIN_MANUAL_HTTP=${value.status}`,`CHAT_ADMIN_MANUAL_NETWORK=${value.network}`,`CHAT_ADMIN_MANUAL_SESSION_CLEANUP=${value.sessionCleanup}`];
}
export function requireSuccessfulProbe(env) {
  const value=readBrowserDiagnostic(env,"probe");
  if(value.stage!=="complete"||value.outcome!=="passed"||value.network!=="none"||value.sessionCleanup!=="passed")fail();
}

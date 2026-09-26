#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants, openSync, closeSync, fstatSync, fsyncSync, readSync, readFileSync, readlinkSync, realpathSync, lstatSync, linkSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { userInfo } from "node:os";
import { preserveStagingBillingCapture } from "./staging-billing-capture-runtime.mjs";

const SOURCE="/var/www/fanmind-staging", UNIT="/etc/systemd/system/fanmind-staging.service";
const REPOSITORY=resolve(dirname(fileURLToPath(import.meta.url)),"../..");
const APP="https://staging.fanmind.ch", SERVICE="fanmind-staging.service";
const BASE=["FANMIND_RELEASE_COMMIT","FANMIND_RUNTIME_ENVIRONMENT","NODE_ENV","FANMIND_STRIPE_BILLING_WRITE_FREEZE"];
const CAPTURE=["FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED","FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED","FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED","FANMIND_STAGING_BILLING_CAPTURE_ACTIVATION","FANMIND_STAGING_BILLING_CAPTURE_RECEIPT"];
const BINDING=["NEXT_PUBLIC_APP_URL","NEXT_PUBLIC_SUPABASE_URL","FANMIND_PRODUCTION_SUPABASE_PROJECT_REF","PORT"];
const KEYS=[...BASE,...CAPTURE,...BINDING].map(key=>[key,Buffer.from(key)]);
const RESERVED=["FANMIND_RELEASE_","FANMIND_RUNTIME_","FANMIND_STRIPE_BILLING_","FANMIND_STAGING_BILLING_CAPTURE_"].map(value=>Buffer.from(value));
const SERVICE_KEYS=["Id","LoadState","ActiveState","SubState","User","Group","WorkingDirectory","MainPID","InvocationID","ControlGroup","FragmentPath","DropInPaths","NeedDaemonReload"];
const fail=code=>{throw Error(`STAGING_RELEASE_RECOVERY_ERROR=${code}`);};

export function validateRecoveryEnvironment(env) {
  if(env.GITHUB_REF!=="refs/heads/main"||!/^[a-f0-9]{40}$/u.test(env.GITHUB_SHA??"")||
     env.FANMIND_STAGING_RELEASE_RECOVERY_CONFIRM!=="recover-live-staging-release-state"||env.BILLING_WRITE_FREEZE!=="preserve"||
     !/^[a-f0-9]{40}$/u.test(env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT??"")||
     !/^[a-z0-9]{20}$/u.test(env.FANMIND_TARGET_SUPABASE_PROJECT_REF??"")||
     !/^[a-z0-9]{20}$/u.test(env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF??"")||
     env.FANMIND_TARGET_SUPABASE_PROJECT_REF===env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF)fail("boundary");
  return {previousCommit:env.FANMIND_STAGING_RELEASE_RECOVERY_PREVIOUS_COMMIT,targetRef:env.FANMIND_TARGET_SUPABASE_PROJECT_REF,productionRef:env.FANMIND_PRODUCTION_SUPABASE_PROJECT_REF};
}

export function projectLiveReleaseState(bytes,binding) {
  const selected=new Map();
  try {
    if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>1024*1024)fail("environment");
    for(let start=0;start<bytes.length;) {
      const end=bytes.indexOf(0,start),equal=bytes.indexOf(61,start);
      if(end<0||equal<=start||equal>=end)fail("environment");
      const rawKey=bytes.subarray(start,equal);
      const known=KEYS.find(([,key])=>rawKey.equals(key));
      if(known) {
        if(selected.has(known[0]))fail("duplicate_field");
        const value=bytes.subarray(equal+1,end);
        if(value.length>256||value.some(byte=>byte<32||byte>126))fail("field_value");
        selected.set(known[0],value.toString("ascii"));
      } else if(RESERVED.some(prefix=>rawKey.subarray(0,prefix.length).equals(prefix)))fail("unknown_release_field");
      // No decoding, string creation or logging for any other environment field.
      start=end+1;
    }
    const expected={FANMIND_RELEASE_COMMIT:binding.previousCommit,FANMIND_RUNTIME_ENVIRONMENT:"staging",NODE_ENV:"production",NEXT_PUBLIC_APP_URL:APP,
      NEXT_PUBLIC_SUPABASE_URL:`https://${binding.targetRef}.supabase.co`,FANMIND_PRODUCTION_SUPABASE_PROJECT_REF:binding.productionRef,PORT:"3001"};
    if(Object.entries(expected).some(([key,value])=>selected.get(key)!==value)||!["true","false"].includes(selected.get(BASE[3])))fail("runtime_binding");
    // Recovery is narrower than generic deployment preservation: every known
    // field and the existing proof must survive, even when the live flag is true.
    if([...BASE,...CAPTURE].some(key=>!selected.has(key)))fail("capture_state");
    const candidate=[...BASE,...CAPTURE].filter(key=>selected.has(key)).map(key=>`${key}=${selected.get(key)}`).join("\n");
    let capture;
    try {capture=preserveStagingBillingCapture(candidate,{freeze:selected.get(BASE[3]),commit:binding.previousCommit});}catch{fail("capture_state");}
    return `${BASE.map(key=>`${key}=${selected.get(key)}`).join("\n")}\n${capture?`${capture}\n`:""}`;
  } finally {if(Buffer.isBuffer(bytes))bytes.fill(0);}
}

function assertMissing(directory) {
  try {lstatSync(join(directory,".release.env"));}catch(error){if(error.code==="ENOENT")return;throw error;}
  fail("state_already_exists");
}

export function publishMissingReleaseState(directory,contents) {
  assertMissing(directory);
  const directoryFd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);
  const temporary=join(directory,`.release.env.recovery-${randomBytes(12).toString("hex")}`);
  let fd;
  try {
    const parent=fstatSync(directoryFd);
    if(!parent.isDirectory()||parent.uid!==process.getuid()||(parent.mode&0o022)!==0)fail("directory");
    fd=openSync(temporary,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
    writeFileSync(fd,contents);fsyncSync(fd);closeSync(fd);fd=undefined;
    const current=lstatSync(directory);
    if(current.dev!==parent.dev||current.ino!==parent.ino)fail("directory_changed");
    // link is atomic and never replaces an existing file (including a symlink).
    linkSync(temporary,join(directory,".release.env"));unlinkSync(temporary);fsyncSync(directoryFd);
  } finally {if(fd!==undefined)closeSync(fd);try{unlinkSync(temporary);}catch(error){if(error.code!=="ENOENT")throw error;}closeSync(directoryFd);}
}

function boundedRead(path,limit) {
  const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  const bytes=Buffer.alloc(limit+1);
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.uid!==process.getuid())fail("process_file");
    let size=0,count;
    while((count=readSync(fd,bytes,size,bytes.length-size,null))>0){size+=count;if(size>limit)fail("process_file");}
    return Buffer.from(bytes.subarray(0,size));
  } finally {bytes.fill(0);closeSync(fd);}
}

export function inspectProcess(pid,{uid,directory,controlGroup}) {
  if(!/^[1-9]\d*$/u.test(pid)||Number(pid)<2)fail("pid");
  const path=`/proc/${pid}`,stat=lstatSync(path);
  if(!stat.isDirectory()||stat.uid!==uid||readlinkSync(`${path}/cwd`)!==directory)fail("process_identity");
  const status=readFileSync(`${path}/status`,"utf8");
  const uids=status.match(/^Uid:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/mu);
  if(!uids||uids.slice(1).some(value=>Number(value)!==uid))fail("process_identity");
  const groups=readFileSync(`${path}/cgroup`,"utf8").trim().split("\n");
  if(groups.length!==1||groups[0]!==`0::${controlGroup}`)fail("process_cgroup");
  const raw=readFileSync(`${path}/stat`,"utf8"),end=raw.lastIndexOf(") ");
  const startTime=raw.slice(end+2).trim().split(/\s+/u)[19];
  if(!raw.startsWith(`${pid} (`)||end<0||!/^[1-9]\d*$/u.test(startTime??""))fail("process_identity");
  return {pid,uid,startTime,controlGroup,directory};
}

function command(executable,args) {
  const result=spawnSync(executable,args,{encoding:"utf8",timeout:10000,maxBuffer:16384,env:{PATH:"/usr/bin:/bin",LANG:"C",GIT_CONFIG_NOSYSTEM:"1",GIT_CONFIG_GLOBAL:"/dev/null"}});
  if(result.error||result.status!==0)fail("host_contract");
  return result.stdout;
}
function inspectService() {
  const fd=openSync(UNIT,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
  try {
    const stat=fstatSync(fd);
    if(!stat.isFile()||stat.uid!==0||stat.nlink!==1||(stat.mode&0o777)!==0o644||stat.size>16384||
      !readFileSync(fd).equals(readFileSync(join(REPOSITORY,"ops/systemd/fanmind-staging.service"))))fail("service_unit");
  }finally{closeSync(fd);}
  const keys=SERVICE_KEYS;
  const output=command("/usr/bin/systemctl",["show",SERVICE,...keys.map(key=>`--property=${key}`)]);
  const values={};
  for(const line of output.trim().split("\n")){const index=line.indexOf("="),key=line.slice(0,index);if(index<1||!keys.includes(key)||Object.hasOwn(values,key))fail("service_properties");values[key]=line.slice(index+1);}
  return validateServiceProperties(values);
}
export function validateServiceProperties(values) {
  const expected={Id:SERVICE,LoadState:"loaded",ActiveState:"active",SubState:"running",User:"fanmind-staging",Group:"fanmind-staging",WorkingDirectory:SOURCE,ControlGroup:`/system.slice/${SERVICE}`,FragmentPath:UNIT,DropInPaths:"",NeedDaemonReload:"no"};
  if(SERVICE_KEYS.some(key=>!Object.hasOwn(values,key))||Object.keys(values).some(key=>!SERVICE_KEYS.includes(key))||Object.entries(expected).some(([key,value])=>values[key]!==value)||
    !/^[1-9]\d*$/u.test(values.MainPID)||Number(values.MainPID)<2||!/^[a-f0-9]{32}$/u.test(values.InvocationID)||/^0+$/u.test(values.InvocationID))fail("service_identity");
  return Object.fromEntries(SERVICE_KEYS.map(key=>[key,values[key]]));
}

export async function verifyRecoveryVersion(binding,fetchImpl=fetch) {
  const response=await fetchImpl(`${APP}/api/version`,{redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),headers:{"Cache-Control":"no-cache"}});
  if(response.status!==200||!response.headers.get("cache-control")?.includes("no-store")||!response.body)fail("version");
  const reader=response.body.getReader();let size=0;const chunks=[];
  try {for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>8192)fail("version");chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{fail("version");}
  if(body.application!=="fanmind"||body.runtimeEnvironment!=="staging"||body.releaseCommit!==binding.previousCommit)fail("version");
}

export async function recoverLiveReleaseState(binding,operations) {
  operations.assertMissing();operations.verifyCheckout();
  const service=operations.inspectService(),process=operations.inspectProcess(service);
  await operations.verifyVersion(binding);
  const contents=projectLiveReleaseState(operations.readEnvironment(service),binding);
  await operations.verifyVersion(binding);
  const afterService=operations.inspectService(),afterProcess=operations.inspectProcess(afterService);
  if(JSON.stringify(service)!==JSON.stringify(afterService)||JSON.stringify(process)!==JSON.stringify(afterProcess))fail("process_changed");
  operations.assertMissing();operations.publish(contents);
}

async function main() {
  if(process.argv.length!==3||process.argv[2]!=="--recover")fail("mode");
  const env=process.env,binding=validateRecoveryEnvironment(env);
  if(userInfo().username!=="fanmind-staging"||realpathSync(env.GITHUB_WORKSPACE??"")!==REPOSITORY)fail("checkout");
  await recoverLiveReleaseState(binding,{
    assertMissing:()=>assertMissing(SOURCE),
    verifyCheckout:()=>{
      if(command("/usr/bin/git",["-C",REPOSITORY,"rev-parse","HEAD"]).trim()!==env.GITHUB_SHA)fail("checkout");
      command("/usr/bin/git",["-C",REPOSITORY,"diff","--no-ext-diff","--quiet","--"]);
      command("/usr/bin/git",["-C",REPOSITORY,"diff","--cached","--no-ext-diff","--quiet","--"]);
      if(JSON.parse(readFileSync(join(REPOSITORY,"package.json"),"utf8")).scripts?.start!=="next start")fail("start_contract");
    },
    inspectService,
    inspectProcess:service=>inspectProcess(service.MainPID,{uid:process.getuid(),directory:SOURCE,controlGroup:service.ControlGroup}),
    readEnvironment:service=>boundedRead(`/proc/${service.MainPID}/environ`,1024*1024),
    verifyVersion:verifyRecoveryVersion,
    publish:contents=>publishMissingReleaseState(SOURCE,contents),
  });
  console.log("STAGING_RELEASE_STATE_RECOVERY=PASS");
  console.log("STAGING_RELEASE_RECOVERY_SECRETS_OUTPUT=0");
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(error=>{console.error(/^STAGING_RELEASE_RECOVERY_ERROR=[a-z_]+$/u.test(error?.message??"")?error.message:"STAGING_RELEASE_RECOVERY_ERROR=operation_failed");process.exitCode=1;});

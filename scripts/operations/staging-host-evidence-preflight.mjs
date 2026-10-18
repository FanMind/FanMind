// Deliberately fail-closed source scaffold; no host collector or uploader.
import { loadHostEvidencePolicy } from "./staging-host-evidence-policy.mjs";

function block(reason){
 process.stdout.write(`STAGING_HOST_EVIDENCE=BLOCKED\nSTAGING_HOST_EVIDENCE_REASON=${reason}\nSTAGING_HOST_ACCESS=not_attempted\n`);
 process.exitCode=1;
}
function bindingValid(e,p){
 return e.GITHUB_REPOSITORY===p.repository&&e.GITHUB_REPOSITORY_ID===p.repositoryId&&
 e.GITHUB_EVENT_NAME==="workflow_dispatch"&&e.GITHUB_REF==="refs/heads/main"&&
 /^[a-f0-9]{40}$/u.test(e.GITHUB_SHA??"")&&e.GITHUB_SHA===e.FANMIND_EVIDENCE_REVIEWED_COMMIT&&
 e.GITHUB_WORKFLOW_REF==="FanMind/FanMind/.github/workflows/staging-host-evidence.yml@refs/heads/main"&&
 /^[1-9][0-9]*$/u.test(e.GITHUB_RUN_ID??"")&&/^[1-9][0-9]*$/u.test(e.GITHUB_RUN_ATTEMPT??"")&&
 e.FANMIND_EVIDENCE_ENVIRONMENT===p.environment&&e.FANMIND_EVIDENCE_CONFIRMATION==="collect-staging-host-evidence-readonly"&&
 e.RUNNER_ENVIRONMENT==="self-hosted"&&e.RUNNER_NAME===p.runnerName&&e.RUNNER_OS==="Linux"&&e.RUNNER_ARCH==="X64";
}
try{
 const p=loadHostEvidencePolicy();
 if(process.argv.length!==2||!bindingValid(process.env,p))block("binding_invalid");
 else if(p.privateChannel===null)block("private_channel_unverified");
 else block("collector_not_approved");
}catch{block("policy_invalid");}

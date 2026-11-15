import {pathToFileURL} from 'node:url';
import {completeChecks,REQUIRED_MAIN_CHECKS,REQUIRED_PR_CHECKS} from './production-release-preflight.mjs';
export function consentApplySourceReady(env,branch,run,pr,checks,prChecks){return env.GITHUB_REPOSITORY==='FanMind/FanMind'&&env.GITHUB_REF==='refs/heads/main'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_ACTOR_ID==='270165082'&&/^[a-f0-9]{40}$/.test(env.REVIEWED_COMMIT??'')&&env.REVIEWED_COMMIT===env.GITHUB_SHA&&branch?.protected===true&&branch.commit?.sha===env.GITHUB_SHA&&run?.id===Number(env.GITHUB_RUN_ID)&&run.head_sha===env.GITHUB_SHA&&run.event==='workflow_dispatch'&&run.path==='.github/workflows/support-ai-consent-production.yml'&&run.repository?.full_name==='FanMind/FanMind'&&run.actor?.id===270165082&&Number.isSafeInteger(run.check_suite_id)&&pr?.merge_commit_sha===env.GITHUB_SHA&&!!pr.merged_at&&pr.base?.ref==='main'&&pr.head?.repo?.full_name==='FanMind/FanMind'&&completeChecks(checks,REQUIRED_MAIN_CHECKS,run.check_suite_id)&&completeChecks(prChecks,REQUIRED_PR_CHECKS);}
async function main(){try{
 const e=process.env,get=async path=>{const r=await fetch('https://api.github.com/repos/FanMind/FanMind/'+path,{headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${e.GITHUB_TOKEN}`,'X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('unavailable');return r.json();};
 const [branch,run,prs,checks]=await Promise.all([get('branches/main'),get(`actions/runs/${e.GITHUB_RUN_ID}`),get(`commits/${e.GITHUB_SHA}/pulls?per_page=100`),get(`commits/${e.GITHUB_SHA}/check-runs?per_page=100`)]);
 const pr=prs.find(p=>p.merge_commit_sha===e.GITHUB_SHA&&p.merged_at&&p.base?.ref==='main');if(!/^[a-f0-9]{40}$/.test(pr?.head?.sha??''))throw Error('missing');
 if(!consentApplySourceReady(e,branch,run,pr,checks,await get(`commits/${pr.head.sha}/check-runs?per_page=100`)))throw Error('blocked');
 console.log('SUPPORT_AI_CONSENT_PRODUCTION_SOURCE=PASS');
}catch{console.error('SUPPORT_AI_CONSENT_PRODUCTION_SOURCE=BLOCKED');process.exitCode=1;}}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await main();

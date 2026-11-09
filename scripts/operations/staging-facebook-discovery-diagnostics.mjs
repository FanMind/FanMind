import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
const labels = [
  'Facebook token diagnostics',
  'Facebook /me/accounts pages diagnostics',
  'Facebook /me accounts field pages diagnostics',
  'Facebook granular page targets detected',
  'Facebook direct page fetch diagnostics',
  'Facebook page discovery diagnostics',
];
const fields = ['httpStatus','pageCount','pagesMissingAccessToken','targetCount','accountsCount','accountsFieldCount','granularTargetCount','recoveredCount','unresolvedTargetCount','hasPage','hasAccessToken','isValid','errorCode'];
export function summarizeFacebookDiscoveryLogs(log) {
  const observations=[];
  for (const match of log.matchAll(/(Facebook [^\n{]+)\s*\{([^}]{0,4000})\}/gu)) {
    const label=match[1].trim();
    if (!labels.includes(label)) continue;
    const counts={};
    for (const field of fields) {
      const value=match[2].match(new RegExp(`(?:^|[\\s,])${field}: (true|false|[0-9]{1,6})(?=[\\s,]|$)`,'u'))?.[1];
      if(value!==undefined) counts[field]=value==='true'?true:value==='false'?false:Number(value);
    }
    observations.push({label,counts});
  }
  return observations.slice(-40);
}
function main(){
  if(process.env.FANMIND_RUNTIME_ENVIRONMENT!=='staging'||process.env.GITHUB_REPOSITORY!=='FanMind/FanMind'||process.env.GITHUB_REF!=='refs/heads/fix/facebook-page-discovery-staging') throw Error('diagnostic_boundary');
  const result=spawnSync('/usr/bin/journalctl',['--unit=fanmind-staging.service','--since=-2 hours','--no-pager','--output=cat','--lines=10000'],{encoding:'utf8',timeout:10000,maxBuffer:2*1024*1024,stdio:['ignore','pipe','pipe']});
  if(result.status!==0) { console.log('FACEBOOK_DISCOVERY_JOURNAL=BLOCKED');return; }
  const observations=summarizeFacebookDiscoveryLogs(result.stdout);
  console.log(JSON.stringify({facebookDiscovery:observations,observed:observations.length>0}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) main();

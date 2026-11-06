import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';

const ORIGIN = 'https://staging.fanmind.ch';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
function fact(value, code) { if (!value) throw new Error(code); }
function target(env) {
  fact(env.NEXT_PUBLIC_APP_URL === ORIGIN && env.FANMIND_RUNTIME_ENVIRONMENT === 'staging' && env.GITHUB_REF === 'refs/heads/main' && /^[0-9a-f]{40}$/u.test(env.GITHUB_SHA ?? '') && env.GITHUB_SHA === env.FANMIND_CREATOR_FOUNDATION_REVIEWED_COMMIT, 'disclosure_target');
}
async function bytes(response, limit) {
  fact(response.body, 'disclosure_body');
  const reader=response.body.getReader(); const chunks=[]; let size=0;
  try {
    for (;;) {
      const {done,value}=await reader.read(); if(done) break;
      size+=value.byteLength;fact(size<=limit,'disclosure_bound');chunks.push(value);
    }
    return Buffer.concat(chunks,size);
  } finally { await reader.cancel().catch(()=>{}); }
}
export async function verifyCreatorDisclosureRelease(env,{fetchImpl=fetch}={}) {
  target(env);
  const response=await fetchImpl(new URL('/api/version',ORIGIN),{redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  fact(response.ok,'disclosure_release');
  const version=JSON.parse((await bytes(response,8192)).toString('utf8'));
  fact(version.application==='fanmind' && version.runtimeEnvironment==='staging' && version.releaseCommit===env.GITHUB_SHA,'disclosure_release');
}

// Called only for the two already authenticated, marked fixture owners. No PDF
// or extracted text is written, logged or uploaded; only fixed PASS/FAIL codes.
export async function verifyCreatorDisclosure(env,fixture,other,{fetchImpl=fetch}={}) {
  target(env);
  fact(UUID.test(fixture.workspaceId) && UUID.test(fixture.creatorId) && UUID.test(other.workspaceId) && UUID.test(other.creatorId) && fixture.workspaceId!==other.workspaceId && fixture.creatorId!==other.creatorId,'disclosure_identity');
  fact([fixture.writingStyle,other.writingStyle].every(value=>typeof value==='string' && value.length>=5 && value.length<=200) && fixture.writingStyle!==other.writingStyle,'disclosure_identity');
  const token=fixture.actor?.token;
  fact(typeof token==='string' && /^[A-Za-z0-9_.-]{20,8192}$/u.test(token),'disclosure_session');
  await verifyCreatorDisclosureRelease(env,{fetchImpl});
  const response=await fetchImpl(new URL('/settings/profile/data-export?lang=en',ORIGIN),{
    redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000),
    headers:{Cookie:`fanmind_sb_access_token=${token}`,Accept:'application/pdf'},
  });
  fact(response.ok && response.headers.get('content-type')?.split(';')[0]==='application/pdf','disclosure_response');
  const pdf=await bytes(response,8*1024*1024);
  fact(pdf.subarray(0,5).toString('ascii')==='%PDF-','disclosure_format');
  const {extractText,initNodeDecompression_parser}=await import('pdfnative');
  await initNodeDecompression_parser();
  const text=extractText(pdf).map(page=>page.text).join('\n').replace(/\s+/gu,'');
  fact(text.includes(fixture.workspaceId) && text.includes(fixture.creatorId) && text.includes('Creatorwritingstyle'),'disclosure_own_data');
  fact(!text.includes(other.workspaceId) && !text.includes(other.creatorId),'disclosure_foreign_data');
  fact(text.includes(fixture.writingStyle.replace(/\s+/gu,'')) && !text.includes(other.writingStyle.replace(/\s+/gu,'')),'disclosure_writing_style');
  for(const value of [token,other.actor?.token,env.FANMIND_STAGING_SUPABASE_SERVICE_ROLE_KEY,env.FANMIND_STAGING_E2E_PASSWORD,env.FANMIND_STAGING_E2E_SECONDARY_PASSWORD]) {
    if(typeof value==='string' && value.length>=20)fact(!text.includes(value.replace(/\s+/gu,'')),'disclosure_secret');
  }
  for(const field of ['encrypted_token','encrypted_access_token','encrypted_refresh_token'])fact(!text.includes(field),'disclosure_secret');
  await verifyCreatorDisclosureRelease(env,{fetchImpl});
  return 'PASS';
}

if (process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv[2]!=='--verify-release'){console.error('CREATOR_DISCLOSURE_RELEASE=FAIL');process.exitCode=1;}
  else verifyCreatorDisclosureRelease(process.env).then(()=>console.log('CREATOR_DISCLOSURE_RELEASE=PASS')).catch(()=>{console.error('CREATOR_DISCLOSURE_RELEASE=FAIL');process.exitCode=1;});
}

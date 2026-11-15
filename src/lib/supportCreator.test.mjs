import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync,existsSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
function load(file,deps={}){const exports={};runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in deps)return deps[n];throw Error(`unexpected access: ${n}`);}});return exports;}
test('retired Creator endpoint refuses reads and writes before authentication, CRM, provider or database access',()=>{
 const route=load('src/app/api/support/creator-context/route.ts',{'next/server':{NextResponse:{json:(body,options)=>({body,...options})}}});
 for(const method of ['GET','POST']){const r=route[method]();assert.equal(r.status,410);assert.equal(r.body.error,'creator_support_retired');assert.equal(r.headers['Cache-Control'],'private, no-store');}
 assert.equal(existsSync('src/lib/supportCreatorServer.ts'),false);
 assert.equal(existsSync('src/lib/supportCreatorPolicy.ts'),false);
});
test('retained private Creator history is distinguishable without restoring action or signing logic',()=>{
 const p=load('src/lib/supportHistoryPolicy.ts');
 for(const prefix of ['Support-Stiländerung: ','Support-Prüfung: ','Stiländerung nachgeprüft: ','Synthetischer Stiltest: ']){
  assert.equal(p.isRetiredCreatorSupportTurn(prefix+'private data'),true);
  assert.equal(p.supportTurnQuestion(prefix+'private data'),'Historischer Creator-Staging-Test (deaktiviert)');
 }
 assert.equal(p.isRetiredCreatorSupportTurn('Wie verbinde ich Facebook?'),false);
 assert.equal(p.supportTurnQuestion('Wie verbinde ich Facebook?'),'Wie verbinde ich Facebook?');
});

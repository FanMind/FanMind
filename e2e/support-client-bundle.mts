import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import {createRequire} from "node:module";
import ts from "typescript";
const require=createRequire(path.join(process.cwd(),"package.json"));
let cached:Promise<string>|undefined;
export function supportClientBundle(){
 return cached??=(async()=>{
  const root=process.cwd(),dir=await mkdtemp(path.join(tmpdir(),"fanmind-support-browser-"));
  try{
   for(const [name,file]of [["chat","src/components/SupportConversation.tsx"],["owner","src/app/admin/support/OwnerInbox.tsx"]])await writeFile(path.join(dir,`${name}.js`),ts.transpileModule(await readFile(path.join(root,file),"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText);
   await writeFile(path.join(dir,"entry.js"),`const React=require('react');const {createRoot}=require('react-dom/client');const {SupportConversation}=require('./chat');const {OwnerInbox}=require('./owner');createRoot(document.getElementById('support-fixture')).render(React.createElement(window.supportFixture==='owner'?OwnerInbox:SupportConversation));`);
   const webpack=require("next/dist/compiled/webpack/webpack").webpack;
   await new Promise<void>((resolve,reject)=>{const compiler=webpack({mode:"development",target:"web",devtool:false,entry:path.join(dir,"entry.js"),resolve:{modules:[path.join(root,"node_modules"),"node_modules"]},output:{path:dir,filename:"bundle.js"}});compiler.run((error:Error|null,stats:{hasErrors:()=>boolean;toString:()=>string})=>compiler.close(()=>error?reject(error):stats.hasErrors()?reject(new Error(stats.toString())):resolve()));});
   return await readFile(path.join(dir,"bundle.js"),"utf8");
  }finally{await rm(dir,{recursive:true,force:true});}
 })();
}

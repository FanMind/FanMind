import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import React from "react";
import * as jsx from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import * as policy from "../src/lib/supportCentrePolicy";

const workspace = "10000000-0000-4000-8000-000000000001";
const now = Date.now();
const cases = ["pending", "failed", "succeeded"].map((status,index)=>({id:`10000000-0000-4000-8000-00000000000${index+2}`,workspace_id:workspace,connection_id:"10000000-0000-4000-8000-000000000008",platform:"facebook",problem:"sync_attention",action:"refresh_readonly_status",permission:"read_connection_status",status,created_at:new Date(now).toISOString(),expires_at:new Date(now+1800000).toISOString(),completed_at:null}));
function load(file: string, bindings: Record<string, unknown>) {
  const exports: Record<string, unknown> = {};
  runInNewContext(ts.transpileModule(readFileSync(file,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports,Date,require:(name:string)=>{if(Object.hasOwn(bindings,name))return bindings[name];throw new Error(`unmocked ${name}`);}});
  return exports;
}
async function html(owner:boolean) {
  const buttons=load("src/app/admin/support/DecisionButtons.tsx",{"react":React,"react/jsx-runtime":jsx});
  const source=load("src/app/admin/support/page.tsx",{
    "react/jsx-runtime":jsx,"next/link":{default:({children,...props}:React.ComponentProps<"a">)=>React.createElement("a",props,children),__esModule:true},
    "@/lib/admin":{requirePlatformAdmin:async()=>({id:workspace})},
    "@/lib/supportCentrePolicy":policy,
    "@/lib/supportCentreServer":{supportCentreEnabled:()=>true,supportCentreTime:async()=>now,supportCentreActor:async()=>({owner}),listSupportWorkspaces:async()=>[{id:workspace,name:"Synthetischer Workspace"}],listSupportCases:async()=>({cases,audit:[]})},
    "./DecisionButtons":buttons,"./support.module.css":{default:new Proxy({},{get:(_,name)=>name}),__esModule:true},
  });
  const Page=source.default as (props:{searchParams:Promise<{workspace:string}>})=>Promise<React.ReactElement>;
  return `<html lang="de"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync("src/app/admin/support/support.module.css","utf8")}</style>${renderToStaticMarkup(await Page({searchParams:Promise.resolve({workspace})}))}</html>`;
}
for(const owner of [true,false]) {
  test(`support centre synthetic actual component: ${owner?"Owner":"Admin"} navigation and details`,async({page})=>{
    await page.setContent(await html(owner));
    await expect(page.getByRole("heading",{name:"KI-Support-Zentrale",exact:true})).toBeVisible();
    await expect(page.getByRole("navigation",{name:"Support-Navigation"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Freigeben und einmal prüfen"})).toHaveCount(owner?1:0);
    await page.getByText("Details anzeigen",{exact:true}).first().click();
    await expect(page.getByText("read_connection_status · refresh_readonly_status").first()).toBeVisible();
    await expect(page.getByText("Kein Synchronisierungsneustart. Kundenbestätigung wird nicht ersetzt.").first()).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
    await expect(page.getByRole("complementary",{name:"Owner-Benachrichtigungen"})).toHaveCount(owner?1:0);
    if(owner) await expect(page.getByRole("complementary",{name:"Owner-Benachrichtigungen"}).getByRole("link")).toHaveCount(2);
  });
}

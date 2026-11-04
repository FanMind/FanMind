import {expect,test,type Page} from "@playwright/test";
import {supportClientBundle} from "./support-client-bundle.mts";
async function mount(page:Page,kind="chat"){
 await page.goto("/support");await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px sans-serif;margin:12px}section{max-width:620px;overflow-wrap:anywhere}textarea{display:block;max-width:100%;min-height:70px}button{min-height:44px;margin:4px}</style><div id="support-fixture"></div>');
 await page.evaluate(kind=>{(window as Window & {supportFixture?:string}).supportFixture=kind;},kind);await page.addScriptTag({content:await supportClientBundle()});
}
test("authenticated support restores persisted turns, retries the same request and clears a changed account",async({page})=>{
 let scope="scope-a",first=true;const ids:string[]=[];let turns:Array<{request_id:string;question:string;answer:string;unanswered:boolean}>=[];
 await page.route("**/api/support/conversation",async route=>{
  if(route.request().method()==="POST"){
   const body=route.request().postDataJSON();ids.push(body.requestId);
   if(first){first=false;await route.abort("failed");return;}
   turns=[{request_id:body.requestId,question:body.question,answer:"Gespeicherte Antwort",unanswered:false}];
  }
  await route.fulfill({json:{scope,turns}});
 });
 await mount(page);await expect(page.getByRole("button",{name:"Speichern und senden",exact:true})).toBeEnabled();
 await page.getByRole("textbox",{name:"Deine Frage"}).fill("Meine technische Frage");await page.getByRole("button",{name:"Speichern und senden",exact:true}).click();
 await page.getByRole("button",{name:"Mit gleicher Anfrage erneut versuchen"}).click();await expect(page.getByText("Gespeicherte Antwort",{exact:false})).toBeVisible();expect(ids[0]).toBe(ids[1]);
 await mount(page);await expect(page.getByText("Meine technische Frage",{exact:false})).toBeVisible();
 scope="scope-b";turns=[];await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.getByText("Meine technische Frage",{exact:false})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test("Owner inbox revalidates access and removes a customer transcript on authorization failure",async({page})=>{
 let authorized=true;
 await page.route("**/api/admin/support/overview**",async route=>{
  if(!authorized){await route.fulfill({status:403,json:{error:"forbidden"}});return;}
  if(route.request().url().includes("thread=")){await route.fulfill({json:{turns:[{question:"Freigegebener Kundentext",answer:"Supportantwort"}]}});return;}
  await route.fulfill({json:route.request().method()==="POST"?{repaired:0}:{items:[{id:"n1",workspace_id:"w1",reference_id:"t1",code:"handoff_required",created_at:"2026-11-04T00:00:00Z",acknowledged_at:null}]}});
 });
 await mount(page,"owner");await page.getByRole("button",{name:"Freigegebenen Verlauf anzeigen"}).click();await expect(page.getByText("Freigegebener Kundentext",{exact:true})).toBeVisible();
 authorized=false;await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.getByText("Freigegebener Kundentext",{exact:true})).toHaveCount(0);await expect(page.getByRole("alert")).toBeVisible();
});

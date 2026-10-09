import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, expect } from "@playwright/test";
import ts from "typescript";

// Execute the actual client and React DOM in Chromium. Only the external API is
// deferred; this suite proves client isolation, not Staging/provider acceptance.
const require = createRequire(import.meta.url);
const modules = {
  react: ["react", "react.production.js"],
  "react/jsx-runtime": ["react", "react-jsx-runtime.production.js"],
  "react-dom": ["react-dom", "react-dom.production.js"],
  "react-dom/client": ["react-dom", "react-dom-client.production.js"],
  scheduler: ["scheduler", "scheduler.production.js"],
};
const moduleSources = Object.entries(modules).map(([name, [pkg, file]]) =>
  `${JSON.stringify(name)}: function(module, exports, require) {\n${readFileSync(join(dirname(require.resolve(`${pkg}/package.json`)), "cjs", file), "utf8")}\n}`,
);
const client = ts.transpileModule(readFileSync("src/app/chatadmin/ChatAdminClient.tsx", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const bundle = `(() => {
  const modules = {${moduleSources.join(",")},
    "./chatadmin.module.css": function(module) { module.exports = {__esModule: true, default: new Proxy({}, {get: (_, key) => String(key)})}; },
    client: function(module, exports, require) {${client}}
  };
  const cache = {};
  function require(name) {
    if (!modules[name]) throw new Error("Unexpected client dependency: " + name);
    if (!cache[name]) { cache[name] = {exports: {}}; modules[name](cache[name], cache[name].exports, require); }
    return cache[name].exports;
  }
  window.mountCharacters = (characters) => require("react-dom/client").createRoot(document.getElementById("root")).render(require("react").createElement(require("client").ChatAdminClient, {initialCharacters: characters, structuredOffersEnabled: true}));
})();`;

const characterA = {
  id: "10000000-0000-4000-8000-000000000001", workspace_id: "20000000-0000-4000-8000-000000000001",
  display_name: "Synthetic Anna", profile_image_path: null, public_age: 24, bio: "Anna synthetic bio", location: "", languages: ["Deutsch"],
  personality: "ruhig", writing_style: "klar", emoji_style: "sparsam", sentence_style: "kurz", typical_phrases: [], forbidden_phrases: [],
  flirt_style: "respektvoll", sales_rules: "kein Druck", example_messages: [], status: "active", revision: 1, created_at: "2026-09-26T00:00:00Z", updated_at: "2026-09-26T00:00:00Z",
  sales_playbook:{positioning:"",minimumHoursBetweenOffers:48,aftercareHours:48,contentBoundaries:[],confirmationRequired:[],noGos:[],offers:[{id:"private_photo",name:"Privates Foto",category:"private_photo",description:"",currency:"EUR",minimumPriceMinor:2500,recommendedPriceMinor:2500,maximumPriceMinor:2500,maximumDiscountPercent:0,delivery:"",exclusivity:"",requiresConfirmation:false,active:true}]},
};
const characterB = { ...characterA, id: "10000000-0000-4000-8000-000000000002", display_name: "Synthetic Bea", bio: "Bea synthetic bio" };
const fanA1={id:"30000000-0000-4000-8000-000000000001",character_id:characterA.id,display_name:"Fan A1",handle:"@a1",platform:"OnlyFans",language:"Deutsch",status:"active",customer_tier:"blue",summary:"A1 mag Katzen",notes:"A1 vertraulich",revision:1};
const fanA2={...fanA1,id:"30000000-0000-4000-8000-000000000002",display_name:"Fan A2",handle:"@a2",summary:"A2 mag Hunde",notes:"A2 separat"};
const fanB1={...fanA1,id:"30000000-0000-4000-8000-000000000003",character_id:characterB.id,display_name:"Fan B1",handle:"@b1",summary:"B1 Kontext",notes:"B1 separat"};
const fansByCharacter={[characterA.id]:[fanA1,fanA2],[characterB.id]:[fanB1]};
const conversationFor={
 [fanA1.id]:{id:"40000000-0000-4000-8000-000000000001",workspace_id:characterA.workspace_id,character_id:characterA.id,fan_id:fanA1.id},
 [fanA2.id]:{id:"40000000-0000-4000-8000-000000000002",workspace_id:characterA.workspace_id,character_id:characterA.id,fan_id:fanA2.id},
 [fanB1.id]:{id:"40000000-0000-4000-8000-000000000003",workspace_id:characterA.workspace_id,character_id:characterB.id,fan_id:fanB1.id},
};
const historyFor={[fanA1.id]:[
 {id:"m-a1",direction:"confirmed_reply",content:"A1 history",created_at:"2026-09-27T00:00:00Z"},
 {id:"m-inbound",direction:"fan_inbound",content:"Latest fan message",created_at:"2026-09-27T00:01:00Z"},
 {id:"m-suggestion-1",direction:"suggested_reply",content:"Stored suggestion one",created_at:"2026-09-27T00:01:01Z"},
 {id:"m-suggestion-2",direction:"suggested_reply",content:"Stored suggestion two",created_at:"2026-09-27T00:01:02Z"},
 {id:"m-suggestion-3",direction:"suggested_reply",content:"Stored suggestion three",created_at:"2026-09-27T00:01:03Z"},
],[fanA2.id]:[],[fanB1.id]:[]};
const drafts=["Synthetic reply one","Synthetic reply two","Synthetic reply three"];
let browser;
before(async()=>{browser=await chromium.launch({headless:true,executablePath:process.env.CHATADMIN_TEST_BROWSER||undefined});});
after(async()=>{await browser?.close();});
async function mount(t){
 const context=await browser.newContext({permissions:["clipboard-read","clipboard-write"]});t.after(()=>context.close());const page=await context.newPage();
 await page.route("**/*",route=>route.fulfill({contentType:"text/html",body:'<html><body><div id="root"></div></body></html>'}));await page.goto("http://localhost/chatadmin-client-test");
 await page.evaluate(({fansByCharacter,conversationFor,historyFor})=>{
  window.testRequests=[];window.fixture={fansByCharacter,conversationFor,historyFor};
  window.fetch=(raw,options={})=>{const url=String(raw);const method=options.method||"GET";const parsed=new URL(url,"http://localhost");
   if(method==="GET"&&parsed.pathname==="/api/chatadmin/fans"){const fans=window.fixture.fansByCharacter[parsed.searchParams.get("character_id")]||[];return Promise.resolve(Response.json({fans}));}
   if(method==="GET"&&parsed.pathname==="/api/chatadmin/conversations"){const fanId=parsed.searchParams.get("fan_id"),fan=Object.values(window.fixture.fansByCharacter).flat().find(v=>v.id===fanId);return Promise.resolve(Response.json({fan,conversation:window.fixture.conversationFor[fanId],messages:window.fixture.historyFor[fanId]||[]}));}
   return new Promise((resolve,reject)=>window.testRequests.push({url,method,body:options.body?JSON.parse(options.body):null,resolve,reject}));
  };
 },{fansByCharacter,conversationFor,historyFor});
 await page.addScriptTag({content:bundle});await page.evaluate(characters=>window.mountCharacters(characters),[characterA,characterB]);await expect(page.getByRole("button",{name:"Fan A1 öffnen",exact:true})).toBeVisible();return page;
}
const card=(page,name)=>page.getByRole("article").filter({has:page.getByRole("heading",{name,exact:true})});
const copies=page=>page.getByRole("button",{name:"Kopieren und verwenden",exact:true});
async function openFan(page,name){await page.getByRole("button",{name:`${name} öffnen`,exact:true}).click();await expect(page.getByRole("region",{name:`Gespräch mit ${name}`,exact:true})).toBeVisible();}
async function selectCharacter(page,name){await card(page,name).getByRole("button").first().click();}
async function manageCharacter(page,name){const menu=card(page,name).locator("details");if(!await menu.evaluate(node=>node.open))await menu.locator("summary").click();}
async function generate(page,message="Synthetic fan message"){await page.getByLabel("Neue eingehende Fan-Nachricht").fill(message);await page.getByRole("button",{name:"3 KI-Antworten erzeugen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBeGreaterThan(0);}
async function complete(page,index=0,overrides={},status=200){const request=await page.evaluate(index=>window.testRequests[index],index);const base={replies:drafts,character_id:request.body.character_id,character_revision:request.body.character_revision,fan_id:request.body.fan_id,conversation_id:request.body.conversation_id,safety_note:"Manuell prüfen."};await page.evaluate(async({index,body,status})=>{window.testRequests[index].resolve(new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{index,body:{...base,...overrides},status});}

test("CRM workspace prioritizes Character, Fan list and selected conversation",async t=>{const page=await mount(t);await expect(page.getByRole("navigation",{name:"Charaktere"})).toBeVisible();await expect(page.getByRole("region",{name:"Fans von Synthetic Anna"})).toBeVisible();await expect(page.getByText("Revision 1",{exact:false})).toHaveCount(0);await openFan(page,"Fan A1");await expect(page.getByRole("region",{name:"Gespräch mit Fan A1"})).toBeVisible();});

test("structured Character prices save and reload through the Character API",async t=>{const page=await mount(t);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();const privatePhoto=page.getByRole("heading",{name:"Privates Foto",exact:true}).locator("..");await privatePhoto.getByLabel("Empfohlener Preis").fill("27.50");await privatePhoto.getByLabel("Mindestpreis").fill("25.00");await privatePhoto.getByLabel("Höchstpreis").fill("35.00");await page.getByRole("button",{name:"Speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);const request=await page.evaluate(()=>window.testRequests[0]);const offer=request.body.sales_playbook.offers.find(item=>item.category==="private_photo");assert.deepEqual({currency:offer.currency,minimum:offer.minimumPriceMinor,recommended:offer.recommendedPriceMinor,maximum:offer.maximumPriceMinor},{currency:"EUR",minimum:2500,recommended:2750,maximum:3500});const saved={...characterA,...request.body,revision:2};await page.evaluate(async saved=>{window.testRequests[0].resolve(Response.json({character:saved}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},saved);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();await expect(page.getByRole("heading",{name:"Privates Foto",exact:true}).locator("..").getByLabel("Empfohlener Preis")).toHaveValue("27.50");});

test("Fan actions live in the Fan-row menu while the conversation header and memory cards stay hidden",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await expect(page.getByRole("button",{name:"Fan bearbeiten"})).toHaveCount(0);await expect(page.getByText("Wichtige Fakten",{exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Fan A1 verwalten",exact:true}).click();for(const action of ["Bearbeiten","Notizen und Fakten","Deaktivieren","Löschen"])await expect(page.getByRole("button",{name:action,exact:true})).toBeVisible();});

test("Fan-row menu deactivates the selected Fan and offers reactivation",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await page.getByRole("button",{name:"Fan A1 verwalten",exact:true}).click();await page.getByRole("button",{name:"Deaktivieren",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);const request=await page.evaluate(()=>window.testRequests[0]);assert.equal(request.method,"PATCH");assert.equal(request.body.status,"inactive");await page.evaluate(fan=>{Object.assign(window.fixture.fansByCharacter[fan.character_id].find(item=>item.id===fan.id),fan);window.testRequests[0].resolve(Response.json({fan}));},{...fanA1,status:"inactive",revision:2});await expect(page.getByRole("status")).toContainText("Fan deaktiviert.");await expect(page.getByRole("button",{name:"Aktivieren",exact:true})).toBeVisible();});

test("Fan-row menu deletes the Fan only after confirmation",async t=>{const page=await mount(t);page.on("dialog",dialog=>dialog.accept());await openFan(page,"Fan A1");await page.getByRole("button",{name:"Fan A1 verwalten",exact:true}).click();await page.getByRole("button",{name:"Löschen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);const request=await page.evaluate(()=>window.testRequests[0]);assert.equal(request.method,"DELETE");assert.deepEqual(request.body,{character_id:characterA.id,id:fanA1.id,revision:1});await page.evaluate(async()=>{window.testRequests[0].resolve(new Response(null,{status:204}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});await expect(page.getByRole("button",{name:"Fan A1 öffnen",exact:true})).toHaveCount(0);});

test("stored AI suggestions stay collapsed behind the latest inbound fan message",async t=>{const page=await mount(t);await openFan(page,"Fan A1");const toggle=page.getByRole("button",{name:"3 KI-Vorschläge anzeigen",exact:true});await expect(toggle).toBeVisible();await expect(page.getByText("Latest fan message",{exact:true})).toBeVisible();await expect(page.getByText("Stored suggestion one",{exact:true})).toHaveCount(0);await toggle.click();await expect(page.getByText("Stored suggestion one",{exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"3 KI-Vorschläge einklappen",exact:true})).toBeVisible();});

test("Character A -> Fan A1 -> Conversation -> exactly three replies",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await expect(page.getByText("A1 history",{exact:true})).toBeVisible();await generate(page);const request=await page.evaluate(()=>window.testRequests[0].body);assert.match(request.generation_id,/^[0-9a-f-]{36}$/u);delete request.generation_id;assert.deepEqual(request,{character_id:characterA.id,character_revision:1,fan_id:fanA1.id,fan_revision:1,conversation_id:conversationFor[fanA1.id].id,incoming_message:"Synthetic fan message"});await complete(page);await expect(copies(page)).toHaveCount(3);});
test("Fan A1 -> A2 clears drafts and history",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await complete(page);await openFan(page,"Fan A2");await expect(copies(page)).toHaveCount(0);await expect(page.getByText("A1 history",{exact:true})).toHaveCount(0);});
test("Character A -> B replaces the complete fan context",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await selectCharacter(page,"Synthetic Bea");await expect(page.getByRole("button",{name:"Fan B1 öffnen",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Fan A1 öffnen",exact:true})).toHaveCount(0);await expect(page.getByText("A1 mag Katzen",{exact:true})).toHaveCount(0);});
test("delayed generation is discarded after Character switch",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await selectCharacter(page,"Synthetic Bea");await complete(page);await expect(copies(page)).toHaveCount(0);});
test("delayed generation is discarded after Fan switch",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await openFan(page,"Fan A2");await complete(page);await expect(copies(page)).toHaveCount(0);});
test("editing a Character invalidates delayed generation",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();await complete(page);await expect(copies(page)).toHaveCount(0);});
for(const action of ["Deaktivieren","Löschen"])test(`${action} invalidates delayed generation`,async t=>{const page=await mount(t);page.on("dialog",d=>d.accept());await openFan(page,"Fan A1");await generate(page);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:action}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);await complete(page);await expect(copies(page)).toHaveCount(0);const response=action==="Löschen"?{}:{character:{...characterA,status:"inactive",revision:2}};await page.evaluate(async({response,action})=>{window.testRequests[1].resolve(new Response(action==="Löschen"?null:JSON.stringify(response),{status:action==="Löschen"?204:200,headers:{"Content-Type":"application/json"}}));},{response,action});});
for(const [label,wrong] of [["character_id",{character_id:characterB.id}],["character_revision",{character_revision:2}],["fan_id",{fan_id:fanA2.id}],["conversation_id",{conversation_id:conversationFor[fanA2.id].id}]])test(`wrong ${label} response is rejected`,async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await complete(page,0,wrong);await expect(copies(page)).toHaveCount(0);});
test("changing inbound text invalidates old drafts and permits a fresh generation",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await page.getByLabel("Neue eingehende Fan-Nachricht").fill("Changed");await complete(page);await expect(copies(page)).toHaveCount(0);await generate(page,"Changed");await complete(page,1,{replies:["Fresh 1","Fresh 2","Fresh 3"]});await expect(page.getByText("Fresh 1",{exact:true})).toBeVisible();});
test("network failure is visible and retry reuses its idempotency key without stale drafts",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await page.evaluate(()=>window.testRequests[0].reject(new Error("network")));await expect(page.getByRole("status")).toContainText("fehlgeschlagen");await expect(copies(page)).toHaveCount(0);await page.getByRole("button",{name:"3 KI-Antworten erzeugen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);const ids=await page.evaluate(()=>window.testRequests.map(request=>request.body.generation_id));assert.equal(ids[0],ids[1]);await complete(page,1);await expect(copies(page)).toHaveCount(3);});
test("Fan creation uses the selected Character and opens its persisted Conversation",async t=>{const page=await mount(t);await page.getByRole("button",{name:"Fan hinzufügen"}).click();await page.getByLabel("Name",{exact:true}).fill("Fan Neu");await page.getByRole("button",{name:"Speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);const body=await page.evaluate(()=>window.testRequests[0].body);assert.equal(body.character_id,characterA.id);assert.match(body.creation_id,/^[0-9a-f-]{36}$/u);const created={...fanA1,id:"30000000-0000-4000-8000-000000000009",workspace_id:characterA.workspace_id,display_name:"Fan Neu"};await page.evaluate(async created=>{window.fixture.fansByCharacter[created.character_id].push(created);window.fixture.conversationFor[created.id]={id:"40000000-0000-4000-8000-000000000009",workspace_id:created.workspace_id,character_id:created.character_id,fan_id:created.id};window.fixture.historyFor[created.id]=[];window.testRequests[0].resolve(Response.json({fan:created},{status:201}));},created);await expect(page.getByRole("region",{name:"Gespräch mit Fan Neu",exact:true})).toBeVisible();});
test("switching from edit to add resets uncontrolled Fan fields",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await page.getByRole("button",{name:"Fan A1 verwalten",exact:true}).click();await page.getByRole("button",{name:"Bearbeiten",exact:true}).click();await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Fan A1");await page.getByRole("button",{name:"Fan hinzufügen"}).click();await expect(page.getByLabel("Name",{exact:true})).toHaveValue("");await expect(page.getByLabel("Plattform / Quelle")).toHaveValue("OnlyFans");});
test("copy-and-use confirmation is serialized against double clicks",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await complete(page);await page.evaluate(()=>{const buttons=[...document.querySelectorAll("button")].filter(button=>button.textContent==="Kopieren und verwenden");buttons[0].click();buttons[1].click();});await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);assert.equal(await page.evaluate(()=>window.testRequests.filter(r=>r.url==="/api/chatadmin/conversations").length),1);const confirmation=await page.evaluate(()=>window.testRequests.find(r=>r.url==="/api/chatadmin/conversations").body);assert.match(confirmation.confirmation_id,/^[0-9a-f-]{36}$/u);});

test("delayed copy-and-use confirmation cannot reopen a previously selected Fan",async t=>{const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await complete(page);await page.getByRole("button",{name:"Kopieren und verwenden"}).first().click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);await openFan(page,"Fan A2");await page.evaluate(binding=>window.testRequests[1].resolve(Response.json({message:{id:"confirmed-a1",fan_id:binding.fanId,conversation_id:binding.conversationId}})),{fanId:fanA1.id,conversationId:conversationFor[fanA1.id].id});await expect(page.getByRole("region",{name:"Gespräch mit Fan A2",exact:true})).toBeVisible();await expect(page.getByText("A1 mag Katzen",{exact:true})).toHaveCount(0);});


test("Fan customer classification is editable and remains independent from technical active status",async t=>{
 const page=await mount(t);
 await openFan(page,"Fan A1");
 await page.getByRole("button",{name:"Fan A1 verwalten",exact:true}).click();
 await page.getByRole("button",{name:"Bearbeiten",exact:true}).click();
 await expect(page.locator('select[name="customer_tier"]')).toHaveValue("blue");
 await page.locator('select[name="customer_tier"]').selectOption("green");
 await page.getByRole("button",{name:"Speichern",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 const request=await page.evaluate(()=>window.testRequests[0]);
 assert.equal(request.method,"PATCH");
 assert.equal(request.body.customer_tier,"green");
 assert.equal(request.body.status,"active");
 await page.evaluate(async fan=>{
   Object.assign(window.fixture.fansByCharacter[fan.character_id].find(item=>item.id===fan.id),fan);
   window.testRequests[0].resolve(Response.json({fan}));
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
 },{...fanA1,customer_tier:"green",revision:2});
 await expect(page.getByTitle("Kundenstatus: green")).toHaveCount(1);
});

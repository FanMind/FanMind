import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { after, before, test } from "node:test";
import { chromium, expect } from "@playwright/test";
import ts from "typescript";
import { ensureOfferEditor } from "../e2e-chatadmin-staging/offer-evidence.mjs";

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
const knowledgeClient = ts.transpileModule(readFileSync("src/lib/chatAdminKnowledge.mjs", "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
const creatorPolicyClient = ts.transpileModule(readFileSync("src/lib/creatorIntelligencePolicy.mjs", "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
const replyPricePolicyClient = ts.transpileModule(readFileSync("src/lib/replyPricePolicy.mjs", "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
const mediaClient = ts.transpileModule(readFileSync("src/app/chatadmin/CharacterMediaLibrary.tsx", "utf8"), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const controlsClient=ts.transpileModule(readFileSync("src/app/chatadmin/CharacterMediaCatalogueControls.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
const mediaPolicyClient=ts.transpileModule(readFileSync("src/lib/chatAdminMediaPolicy.mjs","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
const catalogueClient=ts.transpileModule(readFileSync("src/lib/chatAdminMediaCatalogue.mjs","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
const salesClient=ts.transpileModule(readFileSync("src/lib/chatAdminSalesPlaybook.mjs","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,allowJs:true}}).outputText;
const bundle = `(() => {
  const modules = {${moduleSources.join(",")},
    "./chatadmin.module.css": function(module) { module.exports = {__esModule: true, default: new Proxy({}, {get: (_, key) => String(key)})}; },
    "@/lib/chatAdminKnowledge.mjs": function(module,exports,require) {${knowledgeClient}},
    "./creatorIntelligencePolicy.mjs": function(module,exports,require) {${creatorPolicyClient}},
    "./replyPricePolicy.mjs": function(module,exports,require) {${replyPricePolicyClient}},
    "./CharacterMediaLibrary": function(module,exports,require) {${mediaClient}},
    "./CharacterMediaCatalogueControls": function(module,exports,require) {${controlsClient}},
    "@/lib/chatAdminMediaCatalogue.mjs": function(module,exports,require) {${catalogueClient}},
    "./chatAdminMediaPolicy.mjs": function(module,exports,require) {${mediaPolicyClient}},
    "./chatAdminKnowledge.mjs": function(module,exports,require) {${knowledgeClient}},
    "./chatAdminSalesPlaybook.mjs": function(module,exports,require) {${salesClient}},
    client: function(module, exports, require) {${client}}
  };
  const cache = {};
  function require(name) {
    if (!modules[name]) throw new Error("Unexpected client dependency: " + name);
    if (!cache[name]) { cache[name] = {exports: {}}; modules[name](cache[name], cache[name].exports, require); }
    return cache[name].exports;
  }
  window.mountCharacters = (characters, structuredOffersEnabled=true,mediaLibraryEnabled=false,fanRuntimeEnabled=true) => require("react-dom/client").createRoot(document.getElementById("root")).render(require("react").createElement(require("client").ChatAdminClient, {initialCharacters: characters, structuredOffersEnabled,mediaLibraryEnabled,fanRuntimeEnabled}));
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
async function mount(t,structuredOffersEnabled=true,mediaLibraryEnabled=false,fanRuntimeEnabled=true,expandModels=true){
 const context=await browser.newContext({permissions:["clipboard-read","clipboard-write"]});t.after(()=>context.close());const page=await context.newPage();
 await page.route("**/*",route=>route.fulfill({contentType:"text/html",body:'<html><body><div id="root"></div></body></html>'}));await page.goto("http://localhost/chatadmin-client-test");
 await page.evaluate(({fansByCharacter,conversationFor,historyFor})=>{
  window.testRequests=[];window.fixture={fansByCharacter,conversationFor,historyFor,media:{}};
  window.fetch=(raw,options={})=>{const url=String(raw);const method=options.method||"GET";const parsed=new URL(url,"http://localhost");
   if(method==="GET"&&parsed.pathname==="/api/chatadmin/media")return Promise.resolve(Response.json(window.fixture.media[parsed.searchParams.get("character_id")]));
   if(method==="GET"&&parsed.pathname==="/api/chatadmin/fans"){const fans=window.fixture.fansByCharacter[parsed.searchParams.get("character_id")]||[];return Promise.resolve(Response.json({fans}));}
   if(method==="GET"&&parsed.pathname==="/api/chatadmin/conversations"){const fanId=parsed.searchParams.get("fan_id"),fan=Object.values(window.fixture.fansByCharacter).flat().find(v=>v.id===fanId);return Promise.resolve(Response.json({fan,conversation:window.fixture.conversationFor[fanId],messages:window.fixture.historyFor[fanId]||[]}));}
   return new Promise((resolve,reject)=>window.testRequests.push({url,method,body:options.body?JSON.parse(options.body):null,resolve,reject}));
  };
 },{fansByCharacter,conversationFor,historyFor});
 await page.addScriptTag({content:bundle});await page.evaluate(({characters,enabled,mediaEnabled,fanEnabled})=>window.mountCharacters(characters,enabled,mediaEnabled,fanEnabled),{characters:[characterA,characterB],enabled:structuredOffersEnabled,mediaEnabled:mediaLibraryEnabled,fanEnabled:fanRuntimeEnabled});if(fanRuntimeEnabled)await expect(page.getByRole("button",{name:"Fan A1 öffnen",exact:true})).toBeVisible();else await expect(page.getByRole("heading",{name:"Nachricht manuell einfügen",exact:true})).toBeVisible();if(expandModels)await page.getByRole("button",{name:"Model-Leiste ausklappen",exact:true}).click();return page;
}
const card=(page,name)=>page.getByRole("article").filter({has:page.getByRole("heading",{name,exact:true})});
const copies=page=>page.getByRole("button",{name:"Kopieren und verwenden",exact:true});
async function openFan(page,name){await page.getByRole("button",{name:`${name} öffnen`,exact:true}).click();await expect(page.getByRole("region",{name:`Gespräch mit ${name}`,exact:true})).toBeVisible();}
async function selectCharacter(page,name){await card(page,name).getByRole("button").first().click();}
async function openMediaSettings(page,name="Synthetic Anna"){await page.getByRole("button",{name:`${name} Einstellungen`,exact:true}).click();await page.getByRole("button",{name:"Medien & Preise",exact:true}).click();}
async function manageCharacter(page,name){const menu=card(page,name).locator("details");if(!await menu.evaluate(node=>node.open))await menu.locator("summary").click();}
async function generate(page,message="Synthetic fan message"){await page.getByLabel("Neue eingehende Fan-Nachricht").fill(message);await page.getByRole("button",{name:"3 KI-Antworten erzeugen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBeGreaterThan(0);}
async function complete(page,index=0,overrides={},status=200){const request=await page.evaluate(index=>window.testRequests[index],index);const base={replies:drafts,character_id:request.body.character_id,character_revision:request.body.character_revision,fan_id:request.body.fan_id,conversation_id:request.body.conversation_id,safety_note:"Manuell prüfen."};await page.evaluate(async({index,body,status})=>{window.testRequests[index].resolve(new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json"}}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{index,body:{...base,...overrides},status});}

test("CRM workspace prioritizes Character, Fan list and selected conversation",async t=>{const page=await mount(t);await expect(page.getByRole("navigation",{name:"Models"})).toBeVisible();await expect(page.getByRole("region",{name:"Fans von Synthetic Anna"})).toBeVisible();await expect(page.getByText("Revision 1",{exact:false})).toHaveCount(0);await openFan(page,"Fan A1");await expect(page.getByRole("region",{name:"Gespräch mit Fan A1"})).toBeVisible();});

for(const mode of ["create","profile","knowledge"])test(`Fan ${mode} form scrolls independently and keeps its save action reachable`,async t=>{
 const page=await mount(t);await page.setViewportSize({width:1280,height:mode==="profile"?380:520});
 await page.evaluate(()=>{document.getElementById("root").className="page";});
 await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0}'+readFileSync("src/app/chatadmin/chatadmin.module.css","utf8")});
 if(mode==="create")await page.getByRole("button",{name:"Fan hinzufügen",exact:true}).click();
 else{await openFan(page,"Fan A1");await page.getByRole("button",{name:"Fan A1 verwalten",exact:true}).click();await page.getByRole("button",{name:mode==="profile"?"Bearbeiten":"Notizen und Fakten",exact:true}).click();}
 const form=page.locator("form");const sidebar=page.getByRole("region",{name:"Fans von Synthetic Anna",exact:true});const sidebarBefore=await sidebar.boundingBox();
 if(mode==="create")await form.getByLabel("Name",{exact:true}).fill("Synthetic new fan");
 const dimensions=await form.evaluate(node=>({height:node.clientHeight,content:node.scrollHeight}));assert.ok(dimensions.content>dimensions.height,"fixture must overflow at this viewport");
 const box=await form.boundingBox();await page.mouse.move(box.x+box.width-12,box.y+40);await page.mouse.wheel(0,2000);
 await expect.poll(()=>form.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);
 const save=form.getByRole("button",{name:"Speichern",exact:true});await expect(save).toBeInViewport();
 assert.equal(await page.evaluate(()=>window.scrollY),0,"desktop page stays fixed");assert.deepEqual(await sidebar.boundingBox(),sidebarBefore,"Fan sidebar stays fixed");
 await save.click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 const request=await page.evaluate(()=>({method:window.testRequests[0].method,body:window.testRequests[0].body}));
 assert.equal(request.method,mode==="create"?"POST":"PATCH");
 if(mode==="create")assert.equal(request.body.display_name,"Synthetic new fan");
 else assert.equal(request.body.id,fanA1.id);
});

test("Fan creation stays reachable by keyboard on a narrow viewport",async t=>{
 const page=await mount(t);await page.setViewportSize({width:390,height:740});
 await page.evaluate(()=>{document.getElementById("root").className="page";});
 await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0}'+readFileSync("src/app/chatadmin/chatadmin.module.css","utf8")});
 await page.getByRole("button",{name:"Fan hinzufügen",exact:true}).click();
 await page.getByLabel("Name",{exact:true}).fill("Synthetic mobile fan");
 await page.getByLabel("Name",{exact:true}).focus();
 for(let index=0;index<50;index++){
  await page.keyboard.press("Tab");
  if(await page.getByRole("button",{name:"Speichern",exact:true}).evaluate(node=>node===document.activeElement))break;
 }
 const save=page.getByRole("button",{name:"Speichern",exact:true});await expect(save).toBeFocused();await expect(save).toBeInViewport();
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),"no horizontal page overflow");
 await page.keyboard.press("Enter");await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 assert.equal(await page.evaluate(()=>window.testRequests[0].body.display_name),"Synthetic mobile fan");
});

test("conversation status is inline and dismissible without covering the composer",async t=>{
 const page=await mount(t);await page.setViewportSize({width:1280,height:720});
 await page.evaluate(()=>{document.getElementById("root").className="page";});
 await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0}'+readFileSync("src/app/chatadmin/chatadmin.module.css","utf8")});
 await openFan(page,"Fan A1");const composer=page.locator(".messageComposer"),history=page.locator(".conversationScroll");
 const composerBefore=await composer.boundingBox(),historyBefore=await history.boundingBox();
 await generate(page);await page.evaluate(()=>window.testRequests[0].reject(new Error("network")));
 await expect(page.getByRole("status")).toContainText("fehlgeschlagen");
 const status=await page.getByRole("status").boundingBox(),composerAfter=await composer.boundingBox();assert.ok(composerAfter.y+composerAfter.height<=status.y+1,"status must not overlay composer");assert.equal(composerAfter.width,composerBefore.width);assert.ok((await history.boundingBox()).height<=historyBefore.height);
 await page.getByRole("button",{name:"Meldung schließen",exact:true}).click();await expect(page.getByRole("status")).toHaveCount(0);
});

test("structured Character prices save and reload through the Character API",async t=>{const page=await mount(t);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();const privatePhoto=page.getByRole("heading",{name:"Privates Foto",exact:true}).locator("..");await privatePhoto.getByLabel("Empfohlener Preis").fill("27.50");await privatePhoto.getByLabel("Mindestpreis").fill("25.00");await privatePhoto.getByLabel("Höchstpreis").fill("35.00");await page.getByRole("button",{name:"Speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);const request=await page.evaluate(()=>window.testRequests[0]);const offer=request.body.sales_playbook.offers.find(item=>item.category==="private_photo");assert.deepEqual({currency:offer.currency,minimum:offer.minimumPriceMinor,recommended:offer.recommendedPriceMinor,maximum:offer.maximumPriceMinor},{currency:"EUR",minimum:2500,recommended:2750,maximum:3500});const saved={...characterA,...request.body,revision:2};await page.evaluate(async saved=>{window.testRequests[0].resolve(Response.json({character:saved}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},saved);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();await expect(page.getByRole("heading",{name:"Privates Foto",exact:true}).locator("..").getByLabel("Empfohlener Preis")).toHaveValue("27.50");});

test("Staging offer setup creates four named offers from an empty Character without duplicates",async t=>{
 const page=await mount(t);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 await page.getByRole("button",{name:"Angebot entfernen",exact:true}).click();
 await expect(page.getByText("Noch keine Angebote angelegt.",{exact:true})).toBeVisible();
 const names=["Foto","Video","Privates Foto","Privates Video"],prices=["10.00","20.00","25.00","40.00"];
 for(const [index,name] of names.entries()){
  const editor=await ensureOfferEditor(page,name);
  await editor.getByLabel("Empfohlener Preis",{exact:true}).fill(prices[index]);
  if(name==="Privates Foto")await editor.getByLabel("Angebot aktiv",{exact:true}).uncheck();
 }
 for(const name of names)await ensureOfferEditor(page,name);
 await expect(page.getByLabel("Angebotsname",{exact:true})).toHaveCount(4);
 await page.getByRole("button",{name:"Speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 const request=await page.evaluate(()=>window.testRequests[0]),offers=request.body.sales_playbook.offers;
 assert.deepEqual(offers.map(offer=>({name:offer.name,price:offer.recommendedPriceMinor,active:offer.active})),names.map((name,index)=>({name,price:Math.round(Number(prices[index])*100),active:name!=="Privates Foto"})));
 assert.ok(offers.every(offer=>offer.category==="custom"));assert.equal(new Set(offers.map(offer=>offer.id)).size,4);
 await page.evaluate(async saved=>{window.testRequests[0].resolve(Response.json({character:saved}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{...characterA,...request.body,revision:2});
 await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 for(const [index,name] of names.entries()){
  const editor=await ensureOfferEditor(page,name);
  await expect(editor.getByLabel("Empfohlener Preis",{exact:true})).toHaveValue(prices[index]);
  await expect(editor.getByLabel("Angebot aktiv",{exact:true})).toBeChecked({checked:name!=="Privates Foto"});
 }
 await expect(page.getByLabel("Angebotsname",{exact:true})).toHaveCount(4);
});

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

test("fresh persisted suggestions appear once under their incoming message",async t=>{
 const page=await mount(t);await openFan(page,"Fan A1");await generate(page);
 await page.evaluate(({fanId,drafts})=>{
  window.fixture.historyFor[fanId].push(
   {id:"fresh-inbound",direction:"fan_inbound",content:"Synthetic fan message",created_at:"2026-11-13T00:00:00Z"},
   ...drafts.map((content,i)=>({id:`fresh-suggestion-${i}`,direction:"suggested_reply",content,created_at:`2026-11-13T00:00:0${i+1}Z`}))
  );
 },{fanId:fanA1.id,drafts});
 await complete(page);
 for(const reply of drafts)await expect(page.getByText(reply,{exact:true})).toHaveCount(1);
 const group=page.locator(".suggestionGroup").filter({hasText:"Synthetic fan message"});
 await expect(copies(group)).toHaveCount(3);
 await group.getByRole("button",{name:"3 KI-Vorschläge einklappen",exact:true}).click();
 for(const reply of drafts)await expect(page.getByText(reply,{exact:true})).toHaveCount(0);
 await group.getByRole("button",{name:"3 KI-Vorschläge anzeigen",exact:true}).click();
 for(const reply of drafts)await expect(page.getByText(reply,{exact:true})).toHaveCount(1);
});

test("editing a generated suggestion copies and persists only the user's final wording",async t=>{
 const page=await mount(t);await openFan(page,"Fan A1");await generate(page);await complete(page);
 await page.getByRole("button",{name:"Vorschlag 2 bearbeiten",exact:true}).click();
 const editor=page.getByLabel("Deine Antwort",{exact:true});await expect(editor).toHaveValue(drafts[1]);
 const edited="Danke dir! Was hat dich auf mein Profil neugierig gemacht?";await editor.fill(edited);
 await expect(page.getByText(drafts[1],{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Bearbeitete Antwort kopieren und verwenden",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);
 const saved=await page.evaluate(()=>window.testRequests[1].body);
 assert.equal(saved.content,edited);assert.equal(saved.fan_id,fanA1.id);assert.equal(saved.conversation_id,conversationFor[fanA1.id].id);
 assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),edited);
 await page.evaluate(({fanId,conversationId,content})=>{
  const message={id:"edited-confirmation",fan_id:fanId,conversation_id:conversationId,direction:"confirmed_reply",content,created_at:"2026-11-05T00:00:00Z"};
  window.fixture.historyFor[fanId].push(message);window.testRequests[1].resolve(Response.json({message}));
 },{fanId:fanA1.id,conversationId:conversationFor[fanA1.id].id,content:edited});
 await expect(editor).toHaveCount(0);await expect(page.locator('article[data-direction="confirmed_reply"]').filter({hasText:edited})).toHaveCount(1);
});

test("stored suggestions can be rewritten; failed confirmation retains the edit and retry identity",async t=>{
 const page=await mount(t);await openFan(page,"Fan A1");await page.getByRole("button",{name:"3 KI-Vorschläge anzeigen",exact:true}).click();
 await page.getByRole("button",{name:"KI-Vorschlag bearbeiten",exact:true}).first().click();
 const editor=page.getByLabel("Deine Antwort",{exact:true});await expect(editor).toHaveValue("Stored suggestion one");await editor.fill("Meine eigene Antwort.");
 const use=page.getByRole("button",{name:"Bearbeitete Antwort kopieren und verwenden",exact:true});await use.click();
 await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 await page.evaluate(()=>window.testRequests[0].resolve(Response.json({error:"temporary_unavailable"},{status:503})));
 await expect(page.getByRole("status")).toContainText("Bestätigung wurde abgewiesen");await expect(editor).toHaveValue("Meine eigene Antwort.");
 await use.click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);
 const attempts=await page.evaluate(()=>window.testRequests.map(r=>r.body));assert.equal(attempts[0].confirmation_id,attempts[1].confirmation_id);assert.equal(attempts[1].content,"Meine eigene Antwort.");
});

test("discarding an edit or switching Fans never persists or transfers an unconfirmed draft",async t=>{
 const page=await mount(t);await openFan(page,"Fan A1");await page.getByRole("button",{name:"3 KI-Vorschläge anzeigen",exact:true}).click();
 await page.getByRole("button",{name:"KI-Vorschlag bearbeiten",exact:true}).first().click();await page.getByLabel("Deine Antwort",{exact:true}).fill("Nicht verwenden.");
 await page.getByRole("button",{name:"Bearbeitung verwerfen",exact:true}).click();await expect(page.getByLabel("Deine Antwort",{exact:true})).toHaveCount(0);
 await expect(page.getByText("Stored suggestion one",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"KI-Vorschlag bearbeiten",exact:true}).first().click();await page.getByLabel("Deine Antwort",{exact:true}).fill("Nur für Fan A1.");
 await openFan(page,"Fan A2");await expect(page.getByLabel("Deine Antwort",{exact:true})).toHaveCount(0);assert.equal(await page.evaluate(()=>window.testRequests.length),0);
});

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

test("unavailable price storage stays visible and disabled without deleting existing offers",async t=>{
 const page=await mount(t,false);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 await expect(page.getByRole("alert")).toContainText("Preise können noch nicht gespeichert werden");
 const price=page.getByRole("heading",{name:"Privates Foto",exact:true}).locator("..").getByLabel("Empfohlener Preis");
 await expect(price).toBeVisible();await expect(price).toBeDisabled();await expect(price).toHaveValue("25.00");
 await page.getByRole("button",{name:"Speichern",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 const request=await page.evaluate(()=>window.testRequests[0]);
 assert.deepEqual(request.body.sales_playbook,characterA.sales_playbook);
});


test("own offers add, rename, reload and remove without resurrecting fixed categories",async t=>{
 const page=await mount(t);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 const original=page.getByRole("heading",{name:"Privates Foto",exact:true}).locator("..");
 await original.getByLabel("Angebotsname",{exact:true}).fill("Lieblingsfoto");
 await page.getByRole("button",{name:"+ Angebot",exact:true}).click();
 const added=page.getByRole("heading",{name:"Neues Angebot",exact:true}).locator("..");
 await added.getByLabel("Angebotsname",{exact:true}).fill("Sommerpaket (VIP+)");
 const customRow=page.getByRole("heading",{name:"Sommerpaket (VIP+)",exact:true}).locator("..");
 await customRow.getByLabel("Empfohlener Preis",{exact:true}).fill("37.50");
 await customRow.getByLabel("Währung").selectOption("CHF");
 await customRow.getByLabel("Beschreibung / enthaltene Leistung",{exact:true}).fill("5 Landschaftsfotos im digitalen Set, keine persönliche Anfertigung.");
 await page.getByRole("button",{name:"Speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 const request=await page.evaluate(()=>window.testRequests[0]);const offers=request.body.sales_playbook.offers;
 assert.equal(offers.length,2);assert.equal(offers[0].id,"private_photo");assert.equal(offers[0].name,"Lieblingsfoto");assert.equal(offers[0].category,"custom");assert.equal(offers[0].recommendedPriceMinor,2500);
 assert.equal(offers[1].description,"5 Landschaftsfotos im digitalen Set, keine persönliche Anfertigung.");
 assert.match(offers[1].id,/^offer_[a-z0-9-]+$/u);
 assert.deepEqual({name:offers[1].name,currency:offers[1].currency,min:offers[1].minimumPriceMinor,price:offers[1].recommendedPriceMinor,max:offers[1].maximumPriceMinor,active:offers[1].active},{name:"Sommerpaket (VIP+)",currency:"CHF",min:3750,price:3750,max:3750,active:true});
 await page.evaluate(async saved=>{window.testRequests[0].resolve(Response.json({character:saved}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{...characterA,...request.body,revision:2});
 await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 await expect(page.getByRole("heading",{name:"Sommerpaket (VIP+)",exact:true}).locator("..").getByLabel("Empfohlener Preis",{exact:true})).toHaveValue("37.50");
 await expect(page.getByRole("heading",{name:"Sommerpaket (VIP+)",exact:true}).locator("..").getByLabel("Beschreibung / enthaltene Leistung",{exact:true})).toHaveValue("5 Landschaftsfotos im digitalen Set, keine persönliche Anfertigung.");
 await page.getByRole("heading",{name:"Sommerpaket (VIP+)",exact:true}).locator("..").getByLabel("Beschreibung / enthaltene Leistung",{exact:true}).fill("");
 await page.getByRole("button",{name:"Speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);
 const cleared=await page.evaluate(()=>window.testRequests[1].body);assert.equal(cleared.sales_playbook.offers[1].description,"");
 await page.evaluate(async saved=>{window.testRequests[1].resolve(Response.json({character:saved}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{...characterA,...cleared,revision:3});
 await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 await expect(page.getByRole("heading",{name:"Sommerpaket (VIP+)",exact:true}).locator("..").getByLabel("Beschreibung / enthaltene Leistung",{exact:true})).toHaveValue("");
 await page.getByRole("button",{name:"Angebot entfernen",exact:true}).first().click();await page.getByRole("button",{name:"Angebot entfernen",exact:true}).click();
 await expect(page.getByText("Noch keine Angebote angelegt.", {exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(3);
 assert.deepEqual((await page.evaluate(()=>window.testRequests[2])).body.sales_playbook.offers,[]);
});

test("offer addition respects twenty rows and storage readiness",async t=>{
 const page=await mount(t);await manageCharacter(page,"Synthetic Anna");await card(page,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 for(let count=1;count<20;count++)await page.getByRole("button",{name:"+ Angebot",exact:true}).click();
 await expect(page.getByLabel("Angebotsname",{exact:true})).toHaveCount(20);await expect(page.getByRole("button",{name:"+ Angebot",exact:true})).toBeDisabled();
 await page.getByRole("button",{name:"Angebot entfernen",exact:true}).last().click();await expect(page.getByRole("button",{name:"+ Angebot",exact:true})).toBeEnabled();
 const unavailable=await mount(t,false);await manageCharacter(unavailable,"Synthetic Anna");await card(unavailable,"Synthetic Anna").getByRole("button",{name:"Bearbeiten"}).click();
 await expect(unavailable.getByRole("button",{name:"+ Angebot",exact:true})).toBeDisabled();await expect(unavailable.getByRole("button",{name:"Angebot entfernen",exact:true})).toBeDisabled();
});


test("confirmed conversation closure pauses generation until explicit per-Fan resumption",async t=>{
 const page=await mount(t);const closureId="77777777-7777-4777-8777-777777777777";
 await page.evaluate(({id,fanId})=>{window.fixture.historyFor[fanId]=[{id,direction:"confirmed_reply",content:"Ich antworte nicht weiter.",created_at:"2026-10-14T12:00:00Z"}];},{id:closureId,fanId:fanA1.id});
 await openFan(page,"Fan A1");await page.getByLabel("Neue eingehende Fan-Nachricht").fill("Noch eine Nachricht");
 await expect(page.getByRole("button",{name:"3 KI-Antworten erzeugen",exact:true})).toBeDisabled();
 await expect(page.getByRole("button",{name:"Gespräch bewusst fortsetzen",exact:true})).toBeVisible();
 assert.equal(await page.evaluate(()=>window.testRequests.length),0);
 await page.getByRole("button",{name:"Gespräch bewusst fortsetzen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 const request=await page.evaluate(()=>window.testRequests[0]);assert.equal(request.method,"PATCH");assert.equal(request.body.id,fanA1.id);assert.ok(request.body.notes.includes(closureId));
 await page.evaluate(async fan=>{Object.assign(window.fixture.fansByCharacter[fan.character_id].find(value=>value.id===fan.id),fan);window.testRequests[0].resolve(Response.json({fan}));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));},{...request.body,revision:2});
 await expect(page.getByRole("button",{name:"Gespräch bewusst fortsetzen",exact:true})).toHaveCount(0);
 await page.getByLabel("Neue eingehende Fan-Nachricht").fill("Ich möchte Fotos");await expect(page.getByRole("button",{name:"3 KI-Antworten erzeugen",exact:true})).toBeEnabled();
 await openFan(page,"Fan A2");await page.getByLabel("Neue eingehende Fan-Nachricht").fill("Hallo");await expect(page.getByRole("button",{name:"3 KI-Antworten erzeugen",exact:true})).toBeEnabled();
});


test("private Character library edits reviewed metadata, scrolls and isolates Character switches",async t=>{
 const page=await mount(t,true,true);await page.setViewportSize({width:1280,height:520});await page.evaluate(()=>{document.getElementById("root").className="page";});await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0}'+readFileSync("src/app/chatadmin/chatadmin.module.css","utf8")});
 const asset={id:"50000000-0000-4000-8000-000000000001",workspace_id:characterA.workspace_id,character_id:characterA.id,revision:1,description:"Strand",tags:["Strand"],folder:"Sommer",offer_id:"private_photo",reviewed:false,available:true,deleted:false};
 await page.evaluate(({characterA,characterB,asset})=>{const policy={enabled:false,offer_id:"",delivery_hours:null,motifs:[],requires_confirmation:true,revision:0};window.fixture.media[characterA.id]={assets:[asset],policy,character:characterA,analysis_enabled:false};window.fixture.media[characterB.id]={assets:[],policy,character:characterB,analysis_enabled:false};},{characterA,characterB,asset});
 await openMediaSettings(page);const region=page.getByRole("region",{name:"Bilder von Synthetic Anna",exact:true});await region.getByText("Angaben, Freigabe & Dateipreis",{exact:true}).click();await expect(region.getByLabel("Beschreibung",{exact:true})).toHaveValue("Strand");await expect(region.getByRole("button",{name:"Mit KI beschreiben",exact:true})).toHaveCount(0);
 const before=await page.getByRole("navigation",{name:"Models"}).boundingBox();await region.evaluate(node=>node.scrollTop=node.scrollHeight);await expect.poll(()=>region.evaluate(node=>node.scrollTop)).toBeGreaterThan(0);assert.deepEqual(await page.getByRole("navigation",{name:"Models"}).boundingBox(),before);
 await region.getByLabel("Beschreibung und Motive geprüft; für die KI freigeben").check();await region.getByRole("button",{name:"Bildangaben speichern",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);const sent=await page.evaluate(()=>window.testRequests[0].body);assert.equal(sent.character_id,characterA.id);assert.equal(sent.id,asset.id);assert.equal(sent.reviewed,true);assert.equal(sent.offer_id,"private_photo");
 await page.evaluate(({asset,character})=>window.testRequests[0].resolve(Response.json({...window.fixture.media[character.id],assets:[{...asset,reviewed:true,revision:2}],character:{...character,revision:2}})),{asset,character:characterA});await expect(region.getByRole("status")).toContainText("Gespeichert");
 await selectCharacter(page,"Synthetic Bea");await openMediaSettings(page,"Synthetic Bea");await expect(page.getByRole("region",{name:"Bilder von Synthetic Bea",exact:true})).toContainText("Noch keine Bilder vorhanden");await expect(page.getByLabel("Beschreibung",{exact:true})).toHaveCount(0);
});

test("catalogue folder editor submits individual category prices and private video stays scoped",async t=>{
 const page=await mount(t,true,true);
 const folder={id:"50000000-0000-4000-8000-000000000010",workspace_id:characterA.workspace_id,character_id:characterA.id,parent_id:null,kind:"video",name:"Landschaft",offer_id:"",price_rules:{negotiation_allowed:false,special_discounts_allowed:false},revision:1};
 const asset={id:"50000000-0000-4000-8000-000000000011",workspace_id:characterA.workspace_id,character_id:characterA.id,folder_id:folder.id,media_type:"video",duration_ms:1000,revision:1,description:"Blaue Fläche",tags:["blau"],folder:"",offer_id:"",reviewed:true,available:true,deleted:false};
 await page.evaluate(({characterA,folder,asset})=>{window.fixture.media[characterA.id]={assets:[asset],folders:[folder],policy:{enabled:false,offer_id:"",delivery_hours:null,motifs:[],requires_confirmation:true,revision:0},character:characterA,catalogue_enabled:true,video_enabled:true,analysis_enabled:false};},{characterA,folder,asset});
 await openMediaSettings(page);
 const region=page.getByRole("region",{name:"Bilder von Synthetic Anna",exact:true});
 await expect(region.locator("video")).toHaveAttribute("src",`/api/chatadmin/media?character_id=${characterA.id}&id=${asset.id}&revision=${asset.revision}`);
 await expect(region.getByRole("button",{name:"Mit KI beschreiben",exact:true})).toHaveCount(0);
 await region.getByRole("button",{name:"Ordner anlegen",exact:true}).click();
 await region.getByLabel("Ordnername",{exact:true}).fill("Wald");
 await region.getByLabel("Eigener Kategoriepreis",{exact:true}).check();
 await expect(region.getByLabel("Startpreis",{exact:true}).first()).toHaveValue("");
 await region.getByLabel("Startpreis",{exact:true}).first().fill("23,50");await region.getByLabel("Mindestpreis",{exact:true}).first().fill("17");
 await region.getByLabel("Verhandlungen erlauben",{exact:true}).first().check();
 await region.getByRole("button",{name:"Ordner speichern",exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);
 const sent=await page.evaluate(()=>({url:window.testRequests[0].url,body:window.testRequests[0].body}));
 assert.equal(sent.body.action,"save_folder");assert.equal(sent.body.price.start_minor,2350);assert.equal(sent.body.price.minimum_minor,1700);assert.equal(sent.body.price.negotiation_allowed,true);assert.equal(sent.body.character_id,characterA.id);
});

test("changed Character price revision blocks stale clipboard use before confirmation",async t=>{
 const page=await mount(t,true,true);await openFan(page,"Fan A1");
 await generate(page);await complete(page);
 await page.evaluate(()=>{window.copyCalls=[];Object.defineProperty(navigator,"clipboard",{value:{writeText:async text=>window.copyCalls.push(text)},configurable:true});});
 await copies(page).first().click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);
 assert.equal(await page.evaluate(()=>window.testRequests[1].url),"/api/chatadmin/characters");
 await page.evaluate(character=>window.testRequests[1].resolve(Response.json({characters:[{...character,revision:2}]})),characterA);
 await expect(page.getByRole("status")).toContainText("Medien oder Preise haben sich geändert");
 assert.deepEqual(await page.evaluate(()=>window.copyCalls),[]);assert.equal(await page.evaluate(()=>window.testRequests.filter(r=>r.url==="/api/chatadmin/conversations").length),0);
});


test("legacy composer also blocks stale media prices before clipboard use",async t=>{
 const page=await mount(t,true,true,false);await page.getByLabel("Von OnlyFans kopierte Fan-Nachricht").fill("Bild im Wald");await page.getByRole("button",{name:"Antwortvorschläge erzeugen",exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(1);await complete(page);
 await page.evaluate(()=>{window.copyCalls=[];Object.defineProperty(navigator,"clipboard",{value:{writeText:async text=>window.copyCalls.push(text)},configurable:true});});
 await page.getByRole("button",{name:"Antwort kopieren",exact:true}).first().click();await expect.poll(()=>page.evaluate(()=>window.testRequests.length)).toBe(2);
 await page.evaluate(character=>window.testRequests[1].resolve(Response.json({characters:[{...character,revision:2}]})),characterA);
 await expect(page.getByRole("status")).toContainText("Medien oder Preise haben sich geändert");assert.deepEqual(await page.evaluate(()=>window.copyCalls),[]);
});

test("CRM keeps Models, Fans and conversation in order and returns to the same fan after Model settings",async t=>{
 const page=await mount(t,true,true);await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{document.getElementById("root").className="page";});
 await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0}'+readFileSync("src/app/chatadmin/chatadmin.module.css","utf8")});
 await openFan(page,"Fan A1");await page.getByLabel("Neue eingehende Fan-Nachricht").fill("Keep this unsent message");
 const models=await page.getByRole("navigation",{name:"Models",exact:true}).boundingBox();
 const fans=await page.getByRole("region",{name:"Fans von Synthetic Anna",exact:true}).boundingBox();
 const conversation=await page.getByRole("region",{name:"Gespräch mit Fan A1",exact:true}).boundingBox();
 assert.ok(models.x+models.width<=fans.x+1);assert.ok(fans.x+fans.width<=conversation.x+1);
 await page.screenshot({path:"test-results/playwright-core-flow/chatadmin-crm-desktop.png",fullPage:true,animations:"disabled"});
 await expect(page.getByRole("button",{name:"Bilder",exact:true})).toHaveCount(0);
 await expect(page.getByRole("button",{name:"Gespräch",exact:true})).toHaveCount(0);
 await page.getByRole("button",{name:"Synthetic Anna Einstellungen",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Profil & Regeln",exact:true})).toBeVisible();
 await expect(page.getByRole("region",{name:"Gespräch mit Fan A1",exact:true})).toBeHidden();
 await page.getByRole("button",{name:"← Zurück zu den Gesprächen",exact:true}).click();
 await expect(page.getByRole("region",{name:"Gespräch mit Fan A1",exact:true})).toBeVisible();
 await expect(page.getByLabel("Neue eingehende Fan-Nachricht")).toHaveValue("Keep this unsent message");
 assert.equal(await page.evaluate(()=>window.testRequests.length),0);
});

test("CRM Model settings protect unsaved profile input before switching to media",async t=>{
 const page=await mount(t,true,true);await page.evaluate(character=>{window.fixture.media[character.id]={assets:[],policy:{enabled:false,offer_id:"",delivery_hours:null,motifs:[],requires_confirmation:true,revision:0},character,analysis_enabled:false};},characterA);
 await page.getByRole("button",{name:"Synthetic Anna Einstellungen",exact:true}).click();
 await page.getByLabel("Name",{exact:true}).fill("Unsaved Model name");
 page.once("dialog",dialog=>dialog.dismiss());await page.getByRole("button",{name:"Medien & Preise",exact:true}).click();
 await expect(page.getByLabel("Name",{exact:true})).toHaveValue("Unsaved Model name");
 page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Medien & Preise",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Medien & Preise",exact:true})).toBeVisible();
 await expect(page.getByLabel("Name",{exact:true})).toHaveCount(0);
 assert.equal(await page.evaluate(()=>window.testRequests.length),0);
});

test("CRM media settings fit a narrow screen and retain the private upload and price controls",async t=>{
 const page=await mount(t,true,true);await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{document.getElementById("root").className="page";});
 await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0}'+readFileSync("src/app/chatadmin/chatadmin.module.css","utf8")});
 await page.evaluate(character=>{window.fixture.media[character.id]={assets:[],folders:[],policy:{enabled:false,offer_id:"",delivery_hours:null,motifs:[],requires_confirmation:true,revision:0},character,catalogue_enabled:true,video_enabled:true,analysis_enabled:false};},characterA);
 await openMediaSettings(page);
 await expect(page.getByRole("heading",{name:"Medien & Preise",exact:true})).toBeVisible();
 await expect(page.getByRole("combobox",{name:"Zielordner",exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Ordner anlegen",exact:true}).click();await page.getByLabel("Eigener Kategoriepreis",{exact:true}).check();
 await page.getByLabel("Startpreis",{exact:true}).fill("12");
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"settings have no horizontal overflow");
 const field=await page.getByLabel("Startpreis",{exact:true}).boundingBox();assert.ok(field.x>=0&&field.x+field.width<=390);
 await page.screenshot({path:"test-results/playwright-core-flow/chatadmin-crm-mobile-settings.png",fullPage:true,animations:"disabled"});
});


test("Model portrait rail collapses to pictures and expands names without losing the active fan",async t=>{
 const page=await mount(t,true,true,true,false);await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>{document.getElementById("root").className="page";});
 await page.addStyleTag({content:'*{box-sizing:border-box}body{margin:0}'+readFileSync("src/app/chatadmin/chatadmin.module.css","utf8")});
 await openFan(page,"Fan A1");
 const nav=page.getByRole("navigation",{name:"Models",exact:true});
 assert.ok((await nav.boundingBox()).width<=81);
 await expect(page.getByText("Fans",{exact:true})).toBeVisible();
 await expect(page.getByRole("searchbox",{name:"Fans durchsuchen",exact:true})).toBeVisible();
 await expect(nav.getByRole("button",{name:"Model-Leiste ausklappen",exact:true})).toHaveAttribute("aria-expanded","false");
 await page.screenshot({path:"test-results/playwright-core-flow/chatadmin-crm-portrait-rail.png",fullPage:true,animations:"disabled"});
 await nav.getByRole("button",{name:"Model-Leiste ausklappen",exact:true}).click();
 assert.ok((await nav.boundingBox()).width>=190);
 await expect(nav.getByRole("heading",{name:"Synthetic Anna",exact:true})).toBeVisible();
 await expect(nav.getByRole("button",{name:"Model-Leiste einklappen",exact:true})).toHaveAttribute("aria-expanded","true");
 await expect(page.getByRole("region",{name:"Gespräch mit Fan A1",exact:true})).toBeVisible();
 assert.equal(await page.evaluate(()=>window.testRequests.length),0);
});

test("Model rail uses assigned portrait endpoint and falls back without exposing private paths",async t=>{
 const page=await mount(t,true,true,true,false);
 await page.route("**/api/chatadmin/characters/portrait?**",route=>route.fulfill({status:404,body:""}));
 const requested=page.waitForRequest(request=>request.url().includes("/api/chatadmin/characters/portrait?"));
 await page.evaluate(({a,b})=>window.mountCharacters([{...a,revision:2,profile_image_path:`chat-characters/${a.workspace_id}/${a.id}/portrait.jpg`},b],true,true,true),{a:characterA,b:characterB});
 const request=await requested;assert.ok(request.url().includes(`character_id=${characterA.id}&revision=2`));
 const portrait=page.locator(".modelPortrait img");
 await expect.poll(()=>portrait.count()).toBe(0);
 assert.equal(await page.locator('img[src*="chat-characters/"]').count(),0);
 await expect(page.getByRole("button",{name:"Model-Leiste ausklappen",exact:true})).toHaveAttribute("aria-expanded","false");
});

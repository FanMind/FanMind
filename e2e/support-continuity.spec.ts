import {expect,test,type Page} from "@playwright/test";
import {supportClientBundle} from "./support-client-bundle.mts";
async function mount(page:Page,kind="chat"){
 await page.route("**/api/support/ai-consent",route=>route.fulfill({status:404,json:{error:"unavailable"}}));
 await page.goto("/support");await page.setContent('<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:16px sans-serif;margin:12px}section{max-width:620px;overflow-wrap:anywhere}textarea{display:block;max-width:100%;min-height:70px}button{min-height:44px;margin:4px}</style><div id="support-fixture"></div>');
 await page.evaluate(kind=>{(window as Window & {supportFixture?:string}).supportFixture=kind;},kind);await page.addScriptTag({content:await supportClientBundle()});
 if(kind==="chat"){await page.getByText("Datenschutz und Support-Übergabe",{exact:true}).click();await page.getByText("KI & Datenschutz",{exact:true}).click();}
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
 await mount(page);await expect(page.getByRole("textbox",{name:"Deine Frage"})).toBeEnabled();
 await page.getByRole("textbox",{name:"Deine Frage"}).fill("Meine technische Frage");await page.getByRole("button",{name:"Senden",exact:true}).click();
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
 authorized=false;await page.evaluate(()=>window.dispatchEvent(new Event("focus")));await expect(page.getByText("Freigegebener Kundentext",{exact:true})).toHaveCount(0);await expect(page.getByText("Meldungen oder Wiederaufnahme derzeit nicht bestätigt.",{exact:false})).toBeVisible();
});

test("Owner acknowledgment stays absent after a fresh inbox mount",async({page})=>{
 let acknowledged=false,ackPosts=0;
 const notification={id:"10000000-0000-4000-8000-000000000002",workspace_id:null,reference_id:"10000000-0000-4000-8000-000000000003",code:"security_boundary",created_at:"2026-11-13T00:00:00Z",acknowledged_at:null,occurrences:1};
 await page.route("**/api/admin/support/overview",async route=>{
  if(route.request().method()==="POST"){
   const body=route.request().postDataJSON();
   if(body.action==="ack"){expect(body).toEqual({action:"ack",id:notification.id});acknowledged=true;ackPosts++;await route.fulfill({json:{ok:true}});return;}
   expect(body).toEqual({action:"recover"});await route.fulfill({json:{repaired:0}});return;
  }
  await route.fulfill({json:{items:acknowledged?[]:[notification],retention:{healthy:true}}});
 });
 await mount(page,"owner");await expect(page.getByText("Sicherheitswarnung",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Zur Kenntnis genommen",exact:true}).click();await expect(page.getByText("Sicherheitswarnung",{exact:true})).toHaveCount(0);
 await mount(page,"owner");await expect(page.getByRole("heading",{name:"Owner-Meldungen aus allen Workspaces"})).toBeVisible();
 await expect(page.getByText("Täglicher Support-Löschlauf nicht bestätigt.",{exact:false})).toHaveCount(0);
 await expect(page.getByText("Sicherheitswarnung",{exact:true})).toHaveCount(0);expect(ackPosts).toBe(1);
 await expect(page.getByText("Meldungen oder Wiederaufnahme derzeit nicht bestätigt.",{exact:false})).toHaveCount(0);
});

for(const status of [409,503])test(`failed Owner acknowledgment (${status}) remains visible after reload without automatic retry`,async({page})=>{
 let ackPosts=0;
 const notification={id:"10000000-0000-4000-8000-000000000002",workspace_id:null,reference_id:"10000000-0000-4000-8000-000000000003",code:"security_boundary",created_at:"2026-11-13T00:00:00Z",acknowledged_at:null,occurrences:1};
 await page.route("**/api/admin/support/overview",async route=>{
  if(route.request().method()==="POST"){
   if(route.request().postDataJSON().action==="ack"){ackPosts++;await route.fulfill({status,json:{error:"support_unavailable"}});return;}
   await route.fulfill({json:{repaired:0}});return;
  }
  await route.fulfill({json:{items:[notification],retention:{healthy:true}}});
 });
 await mount(page,"owner");await page.getByRole("button",{name:"Zur Kenntnis genommen",exact:true}).click();
 await expect(page.getByText("Meldungen oder Wiederaufnahme derzeit nicht bestätigt.",{exact:false})).toBeVisible();
 await mount(page,"owner");await expect(page.getByText("Sicherheitswarnung",{exact:true})).toBeVisible();expect(ackPosts).toBe(1);
});
test("support export suppresses a late download after account revalidation",async({page})=>{
 let scope="scope-a",release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});let started=false,downloads=0;
 page.on('download',()=>downloads++);
 await page.route("**/api/support/conversation",route=>route.fulfill({json:{scope,turns:[]}}));
 await page.route("**/api/support/privacy?**",async route=>{started=true;await gate;await route.fulfill({json:{scope:"scope-a",turns:[]}});});
 await mount(page);await page.getByRole('button',{name:'Eigene Supportdaten herunterladen'}).click();await expect.poll(()=>started).toBe(true);
 scope='scope-b';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(page.getByRole('textbox',{name:'Deine Frage'})).toBeEnabled();
 release();await page.waitForTimeout(150);expect(downloads).toBe(0);
});
test("support erase clears ambiguous pending text despite focus refresh and preserves failure feedback",async({page})=>{
 let release:()=>void=()=>{};const gate=new Promise<void>(resolve=>{release=resolve;});let started=false,posts=0;
 await page.route("**/api/support/conversation",async route=>{if(route.request().method()==='POST'){posts++;await route.abort('failed');return;}await route.fulfill({json:{scope:'scope-a',turns:[]}});});
 await page.route("**/api/support/privacy?**",async route=>{started=true;await gate;await route.fulfill({json:{scope:'scope-a',state:{thread:'10000000-0000-4000-8000-000000000001',sequence:1}}});});
 await mount(page);await page.getByRole('textbox',{name:'Deine Frage'}).fill('Pending private question');await page.getByRole('button',{name:'Senden',exact:true}).click();await expect(page.getByRole('button',{name:'Mit gleicher Anfrage erneut versuchen'})).toBeVisible();
 await page.getByRole('button',{name:'Eigenen Supportverlauf löschen'}).click();await expect.poll(()=>started).toBe(true);
 release();page.once('dialog',async dialog=>{await dialog.accept();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));});await expect(page.getByRole('textbox',{name:'Deine Frage'})).toBeEnabled();await expect(page.getByRole('textbox',{name:'Deine Frage'})).toHaveValue('');await expect(page.getByRole('button',{name:'Mit gleicher Anfrage erneut versuchen'})).toHaveCount(0);expect(posts).toBe(1);
 // A fresh explicit erase may fail; a subsequent successful reload must not hide it.
 await page.unroute("**/api/support/privacy?**");await page.route("**/api/support/privacy?**",route=>route.fulfill({status:503,json:{error:'unavailable'}}));await page.getByRole('button',{name:'Eigenen Supportverlauf löschen'}).click();await expect(page.getByText('Löschung nicht bestätigt.',{exact:false})).toBeVisible();
});
test("own support export downloads retained data and confirmed erasure submits the exact preview",async({page})=>{
 const thread='10000000-0000-4000-8000-000000000001';let erased=false,submissions=0;
 const turns=[{request_id:'10000000-0000-4000-8000-000000000002',question:'Synthetic own question',answer:'Synthetic answer',unanswered:false}];
 await page.route('**/api/support/conversation',route=>route.fulfill({json:{scope:'scope-a',turns:erased?[]:turns}}));
 await page.route('**/api/support/privacy**',async route=>{
  if(route.request().method()==='POST'){expect(route.request().postDataJSON()).toEqual({action:'erase',confirmed:true,scope:'scope-a',thread,sequence:12});submissions++;erased=true;await route.fulfill({json:{erased:true}});return;}
  await route.fulfill({json:route.request().url().includes('preview=erase')?{scope:'scope-a',state:{thread,sequence:12}}:{scope:'scope-a',turns}});
 });
 await mount(page);await expect(page.getByText('Synthetic own question',{exact:false})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Eigene Supportdaten herunterladen'}).click();const artifact=await download;expect(artifact.suggestedFilename()).toBe('fanmind-support-data.json');
 const stream=await artifact.createReadStream();let content='';for await(const chunk of stream!)content+=chunk.toString();expect(JSON.parse(content)).toEqual({scope:'scope-a',turns});
 page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'Eigenen Supportverlauf löschen'}).click();await expect(page.getByText('Synthetic own question',{exact:false})).toHaveCount(0);await expect.poll(()=>submissions).toBe(1);await expect(page.getByRole('textbox',{name:'Deine Frage'})).toBeEnabled();
});


test("authenticated AI requires opt-in, supports withdrawal and suppresses a late answer",async({page})=>{
 let turns:Array<{request_id:string;question:string;answer:string;unanswered:boolean}>=[];
 const posts:Array<{aiConsent:boolean;question:string}>=[];
 let late=false,release:()=>void=()=>{},started=false;
 const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/support/conversation',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();posts.push(body);
   if(late){started=true;await gate;await route.fulfill({json:{scope:'scope-a',turns:[{request_id:body.requestId,question:body.question,answer:'Late AI answer must stay hidden',unanswered:false}],answerMode:'ai'}}).catch(()=>{});return;}
   turns=[...turns,{request_id:body.requestId,question:body.question,answer:body.aiConsent?'Consented synthetic AI answer':'Approved knowledge',unanswered:false}];
   await route.fulfill({json:{scope:'scope-a',turns,answerMode:body.aiConsent?'ai':'knowledge'}});return;
  }
  await route.fulfill({json:{scope:'scope-a',turns}});
 });
 await mount(page);
 const consent=page.getByRole('checkbox',{name:'KI-Antworten mit OpenAI erlauben',exact:true});await expect(consent).not.toBeChecked();
 await page.getByRole('textbox',{name:'Deine Frage'}).fill('Knowledge question');await page.getByRole('button',{name:'Senden',exact:true}).click();await expect(page.getByText('Approved knowledge',{exact:false})).toBeVisible();expect(posts[0].aiConsent).toBe(false);
 await consent.check();await page.getByRole('textbox',{name:'Deine Frage'}).fill('Consented AI question');await page.getByRole('button',{name:'Senden',exact:true}).click();await expect(page.getByText('KI-Antwort gespeichert.',{exact:false})).toBeVisible();expect(posts[1].aiConsent).toBe(true);
 late=true;await page.getByRole('textbox',{name:'Deine Frage'}).fill('Pending AI question');await page.getByRole('button',{name:'Senden',exact:true}).click();await expect.poll(()=>started).toBe(true);
 await consent.uncheck();release();await expect(page.getByRole('textbox',{name:'Deine Frage'})).toBeEnabled();await expect(page.getByText('Late AI answer must stay hidden',{exact:false})).toHaveCount(0);await expect(consent).not.toBeChecked();
 expect(posts).toHaveLength(3);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(consent).not.toBeChecked();
 await expect(page.getByRole('button',{name:'Mit gleicher Anfrage erneut versuchen'})).toHaveCount(0);
});

test('platform Support never requests Character context or offers administration tools',async({page})=>{
 const requests:string[]=[];
 await page.route('**/api/support/creator-context**',route=>{requests.push(route.request().url());return route.fulfill({status:410,json:{error:'creator_support_retired'}});});
 await page.route('**/api/support/conversation',async route=>{
  if(route.request().method()==='POST'){
   const body=route.request().postDataJSON();expect(Object.keys(body).sort()).toEqual(['aiConsent','context','question','requestId','scope']);
   await route.fulfill({json:{scope:'scope-a',turns:[{request_id:body.requestId,question:body.question,answer:'Öffne die vorhandenen Model-Einstellungen im Creator-Chat.',unanswered:false}]}});return;
  }
  await route.fulfill({json:{scope:'scope-a',turns:[]}});
 });
 await mount(page);await expect(page.getByRole('textbox',{name:'Deine Frage'})).toBeEnabled();
 await expect(page.getByRole('combobox')).toHaveCount(0);
 await expect(page.getByText('Creator-Unterstützung · Staging-Test',{exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Letzte Stiländerung rückgängig'})).toHaveCount(0);
 await page.getByRole('textbox',{name:'Deine Frage'}).fill('Wo ändere ich meinen Schreibstil?');
 await page.getByRole('button',{name:'Senden',exact:true}).click();
 await expect(page.getByText('Öffne die vorhandenen Model-Einstellungen im Creator-Chat.',{exact:false})).toBeVisible();
 expect(requests).toEqual([]);
});

test('persistent account consent survives remount and withdrawal is stored without preselection',async({page})=>{
 const version='support-ai-20261114-v1';let writes=0;
 let state={granted:false,revision:0,version:null as string|null,grantedAt:null as string|null,revokedAt:null as string|null};
 await page.route('**/api/support/ai-consent',async route=>{
  if(route.request().method()==='POST'){const b=route.request().postDataJSON();expect(b.scope).toBe('scope-a');expect(b.confirmed).toBe(true);expect(b.version).toBe(version);expect(b.revision).toBe(state.revision);writes++;state={granted:b.granted,revision:state.revision+1,version,grantedAt:b.granted?new Date().toISOString():state.grantedAt,revokedAt:b.granted?null:new Date().toISOString()};}
  await route.fulfill({json:{scope:'scope-a',state,version,text:'Synthetic informed decision'}});
 });
 await page.route('**/api/support/conversation',route=>route.fulfill({json:{scope:'scope-a',turns:[]}}));
 await page.goto('/support');await page.setContent('<div id="support-fixture"></div>');await page.addScriptTag({content:await supportClientBundle()});
 await page.getByText('KI & Datenschutz',{exact:true}).click();
 const checkbox=page.getByRole('checkbox',{name:'KI-Antworten mit OpenAI erlauben',exact:true});await expect(checkbox).toBeEnabled();await expect(checkbox).not.toBeChecked();
 await checkbox.click();await expect(checkbox).toBeChecked();await expect(checkbox).toBeEnabled();expect(writes).toBe(1);
 await page.setContent('<div id="support-fixture"></div>');await page.addScriptTag({content:await supportClientBundle()});await page.getByText('KI & Datenschutz',{exact:true}).click();await expect(checkbox).toBeEnabled();await expect(checkbox).toBeChecked();expect(writes).toBe(1);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(checkbox).toBeEnabled();await expect(checkbox).toBeChecked();expect(writes).toBe(1);
 await checkbox.click();await expect.poll(()=>state.granted).toBe(false);await expect(checkbox).not.toBeChecked();expect(writes).toBe(2);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect(checkbox).not.toBeChecked();expect(writes).toBe(2);
});

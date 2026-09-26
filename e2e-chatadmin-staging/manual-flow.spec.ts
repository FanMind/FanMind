import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { installChatAdminNetworkBoundary, chatAdminRequestAllowed } from "./network-boundary.mjs";
import { updateBrowserDiagnostic } from "./browser-diagnostic.mjs";
import { canonicalChatAdminFixtureId } from "./fixture-identity.mjs";

const APP="https://staging.fanmind.ch";
const SUPABASE=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const MODE=process.env.FANMIND_CHAT_ADMIN_BROWSER_MODE as "probe"|"acceptance";
const mark=(stage:string)=>updateBrowserDiagnostic(process.env,MODE,{stage,status:"none"});
const noteStatus=(status:number)=>updateBrowserDiagnostic(process.env,MODE,{status:status>=200&&status<600?`${Math.floor(status/100)}xx`:"other"});
const id=(key:string)=>canonicalChatAdminFixtureId(process.env[`FANMIND_CHAT_ADMIN_${key}`]);
type Session={token:string;anon:string};
async function direct(request:APIRequestContext,url:string,options:Parameters<APIRequestContext["fetch"]>[1]={}) {
  if(![APP,SUPABASE].includes(new URL(url).origin))throw Error("chat_admin_manual_direct_origin");
  if(MODE==="probe"&&!chatAdminRequestAllowed(new URL(url),options.method??'GET',{appOrigin:APP,supabaseOrigin:SUPABASE,mode:MODE}))throw Error("chat_admin_manual_probe_write");
  return request.fetch(url,{...options,maxRedirects:0,timeout:45_000});
}

async function boundary(context:BrowserContext) {
  const violations=await installChatAdminNetworkBoundary(context,{appOrigin:APP,supabaseOrigin:SUPABASE,mode:MODE,onViolation:network=>updateBrowserDiagnostic(process.env,MODE,{network})});
  return ()=>expect(violations()).toBe(0);
}

async function login(page:Page,remember:(session:Session)=>void,actor:"owner"|"secondary"|"admin"="owner"):Promise<Session> {
  const prefix=actor==="admin"?"FANMIND_STAGING_ADMIN_E2E":actor==="secondary"?"FANMIND_STAGING_E2E_SECONDARY":"FANMIND_STAGING_E2E";
  mark(`${actor}_login_page`);
  await page.goto("/login");
  mark(`${actor}_login_form`);
  await page.getByRole("textbox",{name:"E-Mail",exact:true}).fill(process.env[`${prefix}_EMAIL`]!);
  await page.locator('input[name="password"]').fill(process.env[`${prefix}_PASSWORD`]!);
  const pending=page.waitForResponse(response=>{
    const url=new URL(response.url());return url.origin===SUPABASE&&url.pathname==="/auth/v1/token"&&url.searchParams.get("grant_type")==="password";
  });
  mark(`${actor}_token`);
  await page.getByRole("button",{name:/Einloggen/u}).click();
  const response=await pending;noteStatus(response.status());expect(response.ok()).toBe(true);
  const payload=await response.json();
  const session={token:payload.access_token as string,anon:response.request().headers().apikey};
  // Retain a newly created Auth session before any assertion/navigation can fail.
  if(typeof session.token==="string"&&session.token)remember(session);
  mark(`${actor}_identity`);
  expect(payload.user?.id).toBe(id(actor==="admin"?"PLATFORM_ADMIN_ID":actor==="secondary"?"FOREIGN_OWNER_ID":"OWNER_ID"));
  expect(typeof payload.access_token).toBe("string");
  mark(`${actor}_dashboard`);await expect(page).toHaveURL(/\/dashboard(?:\?|$)/u);
  return session;
}
async function logout(context:BrowserContext,session:Session) {
  const result=await direct(context.request,`${SUPABASE}/auth/v1/logout?scope=local`,{method:"POST",headers:{apikey:session.anon,Authorization:`Bearer ${session.token}`}});
  expect(result.ok()).toBe(true);await context.clearCookies();
}
async function api(page:Page,path:string,body:object) {
  return direct(page.request,`${APP}${path}`,{method:"POST",headers:{Origin:APP,"Content-Type":"application/json"},data:body});
}
async function generate(page:Page,characterId:string,revision:number) {
  const persona=characterId===id("CHARACTER_A_ID")?"persona_a":"persona_b";
  await page.getByLabel("Fan/Chat-Bezeichnung (optional)").fill("Synthetischer Fan");
  await page.getByLabel("Von OnlyFans kopierte Fan-Nachricht").fill("Hallo, ich wünsche dir einen schönen entspannten Nachmittag. Wie war dein Tag?");
  const pending=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/chatadmin/reply-suggestions"&&response.request().method()==="POST");
  mark(`${persona}_request`);await page.getByRole("button",{name:"Antwortvorschläge erzeugen",exact:true}).click();
  const response=await pending;mark(`${persona}_response`);noteStatus(response.status());expect(response.status()).toBe(200);
  const payload=await response.json();expect(payload.character_id).toBe(characterId);expect(payload.character_revision).toBe(revision);
  expect(Array.isArray(payload.replies)&&payload.replies.length===3&&payload.replies.every((v:unknown)=>typeof v==="string"&&v.trim().length>0)).toBe(true);
  const copies=page.getByRole("button",{name:"Antwort kopieren",exact:true});await expect(copies).toHaveCount(3);
  mark(`${persona}_copy`);const selected=await copies.first().locator("..").locator("p").innerText();
  await copies.first().click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(selected);
  await expect(page.getByRole("status")).toContainText(/manuell|selbst/u);
}

test("protected synthetic ChatAdmin application flow and authority negatives",async({browser,page})=>{
  mark("browser_context");
  const ownerBoundary=await boundary(page.context());
  const secondaryContext=await browser.newContext({baseURL:APP,serviceWorkers:"block"});
  const adminContext=await browser.newContext({baseURL:APP,serviceWorkers:"block"});
  const anonymousContext=await browser.newContext({baseURL:APP,serviceWorkers:"block"});
  const secondaryPage=await secondaryContext.newPage();const secondaryBoundary=await boundary(secondaryContext);
  const adminPage=await adminContext.newPage();const adminBoundary=await boundary(adminContext);
  let ownerSession:Session|undefined,secondarySession:Session|undefined,adminSession:Session|undefined;
  try {
    mark("version");const version=await direct(page.request,`${APP}/api/version`);noteStatus(version.status());expect(version.ok()).toBe(true);
    const state=await version.json();expect(state.runtimeEnvironment).toBe("staging");expect(state.releaseCommit).toBe(process.env.GITHUB_SHA);
    mark("anonymous");const anonymous=await direct(anonymousContext.request,`${APP}/api/chatadmin/characters`);noteStatus(anonymous.status());expect(anonymous.status()).toBe(401);
    adminSession=await login(adminPage,session=>{adminSession=session;},"admin");
    // This route checks the live FANMIND_ADMIN_EMAILS, proving this is an actual
    // platform admin before its ChatAdmin denial is counted. No admin writes.
    mark("admin_authority");const adminProof=await direct(adminPage.request,`${APP}/api/admin/notifications`);noteStatus(adminProof.status());expect(adminProof.status()).toBe(200);await adminProof.dispose();
    mark("admin_denial");const adminDenied=await direct(adminPage.request,`${APP}/api/chatadmin/characters`);noteStatus(adminDenied.status());expect(adminDenied.status()).toBe(403);
    ownerSession=await login(page,session=>{ownerSession=session;});
    if(MODE==="probe") {
      secondarySession=await login(secondaryPage,session=>{secondarySession=session;},"secondary");
    } else {
    mark("chatadmin_page");await page.goto("/chatadmin");await expect(page.getByRole("heading",{name:"ChatAdmin",exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{name:"FM Synthetic Foreign Character",exact:true})).toHaveCount(0);
    const a=page.locator("article").filter({has:page.getByRole("heading",{name:"FM Synthetic Character A",exact:true})});
    const b=page.locator("article").filter({has:page.getByRole("heading",{name:"FM Synthetic Character B",exact:true})});
    await a.getByRole("button",{name:"Auswählen",exact:true}).click();
    await generate(page,id("CHARACTER_A_ID"),1);
    mark("persona_switch");
    await b.getByRole("button",{name:"Auswählen",exact:true}).click();
    await expect(page.getByRole("button",{name:"Antwort kopieren",exact:true})).toHaveCount(0);
    await expect(page.getByLabel("Von OnlyFans kopierte Fan-Nachricht")).toHaveValue("");
    await expect(page.getByLabel("Fan/Chat-Bezeichnung (optional)")).toHaveValue("");
    await generate(page,id("CHARACTER_B_ID"),1);
    mark("negatives");
    const stale=await api(page,"/api/chatadmin/reply-suggestions",{character_id:id("CHARACTER_A_ID"),character_revision:999,incoming_message:"Synthetisch"});expect(stale.status()).toBe(409);
    // The committed fixture uses this otherwise unused UUID for an existing
    // Character owned by the second synthetic Workspace, without its capability.
    const foreignCharacterId=id("CONVERSATION_B_ID");
    const foreign=await api(page,"/api/chatadmin/reply-suggestions",{character_id:foreignCharacterId,character_revision:1,incoming_message:"Synthetisch"});expect(foreign.status()).toBe(403);expect(await foreign.json()).toEqual({error:"resource_forbidden"});
    const ownerForeignRead=await direct(page.request,`${SUPABASE}/rest/v1/chat_characters?id=eq.${foreignCharacterId}&select=id`,{headers:{apikey:ownerSession.anon,Authorization:`Bearer ${ownerSession.token}`}});expect(ownerForeignRead.ok()).toBe(true);expect(await ownerForeignRead.json()).toEqual([]);
    await b.getByRole("button",{name:"Deaktivieren",exact:true}).click();
    await expect(page.getByRole("button",{name:"Antwortvorschläge erzeugen",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Antwort kopieren",exact:true})).toHaveCount(0);
    const inactive=await api(page,"/api/chatadmin/reply-suggestions",{character_id:id("CHARACTER_B_ID"),character_revision:2,incoming_message:"Synthetisch"});expect(inactive.status()).toBe(400);
    const untrusted=await direct(page.request,`${APP}/api/chatadmin/characters`,{method:"POST",headers:{Origin:"https://example.invalid"},data:{}});expect(untrusted.status()).toBe(403);
    secondarySession=await login(secondaryPage,session=>{secondarySession=session;},"secondary");
    const denied=await direct(secondaryPage.request,`${APP}/api/chatadmin/characters`);expect(denied.status()).toBe(403);
    const deniedReply=await api(secondaryPage,"/api/chatadmin/reply-suggestions",{character_id:id("CHARACTER_A_ID"),character_revision:1,incoming_message:"Synthetisch"});expect(deniedReply.status()).toBe(403);
    const directRead=await direct(secondaryPage.request,`${SUPABASE}/rest/v1/chat_characters?select=id`,{headers:{apikey:secondarySession.anon,Authorization:`Bearer ${secondarySession.token}`}});expect(directRead.ok()).toBe(true);expect(await directRead.json()).toEqual([]);
    }
    mark("network_check");
    ownerBoundary();secondaryBoundary();adminBoundary();
  } catch(error) {
    updateBrowserDiagnostic(process.env,MODE,{outcome:"failed"});throw error;
  } finally {
    const cleanup=[];if(ownerSession)cleanup.push(logout(page.context(),ownerSession));if(secondarySession)cleanup.push(logout(secondaryContext,secondarySession));if(adminSession)cleanup.push(logout(adminContext,adminSession));
    const results=await Promise.allSettled(cleanup);await secondaryContext.close();await anonymousContext.close();await adminContext.close();
    if(results.some(result=>result.status==="rejected")){updateBrowserDiagnostic(process.env,MODE,{sessionCleanup:"failed",outcome:"failed"});throw Error("chat_admin_manual_session_cleanup");}
    updateBrowserDiagnostic(process.env,MODE,{sessionCleanup:"passed"});
  }
  mark("complete");updateBrowserDiagnostic(process.env,MODE,{outcome:"passed"});
});

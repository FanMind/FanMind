import { test, expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { installChatAdminNetworkBoundary } from "./network-boundary.mjs";

const APP="https://staging.fanmind.ch";
const SUPABASE=process.env.NEXT_PUBLIC_SUPABASE_URL!;
const id=(key:string)=>process.env[`FANMIND_CHAT_ADMIN_${key}`]!;
type Session={token:string;anon:string};
async function direct(request:APIRequestContext,url:string,options:Parameters<APIRequestContext["fetch"]>[1]={}) {
  if(![APP,SUPABASE].includes(new URL(url).origin))throw Error("chat_admin_manual_direct_origin");
  return request.fetch(url,{...options,maxRedirects:0,timeout:45_000});
}

async function boundary(context:BrowserContext) {
  const violations=await installChatAdminNetworkBoundary(context,{appOrigin:APP,supabaseOrigin:SUPABASE});
  return ()=>expect(violations()).toBe(0);
}

async function login(page:Page,remember:(session:Session)=>void,secondary=false):Promise<Session> {
  const prefix=secondary?"FANMIND_STAGING_E2E_SECONDARY":"FANMIND_STAGING_E2E";
  await page.goto("/login");
  await page.getByRole("textbox",{name:"E-Mail",exact:true}).fill(process.env[`${prefix}_EMAIL`]!);
  await page.locator('input[name="password"]').fill(process.env[`${prefix}_PASSWORD`]!);
  const pending=page.waitForResponse(response=>{
    const url=new URL(response.url());return url.origin===SUPABASE&&url.pathname==="/auth/v1/token"&&url.searchParams.get("grant_type")==="password";
  });
  await page.getByRole("button",{name:/Einloggen/u}).click();
  const response=await pending;expect(response.ok()).toBe(true);
  const payload=await response.json();
  const session={token:payload.access_token as string,anon:response.request().headers().apikey};
  // Retain a newly created Auth session before any assertion/navigation can fail.
  if(typeof session.token==="string"&&session.token)remember(session);
  expect(payload.user?.id).toBe(id(secondary?"FOREIGN_OWNER_ID":"OWNER_ID"));
  expect(typeof payload.access_token).toBe("string");
  await expect(page).toHaveURL(/\/dashboard(?:\?|$)/u);
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
  await page.getByLabel("Fan/Chat-Bezeichnung (optional)").fill("Synthetischer Fan");
  await page.getByLabel("Von OnlyFans kopierte Fan-Nachricht").fill("Hallo, ich wünsche dir einen schönen entspannten Nachmittag. Wie war dein Tag?");
  const pending=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/chatadmin/reply-suggestions"&&response.request().method()==="POST");
  await page.getByRole("button",{name:"Antwortvorschläge erzeugen",exact:true}).click();
  const response=await pending;expect(response.status()).toBe(200);
  const payload=await response.json();expect(payload.character_id).toBe(characterId);expect(payload.character_revision).toBe(revision);
  expect(Array.isArray(payload.replies)&&payload.replies.length===3&&payload.replies.every((v:unknown)=>typeof v==="string"&&v.trim().length>0)).toBe(true);
  const copies=page.getByRole("button",{name:"Antwort kopieren",exact:true});await expect(copies).toHaveCount(3);
  const selected=await copies.first().locator("..").locator("p").innerText();
  await copies.first().click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe(selected);
  await expect(page.getByRole("status")).toContainText(/manuell|selbst/u);
}

test("protected synthetic ChatAdmin application flow and authority negatives",async({browser,page})=>{
  const ownerBoundary=await boundary(page.context());
  const secondaryContext=await browser.newContext({baseURL:APP,serviceWorkers:"block"});
  const anonymousContext=await browser.newContext({baseURL:APP,serviceWorkers:"block"});
  const secondaryPage=await secondaryContext.newPage();const secondaryBoundary=await boundary(secondaryContext);
  let ownerSession:Session|undefined,secondarySession:Session|undefined;
  try {
    const version=await direct(page.request,`${APP}/api/version`);expect(version.ok()).toBe(true);
    const state=await version.json();expect(state.runtimeEnvironment).toBe("staging");expect(state.releaseCommit).toBe(process.env.GITHUB_SHA);
    const anonymous=await direct(anonymousContext.request,`${APP}/api/chatadmin/characters`);expect(anonymous.status()).toBe(401);
    ownerSession=await login(page,session=>{ownerSession=session;});await page.goto("/chatadmin");await expect(page.getByRole("heading",{name:"ChatAdmin",exact:true})).toBeVisible();
    const a=page.locator("article").filter({has:page.getByRole("heading",{name:"FM Synthetic Character A",exact:true})});
    const b=page.locator("article").filter({has:page.getByRole("heading",{name:"FM Synthetic Character B",exact:true})});
    await a.getByRole("button",{name:"Auswählen",exact:true}).click();
    await generate(page,id("CHARACTER_A_ID"),1);
    await b.getByRole("button",{name:"Auswählen",exact:true}).click();
    await expect(page.getByRole("button",{name:"Antwort kopieren",exact:true})).toHaveCount(0);
    await expect(page.getByLabel("Von OnlyFans kopierte Fan-Nachricht")).toHaveValue("");
    await expect(page.getByLabel("Fan/Chat-Bezeichnung (optional)")).toHaveValue("");
    await generate(page,id("CHARACTER_B_ID"),1);
    const stale=await api(page,"/api/chatadmin/reply-suggestions",{character_id:id("CHARACTER_A_ID"),character_revision:999,incoming_message:"Synthetisch"});expect(stale.status()).toBe(409);
    const foreign=await api(page,"/api/chatadmin/reply-suggestions",{character_id:id("CONVERSATION_B_ID"),character_revision:1,incoming_message:"Synthetisch"});expect(foreign.status()).toBe(403);
    await b.getByRole("button",{name:"Deaktivieren",exact:true}).click();
    await expect(page.getByRole("button",{name:"Antwortvorschläge erzeugen",exact:true})).toBeDisabled();
    await expect(page.getByRole("button",{name:"Antwort kopieren",exact:true})).toHaveCount(0);
    const inactive=await api(page,"/api/chatadmin/reply-suggestions",{character_id:id("CHARACTER_B_ID"),character_revision:2,incoming_message:"Synthetisch"});expect(inactive.status()).toBe(400);
    const untrusted=await direct(page.request,`${APP}/api/chatadmin/characters`,{method:"POST",headers:{Origin:"https://example.invalid"},data:{}});expect(untrusted.status()).toBe(403);
    secondarySession=await login(secondaryPage,session=>{secondarySession=session;},true);
    const denied=await direct(secondaryPage.request,`${APP}/api/chatadmin/characters`);expect(denied.status()).toBe(403);
    const deniedReply=await api(secondaryPage,"/api/chatadmin/reply-suggestions",{character_id:id("CHARACTER_A_ID"),character_revision:1,incoming_message:"Synthetisch"});expect(deniedReply.status()).toBe(403);
    const directRead=await direct(secondaryPage.request,`${SUPABASE}/rest/v1/chat_characters?select=id`,{headers:{apikey:secondarySession.anon,Authorization:`Bearer ${secondarySession.token}`}});expect(directRead.ok()).toBe(true);expect(await directRead.json()).toEqual([]);
    ownerBoundary();secondaryBoundary();
  } finally {
    const cleanup=[];if(ownerSession)cleanup.push(logout(page.context(),ownerSession));if(secondarySession)cleanup.push(logout(secondaryContext,secondarySession));
    const results=await Promise.allSettled(cleanup);await secondaryContext.close();await anonymousContext.close();
    if(results.some(result=>result.status==="rejected"))throw Error("chat_admin_manual_session_cleanup");
  }
  console.log("CHAT_ADMIN_MANUAL_BROWSER=PASS");
});

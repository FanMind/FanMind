import assert from "node:assert/strict";
import {createServer} from "node:http";
import test from "node:test";
import {chromium} from "@playwright/test";
import {installChatAdminNetworkBoundary} from "../e2e-chatadmin-staging/network-boundary.mjs";

async function listen(server) {
  await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(0,"127.0.0.1",resolve);});
  return `http://127.0.0.1:${server.address().port}`;
}
async function close(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}

test("browser boundary rejects redirects before any foreign request while preserving session cookies and request bodies",async()=>{
  let foreignHits=0,postedBody="",apiKey="";
  const foreign=createServer((_request,response)=>{foreignHits++;response.end("foreign target must never receive a request");});
  const foreignOrigin=await listen(foreign);
  const app=createServer(async(request,response)=>{
    if(request.url==="/redirect") {response.writeHead(302,{Location:`${foreignOrigin}/sentinel`});response.end();return;}
    if(request.url==="/api/auth/session") {
      for await(const chunk of request)postedBody+=chunk.toString();
      apiKey=request.headers.apikey;
      response.writeHead(200,{"Content-Type":"application/json","Set-Cookie":"synthetic_session=kept; HttpOnly; Path=/; SameSite=Lax"});
      response.end('{"ok":true}');return;
    }
    response.writeHead(200,{"Content-Type":"text/html"});response.end("<!doctype html><title>Synthetic local boundary</title>");
  });
  const appOrigin=await listen(app);
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHATADMIN_TEST_BROWSER||undefined});
  try {
    const context=await browser.newContext({serviceWorkers:"block"});
    const violations=await installChatAdminNetworkBoundary(context,{appOrigin,supabaseOrigin:appOrigin});
    const page=await context.newPage();await page.goto(appOrigin);
    const accepted=await page.evaluate(async()=>{
      const response=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json",apikey:"synthetic-public-key"},body:JSON.stringify({synthetic:true})});
      return response.json();
    });
    assert.equal(accepted.ok,true);assert.equal(postedBody,'{"synthetic":true}');assert.equal(apiKey,"synthetic-public-key");
    assert.equal((await context.cookies(appOrigin)).find(cookie=>cookie.name==="synthetic_session")?.value,"kept");
    await page.goto(`${appOrigin}/redirect`).catch(()=>{});
    assert.equal(foreignHits,0,"redirected hop must never escape interception");
    assert.equal(violations(),1,"rejected redirect must invalidate acceptance");
  } finally {await browser.close();await close(app);await close(foreign);}
});

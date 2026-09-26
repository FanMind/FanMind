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
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));

test("browser boundary drains a delayed redirect without a foreign hop while preserving session cookies and request bodies",{timeout:15_000},async()=>{
  let foreignHits=0,postedBody="",apiKey="";
  const redirectStarted=deferred();let redirectResponse;
  const foreign=createServer((_request,response)=>{foreignHits++;response.end("foreign target must never receive a request");});
  let foreignOrigin;
  const app=createServer(async(request,response)=>{
    if(request.url==="/redirect") {redirectResponse=response;redirectStarted.resolve();return;}
    if(request.url==="/api/auth/session") {
      for await(const chunk of request)postedBody+=chunk.toString();
      apiKey=request.headers.apikey;
      response.writeHead(200,{"Content-Type":"application/json","Set-Cookie":"synthetic_session=kept; HttpOnly; Path=/; SameSite=Lax"});
      response.end('{"ok":true}');return;
    }
    response.writeHead(200,{"Content-Type":"text/html"});response.end("<!doctype html><title>Synthetic local boundary</title>");
  });
  let browser;
  try {
    foreignOrigin=await listen(foreign);
    const appOrigin=await listen(app);
    browser=await chromium.launch({headless:true,executablePath:process.env.CHATADMIN_TEST_BROWSER||undefined});
    const context=await browser.newContext({serviceWorkers:"block"});
    const violations=await installChatAdminNetworkBoundary(context,{appOrigin,supabaseOrigin:appOrigin});
    const page=await context.newPage();await page.goto(appOrigin);
    const accepted=await page.evaluate(async()=>{
      const response=await fetch("/api/auth/session",{method:"POST",headers:{"Content-Type":"application/json",apikey:"synthetic-public-key"},body:JSON.stringify({synthetic:true})});
      return response.json();
    });
    assert.equal(accepted.ok,true);assert.equal(postedBody,'{"synthetic":true}');assert.equal(apiKey,"synthetic-public-key");
    assert.equal((await context.cookies(appOrigin)).find(cookie=>cookie.name==="synthetic_session")?.value,"kept");
    await page.evaluate(()=>{void fetch("/redirect").catch(()=>{});});await redirectStarted.promise;
    assert.equal(violations(),0,"the redirect is still awaiting its response");
    const stopping=violations.stop();
    redirectResponse.writeHead(302,{Location:`${foreignOrigin}/sentinel`});redirectResponse.end();
    await stopping;
    assert.equal(foreignHits,0,"redirected hop must never escape interception");
    assert.equal(violations(),1,"rejected redirect must invalidate acceptance");
    await context.close();await nextTurn();
    assert.equal(violations(),1,"closing a drained context must preserve the genuine redirect failure");
  } finally {
    const cleanup=await Promise.allSettled([browser?.close(),close(app),close(foreign)]);
    const failures=cleanup.filter(result=>result.status==="rejected").map(result=>result.reason);
    if(failures.length)throw new AggregateError(failures,"Browser boundary fixture cleanup failed");
  }
});

test("browser boundary stops new allowed requests and drains a delayed success before context cleanup",{timeout:15_000},async()=>{
  const slowStarted=deferred();let slowResponse,lateHits=0;
  const app=createServer((request,response)=>{
    if(request.url==="/slow"){slowResponse=response;slowStarted.resolve();return;}
    if(request.url==="/late")lateHits++;
    response.writeHead(200,{"Content-Type":"text/html"});response.end("<!doctype html><h1>Synthetic local dashboard</h1>");
  });
  let browser;
  try {
    const appOrigin=await listen(app);
    browser=await chromium.launch({headless:true,executablePath:process.env.CHATADMIN_TEST_BROWSER||undefined});
    const context=await browser.newContext({serviceWorkers:"block"});
    const reasons=[];
    const violations=await installChatAdminNetworkBoundary(context,{appOrigin,supabaseOrigin:appOrigin,mode:"probe",onViolation:reason=>reasons.push(reason)});
    const page=await context.newPage();await page.goto(appOrigin);
    await page.evaluate(()=>{void fetch("/slow").catch(()=>{});});await slowStarted.promise;
    assert.equal(violations(),0);
    let stopped=false;
    const stopping=violations.stop().then(()=>{stopped=true;});
    await nextTurn();
    assert.equal(stopped,false,"stop must await the already forwarded request");
    const late=await page.evaluate(()=>fetch("/late").then(()=>"forwarded",()=>"blocked"));
    assert.equal(late,"blocked","new allowed reads must be aborted while quiescing");
    assert.equal(lateHits,0,"quiescing must never forward a new request");
    slowResponse.end("completed synthetic read");await stopping;
    assert.equal(violations(),0);assert.deepEqual(reasons,[]);
    await context.close();await nextTurn();
    assert.equal(violations(),0,"intentional cleanup after draining must not invent a transport failure");
    assert.deepEqual(reasons,[]);
  } finally {
    const cleanup=await Promise.allSettled([browser?.close(),close(app)]);
    const failures=cleanup.filter(result=>result.status==="rejected").map(result=>result.reason);
    if(failures.length)throw new AggregateError(failures,"Browser boundary fixture cleanup failed");
  }
});

test("browser boundary retains a genuine delayed transport failure while draining",{timeout:15_000},async()=>{
  const slowStarted=deferred();let slowResponse;
  const app=createServer((request,response)=>{
    if(request.url==="/slow"){slowResponse=response;slowStarted.resolve();return;}
    response.writeHead(200,{"Content-Type":"text/html"});response.end("<!doctype html><h1>Synthetic local dashboard</h1>");
  });
  let browser;
  try {
    const appOrigin=await listen(app);
    browser=await chromium.launch({headless:true,executablePath:process.env.CHATADMIN_TEST_BROWSER||undefined});
    const context=await browser.newContext({serviceWorkers:"block"});
    const reasons=[];
    const violations=await installChatAdminNetworkBoundary(context,{appOrigin,supabaseOrigin:appOrigin,mode:"probe",onViolation:reason=>reasons.push(reason)});
    const page=await context.newPage();await page.goto(appOrigin);
    await page.evaluate(()=>{void fetch("/slow").catch(()=>{});});await slowStarted.promise;
    assert.equal(violations(),0);
    const stopping=violations.stop();slowResponse.destroy();await stopping;
    assert.equal(violations(),1,"a real socket failure after stop begins must still fail acceptance");
    assert.deepEqual(reasons,["transport"]);
    await context.close();await nextTurn();
    assert.equal(violations(),1);assert.deepEqual(reasons,["transport"]);
  } finally {
    const cleanup=await Promise.allSettled([browser?.close(),close(app)]);
    const failures=cleanup.filter(result=>result.status==="rejected").map(result=>result.reason);
    if(failures.length)throw new AggregateError(failures,"Browser boundary fixture cleanup failed");
  }
});

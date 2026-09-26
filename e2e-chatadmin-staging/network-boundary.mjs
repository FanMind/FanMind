/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{appOrigin:string,supabaseOrigin:string}} targets
 */
export async function installChatAdminNetworkBoundary(context,{appOrigin,supabaseOrigin}) {
  let violations=0;
  await context.route("**/*",async route=>{
    const url=new URL(route.request().url()), method=route.request().method();
    if(url.origin==="https://challenges.cloudflare.com"&&method==="GET"&&url.pathname==="/turnstile/v0/api.js"){await route.abort();return;}
    if(![appOrigin,supabaseOrigin].includes(url.origin)){violations++;await route.abort();return;}
    if(!["GET","HEAD","OPTIONS"].includes(method)) {
      const allowed=(url.origin===supabaseOrigin&&method==="POST"&&["/auth/v1/token","/auth/v1/logout"].includes(url.pathname)) ||
        (url.origin===appOrigin&&((method==="POST"&&["/api/auth/session","/api/chatadmin/reply-suggestions"].includes(url.pathname)) ||
        (method==="PATCH"&&url.pathname==="/api/chatadmin/characters")));
      if(!allowed){violations++;await route.abort();return;}
    }
    // Chromium automatically continues redirected hops without invoking context.route.
    // Fetch one response only, then preserve its body/headers (including Set-Cookie).
    let response;
    try {
      response=await route.fetch({maxRedirects:0,maxRetries:0,timeout:45_000});
      if(response.status()>=300&&response.status()<400){violations++;await route.abort();return;}
      await route.fulfill({response});
    } catch {
      violations++;
      await route.abort().catch(()=>{});
    } finally {await response?.dispose();}
  });
  return ()=>violations;
}

/**
 * @param {import('@playwright/test').BrowserContext} context
 * @param {{appOrigin:string,supabaseOrigin:string,mode?:'probe'|'acceptance',onViolation?:(reason:string)=>void}} targets
 */
export async function installChatAdminNetworkBoundary(context,{appOrigin,supabaseOrigin,mode='acceptance',onViolation=()=>{}}) {
  let violations=0;
  const violation=reason=>{violations++;onViolation(reason);};
  await context.route("**/*",async route=>{
    const url=new URL(route.request().url()), method=route.request().method();
    if(url.origin==="https://challenges.cloudflare.com"&&method==="GET"&&url.pathname==="/turnstile/v0/api.js"){await route.abort();return;}
    if(![appOrigin,supabaseOrigin].includes(url.origin)){violation('origin');await route.abort();return;}
    if(!chatAdminRequestAllowed(url,method,{appOrigin,supabaseOrigin,mode})){violation('write');await route.abort();return;}
    // Chromium automatically continues redirected hops without invoking context.route.
    // Fetch one response only, then preserve its body/headers (including Set-Cookie).
    let response;
    try {
      response=await route.fetch({maxRedirects:0,maxRetries:0,timeout:45_000});
      if(response.status()>=300&&response.status()<400){violation('redirect');await route.abort();return;}
      await route.fulfill({response});
    } catch {
      violation('transport');
      await route.abort().catch(()=>{});
    } finally {await response?.dispose();}
  });
  return ()=>violations;
}
export function chatAdminRequestAllowed(url,method,{appOrigin,supabaseOrigin,mode='acceptance'}) {
  if(![appOrigin,supabaseOrigin].includes(url.origin))return false;
  if(["GET","HEAD","OPTIONS"].includes(method))return true;
  return (url.origin===supabaseOrigin&&method==="POST"&&["/auth/v1/token","/auth/v1/logout"].includes(url.pathname)) ||
    (url.origin===appOrigin&&((method==="POST"&&url.pathname==="/api/auth/session") ||
    (mode==='acceptance'&&((method==="POST"&&url.pathname==="/api/chatadmin/reply-suggestions")||(method==="PATCH"&&url.pathname==="/api/chatadmin/characters")))));
}

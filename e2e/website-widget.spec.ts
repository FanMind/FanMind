import {expect,test} from '@playwright/test';

test('embedded widget keeps its Shadow DOM closed and requires consent before real keyboard submission',async({page})=>{
 const installation='655d1bf6-3717-4933-9f1f-5d23cea154ac';
 let sessions=0,messages=0;const submitted:Array<{clientMessageId:string;message:string}>=[];
 await page.route('**/api/website-chat/**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  expect(request.headers()['cookie']).toBeUndefined();
  expect(request.headers()['x-fanmind-installation']).toBe(installation);
  if(path.endsWith('/session')){
   sessions++;expect(request.postDataJSON().consent).toEqual({granted:true,version:'staging-test-v1'});
   await route.fulfill({status:201,json:{ok:true,session:{token:'a'.repeat(43)}}});
  }else if(path.endsWith('/message')){
   messages++;submitted.push(request.postDataJSON());expect(request.headers()['authorization']).toBe('Bearer '+'a'.repeat(43));
   await route.fulfill({status:202,json:{ok:true,accepted:true,duplicate:false}});
  }else await route.fulfill({status:404,json:{ok:false,code:'AI_NOT_ENABLED'}});
 });
 await page.goto('/support');
 await page.evaluate(({id})=>{const script=document.createElement('script');script.src='/website-chat/widget.js';script.dataset.installationId=id;script.dataset.consentVersion='staging-test-v1';document.body.appendChild(script);},{id:installation});
 await page.locator('[data-fanmind-widget]').waitFor();
 expect(await page.locator('[data-fanmind-widget]').evaluate(el=>el.shadowRoot===null)).toBe(true);
 expect(sessions).toBe(0);
 const size=page.viewportSize()!;await page.mouse.click(size.width-65,size.height-40);
 await page.keyboard.type('Synthetic embedded widget question');
 await page.keyboard.press('Tab');await page.keyboard.press('Tab');await page.keyboard.press('Enter');
 // A subsequent keyboard operation flushes the click handler before readback.
 await page.keyboard.press('Shift+Tab');expect(sessions).toBe(0);expect(messages).toBe(0);
 await page.keyboard.press('Space');await page.keyboard.press('Tab');
 const response=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/website-chat/message');
 await page.keyboard.press('Enter');expect((await response).status()).toBe(202);
 expect(sessions).toBe(1);expect(messages).toBe(1);
 expect(submitted[0].message).toBe('Synthetic embedded widget question');
 expect(submitted[0].clientMessageId).toMatch(/^[a-f0-9-]{36}$/);
});

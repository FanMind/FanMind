import {expect,test} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {supportClientBundle} from './support-client-bundle.mts';

test('dashboard Help uses real shell CSS, fits viewport, scrolls and retries disabled diagnostics without blocking chat',async({page},testInfo)=>{
 let diagnostics=0;
 const turns=Array.from({length:15},(_,i)=>({request_id:`synthetic-${i}`,question:`Synthetische Frage ${i} ${'lang '.repeat(30)}`,answer:`Antwort ${i} ${'Text '.repeat(40)}`,unanswered:false}));
 await page.route('**/api/support/diagnostics',route=>{diagnostics++;return route.fulfill(diagnostics===1?{status:404,json:{error:'not_available'}}:{json:{connections:[]}});});
 await page.route('**/api/support/conversation',async route=>{
  if(route.request().method()==='POST'){const body=route.request().postDataJSON();turns.push({request_id:body.requestId,question:body.question,answer:'Synthetische gespeicherte Antwort',unanswered:false});}
  await route.fulfill({json:{scope:'synthetic-scope',turns}});
 });
 await page.goto('/support');
 // Reuse the actual production reset, theme tokens and CSS, with no fixture style rescue.
 const css=readFileSync('src/app/globals.css','utf8').replace(/^@import.*$/gm,'')+'\n'+readFileSync('src/app/workspace-help.css','utf8');
 await page.setContent(`<meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main><h1>Dashboard</h1><div id="support-fixture"></div></main>`);
 await page.evaluate(()=>{(window as Window&{supportFixture?:string}).supportFixture='help';});
 await page.addScriptTag({content:await supportClientBundle()});
 await page.getByRole('button',{name:'Hilfe',exact:true}).click();
 const panel=page.locator('#fanmind-inapp-help-panel');
 await expect(page.getByRole('button',{name:'Hilfe minimieren'})).toBeFocused();
 await expect(page.getByRole('textbox',{name:'Deine Frage'})).toBeEnabled();
 const geometry=await panel.evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {top:r.top,left:r.left,right:r.right,bottom:r.bottom,width:r.width,height:r.height,viewport:{width:innerWidth,height:innerHeight},background:s.backgroundColor,maxHeight:s.maxHeight};});
 expect(geometry.top).toBeGreaterThanOrEqual(0);expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(geometry.viewport.width);expect(geometry.bottom).toBeLessThan(geometry.viewport.height);expect(geometry.maxHeight).not.toBe('none');expect(geometry.background).not.toBe('rgb(255, 255, 255)');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const log=page.getByRole('log',{name:'Gesprächsverlauf'});
 expect(await log.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await log.focus();await log.press('End');await expect.poll(()=>log.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
 await page.getByRole('textbox',{name:'Deine Frage'}).fill('Neutrale Testfrage');
 await page.getByRole('button',{name:'Senden',exact:true}).click();
 await expect(page.getByText('Synthetische gespeicherte Antwort')).toBeAttached();
 await page.getByText('Kanäle und Verbindungsstatus',{exact:true}).click();
 await expect(page.getByText('Die Verbindungsprüfung ist für diese Umgebung noch nicht aktiviert.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Kontoprüfung erneut versuchen'}).click();
 await expect(page.getByText('Keine unterstützten Verbindungen gefunden.')).toBeVisible();expect(diagnostics).toBe(2);
 const composer=page.locator('.fm-support-composer');
 const position=await composer.evaluate(el=>({top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom,viewport:innerHeight}));
 expect(position.top).toBeGreaterThanOrEqual(0);expect(position.bottom).toBeLessThan(position.viewport);
 await expect(page.getByRole('textbox',{name:'Deine Frage'})).toBeInViewport();
 await expect(page.getByRole('button',{name:'Senden',exact:true})).toBeInViewport();
 await page.screenshot({path:testInfo.outputPath('dashboard-help.png')});
 await page.getByRole('button',{name:'Hilfe minimieren'}).click();await expect(panel).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Hilfe',exact:true})).toBeFocused();
 await page.getByRole('button',{name:'Hilfe',exact:true}).click();await expect(page.getByText('Synthetische gespeicherte Antwort')).toBeAttached();
 await page.getByRole('button',{name:'Hilfe minimieren'}).press('Escape');await expect(panel).toHaveCount(0);
});

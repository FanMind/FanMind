import {expect,test} from "@playwright/test";
test.beforeEach(async({context})=>{
 await context.addCookies([{name:"fanmind_marketing_consent",value:"denied",url:"http://127.0.0.1:3100",sameSite:"Lax"}]);
});
test("visitor chats inline without login or navigation; consent, history, resize and minimize work",async({page})=>{
 let calls=0;const bodies:Array<{history:unknown[];consent:boolean}>=[];
 await page.route("**/api/public-support",async route=>{
  calls++;bodies.push(route.request().postDataJSON());expect(route.request().headers()["cookie"]).toBeUndefined();expect(route.request().headers()["authorization"]).toBeUndefined();
  await route.fulfill({json:{reply:calls===1?"FanMind unterstützt manuelle Antworten.":"Ja, der Mensch sendet selbst."}});
 });
 await page.goto("/");const url=page.url();
 await page.getByRole("button",{name:"Hilfe & Support",exact:true}).click();
 const panel=page.getByRole("dialog",{name:"FanMind Support"});await expect(panel).toBeVisible();
 const question=panel.getByRole("textbox",{name:"Deine Frage"});await expect(question).toBeFocused();await question.fill("Was kann FanMind?");
 const send=panel.getByRole("button",{name:"Frage senden"});await expect(send).toBeDisabled();expect(calls).toBe(0);
 await panel.getByRole("checkbox").check();await send.click();await expect(panel.getByText("FanMind unterstützt manuelle Antworten.",{exact:true})).toBeVisible();
 await question.fill("Sendet die KI automatisch?");await question.press("Enter");await expect(panel.getByText("Ja, der Mensch sendet selbst.",{exact:true})).toBeVisible();
 expect(calls).toBe(2);expect(bodies[1].history).toHaveLength(2);expect(bodies[1].consent).toBe(true);expect(page.url()).toBe(url);
 await panel.getByRole("button",{name:"Chatgröße ändern"}).click();
 const box=await panel.boundingBox();expect(box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);expect(box!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
 await panel.getByRole("button",{name:"Chat minimieren"}).click();await expect(panel).toHaveCount(0);
 await page.getByRole("button",{name:"Hilfe & Support",exact:true}).click();await expect(panel.getByText("Was kann FanMind?",{exact:true})).toBeVisible();
 await question.press("Escape");await expect(page.getByRole("button",{name:"Hilfe & Support",exact:true})).toBeFocused();expect(page.url()).toBe(url);
});
test("public chat keeps failed input, does not retry automatically and clears a new conversation",async({page})=>{
 let calls=0;await page.route("**/api/public-support",async route=>{calls++;await route.fulfill({status:503,json:{error:"public_support_unavailable"}});});
 await page.goto("/");await page.getByRole("button",{name:"Hilfe & Support",exact:true}).click();
 const panel=page.getByRole("dialog",{name:"FanMind Support"}),question=panel.getByRole("textbox",{name:"Deine Frage"});
 await panel.getByRole("checkbox").check();await question.fill("Meine Frage");await panel.getByRole("button",{name:"Frage senden"}).click();
 await expect(panel.getByRole("alert")).toContainText("nicht erreichbar");await expect(question).toHaveValue("Meine Frage");expect(calls).toBe(1);
 await panel.getByRole("button",{name:"Neues Gespräch"}).click();await expect(question).toHaveValue("");await expect(panel.getByRole("checkbox")).not.toBeChecked();await expect(panel.getByRole("alert")).toHaveCount(0);
});
test("English visitors can open the public chat in place",async({page})=>{
 await page.goto("/?lang=en");const url=page.url();await page.getByRole("button",{name:"Help & Support",exact:true}).click();await expect(page.getByRole("textbox",{name:"Your question"})).toBeVisible();expect(page.url()).toBe(url);
});

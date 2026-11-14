import "server-only";
import {createHash,createHmac,timingSafeEqual} from "node:crypto";
import {OPERATOR_USER,OPERATOR_WORKSPACE} from "./stagingOperatorIdentity.mjs";
import {operatorSessionEnabled} from "./stagingOperatorSession.mjs";
import {getChatCharacter,getChatFan,getFanConversation,listRecentChatMessages,listChatCharacters,listChatFans,requireChatAdminCapability,updateChatCharacter,type ChatCharacter} from "./chatAdmin";
import {supportCustomer,readSupportConversation,type SupportTurn} from "./supportContinuityServer";
import {supportCentreDatabase} from "./supportCentreServer";
import {creatorStyleIntent,encodeStyleAudit,decodeStyleAudit,type StyleAudit} from "./supportCreatorPolicy";
import {isSupportUuid} from "./supportCentrePolicy";
import {resolveChatAdminRequestedOffer,assertChatAdminReplyPrices} from "./chatAdminSalesPlaybook.mjs";
import {loadCharacterMedia} from "./chatAdminMedia";
import {buildChatAdminCharacterContext,assertChatAdminReplySemantics} from "./chatAdminPolicy.mjs";
import {buildChatAdminModelRequest,getChatAdminModelProfile,CHAT_ADMIN_MODEL_TIMEOUT_MS} from "./chatAdminModelPolicy.mjs";
import {recordAiUsageEvent} from "./aiUsage";
import {consumeSharedRateLimit} from "./sharedRateLimit";

/** No Production activation switch: this pilot is hard-bound to the existing synthetic Staging Operator. */
export async function supportCreatorIdentity(){
 if(!operatorSessionEnabled(process.env))throw Error("creator_support_not_enabled");
 const identity=await supportCustomer();if(!identity)throw Error("unauthorized");
 if(identity.actor!==OPERATOR_USER||identity.workspace!==OPERATOR_WORKSPACE)throw Error("creator_support_not_enabled");
 const context=await requireChatAdminCapability();
 if(context.user.id!==identity.actor||context.workspace.id!==identity.workspace||context.workspace.role.toLowerCase()!=="owner")throw Error("forbidden");
 return identity;
}
export async function creatorSupportChoices(characterId?:string){
 const i=await supportCreatorIdentity();
 if(characterId){if(!isSupportUuid(characterId))throw Error("invalid_character");await getChatCharacter(i.workspace,characterId);return {scope:i.scope,fans:(await listChatFans(i.workspace,characterId,0,100)).map(f=>({id:f.id,name:f.display_name}))};}
 return {scope:i.scope,characters:(await listChatCharacters(i.workspace)).slice(0,100).map(c=>({id:c.id,name:c.display_name,revision:c.revision}))};
}
const completionId=(id:string)=>{const h=createHash("sha256").update(`support-style-complete:${id}`).digest("hex");return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;};
function auditQuestion(i:Awaited<ReturnType<typeof supportCreatorIdentity>>,a:StyleAudit,requestId:string){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)throw Error("audit_signing_unavailable");
 const raw=encodeStyleAudit(a),proof=createHmac("sha256",key).update(`support-creator-audit:v1:${i.actor}:${i.workspace}:${requestId}:${raw}`).digest("hex");
 const signed=`${raw}\nProof:${proof}`;if(signed.length>1000)throw Error("style_audit_too_large");return signed;
}
function trustedAudit(i:Awaited<ReturnType<typeof supportCreatorIdentity>>,question:string,requestId:string){
 const a=decodeStyleAudit(question);if(!a)return null;
 const expected=auditQuestion(i,a,requestId);return expected.length===question.length&&timingSafeEqual(Buffer.from(expected),Buffer.from(question))?a:null;
}
function completionQuestion(i:Awaited<ReturnType<typeof supportCreatorIdentity>>,id:string,a:StyleAudit){
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();if(!key)throw Error("audit_signing_unavailable");
 return `Stiländerung nachgeprüft: ${id}\nProof:${createHmac("sha256",key).update(`support-creator-complete:v1:${i.actor}:${i.workspace}:${id}:${encodeStyleAudit(a)}`).digest("hex")}`;
}
async function record(i:Awaited<ReturnType<typeof supportCreatorIdentity>>,id:string,question:string,answer:string){
 await supportCentreDatabase("rpc/support_chat_send",{p_actor:i.actor,p_workspace:i.workspace,p_request:id,p_question:question,p_answer:answer.slice(0,2000),p_context:"support",p_unanswered:false});
}
async function fresh(i:Awaited<ReturnType<typeof supportCreatorIdentity>>,character:string){const current=await supportCreatorIdentity();if(current.scope!==i.scope)throw Error("identity_changed");return getChatCharacter(i.workspace,character);}
function exactCharacter(c:ChatCharacter,workspace:string,id:string){if(c.workspace_id!==workspace||c.id!==id||c.status!=="active")throw Error("character_forbidden");}

/** Write-ahead audit + existing user-JWT/RLS CAS update, followed by independent readback.
 * This is not an atomic cross-service transaction. Uncertain states are explicit and
 * can only be reconciled with the same idempotency key; never report a speculative success.
 */
async function styleChange(i:Awaited<ReturnType<typeof supportCreatorIdentity>>,requestId:string,c:ChatCharacter,a:StyleAudit,turns:SupportTurn[],signal?:AbortSignal){
 exactCharacter(c,i.workspace,a.character);
 const audit=auditQuestion(i,a,requestId),existing=turns.find(t=>t.request_id===requestId);
 if(existing&&existing.question!==audit)throw Error("request_conflict");
 const done=turns.find(t=>t.request_id===completionId(requestId)&&t.question===completionQuestion(i,requestId,a));
 if(done)return {answer:done.answer,changed:false,undo:requestId};
 if(signal?.aborted)throw Error("cancelled");
 if(!existing)await record(i,requestId,audit,"Änderung angefordert; Speicherung und Nachprüfung noch nicht bestätigt. Keine erfolgreiche Änderung aus diesem Eintrag ableiten.");
 let before=await fresh(i,a.character);exactCharacter(before,i.workspace,a.character);
 if(before.revision===a.revision&&before[a.field]===a.before){
  if(signal?.aborted)throw Error("cancelled");
  await updateChatCharacter(i.workspace,a.character,a.revision,{[a.field]:a.after});
 }else if(!existing||before.revision!==a.revision+1||before[a.field]!==a.after)throw Error("revision_conflict");
 before=await fresh(i,a.character);exactCharacter(before,i.workspace,a.character);
 if(before.revision!==a.revision+1||before[a.field]!==a.after)throw Error("readback_not_verified");
 const answer=`${a.field==="writing_style"?"Schreibstil":"Satzstil"} gespeichert und erneut gelesen (Revision ${before.revision}). Vorher: ${a.before}\nJetzt: ${a.after}\nDie Wirkung auf KI-Antworten ist damit noch nicht bewiesen. Verwende den synthetischen Vergleichstest. Rückgängig ist möglich, solange der Supportnachweis vorhanden und diese Revision aktuell ist.`;
 await record(i,completionId(requestId),completionQuestion(i,requestId,a),answer);
 return {answer,changed:true,undo:requestId};
}
export async function runCreatorSupport(input:{scope:string;requestId:string;question:string;characterId:string;fanId?:string;readConsent:boolean;manageConsent:boolean;undo?:string;test?:string;aiConsent?:boolean},signal?:AbortSignal){
 if(signal?.aborted)throw Error("cancelled");
 const i=await supportCreatorIdentity();
 if(input.scope!==i.scope||!isSupportUuid(input.requestId)||!isSupportUuid(input.characterId)||input.fanId!==undefined&&!isSupportUuid(input.fanId)||input.readConsent!==true||typeof input.manageConsent!=="boolean"||!input.question.trim()||input.question.length>1000)throw Error("invalid_request");
 const c=await getChatCharacter(i.workspace,input.characterId);exactCharacter(c,i.workspace,input.characterId);
 const turns=await readSupportConversation(i);
 const existing=turns.find(t=>t.request_id===input.requestId);
 if(input.test){
  if(!isSupportUuid(input.test)||input.aiConsent!==true)throw Error("test_consent_required");
  if(existing){if(existing.question!==`Synthetischer Stiltest: ${input.test}`)throw Error("request_conflict");return {answer:existing.answer,changed:false};}
  const original=turns.find(t=>t.request_id===input.test),a=original&&trustedAudit(i,original.question,original.request_id);
  if(!a||a.character!==c.id||c.revision!==a.revision+1||c[a.field]!==a.after||!turns.some(t=>t.request_id===completionId(input.test!)&&t.question===completionQuestion(i,input.test!,a)))throw Error("test_revision_conflict");
  const before=await syntheticStyleReply(i,{...c,[a.field]:a.before},signal);
  const after=await syntheticStyleReply(i,c,signal);
  const checked=await fresh(i,c.id);if(checked.revision!==c.revision)throw Error("test_revision_conflict");
  const answer=`Synthetische Testfrage: „Hey, wie geht es dir?“\nVorher: ${before}\nJetzt: ${after}\nBeide Antworten wurden mit dem bestehenden Character-Modell erzeugt; keine Fan-Nachrichten verwendet oder versendet. Der Vergleich zeigt Beispiele, keine Garantie für jede spätere Antwort. Bitte bewerte Ton und Länge selbst.`;
  await record(i,input.requestId,`Synthetischer Stiltest: ${input.test}`,answer);
  return {answer,changed:false};
 }
 let change=creatorStyleIntent(input.question);
 if(input.undo){
  if(!isSupportUuid(input.undo)||!input.manageConsent)throw Error("forbidden");
  const original=turns.find(t=>t.request_id===input.undo),a=original&&trustedAudit(i,original.question,original.request_id);
  if(!a||a.character!==c.id||!turns.some(t=>t.request_id===completionId(input.undo!)&&t.question===completionQuestion(i,input.undo!,a))||c.revision!==a.revision+1||c[a.field]!==a.after)throw Error("undo_unavailable");
  change={field:a.field,value:a.before};
 }
 if(change&&input.manageConsent){
  const prior=existing&&trustedAudit(i,existing.question,existing.request_id);
  const a:StyleAudit=prior??{v:1,character:c.id,revision:c.revision,field:change.field,before:c[change.field],after:change.value,...(input.undo?{undoOf:input.undo}:{})};
  if(a.character!==c.id||a.field!==change.field||a.after!==change.value)throw Error("request_conflict");
  return styleChange(i,input.requestId,c,a,turns,signal);
 }
 if(existing){if(existing.question!==input.question)throw Error("request_conflict");return {answer:existing.answer,changed:false};}
 const lastAudit=[...turns].reverse().map(t=>({turn:t,a:trustedAudit(i,t.question,t.request_id)})).find(x=>x.a?.character===c.id);
 const facts=[`Character „${c.display_name}“, aktuelle Revision ${c.revision}. Schreibstil: ${c.writing_style.slice(0,300)}. Satzstil: ${c.sentence_style.slice(0,300)}.`];
 if(lastAudit?.a)facts.push(`Letzte belegte Stilanforderung im erhaltenen eigenen Supportverlauf: Revision ${lastAudit.a.revision} → ${lastAudit.a.revision+1}. ${turns.some(t=>t.request_id===completionId(lastAudit.turn.request_id)&&t.question===completionQuestion(i,lastAudit.turn.request_id,lastAudit.a!))?"Speicherung wurde damals nachgeprüft.":"Abschluss nicht bestätigt."} ${c.revision===lastAudit.a.revision+1?"Diese Revision ist noch aktuell.":"Die Konfiguration wurde zwischenzeitlich geändert; alte Belege erklären die heutige Einstellung nicht vollständig."}`);
 if(/facebook|instagram|kanal|synchron/iu.test(input.question)){const {GET}=await import("../app/api/support/diagnostics/route");const r=await GET();if(r.ok){const d=await r.json();facts.push("Kanäle (lesende Diagnose): "+d.connections.map((x:{platform:string;status:string;issue:string})=>`${x.platform}: ${x.status}, ${x.issue}`).join("; ")+". Kein vollständiges historisches Verarbeitungsprotokoll verfügbar.");}else facts.push("Verbindungsdiagnose nicht aktiviert oder nicht verfügbar. Keine Synchronisationsursache behauptet und keine Kanalrechte geändert.");}
 if(change)facts.push("Ich kann diese begrenzte Stiländerung ausführen, sobald du für diese Sitzung die Stilverwaltung einschaltest. Noch nichts geändert.");
 else if(/änder|stell|mach|lös|zahl|send|veröffentlich/iu.test(input.question))facts.push("Keine eindeutige freigegebene Stiländerung erkannt. Unterstützt: „Mach die Antworten lockerer“ oder „Mach die Antworten kürzer“, jeweils einzeln. Zahlungs-, Rechte-, Lösch- und externe Sendeaktionen sind ausgeschlossen.");
 if(input.fanId){
  const f=await getChatFan(i.workspace,c.id,input.fanId),conv=await getFanConversation(i.workspace,c.id,f.id);
  if(f.workspace_id!==i.workspace||f.character_id!==c.id||conv.workspace_id!==i.workspace||conv.character_id!==c.id||conv.fan_id!==f.id)throw Error("fan_forbidden");
  const messages=await listRecentChatMessages(i.workspace,c.id,f.id,conv.id);
  if(messages.some(m=>m.workspace_id!==i.workspace||m.character_id!==c.id||m.fan_id!==f.id||m.conversation_id!==conv.id))throw Error("message_forbidden");
  const replies=messages.filter(m=>m.direction==="suggested_reply"||m.direction==="confirmed_reply");
  facts.push(`${messages.length} jüngste Nachrichten lokal geprüft; ${replies.length} Antworten. Keine Fan-Inhalte an einen externen KI-Dienst übertragen.`);
  for(const m of replies.slice(-3)){
   const inbound=messages.find(x=>x.generation_id===m.generation_id&&m.generation_id&&x.direction==="fan_inbound");
   let price="Preisursache ohne passende Eingangsnachricht nicht belegt.";
   if(inbound&&m.character_revision===c.revision){try{const offer=resolveChatAdminRequestedOffer(c.sales_playbook,inbound.content).requestedOffer;assertChatAdminReplyPrices([m.content],offer);price="Preisprüfung gegen die aktuelle Regel bestanden.";}catch{price="Preisabweichung oder unvollständige Preisregel erkannt; keine Ursache erfunden und nichts geändert.";}}
   facts.push(`Nachricht ${m.id.slice(0,8)} (${m.created_at}): ${m.character_revision===c.revision?"aktuelle":"abweichende"} Character-Revision ${m.character_revision}; ${m.content.length} Zeichen, ${(m.content.match(/\?/g)??[]).length} Fragen. ${m.character_revision!==c.revision?"Die heutigen Einstellungen belegen nicht die damals verwendete Konfiguration.":"Revision passt; vollständiger damaliger Providerkontext liegt hier nicht vor."} ${price}`);}
 }else facts.push("Kein Fan ausgewählt: kein Nachrichtenverlauf geprüft. Eine konkrete frühere KI-Antwort lässt sich ohne zugeordneten Verlauf und damaligen Kontext nicht erklären.");
 if(/preis|angebot/iu.test(input.question)){
  const offers=c.sales_playbook?.offers??[];
  facts.push(`Aktuelle Preisgrenzen (${offers.length} Angebote, nur lesend): `+offers.slice(0,4).map(o=>`${o.name}: Minimum ${o.minimumPriceMinor/100}, empfohlen ${o.recommendedPriceMinor/100}, Maximum ${o.maximumPriceMinor/100} ${o.currency}; Rabattgrenze ${o.maximumDiscountPercent}%`).join("; ")+(offers.length>4?". Weitere Angebote in den Model-Einstellungen.":""));
 }
 if(/medi|bild|video/iu.test(input.question)){try{const media=await loadCharacterMedia(i.workspace,c.id);facts.push(`Medienkonfiguration autorisiert gelesen: ${media.assets.length} Einträge, davon ${media.assets.filter(a=>a.reviewed&&a.available&&!a.deleted).length} manuell geprüft und verfügbar; ${media.folders.length} Ordner. Keine Dateien geöffnet, analysiert oder an KI übertragen.`);}catch{facts.push("Medienprüfung nicht verfügbar; keine Aussage über Verfügbarkeit oder Einrichtung möglich.");}}
 facts.push("Beobachtungen sind keine vollständige Ursachenfeststellung. Ohne historische Konfiguration und Providerprotokoll erfinde ich keine Erklärung. Server-/Deploymentfehler benötigen den technischen Supportprozess.");
 const report=facts.join("\n\n"),answer=report.length<=2000?report:report.slice(0,1850)+"\n[Ausgabe gekürzt. Keine vollständige Ursachenfeststellung; Details in den Model-Einstellungen prüfen.]";
 await fresh(i,c.id);await record(i,input.requestId,input.question,answer);
 return {answer,changed:false};
}

async function syntheticStyleReply(i:Awaited<ReturnType<typeof supportCreatorIdentity>>,c:ChatCharacter,signal?:AbortSignal){
 const limit=await consumeSharedRateLimit({scope:"support_creator_synthetic",subject:`${i.actor}:${i.workspace}`,maxRequests:4,windowMs:600000});if(!limit.allowed)throw Error("rate_limited");
 const context=buildChatAdminCharacterContext(c,"Hey, wie geht es dir?","Synthetischer Test"),payload=buildChatAdminModelRequest(context),model=getChatAdminModelProfile().model;
 if(context.length>12000)throw Error("test_context_too_large");
 const key=process.env.OPENAI_API_KEY?.trim();if(!key)throw Error("provider_unavailable");
 const started=Date.now();let usage:unknown,output="";
 try{
  const response=await fetch("https://api.openai.com/v1/responses",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify(payload),signal:AbortSignal.any([...(signal?[signal]:[]),AbortSignal.timeout(CHAT_ADMIN_MODEL_TIMEOUT_MS)])});
  if(!response.ok)throw Error("provider_unavailable");const result=await response.json();usage=result.usage;
  const text=typeof result.output_text==="string"?result.output_text:result.output?.flatMap((o:{content?:Array<{text?:string}>})=>o.content??[]).map((o:{text?:string})=>o.text??"").join("");
  const parsed=JSON.parse(text);const replies=assertChatAdminReplySemantics(parsed.replies,"Hey, wie geht es dir?",null);
  if(signal?.aborted||!Array.isArray(replies)||replies.some(r=>typeof r!=="string"||r.length>1000))throw Error("invalid_test_reply");
  output=replies[0].slice(0,500);return output;
 }finally{await recordAiUsageEvent({workspaceId:i.workspace,userId:i.actor,feature:"chat_admin_reply",model,inputChars:context.length,outputChars:output.length,status:output?"ok":"error",latencyMs:Date.now()-started,sourceRoute:"/api/support/creator-context",providerUsage:usage,...(!output?{errorCode:"support_creator_test_failed"}:{})});}
}

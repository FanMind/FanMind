"use client";
import { useCallback,useEffect,useRef,useState,type ReactNode } from "react";
import {supportTurnQuestion,decodeStyleAudit} from "../lib/supportCreatorPolicy";
type CreatorContext={characterId:string;fanId?:string;readConsent:boolean;manageConsent:boolean};
type Turn={request_id:string;question:string;answer:string;unanswered:boolean};
type Pending={requestId:string;question:string;context:string;scope:string;aiConsent:boolean;creator?:CreatorContext};
export function SupportConversation({children}:{children?:ReactNode}={}){
 const [turns,setTurns]=useState<Turn[]>([]),[scope,setScope]=useState(""),[text,setText]=useState(""),[status,setStatus]=useState("loading"),[handoff,setHandoff]=useState(false);
 const [aiConsent,setAiConsent]=useState(false),[answerMode,setAnswerMode]=useState("");
 const [characters,setCharacters]=useState<Array<{id:string;name:string}>>([]),[fans,setFans]=useState<Array<{id:string;name:string}>>([]);
 const [characterId,setCharacterId]=useState(""),[fanId,setFanId]=useState(""),[creatorRead,setCreatorRead]=useState(false),[creatorManage,setCreatorManage]=useState(false),[testConsent,setTestConsent]=useState(false);
 const sending=useRef<AbortController|null>(null);
 const [more,setMore]=useState(false),[privacyError,setPrivacyError]=useState(false);
 const browsingOlder=useRef(false),privacyBusy=useRef(false);
 const generation=useRef(0),pending=useRef<Pending|null>(null),boundScope=useRef("");
 const resetCreator=useCallback(()=>{setCreatorRead(false);setCreatorManage(false);setTestConsent(false);setCharacterId("");setFanId("");setCharacters([]);setFans([]);},[]);
 const undoId=[...turns].reverse().find(t=>decodeStyleAudit(t.question)?.character===characterId)?.request_id??"";
 const load=useCallback(async()=>{
  if(privacyBusy.current)return;
  const version=++generation.current;
  try{
   const response=await fetch("/api/support/conversation",{cache:"no-store"});
   if(response.status===401||response.status===403||response.status===404){if(version===generation.current){pending.current=null;boundScope.current="";setScope("");setText("");browsingOlder.current=false;setTurns([]);setHandoff(false);setAiConsent(false);resetCreator();setAnswerMode("");setStatus("unavailable");}return;}
   if(!response.ok)throw new Error("unavailable");
   const data=await response.json();if(version!==generation.current)return;
   if(boundScope.current&&boundScope.current!==data.scope){browsingOlder.current=false;pending.current=null;setText("");setHandoff(false);setAiConsent(false);resetCreator();setAnswerMode("");}
   boundScope.current=data.scope;setScope(data.scope);if(!browsingOlder.current){setTurns(data.turns);setMore(data.turns.length===100);}
   if(pending.current&&data.turns.some((t:Turn)=>t.request_id===pending.current?.requestId&&(!pending.current?.creator||!decodeStyleAudit(t.question)||data.turns.some((done:Turn)=>done.question.startsWith(`Stiländerung nachgeprüft: ${t.request_id}`))))){pending.current=null;setText("");}
   if(pending.current)setText(pending.current.question);
   setStatus(pending.current?"retry":"ready");
  }catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setText("");setStatus("unavailable");}}
 },[resetCreator]);
 useEffect(()=>{
  const initial=setTimeout(()=>void load(),0);const identityGeneration=generation;const hide=()=>{sending.current?.abort();setAiConsent(false);resetCreator();setAnswerMode("");generation.current++;browsingOlder.current=false;setTurns([]);setScope("");setText("");setHandoff(false);boundScope.current="";pending.current=null;};
  const refresh=()=>{sending.current?.abort();if(pending.current?.aiConsent||pending.current?.creator)pending.current=null;setAiConsent(false);resetCreator();setAnswerMode("");generation.current++;browsingOlder.current=false;setTurns([]);setText("");setHandoff(false);setScope("");void load();};const visibility=()=>{if(document.hidden){sending.current?.abort();if(pending.current?.aiConsent||pending.current?.creator)pending.current=null;setAiConsent(false);resetCreator();setAnswerMode("");generation.current++;browsingOlder.current=false;setTurns([]);setText("");setHandoff(false);setScope("");}else refresh();};window.addEventListener("pagehide",hide);document.addEventListener("visibilitychange",visibility);window.addEventListener("pageshow",refresh);window.addEventListener("focus",refresh);
  const timer=setInterval(()=>{if(!sending.current)void load();},30000);
  return()=>{sending.current?.abort();identityGeneration.current++;clearTimeout(initial);clearInterval(timer);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",hide);window.removeEventListener("pageshow",refresh);window.removeEventListener("focus",refresh);};
 },[load,resetCreator]);
 useEffect(()=>{
  if(!scope)return;let active=true;
  void fetch("/api/support/creator-context",{cache:"no-store"}).then(async r=>{if(!r.ok)return;const d=await r.json();if(active&&d.scope===scope&&Array.isArray(d.characters))setCharacters(d.characters);}).catch(()=>undefined);
  return()=>{active=false;};
 },[scope]);
 useEffect(()=>{
  if(!scope||!characterId)return;let active=true;
  void fetch(`/api/support/creator-context?character=${encodeURIComponent(characterId)}`,{cache:"no-store"}).then(async r=>{if(!r.ok)return;const d=await r.json();if(active&&d.scope===scope&&Array.isArray(d.fans))setFans(d.fans);}).catch(()=>undefined);
  return()=>{active=false;};
 },[scope,characterId]);
 function revokeCreator(){sending.current?.abort();generation.current++;if(pending.current?.creator)pending.current=null;setCreatorRead(false);setCreatorManage(false);setTestConsent(false);void load();}
 async function creatorAction(action:"undo"|"test"){
  if(!scope||!characterId||!undoId||status!=="ready")return;
  const selected=scope,version=++generation.current,controller=new AbortController();sending.current=controller;setStatus("sending");
  try{const r=await fetch("/api/support/creator-context",{method:"POST",headers:{"Content-Type":"application/json"},signal:controller.signal,body:JSON.stringify({scope,requestId:crypto.randomUUID(),question:action==="undo"?"Stiländerung rückgängig":"Synthetischer Vergleichstest",characterId,readConsent:creatorRead,manageConsent:creatorManage,...(action==="undo"?{undo:undoId}:{test:undoId,aiConsent:testConsent})})});
   if(!r.ok)throw Error("unavailable");const d=await r.json();if(version!==generation.current||selected!==boundScope.current||d.scope!==selected)return;await load();
  }catch{if(version===generation.current){setStatus("ready");setAnswerMode("tool_failed");}}
  finally{if(sending.current===controller)sending.current=null;}
 }
 async function send(){
  if(!scope)return;const controller=new AbortController();sending.current=controller;setAnswerMode("");browsingOlder.current=false;const version=++generation.current;setStatus("sending");
  if(!pending.current){const section=window.location.pathname.split("/")[1];pending.current={requestId:crypto.randomUUID(),question:text,context:["channels","billing","dashboard"].includes(section)?section:"support",scope,aiConsent,...(creatorRead&&characterId?{creator:{characterId,...(fanId?{fanId}:{}),readConsent:creatorRead,manageConsent:creatorManage}}:{})};}
  try{
   const action=pending.current;
   const response=await fetch(action.creator?"/api/support/creator-context":"/api/support/conversation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action.creator?{scope:action.scope,requestId:action.requestId,question:action.question,...action.creator}:action),signal:controller.signal});
   if(version!==generation.current)return;
   if(response.status===401||response.status===409){if(action.creator&&response.status===409)throw Error("tool_uncertain");pending.current=null;await load();return;}
   if(!response.ok)throw new Error("unavailable");const data=await response.json();if(version!==generation.current)return;
   if(data.scope!==boundScope.current){await load();return;}
   if(action.creator){pending.current=null;setText("");await load();setAnswerMode("tool");return;}
   setTurns(data.turns);pending.current=null;setText("");setStatus("ready");setAnswerMode(data.answerMode??"");
  }catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setText("");setStatus("retry");if(pending.current?.creator)setAnswerMode("tool_failed");}}
  finally{if(sending.current===controller)sending.current=null;}
 }
 function consent(value:boolean){
  setAiConsent(value);setAnswerMode("");
  if(!value){sending.current?.abort();generation.current++;pending.current=null;void load();}
 }
 async function older(){if(!turns.length)return;const version=++generation.current;try{const response=await fetch(`/api/support/conversation?before=${turns[0].request_id}`,{cache:"no-store"});if(!response.ok)throw new Error("unavailable");const data=await response.json();if(version!==generation.current)return;if(data.scope!==boundScope.current){await load();return;}browsingOlder.current=true;setTurns(previous=>[...data.turns,...previous]);setMore(data.turns.length===100);}catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setStatus("unavailable");}}}
 async function download(){
  if(!scope||privacyBusy.current)return;const selected=scope,version=generation.current;
  try{const r=await fetch(`/api/support/privacy?scope=${selected}`,{cache:"no-store"});if(!r.ok)throw new Error("unavailable");const data=await r.json();if(version!==generation.current||selected!==boundScope.current||data.scope!==selected)return;
   const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="fanmind-support-data.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
  }catch{if(version===generation.current)setStatus("unavailable");}
 }
 async function erase(){
  if(!scope||privacyBusy.current)return;
  setPrivacyError(false);privacyBusy.current=true;const selected=scope,version=++generation.current;
  setStatus("sending");
  try{
   const preview=await fetch(`/api/support/privacy?scope=${selected}&preview=erase`,{cache:"no-store"});if(!preview.ok)throw new Error("unavailable");const data=await preview.json();
   if(version!==generation.current||selected!==boundScope.current||data.scope!==selected)return;
   if(!window.confirm("Deinen gespeicherten Supportverlauf und seine Übergabefreigabe löschen?"))return;
   pending.current=null;setText("");setTurns([]);setHandoff(false);browsingOlder.current=false;
   if(data.state){const r=await fetch("/api/support/privacy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"erase",confirmed:true,scope:selected,thread:data.state.thread,sequence:data.state.sequence})});if(!r.ok)throw new Error("unavailable");}
  }catch{if(version===generation.current)setPrivacyError(true);}
  finally{privacyBusy.current=false;await load();}
 }
 async function share(){const version=++generation.current;const selectedScope=scope;setHandoff(false);try{const r=await fetch("/api/support/conversation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scope,handoff:true})});if(!r.ok)throw new Error("unavailable");const data=await r.json();if(version===generation.current&&selectedScope===boundScope.current&&data.scope===selectedScope)setHandoff(true);}catch{if(version===generation.current)setStatus("unavailable");}}
 return <section aria-label="Dein Supportgespräch" className="fm-support-conversation">
  <div className="fm-support-body">
  {children}
  <h3>Dein Supportgespräch</h3>
  <p className="fm-help-muted">Verlauf für dein Konto und deinen Workspace, bis zu 30 Tage gespeichert. Keine Passwörter oder sensiblen Daten eingeben. Antworten basieren auf freigegebenen Produktinformationen.</p>
  {privacyError&&<p role="alert">Löschung nicht bestätigt. Bitte erneut prüfen und bestätigen.</p>}
  {status==="loading"&&<p role="status">Supportgespräch wird geladen …</p>}
  {status==="unavailable"?<p role="alert">Gespräch nicht verfügbar. <button onClick={()=>void load()}>Erneut laden</button></p>:<>
   {more&&<button disabled={status!=="ready"} onClick={()=>void older()}>Ältere Nachrichten laden</button>}
   <div className="fm-support-turns" role="log" aria-label="Gesprächsverlauf" tabIndex={0} aria-live="polite">
    {!turns.length&&status==="ready"&&<p className="fm-help-muted">Stelle uns eine Frage zu FanMind. Deine Antworten bleiben hier gespeichert.</p>}
    {turns.map(t=><article key={t.request_id}><p className="fm-support-question"><strong>Du</strong>{supportTurnQuestion(t.question)}</p><p className="fm-support-answer"><strong>Support</strong>{t.answer}</p></article>)}
   </div>
   {status==="retry"&&<p role="alert">Antwort nicht bestätigt. Die Wiederholung verwendet dieselbe Anfragekennung.</p>}
  </>}
  {characters.length>0&&<details className="fm-help-privacy"><summary>Creator-Unterstützung · Staging-Test</summary>
   <div className="fm-help-actions">
    <label>Model<select aria-label="Support-Model" value={characterId} disabled={status!=="ready"} onChange={e=>{setCharacterId(e.target.value);setFanId("");setFans([]);setCreatorRead(false);setCreatorManage(false);setTestConsent(false);}}><option value="">Model auswählen</option>{characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
    <label>Nachrichtenkontext<select aria-label="Support-Fan" value={fanId} disabled={status!=="ready"} onChange={e=>{setFanId(e.target.value);revokeCreator();}}><option value="">Kein Fan ausgewählt</option>{fans.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
    <label><input type="checkbox" checked={creatorRead} disabled={!characterId||status==="sending"} onChange={e=>{if(e.target.checked)setCreatorRead(true);else revokeCreator();}}/>Ausgewählte Einstellungen und zugeordneten Verlauf lokal prüfen</label>
    <label><input type="checkbox" checked={creatorManage} disabled={!creatorRead||status==="sending"} onChange={e=>{if(e.target.checked)setCreatorManage(true);else revokeCreator();}}/>Begrenzte Stiländerungen für diese Sitzung verwalten</label>
    <p className="fm-help-muted">Dein Auftrag im Eingabefeld steuert die Aktion. Zum Beispiel: „Mach die Antworten lockerer“ oder „Mach die Antworten kürzer“. Immer nur eine Einstellung. Zahlungsdaten, Preise, Rechte und externer Versand bleiben ausgeschlossen. Die Freigabe endet bei Konto-, Fokus- oder Panelwechsel. Nachweise bleiben im eigenen Supportverlauf bis zu 30 Tage; Löschen entfernt auch die Rückgängig-Grundlage.</p>
    {undoId&&<><label><input type="checkbox" checked={testConsent} onChange={e=>{setTestConsent(e.target.checked);if(!e.target.checked){sending.current?.abort();generation.current++;void load();}}}/>Ausgewählte Model-Einstellungen für zwei synthetische KI-Testantworten mit OpenAI verarbeiten</label>
     <button disabled={!testConsent||!creatorRead||status!=="ready"} onClick={()=>void creatorAction("test")}>Stiländerung synthetisch vergleichen</button>
     <button disabled={!creatorManage||status!=="ready"} onClick={()=>void creatorAction("undo")}>Letzte Stiländerung rückgängig</button></>}
   </div>
  </details>}
  {answerMode==="tool_failed"&&<p role="alert">Werkzeugaktion nicht bestätigt. Bitte Verlauf und aktuelle Model-Revision erneut prüfen. Keine erfolgreiche Änderung behauptet. {status==="retry"&&<button onClick={()=>{pending.current=null;void load();}}>Werkzeugstatus neu prüfen</button>}</p>}
  {answerMode==="tool"&&<p role="status">Creator-Prüfung im Supportverlauf gespeichert.</p>}
  <div className="fm-support-ai-consent">
   <label><input type="checkbox" checked={aiConsent} onChange={event=>consent(event.target.checked)}/>KI-Antworten mit OpenAI erlauben</label>
   <p className="fm-help-muted">Nur mit deiner Zustimmung werden deine Frage und die letzten zwei eigenen Supportfragen mit Antworten zur KI-Beantwortung verarbeitet. Keine automatischen CRM-Abfragen. Du kannst diese Einwilligung hier jederzeit widerrufen. Ohne Zustimmung antwortet die freigegebene Wissensbasis. <a href="/datenschutz">Datenschutz</a></p>
  </div>
  {answerMode==="ai"&&<p role="status">KI-Antwort gespeichert. KI kann Fehler machen.</p>}
  <details className="fm-help-privacy"><summary>Datenschutz und Support-Übergabe</summary>
   <div className="fm-help-actions"><button disabled={!scope||status==="sending"} onClick={()=>void download()}>Eigene Supportdaten herunterladen</button><button disabled={!scope||status==="sending"} onClick={()=>void erase()}>Eigenen Supportverlauf löschen</button><a href="/datenschutz">Datenschutzinformationen</a>
   <button disabled={!scope||!turns.length||status==="sending"||status==="retry"} onClick={()=>void share()}>Aktuellen Verlauf mit meiner Zustimmung an Support übergeben</button></div>
   {handoff&&<p role="status">Support-Übergabe erfasst. Spätere Nachrichten benötigen eine neue Freigabe.</p>}
  </details>
  </div>
  {status!=="unavailable"&&<>
   <form className="fm-support-composer" onSubmit={event=>{event.preventDefault();if(scope&&status!=="sending"&&(status==="retry"||text.trim()))void send();}}>
    <label>Deine Frage<textarea rows={3} maxLength={1000} value={text} disabled={!scope||status==="sending"||status==="retry"} onChange={e=>setText(e.target.value)}/></label>
    <button className="fm-help-primary" type="submit" disabled={!scope||(status!=="retry"&&!text.trim())||status==="sending"}>{status==="retry"?"Mit gleicher Anfrage erneut versuchen":status==="sending"?"Antwort wird gespeichert …":creatorRead&&characterId?"Prüfen und ausführen":aiConsent?"Speichern und KI fragen":"Speichern und senden"}</button>
   </form>
  </>}
 </section>;
}

"use client";
import { useCallback,useEffect,useRef,useState,type ReactNode } from "react";
import {SupportAIConsentControl} from "./SupportAIConsentControl";
import {supportTurnQuestion} from "../lib/supportHistoryPolicy";
type Turn={request_id:string;question:string;answer:string;unanswered:boolean};
type Pending={requestId:string;question:string;context:string;scope:string;aiConsent:boolean};
export function SupportConversation({children}:{children?:ReactNode}={}){
 const [turns,setTurns]=useState<Turn[]>([]),[scope,setScope]=useState(""),[text,setText]=useState(""),[status,setStatus]=useState("loading"),[handoff,setHandoff]=useState(false);
 const [aiConsent,setAiConsent]=useState(false),[answerMode,setAnswerMode]=useState("");
 const sending=useRef<AbortController|null>(null);
 const [more,setMore]=useState(false),[privacyError,setPrivacyError]=useState(false);
 const browsingOlder=useRef(false),privacyBusy=useRef(false);
 const generation=useRef(0),pending=useRef<Pending|null>(null),boundScope=useRef("");
 const load=useCallback(async()=>{
  if(privacyBusy.current)return;
  const version=++generation.current;
  try{
   const response=await fetch("/api/support/conversation",{cache:"no-store"});
   if(response.status===401||response.status===403||response.status===404){if(version===generation.current){pending.current=null;boundScope.current="";setScope("");setText("");browsingOlder.current=false;setTurns([]);setHandoff(false);setAiConsent(false);setAnswerMode("");setStatus("unavailable");}return;}
   if(!response.ok)throw new Error("unavailable");
   const data=await response.json();if(version!==generation.current)return;
   if(boundScope.current&&boundScope.current!==data.scope){browsingOlder.current=false;pending.current=null;setText("");setHandoff(false);setAiConsent(false);setAnswerMode("");}
   boundScope.current=data.scope;setScope(data.scope);if(!browsingOlder.current){setTurns(data.turns);setMore(data.turns.length===100);}
   if(pending.current&&data.turns.some((t:Turn)=>t.request_id===pending.current?.requestId)){pending.current=null;setText("");}
   if(pending.current)setText(pending.current.question);
   setStatus(pending.current?"retry":"ready");
  }catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setText("");setStatus("unavailable");}}
 },[]);
 useEffect(()=>{
  const initial=setTimeout(()=>void load(),0);const identityGeneration=generation;const hide=()=>{sending.current?.abort();setAiConsent(false);setAnswerMode("");generation.current++;browsingOlder.current=false;setTurns([]);setScope("");setText("");setHandoff(false);boundScope.current="";pending.current=null;};
  const refresh=()=>{sending.current?.abort();if(pending.current?.aiConsent)pending.current=null;setAiConsent(false);setAnswerMode("");generation.current++;browsingOlder.current=false;setTurns([]);setText("");setHandoff(false);setScope("");void load();};const visibility=()=>{if(document.hidden){sending.current?.abort();if(pending.current?.aiConsent)pending.current=null;setAiConsent(false);setAnswerMode("");generation.current++;browsingOlder.current=false;setTurns([]);setText("");setHandoff(false);setScope("");}else refresh();};window.addEventListener("pagehide",hide);document.addEventListener("visibilitychange",visibility);window.addEventListener("pageshow",refresh);window.addEventListener("focus",refresh);
  const timer=setInterval(()=>{if(!sending.current)void load();},30000);
  return()=>{sending.current?.abort();identityGeneration.current++;clearTimeout(initial);clearInterval(timer);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",hide);window.removeEventListener("pageshow",refresh);window.removeEventListener("focus",refresh);};
 },[load]);
 async function send(){
  if(!scope)return;const controller=new AbortController();sending.current=controller;setAnswerMode("");browsingOlder.current=false;const version=++generation.current;setStatus("sending");
  if(!pending.current){const section=window.location.pathname.split("/")[1];pending.current={requestId:crypto.randomUUID(),question:text,context:["channels","billing","dashboard"].includes(section)?section:"support",scope,aiConsent};}
  try{
   const response=await fetch("/api/support/conversation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(pending.current),signal:controller.signal});
   if(version!==generation.current)return;
   if(response.status===401||response.status===409){pending.current=null;await load();return;}
   if(!response.ok)throw new Error("unavailable");const data=await response.json();if(version!==generation.current)return;
   if(data.scope!==boundScope.current){await load();return;}
   setTurns(data.turns);pending.current=null;setText("");setStatus("ready");setAnswerMode(data.answerMode??"");
  }catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setText("");setStatus("retry");}}
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
  <SupportAIConsentControl scope={scope} legacyValue={aiConsent} onValue={consent} beforeRevoke={()=>{sending.current?.abort();generation.current++;pending.current=null;}}/>
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
    <button className="fm-help-primary" type="submit" disabled={!scope||(status!=="retry"&&!text.trim())||status==="sending"}>{status==="retry"?"Mit gleicher Anfrage erneut versuchen":status==="sending"?"Antwort wird gespeichert …":"Senden"}</button>
   </form>
  </>}
 </section>;
}

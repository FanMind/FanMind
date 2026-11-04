"use client";
import { useCallback,useEffect,useRef,useState } from "react";
type Turn={request_id:string;question:string;answer:string;unanswered:boolean};
type Pending={requestId:string;question:string;context:string;scope:string};
export function SupportConversation(){
 const [turns,setTurns]=useState<Turn[]>([]),[scope,setScope]=useState(""),[text,setText]=useState(""),[status,setStatus]=useState("loading"),[handoff,setHandoff]=useState(false);
 const [more,setMore]=useState(false);
 const browsingOlder=useRef(false);
 const generation=useRef(0),pending=useRef<Pending|null>(null),boundScope=useRef("");
 const load=useCallback(async()=>{
  const version=++generation.current;
  try{
   const response=await fetch("/api/support/conversation",{cache:"no-store"});
   if(response.status===401||response.status===403||response.status===404){if(version===generation.current){pending.current=null;boundScope.current="";setScope("");setText("");browsingOlder.current=false;setTurns([]);setHandoff(false);setStatus("unavailable");}return;}
   if(!response.ok)throw new Error("unavailable");
   const data=await response.json();if(version!==generation.current)return;
   if(boundScope.current&&boundScope.current!==data.scope){browsingOlder.current=false;pending.current=null;setText("");setHandoff(false);}
   boundScope.current=data.scope;setScope(data.scope);if(!browsingOlder.current){setTurns(data.turns);setMore(data.turns.length===100);}
   if(pending.current&&data.turns.some((t:Turn)=>t.request_id===pending.current?.requestId)){pending.current=null;setText("");}
   if(pending.current)setText(pending.current.question);
   setStatus(pending.current?"retry":"ready");
  }catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setText("");setStatus("unavailable");}}
 },[]);
 useEffect(()=>{
  const initial=setTimeout(()=>void load(),0);const identityGeneration=generation;const hide=()=>{generation.current++;browsingOlder.current=false;setTurns([]);setScope("");setText("");setHandoff(false);boundScope.current="";pending.current=null;};
  const refresh=()=>{generation.current++;browsingOlder.current=false;setTurns([]);setText("");setHandoff(false);setScope("");void load();};const visibility=()=>{if(document.hidden){generation.current++;browsingOlder.current=false;setTurns([]);setText("");setHandoff(false);setScope("");}else refresh();};window.addEventListener("pagehide",hide);document.addEventListener("visibilitychange",visibility);window.addEventListener("pageshow",refresh);window.addEventListener("focus",refresh);
  const timer=setInterval(()=>void load(),30000);
  return()=>{identityGeneration.current++;clearTimeout(initial);clearInterval(timer);document.removeEventListener("visibilitychange",visibility);window.removeEventListener("pagehide",hide);window.removeEventListener("pageshow",refresh);window.removeEventListener("focus",refresh);};
 },[load]);
 async function send(){
  if(!scope)return;browsingOlder.current=false;const version=++generation.current;setStatus("sending");
  if(!pending.current){const section=window.location.pathname.split("/")[1];pending.current={requestId:crypto.randomUUID(),question:text,context:["channels","billing","dashboard"].includes(section)?section:"support",scope};}
  try{
   const response=await fetch("/api/support/conversation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(pending.current)});
   if(version!==generation.current)return;
   if(response.status===401||response.status===409){pending.current=null;await load();return;}
   if(!response.ok)throw new Error("unavailable");const data=await response.json();if(version!==generation.current)return;
   if(data.scope!==boundScope.current){await load();return;}
   setTurns(data.turns);pending.current=null;setText("");setStatus("ready");
  }catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setText("");setStatus("retry");}}
 }
 async function older(){if(!turns.length)return;const version=++generation.current;try{const response=await fetch(`/api/support/conversation?before=${turns[0].request_id}`,{cache:"no-store"});if(!response.ok)throw new Error("unavailable");const data=await response.json();if(version!==generation.current)return;if(data.scope!==boundScope.current){await load();return;}browsingOlder.current=true;setTurns(previous=>[...data.turns,...previous]);setMore(data.turns.length===100);}catch{if(version===generation.current){browsingOlder.current=false;setTurns([]);setStatus("unavailable");}}}
 async function share(){const version=++generation.current;const selectedScope=scope;setHandoff(false);try{const r=await fetch("/api/support/conversation",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scope,handoff:true})});if(!r.ok)throw new Error("unavailable");const data=await r.json();if(version===generation.current&&selectedScope===boundScope.current&&data.scope===selectedScope)setHandoff(true);}catch{if(version===generation.current)setStatus("unavailable");}}
 return <section aria-label="Dein Supportgespräch"><h3>Dein Supportgespräch</h3><p>Verlauf für dein Konto und deinen Workspace, bis zu 30 Tage gespeichert. Keine Passwörter oder sensiblen Daten eingeben. Antworten basieren auf freigegebenen Produktinformationen.</p>{status==="unavailable"?<p role="alert">Gespräch nicht verfügbar. <button onClick={()=>void load()}>Erneut laden</button></p>:<>{more&&<button disabled={status!=="ready"} onClick={()=>void older()}>Ältere Nachrichten laden</button>}<div aria-live="polite">{turns.map(t=><article key={t.request_id}><p><strong>Du:</strong> {t.question}</p><p><strong>Support:</strong> {t.answer}</p></article>)}</div><label>Deine Frage<textarea maxLength={1000} value={text} disabled={!scope||status==="sending"||status==="retry"} onChange={e=>setText(e.target.value)}/></label><button disabled={!scope||(status!=="retry"&&!text.trim())||status==="sending"} onClick={()=>void send()}>{status==="retry"?"Mit gleicher Anfrage erneut versuchen":"Speichern und senden"}</button>{status==="retry"&&<p role="alert">Antwort nicht bestätigt. Die Wiederholung verwendet dieselbe Anfragekennung.</p>}<button disabled={!scope||!turns.length||status==="sending"||status==="retry"} onClick={()=>void share()}>Aktuellen Verlauf mit meiner Zustimmung an Support übergeben</button>{handoff&&<p role="status">Support-Übergabe erfasst. Spätere Nachrichten benötigen eine neue Freigabe.</p>}</>}</section>;
}

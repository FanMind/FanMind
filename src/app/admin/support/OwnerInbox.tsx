"use client";
import { useEffect,useRef,useState } from "react";
import type { SupportNotification } from "@/lib/supportCentreServer";
const labels:Record<string,string>={approval_required:"Owner-Freigabe erforderlich",repair_failed:"Technische Nachprüfung fehlgeschlagen",audit_incomplete:"Abgebrochene Prüfung",security_boundary:"Sicherheitswarnung",diagnostics_unavailable:"Kritische Diagnose nicht verfügbar",handoff_required:"Support-Übernahme angefragt"};
export function OwnerInbox(){
 const [items,setItems]=useState<SupportNotification[]>([]),[error,setError]=useState(false),[turns,setTurns]=useState<Array<{request_id:string;question:string;answer:string}>>([]);
 const generation=useRef(0);
 const [selected,setSelected]=useState<SupportNotification|null>(null),[more,setMore]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();const identityGeneration=generation;
  async function load(){if(document.hidden)return;const version=++generation.current;try{
   const recovery=await fetch("/api/admin/support/overview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"recover"}),signal:controller.signal});const maintenanceError=!recovery.ok;
   const r=await fetch("/api/admin/support/overview",{cache:"no-store",signal:controller.signal});if(!r.ok)throw new Error("unavailable");const data=await r.json();
   if(!controller.signal.aborted&&version===generation.current){setTurns([]);setSelected(null);setMore(false);setItems(data.items);setError(maintenanceError);}
  }catch{if(!controller.signal.aborted&&version===generation.current){setTurns([]);setSelected(null);setMore(false);setItems([]);setError(true);}}}
  const clear=()=>{generation.current++;setTurns([]);setSelected(null);setMore(false);setItems([]);};
  const refresh=()=>{clear();void load();};const visibility=()=>{if(document.hidden)clear();else refresh();};
  void load();const timer=setInterval(()=>void load(),30000);window.addEventListener("pagehide",clear);window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",visibility);
  return()=>{identityGeneration.current++;controller.abort();clearInterval(timer);window.removeEventListener("pagehide",clear);window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",visibility);};
 },[]);
 async function review(item:SupportNotification,before?:string){const version=++generation.current;if(!before){setTurns([]);setSelected(null);setMore(false);}try{const r=await fetch(`/api/admin/support/overview?workspace=${item.workspace_id}&thread=${item.reference_id}${before?`&before=${before}`:""}`,{cache:"no-store"});if(!r.ok)throw new Error("unavailable");const d=await r.json();if(version===generation.current){setTurns(previous=>before?[...d.turns,...previous]:d.turns);setSelected(item);setMore(d.turns.length===100);}}catch{if(version===generation.current){setTurns([]);setSelected(null);setMore(false);setItems([]);setError(true);}}}
 async function ack(id:string){try{const r=await fetch("/api/admin/support/overview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"ack",id})});if(!r.ok)throw new Error("unavailable");setItems(v=>v.filter(i=>i.id!==id));}catch{setTurns([]);setSelected(null);setMore(false);setItems([]);setError(true);}}
 return <section aria-label="Workspaceübergreifende Owner-Meldungen"><h2>Owner-Meldungen aus allen Workspaces</h2><p>Bis zu 100 offene technische Meldungen und freigegebene Support-Übergaben. Abgelaufene Freigaben und abgebrochene Prüfungen werden ohne Wiederholung einer Provideraktion bereinigt.</p>{error&&<p role="alert">Meldungen oder Wiederaufnahme derzeit nicht bestätigt. Die Verbindung wird erneut geprüft.</p>}<ul>{items.filter(i=>!i.acknowledged_at).map(item=><li key={item.id}><strong>{labels[item.code]??"Technischer Supportfall"}</strong>{" · "}{new Date(item.created_at).toLocaleString("de-AT")} {item.workspace_id&&<a href={`/admin/support?workspace=${item.workspace_id}`}>Workspace öffnen</a>} {item.code==="handoff_required"&&<button onClick={()=>void review(item)}>Freigegebenen Verlauf anzeigen</button>} <button onClick={()=>void ack(item.id)}>Zur Kenntnis genommen</button></li>)}</ul>{turns.length>0&&<div><h3>Vom Kunden freigegebener Verlauf</h3>{more&&selected&&<button onClick={()=>void review(selected,turns[0].request_id)}>Ältere freigegebene Nachrichten laden</button>}{turns.map((t,i)=><article key={i}><p>{t.question}</p><p>{t.answer}</p></article>)}<button onClick={()=>{generation.current++;setTurns([]);setSelected(null);setMore(false);}}>Verlauf schließen</button></div>}</section>;
}

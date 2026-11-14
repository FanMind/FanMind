"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {SUPPORT_AI_CONSENT_VERSION,SUPPORT_AI_CONSENT_TEXT,type SupportAIConsent} from "../lib/supportAIConsentPolicy";
type Props={scope:string;legacyValue:boolean;onValue:(value:boolean)=>void;beforeRevoke?:()=>void;accountSettings?:boolean};
export function SupportAIConsentControl({scope,legacyValue,onValue,beforeRevoke,accountSettings=false}:Props){
 const [state,setState]=useState<SupportAIConsent|null>(null),[mode,setMode]=useState("loading"),[error,setError]=useState("");
 const generation=useRef(0),binding=useRef(scope),notify=useRef(onValue),revoke=useRef(beforeRevoke),pending=useRef<object|null>(null);
 useEffect(()=>{notify.current=onValue;revoke.current=beforeRevoke;binding.current=scope;},[onValue,beforeRevoke,scope]);
 const load=useCallback(async()=>{
  const selected=scope,version=++generation.current;if(!selected)return;
  setMode("loading");setError("");setState(null);notify.current(false);
  try{const r=await fetch("/api/support/ai-consent",{cache:"no-store"});if(version!==generation.current||binding.current!==selected)return;
   if(r.status===404){setMode("legacy");return;}
   if(!r.ok)throw Error("unavailable");const d=await r.json();if(version!==generation.current||binding.current!==selected||d.scope!==selected||d.version!==SUPPORT_AI_CONSENT_VERSION)return;
   setState(d.state);notify.current(d.state.granted===true);setMode("saved");
  }catch{if(version===generation.current){setMode("unavailable");setError("KI-Einstellung nicht bestätigt. Die lokale Hilfe bleibt verfügbar.");}}
 },[scope]);
 useEffect(()=>{pending.current=null;const lifetime=generation;const start=setTimeout(()=>void load(),0);const refresh=()=>{pending.current=null;void load();};window.addEventListener("focus",refresh);window.addEventListener("fanmind-support-consent",refresh);return()=>{lifetime.current++;clearTimeout(start);window.removeEventListener("focus",refresh);window.removeEventListener("fanmind-support-consent",refresh);};},[load]);
 async function decide(granted:boolean){
  if(!state||mode==="saving")return;const selected=scope,version=++generation.current;
  if(!granted){revoke.current?.();notify.current(false);}
  setError("");setMode("saving");pending.current??={scope,granted,revision:state.revision,version:SUPPORT_AI_CONSENT_VERSION,requestId:crypto.randomUUID(),confirmed:true};
  try{const r=await fetch("/api/support/ai-consent",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(pending.current)});
   if(version!==generation.current||selected!==binding.current)return;
   if(!r.ok)throw Error("unconfirmed");const d=await r.json();if(version!==generation.current||d.scope!==selected||d.state.granted!==granted)throw Error("unconfirmed");
   pending.current=null;setState(d.state);notify.current(d.state.granted);setMode("saved");window.dispatchEvent(new Event("fanmind-support-consent"));
  }catch{if(version===generation.current){setMode("unconfirmed");notify.current(false);setError("Speicherung nicht bestätigt. Bitte aktuellen Status erneut laden; keine erfolgreiche Änderung behauptet.");}}
 }
 return <details className="fm-help-privacy" id="support-ai-settings" open={accountSettings||undefined}><summary>KI & Datenschutz</summary>
  {mode==="legacy"?accountSettings?<p>Diese dauerhafte Konto-Einstellung ist noch nicht freigeschaltet. Die bestehende Einwilligung im Hilfechat bleibt verfügbar.</p>:<label><input type="checkbox" checked={legacyValue} onChange={e=>notify.current(e.target.checked)}/>KI-Antworten mit OpenAI erlauben</label>:<>
   <p>{state?.granted?"KI-Antworten sind für dein Konto aktiviert.":"KI-Antworten sind freiwillig. Die lokale Hilfe funktioniert auch ohne Aktivierung."}</p>
   <label><input type="checkbox" checked={state?.granted===true} disabled={!state||mode!=="saved"} onChange={e=>void decide(e.target.checked)}/>KI-Antworten mit OpenAI erlauben</label>
   {state?.grantedAt&&<p className="fm-help-muted">Entscheidung gespeichert: {new Date(state.revokedAt??state.grantedAt!).toLocaleString("de-AT")} · Textversion {state.version}</p>}
  </>}
  <p className="fm-help-muted">{mode==="legacy"?"Nur nach Zustimmung werden deine Frage und die letzten zwei eigenen Supportfragen mit Antworten an OpenAI übermittelt. Keine automatischen CRM-Abfragen. Widerruf hier jederzeit möglich.":SUPPORT_AI_CONSENT_TEXT}</p>
  <p className="fm-help-muted">Das Löschen des Gesprächsverlaufs ändert deine separate Kontoentscheidung nicht. OpenAI verarbeitet die Anfrage über die bestehende API. Beim Anbieter können befristete Sicherheitsprotokolle anfallen. Details stehen in den Datenschutzhinweisen. Textversion {SUPPORT_AI_CONSENT_VERSION}.</p>
  {error&&<p role="alert">{error}</p>}
  {["unavailable","unconfirmed"].includes(mode)&&<button type="button" onClick={()=>{pending.current=null;void load();}}>KI-Einstellung erneut laden</button>}
  <a href="/datenschutz">Datenschutz</a> · <a href="/settings/support">Support-KI im Konto verwalten</a>
 </details>;
}

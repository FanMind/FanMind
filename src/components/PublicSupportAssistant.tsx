"use client";
import {useEffect,useRef,useState} from "react";
import styles from "./PublicSupportAssistant.module.css";
type Turn={role:"user"|"assistant";text:string};
export function PublicSupportAssistant({language}:{language:"de"|"en"}){
 const en=language==="en", [open,setOpen]=useState(false),[large,setLarge]=useState(false),[text,setText]=useState(""),[consent,setConsent]=useState(false),[turns,setTurns]=useState<Turn[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const input=useRef<HTMLTextAreaElement>(null),launcher=useRef<HTMLButtonElement>(null),log=useRef<HTMLDivElement>(null),request=useRef<AbortController|null>(null),generation=useRef(0);
 function close(){setOpen(false);launcher.current?.focus();}
 function withdraw(){generation.current++;request.current?.abort();setBusy(false);setConsent(false);setTurns([]);setError("");input.current?.focus();}
 function clear(){generation.current++;request.current?.abort();setBusy(false);setTurns([]);setText("");setError("");setConsent(false);}
 useEffect(()=>{if(!open)return;input.current?.focus();const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){setOpen(false);launcher.current?.focus();}};document.addEventListener("keydown",escape);return()=>document.removeEventListener("keydown",escape);},[open]);
 useEffect(()=>{if(log.current)log.current.scrollTop=log.current.scrollHeight;},[turns,busy,open]);
 useEffect(()=>()=>{generation.current++;request.current?.abort();},[]);
 async function send(){
  const question=text.trim();if(!consent||!question||busy)return;
  const version=++generation.current,controller=new AbortController();request.current=controller;setBusy(true);setError("");
  try{
   const response=await fetch("/api/public-support",{method:"POST",credentials:"omit",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify({question,history:turns.slice(-4),consent:true,language}),signal:controller.signal});
   const data=await response.json();if(version!==generation.current)return;
   if(!response.ok||typeof data.reply!=="string"||!data.reply.trim())throw new Error(response.status===429?"rate":"unavailable");
   setTurns(previous=>[...previous,{role:"user",text:question},{role:"assistant",text:data.reply}].slice(-40) as Turn[]);setText("");
  }catch(e){if(version===generation.current)setError(e instanceof Error&&e.message==="rate"?(en?"Too many requests. Please try again later.":"Zu viele Anfragen. Bitte versuche es später erneut."):(en?"The AI is currently unavailable. Please try again or contact fanmind@fanmind.ch.":"Die KI ist gerade nicht erreichbar. Bitte erneut versuchen oder an fanmind@fanmind.ch schreiben."));}
  finally{if(version===generation.current){setBusy(false);input.current?.focus();}}
 }
 return <aside className={styles.root} aria-label={en?"FanMind Support":"FanMind Hilfe"}>
  {open&&<section id="fanmind-public-support" role="dialog" aria-modal="false" aria-labelledby="fanmind-public-support-title" className={large?styles.panelLarge:styles.panel}>
   <header className={styles.header}><span className={styles.avatar} aria-hidden="true">✦</span><div><h2 id="fanmind-public-support-title">FanMind Support</h2><p>{en?"Ask the AI about FanMind":"Deine Fragen zu FanMind"}</p></div>
    <button type="button" onClick={()=>setLarge(v=>!v)} aria-label={en?"Resize chat":"Chatgröße ändern"} title={en?"Resize chat":"Chatgröße ändern"}>↗</button>
    <button type="button" onClick={close} aria-label={en?"Minimize chat":"Chat minimieren"} title={en?"Minimize chat":"Chat minimieren"}>−</button>
   </header>
   <div className={styles.conversation} ref={log} role="log" aria-live="polite" aria-label={en?"Chat history":"Gesprächsverlauf"}>
    <p className={styles.assistant}>{en?"Hi! I’m the FanMind AI assistant. What would you like to know about features, getting started or using FanMind?":"Hallo! Ich bin der KI-Assistent von FanMind. Was möchtest du über Funktionen, den Einstieg oder die Nutzung wissen?"}</p>
    {turns.map((turn,i)=><p key={i} className={turn.role==="user"?styles.visitor:styles.assistant}><span className={styles.speaker}>{turn.role==="user"?(en?"You":"Du"):"FanMind KI"}</span><span>{turn.text}</span></p>)}
    {busy&&<p className={styles.assistant} role="status">{en?"Thinking …":"Antwort wird vorbereitet …"}</p>}
   </div>
   <form className={styles.composer} onSubmit={e=>{e.preventDefault();void send();}}>
    <p className={styles.notice}>{en?"No login needed. This chat stays in this window. Please don’t enter passwords or customer data.":"Ohne Anmeldung. Dieser Chat bleibt in diesem Fenster. Bitte keine Passwörter oder Kundendaten eingeben."}</p>
    {!consent&&<label className={styles.consent}><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><span>{en?"I agree to my question and recent chat being processed by OpenAI to answer it.":"Ich stimme zu, dass meine Frage und der jüngste Verlauf zur Beantwortung durch OpenAI verarbeitet werden."} <a href="/datenschutz" target="_blank" rel="noreferrer">{en?"Privacy":"Datenschutz"}</a></span></label>}
    {error&&<p className={styles.error} role="alert">{error}</p>}
    <div className={styles.inputRow}><textarea ref={input} value={text} maxLength={1000} disabled={busy} aria-label={en?"Your question":"Deine Frage"} placeholder={en?"Ask your question …":"Stelle deine Frage …"} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();void send();}}}/><button className={styles.send} disabled={!consent||!text.trim()||busy} aria-label={en?"Send question":"Frage senden"} type="submit">➤</button></div>
    <div className={styles.footer}><span>{en?"AI can make mistakes.":"KI kann Fehler machen."}</span>{consent&&<button type="button" onClick={withdraw}>{en?"Withdraw consent":"Einwilligung widerrufen"}</button>}<button type="button" onClick={clear}>{en?"New conversation":"Neues Gespräch"}</button></div>
   </form>
  </section>}
  <button ref={launcher} type="button" className={styles.launcher} aria-expanded={open} aria-controls="fanmind-public-support" onClick={()=>setOpen(v=>!v)}>{open?(en?"Close chat":"Chat schließen"):(en?"Help & Support":"Hilfe & Support")}</button>
 </aside>;
}

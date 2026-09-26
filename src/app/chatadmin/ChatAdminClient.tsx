"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatCharacter } from "@/lib/chatAdmin";
import styles from "./chatadmin.module.css";
const empty:Partial<ChatCharacter>={display_name:"",profile_image_path:null,public_age:18,bio:"",location:"",languages:["Deutsch"],personality:"",writing_style:"",emoji_style:"sparsam",sentence_style:"kurz und natürlich",typical_phrases:[],forbidden_phrases:[],flirt_style:"respektvoll und innerhalb der definierten Grenzen",sales_rules:"kein Druck, keine falschen Versprechen",example_messages:[],status:"active"};
const lines=(value:string)=>value.split("\n").map(v=>v.trim()).filter(Boolean);
function ChatAdminComposer({character}:{character:ChatCharacter}) {
 const [incoming,setIncoming]=useState("");
 const [fan,setFan]=useState("");
 const [replies,setReplies]=useState<string[]>([]);
 const [notice,setNotice]=useState("");
 const [pending,setPending]=useState(false);
 const requestVersion=useRef(0);
 const controller=useRef<AbortController|null>(null);

 useEffect(()=>()=>{
  requestVersion.current+=1;
  controller.current?.abort();
 },[]);

 function invalidate() {
  requestVersion.current+=1;
  controller.current?.abort();
  controller.current=null;
  setReplies([]);
  setNotice("");
  setPending(false);
 }

 async function generate() {
  if(character.status!=="active"||!incoming.trim()||controller.current)return;
  const version=++requestVersion.current;
  const activeController=new AbortController();
  controller.current=activeController;
  setReplies([]);
  setPending(true);
  setNotice("Antwortvorschläge werden erzeugt …");
  try {
   const response=await fetch("/api/chatadmin/reply-suggestions",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({character_id:character.id,character_revision:character.revision,incoming_message:incoming,fan_label:fan}),
    signal:activeController.signal,
   });
   const body=await response.json();
   if(version!==requestVersion.current)return;
   if(!response.ok){setNotice(`Anfrage abgewiesen: ${body.error}`);return;}
   if(body.character_id!==character.id||body.character_revision!==character.revision||!Array.isArray(body.replies)||body.replies.length!==3||body.replies.some((reply:unknown)=>typeof reply!=="string"||!reply.trim())) {
    throw new Error("invalid_reply_binding");
   }
   setReplies(body.replies);
   setNotice(typeof body.safety_note==="string"?body.safety_note:"Antworten prüfen, kopieren und manuell einfügen.");
  } catch {
   if(version===requestVersion.current)setNotice("Antwortvorschläge fehlgeschlagen. Bitte erneut versuchen.");
  } finally {
   if(version===requestVersion.current){controller.current=null;setPending(false);}
  }
 }

 async function copy(reply:string) {
  const version=requestVersion.current;
  try {
   await navigator.clipboard.writeText(reply);
   if(version===requestVersion.current)setNotice("Antwort kopiert. Bitte prüfen und manuell bei OnlyFans einfügen.");
  } catch {
   if(version===requestVersion.current)setNotice("Kopieren fehlgeschlagen. Bitte den Antworttext manuell auswählen und kopieren.");
  }
 }

 return <section className={styles.composer}>
  <p className={styles.eyebrow}>Manueller Copy-&-Open-Flow · {character.display_name}</p>
  <h2>Nachricht manuell einfügen</h2>
  <label>Fan/Chat-Bezeichnung (optional)<input value={fan} onChange={e=>{invalidate();setFan(e.target.value);}} maxLength={120}/></label>
  <label>Von OnlyFans kopierte Fan-Nachricht<textarea value={incoming} onChange={e=>{invalidate();setIncoming(e.target.value);}} maxLength={4000}/></label>
  <button onClick={generate} disabled={pending||character.status!=="active"||!incoming.trim()}>Antwortvorschläge erzeugen</button>
  {character.status!=="active"&&<p>Dieser Character ist deaktiviert. Neue KI-Antworten sind gesperrt.</p>}
  <div className={styles.replies}>{replies.map((reply,i)=><article key={i}><p>{reply}</p><button onClick={()=>copy(reply)}>Antwort kopieren</button></article>)}</div>
  {notice&&<p role="status" className={styles.notice}>{notice}</p>}
 </section>;
}

export function ChatAdminClient({initialCharacters}:{initialCharacters:ChatCharacter[]}){
 const [characters,setCharacters]=useState(initialCharacters);const [selected,setSelected]=useState<ChatCharacter|null>(initialCharacters[0]??null);const [editing,setEditing]=useState<Partial<ChatCharacter>|null>(null);const [notice,setNotice]=useState("");
 const [mutating,setMutating]=useState(false);
 const mutationPending=useRef(false);
 async function mutate(action:()=>Promise<void>) {
  if(mutationPending.current)return;
  mutationPending.current=true;
  setMutating(true);
  setNotice("");
  try { await action(); }
  catch { setNotice("Änderung fehlgeschlagen. Bitte erneut versuchen."); }
  finally { mutationPending.current=false;setMutating(false); }
 }
 async function save(event:FormEvent<HTMLFormElement>) {
  event.preventDefault();
  const fd=new FormData(event.currentTarget);
  const image=String(fd.get("profile_image_path")).trim();
  const payload={...editing,display_name:String(fd.get("display_name")),profile_image_path:image||null,public_age:Number(fd.get("public_age")),bio:String(fd.get("bio")),location:String(fd.get("location")),languages:lines(String(fd.get("languages"))),personality:String(fd.get("personality")),writing_style:String(fd.get("writing_style")),emoji_style:String(fd.get("emoji_style")),sentence_style:String(fd.get("sentence_style")),typical_phrases:lines(String(fd.get("typical_phrases"))),forbidden_phrases:lines(String(fd.get("forbidden_phrases"))),flirt_style:String(fd.get("flirt_style")),sales_rules:String(fd.get("sales_rules")),example_messages:lines(String(fd.get("example_messages"))),status:editing?.status??"active"};
  await mutate(async()=>{
   const response=await fetch("/api/chatadmin/characters",{method:editing?.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const body=await response.json();
   if(!response.ok){setNotice(`Speichern abgewiesen: ${body.error}`);return;}
   setCharacters(current=>editing?.id?current.map(v=>v.id===body.character.id?body.character:v):[...current,body.character]);
   setSelected(body.character);
   setEditing(null);
   setNotice("Charakter gespeichert.");
  });
 }
 async function deactivate(character:ChatCharacter) {
  await mutate(async()=>{
   const response=await fetch("/api/chatadmin/characters",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...character,status:"inactive"})});
   const body=await response.json();
   if(!response.ok){setNotice(`Deaktivieren abgewiesen: ${body.error}`);return;}
   const updated=body.character as ChatCharacter;
   setCharacters(current=>current.map(v=>v.id===updated.id?updated:v));
   setSelected(current=>current?.id===updated.id?updated:current);
  });
 }
 async function remove(character:ChatCharacter) {
  if(!confirm(`Charakter „${character.display_name}“ und nur dessen Character-Chatdaten löschen?`))return;
  await mutate(async()=>{
   const response=await fetch("/api/chatadmin/characters",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:character.id,revision:character.revision})});
   if(!response.ok){setNotice("Löschen abgewiesen. Bitte erneut versuchen.");return;}
   setCharacters(current=>current.filter(v=>v.id!==character.id));
   setSelected(current=>current?.id===character.id?null:current);
   setEditing(current=>current?.id===character.id?null:current);
  });
 }
 return <div className={styles.layout}><section><div className={styles.sectionTitle}><div><p className={styles.eyebrow}>Charaktere</p><h2>Getrennte Personas</h2></div><button disabled={mutating} onClick={()=>{setNotice("");setEditing(empty);}}>Charakter hinzufügen</button></div><div className={styles.cards}>{characters.map(c=><article className={`${styles.card} ${selected?.id===c.id?styles.selected:""}`} key={c.id}><div className={styles.avatar}>{c.display_name.slice(0,1).toUpperCase()}</div><div><h3>{c.display_name}</h3><p>{c.public_age} · {c.status==="active"?"Aktiv":"Inaktiv"} · Revision {c.revision}</p></div><div className={styles.actions}><button disabled={mutating} onClick={()=>{setNotice("");setEditing(null);setSelected(c);}}>Auswählen</button><button disabled={mutating} onClick={()=>{setNotice("");setEditing(c);}}>Bearbeiten</button>{c.status==="active"&&<button disabled={mutating} onClick={()=>deactivate(c)}>Deaktivieren</button>}<button disabled={mutating} className={styles.danger} onClick={()=>remove(c)}>Löschen</button></div></article>)}</div></section>{editing&&<form key={`${editing.id??"new"}:${editing.revision??0}`} className={styles.editor} onSubmit={save}><h2>Character Editor</h2><fieldset disabled={mutating}><legend>Identität</legend><label>Name<input name="display_name" defaultValue={editing.display_name}/></label><label>Öffentliches Alter<input name="public_age" type="number" min="18" max="99" defaultValue={editing.public_age}/></label><label>Bio<textarea name="bio" defaultValue={editing.bio}/></label><label>Ort (optional)<input name="location" defaultValue={editing.location??""}/></label><label>Sprachen, eine pro Zeile<textarea name="languages" defaultValue={editing.languages?.join("\n")}/></label><label>Private Bildreferenz (bestehender FanMind Storage-Pfad)<input name="profile_image_path" defaultValue={editing.profile_image_path??""} placeholder="chat-characters/workspace-id/character-id/datei.jpg"/></label></fieldset><fieldset disabled={mutating}><legend>Persönlichkeit</legend><textarea name="personality" defaultValue={editing.personality}/></fieldset><fieldset disabled={mutating}><legend>Schreibstil</legend><label>Stil<textarea name="writing_style" defaultValue={editing.writing_style}/></label><label>Emoji-Stil<input name="emoji_style" defaultValue={editing.emoji_style}/></label><label>Satzstil<input name="sentence_style" defaultValue={editing.sentence_style}/></label><label>Typische Phrasen<textarea name="typical_phrases" defaultValue={editing.typical_phrases?.join("\n")}/></label><label>No-Gos<textarea name="forbidden_phrases" defaultValue={editing.forbidden_phrases?.join("\n")}/></label></fieldset><fieldset disabled={mutating}><legend>Beispiele</legend><textarea name="example_messages" defaultValue={editing.example_messages?.join("\n")}/></fieldset><fieldset disabled={mutating}><legend>Kommunikations-/Verkaufsregeln</legend><label>Flirt-/Kommunikationsstil<textarea name="flirt_style" defaultValue={editing.flirt_style}/></label><label>Verkaufsregeln<textarea name="sales_rules" defaultValue={editing.sales_rules}/></label></fieldset><div className={styles.actions}><button disabled={mutating} type="submit">Speichern</button><button disabled={mutating} type="button" onClick={()=>setEditing(null)}>Abbrechen</button></div></form>}{selected&&!editing&&!mutating&&<ChatAdminComposer key={`${selected.id}:${selected.revision}:${selected.status}`} character={selected}/>}{notice&&<p role="status" className={styles.notice}>{notice}</p>}</div>
}

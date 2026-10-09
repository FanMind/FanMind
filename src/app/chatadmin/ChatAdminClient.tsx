"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatCharacter } from "@/lib/chatAdmin";
import type { CreatorOffer, CreatorPlaybook } from "@/lib/creatorIntelligencePolicy.mjs";
import styles from "./chatadmin.module.css";
const CHAT_ADMIN_OFFER_CATEGORIES=[{id:"photo",name:"Foto",category:"photo"},{id:"video",name:"Video",category:"video"},{id:"private_photo",name:"Privates Foto",category:"private_photo"},{id:"private_video",name:"Privates Video",category:"private_video"}] as const;
const defaultChatAdminSalesPlaybook=():CreatorPlaybook=>({positioning:"",offers:[],minimumHoursBetweenOffers:48,aftercareHours:48,contentBoundaries:[],confirmationRequired:[],noGos:[]});
const empty:Partial<ChatCharacter>={display_name:"",profile_image_path:null,public_age:18,bio:"",location:"",languages:["Deutsch"],personality:"",writing_style:"",emoji_style:"sparsam",sentence_style:"kurz und natürlich",typical_phrases:[],forbidden_phrases:[],flirt_style:"respektvoll und innerhalb der definierten Grenzen",sales_rules:"kein Druck, keine falschen Versprechen",example_messages:[],status:"active"};
const lines=(value:string)=>value.split("\n").map(v=>v.trim()).filter(Boolean);
const priceValue=(minor:number|undefined)=>minor===undefined?"":(minor/100).toFixed(2);
function salesPlaybookFromForm(fd:FormData,current:CreatorPlaybook|undefined):CreatorPlaybook {
 const base=current??defaultChatAdminSalesPlaybook();
 const managed=new Set<string>(CHAT_ADMIN_OFFER_CATEGORIES.map(definition=>definition.category));
 const offers:CreatorOffer[]=base.offers.filter(offer=>!managed.has(offer.category));
 for(const definition of CHAT_ADMIN_OFFER_CATEGORIES){
  const recommended=String(fd.get(`offer_${definition.id}_recommended`)??"").trim();
  if(!recommended)continue;
  const previous=base.offers.find(offer=>offer.category===definition.category);
  const toMinor=(field:string,fallback:string)=>Math.round(Number(String(fd.get(field)??"").trim()||fallback.replace(",","."))*100);
  const recommendedMinor=toMinor(`offer_${definition.id}_recommended`,recommended);
  offers.push({
   id:definition.id,name:definition.name,category:definition.category,description:previous?.description??"",
   currency:String(fd.get(`offer_${definition.id}_currency`)??previous?.currency??"EUR"),
   minimumPriceMinor:toMinor(`offer_${definition.id}_minimum`,recommended),recommendedPriceMinor:recommendedMinor,
   maximumPriceMinor:toMinor(`offer_${definition.id}_maximum`,recommended),maximumDiscountPercent:previous?.maximumDiscountPercent??0,
   delivery:previous?.delivery??"",exclusivity:previous?.exclusivity??"",
   active:fd.has(`offer_${definition.id}_active`),requiresConfirmation:fd.has(`offer_${definition.id}_confirmation`),
  });
 }
 return {...base,offers};
}
const CHARACTER_VALIDATION_ERRORS:Record<string,{field:string|null;message:string}>={
 invalid_display_name:{field:"display_name",message:"Name muss ausgefüllt sein und darf höchstens 4.000 Zeichen enthalten."},
 public_age_must_be_adult:{field:"public_age",message:"Öffentliches Alter muss zwischen 18 und 99 liegen."},
 invalid_bio:{field:"bio",message:"Bio muss ausgefüllt sein und darf höchstens 4.000 Zeichen enthalten."},
 invalid_languages:{field:"languages",message:"Sprachen enthalten einen ungültigen Eintrag. Maximal 30 Einträge mit jeweils höchstens 500 Zeichen."},
 invalid_profile_image_path:{field:"profile_image_path",message:"Die private Bildreferenz ist kein gültiger FanMind-Storage-Pfad."},
 invalid_personality:{field:"personality",message:"Persönlichkeit muss ausgefüllt sein und darf höchstens 4.000 Zeichen enthalten."},
 invalid_writing_style:{field:"writing_style",message:"Schreibstil → Stil muss ausgefüllt sein und darf höchstens 4.000 Zeichen enthalten."},
 invalid_emoji_style:{field:"emoji_style",message:"Emoji-Stil muss ausgefüllt sein und darf höchstens 4.000 Zeichen enthalten."},
 invalid_sentence_style:{field:"sentence_style",message:"Satzstil muss ausgefüllt sein und darf höchstens 4.000 Zeichen enthalten."},
 invalid_typical_phrases:{field:"typical_phrases",message:"Typische Phrasen enthalten einen ungültigen Eintrag. Maximal 30 Einträge mit jeweils höchstens 500 Zeichen."},
 invalid_forbidden_phrases:{field:"forbidden_phrases",message:"No-Gos enthalten einen ungültigen Eintrag. Maximal 30 Einträge mit jeweils höchstens 500 Zeichen."},
 invalid_example_messages:{field:"example_messages",message:"Beispiele enthalten einen ungültigen Eintrag. Maximal 30 Einträge mit jeweils höchstens 500 Zeichen."},
 invalid_flirt_style:{field:"flirt_style",message:"Flirt-/Kommunikationsstil muss ausgefüllt sein und darf höchstens 4.000 Zeichen enthalten."},
 invalid_sales_rules:{field:"sales_rules",message:"Verkaufsregeln müssen ausgefüllt sein und dürfen höchstens 4.000 Zeichen enthalten."},
 invalid_sales_playbook:{field:null,message:"Angebotspreise sind ungültig. Prüfe Währung sowie Mindest-, empfohlenen und Höchstpreis."},
 invalid_character:{field:null,message:"Die Character-Daten sind unvollständig oder ungültig."},
 payload_too_large:{field:null,message:"Die Character-Daten sind insgesamt zu lang. Bitte kürze mehrere Eingaben und speichere erneut."},
};
function characterValidationError(code:unknown){return typeof code==="string"?CHARACTER_VALIDATION_ERRORS[code]??null:null;}
type ChatMessage={id:string;direction:"fan_inbound"|"suggested_reply"|"confirmed_reply";content:string;created_at:string};
export function groupChatMessages(messages:ChatMessage[]){
 const groups:{message:ChatMessage;suggestions:ChatMessage[]}[]=[];
 for(const message of messages){
  const previous=groups.at(-1);
  if(message.direction==="suggested_reply"&&previous?.message.direction==="fan_inbound"){previous.suggestions.push(message);continue;}
  groups.push({message,suggestions:[]});
 }
 return groups;
}
export function usedSuggestionIds(messages:ChatMessage[]){
 const used=new Set<string>();
 const available:ChatMessage[]=[];
 for(const message of messages){
  if(message.direction==="fan_inbound"){available.length=0;continue;}
  if(message.direction==="suggested_reply"){available.push(message);continue;}
  if(message.direction==="confirmed_reply"){
   const match=[...available].reverse().find(suggestion=>suggestion.content===message.content&&!used.has(suggestion.id));
   if(match)used.add(match.id);
   available.length=0;
  }
 }
 return used;
}
function LegacyChatAdminComposer({character}:{character:ChatCharacter}) {
 const [incoming,setIncoming]=useState(""),[fan,setFan]=useState(""),[replies,setReplies]=useState<string[]>([]),[notice,setNotice]=useState(""),[pending,setPending]=useState(false);
 const controller=useRef<AbortController|null>(null),version=useRef(0);
 function invalidate(){version.current+=1;controller.current?.abort();controller.current=null;setReplies([]);setNotice("");setPending(false);}
 useEffect(()=>()=>invalidate(),[]);
 async function generate(){if(!incoming.trim()||controller.current)return;const current=++version.current;controller.current=new AbortController();setPending(true);try{const response=await fetch("/api/chatadmin/reply-suggestions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({character_id:character.id,character_revision:character.revision,incoming_message:incoming,fan_label:fan}),signal:controller.current.signal});const body=await response.json();if(current!==version.current)return;if(!response.ok||body.character_id!==character.id||body.character_revision!==character.revision||!Array.isArray(body.replies)||body.replies.length!==3)throw new Error("invalid_reply");setReplies(body.replies);setNotice(body.safety_note);}catch{if(current===version.current)setNotice("Antwortvorschläge fehlgeschlagen. Bitte erneut versuchen.");}finally{if(current===version.current){controller.current=null;setPending(false);}}}
 return <section className={styles.composer}><p className={styles.eyebrow}>Manueller Copy-&-Open-Flow · {character.display_name}</p><h2>Nachricht manuell einfügen</h2><label>Fan/Chat-Bezeichnung (optional)<input value={fan} onChange={e=>{invalidate();setFan(e.target.value);}} maxLength={120}/></label><label>Von OnlyFans kopierte Fan-Nachricht<textarea value={incoming} onChange={e=>{invalidate();setIncoming(e.target.value);}} maxLength={4000}/></label><button onClick={generate} disabled={pending||character.status!=="active"||!incoming.trim()}>Antwortvorschläge erzeugen</button><div className={styles.replies}>{replies.map((reply,i)=><article key={i}><p>{reply}</p><button onClick={()=>void navigator.clipboard.writeText(reply)}>Antwort kopieren</button></article>)}</div>{notice&&<p role="status" className={styles.notice}>{notice}</p>}</section>;
}
function ChatAdminComposer({character}:{character:ChatCharacter}) {
 type Fan={id:string;character_id:string;display_name:string;handle:string|null;platform:string;language?:string|null;status:"active"|"inactive";customer_tier:"red"|"blue"|"yellow"|"green";summary?:string;notes?:string;revision:number};
 const [fans,setFans]=useState<Fan[]>([]),[nextCursor,setNextCursor]=useState<string|null>(null),[selectedFan,setSelectedFan]=useState<Fan|null>(null),[conversationId,setConversationId]=useState(""),[messages,setMessages]=useState<ChatMessage[]>([]),[expandedSuggestionsFor,setExpandedSuggestionsFor]=useState<string|null>(null);
 const [editingFan,setEditingFan]=useState<Partial<Fan>|null>(null),[fanEditorMode,setFanEditorMode]=useState<"full"|"profile"|"knowledge">("full"),[fanFormVersion,setFanFormVersion]=useState(0),[fanSearch,setFanSearch]=useState(""),[incoming,setIncoming]=useState(""),[replies,setReplies]=useState<string[]>([]),[notice,setNotice]=useState(""),[pending,setPending]=useState(false);
 const requestVersion=useRef(0),fanRequestVersion=useRef(0),controller=useRef<AbortController|null>(null),confirmationPending=useRef(false),generationAttempt=useRef<{key:string;id:string}|null>(null),creationAttempt=useRef<{key:string;id:string}|null>(null),confirmationAttempts=useRef(new Map<string,string>()),historyRef=useRef<HTMLDivElement|null>(null),conversationPaneRef=useRef<HTMLElement|null>(null);
 async function loadFans(cursor:string|null=null,append=false){const version=++fanRequestVersion.current;const response=await fetch(`/api/chatadmin/fans?character_id=${encodeURIComponent(character.id)}&cursor=${encodeURIComponent(cursor??"0")}`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error);if(version===fanRequestVersion.current){setFans(current=>append?[...current,...body.fans]:body.fans);setNextCursor(body.next_cursor??null);}}
 async function openFan(fan:Fan,reset=true,expandLatest=false){const version=++fanRequestVersion.current;if(reset){invalidate();setConversationId("");setMessages([]);setIncoming("");setExpandedSuggestionsFor(null);}setSelectedFan(fan);setEditingFan(null);const response=await fetch(`/api/chatadmin/conversations?character_id=${encodeURIComponent(character.id)}&fan_id=${encodeURIComponent(fan.id)}`,{cache:"no-store"});const body=await response.json();if(!response.ok)throw new Error(body.error);if(version!==fanRequestVersion.current||body.fan?.id!==fan.id||body.conversation?.fan_id!==fan.id)return null;setSelectedFan(body.fan);setConversationId(body.conversation.id);setMessages(body.messages);if(expandLatest){const latest=[...groupChatMessages(body.messages)].reverse().find(group=>group.suggestions.length);setExpandedSuggestionsFor(latest?.message.id??null);}return body.fan as Fan;}
 // loadFans is intentionally scoped to the selected Character instance.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{void loadFans().catch(()=>setNotice("Fans konnten nicht geladen werden."));return()=>{requestVersion.current+=1;fanRequestVersion.current+=1;controller.current?.abort();};},[character.id]);
 useEffect(()=>{const history=historyRef.current,pane=conversationPaneRef.current;if(history)history.scrollTop=history.scrollHeight;if(pane)pane.scrollTop=pane.scrollHeight;},[selectedFan?.id,messages]);
 function invalidate(){requestVersion.current+=1;controller.current?.abort();controller.current=null;generationAttempt.current=null;setReplies([]);setNotice("");setPending(false);}
 async function saveFan(event:FormEvent<HTMLFormElement>){event.preventDefault();setPending(true);const fd=new FormData(event.currentTarget);const profile={display_name:String(fd.get("display_name")),handle:String(fd.get("handle")),platform:String(fd.get("platform")),language:String(fd.get("language")),customer_tier:String(fd.get("customer_tier")) as Fan["customer_tier"]},knowledge={summary:String(fd.get("summary")),notes:String(fd.get("notes"))};const values={...editingFan,character_id:character.id,...(fanEditorMode!=="knowledge"?profile:{}),...(fanEditorMode!=="profile"?knowledge:{}),status:editingFan?.status??"active"};const creationKey=JSON.stringify(values);if(!editingFan?.id&&creationAttempt.current?.key!==creationKey)creationAttempt.current={key:creationKey,id:crypto.randomUUID()};const payload=editingFan?.id?values:{...values,creation_id:creationAttempt.current!.id};try{const response=await fetch("/api/chatadmin/fans",{method:editingFan?.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const body=await response.json();if(!response.ok){setNotice(`Speichern abgewiesen: ${body.error}`);return;}await loadFans();await openFan(body.fan);creationAttempt.current=null;setNotice(fanEditorMode==="knowledge"?"Notizen und Fakten gespeichert.":"Fan gespeichert.");}catch{setEditingFan(values);setNotice("Fan konnte nicht gespeichert werden. Erneutes Speichern verwendet dieselbe Vorgangs-ID.");}finally{setPending(false);}}
 async function generate(){if(!selectedFan||!conversationId||character.status!=="active"||!incoming.trim()||controller.current)return;const version=++requestVersion.current;const activeController=new AbortController();controller.current=activeController;const attemptKey=[character.id,character.revision,selectedFan.id,selectedFan.revision,conversationId,incoming.trim()].join(":");if(generationAttempt.current?.key!==attemptKey)generationAttempt.current={key:attemptKey,id:crypto.randomUUID()};const generationId=generationAttempt.current.id;setReplies([]);setPending(true);setNotice("Antwortvorschläge werden erzeugt …");try{const response=await fetch("/api/chatadmin/reply-suggestions",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({character_id:character.id,character_revision:character.revision,fan_id:selectedFan.id,fan_revision:selectedFan.revision,conversation_id:conversationId,generation_id:generationId,incoming_message:incoming}),signal:activeController.signal});const body=await response.json();if(version!==requestVersion.current)return;if(!response.ok){setNotice(`Anfrage abgewiesen: ${body.error}`);return;}if(body.character_id!==character.id||body.fan_id!==selectedFan.id||body.conversation_id!==conversationId||body.character_revision!==character.revision||!Array.isArray(body.replies)||body.replies.length!==3)throw new Error("invalid_reply_binding");generationAttempt.current=null;setReplies(body.replies);setIncoming("");setNotice(body.safety_note);await openFan(selectedFan,false,true);}catch{if(version===requestVersion.current)setNotice("Antwortvorschläge fehlgeschlagen. Bitte erneut versuchen.");}finally{if(version===requestVersion.current){controller.current=null;setPending(false);}}}
 async function copyAndConfirmReply(reply:string){try{if(!navigator.clipboard?.writeText)throw new Error("clipboard_unavailable");await navigator.clipboard.writeText(reply);}catch{setNotice("Kopieren fehlgeschlagen. Die Antwort wurde nicht als verwendet gespeichert.");return;}await confirmReply(reply);}
 async function confirmReply(reply:string){if(!selectedFan||confirmationPending.current)return;const version=requestVersion.current;const confirmingFan=selectedFan;confirmationPending.current=true;setPending(true);try{const response=await fetch("/api/chatadmin/conversations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({character_id:character.id,character_revision:character.revision,fan_id:selectedFan.id,fan_revision:selectedFan.revision,conversation_id:conversationId,confirmation_id:confirmationAttempts.current.get(reply)??(()=>{const id=crypto.randomUUID();confirmationAttempts.current.set(reply,id);return id;})(),direction:"confirmed_reply",content:reply})});const body=await response.json();if(version!==requestVersion.current)return;if(!response.ok){setNotice(`Antwort wurde kopiert, aber die Bestätigung wurde abgewiesen: ${body.error}`);return;}if(body.message?.fan_id!==confirmingFan.id||body.message?.conversation_id!==conversationId)return;confirmationAttempts.current.delete(reply);setReplies([]);await openFan(confirmingFan,false);setNotice("Antwort kopiert und als verwendet gespeichert.");}catch{setNotice("Antwort wurde kopiert, konnte aber nicht als verwendet gespeichert werden.");}finally{confirmationPending.current=false;if(version===requestVersion.current)setPending(false);}}
 async function getFullFan(fan:Fan){return selectedFan?.id===fan.id&&selectedFan.summary!==undefined?selectedFan:await openFan(fan);}
 async function editFan(fan:Fan,mode:"profile"|"knowledge"){const full=await getFullFan(fan);if(!full)return;invalidate();setFanEditorMode(mode);setEditingFan(full);}
 async function toggleFanStatus(fan:Fan){const full=await getFullFan(fan);if(!full)return;setPending(true);try{const response=await fetch("/api/chatadmin/fans",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({...full,status:full.status==="active"?"inactive":"active"})});const body=await response.json();if(!response.ok){setNotice(`Änderung abgewiesen: ${body.error}`);return;}await loadFans();await openFan(body.fan);setNotice(body.fan.status==="active"?"Fan aktiviert.":"Fan deaktiviert.");}finally{setPending(false);}}
 async function removeFan(fan:Fan){if(!confirm(`Fan „${fan.display_name}“ samt Gesprächsverlauf und Vorschlägen löschen?`))return;setPending(true);try{const response=await fetch("/api/chatadmin/fans",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({character_id:character.id,id:fan.id,revision:fan.revision})});if(!response.ok){const body=await response.json();setNotice(`Löschen abgewiesen: ${body.error}`);return;}setFans(current=>current.filter(item=>item.id!==fan.id));if(selectedFan?.id===fan.id){setSelectedFan(null);setConversationId("");setMessages([]);setReplies([]);setEditingFan(null);}setNotice("Fan samt Gesprächsverlauf gelöscht.");}finally{setPending(false);}}
 const visibleFans=fans.filter(fan=>`${fan.display_name} ${fan.handle??""}`.toLocaleLowerCase().includes(fanSearch.trim().toLocaleLowerCase()));
 const messageGroups=groupChatMessages(messages),usedSuggestions=usedSuggestionIds(messages),latestSuggestionMessageId=[...messageGroups].reverse().find(group=>group.suggestions.length)?.message.id??null;
 const startFan=()=>{creationAttempt.current=null;setFanEditorMode("full");setFanFormVersion(value=>value+1);setEditingFan({platform:"OnlyFans",status:"active",customer_tier:"red",summary:"",notes:""});};
 return <div className={styles.fanWorkspace}>
  <section className={styles.fanSidebar} aria-label={`Fans von ${character.display_name}`}>
   <div className={styles.paneHeader}><div><span className={styles.paneLabel}>Fans</span><strong>{fans.length}</strong></div><button className={styles.iconButton} aria-label="Fan hinzufügen" title="Fan hinzufügen" onClick={startFan}>＋</button></div>
   <label className={styles.searchLabel}><span>Fans durchsuchen</span><input type="search" value={fanSearch} onChange={event=>setFanSearch(event.target.value)} placeholder="Name oder Handle"/></label>
   <div className={styles.fanList}>{visibleFans.map(fan=><article className={styles.fanCard} key={fan.id}><button aria-label={`${fan.display_name} öffnen`} className={selectedFan?.id===fan.id?styles.fanSelected:styles.fanButton} onClick={()=>void openFan(fan)}><span className={styles.miniAvatar}>{fan.display_name.slice(0,1).toUpperCase()}</span><span><strong>{fan.display_name}</strong><small>{fan.handle||fan.platform}</small></span></button><i aria-hidden="true" className={styles[`${fan.customer_tier??"red"}Dot`]} title={`Kundenstatus: ${fan.customer_tier??"red"}`}/><details className={styles.fanMenu}><summary role="button" aria-label={`${fan.display_name} verwalten`}>•••</summary><div><button disabled={pending} onClick={()=>void editFan(fan,"profile")}>Bearbeiten</button><button disabled={pending} onClick={()=>void editFan(fan,"knowledge")}>Notizen und Fakten</button><button disabled={pending} onClick={()=>void toggleFanStatus(fan)}>{fan.status==="active"?"Deaktivieren":"Aktivieren"}</button><button disabled={pending} className={styles.danger} onClick={()=>void removeFan(fan)}>Löschen</button></div></details></article>)}{visibleFans.length===0&&<p className={styles.emptyList}>{fans.length?"Keine Treffer.":"Noch keine Fans angelegt."}</p>}{nextCursor&&<button className={styles.loadMore} onClick={()=>void loadFans(nextCursor,true)}>Weitere Fans laden</button>}</div>
  </section>
  <section ref={conversationPaneRef} className={styles.conversationPane} aria-label={selectedFan?`Gespräch mit ${selectedFan.display_name}`:"Gespräch"}>
   {editingFan&&<form key={`${editingFan.id??"new"}:${editingFan.revision??0}:${fanFormVersion}:${fanEditorMode}`} className={styles.editor} onSubmit={saveFan}><div className={styles.paneHeader}><h2>{!editingFan.id?"Neuen Fan anlegen":fanEditorMode==="knowledge"?"Notizen und Fakten":"Fan bearbeiten"}</h2></div><fieldset disabled={pending}>{fanEditorMode!=="knowledge"&&<><label>Name<input name="display_name" defaultValue={editingFan.display_name}/></label><label>Handle (optional)<input name="handle" defaultValue={editingFan.handle??""}/></label><label>Plattform / Quelle<input name="platform" defaultValue={editingFan.platform}/></label><label>Sprache (optional)<input name="language" defaultValue={editingFan.language??""}/></label><label>Kundenstatus<select name="customer_tier" defaultValue={editingFan.customer_tier??"red"}><option value="red">Rot · Neukunde</option><option value="blue">Blau · Stammkunde</option><option value="yellow">Gelb · Premiumkunde</option><option value="green">Grün · VIP</option></select></label></>}{fanEditorMode!=="profile"&&<><label>Zusammenfassung / wichtige Fakten<textarea name="summary" defaultValue={editingFan.summary}/></label><label>Relevante Notizen<textarea name="notes" defaultValue={editingFan.notes}/></label></>}</fieldset><div className={styles.actions}><button type="submit" disabled={pending}>Speichern</button><button type="button" className={styles.secondaryButton} onClick={()=>setEditingFan(null)}>Abbrechen</button></div></form>}
   {selectedFan&&!editingFan&&<><div ref={historyRef} className={styles.conversationScroll}><div className={styles.history}><h3>Gespräch</h3>{messages.length===0?<p className={styles.emptyHistory}>Noch keine Nachrichten. Füge unten die erste Fan-Nachricht ein.</p>:messageGroups.map(({message,suggestions})=>suggestions.length?<div className={styles.suggestionGroup} key={message.id}><div className={styles.messageRow}><button className={styles.suggestionToggle} aria-expanded={expandedSuggestionsFor===message.id} aria-label={`${suggestions.length} KI-Vorschläge ${expandedSuggestionsFor===message.id?"einklappen":"anzeigen"}`} title={`${suggestions.length} KI-Vorschläge ${expandedSuggestionsFor===message.id?"einklappen":"anzeigen"}`} onClick={()=>setExpandedSuggestionsFor(current=>current===message.id?null:message.id)}>{expandedSuggestionsFor===message.id?"▲":"▼"}</button><article data-direction={message.direction}><strong>{selectedFan.display_name}</strong><p>{message.content}</p></article></div>{expandedSuggestionsFor===message.id&&<div className={styles.suggestionList}>{suggestions.map(suggestion=><article key={suggestion.id} data-direction={suggestion.direction} data-used={usedSuggestions.has(suggestion.id)?"true":undefined}><strong>{usedSuggestions.has(suggestion.id)?"Verwendeter KI-Vorschlag":"KI-Vorschlag"}</strong><p>{suggestion.content}</p></article>)}</div>}</div>:<article key={message.id} data-direction={message.direction}><strong>{message.direction==="fan_inbound"?selectedFan.display_name:message.direction==="confirmed_reply"?character.display_name:"KI-Vorschlag"}</strong><p>{message.content}</p></article>)}</div>{replies.length>0&&expandedSuggestionsFor===latestSuggestionMessageId&&<div className={styles.replies}>{replies.map((reply,i)=><article key={i}><span>Vorschlag {i+1}</span><p>{reply}</p><div className={styles.actions}><button disabled={pending} onClick={()=>void copyAndConfirmReply(reply)}>Kopieren und verwenden</button></div></article>)}</div>}</div><div className={styles.messageComposer}><label>Neue eingehende Fan-Nachricht<textarea value={incoming} onChange={e=>{invalidate();setIncoming(e.target.value);}} maxLength={4000} placeholder="Nachricht von OnlyFans hier einfügen …"/></label><button onClick={generate} disabled={pending||character.status!=="active"||selectedFan.status!=="active"||!incoming.trim()}>3 KI-Antworten erzeugen</button>{selectedFan.status!=="active"&&<p>Dieser Fan ist deaktiviert. Neue KI-Antworten sind gesperrt.</p>}{character.status!=="active"&&<p>Dieser Character ist deaktiviert. Neue KI-Antworten sind gesperrt.</p>}</div></>}
   {!selectedFan&&!editingFan&&<div className={styles.emptyConversation}><div>💬</div><h2>Wähle einen Fan</h2><p>Öffne links einen Fan oder lege einen neuen Kontakt an.</p><button onClick={startFan}>Neuen Fan anlegen</button></div>}
   {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  </section>
 </div>;
}
function StructuredOfferFields({playbook}:{playbook:CreatorPlaybook|undefined}){
 const value=playbook??defaultChatAdminSalesPlaybook();
 return <fieldset><legend>Character-Angebote und Preise</legend><p className={styles.fieldHint}>Leere Preise bleiben unveröffentlicht. Die KI darf nur aktive Angebote dieses Characters verwenden.</p><div className={styles.offerGrid}>{CHAT_ADMIN_OFFER_CATEGORIES.map(definition=>{
  const offer=value.offers.find(item=>item.category===definition.category);
  return <section className={styles.offerEditor} key={definition.id}><h3>{definition.name}</h3><label>Währung<select name={`offer_${definition.id}_currency`} defaultValue={offer?.currency??"EUR"}><option>EUR</option><option>CHF</option><option>USD</option><option>GBP</option></select></label><label>Empfohlener Preis<input name={`offer_${definition.id}_recommended`} type="number" min="0.01" step="0.01" defaultValue={priceValue(offer?.recommendedPriceMinor)}/></label><label>Mindestpreis<input name={`offer_${definition.id}_minimum`} type="number" min="0.01" step="0.01" defaultValue={priceValue(offer?.minimumPriceMinor)}/></label><label>Höchstpreis<input name={`offer_${definition.id}_maximum`} type="number" min="0.01" step="0.01" defaultValue={priceValue(offer?.maximumPriceMinor)}/></label><label className={styles.checkLabel}><input name={`offer_${definition.id}_active`} type="checkbox" defaultChecked={offer?.active??true}/> Angebot aktiv</label><label className={styles.checkLabel}><input name={`offer_${definition.id}_confirmation`} type="checkbox" defaultChecked={offer?.requiresConfirmation??false}/> Vor Verwendung bestätigen</label></section>;
 })}</div></fieldset>;
}
export function ChatAdminClient({initialCharacters,fanRuntimeEnabled=true,structuredOffersEnabled=false}:{initialCharacters:ChatCharacter[];fanRuntimeEnabled?:boolean;structuredOffersEnabled?:boolean}){
 const [characters,setCharacters]=useState(initialCharacters);const [selected,setSelected]=useState<ChatCharacter|null>(initialCharacters[0]??null);const [editing,setEditing]=useState<Partial<ChatCharacter>|null>(null);const [notice,setNotice]=useState("");const [invalidField,setInvalidField]=useState<string|null>(null);const [validationMessage,setValidationMessage]=useState("");
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
  setInvalidField(null);setValidationMessage("");
  const fd=new FormData(event.currentTarget);
  const image=String(fd.get("profile_image_path")).trim();
  const payload={...editing,display_name:String(fd.get("display_name")),profile_image_path:image||null,public_age:Number(fd.get("public_age")),bio:String(fd.get("bio")),location:String(fd.get("location")),languages:lines(String(fd.get("languages"))),personality:String(fd.get("personality")),writing_style:String(fd.get("writing_style")),emoji_style:String(fd.get("emoji_style")),sentence_style:String(fd.get("sentence_style")),typical_phrases:lines(String(fd.get("typical_phrases"))),forbidden_phrases:lines(String(fd.get("forbidden_phrases"))),flirt_style:String(fd.get("flirt_style")),sales_rules:String(fd.get("sales_rules")),...(structuredOffersEnabled?{sales_playbook:salesPlaybookFromForm(fd,editing?.sales_playbook)}:{}),example_messages:lines(String(fd.get("example_messages"))),status:editing?.status??"active"};
  await mutate(async()=>{
   const response=await fetch("/api/chatadmin/characters",{method:editing?.id?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const body=await response.json();
   if(!response.ok){const validation=characterValidationError(body.error);if(validation){setInvalidField(validation.field);setValidationMessage(validation.message);setNotice(validation.field?"Speichern nicht möglich: Bitte korrigiere das rot markierte Feld.":"Speichern nicht möglich: Bitte prüfe und kürze die Eingaben.");}else{setInvalidField(null);setValidationMessage("");setNotice("Speichern nicht möglich. Bitte Seite neu laden und erneut versuchen.");}return;}
   setCharacters(current=>editing?.id?current.map(v=>v.id===body.character.id?body.character:v):[...current,body.character]);
   setSelected(body.character);
   setEditing(null);
   setInvalidField(null);setValidationMessage("");
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
 return <div className={styles.crmShell}>
  <nav className={styles.characterSidebar} aria-label="Charaktere">
   <div className={styles.paneHeader}><span className={styles.paneLabel}>Charaktere</span><button className={styles.iconButton} disabled={mutating} aria-label="Charakter hinzufügen" title="Charakter hinzufügen" onClick={()=>{setNotice("");setInvalidField(null);setValidationMessage("");setEditing(empty);}}>＋</button></div>
   <div className={styles.characterList}>{characters.map(c=><article className={`${styles.characterCard} ${selected?.id===c.id?styles.characterSelected:""}`} key={c.id}><button className={styles.characterSelect} disabled={mutating} onClick={()=>{setNotice("");setEditing(null);setSelected(c);}}><span className={styles.avatar}>{c.display_name.slice(0,1).toUpperCase()}</span><span><h3>{c.display_name}</h3><small>{c.public_age} · {c.status==="active"?"Aktiv":"Inaktiv"}</small></span></button><details className={styles.characterMenu}><summary aria-label={`${c.display_name} verwalten`}>•••</summary><div><button disabled={mutating} onClick={()=>{setNotice("");setInvalidField(null);setValidationMessage("");setEditing(c);}}>Bearbeiten</button>{c.status==="active"&&<button disabled={mutating} onClick={()=>deactivate(c)}>Deaktivieren</button>}<button disabled={mutating} className={styles.danger} onClick={()=>remove(c)}>Löschen</button></div></details></article>)}</div>
  </nav>
  <main className={styles.workspaceMain}>
   {editing&&<form key={`${editing.id??"new"}:${editing.revision??0}`} className={`${styles.editor} ${styles.characterEditor}`} data-invalid-field={invalidField??undefined} onInput={event=>{const target=event.target as HTMLInputElement|HTMLTextAreaElement;if(target.name===invalidField){setInvalidField(null);setValidationMessage("");setNotice("");}}} onSubmit={save}>
    <div className={styles.paneHeader}><h2>{editing.id?"Charakter bearbeiten":"Charakter hinzufügen"}</h2></div>
    <fieldset disabled={mutating}><legend>Identität</legend><label>Name<input name="display_name" defaultValue={editing.display_name}/></label><label>Öffentliches Alter<input name="public_age" type="number" min="18" max="99" defaultValue={editing.public_age}/></label><label>Bio<textarea name="bio" defaultValue={editing.bio}/></label><label>Ort (optional)<input name="location" defaultValue={editing.location??""}/></label><label>Sprachen, eine pro Zeile<textarea name="languages" defaultValue={editing.languages?.join("\n")}/></label><label>Private Bildreferenz (bestehender FanMind Storage-Pfad)<input name="profile_image_path" defaultValue={editing.profile_image_path??""} placeholder="chat-characters/workspace-id/character-id/datei.jpg"/></label></fieldset>
    <fieldset disabled={mutating}><legend>Persönlichkeit</legend><textarea name="personality" defaultValue={editing.personality}/></fieldset>
    <fieldset disabled={mutating}><legend>Schreibstil</legend><label>Stil<textarea name="writing_style" defaultValue={editing.writing_style}/></label><label>Emoji-Stil<input name="emoji_style" defaultValue={editing.emoji_style}/></label><label>Satzstil<input name="sentence_style" defaultValue={editing.sentence_style}/></label><label>Typische Phrasen<textarea name="typical_phrases" defaultValue={editing.typical_phrases?.join("\n")}/></label><label>No-Gos<textarea name="forbidden_phrases" defaultValue={editing.forbidden_phrases?.join("\n")}/></label></fieldset>
    <fieldset disabled={mutating}><legend>Beispiele</legend><textarea name="example_messages" defaultValue={editing.example_messages?.join("\n")}/></fieldset>
    <fieldset disabled={mutating}><legend>Kommunikation und Verkaufsregeln</legend><label>Flirt-/Kommunikationsstil<textarea name="flirt_style" defaultValue={editing.flirt_style}/></label><label>Zusätzliche Verkaufsregeln<textarea name="sales_rules" defaultValue={editing.sales_rules}/></label><small>Hier stehen zusätzliche Regeln und Grenzen. Strukturierte Character-Preise werden getrennt gepflegt und sind keine FanMind-Abo- oder Stripe-Preise.</small></fieldset>
    {structuredOffersEnabled&&<StructuredOfferFields playbook={editing.sales_playbook}/>}
    {validationMessage&&<p className={styles.validationError} role="alert">{validationMessage}</p>}<div className={styles.actions}><button disabled={mutating} type="submit">Speichern</button><button className={styles.secondaryButton} disabled={mutating} type="button" onClick={()=>{setInvalidField(null);setValidationMessage("");setEditing(null);}}>Abbrechen</button></div>
   </form>}
   {selected&&!editing&&!mutating&&(fanRuntimeEnabled?<ChatAdminComposer key={`${selected.id}:${selected.revision}:${selected.status}`} character={selected}/>:<LegacyChatAdminComposer key={`${selected.id}:${selected.revision}:${selected.status}`} character={selected}/>)}
   {!selected&&!editing&&<div className={styles.emptyConversation}><h2>Charakter auswählen</h2><p>Wähle links einen Charakter oder lege einen neuen an.</p></div>}
   {notice&&<p role="status" className={styles.notice}>{notice}</p>}
  </main>
 </div>
}

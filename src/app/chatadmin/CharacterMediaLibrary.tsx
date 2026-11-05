"use client";
/* eslint-disable @next/next/no-img-element -- Private authenticated previews must be fetched directly with the browser session, never through an image optimizer. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatCharacter } from "@/lib/chatAdmin";
import type { MediaAsset, CustomMediaPolicy } from "@/lib/chatAdminMedia";
import styles from "./chatadmin.module.css";

type Library={assets:MediaAsset[];policy:CustomMediaPolicy;character:ChatCharacter;analysis_enabled?:boolean};
const split=(value:string)=>value.split(/[,\n]/u).map(item=>item.trim()).filter(Boolean);
const errors:Record<string,string>={media_not_enabled:"Die private Bilderbibliothek ist noch nicht freigeschaltet.",invalid_image:"Bitte ein gültiges JPG-, PNG- oder WebP-Einzelbild verwenden.",invalid_image_size:"Das Bild darf höchstens 5 MB groß sein.",media_review_required:"Für die Freigabe bitte Beschreibung und mindestens ein Schlagwort prüfen.",custom_offer_not_ready:"Bitte ein aktives kostenpflichtiges Angebot, erlaubte Motive und eine Lieferfrist auswählen.",stale_media_context:"Die Daten wurden inzwischen geändert. Bitte neu laden.",rate_limited:"Das Verarbeitungslimit ist erreicht. Bitte später erneut versuchen.",media_upload_incomplete:"Der Upload ist unvollständig. Bitte den verbliebenen Eintrag löschen und erneut hochladen."};
export function CharacterMediaLibrary({character,onCharacterChange}:{character:ChatCharacter;onCharacterChange:(character:ChatCharacter)=>void}){
 const [library,setLibrary]=useState<Library|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[query,setQuery]=useState("");
 const mounted=useRef(true),pending=useRef(false);
 useEffect(()=>{mounted.current=true;const controller=new AbortController();
  fetch(`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);if(mounted.current)setLibrary(data);}).catch(error=>{if(mounted.current&&!controller.signal.aborted)setNotice(errors[error.message]??"Bilder konnten nicht geladen werden.");});
  return()=>{mounted.current=false;controller.abort();};
 },[character.id]);
 async function mutate(method:string,body:Record<string,unknown>,path="/api/chatadmin/media"){
  if(pending.current)return false;pending.current=true;setBusy(true);setNotice("");
  try{
   const response=await fetch(path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,character_id:character.id,character_revision:library?.character.revision??character.revision})});
   const data=await response.json();if(!response.ok)throw Error(data.error);
   if(!mounted.current)return false;
   if(data.assets)setLibrary(previous=>({...data,analysis_enabled:previous?.analysis_enabled}));
   else if(data.asset)setLibrary(previous=>previous?{...previous,assets:previous.assets.map(asset=>asset.id===data.asset.id?data.asset:asset),character:data.character}:previous);
   onCharacterChange(data.character);setNotice(path.endsWith("analyze")?"Beschreibung erstellt. Bitte prüfen und ausdrücklich freigeben.":"Gespeichert.");return true;
  }catch(error){if(mounted.current)setNotice(errors[error instanceof Error?error.message:""]??"Änderung fehlgeschlagen. Bitte neu laden und erneut versuchen.");return false;}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 async function upload(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(pending.current)return;const form=event.currentTarget,fd=new FormData(form),file=fd.get("image");
  if(!(file instanceof File)||!file.size||file.size>5*1024*1024){setNotice("Bitte ein Bild mit höchstens 5 MB auswählen.");return;}
  try{const image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("image_read_failed"));reader.readAsDataURL(file);});
   if(await mutate("POST",{image,folder:String(fd.get("folder")??""),rights_confirmed:fd.has("rights")}))form.reset();
  }catch{setNotice("Bild konnte nicht gelesen werden.");}
 }
 async function savePolicy(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!library)return;const fd=new FormData(event.currentTarget);await mutate("PATCH",{action:"policy",revision:library.policy.revision,policy:{enabled:fd.has("enabled"),offer_id:String(fd.get("offer_id")??""),delivery_hours:fd.get("delivery_hours")?Number(fd.get("delivery_hours")):null,motifs:split(String(fd.get("motifs")??"")),requires_confirmation:fd.has("requires_confirmation")}});}
 const offers=character.sales_playbook?.offers.filter(offer=>offer.active&&offer.category==="custom")??[];
 return <section className={styles.mediaLibrary} aria-label={`Bilder von ${character.display_name}`}>
  <h2>Bilder von {character.display_name}</h2><p>Private Bilder und geprüfte Motive. Antworten und Bilder werden weiterhin manuell versendet.</p>
  {notice&&<p role="status">{notice}</p>}
  {!library?<p>Bibliothek wird geladen.</p>:<>
   <form onSubmit={upload} className={styles.mediaPanel}><fieldset disabled={busy}><legend>Bild hochladen</legend><label>Bild (JPG, PNG, WebP, bis 5 MB)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" required/></label><label>Ordner / Sammlung<input name="folder" maxLength={80}/></label><label><input type="checkbox" name="rights" required/>Ich darf dieses Bild speichern und verwenden; abgebildete Personen sind volljährig.</label><button>Hochladen</button></fieldset></form>
   <details className={styles.mediaPanel}><summary>Kostenpflichtige Anfertigungen</summary><form key={library.policy.revision} onSubmit={savePolicy}><fieldset disabled={busy}><label><input type="checkbox" name="enabled" defaultChecked={library.policy.enabled}/>Anfertigungen erlauben</label><label>Hinterlegtes Angebot<select name="offer_id" defaultValue={library.policy.offer_id}><option value="">Bitte auswählen</option>{offers.map(offer=><option key={offer.id} value={offer.id}>{offer.name} · {(offer.recommendedPriceMinor/100).toFixed(2)} {offer.currency}</option>)}</select></label><small>Preis und Inhalt kommen aus den Character-Angeboten. Ein eigenes Angebot kannst du unter „Charakter bearbeiten“ anlegen.</small><label>Lieferfrist in Stunden<input name="delivery_hours" type="number" min={1} max={720} defaultValue={library.policy.delivery_hours??""}/></label><label>Erlaubte Motive (durch Komma getrennt)<textarea name="motifs" maxLength={1600} defaultValue={library.policy.motifs.join(", ")}/></label><label><input type="checkbox" name="requires_confirmation" defaultChecked={library.policy.requires_confirmation}/>Vor einer Zusage immer meine Bestätigung verlangen</label><button>Regeln speichern</button></fieldset></form></details>
   <label>Bibliothek durchsuchen<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Motiv, Ordner oder Schlagwort"/></label>
   <div className={styles.mediaGrid}>{library.assets.filter(asset=>`${asset.folder} ${asset.description} ${asset.tags.join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())).map(asset=><article key={`${asset.id}:${asset.revision}`} className={styles.mediaPanel}>
    {asset.deleted?<p>Gelöscht; Dateibereinigung noch offen.</p>:<img alt={asset.reviewed?asset.description:"Noch nicht geprüftes privates Bild"} src={`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}&id=${encodeURIComponent(asset.id)}&revision=${asset.revision}`} loading="lazy"/>}
    {!asset.deleted&&<form onSubmit={async event=>{event.preventDefault();const fd=new FormData(event.currentTarget);await mutate("PATCH",{id:asset.id,revision:asset.revision,description:String(fd.get("description")),tags:split(String(fd.get("tags"))),folder:String(fd.get("folder")),offer_id:String(fd.get("offer_id")??""),reviewed:fd.has("reviewed"),available:fd.has("available")});}}><fieldset disabled={busy}><label>Ordner<input name="folder" maxLength={80} defaultValue={asset.folder}/></label><label>Zugehöriges Angebot<select name="offer_id" defaultValue={asset.offer_id}><option value="">Ohne Preisbindung</option>{character.sales_playbook?.offers.filter(offer=>offer.active).map(offer=><option key={offer.id} value={offer.id}>{offer.name}</option>)}</select></label><label>Beschreibung<textarea name="description" maxLength={1200} defaultValue={asset.description}/></label><label>Geprüfte Motive / Schlagwörter<textarea name="tags" maxLength={1600} defaultValue={asset.tags.join(", ")}/></label><label><input type="checkbox" name="available" defaultChecked={asset.available}/>Verfügbar</label><label><input type="checkbox" name="reviewed" defaultChecked={asset.reviewed}/>Beschreibung und Motive geprüft; für die KI freigeben</label><button>Bildangaben speichern</button></fieldset></form>}
    {!asset.deleted&&library.analysis_enabled&&<button disabled={busy} onClick={()=>{if(confirm("Dieses Bild zur neutralen Beschreibung an den bestehenden KI-Anbieter übertragen? Das Ergebnis bleibt bis zu deiner Prüfung unfreigegeben."))void mutate("POST",{id:asset.id,revision:asset.revision,analysis_consent:true},"/api/chatadmin/media/analyze");}}>Mit KI beschreiben</button>}
    <button className={styles.danger} disabled={busy} onClick={()=>{if(asset.deleted||confirm("Dieses Bild aus der privaten Bibliothek löschen?"))void mutate("DELETE",{id:asset.id,revision:asset.revision});}}>{asset.deleted?"Dateibereinigung erneut versuchen":"Bild löschen"}</button>
   </article>)}</div>
   {!library.assets.length&&<p>Noch keine Bilder vorhanden. Lade das erste Bild hoch.</p>}
  </>}
 </section>;
}

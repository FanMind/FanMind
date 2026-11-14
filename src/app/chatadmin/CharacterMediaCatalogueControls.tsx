"use client";
import { useState, type FormEvent } from "react";
import type { ChatCharacter } from "@/lib/chatAdmin";
import type { MediaAsset, MediaFolder, MediaPriceRules } from "@/lib/chatAdminMedia";
import { effectiveMediaPrice, mediaFolderPath } from "@/lib/chatAdminMediaCatalogue.mjs";
import styles from "./chatadmin.module.css";
type Offer=NonNullable<ChatCharacter["sales_playbook"]>["offers"][number];
export type CatalogueMutation=(method:string,body:Record<string,unknown>,path?:string)=>Promise<boolean>;
const emptyRules={negotiation_allowed:false,special_discounts_allowed:false};
const value=(minor:number|undefined)=>minor===undefined?"":(minor/100).toFixed(2);
export function cataloguePriceFromForm(fd:FormData,name:string){
 if(!fd.has("has_price"))return null;
 const minor=(key:string,optional=false)=>{const text=String(fd.get(key)??"").trim();if(optional&&!text)return null;if(!/^\d{1,7}(?:[.,]\d{1,2})?$/u.test(text))throw Error("Bitte gültige Preise mit höchstens zwei Nachkommastellen eingeben.");const [whole,fraction=""]=text.replace(",",".").split(".");return Number(whole)*100+Number(fraction.padEnd(2,"0"));};
 return {name,start_minor:minor("price_start"),minimum_minor:minor("price_minimum"),maximum_minor:minor("price_maximum",true),currency:String(fd.get("price_currency")),negotiation_allowed:fd.has("price_negotiation"),special_discounts_allowed:fd.has("price_discounts"),requires_confirmation:fd.has("price_confirmation")};
}
export function MediaPriceFields({offer,rules=emptyRules,label="Eigener Preis"}:{offer?:Offer;rules?:MediaPriceRules;label?:string}){
 const [enabled,setEnabled]=useState(!!offer);
 return <><label><input type="checkbox" name="has_price" checked={enabled} onChange={e=>setEnabled(e.target.checked)}/>{label}</label>
  <fieldset disabled={!enabled}><label>Startpreis<input name="price_start" inputMode="decimal" defaultValue={value(offer?.recommendedPriceMinor)} required={enabled}/></label><label>Mindestpreis<input name="price_minimum" inputMode="decimal" defaultValue={value(offer?.minimumPriceMinor)} required={enabled}/></label><label>Höchstpreis (optional)<input name="price_maximum" inputMode="decimal" defaultValue={value(offer?.maximumPriceMinor)}/></label><label>Währung<select name="price_currency" defaultValue={offer?.currency??"EUR"}><option>EUR</option><option>CHF</option><option>USD</option><option>GBP</option></select></label><label><input type="checkbox" name="price_negotiation" defaultChecked={rules.negotiation_allowed}/>Verhandlungen erlauben</label><label><input type="checkbox" name="price_discounts" defaultChecked={rules.special_discounts_allowed}/>Sonderrabatte im erlaubten Preisrahmen erlauben</label><label><input type="checkbox" name="price_confirmation" defaultChecked={offer?.requiresConfirmation??true}/>Vor einer Preiszusage manuell bestätigen</label></fieldset>
 </>;
}
export function MediaFolderOptions({folders,kind}:{folders:MediaFolder[];kind:string}){
 return <>{folders.filter(f=>f.kind===kind).map(f=><option key={f.id} value={f.id}>{mediaFolderPath(f.id,folders)}</option>)}</>;
}
export function CharacterMediaFolderEditor({character,folders,busy,mutate,assets=[],onOpen}:{character:ChatCharacter;folders:MediaFolder[];busy:boolean;mutate:CatalogueMutation;assets?:MediaAsset[];onOpen?:(folder:MediaFolder)=>void}){
 const [editing,setEditing]=useState<MediaFolder|null|undefined>(),[kind,setKind]=useState<"image"|"video">("image"),[error,setError]=useState("");
 const offers=character.sales_playbook?.offers??[];
 async function save(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const fd=new FormData(event.currentTarget),name=String(fd.get("folder_name")??"");setError("");
  try{if(await mutate("PATCH",{action:"save_folder",folder:{id:editing?.id??crypto.randomUUID(),revision:editing?.revision??0,name,kind,parent_id:String(fd.get("parent_id")??"")||null},price:cataloguePriceFromForm(fd,name)},"/api/chatadmin/media/catalogue"))setEditing(undefined);}catch(e){setError(e instanceof Error?e.message:"Preise prüfen.");}
 }
 return <section className={styles.mediaPanel} aria-label="Ordner und Kategoriepreise"><h3>Ordner und Kategoriepreise</h3><p>Bilder und Videos bleiben getrennt. Ein Dateipreis hat Vorrang; sonst gilt der nächste eigene Kategoriepreis auf dem Weg zum Hauptordner. Ohne Preisbindung erfolgt keine Preiszusage.</p>
  <button disabled={busy} onClick={()=>{setEditing(null);setKind("image");setError("");}}>Ordner anlegen</button>
  <ul className={styles.folderList}>{folders.map(folder=><li key={folder.id}><div className={styles.folderName}>{onOpen&&<button type="button" className={styles.folderOpen} onClick={()=>onOpen(folder)} aria-label={`${folder.name} öffnen`}>📁 {folder.name}</button>}<small>{assets.filter(a=>a.folder_id===folder.id&&!a.deleted&&(a.media_type??"image")==="image").length} Bilder · {assets.filter(a=>a.folder_id===folder.id&&!a.deleted&&a.media_type==="video").length} Videos · {folders.filter(f=>f.parent_id===folder.id).length} Unterordner{assets.some(a=>a.folder_id===folder.id&&a.deleted)?" · Bereinigung offen":""}</small><strong>{folder.kind==="image"?"Bilder":"Videos"} / {mediaFolderPath(folder.id,folders)}</strong>{folder.offer_id&&<span> · {value(offers.find(o=>o.id===folder.offer_id)?.recommendedPriceMinor)} {offers.find(o=>o.id===folder.offer_id)?.currency}</span>}</div><div className={styles.folderActions}> <button className={styles.secondaryButton} disabled={busy} aria-label={`${folder.name} bearbeiten`} onClick={()=>{setEditing(folder);setKind(folder.kind);setError("");}}>Bearbeiten</button> <button className={styles.secondaryButton} disabled={busy} aria-label={`${folder.name} löschen`} onClick={()=>{if(confirm("Diesen leeren Ordner löschen? Dateien und Unterordner müssen vorher verschoben werden."))void mutate("PATCH",{action:"delete_folder",id:folder.id,revision:folder.revision},"/api/chatadmin/media/catalogue");}}>Löschen</button></div></li>)}</ul>
  {editing!==undefined&&<form key={editing?.id??"new"} onSubmit={save}><fieldset disabled={busy}><legend>{editing?"Ordner bearbeiten":"Neuer Ordner"}</legend><label>Ordnername<input name="folder_name" maxLength={80} defaultValue={editing?.name??""} required/></label><label>Hauptordner<select name="media_kind" value={kind} disabled={!!editing} onChange={e=>setKind(e.target.value as "image"|"video")}><option value="image">Bilder</option><option value="video">Videos</option></select></label><label>Übergeordneter Ordner<select name="parent_id" defaultValue={editing?.parent_id??""}><option value="">Direkt im Hauptordner</option><MediaFolderOptions folders={folders.filter(f=>f.id!==editing?.id)} kind={kind}/></select></label><MediaPriceFields offer={offers.find(o=>o.id===editing?.offer_id)} rules={editing?.price_rules} label="Eigener Kategoriepreis"/><small>Preise werden in den bestehenden Character-Angeboten gespeichert. Änderungen wirken auf alle verknüpften Dateien und entwerten ältere KI-Entwürfe. Höchstens 20 bepreiste Angebote je Character.</small><button>Ordner speichern</button><button type="button" onClick={()=>setEditing(undefined)}>Abbrechen</button></fieldset></form>}
  {error&&<p role="status">{error}</p>}
 </section>;
}
export function CharacterMediaFileControls({character,asset,folders,busy,mutate}:{character:ChatCharacter;asset:MediaAsset;folders:MediaFolder[];busy:boolean;mutate:CatalogueMutation}){
 const [error,setError]=useState("");const own=character.sales_playbook?.offers.find(o=>o.id===asset.offer_id);
 let display="Keine Preisbindung";
 try{const effective=effectiveMediaPrice(character,asset,folders);if(effective)display=`${value(effective.offer.recommendedPriceMinor)} ${effective.offer.currency} · ${effective.source==="file"?"Dateipreis":"Kategoriepreis"}${effective.offer.requiresConfirmation?" · Bestätigung nötig":""}`;}catch{display="Preisbindung muss geprüft werden";}
 return <><p>{display}{asset.duration_ms?` · ${(asset.duration_ms/1000).toFixed(1)} Sekunden`:""}</p>
  <form onSubmit={event=>{event.preventDefault();const fd=new FormData(event.currentTarget);void mutate("PATCH",{action:"move_asset",id:asset.id,revision:asset.revision,folder_id:String(fd.get("folder_id"))||null},"/api/chatadmin/media/catalogue");}}><fieldset disabled={busy}><label>Datei verschieben nach<select name="folder_id" defaultValue={asset.folder_id??""}><option value="">{asset.media_type==="video"?"Videos":"Bilder"} / Hauptordner</option><MediaFolderOptions folders={folders} kind={asset.media_type??"image"}/></select></label><button>Datei verschieben</button></fieldset></form>
  <details><summary>Individueller Dateipreis</summary><form onSubmit={async event=>{event.preventDefault();setError("");try{const fd=new FormData(event.currentTarget);await mutate("PATCH",{action:"save_asset_price",id:asset.id,revision:asset.revision,price:cataloguePriceFromForm(fd,asset.description.slice(0,100)||"Individuelle Mediendatei")},"/api/chatadmin/media/catalogue");}catch(e){setError(e instanceof Error?e.message:"Preise prüfen.");}}}><fieldset disabled={busy}><MediaPriceFields offer={own} rules={asset.price_rules} label="Kategoriepreis für diese Datei überschreiben"/><button>Dateipreis speichern</button></fieldset></form></details>{error&&<p role="status">{error}</p>}
 </>;
}

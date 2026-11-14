"use client";
/* eslint-disable @next/next/no-img-element -- Private authenticated previews must be fetched directly with the browser session, never through an image optimizer. */
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatCharacter } from "@/lib/chatAdmin";
import type { MediaAsset, CustomMediaPolicy, MediaFolder } from "@/lib/chatAdminMedia";
import { CharacterMediaFileControls, CharacterMediaFolderEditor, MediaFolderOptions } from "./CharacterMediaCatalogueControls";
import { effectiveMediaPrice, mediaFolderPath } from "@/lib/chatAdminMediaCatalogue.mjs";
import styles from "./chatadmin.module.css";

type Library={assets:MediaAsset[];policy:CustomMediaPolicy;character:ChatCharacter;analysis_enabled?:boolean;folders?:MediaFolder[];catalogue_enabled?:boolean;pricing_v2_enabled?:boolean;video_enabled?:boolean};
const split=(value:string)=>value.split(/[,\n]/u).map(item=>item.trim()).filter(Boolean);
const errors:Record<string,string>={media_pricing_v2_not_enabled:"Die erweiterten Preisregeln warten noch auf die geschützte Aktivierung und Abnahme.",media_catalogue_not_enabled:"Die Ordner- und Preisverwaltung ist noch nicht freigeschaltet.",media_video_not_enabled:"Video-Uploads sind noch nicht freigeschaltet.",media_folder_not_empty:"Bitte zuerst alle Dateien und Unterordner verschieben.",invalid_media_price:"Bitte Preisgrenzen, Währung und das Limit von 20 Angeboten prüfen.",media_processing_busy:"Ein Video wird bereits verarbeitet. Bitte kurz warten und erneut versuchen.",invalid_video:"Das Video konnte nicht sicher verarbeitet werden. Bitte eine gültige MP4- oder WebM-Datei verwenden.",invalid_video_size:"Videos dürfen höchstens 25 MB groß sein.",media_not_enabled:"Die private Bilderbibliothek ist noch nicht freigeschaltet.",invalid_image:"Bitte ein gültiges JPG-, PNG- oder WebP-Einzelbild verwenden.",invalid_image_size:"Das Bild darf höchstens 5 MB groß sein.",media_review_required:"Für die Freigabe bitte Beschreibung und mindestens ein Schlagwort prüfen.",custom_offer_not_ready:"Bitte ein aktives kostenpflichtiges Angebot, erlaubte Motive und eine Lieferfrist auswählen.",stale_media_context:"Die Daten wurden inzwischen geändert. Bitte neu laden.",rate_limited:"Das Verarbeitungslimit ist erreicht. Bitte später erneut versuchen.",media_upload_incomplete:"Der Upload ist unvollständig. Bitte den verbliebenen Eintrag löschen und erneut hochladen."};
export function CharacterMediaLibrary({character,onCharacterChange}:{character:ChatCharacter;onCharacterChange:(character:ChatCharacter)=>void}){
 const [library,setLibrary]=useState<Library|null>(null),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false),[query,setQuery]=useState(""),[folderFilter,setFolderFilter]=useState("all"),[uploadKind,setUploadKind]=useState("image");
 const [uploading,setUploading]=useState(false),[progress,setProgress]=useState({done:0,total:0,name:"",phase:""}),[retryFiles,setRetryFiles]=useState<File[]>([]),[uploadFolder,setUploadFolder]=useState(""),[view,setView]=useState("grid"),[availability,setAvailability]=useState("all"),[kindFilter,setKindFilter]=useState("all"),[sort,setSort]=useState("name"),[preview,setPreview]=useState<MediaAsset|null>(null);
 const batch=useRef(false);
 const mounted=useRef(true),pending=useRef(false),libraryRef=useRef<Library|null>(null);
 useEffect(()=>{mounted.current=true;const controller=new AbortController();
  fetch(`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const data=await response.json();if(!response.ok)throw Error(data.error);if(mounted.current){libraryRef.current=data;setLibrary(data);}}).catch(error=>{if(mounted.current&&!controller.signal.aborted)setNotice(errors[error.message]??"Bilder konnten nicht geladen werden.");});
  return()=>{mounted.current=false;controller.abort();};
 },[character.id]);
 async function mutate(method:string,body:Record<string,unknown>,path="/api/chatadmin/media"){
  if(pending.current)return false;pending.current=true;setBusy(true);setNotice("");
  try{
   const response=await fetch(path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({...body,character_id:character.id,character_revision:libraryRef.current?.character.revision??character.revision})});
   const data=await response.json();if(!response.ok){
    if(data.error==="media_folder_not_empty"&&typeof body.id==="string")setFolderFilter(body.id);
    // A failed upload can already have committed metadata and bumped revision.
    // Read it back before retrying; never report that partial state as success.
    const refresh=await fetch(`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}`,{cache:"no-store"});
    const fresh=await refresh.json();if(mounted.current&&refresh.ok&&fresh.character?.id===character.id&&fresh.character?.workspace_id===character.workspace_id){libraryRef.current=fresh;setLibrary(fresh);onCharacterChange(fresh.character);}
    throw Error(data.error);
   }
   if(!mounted.current)return false;
   if(data.character?.id!==character.id||data.character?.workspace_id!==character.workspace_id)throw Error("stale_media_context");
   if(data.assets){libraryRef.current={...data,analysis_enabled:libraryRef.current?.analysis_enabled};setLibrary(libraryRef.current);}
   else if(data.asset&&libraryRef.current){libraryRef.current={...libraryRef.current,assets:libraryRef.current.assets.map(asset=>asset.id===data.asset.id?data.asset:asset),character:data.character};setLibrary(libraryRef.current);}
   if(body.action==="delete_folder"&&body.id===folderFilter)setFolderFilter("all");
   onCharacterChange(data.character);setNotice(path.endsWith("analyze")?"Beschreibung erstellt. Bitte prüfen und ausdrücklich freigeben.":"Gespeichert.");return true;
  }catch(error){if(mounted.current)setNotice(errors[error instanceof Error?error.message:""]??"Änderung fehlgeschlagen. Bitte neu laden und erneut versuchen.");return false;}
  finally{pending.current=false;if(mounted.current)setBusy(false);}
 }
 async function uploadFiles(files:File[],rights:boolean,kind:string,folder:string){
  if(batch.current||pending.current)return false;
  const max=kind==="video"?25*1024*1024:5*1024*1024;
  if(!files.length||files.length>5||files.some(file=>!file.size||file.size>max)){setNotice("Bitte höchstens fünf Bilder bis 5 MB oder Videos bis 25 MB auswählen.");return false;}
  if(!rights){setNotice("Bitte die Nutzungsrechte bestätigen.");return false;}
  batch.current=true;setUploading(true);setRetryFiles([]);setProgress({done:0,total:files.length,name:"",phase:""});
  try{for(let index=0;index<files.length;index++){
   const file=files[index];if(!mounted.current)return false;
   setProgress({done:index,total:files.length,name:file.name,phase:"Datei wird gelesen"});
   let image:string;
   try{image=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=()=>reject(Error("image_read_failed"));reader.readAsDataURL(file);});}
   catch{setNotice(`„${file.name}“ konnte nicht gelesen werden.`);setRetryFiles(files.slice(index));return false;}
   if(!mounted.current)return false;
   setProgress({done:index,total:files.length,name:file.name,phase:"Wird verarbeitet und privat gespeichert"});
   const saved=libraryRef.current?.catalogue_enabled?await mutate("POST",{data:image,original_name:file.name,media_type:kind,folder_id:folder||null,rights_confirmed:rights},"/api/chatadmin/media/catalogue"):await mutate("POST",{image,folder:"",rights_confirmed:rights});
   if(!saved){if(mounted.current)setRetryFiles(files.slice(index));return false;}
   if(mounted.current)setProgress({done:index+1,total:files.length,name:file.name,phase:"Gespeichert"});
  }if(mounted.current)setNotice(`${files.length} ${files.length===1?"Datei wurde":"Dateien wurden"} privat gespeichert.`);return true;
  }finally{batch.current=false;if(mounted.current)setUploading(false);}
 }
 async function upload(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget,fd=new FormData(form),files=fd.getAll("image").filter((f):f is File=>f instanceof File);if(await uploadFiles(files,fd.has("rights"),uploadKind,uploadFolder))form.reset();}
 async function savePolicy(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!library)return;const fd=new FormData(event.currentTarget);await mutate("PATCH",{action:"policy",revision:library.policy.revision,policy:{enabled:fd.has("enabled"),offer_id:String(fd.get("offer_id")??""),delivery_hours:fd.get("delivery_hours")?Number(fd.get("delivery_hours")):null,motifs:split(String(fd.get("motifs")??"")),requires_confirmation:fd.has("requires_confirmation")}});}
 const offers=character.sales_playbook?.offers.filter(offer=>offer.active&&offer.category==="custom"&&!offer.mediaTerms)??[];
 const folders=library?.folders??[];
 const currentFolder=folders.find(f=>f.id===folderFilter);
 const visibleAssets=library?.assets.filter(asset=>{
  const kind=asset.media_type??"image",selected=folders.find(f=>f.id===folderFilter),path=mediaFolderPath(asset.folder_id,folders),selectedPath=selected?mediaFolderPath(selected.id,folders):"";
  if(folderFilter==="image"||folderFilter==="video"){if(kind!==folderFilter)return false;}
  else if(selected&&(selected.kind!==kind||path!==selectedPath&&!path.startsWith(`${selectedPath} / `)))return false;
  if(kindFilter!=="all"&&kind!==kindFilter)return false;
  if(availability==="available"&&(!asset.available||!asset.reviewed||asset.deleted)||availability==="unreviewed"&&(asset.reviewed||asset.deleted)||availability==="cleanup"&&!asset.deleted)return false;
  return `${asset.original_filename??asset.id} ${asset.folder} ${path} ${asset.description} ${asset.tags.join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
 }).sort((a,b)=>sort==="type"?(a.media_type??"image").localeCompare(b.media_type??"image"):sort==="date"?(b.uploaded_at??"").localeCompare(a.uploaded_at??""):(a.original_filename??a.id).localeCompare(b.original_filename??b.id))??[];
 return <section className={styles.mediaLibrary} aria-label={`Bilder von ${character.display_name}`}>
  <div className={styles.settingsIntro}><div><h2>Medien & Preise</h2><p>Bilder, Videos und Preisregeln für {character.display_name}.</p></div><span className={styles.privateBadge}>Private Bibliothek</span></div>
  {notice&&<p role="status">{notice}</p>}
  {!library?<p>Bibliothek wird geladen.</p>:<>
   <div className={styles.mediaManagement}>
   <form onSubmit={upload} className={styles.mediaPanel}><fieldset disabled={busy||uploading}><legend>{library.catalogue_enabled?"Medien hochladen":"Bild hochladen"}</legend>{library.catalogue_enabled&&<><label>Medientyp<select name="media_type" value={uploadKind} onChange={e=>{setUploadKind(e.target.value);setUploadFolder("");setRetryFiles([]);}}><option value="image">Bilder</option><option value="video" disabled={!library.video_enabled}>Videos{!library.video_enabled?" · noch nicht aktiviert":""}</option></select></label><label>Zielordner<select name="folder_id" value={uploadFolder} onChange={e=>setUploadFolder(e.target.value)}><option value="">Hauptordner</option><MediaFolderOptions folders={folders} kind={uploadKind}/></select></label></>}<label>{uploadKind==="video"?"Video (MP4, WebM, bis 25 MB / 5 Minuten)":"Bild (JPG, PNG, WebP, bis 5 MB)"}<input name="image" type="file" accept={uploadKind==="video"?"video/mp4,video/webm":"image/jpeg,image/png,image/webp"} multiple={library.catalogue_enabled} required/></label>{!library.catalogue_enabled&&<label>Ordner / Sammlung<input name="folder" maxLength={80}/></label>}<label><input type="checkbox" name="rights" required/>Ich darf diese Medien speichern und verwenden; abgebildete Personen sind volljährig.</label><button>Hochladen</button>{progress.total>0&&<div role="status"><progress aria-label="Gespeicherte Dateien" max={progress.total} value={progress.done}/><p>{progress.done} von {progress.total} gespeichert · {progress.phase} · {progress.name}</p></div>}{retryFiles.length>0&&<button type="button" onClick={()=>void uploadFiles(retryFiles,true,uploadKind,uploadFolder)}>Fehlgeschlagene Dateien erneut versuchen ({retryFiles.length})</button>}{library.catalogue_enabled&&<small>Bis zu fünf Dateien nacheinander. Videos werden ohne Bild-/Video-KI-Analyse als privates MP4 normalisiert. Videoanalyse bleibt gesondert deaktiviert.</small>}</fieldset></form>
   {library.catalogue_enabled&&<CharacterMediaFolderEditor v2={library.pricing_v2_enabled} character={library.character} folders={folders} assets={library.assets} onOpen={folder=>{setFolderFilter(folder.id);setUploadKind(folder.kind);setUploadFolder(folder.id);}} busy={busy||uploading} mutate={mutate}/>}
   </div>
   <details className={styles.mediaPanel}><summary>Kostenpflichtige Anfertigungen</summary><form key={library.policy.revision} onSubmit={savePolicy}><fieldset disabled={busy||uploading}><label><input type="checkbox" name="enabled" defaultChecked={library.policy.enabled}/>Anfertigungen erlauben</label><label>Hinterlegtes Angebot<select name="offer_id" defaultValue={library.policy.offer_id}><option value="">Bitte auswählen</option>{offers.map(offer=><option key={offer.id} value={offer.id}>{offer.name} · {(offer.recommendedPriceMinor/100).toFixed(2)} {offer.currency}</option>)}</select></label><small>Preis und Inhalt kommen aus den Character-Angeboten. Ein eigenes Angebot kannst du unter „Charakter bearbeiten“ anlegen.</small><label>Lieferfrist in Stunden<input name="delivery_hours" type="number" min={1} max={720} defaultValue={library.policy.delivery_hours??""}/></label><label>Erlaubte Motive (durch Komma getrennt)<textarea name="motifs" maxLength={1600} defaultValue={library.policy.motifs.join(", ")}/></label><label><input type="checkbox" name="requires_confirmation" defaultChecked={library.policy.requires_confirmation}/>Vor einer Zusage immer meine Bestätigung verlangen</label><button>Regeln speichern</button></fieldset></form></details>
   <nav className={styles.mediaBreadcrumb} aria-label="Ordnerpfad"><button type="button" onClick={()=>{setFolderFilter("all");setUploadFolder("");}}>Alle Medien</button>{currentFolder&&<><span> / {mediaFolderPath(currentFolder.id,folders)}</span><button type="button" onClick={()=>{setFolderFilter(currentFolder.parent_id??"all");setUploadFolder(currentFolder.parent_id??"");}}>Eine Ebene zurück</button></>}</nav>
   <div className={styles.libraryToolbar}><label>Bibliothek durchsuchen<input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Motiv, Ordner oder Schlagwort"/></label>
   {library.catalogue_enabled&&<label>Ordner filtern<select value={folderFilter} onChange={e=>setFolderFilter(e.target.value)}><option value="all">Alle Medien</option><option value="image">Bilder</option><option value="video">Videos</option>{folders.map(f=><option key={f.id} value={f.id}>{f.kind==="image"?"Bilder":"Videos"} / {mediaFolderPath(f.id,folders)}</option>)}</select></label>}
   <label>Medientyp filtern<select value={kindFilter} onChange={e=>setKindFilter(e.target.value)}><option value="all">Bilder & Videos</option><option value="image">Bilder</option><option value="video">Videos</option></select></label><label>Verfügbarkeit<select value={availability} onChange={e=>setAvailability(e.target.value)}><option value="all">Alle Zustände</option><option value="available">Freigegeben</option><option value="unreviewed">Prüfung ausstehend</option><option value="cleanup">Bereinigung offen</option></select></label><label>Sortierung<select value={sort} onChange={e=>setSort(e.target.value)}><option value="name">Dateiname</option><option value="type">Medientyp</option><option value="date">Neueste Uploads</option></select></label><label>Ansicht<select value={view} onChange={e=>setView(e.target.value)}><option value="grid">Kacheln</option><option value="list">Liste</option></select></label>
   </div>
   {!visibleAssets.length&&library.assets.length>0&&<p>Keine Medien für diese Auswahl. Ordner und Filter können oben geändert werden.</p>}
   <div className={view==="list"?styles.mediaList:styles.mediaGrid}>{visibleAssets.map(asset=><article key={`${asset.id}:${asset.revision}`} className={styles.mediaPanel}>
    <div className={styles.assetHeading}><strong>{asset.media_type==="video"?"Video":"Bild"}</strong><span>{asset.deleted?"Gelöscht":asset.reviewed&&asset.available?"Freigegeben":asset.reviewed?"Nicht verfügbar":"Prüfung ausstehend"}</span></div>
    {asset.deleted?<p>Gelöscht; Dateibereinigung noch offen.</p>:asset.media_type==="video"?<video controls preload="metadata" aria-label={asset.reviewed?asset.description:"Noch nicht geprüftes privates Video"} src={`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}&id=${encodeURIComponent(asset.id)}&revision=${asset.revision}`}/>:<img alt={asset.reviewed?asset.description:"Noch nicht geprüftes privates Bild"} src={`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}&id=${encodeURIComponent(asset.id)}&revision=${asset.revision}`} loading="lazy"/>}
    <p>{(()=>{try{const binding=effectiveMediaPrice(library.character,asset,folders);return binding?`${(binding.offer.recommendedPriceMinor/100).toFixed(2)} ${binding.offer.currency}`:"Preis nicht hinterlegt";}catch{return "Preisbindung prüfen";}})()}</p>
    <p className={styles.mediaFilename}>{asset.original_filename||`${asset.id}.${asset.media_type==="video"?"mp4":"webp"}`}</p><small>{asset.uploaded_at?new Date(asset.uploaded_at).toLocaleString("de-AT"):"Upload-Zeitpunkt nicht erfasst"} · {mediaFolderPath(asset.folder_id,folders)||"Hauptordner"}{asset.duration_ms?` · ${(asset.duration_ms/1000).toFixed(1)} Sekunden`:""}</small>
    {!asset.deleted&&<button type="button" onClick={()=>setPreview(asset)}>Vergrößerte Vorschau</button>}
    <details className={styles.mediaDetails}><summary>Angaben, Freigabe & Dateipreis</summary>
    {library.catalogue_enabled&&!asset.deleted&&<CharacterMediaFileControls v2={library.pricing_v2_enabled} character={library.character} asset={asset} folders={folders} busy={busy||uploading} mutate={mutate}/>}
    {!asset.deleted&&<form onSubmit={async event=>{event.preventDefault();const fd=new FormData(event.currentTarget);await mutate("PATCH",{id:asset.id,revision:asset.revision,description:String(fd.get("description")),tags:split(String(fd.get("tags"))),folder:String(fd.get("folder")),offer_id:String(fd.get("offer_id")??""),reviewed:fd.has("reviewed"),available:fd.has("available")});}}><fieldset disabled={busy||uploading}>{library.catalogue_enabled?<><input type="hidden" name="folder" value={asset.folder}/><input type="hidden" name="offer_id" value={asset.offer_id}/></>:<><label>Ordner<input name="folder" maxLength={80} defaultValue={asset.folder}/></label><label>Zugehöriges Angebot<select name="offer_id" defaultValue={asset.offer_id}><option value="">Ohne Preisbindung</option>{character.sales_playbook?.offers.filter(offer=>offer.active).map(offer=><option key={offer.id} value={offer.id}>{offer.name}</option>)}</select></label></>}<label>Beschreibung<textarea aria-label="Beschreibung" name="description" maxLength={1200} defaultValue={asset.description}/></label><label>Geprüfte Motive / Schlagwörter<textarea name="tags" maxLength={1600} defaultValue={asset.tags.join(", ")}/></label><label><input type="checkbox" name="available" defaultChecked={asset.available}/>Verfügbar</label><label><input type="checkbox" name="reviewed" defaultChecked={asset.reviewed}/>Beschreibung und Motive geprüft; für die KI freigeben</label><button>Bildangaben speichern</button></fieldset></form>}
    {!asset.deleted&&asset.media_type!=="video"&&library.analysis_enabled&&<button disabled={busy||uploading} onClick={()=>{if(confirm("Dieses Bild zur neutralen Beschreibung an den bestehenden KI-Anbieter übertragen? Das Ergebnis bleibt bis zu deiner Prüfung unfreigegeben."))void mutate("POST",{id:asset.id,revision:asset.revision,analysis_consent:true},"/api/chatadmin/media/analyze");}}>Mit KI beschreiben</button>}
    </details>
    <button className={styles.danger} disabled={busy||uploading} onClick={()=>{if(asset.deleted||confirm("Diese Datei aus der privaten Bibliothek löschen?"))void mutate("DELETE",{id:asset.id,revision:asset.revision});}}>{asset.deleted?"Dateibereinigung erneut versuchen":asset.media_type==="video"?"Video löschen":"Bild löschen"}</button>
   </article>)}</div>
   {!library.assets.length&&<div className={styles.libraryEmpty}><span className={styles.emptyIcon} aria-hidden="true">▧</span><h3>Deine Medien an einem Ort</h3><p>{library.catalogue_enabled?"Noch keine Medien vorhanden. Lade die erste Datei hoch.":"Noch keine Bilder vorhanden. Lade das erste Bild hoch."}</p><small>Ordne Dateien einem Ordner zu und prüfe die Freigabe, bevor die KI sie anbieten darf.</small></div>}
  </>}
  {preview&&<div role="dialog" aria-modal="true" aria-label="Private Medienvorschau" className={styles.mediaPreview}><button type="button" autoFocus onClick={()=>setPreview(null)} onKeyDown={e=>{if(e.key==="Escape")setPreview(null);}}>Vorschau schließen</button>{preview.media_type==="video"?<video controls src={`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}&id=${encodeURIComponent(preview.id)}&revision=${preview.revision}`}/>:<img alt={preview.description||"Privates Bild"} src={`/api/chatadmin/media?character_id=${encodeURIComponent(character.id)}&id=${encodeURIComponent(preview.id)}&revision=${preview.revision}`}/>}</div>}
 </section>;
}

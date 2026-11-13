"use client";
import {useState} from 'react';
import {inspectInstagramIngress,activateInstagramIngress,syncInstagramComments} from './stagingInstagramIngressActions';
export function StagingInstagramIngressControls() {
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 async function run(action:'check'|'activate'|'comments') {
  setBusy(true);
  try {
   if(action==='comments'){const r=await syncInstagramComments();setStatus(r.ok?`Kommentarabgleich: ${r.posts} Beiträge · ${r.comments} Kommentare geprüft.`:'Kommentarabgleich fehlgeschlagen.');}
   else {const r=await(action==='check'?inspectInstagramIngress():activateInstagramIngress());setStatus(`Instagram-Abonnement: ${r.ok?'bestätigt':'nicht bestätigt'}. Nachrichten: ${r.messages?'aktiv':'fehlt'}. Kommentare: ${r.comments?'aktiv':'fehlt'}.`);}
  }catch{setStatus('Instagram-Prüfung fehlgeschlagen.');}finally{setBusy(false);}
 }
 return <div><button disabled={busy} onClick={()=>run('check')}>Instagram-Abonnement prüfen</button><button disabled={busy} onClick={()=>run('activate')}>Instagram-Empfang aktivieren</button><button disabled={busy} onClick={()=>run('comments')}>Instagram-Kommentare abgleichen</button><p role="status">{status}</p></div>;
}

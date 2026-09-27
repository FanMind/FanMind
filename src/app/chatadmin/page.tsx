import { notFound } from "next/navigation";
import { hasChatAdminFanSchema, requireChatAdminCapability, listChatCharacters } from "@/lib/chatAdmin";
import { ChatAdminClient } from "./ChatAdminClient";
import styles from "./chatadmin.module.css";
export const dynamic="force-dynamic";
export default async function ChatAdminPage(){
  let characters,fansEnabled=false;
  try{const {workspace}=await requireChatAdminCapability();characters=await listChatCharacters(workspace.id);fansEnabled=await hasChatAdminFanSchema(workspace.id);}catch{notFound()}
  return <main className={styles.page}><header><a href="/dashboard">← Dashboard</a><p className={styles.eyebrow}>Sonderfunktion · eigener Workspace</p><h1>ChatAdmin</h1><p>Charaktere für manuell eingefügte OnlyFans-Nachrichten. OnlyFans ist nicht verbunden; du prüfst, kopierst und sendest selbst.</p>{!fansEnabled&&<p>Die Fan-Erweiterung ist noch nicht aktiviert. Es werden keine Fan-Daten abgefragt oder geschrieben; der bestehende Character-Flow bleibt verfügbar.</p>}</header><ChatAdminClient initialCharacters={characters} fanRuntimeEnabled={fansEnabled}/></main>;
}

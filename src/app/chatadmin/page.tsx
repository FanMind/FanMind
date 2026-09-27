import { notFound } from "next/navigation";
import { hasChatAdminFanSchema, requireChatAdminCapability, listChatCharacters } from "@/lib/chatAdmin";
import { ChatAdminClient } from "./ChatAdminClient";
import styles from "./chatadmin.module.css";
export const dynamic="force-dynamic";
export default async function ChatAdminPage(){
  let characters,fansEnabled=false;
  try{const {workspace}=await requireChatAdminCapability();characters=await listChatCharacters(workspace.id);fansEnabled=await hasChatAdminFanSchema(workspace.id);}catch{notFound()}
  return <main className={styles.page}><header><a href="/dashboard">← Dashboard</a><p className={styles.eyebrow}>Sonderfunktion · eigener Workspace</p><h1>ChatAdmin</h1><p>Charaktere für manuell eingefügte OnlyFans-Nachrichten. OnlyFans ist nicht verbunden; du prüfst, kopierst und sendest selbst.</p></header>{fansEnabled?<ChatAdminClient initialCharacters={characters}/>:<section className={styles.composer}><h2>Character-Fans werden vorbereitet</h2><p>Die persistente Fan-Erweiterung bleibt bis zur kontrollierten Schema-Abnahme deaktiviert. Es werden keine Fan-Daten abgefragt oder geschrieben.</p></section>}</main>;
}

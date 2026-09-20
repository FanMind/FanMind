import { notFound } from "next/navigation";
import { requireChatAdminCapability, listChatCharacters } from "@/lib/chatAdmin";
import { ChatAdminClient } from "./ChatAdminClient";
import styles from "./chatadmin.module.css";
export const dynamic="force-dynamic";
export default async function ChatAdminPage(){
  let characters;
  try{const {workspace}=await requireChatAdminCapability();characters=await listChatCharacters(workspace.id);}catch{notFound()}
  return <main className={styles.page}><header><a href="/dashboard">← Dashboard</a><p className={styles.eyebrow}>Sonderfunktion · eigener Workspace</p><h1>ChatAdmin</h1><p>Charaktere für manuell eingefügte OnlyFans-Nachrichten. OnlyFans ist nicht verbunden; du prüfst, kopierst und sendest selbst.</p></header><ChatAdminClient initialCharacters={characters}/></main>;
}

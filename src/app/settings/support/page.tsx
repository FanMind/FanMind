import {redirect} from "next/navigation";
import {supportCustomer} from "@/lib/supportContinuityServer";
import {SupportConsentSettings} from "./SupportConsentSettings";
export const dynamic="force-dynamic";
export default async function SupportSettings(){
 const i=await supportCustomer();if(!i)redirect('/login');
 return <main style={{padding:"2rem",maxWidth:"48rem",margin:"auto"}}><a href="/settings/profile">← Profil & Konto</a><h1>Support-KI und Datenschutz</h1><p>Hier verwaltest du die freiwillige KI-Beantwortung deiner FanMind-Supportfragen. AGB-Annahme und andere KI-Funktionen werden dadurch nicht geändert.</p><SupportConsentSettings scope={i.scope}/><a href="/support">Zur Plattformhilfe</a></main>;
}

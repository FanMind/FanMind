export const SUPPORT_AI_CONSENT_VERSION="support-ai-20261114-v1";
export const SUPPORT_AI_CONSENT_TEXT="Ich möchte KI-Antworten im FanMind-Support nutzen. Dafür werden meine aktuelle Supportfrage und bis zu zwei frühere eigene Supportfragen mit Antworten an OpenAI übermittelt. Es werden keine privaten Fan-Nachrichten, Model-Einstellungen oder Medien automatisch geladen. Die Zustimmung ist freiwillig und wird für mein Konto gespeichert. Ohne Zustimmung bleibt die lokale Hilfe nutzbar. Ich kann sie hier oder unter Einstellungen → Support-KI jederzeit für die Zukunft widerrufen.";
export const persistentSupportConsentEnabled=()=>process.env.FANMIND_RUNTIME_ENVIRONMENT==="staging"||(process.env.FANMIND_RUNTIME_ENVIRONMENT==="production"&&process.env.FANMIND_SUPPORT_PERSISTENT_CONSENT_VERSION===SUPPORT_AI_CONSENT_VERSION);
export type SupportAIConsent={granted:boolean;revision:number;version:string|null;grantedAt:string|null;revokedAt:string|null};
export function consentState(value:unknown):SupportAIConsent{
 const s=value as SupportAIConsent;
 if(!s||typeof s.granted!=="boolean"||!Number.isSafeInteger(s.revision)||s.revision<0||s.version!==null&&typeof s.version!=="string"||[s.grantedAt,s.revokedAt].some(t=>t!==null&&(typeof t!=="string"||!Number.isFinite(Date.parse(t))))||s.granted&&(s.version!==SUPPORT_AI_CONSENT_VERSION||!s.grantedAt||s.revokedAt!==null))throw Error("invalid_consent_state");
 return s;
}

/** Creator text is the only instruction source. Stored Fan text is never parsed as an action. */
export type StyleField = "writing_style" | "sentence_style";
export type StyleChange = {field:StyleField;value:string};
export function creatorStyleIntent(question:string):StyleChange|null {
 const q=question.trim().toLowerCase();
 // Deliberately bounded commands; no free-form model-generated settings or broad tools.
 if(q.length>500||q.includes("?")||/^(warum|weshalb|wie|was|zeige|prüfe|kann|soll|würde|welche)\b/iu.test(q)||/\b(nicht|keine|kein|niemals|ignore|ignorier\w*|system|lösch\w*|zahlung\w*|billing|token|passwort|preis\w*|angebot\w*|rabatt\w*|vertrag\w*|berechtigung\w*|rolle\w*|rechte\w*|delete|überweis\w*|publish|send\w*)\b/iu.test(q))return null;
 if(!/antwort|character|model|schreib|stil|\bki\b|sätze|satz|\ber\b|\bsie\b/iu.test(q))return null;
 const command=/\b(ändere|stelle|mach|mache|schreibe|soll|möchte|kürze)\b/iu.test(q);
 if(!command)return null;
 const short=/kürzer|kurzer|kurze antwort|weniger fragen/iu.test(q);
 const casual=/lockerer|locker|freundlicher|freundlich/iu.test(q);
 if(short&&casual)return null; // one versioned reversible field per operation
 if(casual)return {field:"writing_style",value:"Locker und freundlich, persönlich und respektvoll. Keine erfundenen Erlebnisse oder Versprechen."};
 if(short)return {field:"sentence_style",value:"Kurze, klare Antworten mit höchstens zwei Sätzen und höchstens einer passenden Frage. Keine routinemäßige Anschlussfrage."};
 return null;
}
export type StyleAudit={v:1;character:string;revision:number;field:StyleField;before:string;after:string;undoOf?:string};
export const STYLE_AUDIT_PREFIX="Support-Stiländerung: ";
export function encodeStyleAudit(a:StyleAudit){
 const value=STYLE_AUDIT_PREFIX+JSON.stringify(a);
 if(value.length>1000||!["writing_style","sentence_style"].includes(a.field)||a.before.length>300||a.after.length>300||!Number.isInteger(a.revision)||a.revision<1)throw Error("style_audit_too_large");
 return value;
}
export function decodeStyleAudit(value:string):StyleAudit|null{
 try{const raw=value.split("\nProof:")[0];if(!raw.startsWith(STYLE_AUDIT_PREFIX))return null;const a=JSON.parse(raw.slice(STYLE_AUDIT_PREFIX.length));if(a.v!==1||encodeStyleAudit(a)!==raw)return null;return a;}catch{return null;}
}
export function supportTurnQuestion(value:string){const a=decodeStyleAudit(value);if(value.startsWith("Stiländerung nachgeprüft: "))return "Stiländerung nachgeprüft";if(value.startsWith("Synthetischer Stiltest: "))return "Synthetischer Stilvergleich";return a?`${a.undoOf?"Rückgängig":"Stiländerung"}: ${a.field==="writing_style"?"Schreibstil":"Satzstil"} (Revision ${a.revision})`:value;}

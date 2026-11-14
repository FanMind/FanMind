/** Read-only compatibility for retained pilot history; never authorizes actions. */
export function isRetiredCreatorSupportTurn(question:string){
 return ["Support-Stiländerung: ","Support-Prüfung: ","Stiländerung nachgeprüft: ","Synthetischer Stiltest: "].some(prefix=>question.startsWith(prefix));
}
export function supportTurnQuestion(question:string){
 return isRetiredCreatorSupportTurn(question)?"Historischer Creator-Staging-Test (deaktiviert)":question;
}

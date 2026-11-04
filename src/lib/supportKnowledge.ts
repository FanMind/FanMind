import { CORE_MONTHLY_FEE_CENTS, CORE_INCLUDED_CONNECTIONS } from "@/config/commercialModel.mjs";
/** Bounded approved product knowledge; no model/provider call, no invented answers. */
export function supportAnswer(question: string) {
  const q=question.toLocaleLowerCase("de-AT");
  if (/preis|paket|kosten|tarif/u.test(q)) return { answer:`Die Starter-Grundgebühr beträgt ${CORE_MONTHLY_FEE_CENTS/100} € pro Monat und umfasst ${CORE_INCLUDED_CONNECTIONS} Verbindungen. Einrichtung, Zusatzoptionen und Vertragsdetails findest du auf der öffentlichen Startseite /.`, unanswered:false };
  if (/registrier|anmeld|login|passwort/u.test(q)) return {answer:"Die Anmeldung findest du unter /login, die Registrierung unter /register. Nutze bei einem vergessenen Passwort die Passwort-Wiederherstellung der Anmeldung. Teile hier niemals Passwörter oder Zugangsschlüssel.",unanswered:false};
  if (/kanal|verbind|synchron|instagram|facebook|whatsapp/u.test(q)) return {answer:"Unter /channels kannst du deine eigenen Verbindungen verwalten. Die Hilfe bietet eine lesende Diagnose und Nachprüfung. Eine neue Provider-Anmeldung oder Rechteänderung erfolgt nur über die vorgesehenen Verbindungseinstellungen. Ungelöste Probleme kannst du ausdrücklich an den Support übergeben.",unanswered:false};
  if (/funktion|bedien|antwort|fanmind|hilfe/u.test(q)) return {answer:"FanMind bündelt Kontakte und Gespräche und unterstützt mit Antwortvorschlägen. Du prüfst und sendest Nachrichten selbst. Im Dashboard findest du die Übersicht, unter /inbox die Nachrichten und unter /support weitere Hilfe.",unanswered:false};
  return {answer:"Dazu habe ich keine verlässliche Produktinformation. Ich erfinde keine Antwort. Du kannst den gespeicherten Verlauf mit deiner Zustimmung an den Support übergeben.",unanswered:true};
}

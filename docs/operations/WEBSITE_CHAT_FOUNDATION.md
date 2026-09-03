# Website Chat Security Foundation

Status: Session, Nachrichteningestion und cookie-freies Einweg-Widget
vorbereitet, nicht produktiv aktiviert.

Roadmap-Zuordnung: Phase 8 – Website-KI-Assistent.

Das Zielbild ist ein Code-Snippet, das FanMind-Nutzer in ihre Website
einfügen. Der Assistent beantwortet Besucherfragen mit KI. Wenn die KI nicht
verlässlich weiterkommt, übergibt sie die Anfrage samt vollständigem
Gesprächsverlauf an den zuständigen FanMind-Nutzer. Hinterlässt der Besucher
nach ausdrücklicher Einwilligung seine E-Mail-Adresse, kann der Nutzer aus
FanMind antworten und die Antwort wird an diese Adresse zugestellt.

Die aktuelle Grundlage deckt nur Installation, Consent, Sitzung, eingehende
Nachrichten und deren Zuordnung zu Kontakt, Conversation und Inbox ab. Noch
offen sind KI-Antworten, Unsicherheits-/Übergabelogik, E-Mail-Erfassung und
-verifizierung, die vollständige Gesprächsansicht sowie der manuell
freigegebene Antwortversand. Automatisches Senden im Namen des FanMind-Nutzers
bleibt ausgeschlossen.

Dieser Block schafft die sichere Grundlage für Website-Chat und Website-KI,
ohne KI-Antworten, Rückkanal oder automatisches Senden zu aktivieren.

## Schutzgrenzen

- Jede Installation ist einem Workspace zugeordnet und standardmäßig
  deaktiviert.
- Eine öffentliche Installations-ID ist nur ein Routingmerkmal und kein
  Geheimnis.
- Zugelassen sind ausschließlich einzeln verifizierte, exakt passende
  HTTPS-Origins. Wildcards, Pfade, Queryparameter und ähnlich aussehende
  Subdomains werden nicht akzeptiert.
- Besucher müssen der dokumentierten Verarbeitungsversion ausdrücklich
  zustimmen, bevor eine Sitzung entsteht.
- Der Browser erhält ein zufälliges 256-Bit-Sitzungstoken. Gespeichert wird
  ausschließlich ein zweckgebundener HMAC-SHA256-Wert; weder das rohe Token
  noch eine rohe IP-Adresse werden persistiert.
- Sitzungen laufen spätestens nach 24 Stunden ab und können widerrufen werden.
- Tabellenzugriff ist für `public`, `anon` und `authenticated` entzogen. Nur
  serverseitige Service-Role-Zugriffe sind zulässig.
- Der öffentliche Session-Endpunkt begrenzt Bodygröße und Anfragerate über den
  bestehenden atomaren Shared Rate Limiter. Bei Ausfall bleibt er geschlossen.
- CORS wird nur für die zuvor serverseitig verifizierte Origin ausgegeben.
- Der getrennte Nachrichtenendpunkt akzeptiert nur ein gültiges Bearer-
  Sitzungstoken derselben Installation und Origin. Ein clientseitiger UUID-
  Schlüssel macht Wiederholungen idempotent.
- Die transaktionale, als `SECURITY INVOKER` laufende Datenbankfunktion ist nur
  für `service_role` ausführbar. Sie erzeugt pro Besuchersitzung einen
  workspace-gebundenen Kontakt und eine Conversation und schreibt ausschließlich
  eingehende Nachrichten in die bestehende Admin-Inbox.
- Der idempotente Receipt speichert keinen Nachrichtentext. Rohes Sitzungstoken
  und rohe IP-Adresse werden weiterhin nicht persistiert.
- Es gibt keinen OpenAI-Aufruf, keine Antwort an den Besucher, keinen Outbound-
  Transport und kein automatisches Senden.
- Die vorbereitete Ingestion besitzt noch keinen atomaren
  Processing-Entitlement-Check im Datenbank-RPC. Deshalb bleibt jede
  Installation unabhängig von den übrigen Nachweisen deaktiviert, bis der RPC
  aktive Verarbeitung und Mutation in derselben Transaktion fail-closed bindet.
- Das vorbereitete Script `/website-chat/widget.js` arbeitet in einem Shadow
  DOM, setzt keine Cookies und nutzt weder Local Storage noch Session Storage.
  Installations-ID und Consent-Version kommen aus begrenzten Embed-Attributen;
  der Consent ist nie vorangekreuzt. Das Sitzungstoken bleibt nur im Speicher.
  Jede Nachricht erhält eine neue Client-UUID. Das Widget bestätigt nur den
  Eingang und bezeichnet sich deshalb ehrlich als Nachricht/Anfrage, nicht als
  Zweiweg-Chat.

## Aktivierungsreihenfolge

1. Migration ausschließlich im isolierten Supabase-Staging anwenden.
2. RLS, Grants, Fremdschlüssel, Indizes und Security Advisors prüfen.
3. mindestens eine synthetische Installation und eine verifizierte Test-Origin
   serverseitig anlegen;
4. `FANMIND_WEBSITE_CHAT_SESSION_SECRET` als getrenntes Staging-Secret setzen;
5. erlaubte und verbotene Origins sowie Consent, Rate Limit und Ablauf im
   Browser testen;
6. Ingestion-Migration im isolierten Staging anwenden und mit synthetischer
   Sitzung auf Kontakt-, Conversation-, Nachrichten- und Inbox-Zuordnung sowie
   Idempotenz prüfen;
7. das sichtbare Einweg-Widget mit gültiger Installation, Consent, Retry und
   verbotener Origin im Browser prüfen;
8. den Ingestion-RPC um einen atomaren, DB-verifizierten aktiven
   Workspace-Processing-Check erweitern und in Staging abnehmen;
9. erst nach Rechts- und Datenschutzabnahme die konkrete Installation
   aktivieren.

Production bleibt bis zur Staging-, Rechts- und Datenschutzabnahme deaktiviert.

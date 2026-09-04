# Website Chat Security Foundation

Status: Session, processing-gebundene Nachrichteningestion, cookie-freies
Widget und menschliche Übergabe mit freiwilliger E-Mail-Adresse im Repository
vorbereitet, nicht in der Datenbank angewandt und nicht produktiv aktiviert.
Production hat damit weiterhin noch keinen atomaren
  Processing-Entitlement-Check; bis zum kontrollierten Staging-Apply und der
Abnahme bleibt jede Website-Chat-Installation deaktiviert.

Roadmap-Zuordnung: Phase 8 – Website-KI-Assistent.

Das Zielbild ist ein Code-Snippet, das FanMind-Nutzer in ihre Website
einfügen. Der Assistent beantwortet Besucherfragen mit KI. Wenn die KI nicht
verlässlich weiterkommt, übergibt sie die Anfrage samt vollständigem
Gesprächsverlauf an den zuständigen FanMind-Nutzer. Hinterlässt der Besucher
nach ausdrücklicher Einwilligung seine E-Mail-Adresse, kann der Nutzer aus
FanMind antworten und die Antwort wird an diese Adresse zugestellt.

Die aktuelle Grundlage deckt Installation, Consent, Sitzung, eingehende
Nachrichten und deren Zuordnung zu Kontakt, Conversation und Inbox ab. Die
vorbereitete zweite Stufe bindet die Ingestion zusätzlich atomar an den
Workspace-Processing-Vertrag. Nach mindestens einer gespeicherten Nachricht
kann der Besucher genau einmal eine menschliche Antwort anfordern und dafür
eine E-Mail-Adresse mit eigener Zweck-Einwilligung hinterlassen. Derselbe
Kontakt und dieselbe Conversation werden als dringende Übergabe markiert; die
bereits bestehende Fan-Detail-Timeline zeigt ihre gespeicherten Nachrichten
vollständig an. Die E-Mail-Adresse bleibt unbestätigt.

Noch offen sind KI-Antworten, Unsicherheits-gesteuerte automatische Übergabe,
E-Mail-Verifizierung und der manuell freigegebene Antwortversand. Automatisches
Senden im Namen des FanMind-Nutzers bleibt ausgeschlossen.

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
- Die kontrollierte zweite SQL-Stufe ersetzt die ursprüngliche Ingestion durch
  `ingest_website_chat_message_v2`. Sie prüft Sitzung, exakte verifizierte
  Origin und den kanonischen Workspace-Processing-Vertrag in derselben
  Transaktion. Der alte service-role-Aufruf wird beim kontrollierten Cutover
  entzogen. Zusätzlich prüft die Anwendung das Processing-Entitlement bereits
  vor Session, Nachricht und Übergabe fail-closed.
- `website_chat_handoffs` ist RLS-aktiviert, besitzt keine Browser-Policy und
  ist nur für `service_role` erreichbar. Pro Sitzung ist höchstens eine
  Übergabe möglich. Die Adresse wird am zugehörigen Website-Kontakt geführt;
  der getrennte Übergabenachweis speichert nur ihren SHA-256-Fingerprint,
  Zweck/Version/Zeit der Einwilligung sowie CRM-Referenzen. Weder
  Sitzungstoken noch IP-Adresse werden persistiert.
- Die am Website-Kontakt geführte E-Mail-Adresse folgt dem bestehenden
  Kontakt-/Workspace-Lebenszyklus. `expires_at` im getrennten
  Übergabenachweis ist bis zur Implementierung eines kontrollierten
  Löschlaufs nur ein Löschziel und kein Beleg einer bereits ausgeführten
  Löschung.
- Eine Übergabe ist erst nach einer bereits gespeicherten Nachricht derselben
  gültigen Sitzung möglich. Sie erzeugt nur eine interne Timeline-Notiz,
  markiert die vorhandene Conversation als `high` und setzt den nächsten
  Schritt auf persönliche E-Mail-Antwort. Sie versendet nichts.
- Das vorbereitete Script `/website-chat/widget.js` arbeitet in einem Shadow
  DOM, setzt keine Cookies und nutzt weder Local Storage noch Session Storage.
  Installations-ID und Consent-Version kommen aus begrenzten Embed-Attributen;
  der Consent ist nie vorangekreuzt. Das Sitzungstoken bleibt nur im Speicher.
  Jede Nachricht erhält eine neue Client-UUID. Nach erfolgreicher Nachricht
  zeigt das Widget die getrennte freiwillige E-Mail-Einwilligung und nutzt eine
  eigene Übergabe-UUID. Das Widget bestätigt nur Speicherung/Übergabe und
  bezeichnet sich deshalb ehrlich als Nachricht/Anfrage, nicht als
  Zweiweg-KI-Chat.

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
8. `npm run db:website-chat-handoff:check` ausführen und die kontrollierte,
   checksum-gebundene Handoff-Stufe über den manuellen, exakt an `main` und
   isoliertes Staging gebundenen Workflow
   `website-chat-handoff-staging.yml` zunächst read-only prüfen und erst nach
   eigener Freigabe anwenden;
9. Message-v2 und Handoff mit aktiver/inaktiver Verarbeitung, abgelaufener
   Sitzung, Wiederholung, fehlender Nachricht und ungültiger E-Mail
   über `website-chat-handoff-staging-acceptance.yml` rollback-only in
   isoliertem Staging abnehmen; der genaue Ablauf steht in
   `docs/operations/WEBSITE_CHAT_HANDOFF_STAGING.md`;
10. Widget-Übergabe im Browser prüfen und bestätigen, dass weder KI- noch
   E-Mail-Provider aufgerufen werden;
11. erst nach Rechts- und Datenschutzabnahme die konkrete Installation
   aktivieren.

Production bleibt bis zur Staging-, Rechts- und Datenschutzabnahme deaktiviert.

# FanMind Webhook-, Diagnose- und Log-Retention

## Ziel

Technische Webhook- und Fehlerdiagnosen müssen datensparsam, zeitlich begrenzt und reproduzierbar betrieben werden. Dieser Bereich ist strikt von fachlichen CRM-Daten getrennt.

Nicht Teil dieser Retention sind:

- Kontakte;
- Konversationen und Nachrichten;
- Kontaktwissen;
- Follow-ups;
- Rechnungen und Billing-Daten;
- Backups;
- Social-Connection-Credentials.

## Geprüfter Ausgangsstand

Der read-only Production-Audit für Issue `#695` hat bestätigt:

- Meta- und Telegram-Webhook-Secrets sind konfiguriert;
- `meta_webhook_events` existierte, enthielt beim Audit aber keine Zeilen;
- `server_error_events` und `server_error_groups` waren nicht deployt;
- nginx besaß bereits eine eigene Logrotate-Policy;
- journald besaß noch keine explizite Größen- oder Zeitgrenze;
- bestehender Code konnte Rohpayloads, Nachrichtentext, externe IDs und freie Fehlermeldungen in Diagnosepfade übernehmen;
- fehlende Meta-/Telegram-Secrets wurden in Production nicht konsequent fail-closed behandelt.

Es gab deshalb keine bestehende Production-Altlast, die vor der Codehärtung gelöscht werden musste.

Ein späterer, gezielter PM2-Nachaudit in PR `#699`, Run `30043749121`, hat zusätzlich nachgewiesen:

- das etablierte PM2-Modul `pm2-logrotate` läuft online;
- `max_size=10M`, `retain=14`, Kompression und tägliche Rotation sind aktiv;
- parallel war die beim Retention-Rollout installierte Datei `/etc/logrotate.d/fanmind-pm2` vorhanden.

Diese doppelte Zuständigkeit wurde als eigener Fehler in `#700` behandelt. Das bestehende PM2-Modul bleibt die einzige PM2-Logrotationsquelle; die systemweite PM2-Regel wird aus Repository und Production entfernt.

## Webhook-Authentifizierungsgrenze

### Meta

- `FACEBOOK_WEBHOOK_VERIFY_TOKEN` beziehungsweise der dokumentierte Legacy-Fallback ist für die Verifikation erforderlich.
- `FACEBOOK_APP_SECRET` beziehungsweise der dokumentierte Legacy-Fallback ist für POST-Signaturen erforderlich.
- In Production führt ein fehlendes oder zu kurzes Secret zu HTTP 503.
- Eine falsche oder syntaktisch ungültige HMAC-Signatur führt zu HTTP 403.
- Der Vergleich erfolgt zeitkonstant.
- Request-Bodies sind auf 1.000.000 Bytes begrenzt.

### Telegram

- `TELEGRAM_WEBHOOK_SECRET` ist in Production erforderlich.
- Fehlende Konfiguration führt zu HTTP 503.
- Ein falscher Header führt zu HTTP 401.
- Request-Bodies sind auf 1.000.000 Bytes begrenzt.

### WhatsApp Cloud API

- der getrennte Inbound-Pfad ist standardmäßig aus und in Production
  unabhängig vom Flag verboten;
- `WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN` und `WHATSAPP_CLOUD_APP_SECRET` sind
  eigene Pflichtwerte ohne Facebook-/Instagram-/Meta-Fallback;
- Meta überträgt `hub.verify_token` für den GET-Handshake notwendigerweise in
  der Query. Die exakte Staging-nginx-Location `/api/webhooks/whatsapp` setzt
  deshalb `access_log off` und route-lokal `error_log /dev/null crit`; die
  Host-Provisionierung zählt dabei auch dezimal äquivalente Listener wie
  `0443` oder `Adresse:0443`, bindet diesen einmaligen Block, das exakte
  `listen 443 ssl;`, höchstens einen zusätzlichen SSL-IPv6-Listener, den
  Staging-Host und die Zertifikatdirektiven strukturell an denselben eindeutigen
  Port-443-Server. Der Block erlaubt nur die zehn versionierten Log-, Proxy-
  und Headerdirektiven; zusätzliche oder gesplittete Direktiven und Rewrites
  auf Location- oder TLS-Serverebene blockieren. Schutz nur im HTTP-vHost
  genügt nicht;
- POST prüft maximal 256 KiB Raw-Bytes zeitkonstant gegen
  `X-Hub-Signature-256`, bevor UTF-8 oder JSON dekodiert werden;
- technische Ausgaben und Diagnosezeilen enthalten nur feste Fehlerklassen,
  begrenzte Zähler und Booleans, niemals Raw-Body, Text, Namen,
  Telefonnummern, Provider-IDs, Signaturen, Challenge, vollständige Query oder
  Secrets;
- jedes künftig vorgeschaltete CDN, WAF oder Load-Balancer muss eine
  gleichwertige Query-Redaktionsgrenze nachweisbar umsetzen;
- Controlled Migration, isoliertes Staging und externe Meta-/Legal-Abnahme
  bleiben vor jeder Aktivierung verpflichtend.

Öffentliche Antworten enthalten nur stabile Fehlerklassen. Provider-, Datenbank- oder Credential-Details werden nicht zurückgegeben.

## Minimierter Meta-Diagnosevertrag

Neue Zeilen in `meta_webhook_events` dürfen ausschließlich technische Strukturmerkmale enthalten:

- Plattform und Eventtyp;
- Richtung und Nachrichtenart;
- ob Text, URL oder Identifikatoren vorhanden waren;
- Anzahl und Typen von Anhängen;
- rekursiv minimierte Provider-Struktur ohne Rohwerte;
- stabiler Status und optionaler maschinenlesbarer Fehlercode;
- Zeitstempel und interne Workspace-/Connection-Zuordnung.

Die folgenden Spalten müssen bei neuen Diagnosezeilen immer `NULL` sein:

- `page_id`;
- `sender_id`;
- `recipient_id`;
- `text`;
- `message_text`;
- `message_id`.

`raw_payload` enthält keine Rohtexte oder IDs. Strings werden nach Feldklasse durch Marker wie `[text_present]`, `[identifier_present]`, `[url_present]` oder `[redacted]` ersetzt. Objekttiefe, Schlüsselanzahl und Arraylänge sind begrenzt.

Die additive Datenbank-Constraint wird als `NOT VALID` angelegt. Dadurch werden historische Zeilen nicht automatisch verändert, während jede neue oder aktualisierte Zeile den minimierten Vertrag erfüllen muss.

## Sichere Fehlercodes

Erlaubte Diagnosecodes sind fest in `src/lib/webhookSecurityPolicy.mjs` definiert. Freie Provider- oder Supabase-Fehlermeldungen dürfen weder in öffentlichen Antworten noch in Webhook-Logs oder Diagnosezeilen übernommen werden.

Beispiele:

- `invalid_signature`;
- `workspace_not_configured`;
- `connection_lookup_failed`;
- `message_persist_failed`;
- `conversation_sync_failed`;
- `diagnostic_persist_failed`.

## Datenbank-Retention

Migration:

```text
supabase/migrations/20260723184500_webhook_diagnostic_retention.sql
```

RPC:

```text
public.manage_meta_webhook_event_retention(
  p_retention_days integer,
  p_limit integer,
  p_execute boolean
)
```

Eigenschaften:

- ausschließlich `service_role` darf den RPC ausführen;
- Standard-Retention: 30 Tage;
- Standard-Maximalmenge: 500 Zeilen pro Lauf;
- harte Obergrenze: 5.000 Zeilen;
- Dry-Run mit `p_execute=false`;
- Execute mit `p_execute=true`;
- Auswahl immer nach `created_at, id`;
- konkurrierende Läufe verwenden `FOR UPDATE SKIP LOCKED`;
- Ergebnis enthält nur Kandidatenzahl, Löschzahl und `has_more`;
- kein unbounded `DELETE`;
- keine andere Tabelle wird durch den Meta-RPC verändert.

`manage_server_error_event_retention` ist rein additiv vorbereitet. Fehlt die optionale Tabelle, liefert der RPC `table_present=false` und verändert nichts.

### WhatsApp-Receipt-Tombstones

Die nicht angewendete WhatsApp-Controlled-Migration besitzt einen getrennten
Idempotenzvertrag, der vom bestehenden Meta-Diagnose-Retention-Worker nicht
gelöscht wird. Wird eine fachliche CRM-Nachricht gelöscht, setzt der
zusammengesetzte Fremdschlüssel des zugehörigen Receipts ausschließlich
`conversation_message_id` auf `NULL`. Social-Connection-ID,
`phone_number_id`, WAMID und der SHA-256-Fingerprint des exakt normalisierten
Payloads bleiben als Tombstone erhalten, damit ein Provider-Retry keine bereits
gelöschte Nachricht erneut anlegt. Das Löschen des Workspaces oder der Social
Connection entfernt den Receipt dagegen per Cascade.

Dieser technische Anti-Resurrection-Vertrag ist noch keine freigegebene
Aufbewahrungsfrist. Vor einem realen Staging-Pilot mit Meta-Testkonto müssen
Rechtsgrundlage, transparente Information, Betroffenenrechte, konkrete Frist,
begrenzter Löschlauf und eine gegebenenfalls erforderliche irreversible
Pseudonymisierung extern beschlossen und im Retention- sowie
Freigaberegister nachgeführt werden. Bis dahin bleiben Migration, Feature-Flag
und Providerbetrieb dormant; Production ist technisch verboten.

## Worker und Timer

Worker:

```text
scripts/operations/webhook-diagnostic-retention.mjs
```

Manueller Dry-Run:

```bash
sudo -n env FANMIND_ENV_FILE=/var/www/fanmind/.env.production \
  /usr/bin/node /usr/local/lib/fanmind-ops/webhook-diagnostic-retention.mjs
```

Begrenzter Execute-Lauf:

```bash
sudo -n env FANMIND_ENV_FILE=/var/www/fanmind/.env.production \
  /usr/bin/node /usr/local/lib/fanmind-ops/webhook-diagnostic-retention.mjs --execute
```

Der Worker gibt ausschließlich aggregierte Zähler aus. Supabase-URL, Service-Role-Key, Payloads, IDs, Nachrichten und Fehlerdetails werden nicht ausgegeben.

Systemd-Dateien:

- `fanmind-webhook-retention.service`;
- `fanmind-webhook-retention.timer`.

Das Deployment installiert beide Dateien. Die erstmalige Aktivierung war erst nach Backup, Migration, Rechteprüfung, Dry-Run und begrenztem Production-Lauf zulässig. Der Timer ist nach dieser Abnahme aktiv.

## PM2- und journald-Grenzen

### PM2 — genau eine Rotationsquelle

Die einzige zulässige PM2-Logrotationsquelle ist das bereits installierte PM2-Modul `pm2-logrotate`.

Produktiv geprüfter Vertrag:

- Modulstatus: online;
- maximale Dateigröße: 10 MiB;
- Aufbewahrung: 14 Rotationen;
- Kompression: aktiv;
- Zeitrotation: täglich.

Nicht zulässig sind parallele Regeln für dieselben PM2-Logdateien. Daher gilt:

- keine Repository-Datei `ops/logrotate/fanmind-pm2`;
- keine Production-Datei `/etc/logrotate.d/fanmind-pm2`;
- das normale Anwendungsdeployment installiert oder verändert keine PM2-Logrotate-Regel;
- das bestehende PM2-Modul wird durch diesen Retention-Block weder deinstalliert noch umkonfiguriert;
- PM2-Loginhalte werden bei Prüfungen weder gelesen noch ausgegeben.

Eine künftige Änderung an Größe, Retention, Kompression oder Zeitplan benötigt einen eigenen Operations-Review. Es darf niemals gleichzeitig ein PM2-Modul und eine systemweite Logrotate-Regel für dieselben Dateien geben.

### journald

Repository-Vorlage:

```text
ops/systemd/journald-fanmind.conf
```

Aktiver Vertrag:

- Kompression aktiv;
- `SystemMaxUse=512M`;
- `RuntimeMaxUse=128M`;
- `MaxRetentionSec=14day`.

Die journald-Grenze ist hostweit. Installation, `systemd-analyze cat-config`, Dienstneustart und anschließende Health-Prüfung erfolgen deshalb ausschließlich in einem kontrollierten Operations-Schritt.

## Production-Rollout

1. Fach-PR vollständig grün prüfen und mergen.
2. Exakten Release und gesunde Anwendung bestätigen.
3. Frisches verschlüsseltes Datenbank-Backup erzeugen.
4. `.age`-/`.age.sha256`-Paar checksum-only verifizieren.
5. Migration mit `psql -v ON_ERROR_STOP=1` anwenden.
6. Constraint, Funktionen und Rollenrechte prüfen.
7. Synthetische minimierte Diagnosezeile anlegen.
8. Rohwert-Inserts müssen durch die Constraint scheitern.
9. Dry-Run ausführen und ausschließlich Aggregatwerte prüfen.
10. Begrenzten Execute-Lauf ausführen; synthetische Probezeile muss entfernt werden.
11. Worker-Timer aktivieren und einmal kontrolliert starten.
12. journald-Drop-in getrennt installieren und validieren.
13. Bestehendes `pm2-logrotate`-Modul als einzige PM2-Quelle bestätigen; keine zweite Datei installieren.
14. `/api/version`, `/api/health`, Landingpage, Login und Registrierung prüfen.
15. Meta und Telegram mit fehlender beziehungsweise falscher Signatur prüfen; es darf keine Diagnose- oder CRM-Zeile entstehen.

## Bereinigung einer doppelten PM2-Regel

Eine festgestellte `/etc/logrotate.d/fanmind-pm2` wird nur in einem kontrollierten Operations-Schritt entfernt:

1. exakten Production-Release und gesunde Anwendung bestätigen;
2. `pm2-logrotate` ausschließlich über Modulstatus und redigierte Konfiguration als online prüfen;
3. die systemweite Datei entfernen, ohne Logdateien zu lesen oder zu löschen;
4. bestätigen, dass keine zweite PM2-Logrotate-Datei verbleibt;
5. PM2-App nicht neu starten, sofern kein echter Fehler dies erfordert;
6. journald-Konfiguration unverändert lassen;
7. Health und öffentliche Kernrouten erneut prüfen.

## Rollback

Bei einem Codeproblem:

1. Anwendung auf den vorherigen gesunden Release zurückrollen.
2. Health und Kernrouten prüfen.
3. Retention-Timer deaktivieren.
4. Die additive Tabelle, Constraint und RPCs zunächst bestehen lassen; sie verändern ohne Aufruf keine Daten.
5. Ursache in einem kleinen Folge-PR beheben.

Bei einem journald-Konfigurationsproblem:

1. journald-Drop-in aus dem vorab erzeugten Backup wiederherstellen oder entfernen.
2. Konfiguration mit `systemd-analyze cat-config` prüfen.
3. journald kontrolliert neu laden beziehungsweise starten.
4. FanMind-Health und Kernrouten erneut prüfen.

Eine entfernte doppelte PM2-Systemregel wird nicht als Rollback wiederhergestellt, solange das geprüfte `pm2-logrotate`-Modul online und unverändert ist. Ein Rückkehr zu zwei Rotationsmechanismen ist ausdrücklich verboten.

Die Migration wird nicht durch ein unkontrolliertes `DROP TABLE` zurückgerollt. CRM- und Billing-Daten werden niemals als Teil dieses Rollbacks gelöscht.

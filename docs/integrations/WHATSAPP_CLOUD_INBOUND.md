# WhatsApp Cloud API – kontrollierter Inbound-Pfad

Stand: 17. August 2026

## Status und Grenze

FanMind besitzt einen vorbereiteten, echten **Inbound-only**-Webhookpfad für
Textnachrichten der offiziellen WhatsApp Cloud API. Er ist standardmäßig aus,
in Production technisch verboten und wurde weder mit einem realen Meta-Konto
noch in Staging extern abgenommen. Die Controlled Migration wurde nicht
angewendet. Der Stand ist deshalb kein Live-Kanal und keine Verkaufsfreigabe.

Nicht enthalten sind:

- ausgehende Nachrichten, automatische Antworten oder ein Send-Endpunkt;
- History-Sync, Profilabfragen oder Medien-Downloads im Webhook;
- Scraping, QR-/Session-Nachbau oder WhatsApp-Passwörter;
- Provider-Netzwerkaufrufe;
- allgemeine Production-Aktivierung.

## Endpoint und Secrets

Der getrennte Endpoint lautet:

```text
GET|POST /api/webhooks/whatsapp
```

Er verwendet ausschließlich diese WhatsApp-spezifischen Serverwerte:

```text
WHATSAPP_CLOUD_WEBHOOK_VERIFY_TOKEN
WHATSAPP_CLOUD_APP_SECRET
FANMIND_WHATSAPP_CLOUD_INBOUND_ENABLED=true
```

Facebook-, Instagram- oder generische Meta-Secrets sind keine Fallbacks. Das
Feature-Flag wirkt nur bei `development`, `test` oder `staging`; bei
`FANMIND_RUNTIME_ENVIRONMENT=production` bleibt der Endpoint auch mit Flag
gesperrt.

GET akzeptiert nur `hub.mode=subscribe`, das exakt und zeitkonstant geprüfte
Verify-Token sowie eine begrenzte Challenge. POST akzeptiert nur JSON, liest
den Body über einen begrenzten Stream bis maximal 256 KiB und prüft danach
`X-Hub-Signature-256` als HMAC-SHA256 über exakt diese Raw-Bytes. Erst nach
erfolgreicher Signaturprüfung werden UTF-8 und JSON dekodiert.

Meta überträgt `hub.verify_token` beim GET-Handshake notwendigerweise als
Query-Parameter. Deshalb reicht Anwendungsredaktion allein nicht aus: der
versionierte Staging-vHost besitzt für exakt `/api/webhooks/whatsapp` eine
eigene nginx-Location mit `access_log off` und dem route-lokalen
`error_log /dev/null crit`. Die Host-Provisionierung zählt Portangaben nach
dezimaler Normalisierung einschließlich `0443` und `Adresse:0443`. Sie
akzeptiert genau einen strukturellen Port-443-Server nur dann, wenn das exakte
`listen 443 ssl;`, höchstens ein zusätzlicher SSL-IPv6-Listener, Hostname,
Zertifikatdirektiven und dieser einmalige Location-Block im selben TLS-Server
gebunden sind. Der Location-Block akzeptiert ausschließlich die zehn
versionierten Log-, Proxy- und Headerdirektiven; zusätzliche Rewrites,
Includes, interne Redirects oder gesplittete Direktiven sowie Request-Rewrites
auf TLS-Serverebene blockieren. Eine passende HTTP-Location kann einen generisch geloggten
TLS-vHost nicht freigeben; der Lauf stoppt dann fail-closed. Ein später
vorgeschaltetes CDN, WAF oder Load-Balancer muss dieselbe
Query-Redaktionsgrenze nachweisbar umsetzen. Für Production bleibt der Endpoint
unabhängig davon technisch verboten.

## Strikte Providerform

Verarbeitet wird ausschließlich die offizielle Grundform:

- `object = whatsapp_business_account`;
- begrenzte `entry[]`- und `changes[]`-Arrays;
- `change.field = messages`;
- `value.messaging_product = whatsapp`;
- `value.metadata.phone_number_id` als numerische Provider-ID;
- eingehende `messages[]` mit `from`, `wamid.*`, Sekunden-Zeitstempel,
  `type=text` und begrenztem `text.body`.

Kontaktnamen werden nur aus dem Kontakt mit exakt passender `wa_id` übernommen.
`display_phone_number` ist niemals ein Binding-Fallback. Nicht unterstützte
offizielle Nachrichtentypen und Delivery-Status werden begrenzt quittiert,
aber nicht als CRM-Nachricht gespeichert. Pro Request gelten feste Grenzen von
acht Entries, acht Changes je Entry, insgesamt 25 Nachrichten/Statusobjekten,
25 Kontakten je Change und vier unterschiedlichen `phone_number_id`-Werten.

## Tenant-Binding und Verarbeitungsgate

Eine Nachricht wird nur dann verarbeitet, wenn `phone_number_id` exakt eine
aktive Zeile in `social_connections` findet:

```text
platform=whatsapp
provider=meta_whatsapp_cloud
status=connected
webhook_subscribed=true
page_id=<exakte phone_number_id>
```

Die Controlled Migration erzwingt die globale Eindeutigkeit einer aktiven
WhatsApp-Cloud-`phone_number_id`. Der Resolver liest maximal zwei Treffer und
stoppt bei null, Mehrdeutigkeit, Schemafehlern oder fehlender Service Role.
Vor Claim und nochmals atomar beim Speichern gilt dasselbe kanonische
`workspace_processing_allowed_contract(...)`. Der atomare Store-RPC bildet
diese Regel nicht noch einmal nach, sondern ruft den DB-Vertrag mit allen acht
Workspace-Feldern auf. Damit bleiben auch der servergebundene `trusted_demo`-
Fall und ein bereits geclaimter Receipt konsistent: ein erlaubter Demo-Workspace
wird gespeichert und sein Receipt nicht irrtümlich dauerhaft storniert.
Archivierung, Vertragsende, abgelaufene Grace, Suspension, terminales Billing
oder unbekannte Zustände blockieren weiterhin fail-closed.

Es gibt keinen öffentlichen Binding-Endpunkt. Ein künftiger Staging-Operator-
Schritt muss die konkrete Meta-Ressource und den Owner/Admin separat prüfen;
der aktuelle Code wählt niemals automatisch die erste Ressource.

## Atomare Idempotenz und Begrenzung

Controlled Migration:

```text
supabase/controlled/20260817230000_whatsapp_cloud_inbound_foundation.sql
```

Sie wird von keinem normalen Deploy und von keinem Repository-Check
angewendet und darf nicht in `supabase_migrations.schema_migrations` stehen.
Sie setzt die vollständig angewendete, unabhängig geprüfte Member-Boundary
`20260816120000_workspace_member_data_boundary` hart voraus. Sie ergänzt:

- global eindeutige aktive `phone_number_id`-Bindung;
- eine Nachrichtenidentität aus konkreter Social Connection,
  `phone_number_id` und WAMID statt einer nur workspaceweiten externen ID;
- den SHA-256-Fingerprint des exakt normalisierten Inbound-Ereignisses auf
  Receipt und CRM-Nachricht;
- eine browsergesperrte, FORCE-RLS Receipt-Tabelle ohne direkte Rechte für
  `anon`, `authenticated` oder `service_role`;
- service-role-only Claim-, atomare Store-, Schema-State- und Disconnect-RPCs.

Jeder Claim erhält ein zufälliges Lease-Token. Ein abgelaufener alter Claim
kann einen neuen Versuch nicht abschließen. Der atomare Store-RPC sperrt die
konkrete Connection und den konkreten Receipt, prüft Lease, Connection,
Workspace, `phone_number_id`, WAMID und Fingerprint erneut und schreibt Kontakt,
Conversation, Message und Receipt in **einer** Datenbanktransaktion. Der
Fingerprint ist SHA-256 über die zwölf normalisierten Felder Plattform,
Quelltyp, Nachrichtentyp, Nachrichtenart, Richtung, Text, WAMID, Thread-ID,
Autorenlabel, `phone_number_id`, Sender-ID und sekundengenauen UTC-Zeitstempel.
Jedes Feld ist mit seiner UTF-8-Bytelänge gerahmt, sodass keine
Konkatenationsmehrdeutigkeit entsteht. Dieselbe Identity mit irgendeinem Drift
dieser normalisierten Werte wird beim Claim oder Store als
`idempotency_conflict` und öffentlich als HTTP 409 abgelehnt; sie wird weder
als Duplikat akzeptiert noch in eine andere Connection umgehängt.

Kontakt-Handle und externe Thread-ID werden intern zusätzlich mit der konkreten
Social-Connection-ID gebunden. Auch bei wiederverwendeten Telefonnummern oder
einer späteren Neuzuordnung kann daher keine Nachricht einen Kontakt oder Thread
einer anderen Connection verknüpfen. Fehler rollen den ganzen Store zurück; ein
Crash nach Commit wird beim nächsten identischen Provider-Retry als Duplikat
erkannt. Advisory Transaction Locks begrenzen gleichzeitig eintreffende
Nachrichten derselben Connection-/Phone-/WAMID- beziehungsweise Thread-Identity,
ohne Tenants zu vermischen.

Wird eine gespeicherte CRM-Nachricht fachlich gelöscht, setzt der zusammengesetzte
Receipt-Fremdschlüssel nur `conversation_message_id` auf `NULL`. Connection,
`phone_number_id`, WAMID und Payload-Fingerprint bleiben als Tombstone erhalten,
damit ein späterer Provider-Retry die gelöschte Nachricht nicht wieder auferstehen
lässt. Das Löschen des Workspaces oder der zugehörigen Social Connection löscht
den Receipt dagegen per Cascade. Diese technische Anti-Resurrection-Aufbewahrung
hat noch keine externe Rechts- oder Retention-Freigabe: Frist, Löschlauf,
Betroffenenrechte und eine gegebenenfalls erforderliche irreversible
Pseudonymisierung müssen vor einem realen Pilotbetrieb im Retention- und
Freigaberegister ausdrücklich beschlossen werden.

Offline-Prüfung, ohne Datenbankverbindung und ohne Apply:

```bash
npm run db:whatsapp-cloud-inbound:check
npm run test:whatsapp-cloud-inbound
```

## Geschützter Staging-Rollout – vorbereitet, nicht ausgeführt

Zwei ausschließlich manuell auslösbare, an den exakten `main`-Commit und die
geschützte GitHub-Umgebung `staging` gebundene Workflows sind vorbereitet:

```text
.github/workflows/whatsapp-cloud-inbound-staging-apply.yml
.github/workflows/whatsapp-cloud-inbound-staging-verify.yml
```

Beide verlangen voneinander verschiedene Bestätigungen, eine von Production
verschiedene App-, Supabase-Projekt-, Benutzer- und Datenbankbindung,
`verify-full` mit dem Repository-CA-Zertifikat sowie einen privaten
`PGPASSFILE`-Snapshot. Die Apply-Variante verlangt zusätzlich die explizite
Non-Production-Schreibbestätigung. Vor jedem Datenbankzugriff muss der genaue
Commit bereits auf Staging laufen und `/api/version` sowie `/api/health`
bestehen.

Verbindliche Reihenfolge:

1. Member-Boundary separat anwenden und unabhängig verifizieren.
2. Den gemeinsamen read-only `db:staging-rollout-state:run` prüfen; er muss
   `WORKSPACE_MEMBER_BOUNDARY=verify`, `WHATSAPP_CLOUD_INBOUND=apply` und
   insgesamt `PASS` melden.
3. WhatsApp-Apply ausführen. Der Runner prüft zuerst erneut die vollständige,
   checksum-gepinnte Member-Boundary, dann einen read-only Preflight. Nur der
   Zustand `absent` darf genau die checksum-gepinnte Transaktion ausführen;
   Misch- oder Teilzustände blockieren.
4. Der Apply-Runner führt nach dem Commit eine neue, unabhängige read-only
   Postflight-Verbindung aus. Danach muss der getrennte Verify-Workflow den
   gemeinsamen Rollout-State `WHATSAPP_CLOUD_INBOUND=verify` sowie nochmals
   Member- und WhatsApp-Postflight bestätigen.

Der Repository-Stand hat keinen dieser Workflows ausgeführt. Migration,
Endpoint und Flag bleiben deshalb unverändert dormant/unapplied. Die Workflows
enthalten weder Provider-Secrets noch Provider-, Outbound- oder Dispatch-Logik.

## Diagnose und Disconnect

Logs und `meta_webhook_events` erhalten nur feste Fehlerklassen, Zähler und
Booleans. Request-Body, Nachrichtentext, Name, Telefonnummern, IDs, Signatur,
Verify-Token, Challenge, vollständige Query und App Secret werden nicht
protokolliert. Für den unvermeidlichen GET-Query-Transport gilt zusätzlich die
oben beschriebene nginx-/Edge-Grenze. Der bestehende Webhook-Retentionvertrag
gilt weiter; der Receipt-Tombstone ist davon getrennt und benötigt vor echter
Aktivierung die ausdrücklich dokumentierte externe Retention-/Legal-Freigabe.

`disconnect_whatsapp_cloud_inbound_connection` ist service-role-only und
workspace-/connectiongebunden. Der RPC setzt die Verbindung auf
`disconnected`, löscht gespeicherte Tokenwerte, setzt
`webhook_subscribed=false`, deaktiviert Analytics und storniert offene
Receipts einschließlich Lease. Bereits gespeicherte CRM-Historie bleibt
lesbar. Weil dieser Repository-Stand keine Provider-Aufrufe ausführt, muss eine
spätere echte Abnahme das Unsubscribe im Meta Dashboard separat nachweisen;
weitere Provider-Callbacks werden nach dem lokalen Disconnect jedenfalls nicht
mehr ingestiert.

## Offene Aktivierungsgates

1. Member-Boundary und danach die Controlled Migration über die geschützten
   isolierten Staging-Workflows anwenden und getrennt read-only nachprüfen;
   Production bleibt unberührt.
2. Owner/Admin-gebundene Ressourcenauswahl für WABA und `phone_number_id`
   abnehmen; keine automatische Erstauswahl.
3. Synthetischen HMAC-, Tenant-, Duplicate-, Lease-Reclaim-, Disconnect- und
   Tombstone-/Cleanup-E2E im isolierten Staging ausführen. Dabei nginx sowie
   jedes vorgeschaltete Edge-System darauf prüfen, dass die GET-Query mit
   `hub.verify_token` in keinem Access- oder Error-Log erscheint.
4. Reales Meta-Testkonto, App Review/Advanced Access, Business Verification
   und WhatsApp-Cloud-API-Zugang abschließen.
5. Rechtsgrundlage, Transparenz, AVV/Transfer, Betroffenenrechte und die
   konkrete Receipt-Tombstone-Aufbewahrung einschließlich Löschlauf extern
   freigeben.
6. Erst danach kann ein eigener, workspacegebundener Pilot-Aktivierungsschritt
   entworfen werden. Ein normaler Deploy oder dieses Dokument aktiviert
   nichts.

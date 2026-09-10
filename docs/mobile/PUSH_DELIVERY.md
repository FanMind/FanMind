# Mobile Push Delivery – deaktivierter Staging-Vertrag

## Stand

Der bestehende **Delivery-Service** für genau eine Follow-up-Erinnerung ist
vorbereitet, aber nicht an eine Route, einen Timer, einen Cronjob oder einen
Worker angeschlossen. Er sendet im aktuellen Produktstand nichts.
`deliveryEnabled` bleibt in der öffentlichen Registrierungsantwort deshalb
`false`.

Standabgleich vom 10. September 2026: Die getrennte Staging-Datenbank und der
signierte FCM-Android-Preview sind bereits vorhanden. Auch der atomare
Delivery-Ledger wurde auf isoliertem Staging angewendet und mit synthetischen
Daten abgenommen (Belege unten). **Die echte Follow-up-Zustellung ist weiterhin
nicht implementiert und abgenommen:** Es fehlen die Verdrahtung des vorhandenen
Service mit einem geschützten Einzelsende-Auslöser und Receipt-Check, die reale
Geräte-/Provider-Abnahme sowie die getrennte produktive Versandsteuerung.
Eine Benachrichtigungsfreigabe am Telefon allein schließt diese Lücke nicht.

Zusätzlich ist repositoryseitig eine datenschutzarme Policy für ungesehene
eingehende Nachrichten vorbereitet. Sie kennt `message_received` und höchstens
einen `message_reminder` nach 30 Minuten und bindet den Notification-Tap im
nativen Client authentifiziert an den betroffenen Fan im Bereich
`Nachrichten`. Diese Policy besitzt **keinen** Provider-Sendpfad, keinen
Delivery-Ledger-Apply, keinen Timer/Worker und keine Production-Aktivierung.
Sie erweitert den bestehenden Push-Vertrag also nicht heimlich um Zustellung,
sondern bereitet nur Semantik, Minimalpayload und Navigation für eine spätere,
separat geschützte Staging-Integration vor.

Der vorhandene Follow-up-Baustein ist ausschließlich eine fail-closed Grundlage
für eine spätere, separat genehmigte Staging-Abnahme:

- `src/lib/mobilePushDeliveryPolicy.mjs` besitzt Gates, Autorisierung,
  Minimalpayload, feste kurze TTL und Retry-Zeitgrenzen;
- `src/lib/mobilePushDelivery.mjs` spricht ausschließlich die festen HTTPS-
  Endpunkte des Expo Push Service für Send-Tickets und Receipts an;
- `src/lib/mobilePushDeliveryTarget.ts` lädt mit `service_role` nur die zur
  Autorisierung notwendigen IDs, Status- und Fälligkeitsfelder und entschlüsselt
  den registrierten Expo-Token erst serverseitig;
- `tests/mobile-push-delivery.test.mjs` verwendet ausschließlich einen
  injizierten synthetischen Provider. Es findet kein externer Request statt.

Der CI-Test scannt zusätzlich ausführbare Quellen, Workflows und SQL. Jede
Route, jeder Worker/Timer, jede Migration oder sonstige Verdrahtung des
Delivery-Service bricht die Dormanz-Invariante, bis dafür ein eigener
genehmigter Aktivierungsschritt den Test bewusst ersetzt.

## Nachrichten-Push-Vorbereitung

Die vorbereitete Nachrichten-Policy liegt getrennt vom aktiven
Follow-up-Delivery-Service und verwendet den vorhandenen Unseen-Zustand
`direction=inbound` plus `seen_at is null`; ein zweiter Read-/Unread-Zustand
wird nicht eingeführt.

Für eine neu ungesehene eingehende Nachricht ist ausschließlich folgende
sichtbare Semantik vorbereitet:

```json
{
  "title": "FanMind",
  "body": "Du hast eine neue Nachricht.",
  "ttl": 3600,
  "data": {
    "type": "message_received",
    "contactId": "<uuid>",
    "section": "messages"
  }
}
```

Bleibt dieselbe Nachricht ungesehen, darf die Policy frühestens nach 30 Minuten
genau einen weiteren Kandidaten mit `type=message_reminder` und dem festen Text
`Eine Nachricht wartet noch auf dich.` ableiten. Weitere Erinnerungsschleifen
sind ausgeschlossen. Mehrere ungesehene Nachrichten desselben
Workspace-/Kontakt-Paars werden repositoryseitig auf den neuesten Kandidaten
aggregiert; Workspace- und Nachrichten-ID bleiben ausschließlich serverseitig
für Bindung und Idempotenz.

Der native Notification-Response-Handler akzeptiert für Nachrichten nur die
exakten drei Datenfelder `type`, `contactId`, `section`, verlangt eine
kanonische UUID, die feste Section `messages`, wartet auf eine gültige
Authentifizierung und navigiert dann zu genau diesem Kontakt. Fanname, Handle,
Nachrichtentext, Workspace-ID, Notizen, Tags oder KI-Inhalte werden als
Payload-Erweiterung abgelehnt.

Diese Vorbereitung ist absichtlich **Staging-only**. Vor jedem späteren realen
Send muss dieselbe atomare Delivery-Ledger-/Target-Revalidierungsgrundlage wie
beim Follow-up wiederverwendet und für den Nachrichtenfall separat geprüft
werden. Ein Merge dieses Codes darf weder als Staging-Send noch als
Production-Freigabe interpretiert werden.

## Harte Aktivierungsgrenzen

Jeder einzelne Sendversuch des bestehenden Follow-up-Delivery-Service muss alle
Grenzen gleichzeitig erfüllen:

1. `FANMIND_RUNTIME_ENVIRONMENT=staging`;
2. `FANMIND_MOBILE_PUSH_DELIVERY_ENABLED=true`;
3. die aktionsbezogene Bestätigung
   `deliver-mobile-followup-reminder-staging`;
4. die bestehenden Non-Production-Write-Gates;
5. der konfigurierte HTTPS-API-Host stimmt mit einem unabhängig übergebenen,
   zuvor geprüften Staging-Host (aktuell `staging.fanmind.ch`) überein;
6. Supabase-URL und konfigurierte Ziel-Ref stimmen mit einer unabhängig
   übergebenen, zuvor geprüften Staging-Ref überein; auch die konfigurierte
   Production-Ref muss einer unabhängig geprüften Production-Ref entsprechen,
   und beide geprüften Refs müssen verschieden sein;
7. die konfigurierte EAS-Projekt-ID stimmt mit einer unabhängig übergebenen,
   zuvor geprüften EAS-Projekt-ID überein;
8. ein ausschließlich serverseitiger Expo Access Token ist gesetzt;
9. URL, geprüfte Ziel-Ref und `service_role` werden als ein gemeinsamer,
   server-only Zielkontext an den Loader und als exakt dasselbe strukturell
   validierte Binding an `ledger.reserve` übergeben; weder Loader noch Ledger
   dürfen dafür eine zweite globale ENV-Quelle lesen;
10. ein persistenter atomarer Delivery-Ledger ist angeschlossen und bindet den
    aktuell gespeicherten Token-Fingerprint derselben Registrierung.

Production ist im Code strukturell nicht unterstützt. Auch
`FANMIND_MOBILE_PUSH_PRODUCTION_ACTIVATION_CONFIRMED=true` wird abgelehnt. Das
Ändern einer ENV oder das Mergen dieses Codes ist keine Production-Freigabe.

## Autorisierter Einzelsendefall

Der bestehende Follow-up-Trigger akzeptiert exakt fünf Felder: Workspace-ID,
User-ID, Follow-up-ID, ein explizites Fälligkeitsdatum als Cutoff und die
Staging-Bestätigung. Namen, Nachrichten, Notizen, Gründe, Handles oder frei
formulierter Text werden abgelehnt.

Vor einer Provideranfrage muss der Server exakt je eine passende Zeile
bestätigen:

- Owner- oder Member-Mitgliedschaft des Users im Workspace;
- aktiver, verarbeitungsberechtigter und nicht öffentlicher Demo-Workspace;
- offenes Follow-up desselben Workspace, dessen `due_date` spätestens am
  expliziten Cutoff liegt; ein Cutoff nach dem aktuellen Server-UTC-Datum wird
  fail-closed abgelehnt;
- Kontakt-ID und Workspace-ID des Follow-ups stimmen mit dem minimal geladenen
  Kontakt überein;
- aktive, nicht abgelaufene Registrierung desselben Users und Workspace;
- der entschlüsselte Token stimmt mit dem gespeicherten HMAC-Fingerprint der
  Registrierung überein; nicht kanonische oder abweichende Werte werden vor
  jeder Reservation abgelehnt;
- kanonischer, ohne Kalendernormalisierung roundtrip-fähiger ISO-Zeitpunkt der
  Registrierung, der höchstens 31 Tage in der Zukunft liegt;
- Registrierung und unabhängig geprüfte EAS-Projekt-ID stimmen exakt überein.

Die Follow-up-Erinnerungs-Payload ist fest und enthält nur:

```json
{
  "title": "FanMind",
  "body": "Ein Follow-up ist fällig.",
  "ttl": 3600,
  "data": {
    "type": "followup_reminder",
    "followupId": "<uuid>"
  }
}
```

Android ergänzt ausschließlich den festen Channel
`followup-reminders`. Kein CRM-Inhalt und keine Kontakt-/Workspace-ID gelangen
in sichtbaren Text, Providerdiagnosen, Rückgabewerte oder Logs. Der Baustein
schreibt selbst keine Logs und gibt ausschließlich feste Statuscodes zurück.
Die feste TTL von 3.600 Sekunden verhindert den sonst möglichen
Provider-Default von mehreren Wochen und damit eine lange verspätete,
inzwischen überholte Erinnerung.

## Idempotenz, Retry und Receipt

Vor dem ersten Providerbyte muss der verpflichtende Ledger in **derselben
Datenbanktransaktion** die Membership, Workspace-Verarbeitungsberechtigung,
Kontakt-/Follow-up-Zuordnung, offenen Status, Fälligkeit sowie aktive
User-/Workspace-/Projekt-Registrierung einschließlich ihres aktuellen
Token-Fingerprints erneut lesen und erst danach den deterministischen Schlüssel
aus Workspace, User, Follow-up, Registrierung, EAS-Projekt und Fälligkeitsdatum
reservieren. `ledger.reserve` erhält dazu exakt dasselbe bereits validierte
Supabase-URL-/Ref-/`service_role`-Binding wie der Loader. Die Reservation muss
den festen Revalidierungsvertrag, denselben Target-Hash, dieselbe Staging-
Projekt-Ref, denselben aktuellen Token-Fingerprint und einen kanonischen,
höchstens 60 Sekunden vom angeforderten Zeitpunkt abweichenden
Revalidierungszeitpunkt zurückgeben. Eine bloße Bestätigung der zuvor getrennt
gelesenen Werte oder ein Echo dieser Felder ist nicht ausreichend. Ein
bestehender oder laufender Schlüssel verhindert einen zweiten Provideraufruf.

- maximal drei explizit erneut ausgelöste Versuche;
- exponentiell begrenzte Retry-Zeitpunkte nur nach eindeutigem HTTP `429` oder
  `5xx` beziehungsweise `MessageRateExceeded`;
- ein Netzabbruch oder eine ungültige Antwort nach dem Request ist
  `indeterminate` und wird wegen möglicher Doppelzustellung nicht automatisch
  wiederholt;
- ein erfolgreiches Expo-Ticket wird mit seiner privaten Receipt-ID
  persistiert;
- jeder Receipt-Check muss zuerst eine persistente atomare Lease reservieren;
  `not_due`, `inflight` und terminale Versuche lösen keinen Provideraufruf aus;
- der persistierte Ticket-Zeitpunkt muss als kanonischer UTC-ISO-Zeitpunkt
  roundtrip-fähig sein; Zukunftswerte werden abgelehnt und nach 24 Stunden wird
  ohne Provideraufruf terminalisiert;
- Receipts werden frühestens nach 15 Minuten, maximal viermal und höchstens
  innerhalb des 24-Stunden-Fensters geprüft; weitere Read-Retries verwenden
  feste 15-Minuten-, 1-Stunden- und 6-Stunden-Abstände;
- `DeviceNotRegistered` muss in genau **einer** Datenbanktransaktion den
  reservierten Versuch terminalisieren und die konkrete Registrierung
  deaktivieren; zwei getrennte Ledger-Aufrufe sind wegen des Crash-Fensters
  unzulässig;
- Providertexte werden verworfen; nur feste, redigierte Fehlercodes dürfen in
  den Ledger.

Ein Expo-Receipt mit `status=ok` bestätigt nur die Übergabe an APNs oder FCM,
nicht die Anzeige auf dem Gerät. Grundlage sind die offiziellen
[Expo-Hinweise zu Tickets, Receipts und Retry](https://docs.expo.dev/push-notifications/sending-notifications/).

## Kontrollierter Ledger – isolierte Staging-Abnahme belegt

Der geschützte Staging-Pfad wurde für den exakten Commit
`18a6ad79cb72331b4daa41ee87dd2430a8ffd473` ausgeführt:

- [Staging-Apply 33867831888](https://github.com/FanMind/FanMind/actions/runs/33867831888),
  Job `101006621418`, erfolgreich;
- [Rollback-Abnahme 33867922978](https://github.com/FanMind/FanMind/actions/runs/33867922978),
  Job `101006906941`, erfolgreich mit synthetischen Zeilen, vollständigem
  Rollback und Cleanup; Provider-Versand blieb deaktiviert.

Diese Belege schließen die damalige Schema-/Transaktionsabnahme. Sie sind kein
aktueller Gerätebeleg und keine Freigabe für eine erneute Anwendung oder einen
echten Versand. Vor einem späteren Staging-Datenbankeingriff gilt weiterhin
der gemeinsame, nur lesende Rollout-Abgleich auf dem dann geprüften Commit.

`supabase/controlled/20260903190000_mobile_push_delivery_ledger.sql` stellt
eine checksum-gebundene, service-role-only Zustellhistorie mit atomarer
Target-Revalidierung, Idempotenz, Send-/Receipt-Leases, begrenzten Versuchen
und transaktionaler `DeviceNotRegistered`-Deaktivierung bereit. Der
server-only Adapter `src/lib/mobilePushDeliveryLedger.ts` bindet jeden RPC an
dasselbe validierte Staging-Ziel. Eine In-Memory-Map, ein Prozess-Lock oder das
Follow-up selbst bleiben ausdrücklich unzulässig.

Der kontrollierte SQL-Baustein ist auf isoliertem Staging angewendet. Der
Delivery-Service wird weiterhin von keiner Route, keinem Timer und keinem
Worker aufgerufen. Deshalb gibt es im aktuellen Produkt weiterhin keinen
Provideraufruf und keine reale Zustellung. Offline prüft
`npm run db:mobile-push-delivery-ledger:check` den exakten Hash und die
Sicherheitsgrenzen.

Der manuelle Workflow
`.github/workflows/mobile-push-delivery-ledger-staging.yml` ist an `main`, den
exakt geprüften Commit und das geschützte Environment `staging` gebunden. Die
Aktion `verify` mit `verify-mobile-push-delivery-ledger-schema` führt nur den
read-only Postflight aus. Die getrennte Aktion `apply` verlangt
`apply-mobile-push-delivery-ledger`, aktiviert ausschließlich für diesen Lauf
den Non-Production-Write-Guard und führt danach denselben Postflight aus.
Beide Wege prüfen Production-Zielabweichung, verwenden eine private
`PGPASSFILE` und enthalten weder Expo-Zugang noch Provideraufruf. Die obigen
Läufe dokumentieren den bereits abgeschlossenen Apply und die Abnahme;
dieser Dokumentationsabgleich führt keinen Workflow erneut aus.

Der Service ist allein nicht aktivierbar: Vor einem realen Staging-Send müssen
die unabhängig geprüften App-, Staging-Supabase-, Production-Supabase- und
EAS-Bindings serverseitig übergeben werden. Die bereits abgenommene
Ledger-Grundlage muss dabei wiederverwendet und vor der Aktion aktuell geprüft
werden; ihre vorhandene Installation ist kein Auftrag für ein weiteres Apply.
Der Baustein enthält eine service-role-only Tabelle mit eindeutigem
Idempotenzschlüssel, Versuchsnummer, Send- und Receipt-Reservation/Lease,
Receipt-Zähler, redigiertem Zustand, privater Receipt-ID,
Retry-/Receipt-Zeitpunkten und definierter Aufbewahrung. Die
Reserve-RPC muss mit dem vom Service strukturell validierten gemeinsamen
Zielbinding arbeiten, die oben genannten Target-Grenzen und den aktuellen
Token-Fingerprint in derselben Transaktion erneut prüfen und den festen
Revalidierungsvertrag samt Target-Hash, Staging-Projekt-Ref, Token-Fingerprint
und frischem kanonischem Zeitpunkt liefern. Der `DeviceNotRegistered`-Pfad muss
Attempt-Terminalisierung und Registrierungsdeaktivierung ebenfalls atomar unter
der jeweils reservierten Send- oder Receipt-Lease ausführen. RLS,
Browserentzug, Konfliktverhalten und Cleanup müssen in einer rollback-only
Staging-Acceptance bewiesen werden. Der dafür vorbereitete manuelle Workflow
`.github/workflows/mobile-push-delivery-ledger-staging-acceptance.yml`
verlangt die getrennte Bestätigung
`run-mobile-push-delivery-ledger-acceptance`. Er prüft Browser-Denial,
Reservation/Lease-Exklusivität, Ticket-/Receipt-Übergang und die atomare
`DeviceNotRegistered`-Deaktivierung ausschließlich mit synthetischen
Staging-Zeilen in einer vollständig zurückgerollten Transaktion. Er enthält
weder Providerzugang noch Sendepfad. Die PostgreSQL-Abnahme dieses Vertrags ist
durch den oben verlinkten Lauf belegt; eine reale Push-Abnahme folgt daraus
nicht.

## Konkrete verbleibende Schritte

1. Den vorhandenen Service und Ledger mit einem geschützten serverseitigen
   Einzelsende-Auslöser und Receipt-Check verbinden und diese Integration
   prüfen. Es gibt dafür derzeit keinen ausführbaren Produktpfad. Der erste
   Staging-Pfad bleibt ohne Timer und ohne automatische Wiederholung.
2. Den bereits signierten FCM-Preview auf dem eigenen Android-Testgerät
   verwenden: Commit `6801d687cfe6048d6e32e63bcfe2862d2886fce0`,
   [Build 34037085683](https://github.com/FanMind/FanMind/actions/runs/34037085683).
   Benachrichtigungen ausdrücklich erlauben und eine aktuelle aktive
   Registrierung auf isoliertem Staging nachweisen. Kein weiterer Build ist
   allein für diesen Schritt nötig. Der am 8. September protokollierte
   Nullbestand ist kein aktueller Registrierungsnachweis.
3. Nach eigener, konkreter Freigabe genau eine Erinnerung für ein synthetisches
   Staging-Follow-up an dieses Testgerät senden. Ticket und Receipt speichern,
   die tatsächliche Anzeige und den Tap zum richtigen Follow-up beobachten
   sowie Token-Widerruf und Datenschutzgrenzen abnehmen.
4. Den produktiven Versand einschließlich Auslösung fälliger Follow-ups
   gesondert implementieren, prüfen und freigeben. Der bestehende Service
   unterstützt ausschließlich Staging; ein ENV-Schalter allein kann ihn
   nicht produktiv aktivieren.

Bis diese Schritte nachgewiesen sind, bleibt „Push für Follow-up-Erinnerungen“
offen. Weder ein grüner Android-Build noch eine synthetische Ledger-Abnahme
ersetzt den realen Empfang am Gerät.

# Mobile Push Registration – kontrollierte Vorbereitung

## Ziel und Grenze

FanMind bereitet Push-Erinnerungen ausschließlich als ausdrückliches Opt-in
für angemeldete Nutzer außerhalb aller öffentlichen Demo-Workspaces vor. Dieser
Stand registriert höchstens ein Android- oder iOS-Gerät pro Konto. Er sendet
keine Push-Nachricht und aktiviert keinen Timer, Worker oder
Expo-Delivery-Aufruf.

## Sicherheitsvertrag

- Mobile verwendet nur den eigenen Supabase-Bearer-Token.
- Die API akzeptiert ausschließlich `X-FanMind-Client: mobile`.
- Öffentliche Demo-Workspaces und Nutzer ohne bestätigten Owner- oder
  Mitglieds-Workspace werden abgelehnt.
- Status, Registrierung und Widerruf werden immer an User und aktuell
  autorisierten Workspace gebunden; alte Workspace-Bindungen werden
  ausdrücklich bereinigt oder bei einer neuen Registrierung ersetzt.
- Request-Bodies werden auch ohne `Content-Length` beim Streamen hart auf
  4096 Byte begrenzt.
- Eine neue Registrierung akzeptiert nur die serverseitig über
  `FANMIND_MOBILE_PUSH_EAS_PROJECT_ID` freigegebene EAS-Projekt-ID.
- Expo-Push-Token werden vor jeder Persistenz mit einem dedizierten
  32-Byte-Key per AES-256-GCM verschlüsselt.
- Ein keyed HMAC verhindert doppelte Token, ohne Tokenwerte auszugeben.
- Es gibt höchstens eine aktive Registrierung pro Auth-Nutzer.
- Registrierungen laufen nach 30 Tagen ab und werden bei der nächsten
  Statusabfrage oder Registrierung desselben Tokens bereinigt.
- Logout versucht die Registrierung vor dem lokalen Session-Purge zu löschen;
  der lokale Logout bleibt auch bei einem Netzfehler möglich.
- Account- oder Workspace-Löschung entfernt die Zeile per Foreign-Key-Cascade.
- API-Antworten enthalten weder Token, Hash, Ciphertext, User-ID noch
  Workspace-ID.

## Noch nicht automatisch angewendet

Der Web-Deploy führt keine Supabase-Migration aus. Vor einem echten
Registrierungstest sind getrennt erforderlich:

1. Zielprojekt und Umgebung eindeutig als Nicht-Production oder ausdrücklich
   freigegebenes Ziel bestätigen.
2. Migration
   `supabase/migrations/20260729120000_mobile_push_registrations.sql`
   kontrolliert anwenden.
3. einen eigenen zufälligen 32-Byte-Key als
   `FANMIND_PUSH_TOKEN_ENCRYPTION_KEY` ausschließlich serverseitig setzen.
4. dieselbe bestätigte EAS-Projekt-ID serverseitig als
   `FANMIND_MOBILE_PUSH_EAS_PROJECT_ID` setzen.
5. EAS-Projekt-ID und öffentliche Mobile-Umgebung über den bestehenden
   Read-only-Ressourcencheck bestätigen.
6. signierten Development-/Preview-Build verwenden.
7. Opt-in, Ablehnung, Registrierung, erneute Registrierung, Opt-out, Logout,
   Konto-/Workspace-Trennung und 30-Tage-Ablauf mit Testkonten prüfen.

Für die Schritte 1 bis 5 ist jetzt ein eigener, checksum-gebundener und strikt
Staging-only Kontrollpfad vorbereitet. Er trennt:

1. den read-only Ressourcencheck
   `FanMind Mobile Push Staging Resource Readiness`;
2. den separat bestätigten Apply
   `FanMind Mobile Push Staging Migration`;
3. die rollback-only Abnahme
   `FanMind Mobile Push Staging Acceptance`.

Alle drei Workflows laufen nur von `main`, verlangen zusätzlich den exakten
manuell geprüften Commit und verwenden das geschützte GitHub-Environment
`staging`. API-Ursprung, Supabase-Ref und DB-Host werden jeweils gegen die
bestätigten Production-Ziele geprüft. Die Acceptance nutzt einen synthetischen
Nicht-Demo-Workspace mit unterschiedlichem Owner und Mitglied
sowie eine synthetische Geräte-ID. Browserzugriffe müssen scheitern;
service-role CRUD wird vollständig zurückgerollt und anschließend auf Cleanup
geprüft. Weder echte Expo-Tokens noch Push-Versand, EAS-Builds oder
Delivery-Aktivierung gehören zu diesem Ablauf.

Verbindliches Runbook:
`docs/operations/MOBILE_PUSH_STAGING_CONTROL.md`.

Keine Secret- oder Tokenwerte in Logs, Screenshots, Issues oder Chat kopieren.
Expo verlangt für Remote-Push unter aktuellem Android einen eigenen
Development-/Preview-Build; Expo Go ist dafür nicht der Freigabenachweis.

## Separate spätere Zustellungsphase

Ein kleiner, standardmäßig deaktivierter Delivery-Baustein ist inzwischen als
synthetisch getesteter Staging-Vertrag vorbereitet. Er besitzt keine Route,
keinen Timer/Worker und keinen persistenten Ledger und sendet daher nichts.
Seine verbindlichen Grenzen stehen in `docs/mobile/PUSH_DELIVERY.md`. Er:

- nur fällige, offene Follow-ups des gebundenen Workspace berücksichtigen;
- generische Titel/Texte ohne Kontaktname, Nachricht, Notiz oder CRM-Inhalt
  mit fester einstündiger TTL verwenden;
- nur Payloads mit `type=followup_reminder` und `followupId` senden;
- abgelaufene, abgemeldete oder fremde Registrierungen fail-closed verwerfen;
- Expo-/FCM-/APNs-Fehler redigieren und ungültige Token sicher entfernen;
- Duplikate und wiederholte Zustellung verhindern;
- ohne automatische Nachricht an Kontakte auskommen.

Vor dem ersten realen Staging-Send bleibt ein separat genehmigter atomarer
Delivery-Ledger samt kontrollierter Migration und rollback-only Acceptance
Pflicht. Seine Reserve-RPC muss Membership, Workspace-Verarbeitung, Kontakt,
Follow-up und Registrierung innerhalb derselben Datenbanktransaktion erneut
prüfen. Ein Provider-Ergebnis `DeviceNotRegistered` muss Attempt und konkrete
Registrierung unter derselben Send- oder Receipt-Lease atomar terminalisieren
beziehungsweise deaktivieren. Zusätzlich müssen EAS-Projekt,
`staging.fanmind.ch`, die Staging-
Supabase-Ref und die davon verschiedene Production-Supabase-Ref unabhängig
geprüft und serverseitig gebunden sein. Production-Aktivierung ist weiterhin
ausgeschlossen.

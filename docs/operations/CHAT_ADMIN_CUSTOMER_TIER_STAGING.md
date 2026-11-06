# ChatAdmin: Kundenstatus und vollständige Staging-Abnahme

Am 13. Oktober 2026 bestätigt die reine Katalogprüfung auf `vshyhvgcmrlagvfnvomc`
den vollständigen ursprünglichen Fan-Vertrag, aber keine `customer_tier`-Spalte.
Die aktuelle Fan-Listenroute fragt diese Spalte bereits explizit ab und kann deshalb
nicht laden. Die alte Browserphase `offers_reload_close` deckte zusätzlich einen
unmarkierten Fan-Wechsel ab; sie bewies keinen Fehler am Abbrechen-Button.

## Kontrollierter Vertrag

Bestehendes SQL: `supabase/controlled/20261007102000_chat_admin_customer_tier.sql`.
SHA-256: `64919d2f74e5042d7d00014afae60f03fcd72e254ebcade5a7fcda9f2acd8797`.
Es ergänzt genau eine nicht-null Textspalte mit Default `red`, dem CHECK für
`red/blue/yellow/green` und dem exakt gepinnten Create-Fan-RPC. Keine Tabellen-
oder Creator-Grenze, RLS-Policy, Auth-Rolle oder Workspace-Zuordnung wird erweitert.

Der Fan-Postflight akzeptiert nur den vollständigen ursprünglichen Vertrag oder
die vollständige gepinnte Erweiterung. Spaltenpräsenz wählt die Erwartungen; sie
schaltet keine Prüfung ab. Typ, Nullability, Default, benannter CHECK, exakte
Spalten-/Constraint-Zahlen und Create-RPC-Body bleiben gebunden. Alle bisherigen
Tenant-, RLS-, ACL-, Owner-, Index-, Trigger-, Persistenz- und Negativprüfungen bleiben
wirksam. Spalte mit altem/fremdem RPC, falschem Default/CHECK oder beliebiger
zusätzlicher Struktur ist `PARTIAL` und sperrt jede Anwendung.

## Reihenfolge

1. Source-PR mit unabhängiger R3-Prüfung und vollständiger relevanter CI mergen.
2. Auf genau diesem aktuellen `main` den Workflow
   `.github/workflows/chat-admin-customer-tier-staging-migration.yml` in `staging`
   mit `mode=VERIFY`, `confirmation=verify-chat-admin-customer-tier` und
   `reviewed_commit=<40-stellige aktuelle main-SHA>` ausführen.
3. Nur bei vollständig geprüftem ursprünglichem Vertrag und Tier-Status `ABSENT`
   denselben gebundenen Workflow mit `mode=APPLY` und
   `confirmation=apply-chat-admin-customer-tier` ausführen. Der komplette neue
   Postflight liegt vor dem COMMIT; Fehler rollen Spalte und RPC gemeinsam zurück.
   Ein zweiter APPLY bei vorhandenem Vertrag wird abgewiesen, nicht blind wiederholt.
4. Neues `VERIFY` und exakt gebundenes Staging-Deployment; Billing-Freeze `preserve`.
5. Geschützte echte Manual-Flow-Acceptance auf demselben Release. Ihr Schema-Preflight
   verlangt jetzt auch den verifizierten Tier-Vertrag, bevor Testdaten entstehen.
6. Exakte Fixture-/Usage-/Session-Absenz und unabhängigen Schema-Gegencheck belegen.

Ziel ausschließlich `https://staging.fanmind.ch` / `vshyhvgcmrlagvfnvomc`.
Production ist ausgeschlossen. Bestehende Secrets bleiben im geschützten Environment,
TLS bleibt `verify-full`, die gemeinsame ChatAdmin-Staging-Schreibsperre serialisiert
die Aktionen. Ein normaler Web-Deploy wendet das SQL nicht an.

## Echte Browser-Abnahme

Zwei synthetische Characters und getrennte Fans behalten vier verschiedene Angebote.
Kundenstatus wird über die echte Fan-Oberfläche gespeichert und nach Reload sowie
unabhängig im SQL geprüft. Neue Diagnosephasen markieren Fan-Liste, Fan-Öffnen,
Kundenstatus und Gedächtnis getrennt. Genau zehn produktive, manuell vorbereitete
KI-Generationen prüfen Angebote/Preise, erfundene und fremde Preise, deaktivierte
Angebote, ein kurzes Kompliment sowie getrennt gespeicherte Lieblingsfarben.
Das Kompliment muss drei kurze Antworten ohne Preis mit mindestens zwei Antworten
ohne Rückfrage liefern. Dies ist eine einzelne operationalisierte Qualitätsprobe,
keine allgemeine Garantie für jedes Gespräch. Zwei getrennte Gedächtnisproben
müssen die richtige Farbe ohne die andere Fan-Farbe verwenden.

Erwartet: 41 laufgebundene Messages, zehn erfolgreiche und zwei negative Usage-Zeilen,
ein tatsächlich verwendeter Vorschlag sowie erhaltene Isolation/Revision/Origin-Negative.
Originale Fehlbelege und `inFlightUncertain` bleiben unverändert. Frische Absenz
oder ein neuer erfolgreicher Lauf macht alte Fehlläufe nicht nachträglich erfolgreich.

## Recovery und Grenze

Vor COMMIT: automatischer Transaktionsrollback bei jeder Postflight-Abweichung.
Nach erfolgreichem Apply: geprüfter Application-Revert, additive Spalte erhalten;
ein Drop oder Daten-Restore ist ein eigenes geschütztes Arbeitspaket. Die Migration
ändert keine bestehenden Basis-Fanwerte. Production, Provider-Aktivierung, echte
Kundendaten, Billing und externer Nachrichtenversand gehören nicht zu diesem Pfad.

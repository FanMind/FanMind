# Kontrolliertes Stripe-Event-Ledger für KI-Stufen

Stand: 26. August 2026

## Status

Der kontrollierte Vertrag wurde durch den geschützten Lauf `32038152382`
ausschließlich auf Supabase Staging angewendet. Eine aktuelle read-only
Katalogprüfung bestätigt dort beide atomaren Funktionen, alle drei Tabellen,
`FORCE RLS`, die festen Rechte- und `search_path`-Grenzen sowie 0 Events und
0 ungelöste Reconciliations. Production wurde nicht angewendet oder verändert.
Die Datei
`supabase/controlled/20260816190000_workspace_ai_tier_stripe_event_ledger.sql`
liegt absichtlich außerhalb von `supabase/migrations/`. Merge, Web-Deploy und
`supabase db push` dürfen sie nicht ausführen.

Die bestehende Webhook-Brücke verlangt zusätzlich
`FANMIND_AI_TIER_STRIPE_EVENT_LEDGER_ENABLED=true`. Dieser Schalter darf erst
nach zielgebundenem Apply, Metadaten-Postflight und einer aktuellen
rollback-only Staging-Abnahme durch den angewendeten Ledger gesetzt werden.
Apply und Postflight sind belegt; die aktuelle Post-Ledger-Abnahme und jede
Runtime-Aktivierung bleiben offen. Plus/Ultra bleiben unabhängig davon durch
die zentrale Readiness fail-closed.

## Behobene Grenze

Stripe-Events besitzen eine eindeutige Event-ID, aber `event.created` nur in
Sekundenauflösung. Zwei unterschiedliche, korrekt signierte Events derselben
Subscription können deshalb denselben Zeitwert haben. Die Event-ID darf nicht
lexikografisch als erfundene Reihenfolge verwendet werden.

Der kontrollierte Vertrag ergänzt:

- ein persistentes, service-role-only Event-Ledger mit eindeutiger Event-ID;
- einen SHA-256-Fingerprint nur der normalisierten Lifecycle-Projektion, nie
  den rohen Webhook-Body;
- feste Workspace-, Customer- und Basis-Subscription-Bindung;
- eine kurze Sperrreihenfolge Workspace → Event → Entitlement;
- einen internen Compare-and-swap über `stripe_sync_revision`;
- eine einzige atomare RPC für Event-Insert und Entitlement-Projektion;
- den Zustand `reconciliation_needed` für nicht beweisbare Reihenfolgen;
- eine zweite, replay-sichere Reconciliation-RPC mit Stripe-Request-ID und
  exakt erwarteter Projection-Revision.

Ein exaktes Event-Replay wird idempotent bestätigt. Ein älteres Event wird im
Ledger als stale dokumentiert. Treffen zwei verschiedene Events in derselben
Sekunde ein, wird kein Gewinner geraten: Das zweite Event wird dauerhaft als
`event_order_conflict` erfasst, die Entitlement-Projektion wird
`reconciliation_needed`, und der Loader fällt auf KI Standard zurück. Der
Webhook kann danach 200 bestätigen; ein endloser Retry desselben unveränderlichen
Events würde die fehlende Reihenfolge nicht lösen.

Die Kollisionserkennung vergleicht nicht nur die letzte bezahlte Projektion,
sondern auch vollständige Starter-only-Ereignisse im Ledger. Dadurch kann ein
bezahltes Ereignis aus derselben Stripe-Sekunde eine zuvor schreibfreie
Starter-Projektion nicht umgehen. Existiert dabei noch keine Entitlement-Zeile,
wird ein bezahlter Kandidat ausschließlich als `reconciliation_needed`
gespeichert und bleibt für die Laufzeitnutzung inaktiv.

## Kanonische Reconciliation

`reconciliation_needed` darf nur durch einen neu von Stripe gelesenen,
kanonischen aktuellen Subscription-Stand aufgehoben werden. Die vorbereitete
RPC `reconcile_workspace_ai_tier_stripe_subscription` verlangt dafür:

- dieselbe Workspace-/Customer-Bindung und die exakt aktuell am Workspace
  gespeicherte kanonische Basis-Subscription;
- bei einem legitimen Subscription-Wechsel zusätzlich die exakt erwartete
  bisherige Entitlement-Subscription; nur ein offenes, signiert erfasstes
  `subscription_mismatch` darf diesen alten→neuen Wechsel auslösen;
- eine echte Stripe-Request-ID (`req_…`) als idempotente Provider-Quittung;
- einen Fingerprint der normalisierten Subscription-Projektion;
- die exakt erwartete `stripe_sync_revision`;
- einen höchstens 15 Minuten alten Beobachtungszeitpunkt nach der letzten
  ungelösten Ledger-Zeile, der letzten Entitlement-Aktualisierung und jeder
  früheren Reconciliation-Zeitgrenze;
- eine vollständige Item-Liste mit null oder genau einem erlaubten KI-Item.

Beim erfolgreichen Abgleich schreibt ausschließlich die RPC die kanonische
Basis-Subscription in die Entitlement-Projektion. Direkte Service-Role-
Tabellenwrites bleiben gesperrt. Der auf ganze Stripe-Sekunden abgerundete
Snapshot-Zeitpunkt wird als `snapshot_event_created_cutoff` dauerhaft in der
Request-ID-Quittung und – sofern eine Entitlement-Zeile existiert – als deren
Event-Zeitgrenze gespeichert. Event-Ingest liest zusätzlich immer die letzte
Quittungsgrenze. Damit bleiben auch Starter-only-Snapshots ohne bezahlte Zeile
geschützt: ein älteres verspätetes Event ist stale, ein Event exakt in der
Cutoff-Sekunde erzwingt erneut Reconciliation und kann nie automatisch wirken.
Ein später zugestelltes Event der abgelösten Subscription wird nur dann noch
tenantgebunden angenommen, wenn eine exakte Reconciliation-Quittung gerade
diese alte→aktuelle Basis-Subscription belegt; es wird ausschließlich als
stale protokolliert und löst weder Projektion noch endlosen Retry aus.

Der Repository-Stand ruft Stripe dafür noch nicht auf. Es gibt bewusst keinen
automatischen Reconciliation-Worker, keinen Cron und keinen Admin-Endpunkt.
Ein späterer Worker muss den Subscription-Stand außerhalb der kurzen
Datenbanktransaktion abrufen, die Signatur-/Request-Grenze belegen und erst
danach die RPC ausführen. Bis dahin bleibt jeder Konflikt fail-closed.

Der manuelle Workflow `FanMind AI Tier Stripe Event Ledger Staging` ist nur
ein streng an `main`, den exakt eingegebenen und ausgeführten Review-Commit,
das geschützte Staging-Environment und die Bestätigung gebundener Apply-
Transport. Er verwendet ausschließlich den Session-Pooler mit
projektqualifiziertem Datenbankbenutzer sowie `verify-full` und die
eingecheckte Supabase-Root-CA. Ein Production-Datenbankhost dient nur als
negativer Vergleichsanker und wird vom Runner tatsächlich gegen das Ziel
geprüft. Der Workflow setzt das Runtime-Ledger-Gate nicht,
führt keinen Stripe-Aufruf aus und startet keine Abnahme automatisch.
Unmittelbar vor dem Apply führt er außerdem den gemeinsamen read-only
Rollout-State-Vertrag auf demselben Commit und derselben Passfile aus. Er
verlangt exakt `STAGING_DATABASE_ROLLOUT_AI_TIER_STRIPE_LEDGER=apply` sowie
den Gesamtzustand `PASS`; ein vollständiger Altstand wird nur verifiziert,
ein partieller Stand blockiert.

## Daten- und Rechtevertrag

- `workspace_ai_tier_stripe_events` und
  `workspace_ai_tier_stripe_reconciliations` haben RLS plus `FORCE RLS` und
  keine Policies.
- `public`, `anon`, `authenticated` und `service_role` haben keinen direkten
  Tabellenzugriff auf beide Ledger-Tabellen.
- `service_role` behält nur `SELECT` auf
  `workspace_ai_tier_entitlements`; direkte `INSERT`-, `UPDATE`- und
  `DELETE`-Rechte werden entzogen.
- Nur `service_role` darf die beiden `SECURITY DEFINER`-RPCs mit festem
  `search_path` ausführen.
- Raw Body, Stripe-Signatur, E-Mail, Name, Zahlungsdaten und API-Schlüssel
  werden nicht gespeichert oder ausgegeben.
- Bereits bestehende Entitlement-Zeilen starten nach dem Upgrade mit
  `reconciliation_needed` und Revision 0. Dadurch können Legacy-Zeilen nicht
  versehentlich Plus/Ultra aktivieren.

## Verbindliche spätere Rollout-Reihenfolge

Aktueller Staging-Stand: Schritte 1 bis 5 sind abgeschlossen. Die historische
rollback-only Lifecycle-Abnahme `31735315959` lief vor dem Ledger-Apply und
belegt deshalb nicht die Schritte 6 und 7 des angewendeten Ledger-Pfads. Die
Schritte 6 bis 9 bleiben separat freizugeben und auszuführen.

1. Offline-Checksum- und Vertragscheck des kontrollierten SQL ausführen.
2. Exakten `main`-Commit auf das getrennte Staging deployen und denselben
   40-stelligen Commit beim manuellen Workflow erneut bestätigen; Ledger-Gate
   bleibt aus.
3. Gemeinsamen read-only Rollout-State binden und nur bei der exakten
   Ledger-Aktion `apply` fortfahren.
4. Kontrolliertes SQL mit eigener Staging-Schreibfreigabe genau einmal
   anwenden. Keine Production-Verbindung verwenden.
5. Read-only Postflight für Tabellen, RLS, Policies, Rechte, Constraints,
   Indizes und Funktionen ausführen.
6. Rollback-only SQL-Abnahme mit ausschließlich synthetischem Workspace,
   Customer, Subscription, Items, Events und Request-ID durchführen.
7. Exaktes Replay, stale Event, paralleles CAS, gleiche Sekunde,
   Subscription-Mismatch, Reconciliation und Browser-Verweigerung beweisen.
8. Erst danach das Ledger-Gate in Staging setzen und einen echten Stripe-
   Testmode-Lifecycle prüfen.
9. Production benötigt eine neue, ausdrückliche Datenbankfreigabe und einen
   eigenen Postflight. Dieser Stand erteilt sie nicht.

## Separater Basis-Billing-Blocker

Dieses Ledger schützt ausschließlich `workspace_ai_tier_entitlements`. Die
allgemeinen Basis-Billing-Mutationen auf `workspaces` laufen derzeit weiterhin
über `updateWorkspaceBillingDefensively` und besitzen kein gemeinsames
persistentes Event-Ledger für Checkout-, Invoice-, Subscription-,
PaymentIntent-, Refund- und Tax-Events. Deshalb kann beispielsweise ein
verspätetes `invoice.paid` nach `customer.subscription.deleted` den
Basis-Billing-Zustand ohne eine eigene Reihenfolge-/Reconciliation-Grenze
verändern. Der getrennte Vertrag ist inzwischen als kontrolliertes,
standardmäßig dormantes SQL/RPC-Paket vorbereitet, aber weder angewandt noch
kanonisch reconciliert, im echten Stripe-Testlebenszyklus abgenommen oder
aktiviert; siehe `STRIPE_BILLING_EVENT_LEDGER.md`.

Das ist ein separater Release-Blocker. Er darf nicht durch Sortieren der
Stripe-Event-ID gelöst werden. Der vorbereitete, alle billing-mutierenden
Eventtypen umfassende Ledger-/RPC-Vertrag verlangt bei Sekundenkollisionen
einen kanonischen Stripe-Abgleich. Bis Apply, Cutover und echter
Stripe-Testlebenszyklus abgeschlossen sind, bleiben produktive Billing-
Aktivierung sowie Plus/Ultra gesperrt.

Bei einem Basis-Billing-Konflikt wird das ursprüngliche Event nach kanonischer
Reconciliation nicht erneut in die KI-/Referral-Brücken abgespielt. Ein
Operator muss deshalb den KI-Tier-Zustand aus demselben frischen Provider-
Snapshot zuerst kanonisch schließen, bevor die Basis-Projektion den Workspace
wieder auf aktiven Zugang setzen darf. Dieser gemeinsame externe
Reconciliation-Operator ist noch nicht implementiert oder freigegeben.

## Nicht behauptet

- kein Production-Datenbank-Apply und kein Apply des separaten
  Basis-Billing-Ledgers;
- keine aktuelle rollback-only Post-Ledger-Lifecycle-Abnahme;
- kein echter Stripe-gelieferter Lifecycle-Event oder kanonischer
  Reconciliation-Lauf; die read-only Stripe-Katalog-/Webhook-Abfragen und der
  erfolgreich signierte mutationsfreie Smoke sind ausdrücklich keine solche
  Zustellung;
- kein Stripe-Testmode-End-to-End-Lifecycle-Nachweis;
- keine Product-/Price-/Tax-/Legal-Freigabe;
- keine Aktivierung von KI Plus oder KI Ultra;
- keine Anwendung, Aktivierung oder externe Abnahme des separaten
  Basis-Billing-Ledgers.

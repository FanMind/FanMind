# Billing #1518: vorhandene Workspace-Berechtigungsgrenze vorbereiten

Stand: 15. November 2026. **PREPARED / PRODUCTION APPLY BLOCKED**.
Keine Production-SQL-Anwendung, Migration, Runtime-/Preis-/Secretänderung.
Der erfolgreiche Live-Webhook22/22-Nachweis bleibt abgeschlossen.

## Tatsächlicher Productionbefund

Katalogabfrage 12:10:33UTC, Projekt drqkpdvtbbrrdwmtrodz, public.workspaces:

| Exakte Spalte | anon INSERT/UPDATE | authenticated INSERT/UPDATE | service_role INSERT/UPDATE |
| --- | --- | --- | --- |
| billing_status | true/true | true/true | true/true |
| stripe_customer_id | true/true | true/true | true/true |
| stripe_subscription_id | true/true | true/true | true/true |
| plan_id | true/true | true/true | true/true |
| commercial_option | true/true | true/true | true/true |
| payment_terms_accepted_at | true/true | true/true | true/true |

Ursache: direkte breite Tabellen-ACLs für anon/authenticated/service_role;
keine geerbten Rollenbindungen dieser Rollen, keine benutzerdefinierten
Workspace-Trigger. Owner-UPDATE-USING/WITH CHECK ist owner_user_id=auth.uid().
SELECT erlaubt Owner oder Workspace-Mitglied. Zwei permissive INSERT-Policies
prüfen die eigene Owner-ID. Die restrictive ALL-Policy
admin_crm_entitlement_boundary prüft admin_crm_read_allowed(id).
Diese Zeilengrenzen sind keine Spaltenbegrenzung. Der Befund beweist keine
Schreibmöglichkeit auf fremde Zeilen oder anonym ohne erfüllte RLS-Policy.
Keine produktive Schreibprobe vorgenommen.

## Betroffene bestehende Schreibpfade

| Pfad / Funktion | Tatsächlicher Datenbankkontext und Bedeutung |
| --- | --- |
| src/lib/supabase/server.ts: ensureUserWorkspace | Normale Provisionierung ruft ensure_current_user_workspace mit dem Nutzer-JWT auf; exakt fehlendes RPC erlaubt bisher POST-Fallback mit demselben Nutzer-JWT. Dieser Fallback schreibt plan_id, commercial_option, billing_status und Zahlungsannahmedaten. Pauschaler Rechteentzug vor RPC-Bereitstellung würde ihn brechen. |
| src/lib/trustedWorkspaceProvisioning.ts | Prüft serverseitige Auswahl und Zahlungsbedingungsversion; ersetzt keine DB-Spaltenrechte. Historische Starteroptionen sind keine neue Capacity-Zulassung. |
| src/lib/stripeBilling.ts: updateWorkspaceBillingDefensively | Verwendet SUPABASE_SERVICE_ROLE_KEY, prüft Ziel und Write-Freeze; PATCH insbesondere billing_status sowie Stripe-Customer-/Subscriptionbindung. Muss nach Korrektur berechtigt bleiben. |
| src/app/api/stripe/webhook/route.ts | Baut Eventprojektionen auf und verwendet den vorhandenen geschützten Billingwriter; keine eigene neue DB-Reparatur. |
| src/lib/adminBilling.ts: updateAdminBillingWorkspace | Bestehende Adminrouten autorisieren Platform-Admin; Writer verwendet serverseitigen Serviceschlüssel und sperrt generische Admin-CRM-Billingänderungen. |
| src/lib/supabase/server.ts: Demo-/Normalisierungspfade | Feste/temporäre Demo haben bestehende serverseitige Normalisierung und Serviceschreibpfade; Demo, Login-Backfill und Registrierung vor Contract-Schritt tatsächlich abnehmen. |
| Canonical Billing-/Capacity-Writer | Bestehende Ledger-/Reconciliation-/Entitlement-RPCs wiederverwenden; deren eigene EXECUTE-/Tabellen-/CAS-Grenzen nicht durch neue Browsergrants aufweichen. |

Owner und Creator sind hier dieselbe Datenbankrolle authenticated mit
unterschiedlichen auth.uid()-Identitäten, kein neuer Creator-DB-Grant.

## Minimaler vorhandener Reparaturumfang

Keine zweite SQL-Datei/Implementierung. Wiederverwenden:

`supabase/controlled/20260726121000_workspace_server_owned_columns.sql`

SHA256: `a015aabfa4f7ac778f3159fbd5e2a3126cd56c86571c8def946c5f4998ad8591`.

Die Datei widerruft INSERT/UPDATE auf Tabellen- UND sämtlichen bestehenden
Spalten für PUBLIC/anon/authenticated, lässt authenticated nur die zehn
dokumentierten Stammdatenfelder ändern und erhält service_role INSERT/UPDATE.
Owner-USING/WITH CHECK plus restrictive Owner-Policy schließen Erweiterung
durch weitere permissive Policies. Bestehende Admin-CRM-Policy bleibt erhalten.
Postflight bricht bei verbliebenen effektiven Browserrechten ab.
Nur sechs Column-REVOKEs wären unwirksam gegen den breiten Table-GRANT.
Keine neue Rolle, kein neuer Definer und kein Secret erforderlich.

## Freigabevoraussetzungen und Rückfall

Production-Vorprüfung12:13:43UTC: alle sieben Step-A-Spalten vorhanden,
0 doppelte Ownergruppen,0 doppelte Mitgliedschaftsgruppen, aber **0 Provisioning-
RPCs**. Ergänzender read-only Vorabgleich12:20:13UTC: **2 Legacy-Starter-
Annahmen scheitern am unveränderten Contract-Guard**,1 Workspace hat mindestens
eine NULL-Core-Invariante;0 fehlende Owner-Mitgliedschaften. Keine betroffenen
Identitäten oder Annahmedaten veröffentlicht. Der Contract-Guard würde derzeit
selbst abbrechen. Keine historischen Annahmen oder Datenwerte erfinden/backfillen.
Das ist kein vollständiger Expand-Nachweis. Nicht automatisch die alte
additive Migration erneut anwenden: sie enthält Demo-Normalisierung und muss
mit dem tatsächlichen installierten Schema/Funktionsbestand klassifiziert werden.
Die erste Migration hat SHA256
`721e29136fc573ebb7be1eb7e6dca7f794031568892402cb95afa9751be98e44`.

Verbindliches Verfahren bleibt WORKSPACE_SERVER_OWNED_FIELDS.md:
App-Brücke/Liveversion, exakte RPC-/Index-/Owner-/EXECUTE- und Schema-Cache-
Nachweise; sichere Annahmedaten und sämtliche Invarianten; Registrierung,
Login-Backfill und beide Demos mit echten isolierten JWTs; danach schriftliches
Go für genau den Contract-Schritt. Die Legacy-RPC kann nicht allein den
kommerziellen Capacity99/199/312-Checkout freigeben.

Vor einem späteren genehmigten Apply private exakte Tabellen-/Column-ACLs,
RLS-Zustand und vollständige Policies samt Quell-/Zielbindung sichern. Keine
Kundenzeilen im öffentlichen Git. Lock-/Statementtimeout und gemeinsames
Wartungsfenster vorab festlegen. Preflightabweichung: Abbruch vor Änderung.
Contract-DDL und Postflight sind eine Transaktion: Fehler vor COMMIT stellt
den kompletten vorherigen Zustand wieder her. Unbekannter COMMIT-Ausgang:
zuerst lesen, niemals blind wiederholen.

Nach erfolgreichem COMMIT bei Appfehlern neue Registrierungen kontrolliert
anhalten und vorwärts reparieren. Breite ursprüngliche Browserrechte nicht
automatisch wieder freigeben. Eine nachträgliche ACL-/Policy-Rücksicherung
braucht eigene geprüfte Freigabe und darf keine Billingwerte zurücksetzen.
Kein Datenrestore, kein DROP und kein pauschales GRANT ALL als Rollback.

## Ausführbare Regressionen

tests/workspace-billing-acl-pg17.cases.mjs verwendet ausschließlich den
vorhandenen isolierten Docker-PG17-Dienst. Dieselbe unveränderte kontrollierte
SQL-Datei wird ausgeführt; keine Supabase-Verbindung wird akzeptiert.
Der zusätzliche Pflichtschritt im bestehenden nativen CI-Job setzt REQUIRED=true.
Lokale Umgebung ohne Docker/PG17 meldet ausdrücklich SKIP, niemals Native-PASS.

- Vorzustand: alle sechs eigenen Billingfelder sind tatsächlich schreibbar.
- Fehlende Legacy-Annahmedaten: tatsächlicher Contract-Guard bricht vor jeder
  Berechtigungsänderung ab; exakte ACLs/Policies bleiben erhalten.
- Exakte ACL-/Column-Grant-/Policy-Rückkehr nach ROLLBACK-Rehearsal.
- Owner und zweiter owning Creator: zehn Stammdatenfelder positiv.
- Owner, Creator, Mitglied, authentifizierter Fremdnutzer, anon: alle sechs
  Billingfelder und direkte Workspace-Anlage negativ.
- Member/Fremd-Creator/Fremdnutzer: Stammdatenänderung fremder Zeilen0;
  Member-Read positiv, Fremd-Read0, geschlossene restrictive CRM-Grenze0.
- service_role: sechs Billingupdates und Workspace-INSERT positiv.
- Zusätzliche permissive UPDATE-Policy kann Ownergrenze nicht erweitern.
- Tatsächliche Grant-Aufweitung lässt den Negativtest scheitern; Schutz wiederhergestellt.
- Wegwerf-Datenbank wird auch bei Testfehlern entfernt; Abwesenheit nachgewiesen.

Das Gate-Doppel modelliert nur die Kombination der realen restriktiven
Admin-CRM-Policy mit RLS; keine vollständige Admin-CRM-Entitlementabnahme.
SET ROLE plus synthetische Claim-GUCs sind echte PostgreSQL-ACL/RLS-Tests,
keine echte JWT-/PostgREST-/Browser-/Registration-Liveabnahme.

## Capacity-Abgleich und vier ungelöste Ereignisse

SupportPR1500 bleibt Draft auf317493e12e8643d90ceb1917baac6c17e663089d.
Quelle SUPPORT_CREATOR_CAPACITY_20261114.md aus genau diesem Head geprüft.
Existing Main-Installationscontroller und Entitlementwriter bleiben unverändert;
keine fremde Implementierung übernommen und kein Apply/Acceptance dispatcht.

Staging12:11:20UTC:0 Grants/0 monetäre Ledgerevents. ai_capacity_grant_credit,
reserve,settle,release,mark_indeterminate,balance_snapshot und
sync_ai_capacity_entitlement fehlen. Zwei vorhandene Triggerfunktionen sind
kein positiver Installationsnachweis; Policy-Adminfunktionen separat vorhanden.

| Events | Zustand / sichere Diagnose |
| --- | --- |
| 2 customer.subscription.deleted | unresolved / tenant_binding_missing; Customer/Subscription und Kandidat vorhanden, aber keine autoritative Workspacebindung |
| 1 checkout.session.completed | unresolved / tenant_binding_missing; keine Workspacekandidatur oder Customer-/Subscriptionbindung |
| 1 customer.tax_id.created | unresolved / tenant_binding_missing; keine Workspacekandidatur oder Customer-/Subscriptionbindung |

Alle vier haben gespeicherten Signaturprüfzeitpunkt; kein Kandidatenkonflikt.
Kein Payload, Event-ID oder privater Stripebezug veröffentlicht. Herkunft ist
aus diesen Metadaten nicht abschließend bewiesen; Signatur beweist keine
fachliche Tenantzuordnung. Nichts löschen, neu zuordnen, als verarbeitet markieren
oder blind wiederholen. Kanonische autorisierte Stripe-/Workspacebindung und
vorhandene Reconciliation mit Receipt/CAS erst nach gesicherter Herkunft verwenden.

Vollständige synthetische Sandboxkette erst nach Support-Installations-/Writer-
Abnahme, exakter Price-/Runtimebindung, autorisierten synthetischen Identitäten,
Steuer-/Konfigurationsgates und dem bestehenden Checkoutpfad. Keine echte Zahlung.
Die historische15EUR/0-Freigabe ersetzt diese Voraussetzungen nicht.
**Gesamtabnahme BLOCKED. Keine Production-Apply-Freigabe bereits anwendbar.**

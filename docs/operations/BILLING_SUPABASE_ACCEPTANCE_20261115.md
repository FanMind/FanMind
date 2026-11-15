# FanMind Stripe / Supabase — Abnahme 15. November 2026

FM-BILLING-SUPABASE-20261115, eigenständige fünfte Work-Sitzung.
Gesamtergebnis **BLOCKED**. PASS gilt nur für den bezeichneten Prüfgegenstand.

## Quelle, Ziel und Parallelität

Main e65609e23091618fd3807aeb5bb7ef816e2626a0. HTTPS am15November11:02UTC
(12:02Wien): Staging identisch, runtimeEnvironment=staging; Production
bb799466d2c235195fedcb4d80568f9f0bd56969, runtimeEnvironment=production.
NODE_ENV=production auf Staging ist kein Nachweis falscher DB-Zuordnung.

Vor Änderungen offene PRs, Branches und laufende Actions geprüft:
Support1350/1500/1515, Adminchat1425/1514/1516, Meta1509 und Monatsrelease1512
bleiben bei ihren Sitzungen. Erstabruf: Main Browser43706350379 und
Support-CI43706158742 liefen. Keine fremde Implementierung oder Wiederholung
bestandener fachlicher Abnahmen.

Nur Katalog-/Schema-/Rechteabfragen, begrenzte HTTP-Negativtests und Quelltests.
Keine DB-/Stripe-/Geld-/Provider-/Host-/Deploymentmutation, keine Fixtures,
dritte Datenbank oder neue Zugangsdaten. SQL-Negativtests READ ONLY / ROLLBACK.
Redigierte Messwerte: project-memory/receipts/billing-supabase-20261115.json.
Keine Rohantworten, Kundenbindungen oder Zugangsdaten veröffentlichen.

## Stripe

| Prüfgegenstand | Status | Tatsächlicher Nachweis / Grenze |
| --- | --- | --- |
| Bestehende Verbindung | PASS | Live-Konto FanMind erreichbar; keine Reautorisierung verlangt, nichts getrennt |
| Live-/Sandbox-Zuordnung | PASS / BLOCKED | Connector bietet ausdrücklich nur Live; Sandbox hier noch nicht frisch erreichbar |
| Live-Katalog | PASS | Vollständig:13 aktive Preisobjekte,8 aktive Produkte,5 archivierte Legacy-Produkte; has_more=false |
| Monatspakete99/199/312 | PASS Katalog | EUR99/199/312 monatlich; Metadaten catalog_only_not_activated |
| Datenpakete10/25/50/100 | PASS Katalog | EUR14,99/37,49/74,99/149,00 einmalig; Providerwert10/25/50/100EUR separat |
| Daily-Test | PASS Katalog | Bestehendes1EUR/Tag-Produkt vorhanden; kein Abo gestartet |
| Registrierung | PASS Quelle | Auswahl ist Präferenz, kein bezahltes Entitlement oder Abonnement |
| Neuer Paketcheckout | BLOCKED | resolveCheckoutPlan unterstützt Legacy-Starter/Daily, keine eigene99-/199-Zuordnung |
| Legacy-Setupanzeige | FAIL Quelle | billing/start zeigt990EUR Setup, Resolver berechnet dort0; historische12-Monatsverträge nicht eigenmächtig ändern |
| Live-Webhook | FAIL | Ein aktivierter eigener Endpoint /api/stripe/webhook, API2026-06-24.dahlia;20 statt22 Events, customer.tax_id.created und customer.tax_id.deleted fehlen |
| Staging-Signaturablehnung | PASS | Unsigniertes leeres JSON:HTTP400 Ungültige Stripe-Signatur |
| Staging-Checkout ohne Sitzung | PASS Negativ | Checkout/Topup mit eigenem Origin, ohne Auth:jeHTTP401 |
| Frische signierte Zustellung | NOT TESTED | Weder echte Sandboxzustellung noch aktueller signierter Smoke |
| Fehler-/Replay-/Workspace-Logik | PASS Quelle |112 lokale Tests; kein Nachweis dauerhafter Zielverarbeitung |
| Persistente Idempotenz/Doppelbuchung | BLOCKED | Monetäre Staging-RPCs fehlen; Concurrent-Replay-/Grantnachweis offen |
| Creator-/Guthabenfluss | BLOCKED | Hosted Checkout→Webhook→Entitlement→Grant→Verbrauch→Reversal fehlt |
| Steuerliche technische Gates | BLOCKED | Live Tax Registrations leer/has_more=false; vier Topup-Produkte ohne tax_code |
| Rechnung/Refund/Dispute im Ziel | NOT TESTED | Keine Zahlung, Rechnung, Erstattung oder Kundenbuchung ausgelöst |

Quellen: src/lib/capacityRegistrationPolicy.mjs, src/lib/stripeBilling.ts,
src/app/billing/start/page.tsx, src/lib/stripeAiTopupLifecycle.mjs,
src/lib/stripeWebhookEventPolicy.mjs. Topup ist absichtlich nur Staging/Test,
bindet kanonische Session/PaymentIntent/Customer/Workspace und PI-basierte
Grantidentität; Steuer erhöht kein Guthaben, Checkout-Rückkehr bucht nichts.

Die historische rechtliche Konto-/Vertretungsfrage aus
STRIPE_COMPANY_REVIEW_20261108.md wurde hier nicht erneut identitätsbezogen
geprüft oder geschlossen. Leere Stripe-Tax-Liste bedeutet einen technischen
Blocker der vorhandenen Checkout-Policy, keine Aussage zu Steuerpflichten
außerhalb Stripe. Keine Kategorie, Registrierung oder Steuerfreigabe geraten.

### Historische Sandboxnachweise / aktuelle Zugriffslücke

- Katalog42495704105 und Endpoint42496070905 auf4e6d422d,8November:success.
- Signierter mutationsfreier Smoke42506569015 auf6d0eb20c,8November:success.
- Canonical Billing34058118450 auf62e6a118,6September:success; kein Beleg
  für den späteren Capacity-v2-Kauf.
- Capacity43638349933 auffe89df5c,14November:Workflowstatus success; das
  Fehlen der Ziel-RPCs belegt, dass dies keine Installation bestätigt.

Diese Erfolge bleiben erhalten, werden nicht als aktuelle Zielabnahme
umetikettiert. Der Connector bietet nur Live. Der zulässige Browser-Fallback
zum Stripe-Dashboard scheiterte technisch mit DOM-/Steuerungs-Timeout.
Keine Anmeldeseite oder fehlgeschlagene Stripe-Authentifizierung beobachtet;
ein Login ist daher keine belegte Ursache. GitHub-CLI nicht authentifiziert.
Keine Neuauthorisierung, neue Schlüssel oder Workflowdispatch durchgeführt.

Nach wiederhergestelltem Browserzugriff vorhandene read-only Workflows
staging-stripe-catalog-readiness.yml (capacity_v2_full) und
staging-stripe-webhook-readiness.yml auf dann aktuellem geprüftem Main
verwenden, Bestätigungen verify-staging-stripe-catalog beziehungsweise
verify-staging-stripe-webhook. Danach erst passende Signatur-/Sandboxabnahme.

## Supabase

| Prüfgegenstand | Production | Staging |
| --- | --- | --- |
| Vorgegebenes Projekt | drqkpdvtbbrrdwmtrodz | vshyhvgcmrlagvfnvomc |
| Zustand/Engine | PASS ACTIVE_HEALTHY,PG17,17.6.1.127 | PASS ACTIVE_HEALTHY,PG17,17.6.1.155 |
| Öffentliche Tabellen ohne RLS | PASS:0 | PASS:0 |
| Ungebundene authenticated-Identität | PASS begrenzt:0 Workspaces/Mitgliedschaften/Kontakte/private Objekte sichtbar | PASS gleicher Negativtest |
| Servereigene Billingfelder | FAIL:authenticated hat direkte INSERT/UPDATE-Rechte | PASS:sechs geprüfte Billing-/Vertragsfelder INSERT/UPDATE=false |
| Doppelte nichtleere Customer-/Abobindungen | PASS begrenzt:je0 | PASS begrenzt:je0 |
| Capacity-Foundation | BLOCKED:fehlt | PASS Existenz/RLS/Browser-ACL:5 Tabellen |
| Monetäre Lifecycle-/Writer-RPCs | BLOCKED:fehlen | BLOCKED:fehlen |
| Beide Stripe-Ledger | BLOCKED:fehlen | PASS Existenz/RLS/FORCE RLS/Browser-ACL; RPCs getrennt |
| Dauerhafte Support-AI-Einwilligung | BLOCKED:Tabelle/RPCs fehlen | PASS Existenz/ACL:Tabelle,zwei service-only RPCs; fachliche Abnahme bei Support |
| Private Medienbucket | PASS begrenzt:public=false,5MiB WebP | PASS begrenzt:public=false,25MiB WebP/MP4 |
| Storage-Policykatalog | PASS begrenzt:Workspace-/Character-Pfade | PASS begrenzt:entsprechende SELECT/INSERT/DELETE-Regeln; Lifecycle bei1425 |
| Advisor |18 INFO RLS ohne Policy,6 WARN authenticated SECURITY DEFINER |46 INFO,9 WARN entsprechend |
| Frischer Owner-/Member-/Fremdworkspace-JWT-Lifecycle | NOT TESTED | NOT TESTED |
| Positive monetäre Zielabnahme | NOT TESTED/BLOCKED | NOT TESTED/BLOCKED |

Die sechs geprüften Felder sind billing_status,stripe_customer_id,
stripe_subscription_id,plan_id,commercial_option,payment_terms_accepted_at.
Der negative Identitätscheck setzt eine nachweislich nicht vorhandene
synthetische Auth-Sub-ID nur innerhalb READ ONLY/ROLLBACK. Er ersetzt weder
echte JWT-Anmeldung noch positive Owner-/Member-Abnahme.

RLS ohne Browserpolicy ist bei service-only Tabellen beabsichtigt, kein
pauschaler Fehler. Die bekannten authentifizierten Workspace-/ChatAdmin-RPCs
werden nicht allein aufgrund eines Advisorhinweises für unsicher oder
vollständig sicher erklärt. Advisorhilfe:
https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

### Konkrete Production-ACL-Abweichung

Effektive Column-ACL bestätigt direkte Browserrechte auf die obigen Felder.
Owner-UPDATE-RLS plus restriktiver admin_crm_read_allowed-Check ersetzen
keine Spaltenrechte. Production hat keinen benutzerdefinierten Workspace-
Trigger, der solche Feldänderungen verhindert. Keine Mutation versucht.

Der vorhandene Vertrag
supabase/controlled/20260726121000_workspace_server_owned_columns.sql
und WORKSPACE_SERVER_OWNED_FIELDS.md verlangen Browser-INSERT=false und
UPDATE nur für zehn Stammdatenfelder. Staging sperrt die hier geprüften
Billingfelder korrekt. Keine zweite Implementierung/kein Apply hier.
Die bestehende kontrollierte Umsetzung benötigt gesonderte Kompatibilitäts-,
Ziel-/Quellprüfung, geschützte Freigabe und tatsächliche Abnahme.

### Staging-Capacityzustand

Policyrevision2, Budgets15/30/50EUR; Capacity/Sales/Quality/Readiness=false,
emergency_spend_freeze=true. Grants/Reservierungen/Allocations/monetäre
Ledgerevents jeweils0. Vier Billingevents unresolved, keine Billingstreams.
Herkunft/sichere Reconciliation dieser vier Events bleibt offen; keine
Kundeninhalte gelesen/veröffentlicht oder Events gelöscht.

Eindeutige Event-/Workspace-Grant-/Generation-/Stripeobjekt-Schlüssel
vorhanden. Katalogeindeutigkeit beweist keinen echten Concurrent-Replay.

## Übergabe / Production-Freigabeplan

Betroffen: FM-CONTRACT-AI-BILLING-001/FM-IGATE-AI-BILLING-001 und
FM-CONTRACT-REG-ENTITLEMENT-001/FM-IGATE-REG-ENTITLEMENT-001.
Der bestehende Monatsreleaseplan verweist auf diesen Bericht.
Keine zentrale Gate-Datei wird auf VERIFIED/ALLOW gesetzt.

Vor zahlungsbezogener Freigabe fehlen:

1. Bestehende server-owned-Workspace-Grenze auf Production kontrolliert
   herstellen/abnehmen; eigene geschützte Freigabe erforderlich.
2. Support1350 liefert Capacity-Installation, Writer, Zwei-Creator-Rollback.
   Consent-Production-Schema, Backup/Restore und SQL-Nachweisadapter bleiben
   bei den bestehenden Sitzungen.
3. Neuen Paketcheckout und stimmige Billinganzeige im bestehenden Pfad
   fertigstellen; diese reine Abnahmesitzung implementiert ihn nicht doppelt.
4. Aktuelle Sandbox-/Runtimebindung, Steuerklassifikation/-Konfiguration
   und rechtliche Kontofreigabe separat belegen; Schutzflags erhalten.
5. Echte Sandboxkette bezahlt/unbezahlt/asynchron/Fehler, Workspacebindung,
   Replay/Parallelität, Grant/Verbrauch/Refund/Dispute und Cleanup abnehmen.
6. Live-Webhookabweichung separat exakt autorisieren und read-only
   nachprüfen; keine Livezahlung als Test.
7. Benötigte Production-Schemas über bestehende geschützte Controller,
   frische Backup/Restorebelege und genaue Bindungen abnehmen.
   Danach erst eigene Billingaktivierungs-/Releaseentscheidung.

## Validierung / Recovery

112 Tests PASS,0 FAIL,0 SKIP aufe65609e2: bestehende Tests
stripe-ai-topup-policy, stripe-ai-topup-lifecycle, stripe-billing-event-ledger,
stripe-billing-event-sync, stripe-billing-canonical-snapshot,
stripe-billing-reconciliation, staging-stripe-catalog-readiness,
staging-stripe-webhook-readiness, webhook-security-policy.
Kein Build oder nativer PG17-Zieltest in diesem Dokumentationslauf behauptet.
Unabhängiger Quellreview bestätigte Checkout-/Legacy-/Webhookgrenzen und
server-owned-ACL-Vertrag; keine Zielmutation durch Gegencheck.
Recovery: normaler Source-Revert, kein externer Zustand zurückzusetzen.

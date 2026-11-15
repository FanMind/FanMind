# FanMind Stripe / Supabase — Abnahme 15. November 2026

**Aktualisierung 15. November 2026, 13:00 Wien:** Live-Webhookkonfiguration nach ausdrücklicher Owner-Freigabe korrigiert und unabhängig zurückgelesen: **PASS, exakt22/22 Ereignisse**. Die früheren20/22-FAIL-Befunde unten sind historische Vorzustände. Vollständige Billingabnahme weiterhin **BLOCKED**; siehe Abschluss dieser Datei.

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


## Sichere Wiederaufnahme — 15. November 2026, 12:29 Wien

Diese Ersatzsitzung übernimmt ausschließlich nachweisbare GitHub-Quellen.
Ein früherer Work-Zwischenspeicher war nicht verfügbar. PR1518 ist weiterhin
offen auf `460d31db02339649bfff78678956cdf4b7265679`; alle14 Check-Runs
dieses gespeicherten Heads sind SUCCESS, einschließlich nativer PG17-Prüfung.
Die112 Quelltests oben sind übernommene Nachweise, kein erneuter lokaler Lauf.
Main ist inzwischen `6bc209851b4a54609747099ec34264318dc7f4c4` nach dem
extern koordinierten Merge von1515. Die Stripe-Katalog-/Webhook-Prüfquellen
sind gegenüber e65609e2 unverändert. Kein eigener Merge/Deploy.

| Frischer Prüfgegenstand | Status | Beobachtung und Grenze |
| --- | --- | --- |
| Stripe-Live-Zugriff | PASS | Bestehender FanMind-Kontext erreichbar, keine erneute Autorisierung |
| Stripe-Live-Preise | PASS Katalog |13 aktive Preise vollständig, has_more=false;99/199/312 monatlich und vier Datenpakete stimmen; vier Topup-Steuercodes weiterhin leer |
| Live-Webhook | FAIL | Bestehender Endpoint weiterhin enabled,20/22 Ereignisse; customer.tax_id.created/deleted fehlen |
| Sandbox-Zugriff | PASS | Bestehende Anmeldung öffnet ausdrücklich FanMind Sandbox, separates Konto acct_1TnMJbPSYMcFG13m und /test/; kein neues Konto/Secret |
| Sandbox-Produktliste | PASS begrenzt | UI vollständig1–8 von8:99/199/312 pro Monat, Datenpakete14,99/37,49/74,99/149,00EUR und Daily1EUR/Tag; sieben Produkte ohne angezeigten Steuercode |
| Sandbox-Preis-ID-/Runtimebindung | NOT TESTED | Sichtbare Produktliste beweist nicht gespeicherte Staging-Price-IDs, Webhooksecret, Signaturtransport oder Kauf-Lifecycle |
| Production-Column-ACL | FAIL bestätigt | Alle sechs oben genannten Billingfelder weiterhin authenticated INSERT=true/UPDATE=true; keine Schreibprobe |
| Production-Provisioning | BLOCKED | ensure_current_user_workspace fehlt; Capacity-Grants und allgemeiner Billingeventledger fehlen ebenfalls |
| Production-Transaktionsmomentbild | PASS begrenzt |11:28:51UTC:0 andere idle-in-transaction-Sitzungen; kein Beweis über frühere abgeschlossene Transaktionen |
| Staging-Column-ACL | PASS begrenzt | Alle sechs geprüften Billingfelder INSERT=false/UPDATE=false |
| Staging-Capacity | BLOCKED bestätigt |11:23:39UTC:0 Grants,0 Capacity-Ledgerereignisse,4 Billingevents unresolved; nur vier bestehende Policy-/Guard-Funktionen, keine monetären Lifecycle-RPCs |
| Vollständige Zahlungsabnahme | BLOCKED | Keine Livezahlung, Sandboxzahlung, Refund-, Grant- oder Reconciliation-Mutation ausgeführt |

Sandboxquelle: bestehender Stripe-Dashboard-Produktkatalog, Kontoauswahl und
sichtbarer Sandboxhinweis. Die frühere pauschale Browser-Zugriffssperre gilt
für diese Produktliste nicht mehr. Der Connector selbst bietet weiter nur Live.
UI-Zugriffe waren intermittierend langsam. Lesende Katalog-/Webhookworkflow-
Anforderungen wurden über die vorhandenen Formulare versucht; nach den
Klicks war kein neuer Lauf in der Repository-API nachweisbar. Kein Run-ID-
oder PASS-Nachweis erfunden und kein unklarer Dispatch blind wiederholt.
Vor erneutem Start jeweils tatsächliche Runliste abgleichen. Keine geschützte
Schreiboperation aus dieser oder der wiederhergestellten Dokumentation erkennbar;
ein vollständiges historisches Stripe-Audit ist damit nicht bewiesen.

### Konkrete nächste geschützte Schritte

1. **Separat freizugebende Live-Webhookkorrektur:** ausschließlich beim
   bestehenden FanMind-Endpoint `we_1TrLMNAOA7p70TO9kfBl29nt` die aktuelle
  20er Ereignisliste um `customer.tax_id.created` und
   `customer.tax_id.deleted` auf22 erweitern. Unmittelbar vorher Istzustand
   lesen und gegen `src/lib/stripeWebhookEventPolicy.mjs` vergleichen;
   URL, API-Version, Status und Secrets erhalten. Anschließend GET-Nachweis,
   keine Testzahlung und keine erzwungene Wiederzustellung. Freigabe hier
   **nicht erteilt**, Änderung **nicht ausgeführt**.
2. **Production-Workspacegrenze:** keine isolierte GRANT-/REVOKE-Reparatur.
   Bestehendes Expand-/Contract-Verfahren in WORKSPACE_SERVER_OWNED_FIELDS.md
   verwenden. Fehlende Provisioning-RPC, Brückenkompatibilität, Vorprüfungen,
   isolierte JWT-/Parallelitätsabnahme und schriftliches Go sind vor dem
   geschützten Contract-Apply nachzuweisen. Hier nur Bedarf festgestellt;
   keine pauschale Production-SQL-Freigabe anfordern oder unterstellen.
3. **Staging-Abhängigkeit bei Support1350/1500 belassen:** monetäre
   Lifecycle-/Writer-Installation und exakt freigegebene synthetische
   Creatorbindungen zuerst durch deren zuständige Sitzung abnehmen.
   Danach erst Checkout→Webhook→Entitlement→Grant→Verbrauch→Reversal,
   Concurrent-Replay und Cleanup sinnvoll positiv prüfen.
4. **Monatsrelease:** vorhandene Bericht-/Receipt-Verknüpfung bleibt bestehen;
   Gesamtergebnis weiter BLOCKED, keine Gate-Aktivierung. Auth-/Workspace-
   Positivtests, echte Checkout-Rückkehr/Abbruch, Steuer-/Rechtsfreigabe,
   persistenter Replay und Recovery bleiben getrennt offen.

Keine zweite Implementierung, keine dritte Datenbank, keine Secrets,
Kundeninhalte oder privaten Zahlungsdaten im Bericht. Aktuelle Ergänzung
ändert ausschließlich Dokumentation; die ursprünglichen Messwerte im Receipt
bleiben als historischer Snapshot erhalten.


## Owner-genehmigte Live-Webhookkorrektur — 15. November 2026, 13:00 Wien

**Ergebnis: PASS ausschließlich für die Webhookkonfiguration.**

Freigabegrundlage: ausdrücklicher Owner-Auftrag in dieser Ersatzsitzung,
beschränkt auf customer.tax_id.created und customer.tax_id.deleted.
Unmittelbarer GET-Preflight: genau ein vorhandener aktivierter Live-Endpoint,
has_more=false,20 Ereignisse. Set-Abgleich gegen die vorhandene Richtlinie:
keine unerwarteten Typen, exakt die beiden genehmigten Typen fehlen.

Quellbindung: Main `4577f4c338ad19035a16f1cb11aa5a5e57524d14`,
`src/lib/stripeWebhookEventPolicy.mjs`,
Git-Blob `56bdeca500b78bddf7b90e330642aa1a7ba3fbaa`.
Die Richtlinie ist gegenüber dem vorher geprüften Stand unverändert.

Über die bestehende authentifizierte Stripe-Verbindung im Live-Kontext wurde
genau ein Update auf dem bestehenden Endpoint
`we_1TrLMNAOA7p70TO9kfBl29nt` ausgeführt. Request enthielt ausschließlich
dessen ID und enabled_events: vollständige ursprüngliche20er Liste plus
die zwei freigegebenen Typen. Keine weiteren Konfigurationsparameter gesendet.

Unabhängiger neuer GET nach dem Update, beobachtet `2026-11-15T12:00:08.646Z`:

| Prüfung | Ergebnis |
| --- | --- |
| Ereignisse | PASS:22 Einträge,22 unterschiedliche Typen, exakte Gleichheit mit der Richtlinie |
| Ergänzt | customer.tax_id.created; customer.tax_id.deleted |
| Entfernt | Keine |
| URL | Unverändert https://fanmind.ch/api/stripe/webhook |
| API-Version | Unverändert2026-06-24.dahlia |
| Status / Modus | Unverändert enabled / livemode=true |
| Sonstige zurücklesbare Eigenschaften | ID,object,application,created,description,metadata unverändert |
| Signing Secret | Nicht angefordert/nicht geändert; GET liefert es nicht, daher kein erfundener Bytevergleich |
| Zahlungen, Refunds, Wiederzustellungen | Keine ausgelöst |
| SQL, Migration, Deployment, PR-Merge | Keine ausgeführt |

Diese Korrektur ersetzt keinen Zustellungs-, Signatur-, Replay- oder
persistenten Zahlungs-/Guthaben-Lifecycle-Nachweis. Automatisch künftig
auftretende freigegebene Ereignisse können nun an den bestehenden Endpoint
zugestellt werden; es wurde kein Ereignis künstlich erzeugt oder wiederholt.

### Fortgesetzte getrennte Supabase-Abnahme

Neue ausschließlich lesende Katalogabfragen am15November12:00:33–39UTC:

- Production: sechs geprüfte Billingfelder weiterhin authenticated
  INSERT=true/UPDATE=true; Provisioning-RPC fehlt, monetäre Capacity-Funktionen
  und allgemeiner Billingledger fehlen. **FAIL/BLOCKED unverändert.**
- Staging: dieselben sechs Billingfelder INSERT=false/UPDATE=false,
  Provisioning-RPC vorhanden und Billingledger vorhanden; weiterhin nur die
  vier Policy-/Guard-Capacityfunktionen, keine monetären Lifecycle-RPCs.
  **PASS begrenzt für ACL / BLOCKED für monetäre Capacity-Abnahme.**
- Keine Zielmutation, Grant-, Reconciliation- oder Fixtureanlage.
  Support1350/1500 und Production-Expand-/Contract bleiben getrennte Arbeiten.

Monatsrelease-Übergabe: Der Live-Webhook20/22-Blocker ist geschlossen.
Production-ACL/Provisioning, Staging-Lifecycle/Writer, Paketcheckout,
Steuer-/Rechtsfreigabe und vollständige Sandbox-Zahlungs-/Replay-/Recovery-
Abnahme bleiben offen. Kein globales Gate auf VERIFIED/ALLOW gesetzt.

Die14 Checks auf dem bisherigen Dokumentationshead
`349dc74b9e2a046cd9cf2adf30dc3e14f7583b05` sind vollständig SUCCESS.
Diese Berichtsergänzung erzeugt einen neuen Dokumentationshead mit eigener
CI; frühere grüne Checks gelten nicht als dessen Abschluss.
Der ursprüngliche JSON-Receipt bleibt unveränderter historischer Snapshot;
die neue tatsächliche Stripe-Konfigurationsmutation ist ausdrücklich hier
vermerkt. PR1518 bleibt offen und wird ohne eigene Freigabe nicht gemergt.

## Billing-Sicherheit und Capacity-Fortsetzung — 15. November 2026, 13:15 Wien

Main4577f4c338ad19035a16f1cb11aa5a5e57524d14 wurde konfliktfrei in denselben
PR-Arbeitsstand übernommen; fremde Fachänderungen bleiben erhalten.
Alle14 Checks auf224442a8ec4235fa3188d271c21780068d01bae7 terminal SUCCESS.
Vollständiger nativer PostgreSQL17-Nachweis:
https://github.com/FanMind/FanMind/actions/runs/43711718026/job/132804501140 .
Dieser vorhandene erfolgreiche Lauf wurde nicht unnötig erneut gestartet.

Konkrete Sicherheitsvorbereitung:
[Berechtigungen, Schreibpfade, Rückfall und Regressionen](BILLING_WORKSPACE_ACL_PREPARATION_1518.md).
Unveränderte bestehende kontrollierte SQL wird in neuer isolierter nativer
PG17-Regression ausgeführt, verpflichtend im vorhandenen CI-Job. Keine zweite
Produktivimplementierung, kein generischer Migrationsweg und kein DB-Apply.
Lokal31 Quell-/Workflow-/Suiteprüfungen PASS,1 expliziter Native-SKIP mangels
Docker/PG17; neuer nativer Ausführungsstatus ist am endgültigen Head zu prüfen.

Production12:10–13UTC: die sechs exakten Billingfelder besitzen direkte
INSERT/UPDATE-Rechte für anon und authenticated, service_role ebenfalls.
Keine Rollenvererbung und keine benutzerdefinierten Workspace-Trigger.
RLS-Owner-/Member-/Admin-CRM-Grenzen bleiben gesondert relevant. Alle sieben
Step-A-Spalten vorhanden, keine Owner-/Member-Duplikatgruppen, Provisioning-RPC
fehlt. Ein sofortiger Contract-Apply würde den erlaubten Legacy-JWT-POST-Fallback
brechen; keine unvollständige Production-Freigabe unterstellen.

Staging12:11:20UTC: monetäre Funktionen und Entitlementwriter fehlen,
0 Grants/0 monetäre Ledgerevents. Vier unresolved Events sind signaturgeprüft
und tenant_binding_missing:2 subscription.deleted mit vorhandenen Kandidaten,
1 checkout.session.completed und1 customer.tax_id.created ohne Kandidatur.
Keine autoritative Workspacebindung, kein Kandidatenkonflikt. Herkunft nicht
erfunden, keine privaten Event-/Kundenwerte veröffentlicht, nichts wiederholt,
gelöscht oder als verarbeitet markiert.

PR1500/Support-Dokumentation auf317493e12e8643d90ceb1917baac6c17e663089d
abgeglichen. Bestehende Capacity-Installations-/Writer-/Acceptancecontroller
bleiben zuständig und unverändert. Vollständige Sandboxkette weiter BLOCKED,
bis diese Voraussetzungen tatsächlich installiert/abgenommen und die
synthetischen Identitäten sowie Price-/Steuer-/Runtimegates gebunden sind.
Monatsrelease-Übergabe entsprechend aktualisiert. Keine Production-SQL-,
Deployment-,Merge-,Zahlungs- oder zusätzliche Secretfreigabe verbraucht.

Ergänzender Production-Guard-Vorabgleich12:20:13UTC:2 Legacy-Starter-
Workspaces erfüllen die unveränderte Vertragsannahme-Prüfung nicht;1 Workspace
hat mindestens eine NULL-Core-Invariante,0 fehlende Owner-Mitgliedschaften.
Nur Zähler, keine Kundendaten gelesen/veröffentlicht. Keine Datenreparatur
oder rückdatierte Zustimmung. Production-Contract-Apply bleibt ausdrücklich
BLOCKED auch nach einer künftigen RPC-Bereitstellung, bis diese Befunde
anhand autoritativer Vertrags-/Auditbelege geklärt sind. Eine neue native
Negativprüfung führt den bestehenden Annahme-Guard tatsächlich aus und weist
die unveränderten ACLs/Policies nach dessen Abbruch nach.

## Technische Folgevorbereitung nach Merge1518 — 15. November 2026

Main e48eea970e5c0b541ebfe58e8aeb7ccd3dea8ae8 ist unverändert übernommen.
Die [kontrollierte Struktur-Recovery](WORKSPACE_PROVISIONING_RECOVERY_1518.md)
ergänzt nun tatsächlich ausführbares, reproduzierbares Source-SQL und native
Pflichtregressionen. Gleiche vorhandene RPC-Signatur, aber ausschließlich
lesende SECURITY-INVOKER-Variante unter Caller-RLS: kein Create-Workspace-
oder Membership-Reparaturpfad, keine neue Definer-Kohorte. Membership-Unique-
Constraint wird wiederverwendet; nur wirklich fehlende Owner-Eindeutigkeit
wird angelegt. Original-Billing-Contract unverändert/unapplied.

PASS Quelle: deterministische Pins/Artefakte und vorhandene lokale Quelltests;
hosted native Ausführung ist an den tatsächlichen Folge-PR-Head zu binden.
PASS begrenzt: generierte reine Postflight-SELECT auf Production ergab
owner_unique=false,membership_unique=true,rpc_exact=false; kein Apply.
BLOCKED: Zielinstallation, echte JWT-/PostgREST-Kompatibilität, vollständige
Vertragsdaten- und Zahlungsabnahme bleiben getrennte Gates.

Autoritative Nachweissuche fortgesetzt:1 zugehöriger Operations-Auditeintrag
ohne Annahmeversion/-Zeit/-Actor auch in verschachtelten Metadaten;0 server-
verwaltete Auth-Metadaten-Kandidaten,1 veränderbarer User-Metadaten-Kandidat
(nicht als Nachweis verwendet). Für den einen Workspace mit drei NULL-
Billingfeldern fehlen auch Customer-/Subscription-/Checkout-/PaymentIntent-
Referenzen. Keine sichere Stripe-Ableitung, kein geratenes Update.
Externe Originalunterlagen damit nicht ausgeschlossen; geprüfte Bestände
liefern derzeit keine ausreichende Rekonstruktionsgrundlage.

Support1500 unverändert offener Draft. Keine fremde Capacity-Implementierung,
keine Production-/Stripe-Live-/Kunden-/Vertragsdatenänderung, keine Zahlung
oder Guthabenbuchung. Vollständige externe Sandboxkette NOT TESTED/BLOCKED.

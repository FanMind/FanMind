# Stripe Billing write freeze — Staging cutover

Stand: 6. September 2026

## Zweck

Der allgemeine Workspace-Billing-Ledger besitzt einen bewusst getrennten, kontrollierten Staging-Apply. Für das kurze Intervall zwischen SQL-Installation und aktivem Capture-only-Runtimepfad dürfen weder neue Checkout-Sessions entstehen noch legacy Workspace-Billing-Projektionen als erfolgreich bestätigt werden. Dafür existiert der server-only Schalter:

```dotenv
FANMIND_STRIPE_BILLING_WRITE_FREEZE=true
```

Fehlt der Wert, ist er leer oder ist er nicht exakt `true`, ist die Sperre aus.

## Wirkung

Während der Sperre:

- die gemeinsame Funktion `createStripeCheckoutSession()` liefert den festen Sperrcode, bevor sie den Stripe-Client lädt; dies schützt API, `/billing/start`, `/billing/checkout` und den internen Admin-Test-Checkout gleichermaßen;
- `/api/billing/checkout` antwortet vor einer Stripe-Session-Erzeugung mit HTTP `503`, dem festen Code `stripe_billing_write_frozen` und `Retry-After: 60`;
- die Zahlungsstartseite zeigt den Wartungshinweis ohne neuen Checkout-Link, der alternative Checkout-Einstieg führt dorthin zurück und der Admin-Test-Checkout liefert `503` ohne anschließende Workspace-Aktualisierung;
- legacy Workspace-Billing-Projektionen liefern `STRIPE_BILLING_RETRYABLE_ERROR`;
- ein bereits signierter und behandelter Stripe-Webhook wird dadurch nicht als erfolgreich projiziert bestätigt, sondern bleibt retry-fähig;
- die Sperre selbst führt keine Stripe-, Supabase- oder Production-Mutation aus.

Der signierte Legacy-Pfad antwortet vor Referenzauflösung mit `503`, `stripe_billing_write_frozen` und `Retry-After: 60`. Ein aktivierter Capture-only-Pfad bleibt davon ausgenommen, damit Events während der Checkout-Sperre dauerhaft erfasst werden können.

Die Signaturprüfung des Webhooks bleibt unverändert vorgelagert. Ungültige Signaturen werden weiterhin normal abgelehnt.

Bereits bei Stripe angelegte Sessions werden durch diesen Schalter nicht beendet. Der Sperrnachweis gilt für neue Session-Erzeugung in der neu geladenen Runtime und die lokale Legacy-Projektion; der bestehende Ledger-/Cutover-Abgleich bleibt für bereits laufende Zahlungsereignisse erforderlich.

## Technische Apply-Voraussetzung

Staging-Deploy und Billing-Ledger-Apply verwenden dieselbe GitHub-Concurrency-Gruppe mit `cancel-in-progress: false`. Ein Deploy kann die Runtime daher nicht während des kontrollierten Apply austauschen. Normale Deploys verwenden `billing_write_freeze=preserve` und übernehmen den bisherigen `.release.env`-Wert vor dem Release-Kopieren. Nur eine explizite Auswahl `false` hebt die Sperre auf.

Unmittelbar vor dem SQL-Apply prüft `staging-billing-freeze-control.mjs` über HTTPS die tatsächliche Runtime: `/api/version` muss exakt den geprüften Commit und `runtimeEnvironment=staging` liefern; ein anonymer Checkout-POST mit leerem Objekt muss `503`, `stripe_billing_write_frozen` und `Retry-After: 60` zurückgeben; danach wird der Versionsbeleg wiederholt. Der Test sendet keine Nutzer-/Zahlungsdaten, Cookies oder Bearer-Zugangsdaten und kann ohne Anmeldung keine Session anlegen. Ohne diesen Beleg wird der SQL-Befehl nicht gestartet. Ein Deploy mit aktivierter Sperre verlangt denselben Runtime-Nachweis als Postflight.

## Verbindliche Staging-Sequenz

1. Exakten geprüften `main`-Commit auf Staging deployen.
2. `FANMIND_STRIPE_BILLING_WRITE_FREEZE=true` ausschließlich in Staging setzen und Runtime neu laden.
3. Negativnachweis: neuer Checkout muss mit dem festen `503`-Code scheitern; ein kontrollierter signierter Staging-Webhook darf während der Sperre keine legacy Workspace-Projektion bestätigen. Dazu den Signed-Smoke-Workflow auf demselben Commit mit `verify_billing_freeze=true` ausführen und `STAGING_SIGNED_BILLING_FREEZE=PASS` verlangen. Die Probe prüft zuerst Signaturbindung und Runtime, erwartet für einen behandelten Eventtyp den festen Sperrcode und wiederholt den Runtime-Nachweis. Ihre absichtlich ungültige Event-ID und fehlenden Workspace-/Providerreferenzen verhindern eine persistente Ledger-Erfassung. Sie ist kein Zahlungs- oder Capture-Nachweis.
4. Den bestehenden manuellen Workflow `.github/workflows/stripe-billing-event-ledger-staging.yml` auf demselben `main`-Commit mit `apply-stripe-billing-event-ledger` ausführen. Kein direkter SQL-Bypass.
5. Nach erfolgreichem Schema-Postflight die bereits dokumentierte Capture-only-Stufe setzen:

```dotenv
FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED=true
FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED=20260816210000
FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED=false
```

6. Staging erneut laden und beweisen, dass signierte Billing-Events persistent erfasst werden, ohne kanonische Projektion oder AI-/Referral-Nebenwirkungen auszulösen.
7. Erst nach diesem positiven Capture-Nachweis `FANMIND_STRIPE_BILLING_WRITE_FREEZE=false` setzen und Runtime neu laden.
8. Bestehende `controlled_cutover`, `unresolved` und `reconciliation_needed`-Zustände mit frischem kanonischem Stripe-Snapshot über den bestehenden Reconciliation-Vertrag auflösen.
9. Das dritte Gate `FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED=true` bleibt bis zur separaten Lifecycle-Abnahme gesperrt.

## Harte Grenzen

- Diese Sequenz gilt nur für isoliertes Staging.
- Production darf durch diesen Runbook-Schritt nicht verändert werden.
- Die Sperre ersetzt weder Ledger, Postflight, Reconciliation noch Stripe-Provider-Abnahme.
- Kein automatischer Retry bei unbestimmtem Apply-/Providerzustand.
- Plus/Ultra, Referral-Billing und Production-Billing werden dadurch nicht freigeschaltet.
- Die Sperre ist kein Dauerzustand. Bleibt sie nach erfolgreichem Capture-Nachweis aktiv, ist der Staging-Zahlungspfad absichtlich nicht testbar und die Abnahme unvollständig.

## Rollback

Vor einem Ledger-Apply genügt das Zurücksetzen auf `false` beziehungsweise das Entfernen der Variable. Nach einem erfolgreichen kontrollierten SQL-Apply bleibt das Schema bestehen; ein Rollback des Runtime-Schalters darf nicht als Datenbank-Rollback dargestellt werden. Danach gelten ausschließlich die bestehenden Ledger-/Reconciliation-Runbooks.

## Rollout-Vorprüfung: restriktive Owner-Policies

Die am 6. September 2026 geprüfte Workspace-Member-Datengrenze ergänzt restriktive Owner-Schreibpolicies. Diese gewähren selbst keinen Zugriff. Der Meta-Postflight unterscheidet daher restriktive Einschränkungen von erlaubenden Schreibpolicies; letztere bleiben ebenso verboten wie Browser-Schreibrechte auf Tabellen oder Spalten. Die globale Rollout-Prüfung bleibt verpflichtend. Quelle: https://www.postgresql.org/docs/17/sql-createpolicy.html

## Abbruchdiagnose

Ein fehlgeschlagener Apply gibt ausschließlich SQLSTATE und eine im gepinnten SQL enthaltene feste Fehlerklasse aus. Freitext, Details und SQL-Kontext werden nicht protokolliert. Vor einem erneuten Versuch den tatsächlichen Schema-/Migrationszustand read-only prüfen; fehlende Abschlussmarker allein beweisen keinen Rollback.

Die separate KI-Tarif-Lifecycle-Abnahme benötigt eine Customer-/Subscription-Bindung. Für einen vollständig ungebundenen konfigurierten Test-Workspace legt sie synthetische Referenzen ausschließlich innerhalb der anschließenden Rollback-Transaktion an. Bestehende Referenzen bleiben erhalten; nach dem Rollback muss die synthetische Bindung verschwunden sein. Dies erzeugt keine Stripe-Ressourcen und ist kein echter Checkout-Nachweis.

## PostgreSQL-Indexprüfung

Die spaltenbezogene Form von `pg_get_indexdef` liefert den Spaltenausdruck ohne Sortierzusatz. Die drei DESC-Indizes werden deshalb über Spaltenname plus exakt `indoption = 0 0 3` geprüft (erste zwei Schlüssel aufsteigend, dritter absteigend mit NULLS FIRST). Der vollständige Vergleich mit dem gepinnten Schema-Oracle bleibt zusätzlich aktiv. Die Änderung repariert eine falsche Ablehnung; die Indizes selbst bleiben unverändert.

## Geschützter Capture-only-Runtime-Schritt

`staging-billing-capture.yml` verlangt den geprüften und bereits deployten
`main`-Commit und `activate-staging-billing-capture`. Unter derselben
Deployment-Sperre prüft ein geschützter Staging-Job den vollständigen
installierten Ledger read-only mit dem gepinnten Postflight; kein Apply ist
in diesem Workflow enthalten. Erst danach ergänzt der isolierte Host-Job die
drei Capture-only-Werte atomar in der privaten `.release.env` und startet
den bestehenden Staging-Dienst neu. Die Checkout-Sperre bleibt aktiv.
Normale Deploys übernehmen den vollständigen Capture-only-Zustand; partielle,
doppelte oder abweichende Zustände stoppen den Deploy statt die Runtime
unbemerkt in den Legacy-Pfad zurückzusetzen.

Der folgende Nachweis signiert genau einen reservierten synthetischen
Checkout-Event mit Testmodus und Zahlungsstatus `unpaid`. Er enthält weder
Customer-/Subscription- noch Workspace-Bindung und kann daher keine echte
Workspace-Projektion oder AI-/Referral-Verarbeitung auslösen. Vorher muss
die feste, an den GitHub-Lauf gebundene Event-ID fehlen; nach der erfolgreichen
HTTP-Antwort muss genau dieser Ledger-Datensatz mit `unresolved`,
`tenant_binding_missing`, ohne Workspace und mit Revision 0 vorhanden sein.
Die öffentliche Release-/Freeze-Bindung wird davor und danach geprüft.
Der minimale synthetische Datensatz bleibt als Auditnachweis erhalten;
er ist kein Zahlungsereignis eines Kunden und keine echte Checkout-Abnahme.

Nur `STAGING_BILLING_SIGNED_DURABLE_CAPTURE=PASS` bestätigt diesen Schritt.
Ein Abbruch lässt Checkout gesperrt. Es gibt keinen automatischen zweiten
Webhook-Versuch und keine kanonische Aktivierung. Anschließend ist das
explizite Staging-Unfreeze aus Schritt 7 möglich; echte Testzahlungen und
kanonische Lifecycle-Abnahme bleiben gesondert zu belegen.

Die Abwesenheits- und Persistenzprüfung verwendet ausdrücklich den
projektgebundenen privaten PostgreSQL-Prüfzugang in Read-only-Transaktionen.
`service_role` hat keine Leserechte auf die Ledger-Tabelle und wird dafür
nicht verwendet. Erst ein nachgelagerter erfolgreicher Persistenz-Job erlaubt
dem Host-Job, den festen Commit-/Run-Beleg privat in `.release.env` zu speichern.
Der Deploy verweigert `billing_write_freeze=false` bei aktivem Capture ohne
diesen Beleg; beim Übergang aus der Sperre muss er zum deployten Commit passen.
Fehlgeschlagene oder unbestimmte Capture-Läufe können Checkout daher nicht
über bloß erhaltene Konfigurationsflags entsperren.

Der Persistenzbeleg ist an die vor dem Send als abwesend geprüfte, eindeutige
GitHub-Run-Event-ID gebunden und verfällt nicht allein durch Runner-Wartezeit.
Ein neuer Runtime-Konfigurationsversuch entfernt einen alten Erfolgsbeleg;
er muss seinen eigenen Persistenz-Job abschließen, bevor erneut entsperrt wird.

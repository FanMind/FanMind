# FanMind Finaler Go-Live-Smoke-Test

## Zweck

Dieser Test trennt automatische, read-only Prüfungen von den wenigen Schritten, die einen echten angemeldeten Nutzer, Stripe und den Adminbereich benötigen.

Produktionsdaten werden nicht gelöscht, verändert oder wiederhergestellt. Referral-Billing, Social-Senden und nicht freigegebene KI-Add-ons bleiben deaktiviert.

## Gate A – automatisch und read-only

Ausführen:

```bash
FANMIND_GO_LIVE_BASE_URL=https://fanmind.ch \
FANMIND_EXPECTED_RELEASE_COMMIT=<main-commit> \
FANMIND_EXPECTED_RUNTIME_ENVIRONMENT=production \
npm run smoke:go-live:public
```

Geprüft werden:

- Landingpage Deutsch und Englisch;
- Login und Registrierung;
- Roadmap und öffentliche Rechtsseiten;
- `/api/version` mit exaktem Release-Commit und `runtimeEnvironment=production`;
- `/api/health` und alle veröffentlichten Komponenten;
- öffentliche Starter-Preise;
- Ausschluss alter 299-€- und Pilot-CTAs;
- Kontaktwissen- und Human-in-the-loop-Produktwahrheit.

Nach jedem erfolgreichen Production-Deployment startet zusätzlich der Workflow `FanMind Final Go-Live Readiness` automatisch.

## Gate B – Demo- und Produktkern

Im privaten Browserfenster:

1. `https://fanmind.ch` öffnen.
2. kostenlose Demo starten.
3. Dashboard laden.
4. Kontakte öffnen.
5. Sandra M. oder einen Demo-Kontakt öffnen.
6. Nachrichtenkontext prüfen.
7. KI-Antwortvorschläge erzeugen.
8. einen Vorschlag kopieren.
9. Kontaktwissen speichern.
10. Follow-up speichern.
11. Follow-up-Liste öffnen.
12. abmelden und erneut anmelden.

Erwartung:

- keine Endlosschleife;
- keine automatische Sendung;
- Demo-Daten bleiben von realen Kundendaten getrennt;
- keine Schreibmöglichkeit in fremde Workspaces;
- klare Fehleranzeige statt leerer oder falscher Erfolgszustände.

## Gate C – echter Billing-Lifecycle

Nur mit einem eigens dafür vorgesehenen internen Testkonto und dem freigegebenen `internal_daily_test`-Ablauf durchführen. Keine normale Starter-Gebühr von 990 € plus 312 € nur zu Testzwecken auslösen.

1. internes Testkonto beziehungsweise Test-Workspace anlegen oder auswählen;
2. im Adminbereich bestätigen, dass es als interner Test gekennzeichnet und vom Referral ausgeschlossen ist;
3. den freigegebenen 1-€/Tag-Live-Testcheckout starten;
4. Stripe Checkout vollständig abschließen;
5. Rückleitung zu FanMind prüfen;
6. Dashboard und Billing-Status prüfen;
7. `/settings/package` öffnen;
8. `/settings/invoices` öffnen und Rechnung beziehungsweise Stripe-Beleg prüfen;
9. Admin Billing öffnen und denselben Workspace kontrollieren;
10. in Stripe den Webhook-Erfolg und HTTP 200 bestätigen;
11. Testabo kontrolliert kündigen beziehungsweise beenden;
12. nach Webhook-Verarbeitung den gekündigten Status in FanMind bestätigen.

Erwartung:

- kein Referral-Rabatt;
- keine KI-Add-ons;
- keine falsche Umsatzsteuerdarstellung;
- Rechnung gehört ausschließlich zum Test-Workspace;
- keine fremden Rechnungen sichtbar;
- Statusänderungen werden durch den Webhook übernommen.

## Gate D – Admin und Betrieb

1. `/admin/operations` öffnen;
2. Health, Release-Commit, Worker und letzte Jobs prüfen;
3. `/admin/billing` öffnen;
4. Test-Workspace und Billing-Status prüfen;
5. Admin-Benachrichtigungen prüfen;
6. keine frei eingebbare Shell- oder Restore-Aktion aus dem Browser ausführen.

## Gate E – Abschlussentscheidung

### Technisch freigegeben

Nur wenn:

- automatischer Read-only-Test grün;
- Demo-Produktkern grün;
- Billing-Lifecycle grün;
- Rechnung und Admin-Billing grün;
- Stripe-Webhook 200;
- Production-Commit stimmt;
- keine P0-Fehler offen.

### Kommerziell freigegeben

Zusätzlich erforderlich:

- externe Steuerbestätigung;
- externe Rechtsprüfung der relevanten B2B-Unterlagen;
- finale Entscheidung zu UID, Firmenbuch und Rechnungsangaben;
- Referral-Billing bleibt bis zu seiner separaten Freigabe deaktiviert.

## Ergebnisprotokoll

| Bereich | Ergebnis | Nachweis / Notiz |
| --- | --- | --- |
| Public Read-only | offen | |
| Demo und Produktkern | offen | |
| Login erneut | offen | |
| Billing Checkout | offen | |
| Paket | offen | |
| Rechnung | offen | |
| Admin Billing | offen | |
| Stripe Webhook 200 | offen | |
| Operations Center | offen | |
| Technische Freigabe | offen | |
| Steuer-/Rechtsfreigabe | separat offen | |

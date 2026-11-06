# Stripe-Testkatalog: read-only Staging-Abnahme

## Zweck und Grenze

Der manuelle Workflow `FanMind Staging Stripe Catalog Readiness` prüft den
vollständigen, vom Production-Katalog getrennten Stripe-Testbestand für das
isolierte FanMind-Staging. Er erstellt und verändert weder Stripe-Ressourcen
noch Zahlungen, Webhooks, Kundendaten oder Datenbankzeilen.

Der Lauf akzeptiert ausschließlich einen Stripe-Testschlüssel, ein
konfiguriertes Staging-Webhook-Secret und fünf unterschiedliche aktive
Testpreise mit aktiven Testprodukten:

- Starter Setup: 990 Euro einmalig;
- Starter: 312 Euro monatlich;
- interner Daily-Test: 1 Euro täglich;
- KI Plus: 100 Euro monatlich;
- KI Ultra: 200 Euro monatlich.

Alle Preise müssen in Euro geführt sein, `livemode=false` melden und exakt den
jeweiligen einmaligen, monatlichen oder täglichen Intervallvertrag erfüllen.

## Ausführung

1. Offline `npm run stripe:staging-catalog:check` ausführen.
2. Den Kontrollcode vollständig prüfen und nach `main` mergen.
3. Den Workflow auf `main` mit dem exakten geprüften Commit und der
   Bestätigung `verify-staging-stripe-catalog` starten.
4. Nur einen Lauf akzeptieren, der gemeinsam meldet:
   - `STAGING_STRIPE_MODE=test`;
   - `STAGING_STRIPE_WEBHOOK_SECRET=configured`;
   - `STAGING_STRIPE_CATALOG_PRICES=5`;
   - `STAGING_STRIPE_CATALOG=PASS`;
   - `SECRETS_WURDEN_NICHT_AUSGEGEBEN=true`.

Der Nachweis prüft den Katalog und die gebundene Serverkonfiguration. Ein
signierter Stripe-Testwebhook sowie Checkout, Kündigung, Fehlzahlung und
Entitlement-Übergänge bleiben Teil der getrennten synthetischen
Billing-Lifecycle-Abnahme.

Fehler werden ausschließlich als feste Kategorien ausgegeben. Insbesondere
unterscheidet der Lauf fehlende Lese-Berechtigung des Testschlüssels, fehlende
Preise, ungültige Katalogwerte und vorübergehend nicht erreichbare Stripe-APIs,
ohne HTTP-Antworten, Billing-Daten oder Secrets zu protokollieren. Stripe-
Preis-IDs sind im GitHub-Environment nicht geheim; der Prüfcode gibt sie nicht
zusätzlich aus.

Ist genau ein Katalogeintrag nicht auffindbar oder ungültig, nennt die
Diagnose ausschließlich einen der fünf festen Slots `starter_setup`,
`starter_monthly`, `internal_daily_test`, `ai_plus` oder `ai_ultra`. Damit kann
die zugehörige Staging-Variable korrigiert werden, ohne die konkrete Price-ID
in der Diagnose zu wiederholen.

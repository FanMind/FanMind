# Stripe-Testkatalog: read-only Staging-Abnahme

## Zweck und Grenze

Der manuelle Workflow `FanMind Staging Stripe Catalog Readiness` prüft den
vollständigen, vom Production-Katalog getrennten Stripe-Testbestand für das
isolierte FanMind-Staging. Er erstellt und verändert weder Stripe-Ressourcen
noch Zahlungen, Webhooks, Kundendaten oder Datenbankzeilen.

Der Lauf akzeptiert ausschließlich einen Stripe-Testschlüssel und ein
konfiguriertes Staging-Webhook-Secret. Der geschützte Workflow wählt jetzt
standardmäßig `catalog_contract=capacity_v2`: drei unterschiedliche aktive
Testpreise mit aktiven Testprodukten für **99 / 199 / 312 Euro monatlich**.
Sie werden ausschließlich über die Staging-Variablen
`FANMIND_STAGING_STRIPE_PRICE_CAPACITY_99`,
`FANMIND_STAGING_STRIPE_PRICE_CAPACITY_199` und
`FANMIND_STAGING_STRIPE_PRICE_CAPACITY_312` gebunden. Erforderlich sind EUR,
`livemode=false`, ein monatliches Intervall ohne Mengenstaffel/Transformation
und exklusive Steuerbehandlung. Fehlende Mappings brechen ab; es gibt keinen
Fallback auf Live-IDs oder den gleich teuren Legacy-Starter.

Der akzeptierte Neugeschäftsvertrag hat **0 Euro Einrichtungskosten**. Dieser
Kataloglauf prüft die drei Grundpreise; dass ein späterer Checkout tatsächlich
keine Setup-Zeile berechnet, muss die getrennte Checkout-Abnahme beweisen.
Er aktiviert weder Capacity-v2 noch Checkout, Entitlements oder KI-Verbrauch.
Keine bestehenden Workspace-Zeilen, Vertragskennzeichen oder Abonnements werden
umgestellt. Das ist keine Datenbankmigration und kein kommerzieller Launch.

`catalog_contract=legacy_v1` erhält die bisherige Regression für fünf Preise:

- Starter Setup: 990 Euro einmalig;
- Starter: 312 Euro monatlich;
- interner Daily-Test: 1 Euro täglich;
- KI Plus: 100 Euro monatlich;
- KI Ultra: 200 Euro monatlich.

Alle Preise müssen in Euro geführt sein, `livemode=false` melden und exakt den
jeweiligen einmaligen, monatlichen oder täglichen Intervallvertrag erfüllen.

## Ausführung

1. Offline `npm run stripe:staging-catalog:check` ausführen.
2. Den Kontrollcode vollständig prüfen und nach erforderlicher Freigabe regulär
   nach `main` mergen. Ein vorbereiteter PR ist noch keine Staging-Abnahme.
3. Den Workflow auf `main` mit dem exakten geprüften Commit und der
   Bestätigung `verify-staging-stripe-catalog` und `catalog_contract=capacity_v2`
   starten. Die Umgebung darf nur Test-Price-IDs desselben Testkontos enthalten.
   Der Prüfer erstellt keine fehlenden Preise und ändert keine Variablen/Secrets.
4. Nur einen Lauf akzeptieren, der gemeinsam meldet:
   - `STAGING_STRIPE_MODE=test`;
   - `STAGING_STRIPE_WEBHOOK_SECRET=configured`;
   - `STAGING_STRIPE_CATALOG_CONTRACT=capacity_v2`;
   - `STAGING_STRIPE_CATALOG_PRICES=3` (Legacy-Regression separat: 5);
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
Diagnose ausschließlich einen der festen Slots `starter_setup`,
`starter_monthly`, `internal_daily_test`, `ai_plus`, `ai_ultra` oder für den neuen
Vertrag `capacity_99`, `capacity_199`, `capacity_312`. Damit kann
die zugehörige Staging-Variable korrigiert werden, ohne die konkrete Price-ID
in der Diagnose zu wiederholen.

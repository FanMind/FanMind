# Stripe-Testkatalog: read-only Staging-Abnahme

## Zweck und Grenze

Der manuelle Workflow `FanMind Staging Stripe Catalog Readiness` prüft den
vollständigen, vom Production-Katalog getrennten Stripe-Testbestand für das
isolierte FanMind-Staging. Er erstellt und verändert weder Stripe-Ressourcen
noch Zahlungen, Webhooks, Kundendaten oder Datenbankzeilen.

Der Lauf akzeptiert ausschließlich einen Stripe-Testschlüssel und ein
konfiguriertes Staging-Webhook-Secret. Der geschützte Workflow wählt jetzt
mit `catalog_contract=capacity_v2`: drei unterschiedliche aktive
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
   Bestätigung `verify-staging-stripe-catalog` und `catalog_contract=capacity_v2_full`
   starten. Die Umgebung darf nur Test-Price-IDs desselben Testkontos enthalten.
   Der Prüfer erstellt keine fehlenden Preise und ändert keine Variablen/Secrets.
4. Nur einen Lauf akzeptieren, der gemeinsam meldet:
   - `STAGING_STRIPE_MODE=test`;
   - `STAGING_STRIPE_WEBHOOK_SECRET=configured`;
   - `STAGING_STRIPE_CATALOG_CONTRACT=capacity_v2_full` (Standard, 8 Preise)
     oder `capacity_v2` (nur 3 Grundpreise);
   - `STAGING_STRIPE_CATALOG_PRICES=8` (Grundpreise separat: 3; Legacy: 5);
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

## Vollständiger aktueller Sandbox-Katalog — 8. November 2026

Der Workflow verwendet standardmäßig `capacity_v2_full`: drei Grundpreise,
vier einmalige Datenpakete und den ausdrücklich beibehaltenen internen
1-EUR/Tag-Test. `capacity_v2` bleibt als historische Grundpreisprüfung und
`legacy_v1` als historische Regression erhalten; archivierte Legacy-Preise
sollen diese Regression bewusst nicht mehr bestehen. Für die aktuelle Abnahme
`capacity_v2_full` wählen.

Der neue Modus prüft die acht **konfigurierten** aktiven Testpreise inklusive
aktiver Testprodukte. Er zählt nicht sämtliche Produkte des Kontos und beweist
keine Abwesenheit weiterer aktiver Legacy-Produkte. Die Inventarprüfung im
Stripe-Dashboard bleibt ein eigener Nachweis. Jeder Datenpaketpreis muss EUR,
`one_time`, `recurring=null`, `per_unit`, `exclusive` sowie weder Mengen-
transformation noch benutzerdefinierten Betrag verwenden. Produktmetadaten:
`fanmind_billing_contract=capacity_v2`, `fanmind_credit_type=topup`,
`fanmind_provider_value_eur=10|25|50|100`. Preisobjekte tragen zusätzlich
`fanmind_topup_key=fanmind_topup_10|25|50|100`. Die Beträge werden aus der
bestehenden `STRIPE_AI_TOPUP_OPTIONS`-Policy übernommen; keine zweite Preisliste.

| Paket | Staging-Variable im geschützten Environment | Bestehende Sandbox-Preis-ID |
| --- | --- | --- |
| Datenpaket 10 | `FANMIND_STAGING_STRIPE_PRICE_TOPUP_10` | `price_1UZW4qPSYMcFG13m5BwDE32l` |
| Datenpaket 25 | `FANMIND_STAGING_STRIPE_PRICE_TOPUP_25` | `price_1UZW60PSYMcFG13mtXl3oi99` |
| Datenpaket 50 | `FANMIND_STAGING_STRIPE_PRICE_TOPUP_50` | `price_1UZW6rPSYMcFG13mQdqK5V8F` |
| Datenpaket 100 | `FANMIND_STAGING_STRIPE_PRICE_TOPUP_100` | `price_1UZW7dPSYMcFG13mT8WT1b3k` |
| Interner Daily-Test | `FANMIND_STAGING_STRIPE_PRICE_INTERNAL_DAILY_TEST` | `price_1U2cRNPSYMcFG13mEzq2nLip` |

Diese nicht geheimen Objektkennungen gehören ausschließlich zur bestehenden
FanMind-Sandbox `acct_1TnMJbPSYMcFG13m`. Niemals in Production übernehmen.
Die Dokumentation ist keine Bestätigung, dass die Environment-Variablen bereits
gebunden sind. Der Workflow liest sie; er schreibt keine Konfiguration.

### Offene, getrennte technische und steuerliche Abnahme

Steuernummer und UID sind laut Owner noch ausständig. Keine Nummer erfinden,
keine Registrierung bestätigen und `FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED`
nicht deshalb auf `true` setzen. Ein Katalog-PASS bestätigt weder Produkt-
steuercodes noch eine aktive Registrierung oder tatsächliche Steuerberechnung.
Die beim Katalogabgleich fehlenden Produktsteuercodes sind vor Checkout gesondert
zu klären; keine generische Kategorie zur Erzeugung eines Steuerbetrags einsetzen.

Die Quellprüfung auf dem Stand von PR #1442 zeigte folgende Restpunkte: Der aktuelle Top-up-Webhook
liest Session-`topup_key=topup_10`, während Preis-Metadaten
`fanmind_topup_key=fanmind_topup_10` tragen. Der zukünftige serverseitige
Checkout muss diese Kennungen explizit zuordnen; Stripe vererbt Produkt-/Preis-
Metadaten nicht automatisch auf Sessions. Der bestehende Grant vergleicht
`amount_total` mit dem Nettopreis und liegt nur im synchronen Completed-Zweig.
Eine steuerbehaftete oder asynchrone Zahlung benötigt deshalb eine getrennte
Korrektur samt echten Boundary-Tests für Beträge, Workspace-Bindung, PaymentIntent-
Idempotenz und unveränderte Basisabo-/Referral-Zuordnung. Dieser reine Katalog-
PR ändert den Webhook, die Grants und Checkout-Routen nicht und behauptet keinen
abgenommenen Zahlungslifecycle.

Ausgeführt im Owner-Auftrag: vier Datenpakete angelegt; alte Setup-/Pilot-/
Starter-/Plus-/Ultra-Produkte und zugehörige Preise archiviert. Der Daily-Test
wurde auf korrigierte Owner-Anweisung samt bestehendem Preis und Standardpreis
wiederhergestellt. Live wurde nur gelesen und blieb unverändert. Tatsächliche
Checkout-/Webhook-/Guthabenabnahme, Runtime-Konfiguration und die abschließende
Steuerfreigabe sind weiter offen.


Fortsetzung nach #1442: Die technische Sourcekorrektur dieser Checkout-/Grant-
Lücken ist in `STRIPE_TOPUP_LIFECYCLE.md` beschrieben. Sie ersetzt den damaligen
Sourcebefund, nicht die noch fehlende echte Zielabnahme. Der unveränderte
Staging-Capacity-Preflight blockiert die Datenbankinstallation; fehlende
Produktsteuercodes und Host-Runtime-Bindung bleiben gesonderte Voraussetzungen.

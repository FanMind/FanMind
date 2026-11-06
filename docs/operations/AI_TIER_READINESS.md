# KI-Stufen-Readiness

Stand: 2. August 2026

## Ziel

Die Prüfung verbindet die kanonische KI-Stufen-Policy mit den externen
Freigabevoraussetzungen, ohne Stripe-IDs, Modelle, Limits, Kundendaten oder
Secrets auszugeben.

```bash
npm run ai:tiers:readiness
```

Im aktuellen Produktstand muss die Ausgabe fachlich so enden:

```text
AI_TIER_STANDARD=READY blockers=none
AI_TIER_PLUS=BLOCKED blockers=...
AI_TIER_ULTRA=BLOCKED blockers=...
AI_TIER_READINESS=PASS
```

`PASS` bedeutet, dass sichtbarer Produktstatus und technische Readiness
übereinstimmen. Es aktiviert kein Add-on, verändert keinen Workspace und
führt keinen Stripe-Aufruf aus.

Die noch offenen fachlichen Beschlüsse sind ohne Aktivierungswirkung in
`docs/operations/AI_TIER_DECISION_PROPOSAL.md` gebündelt. Solange dort
`UNENTSCHIEDEN`-Werte stehen, bleiben Plus und Ultra blockiert.

## Standard

KI Standard ist als enthaltene Leistung bereit, wenn:

- der Preisaufschlag null bleibt;
- der öffentliche Status `Aktiv` ist;
- Billing `included` meldet;
- keine automatische Buchung erforderlich ist;
- automatische Sendung und Referral-Rabatt für das Add-on ausgeschlossen
  bleiben.

Die operativen Aufruf-, Kontext- und Ausgabegrenzen bleiben Kosten- und
Missbrauchsschutz. Sie sind keine vertraglichen Monatskontingente.

## Plus und Ultra

Ein kostenpflichtiges Add-on ist nur bereit, wenn gleichzeitig:

- öffentlicher Status `Aktiv` ist;
- Billing-Status `enabled` ist;
- automatische Buchung in der zentralen Policy ausdrücklich freigegeben ist;
- Modellklasse, Monatsanfragen, Monatstokens und Kontextgrenze positive,
  festgelegte Werte besitzen;
- eine dedizierte serverseitige Provider-Modellzuordnung und ein davon
  unterschiedliches Fallback-Modell bestätigt sind;
- der zugehörige serverseitige Stripe-Price konfiguriert ist;
- der Workspace-Contract nach der positiven und negativen Abnahme aus
  `WORKSPACE_SERVER_OWNED_FIELDS.md` bestätigt wurde;
- die monatliche Anfrage-/Token-Durchsetzung in allen produktiven KI-Pfaden
  fail-closed integriert und abgenommen ist;
- der Stripe-Subscription-Item-Lifecycle einschließlich Fehler-, Wechsel- und
  Kündigungsfällen im getrennten Staging bestätigt ist;
- Qualitäts-Eval, Kosten-/Margenrechnung, Staging-Akzeptanz sowie Rechts- und
  Steuerfreigabe je Stufe bestätigt sind;
- Entitlement, Modellwahl, Kontextgrenze und Kontingentprüfung tatsächlich in
  den produktiven KI-Pfaden integriert und negativ getestet sind;
- die jeweilige Stufe ausdrücklich für Production freigegeben wurde;
- automatische Sendung und Referral-Rabatt deaktiviert bleiben.

Verwendete serverseitige Laufzeitwerte:

- `STRIPE_PRICE_AI_PLUS`
- `STRIPE_PRICE_AI_ULTRA`
- `FANMIND_AI_TIER_WORKSPACE_CONTRACT_CONFIRMED=true`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_MODEL`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_FALLBACK_MODEL`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_USAGE_ENFORCEMENT_CONFIRMED=true`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_STRIPE_LIFECYCLE_CONFIRMED=true`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_QUALITY_COST_EVALUATION_CONFIRMED=true`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_STAGING_ACCEPTANCE_CONFIRMED=true`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_LEGAL_TAX_APPROVAL_CONFIRMED=true`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_RUNTIME_INTEGRATION_CONFIRMED=true`
- `FANMIND_AI_TIER_{PLUS|ULTRA}_PRODUCTION_ACTIVATION_CONFIRMED=true`

Die Contract-Bestätigung darf erst nach dem dokumentierten Production-
Preflight, beiden kontrollierten Datenbankschritten und den positiven sowie
negativen Berechtigungstests gesetzt werden. Eine gesetzte Variable allein
aktiviert weder Entitlements noch Checkout.

Alle zusätzlichen Bestätigungen sind stufenspezifisch. Sie dürfen erst nach
dem zugehörigen datierten Nachweis gesetzt werden; ein Plus-Nachweis gilt nie
automatisch für Ultra. Die Readiness gibt nur boolesche Ergebnisse und feste
Blocker-Codes aus, niemals Modellnamen, Stripe-IDs, externe Beleg-IDs oder
Secrets. Auch vollständig gesetzte Runtime-Werte aktivieren nichts, solange
die zentrale Policy die Stufe weiterhin als `Coming Soon`, nicht konfiguriert
oder nicht automatisch buchbar führt.

## Blocker-Codes

Die Prüfung gibt ausschließlich feste Codes aus:

`context_message_limit` bleibt als generischer Fail-closed-Code erhalten. Die
aktuelle zentrale Policy erfüllt diesen Punkt bereits mit 50/100/150; daraus
folgt allein keine Plus-/Ultra-Aktivierung.

- `public_status`
- `billing_status`
- `booking_flag`
- `model_class`
- `monthly_request_limit`
- `monthly_token_limit`
- `context_message_limit`
- `stripe_price`
- `workspace_contract`
- `provider_model`
- `fallback_model`
- `provider_fallback_distinct`
- `usage_enforcement`
- `stripe_lifecycle`
- `quality_cost_evaluation`
- `staging_acceptance`
- `legal_tax_approval`
- `runtime_integration`
- `production_activation`
- `automatic_sending`
- `referral_discount`
- `base_price`

Konkrete Konfigurationswerte werden nie ausgegeben.

## Workspace-Entitlement

`resolveWorkspaceAiTierEntitlement(...)` in `src/config/aiTiers.mjs` ist der
gemeinsame fail-closed Vertrag für die später serverseitig geladenen
Workspace-Entitlements.

Ohne gespeicherten Zustand bleibt KI Standard enthalten und wirksam. Ein
kostenpflichtiges Plus-/Ultra-Entitlement wird nur wirksam, wenn alle
folgenden Nachweise gleichzeitig vorliegen:

- die Entitlement-Daten stammen aus einem serververwalteten Speicher;
- Lifecycle-Status ist `active`;
- Quelle ist Stripe;
- das Stripe-Subscription-Item wurde serverseitig verknüpft;
- `effectiveAt` ist gültig und nicht in der Zukunft;
- ein optionales `expiresAt` ist gültig und noch nicht erreicht;
- die vollständige zentrale Tier-Readiness ist positiv.

Fehlt ein Nachweis, ist die wirksame Stufe Standard. Die Funktion gibt nur
feste Rückfallcodes zurück:

- `unknown_tier`
- `server_owned`
- `lifecycle_status`
- `source`
- `stripe_item`
- `effective_at`
- `not_started`
- `expires_at`
- `expired`
- `tier_readiness`

Konkrete Stripe-IDs werden dem Resolver nur als bereits serverseitig
bestätigtes Ja/Nein übergeben und weder zurückgegeben noch geloggt.

Der persistente server-only Speicher, die additive Migration und der
redigierende Loader sind auf dem getrennten Supabase-Staging angewendet und
nachgeprüft; auf Production sind sie nicht angewendet. Der echte
Stripe-Webhook enthält eine standardmäßig inaktive Persistenzbrücke. Sie wird
nur bei eigenem Persistence-Gate, bestätigtem Workspace-Vertrag und zwei
vollständigen unterschiedlichen KI-Price-IDs aufgerufen. Produktive KI-Pfade
verwenden den Speicher weiterhin nicht. Die fehlende Event-Ledger-
Transaktion, die Stripe-Testmode-Abnahme und alle weiteren Readiness-Gates
halten Plus und Ultra gesperrt. Die verbindliche Rollout-Reihenfolge und
negative Berechtigungsabnahme stehen in
`docs/operations/AI_TIER_ENTITLEMENT_STORAGE.md`.

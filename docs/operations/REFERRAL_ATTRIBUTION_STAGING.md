# Referral-Attribution – kontrollierter Staging-Pfad

## Zweck und Grenze

Dieser Pfad rollt ausschließlich die Integritätsregeln aus
`supabase/migrations/20260814230000_referral_attribution_integrity.sql` in das
isolierte FanMind-Staging aus. Er aktiviert weder Referral-Billing noch
Stripe-Aufrufe und verändert keine Production-Datenbank.

Die Migration ist transaktional und durch den Runner
`scripts/operations/referral-attribution-migration-runner.mjs` mit SHA-256
`fac209e11cec77c386b4747c0b78d8d8c20efe477b78672f2b4de1dce9e7719e`
festgeschrieben. Ein normaler Web-Deploy wendet sie nicht an. Für diesen
Abnahmeschritt ist ausschließlich der dokumentierte manuelle Runner zulässig;
ein generisches `supabase db push` ist kein Ersatz.

## Geprüfter Vertrag

Der Offline-Check und der read-only Postflight verlangen gemeinsam:

- einen regulären, nicht partiellen Unique-Index auf
  `referrals.referred_workspace_id`;
- den validierten User-Self-Referral-Check;
- die Triggerfunktion `protect_referral_attribution()` mit festem
  `search_path=pg_catalog, pg_temp`;
- keinen Funktionsaufruf durch `PUBLIC`, `anon` oder `authenticated`;
- den aktiven `BEFORE UPDATE`-Trigger für alle Attributionsidentitäten;
- keine Provider- oder Billing-Schreibfreigabe.

Der Apply stoppt vor jeder Änderung, wenn doppelte bestehende
`referred_workspace_id`-Attributionen manuell geprüft werden müssen. SQL und
Postflight geben nur feste Fehlercodes aus; Datenbankdetails und Secrets
bleiben unterdrückt.

## Verbindliche Reihenfolge

1. PR prüfen und mergen; den exakten neuen `main`-Commit festhalten.
2. Optional den Workflow `FanMind Referral Attribution Staging Verify` mit
   `verify-referral-attribution-integrity` starten. Vor dem ersten Apply darf
   er mit einem festen Missing-/Invalid-Code rot enden.
3. Den Workflow `FanMind Referral Attribution Staging Apply` mit demselben
   exakten Commit und `apply-referral-attribution-integrity` starten.
4. Nur diese Abschlussmarker akzeptieren:
   `REFERRAL_ATTRIBUTION_APPLY=completed`,
   `REFERRAL_ATTRIBUTION_POSTFLIGHT=PASS`,
   `REFERRAL_ATTRIBUTION_POSTFLIGHT_TRANSACTION=ROLLED_BACK` und
   `SECRETS_WURDEN_NICHT_AUSGEGEBEN=true`.
5. Den read-only Verify erneut starten.
6. Erst danach `FanMind Referral Lifecycle Staging Acceptance` mit
   `run-referral-lifecycle-staging-acceptance` ausführen. Dieser Workflow
   verlangt den Referral-Postflight nun selbst, bevor die vollständig
   zurückgerollten synthetischen Lifecycle-Fälle beginnen.

Alle Workflows sind an `main`, den exakten geprüften Commit, das geschützte
`staging`-Environment, den projektqualifizierten Staging-Datenbankbenutzer,
TLS `verify-full` und eine private `PGPASSFILE` gebunden. Staging- und
Production-Projektreferenz werden getrennt geprüft. Referral-Billing bleibt
mit `FANMIND_ENABLE_REFERRAL_BILLING=false` ausgeschaltet.

## Sicherer Abbruch

Bei `referral_attribution_duplicates_require_manual_review`, einem partiellen
Postflight oder einem Ziel-/TLS-Fehler keinen erneuten Apply und keinen
generischen Push starten. Die Abweichung separat und read-only untersuchen.
Keine Referral-Zeilen, Constraints oder Indizes manuell löschen. Ein
Production-Apply benötigt einen eigenen, erneut geprüften und ausdrücklich
freigegebenen Kontrollpfad und ist nicht Teil dieses Staging-Schritts.

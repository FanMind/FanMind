# Stripe Billing write freeze — Staging cutover

Stand: 5. September 2026

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

Die Signaturprüfung des Webhooks bleibt unverändert vorgelagert. Ungültige Signaturen werden weiterhin normal abgelehnt.

Bereits bei Stripe angelegte Sessions werden durch diesen Schalter nicht beendet. Der Sperrnachweis gilt für neue Session-Erzeugung in der neu geladenen Runtime und die lokale Legacy-Projektion; der bestehende Ledger-/Cutover-Abgleich bleibt für bereits laufende Zahlungsereignisse erforderlich.

## Verbindliche Staging-Sequenz

1. Exakten geprüften `main`-Commit auf Staging deployen.
2. `FANMIND_STRIPE_BILLING_WRITE_FREEZE=true` ausschließlich in Staging setzen und Runtime neu laden.
3. Negativnachweis: neuer Checkout muss mit dem festen `503`-Code scheitern; ein kontrollierter signierter Staging-Webhook darf während der Sperre keine legacy Workspace-Projektion bestätigen.
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

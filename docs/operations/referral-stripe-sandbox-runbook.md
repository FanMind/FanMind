# Referral-Automation – Stripe-Sandbox-Abnahme

Stand: 15. Juli 2026

## Ziel

Dieses Runbook prüft die Referral-Automation vollständig im Stripe-Testmodus, ohne Production-Abonnements, Live-Schlüssel oder echte Kundendaten zu verändern.

Abzunehmen sind:

- eindeutige Attribution ohne Self-Referral;
- Aktivierung nach bestätigter Zahlung;
- 5 Prozent Rabatt pro aktivem Referral, maximal 20 beziehungsweise 100 Prozent;
- keine Rabattierung der Setup-Gebühr;
- idempotente Verarbeitung desselben Stripe-Events;
- Deaktivierung bei Zahlungsausfall, Kündigung, Refund oder Chargeback;
- Reaktivierung nach erneut aktivem Zahlungsstatus;
- unveränderliche Rabatt-Snapshots vor der Stripe-Synchronisierung;
- automatisches Schließen des Growth Windows am konfigurierten Cap.

## Harte Sicherheitsgrenzen

1. **Nie einen `sk_live_`- oder `rk_live_`-Schlüssel verwenden.**
2. **Nie gegen `https://fanmind.ch` schreibend testen.**
3. Production behält:

   ```env
   FANMIND_ENABLE_REFERRAL_BILLING=false
   ```

4. Schreibende Tests laufen ausschließlich gegen einen separaten Staging-/Sandbox-Workspace und eine getrennte Supabase-Sandbox.
5. Schlüssel, Webhook-Secrets, Service-Role-Keys und vollständige Stripe-Objekte niemals in Tickets, Chat oder Screenshots kopieren.
6. Testdaten klar mit `SANDBOX-REFERRAL-` kennzeichnen.

## 1. Technische Voraussetzungen

Erforderlich sind:

- Stripe CLI im Sandbox-Modus;
- bevorzugt `STRIPE_SECRET_KEY=rk_test_...` mit minimalen Rechten; ein
  `sk_test_...`-Schlüssel ist nur als kompatibler Übergang erlaubt;
- ein Stripe-Webhook-Secret `whsec_...` aus dem lokalen Listener;
- separate Supabase-Sandbox mit angewendeten Referral-Migrationen;
- nicht-produktive App-URL, zum Beispiel `http://localhost:3000` oder eine Staging-Domain;
- `SUPABASE_SERVICE_ROLE_KEY` der Sandbox;
- mindestens 32 Zeichen langes `FANMIND_REFERRAL_RECONCILE_SECRET`;
- Testpreise für Setup und Starter-Monatsgebühr.

Die Produktionsdatenbank darf nicht als Sandbox verwendet werden.

## 2. Secret-sicherer Preflight

### Read-only-Prüfung

```bash
npm run referral:sandbox:preflight
```

Der Preflight zeigt ausschließlich Zustände wie `gesetzt`, `nicht gesetzt`, `test`, `aktiv` oder `deaktiviert`. Er gibt keine Secret-Werte aus.

### Schreibenden Sandbox-Test ausdrücklich freigeben

Nur in einer vollständig getrennten Staging-/Testumgebung. Ziel- und Production-Projektreferenz durch die tatsächlichen Supabase-Projektreferenzen ersetzen, aber nicht in Tickets oder Chat kopieren:

```bash
export FANMIND_RUNTIME_ENVIRONMENT=staging
export FANMIND_ENABLE_NON_PRODUCTION_WRITES=true
export FANMIND_NON_PRODUCTION_WRITE_ACK=I_UNDERSTAND_NON_PRODUCTION_ONLY
export FANMIND_TARGET_SUPABASE_PROJECT_REF=<STAGING_PROJECT_REF>
export FANMIND_PRODUCTION_SUPABASE_PROJECT_REF=<PRODUCTION_PROJECT_REF>

npm run environment:preflight:write

export FANMIND_ENABLE_REFERRAL_BILLING=true
export FANMIND_REFERRAL_SANDBOX_ACK=I_UNDERSTAND_TEST_MODE_ONLY
npm run referral:sandbox:preflight -- --allow-write
```

Erwartet:

```text
MODE=sandbox-write
STRIPE_KEY_MODE=test
REFERRAL_BILLING=aktiv
TARGET=non-production
ENVIRONMENT_BOUNDARY=ok
SECRETS_WURDEN_NICHT_AUSGEGEBEN=true
PREFLIGHT=OK
```

Der Preflight bricht ab bei:

- Live-Schlüssel;
- Production-Ziel `fanmind.ch`;
- Production-Supabase-Projekt oder nicht eindeutig identifizierbarem Zielprojekt;
- fehlender allgemeiner Staging-/Test-Schreibfreigabe;
- fehlendem Webhook-, Service-Role- oder Reconcile-Secret;
- fehlender ausdrücklicher Schreibfreigabe;
- aktivem Billing im Read-only-Modus.

## 3. Webhook lokal empfangen

Die Anwendung lokal oder in Staging starten. Danach mit Stripe CLI nur die relevanten Snapshot-Events weiterleiten:

```bash
stripe listen \
  --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,payment_intent.processing,payment_intent.succeeded,payment_intent.payment_failed,invoice.paid,invoice.updated,invoice.payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.resumed,customer.subscription.paused,customer.subscription.deleted,charge.refunded,refund.created,refund.updated,refund.failed,charge.dispute.created,customer.tax_id.created,customer.tax_id.updated,customer.tax_id.deleted \
  --forward-to http://localhost:3000/api/stripe/webhook
```

Das von `stripe listen` ausgegebene `whsec_...` ausschließlich in der lokalen beziehungsweise Staging-ENV als `STRIPE_WEBHOOK_SECRET` setzen.

Ein einfacher Handler-Smoke-Test ist beispielsweise:

```bash
stripe trigger payment_intent.succeeded
```

Für die eigentliche Referral-Abnahme müssen die Events jedoch zu den realen **Sandbox-Workspaces und Test-Subscriptions** gehören. Generische CLI-Fixtures ohne passende `workspace_id`-Metadaten belegen nur, dass der Webhook erreichbar ist.

## 4. Testdaten vorbereiten

Über den normalen Staging-Onboarding- und Checkout-Flow anlegen:

1. Referrer-Workspace `SANDBOX-REFERRAL-REFERRER`;
2. referred Workspace `SANDBOX-REFERRAL-REFERRED-01`;
3. optional weitere referred Workspaces bis `SANDBOX-REFERRAL-REFERRED-20`;
4. Referral-Code des Referrers verwenden;
5. für den Referrer eine Test-Subscription mit Starter-Monatsgebühr hinterlegen;
6. Setup-Gebühr als getrennte einmalige Testzahlung behandeln.

Vor dem Zahlungstest prüfen:

```sql
select
  id,
  workspace_id,
  referral_code,
  eligible,
  status
from public.referral_program_members
where workspace_id = '<REFERRER_WORKSPACE_ID>'::uuid;

select
  id,
  referrer_workspace_id,
  referred_workspace_id,
  referral_code,
  status,
  billing_status_snapshot,
  admin_override
from public.referrals
where referred_workspace_id = '<REFERRED_WORKSPACE_ID>'::uuid;
```

Erwartung:

- Referrer-Member ist `eligible=true` und `status` ist `qualified` oder `active`;
- `referrer_workspace_id` und `referred_workspace_id` unterscheiden sich;
- genau eine Attribution existiert;
- das referred Workspace ist vor Zahlung noch nicht `active`.

## 5. Lifecycle-Matrix

### Fall A – erfolgreiche Zahlung aktiviert Referral

1. Checkout im Stripe-Testmodus erfolgreich abschließen.
2. `checkout.session.completed`, `invoice.paid` oder das passende asynchrone Erfolgsereignis abwarten.
3. Prüfen:

```sql
select
  status,
  billing_status_snapshot,
  qualified_at,
  activated_at,
  deactivated_at,
  deactivation_reason
from public.referrals
where referred_workspace_id = '<REFERRED_WORKSPACE_ID>'::uuid;
```

Erwartung:

- `status='active'`;
- `billing_status_snapshot='active'`;
- `activated_at` ist gesetzt;
- `deactivated_at` und `deactivation_reason` sind leer.

### Fall B – Snapshot und 5-Prozent-Schritt

```sql
select
  active_referral_count,
  discount_percent,
  monthly_fee_cents_before_discount,
  monthly_discount_cents,
  monthly_fee_cents_after_discount,
  source_event_id,
  source_event_type,
  stripe_subscription_id,
  stripe_coupon_id,
  stripe_sync_status,
  stripe_sync_error,
  calculated_at
from public.referral_discount_snapshots
where workspace_id = '<REFERRER_WORKSPACE_ID>'::uuid
order by calculated_at desc
limit 5;
```

Für ein aktives Referral bei 312 Euro Monatsgebühr erwartet:

```text
active_referral_count=1
discount_percent=5
monthly_fee_cents_before_discount=31200
monthly_discount_cents=1560
monthly_fee_cents_after_discount=29640
stripe_sync_status=applied oder unchanged
```

Mit 20 oder mehr aktiven Referrals bleibt der wirksame Rabatt bei 100 Prozent und der Monatsbetrag niemals unter null.

### Fall C – Setup-Gebühr bleibt unberührt

Im Stripe-Test-Dashboard beziehungsweise in der Testrechnung prüfen:

- Referral-Coupon liegt nur auf der wiederkehrenden Subscription;
- die einmalige Setup-Zahlung bleibt 990 Euro beziehungsweise der dafür konfigurierte Testpreis;
- im Snapshot wird ausschließlich `monthly_fee_cents_before_discount` verwendet;
- es gibt keine rabattierte Setup-Zeile.

### Fall D – doppeltes Event ist idempotent

Dasselbe Stripe-Testevent erneut zustellen. Anschließend:

```sql
select source_event_id, workspace_id, count(*)
from public.referral_discount_snapshots
where source_event_id = '<STRIPE_EVENT_ID>'
group by source_event_id, workspace_id;
```

Erwartung: `count=1` je Event und Workspace. Die Automation meldet intern den Stripe-Status `duplicate` und wendet den Rabatt nicht ein zweites Mal an.

### Fall E – Zahlungsausfall deaktiviert

Einen tatsächlichen Sandbox-Zahlungsausfall für die Test-Subscription erzeugen. Erwartete Stufen:

| Ereignis/Zustand | Referral-Billing-Status | Referral-Status |
|---|---|---|
| erster `invoice.payment_failed` | `past_due` | aktiv bleibt nur gemäß bestehender Kulanzregel |
| zweiter Versuch fehlgeschlagen | `payment_failed` | `inactive` |
| dritter Versuch oder Kulanz abgelaufen | `suspended` | `inactive` |

Prüfen:

```sql
select status, billing_status_snapshot, deactivated_at, deactivation_reason
from public.referrals
where referred_workspace_id = '<REFERRED_WORKSPACE_ID>'::uuid;
```

### Fall F – Kündigung

Test-Subscription beenden und `customer.subscription.deleted` zustellen lassen.

Erwartung:

```text
billing_status_snapshot=cancelled
status=inactive
```

### Fall G – Refund oder Chargeback

Im Stripe-Testmodus eine Rückerstattung beziehungsweise Test-Dispute auslösen.

Verarbeitete Ereignisse:

- `charge.refunded`;
- `refund.created`;
- `charge.dispute.created`.

Erwartung:

```text
billing_status_snapshot=refunded
status=inactive
```

### Fall H – Reaktivierung

Subscription im Testmodus wieder aktivieren beziehungsweise eine neue gültige Zahlung bestätigen.

Erwartung nach `customer.subscription.resumed`, `customer.subscription.updated` mit `status=active` oder `invoice.paid`:

```text
billing_status_snapshot=active
status=active
deactivated_at=null
deactivation_reason=null
```

Danach wird ein neuer Snapshot erzeugt und der aktuelle Rabatt erneut auf die Referrer-Subscription synchronisiert.

## 6. Growth-Window-Cap transaktional testen

Nicht 2.000 echte Datensätze erzeugen. In der **isolierten Sandbox** das Cap innerhalb einer Transaktion vorübergehend verkleinern:

```sql
begin;

update public.referral_program_state
set active_paid_workspace_cap = 1,
    status = 'open',
    closed_at = null,
    updated_at = now();

select *
from public.refresh_referral_program_state('sandbox_cap_test');

select
  status,
  active_paid_workspace_cap,
  active_paid_workspace_count,
  closed_at,
  admin_note
from public.referral_program_state;

rollback;
```

Erwartung, sofern mindestens ein aktiver zahlender Sandbox-Workspace existiert:

- `status='closed'`;
- `closed_at` ist gesetzt;
- der Admin-Hinweis nennt die automatische Schließung;
- nach `rollback` ist das ursprüngliche Cap wiederhergestellt.

Diesen Test niemals in Production ausführen.

## 7. Abschlusskontrolle

```sql
select
  r.id,
  r.status,
  r.billing_status_snapshot,
  r.activated_at,
  r.deactivated_at,
  r.deactivation_reason,
  r.updated_at
from public.referrals r
where r.referrer_workspace_id = '<REFERRER_WORKSPACE_ID>'::uuid
order by r.updated_at desc;

select
  s.discount_percent,
  s.monthly_fee_cents_before_discount,
  s.monthly_discount_cents,
  s.monthly_fee_cents_after_discount,
  s.source_event_id,
  s.source_event_type,
  s.stripe_sync_status,
  s.stripe_sync_error,
  s.calculated_at
from public.referral_discount_snapshots s
where s.workspace_id = '<REFERRER_WORKSPACE_ID>'::uuid
order by s.calculated_at desc;
```

Abgenommen ist der Sandbox-Lifecycle erst, wenn für jeden Fall ein Stripe-Testevent, die zugehörigen Datenbankwerte und die erwartete Subscription-/Invoice-Wirkung dokumentiert wurden.

## 8. Sicherer Abschluss

Nach jedem Testlauf:

```env
FANMIND_ENABLE_REFERRAL_BILLING=false
FANMIND_REFERRAL_SANDBOX_ACK=
```

Danach:

- Test-Listener stoppen;
- Staging-Prozess mit deaktiviertem Flag neu starten;
- Test-Subscriptions und Test-Coupons bei Bedarf archivieren;
- synthetische Workspaces entfernen;
- Secrets rotieren, falls sie versehentlich sichtbar wurden;
- Production nicht verändern.

## Rollback-only Staging-Vorabnahme

Vor echten Stripe-Testevents zuerst den bestehenden manuellen Workflow
`FanMind Referral Lifecycle Staging Acceptance` ausführen. Er verwendet
ausschließlich die beiden geschützten synthetischen Staging-Workspaces,
ruft Stripe nicht auf und setzt `FANMIND_ENABLE_REFERRAL_BILLING=false`.

Eingaben:

- `reviewed_commit`: vollständiger, zuvor geprüfter SHA von `main`;
- `confirmation`: `run-referral-lifecycle-staging-acceptance`.

Der Workflow bricht ab, wenn Ziel, Supabase-Projekt, Datenbank, TLS,
synthetische IDs oder Commit-Bindung nicht exakt dem Staging-Vertrag
entsprechen. Innerhalb einer einzigen Datenbanktransaktion werden Attribution,
Self-Referral-Sperre, First-valid-click, Unveränderlichkeit, Aktivierung,
Zahlungsausfall, Kündigung, Refund, Reaktivierung, Event-Idempotenz,
5-Prozent-Schritte, 100-Prozent-Obergrenze und das Growth Window geprüft.
Anschließend erfolgt immer `rollback` und ein Digest-Vergleich mit dem
Ausgangszustand.

Diese Vorabnahme ersetzt **nicht** die folgenden Stripe-Testevents und schließt
die vollständige Lifecycle-Abnahme daher nicht allein ab.

## Definition of Done

- [ ] Testmodus und nicht-produktives Ziel durch Preflight bestätigt
- [ ] Attribution eindeutig und Self-Referral blockiert
- [ ] erfolgreiche Zahlung aktiviert genau ein Referral
- [ ] 5-Prozent-Schritte bis maximal 100 Prozent bestätigt
- [ ] Setup-Gebühr unverändert
- [ ] doppeltes Event idempotent
- [ ] Zahlungsausfall deaktiviert nach definierter Stufe
- [ ] Kündigung deaktiviert
- [ ] Refund/Chargeback deaktiviert
- [ ] Reaktivierung aktiviert erneut
- [ ] Snapshot und Stripe-Synchronisierung stimmen überein
- [ ] Cap schließt transaktional
- [ ] Flag nach Test wieder deaktiviert
- [ ] Belege ohne Secrets gespeichert

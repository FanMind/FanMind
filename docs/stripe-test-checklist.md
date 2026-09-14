# Stripe-Test-Checkliste für internationale wiederkehrende Zahlungen

## Benötigte Stripe Webhook Events

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `payment_intent.processing`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.paid`
- `invoice.updated`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`
- `refund.created`
- `refund.updated`
- `charge.dispute.created`
- `customer.tax_id.created`
- `customer.tax_id.updated`
- `customer.tax_id.deleted`

## Benötigte Sandbox-ENV

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_SETUP`
- `STRIPE_PRICE_STARTER_MONTHLY`
- `STRIPE_PRICE_INTERNAL_DAILY_TEST`
- `STRIPE_PRICE_AI_PLUS`
- `STRIPE_PRICE_AI_ULTRA`
- `NEXT_PUBLIC_APP_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FANMIND_TAX_MODE=stripe_tax`
- `FANMIND_STRIPE_TAX_REGISTRATION_CONFIRMED=true`

## Erwarteter Testablauf

- Starter Flex verwendet 990 Euro einmaliges Setup plus 312 Euro monatlich.
- Starter 12 Monate verwendet 0 Euro Setup plus 312 Euro monatlich und eine
  Mindestlaufzeit von 12 Monaten; die Vertragslogik wird nicht aus einem
  veralteten Pilot-Produkt abgeleitet.
- KI Plus und KI Ultra verwenden getrennte monatliche Testpreise von 100 Euro
  beziehungsweise 200 Euro und bleiben außerhalb der Referral-Rabattbasis.
- Die öffentliche Daily-Admission bleibt vor Supabase Sign-up geschlossen,
  solange Daily-Preis, Stripe-Secret, App-URL oder Webhook-Secret fehlen; auch
  ein Daily-Checkout darf ohne vollständige Webhook-Konfiguration nicht starten.
- Checkout-Sessions tragen die Workspace-ID in `client_reference_id` und Metadata.
- Einmalige Starter-Setup-Zahlungen tragen dieselbe Metadata zusätzlich am
  Payment Intent.
- Starter-Subscriptions tragen dieselbe Metadata an der Subscription.
- `payment_intent.processing` markiert einen Workspace nur als `pending_sepa_mandate`.
- `payment_intent.succeeded`, `checkout.session.async_payment_succeeded` und `invoice.paid` dürfen auf `active` setzen, aber keine `manual_suspended`-Sperre überschreiben.
- Fehlgeschlagene asynchrone SEPA-Zahlungen setzen `payment_failed` und dokumentieren Retry-/Grace-Signale.
- FanMind speichert keine IBANs oder Bankdaten; diese bleiben ausschließlich bei Stripe.
- Kein Checkout, einschließlich des internen 1-Euro-Daily-Testabos, übergibt
  eine feste Zahlungsmethodenliste. Stripe zeigt nur die im Dashboard
  aktivierten und für Land, Gerät, Währung sowie Abo kompatiblen Methoden
  (Karten, Wallets und geeignete Bankzahlarten).
- Der gespeicherte Workspace-Wert `payment_collection_method=card` ist für
  Starter und Daily-Test nur der bestehende Schema-Kompatibilitätswert für
  Stripe-gehostete Auswahl. Er begrenzt das Checkout nicht auf Karten und ist
  kein Nachweis der tatsächlich gewählten Zahlungsmethode.
- Der bevorzugte Testschlüssel beginnt mit `rk_test_` und besitzt nur Checkout-Sessions/Subscriptions/Coupons Schreiben sowie Prices/Invoices Lesen. `sk_test_` bleibt nur als kompatibler Übergang erlaubt; `sk_live_` und `rk_live_` sind in Staging gesperrt.
- Alle Preise sind in Stripe exklusive Steuer. Automatic Tax und UID-Erfassung sind aktiv; ohne bestätigte Testregistrierung startet kein Checkout.
- Eine ausstehende Rückerstattung deaktiviert Referral nicht. Erst `succeeded`, `charge.refunded` oder ein Dispute gilt als endgültige Deaktivierung.
- Automatisch erzeugte Referral-Coupons müssen über `applies_to.products` ausschließlich auf das Produkt des 312-Euro-Starter-Core-Preises begrenzt sein. Setup, KI Plus, KI Ultra und spätere Add-ons bleiben ungekürzt.

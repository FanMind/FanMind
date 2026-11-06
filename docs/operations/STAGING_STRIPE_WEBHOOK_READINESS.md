# Stripe-Testwebhook: read-only Staging-Abnahme

## Zweck und Grenze

Der manuelle Workflow `FanMind Staging Stripe Webhook Readiness` prüft
read-only, ob der Stripe-Testbestand genau einen aktiven Endpoint für
`https://staging.fanmind.ch/api/stripe/webhook` enthält. Er erstellt, ändert
oder löscht weder Stripe-Ressourcen noch Zahlungen, Kunden, Subscriptions,
Webhooks oder Datenbankzeilen.

Der Endpoint muss:

- `livemode=false` melden;
- aktiviert sein;
- explizit die Stripe-API-Version `2026-06-24.dahlia` verwenden;
- exakt die 22 Ereignistypen abonnieren, die der FanMind-Handler verarbeitet;
- mit einem getrennten Staging-Signing-Secret in der Runtime gebunden sein.

Die exakte Eventmenge verhindert, dass unnötige Stripe-Ereignisse an FanMind
gesendet werden. Ein `*`-Abonnement oder zusätzliche Ereignisse bestehen die
Abnahme deshalb nicht.

Der FanMind-Handler verifiziert die Signatur gegen den unveränderten Request-
Body, akzeptiert bei einer kontrollierten Secret-Rotation jede passende
`v1`-Signatur und verlangt ein höchstens fünf Minuten altes Stripe-Timestamp.
Alte, zukünftige, falsch lange oder anderweitig ungültige Signaturen werden
ohne Ausnahme oder technische Detailausgabe mit HTTP 400 abgelehnt.

Die 22 erforderlichen Ereignistypen sind:

- `checkout.session.completed`;
- `checkout.session.async_payment_succeeded`;
- `checkout.session.async_payment_failed`;
- `payment_intent.processing`;
- `payment_intent.succeeded`;
- `payment_intent.payment_failed`;
- `invoice.paid`;
- `invoice.updated`;
- `invoice.payment_failed`;
- `customer.subscription.created`;
- `customer.subscription.updated`;
- `customer.subscription.resumed`;
- `customer.subscription.paused`;
- `customer.subscription.deleted`;
- `charge.refunded`;
- `refund.created`;
- `refund.updated`;
- `refund.failed`;
- `charge.dispute.created`;
- `customer.tax_id.created`;
- `customer.tax_id.updated`;
- `customer.tax_id.deleted`.

Die Einrichtung erfolgt im Stripe-Testmodus nach der offiziellen
[Stripe-Webhooks-Anleitung](https://docs.stripe.com/webhooks). Der Endpoint
abonniert ausschließlich Ereignisse des eigenen Stripe-Kontos, nicht von
verbundenen Connect-Konten.

## Ausführung

1. Offline `npm run stripe:staging-webhook:check` ausführen.
2. Den Kontrollcode vollständig prüfen und nach `main` mergen.
3. Im Stripe-Testmodus beziehungsweise in der Stripe-Sandbox genau einen
   Webhook-Endpoint mit der oben genannten URL, API-Version und Eventmenge
   konfigurieren. Das dabei erzeugte Signing-Secret ausschließlich als
   `FANMIND_STAGING_STRIPE_WEBHOOK_SECRET` im geschützten GitHub-Environment
   `staging` und in der privaten Staging-Runtime hinterlegen.
4. Einen bevorzugt eingeschränkten `rk_test_...`-Schlüssel mit Leserecht für
   Webhook-Endpoints als `FANMIND_STAGING_STRIPE_SECRET_KEY` verwenden.
5. Den Workflow auf `main` mit dem exakten geprüften Commit und der Bestätigung
   `verify-staging-stripe-webhook` starten.
6. Nur einen Lauf akzeptieren, der gemeinsam meldet:
   - `STAGING_STRIPE_WEBHOOK_MODE=test`;
   - `STAGING_STRIPE_WEBHOOK_URL=verified`;
   - `STAGING_STRIPE_WEBHOOK_API_VERSION=2026-06-24.dahlia`;
   - `STAGING_STRIPE_WEBHOOK_EVENTS=22`;
   - `STAGING_STRIPE_WEBHOOK_SECRET=configured`;
   - `STAGING_STRIPE_WEBHOOK_ENDPOINT=PASS`;
   - `SECRETS_WURDEN_NICHT_AUSGEGEBEN=true`.

Der Workflow verwendet ausschließlich `GET /v1/webhook_endpoints`, folgt der
Pagination und gibt weder Schlüssel noch Signing-Secret, Endpoint-ID oder
Stripe-Antwortinhalte aus. Fehler erscheinen nur als feste Kategorien. Fehlt
ein erforderlicher Ereignistyp, darf zusätzlich ausschließlich dessen
öffentlicher Eventname ausgegeben werden.

## Aussagegrenze

Dieser Nachweis bestätigt die Stripe-seitige Testkonfiguration und die
gebundene Secret-Form, aber nicht, dass das nicht auslesbare Signing-Secret
tatsächlich zu genau diesem Endpoint gehört. Dafür bleibt ein echter,
signierter Stripe-Testlauf erforderlich. Erst ein erfolgreich zugestelltes
Testereignis mit HTTP 200 und anschließendem kontrolliertem Billing-Lifecycle
belegt die Ende-zu-Ende-Bindung.

## Signierter, mutationsfreier Staging-Smoke

Nach dem commit-genauen Deploy und der grünen read-only Endpoint-Prüfung kann
`FanMind Staging Stripe Webhook Signed Smoke` mit dem exakten ausgelieferten
`main`-Commit und der Bestätigung
`run-signed-staging-stripe-webhook-smoke` gestartet werden.

Der Lauf prüft zuerst `/api/version` auf genau diesen Commit und
`runtimeEnvironment=staging`. Erst danach signiert er mit dem geschützten
Staging-Secret ein absichtlich unbekanntes Probe-Ereignis und sendet es an den
fest eingebauten Staging-Endpoint. Der Eventtyp gehört nicht zur
FanMind-Handlerliste, enthält keine Workspace-, Kunden-, Subscription- oder
Payment-Referenz und löst daher keine Billing- oder Datenbankmutation aus.

Nur die gemeinsame Ausgabe

- `STAGING_STRIPE_WEBHOOK_SMOKE_RELEASE=verified`;
- `STAGING_STRIPE_WEBHOOK_SMOKE_SIGNATURE=accepted`;
- `STAGING_STRIPE_WEBHOOK_SMOKE_HTTP_STATUS=200`;
- `STAGING_STRIPE_WEBHOOK_SMOKE_MUTATIONS=0`;
- `STAGING_STRIPE_WEBHOOK_SMOKE=PASS`

belegt, dass der ausgelieferte Handler das geschützte Staging-Signing-Secret
akzeptiert. Der Smoke erstellt keinen Stripe-Event und ersetzt deshalb nicht
die anschließende echte Testzustellung aus der Stripe-Sandbox.

Bei einem Secret-Roll muss zuerst das neue Secret geschützt in die
Staging-Runtime übernommen werden. Danach folgt ein signierter Testlauf; das
alte Secret wird erst anschließend widerrufen. Secrets werden niemals in
Issue-Kommentare, Workflow-Eingaben oder Repository-Dateien kopiert.

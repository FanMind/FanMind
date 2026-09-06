# Stripe Basis-Billing Event-Ledger

Status: **implementiert, kontrolliert, nicht angewandt und nicht aktiviert**.

Dieser Baustein schließt die technische Lücke, in der ein verspätetes
`invoice.paid` nach `customer.subscription.deleted` einen Workspace erneut
aktivieren konnte. Er deckt alle Billing-mutierenden Webhook-Familien ab:

- Checkout Sessions
- Invoices
- Subscriptions
- PaymentIntents
- Refunds, Charges und Disputes
- Customer Tax IDs

Das kontrollierte SQL liegt bewusst unter
`supabase/controlled/20260816210000_workspace_stripe_billing_event_ledger.sql`
und **nicht** unter `supabase/migrations`. Weder Deploy noch `supabase db push`
wendet es an. In diesem Arbeitsstand wurde kein Stripe-, Supabase- oder anderer
externer API-/Datenbankaufruf ausgeführt.

## Sicherheitsmodell

Der normale Webhook prüft zuerst die Stripe-Signatur auf dem unveränderten Raw
Body. Danach wird nur eine normalisierte, allowgelistete Projektion an
`apply_workspace_stripe_billing_event` übergeben. Der Raw Body, E-Mail-Adressen
und sonstige Stripe-Kundendaten werden nicht im Ledger gespeichert.

Die RPC-Transaktion serialisiert pro Workspace und Stream, persistiert die
Event-ID als Idempotenzschlüssel und erhöht die Projektionsrevision per CAS.
Zusätzlich serialisiert sie auf den normalisierten Customer-/Objektankern.
Damit kann ein zuerst `unresolved` gespeichertes terminales Event nicht in
einem Commit-Rennen von einem späteren Checkout überholt werden. Sobald ein
späteres Event eine frühere offene Identität diesem Workspace zuordenbar macht,
geht der Stream vor jeder Projektion auf `reconciliation_pending`.
Die Stripe-Zeit `event.created` hat nur Sekundengenauigkeit:

- exakt dasselbe Event + derselbe Fingerprint: idempotenter Duplicate;
- älteres Event: `stale_event`, keine Projektion;
- anderes Event in derselben Sekunde: `event_order_conflict`;
- Event nach offenem Konflikt: `reconciliation_pending`.

Zusätzlich bleibt ein `customer.subscription.deleted` als terminaler
Lifecycle-Zustand erhalten. Ein auch später erzeugtes `invoice.paid` oder
`payment_intent.succeeded` darf ihn nicht reaktivieren, sondern erzeugt
`terminal_subscription_conflict`. Nur Checkout mit einer neuen Subscription
kann automatisch einen neuen Lifecycle beginnen; sonst ist ein kanonischer
Snapshot erforderlich.

Event-IDs werden ausdrücklich **nicht** sortiert, um eine vermeintliche
Reihenfolge zu erfinden. Lifecycle-Konflikte sperren die automatische
Aktivierung fail-closed (`suspended`/`archived_readonly`), ohne eine bestehende
`manual_suspended`-Entscheidung zu überschreiben. Der Tax-Stream ist getrennt;
ein Tax-ID-Reihenfolgekonflikt sperrt nicht den Zahlungszugang.
Bei mehreren widersprüchlichen Tenant-Ankern werden alle identifizierbaren
Lifecycle-Workspaces in deterministischer UUID-Lockreihenfolge fail-closed;
der Konflikt wird nicht nur ohne Workspace-Bezug quittiert.
Dasselbe gilt für eine kollidierende Stripe-Event-ID: Auch wenn die erste
Delivery noch ungebunden war, werden alle über alte oder neue langlebige
Objektanker identifizierbaren Lifecycle-Workspaces gesperrt.

Die vier Ledger-Tabellen haben Forced RLS, keine Policies und keine direkten
Tabellenrechte für `anon`, `authenticated` oder `service_role`. Nur die beiden
Security-Definer-RPCs sind für `service_role` ausführbar; beide fixieren den
`search_path`.

## Tenant-Bindung nach Eventvertrag

Die Bindung verwendet nicht blind jede ID, die zufällig im Stripe-Objekt
auftaucht:

| Familie | Bindungsanker | Danach dauerhaft beobachtet |
| --- | --- | --- |
| Checkout | eindeutige `workspace_id` aus FanMind-Checkout plus Customer | Session, Customer, Subscription, PI |
| PaymentIntent | eindeutiger Customer; PI darf neu/rotiert sein | neuer PI |
| Invoice | Customer + Subscription | Invoice, PI und Charge; PI/Charge sind keine Invoice-Anker |
| Subscription | Customer + Subscription | Subscription |
| Refund/Dispute | vorhandene historische Customer-/PI-/Charge-/Refund-/Dispute-Bindung | neue Reversal-Objekte |
| Tax ID | Customer | Tax ID |

Damit blockiert ein neuer wiederkehrender PaymentIntent nicht dauerhaft, nur
weil `workspaces.stripe_payment_intent_id` noch auf den vorherigen PI zeigt.
Umgekehrt werden alte Refunds/Disputes nicht gegen den beliebig aktuellen PI
geroutet. Fehlt die historische Transaktionsbindung, wird das signierte Event
als `unresolved` persistiert – es wird nicht mit HTTP 200 folgenlos verworfen.

Jede Stripe-Objekt-ID darf über
`workspace_stripe_billing_object_bindings` nur einem Workspace/Customer
zugeordnet sein. Rebinding wird atomar abgelehnt.

## Kanonischer Reconciliation-Vertrag

`reconcile_workspace_stripe_billing_projection` führt selbst **keinen**
Stripe-Aufruf aus. Ein separater, später freizugebender Operator muss vor der
kurzen Datenbanktransaktion einen aktuellen kanonischen Stripe-Snapshot holen
und ausschließlich Folgendes normalisiert übergeben:

1. exakte Workspace-, Customer- und optionale Subscription-Bindung;
2. Stripe-Request-ID `req_…` als idempotente Provider-Quittung;
3. Beobachtungszeit und SHA-256-Fingerprint des normalisierten Snapshots;
4. die erwartete aktuelle Projektionsrevision;
5. vollständige Liste der aufzulösenden Event-IDs;
6. vollständige kanonische Objektbindungen;
7. eine allowgelistete Workspace-Billing-Projektion. Lifecycle-Snapshots
   müssen mindestens `billing_status`, `workspace_access_mode`,
   `billing_suspended_at` und `billing_suspended_reason` vollständig
   (einschließlich expliziter `null`-Werte) enthalten.

Event-IDs und Objektbindungen werden lexikografisch normalisiert; das ist nur
eine kanonische Request-/Lockdarstellung und ausdrücklich keine Stripe-
Chronologie. Der Fingerprint muss über die vollständige normalisierte
Projektion, Bindungsliste und Snapshot-Identität gebildet werden.

Der Snapshot darf beim ersten RPC höchstens 15 Minuten alt und höchstens fünf
Minuten in der Zukunft liegen und muss zeitlich nach allen eingeschlossenen
Konflikt-Events liegen. Ein später Retry einer bereits gespeicherten
`req_…`-Quittung bleibt auch nach Ablauf dieses Fensters idempotent.
Offene gebundene Konflikte dürfen nicht ausgelassen werden. Request-ID,
Fingerprint, Revision und Tenant-Bindung werden in derselben Transaktion
geprüft. Ein Snapshot setzt eine neue Zeitgrenze; ein später eintreffendes
Event aus derselben Sekunde erzeugt erneut Reconciliation statt einer
unsicheren Aktivierung.

Tax-Reconciliation akzeptiert keine Subscription und nur Customer-/Tax-ID-
Bindungen sowie optional `billing_note`; sie kann keinen Lifecycle-Status
aktivieren. Ein erstmaliger Customer kann nur über einen eingeschlossenen,
konfliktfreien Checkout mit direkter Workspace-/Session-Bindung kanonisch
angelegt werden. Beliebige `NULL → cus_…`-Zuordnung bleibt abgelehnt.

Ein bereits kanonisch reconciliiertes Event kommt bei Replay als
`reconciled_event` zurück. Die ursprüngliche Event-Projektion darf dann weder
KI-Tier- noch Referral-Nebenwirkungen erneut ausführen. Vor einem kanonischen
Lifecycle-Snapshot, der den Zugang wieder auf `active` setzt, muss der
Operator deshalb die zugehörige KI-Tier-Reconciliation und Referral-
Reconciliation aus demselben Provider-Snapshot abgeschlossen haben. Diese
externe Orchestrierung ist in diesem Arbeitsstand bewusst **nicht** aktiviert
und bleibt ein Release-Blocker.

Für beim Cutover bereits bestehende Stripe-Workspaces wird der Lifecycle-Stream
als `controlled_cutover`/`reconciliation_needed` angelegt. Aktivierung ist erst
zulässig, nachdem **alle** Cutover- und Event-Konflikte mit frischen kanonischen
Snapshots geschlossen wurden. Fehlt ein Stream später trotz geöffnetem dritten
Gate, darf er nur für den ersten signierten Checkout eines wirklich unberührten
Workspace direkt `in_sync` starten: Der Workspace darf weder Customer noch
Subscription noch irgendeine historische Ledger-Objektbindung besitzen. Jeder
Bestands- oder Apply→Capture-Gap-Fall bleibt `controlled_cutover` und erzwingt
einen kanonischen Snapshot.

## Dormante Laufzeitbrücke und Capture-Cutover

Der neue Webhook-Pfad hat absichtlich zwei Stufen. Nach kontrolliertem SQL-
Apply und Postflight schalten die ersten beiden Werte den Legacy-PATCH-Pfad
ab und die persistente **Capture-only**-Stufe ein:

```dotenv
FANMIND_STRIPE_BILLING_EVENT_LEDGER_ENABLED=true
FANMIND_STRIPE_BILLING_EVENT_LEDGER_CONTROL_CONFIRMED=20260816210000
FANMIND_STRIPE_BILLING_CANONICAL_RECONCILIATION_CONFIRMED=false
```

Capture-only übergibt `p_projection_enabled=false`: jedes signierte Event wird
durabel erfasst, ein zuordenbarer Lifecycle aber nur
`reconciliation_pending`/fail-closed gesetzt. Keine Billing-Projektion und
keine KI-/Referral-Nebenwirkung darf laufen. Für das kurze SQL-Apply→Capture-
Intervall ist trotzdem ein expliziter Billing-Write-Freeze Pflicht. Falls diese
operative Grenze verletzt wird, verhindert die zusätzliche Missing-Stream-
Sperre zwar jede automatische Projektion, erzeugt aber bewusst einen
Reconciliation-Fall statt stillschweigend Historie zu erfinden.

Erst nach vollständigem Cutover, gemeinsamen Downstream-Abgleichen und
Staging-Abnahme wird der dritte Wert exakt `true`; nur dann sendet die Brücke
`p_projection_enabled=true`. Ein Stream mit noch offenem Zustand bleibt auch
dann fail-closed. Defaults bleiben `false`/leer. Vor SQL-Apply bleiben bereits
die ersten beiden Werte aus, sodass ein normaler Deploy den Legacy-Pfad nicht
ungeplant verlässt.

## Kontrollierter Staging-Ablauf

Offline, ohne Datenbankzugriff:

```bash
npm run db:stripe-billing-ledger:check
npm run test:staging-stripe-webhook
```

Ein späterer Staging-Operator nutzt ausschließlich den manuell gestarteten,
branch- und environment-gebundenen Workflow
`.github/workflows/stripe-billing-event-ledger-staging.yml`. Er verlangt die
Bestätigung `apply-stripe-billing-event-ledger`, den exakt eingegebenen und
ausgeführten 40-stelligen `main`-Commit, ein isoliertes Staging-Ziel, die Non-
Production-Schreibbestätigung und eine private `0600`-Passfile. Datenbankzugriff
ist zusätzlich an den Session-Pooler, den projektqualifizierten Benutzer,
einen tatsächlich gegen das Ziel verglichenen separaten Production-Host sowie
`verify-full` mit der eingecheckten Supabase-Root-CA gebunden. Der Runner pinnt
den SHA-256 des SQL und verwirft seinen Postflight per Rollback. Vor dem Apply
führt der Workflow außerdem den gemeinsamen read-only Rollout-State auf
demselben Commit, Ziel und derselben privaten Passfile aus. Fortfahren ist nur
bei exakt `STAGING_DATABASE_ROLLOUT_STRIPE_BILLING_LEDGER=apply` und
`STAGING_DATABASE_ROLLOUT_STATE=PASS` erlaubt; ein partieller Ledger-Stand
blockiert.

Der kontrollierte SQL-Vertrag installiert einen nicht für Runtime-Rollen
ausführbaren Schema-Verifier und ruft ihn noch innerhalb derselben Apply-
Transaktion auf. Geprüft werden die exakte Spaltenfolge samt Typ,
Nullability und Default, die vollständige Constraint-/FK-/CHECK-Topologie,
echte (nicht `CHECK(true)`) Zustandsinvarianten, Indexschlüssel/-Prädikate
samt `indisvalid`/`indisready`, Forced RLS, vollständige Tabellen- und
Spalten-ACLs sowie Funktionsmodus, `SECURITY DEFINER`, exakter `search_path`
und Execute-ACL. `service_role` erhält auf den beiden äußeren RPCs ausdrücklich
kein Grant Option und kann dieses Recht daher nicht delegieren. Alle sechs
Billing-Funktionen müssen außerdem dem unveränderlichen `session_user` des
projektgebundenen Postgres-Logins gehören; `service_role` ist als Owner
ausgeschlossen und kann die Delegationssperre nicht durch Ownership umgehen.

Die strukturelle Ist-Indexprüfung ist ausdrücklich auf `public` begrenzt.
Gleichnamige temporäre Oracle-Indizes dürfen nicht als Ist-Objekte geprüft
werden; der anschließende Hashvergleich verbindet jedes öffentliche Objekt
weiterhin explizit mit seinem `pg_temp`-Gegenstück.

Constraint- und Index-Sollwerte stammen dabei nicht aus veränderbaren
Datenbankkommentaren und werden auch nicht aus dem gerade vorgefundenen Katalog
zurückkopiert. Das checksum-gepinnte Control enthält stattdessen ein festes
Referenz-DDL. Es wird beim Apply und vor jedem unabhängigen Postflight
ausschließlich als session-lokales `pg_temp`-Schema-Oracle materialisiert; die
Vergleichs-Hashes werden aus diesem Oracle und dem tatsächlichen Katalog
getrennt gebildet. Ein neu erzeugter schwacher Check wie
`CHECK(true OR …)` kann damit weder durch identische Tokens noch durch einen
neu berechneten Kommentar PASS erreichen. CHECK- und Primary-Key-Definitionen
werden ohne Textnormalisierung gehasht; nur bei Foreign Keys wird der bekannte
temporäre `REFERENCES`-Tabellenname eng auf sein festes öffentliches Gegenstück
abgebildet. Damit können Schemawörter innerhalb eines CHECK-Stringliterals den
Vergleich nicht beeinflussen.

Nach dem Commit materialisiert der Runner dieses gepinnte Oracle zunächst
session-lokal als temporäre Objekte. Erst danach startet er die zweite
read-only Prüftransaktion, bindet die gespeicherte Verifier-Funktion bytegenau
an den Body aus dem checksum-gepinnten Control und führt dieselben Prüfungen
erneut aus. Der gebundene Verifier enthält zusätzlich feste SHA-256-Sollwerte
für die drei Helper und beide äußeren RPCs; ein metadata-identisches Ersetzen
eines Funktionskörpers scheitert deshalb ebenfalls. Die temporären
Referenzobjekte verschwinden spätestens mit der isolierten `psql`-Session; es
entsteht kein dauerhafter Datenbankstand. Ein erfolgreicher Apply ohne
erfolgreichen unabhängigen Postflight wird nie als PASS gemeldet.

Der Runner meldet zusätzlich zwei DB-basierte Cutover-Zähler:
`STRIPE_BILLING_EVENT_LEDGER_CUTOVER_PENDING` und
`STRIPE_BILLING_EVENT_LEDGER_CUTOVER_UNINVENTORIED`. Der zweite umfasst jeden
Workspace mit bestehender Stripe-Identität, dem der Lifecycle-Stream oder eine
aktuelle Customer-/Subscription-/Checkout-/PaymentIntent-/Invoice-Bindung
fehlt. Beide Werte müssen vor dem dritten Gate exakt `0` sein.

Kontrollierte Reihenfolge:

1. **vor** dem SQL-Apply Checkout und Legacy-Billing-Webhook-Projektionen im
   isolierten Staging in einen dokumentierten Write-Freeze versetzen;
2. den gemeinsamen read-only Rollout-State ausführen; nur die exakte Aktion
   `apply` bei Gesamtzustand `PASS` erlaubt den nächsten Schritt;
3. den manuellen SQL-Workflow samt In-Transaction- und unabhängigem
   Postflight innerhalb dieses Freeze ausführen;
4. danach genau die zwei Capture-Werte auf dem exakt geprüften Staging-Commit
   setzen; der dritte Wert bleibt `false`;
5. eine signierte Testzustellung als durable Capture bestätigen, erst dann den
   Write-Freeze lösen; ab hier können neue Events nicht mehr ungeloggert durch
   den Legacy-PATCH laufen;
6. **nach** Capture alle Workspaces mit Stripe-Identität vollständig gegen
   Streams und aktuelle Objektbindungen re-inventarisieren, alle
   `controlled_cutover`-Zeilen kanonisch reconciliieren und den read-only
   `db:stripe-billing-ledger:verify` erneut ausführen;
7. unresolved Refund-/Dispute-Bindungen mit Provider-Snapshot auflösen;
8. AI-Tier-/Referral-Reconciliation vor jeder aktiven Basis-Projektion belegen;
9. Test-Events in absichtlich vertauschter Reihenfolge und gleicher Sekunde
   abnehmen;
10. delayed `invoice.paid` nach `subscription.deleted` abnehmen;
11. unresolved-vor-Checkout, Multi-Anchor-, Duplicate-/Parallel-Delivery und
   manuelle Sperre abnehmen;
12. erst wenn beide Cutover-Zähler exakt `0` sind und keine Lifecycle-/Tax-
    Konflikte offen sind, den dritten Wert im isolierten Staging setzen.

Production-Apply oder Aktivierung ist nicht Bestandteil dieses Arbeitsstands.

## Integrationshinweis für den Core-Webhook

Der integrierte Stand baut auf dem KI-Ledger aus `a179be83` und dem Core-
Webhook aus PR #947 auf. Der Konflikt in
`src/app/api/stripe/webhook/route.ts` wurde bewusst aufgelöst: Dessen
eventtypische Legacy-Referenzverträge und Retry bei noch nicht sichtbarer
Bindung bleiben im dormanten `else`-Pfad erhalten; der neue Ledger-Pfad steht
davor und wird nur durch die beiden Capture-Werte erreicht. Invoice-PI/Charge
bleiben dort reine Beobachtungen, PaymentIntent bindet auf Customer und
Reversals benötigen eine historische Objektbindung. Ebenso muss die bereits
verifizierte Stripe-Signatur weiter explizit an beide Ledger-Brücken übergeben
werden. Ein blindes automatisches Merge ist für diese Route nicht zulässig.

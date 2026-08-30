# Öffentliche Daily-Test-Provisionierung

Stand: 9. August 2026

## Zweck und harte Grenze

Der interne Tarif `internal_daily_test` bleibt im Normalbetrieb admin-only.
Ein Admin darf das außergewöhnliche öffentliche Registrierungsfenster für
höchstens 24 Stunden nur öffnen, wenn alle folgenden Grenzen gleichzeitig
wirksam sind:

- die Anwendung provisioniert Workspaces ausschließlich nach einer
  serverseitig verifizierten Supabase-Session;
- das Laufzeitfenster wird unmittelbar vor der Mutation frisch und
  fail-closed gelesen;
- `updatedAt` ist gültig und liegt nicht in der Zukunft; bereits ein um eine
  Millisekunde zukünftiger Startzeitpunkt schließt das Fenster fail-closed;
- `public.ensure_internal_daily_test_workspace(uuid,text,boolean)` ist
  installiert und ausschließlich für `service_role` ausführbar;
- die validierten Workspace-CHECKs bilden exakt den kanonischen Wertvertrag
  einschließlich `internal_daily_test` und des Schema-Kompatibilitätswerts
  `card` ab; dieser Wert schränkt die von Stripe im Checkout dynamisch
  angebotenen Zahlungsmethoden nicht ein;
- direkte Tabellen- und Spalten-`INSERT`-Rechte auf `public.workspaces` sind
  für `PUBLIC`, `anon` und `authenticated` entzogen;
- der Readiness-RPC bestätigt diesen kombinierten Zustand;
- `STRIPE_PRICE_INTERNAL_DAILY_TEST`, `STRIPE_SECRET_KEY`, eine App-URL und
  `STRIPE_WEBHOOK_SECRET` sind gemeinsam konfiguriert. Fehlt nur einer dieser
  Werte, bleiben Admin-Freigabe, öffentliche Auswahl, Pre-Sign-up-Admission
  und Daily-Workspace-Mutation fail-closed.

Die Anwendung nimmt keine User-ID, Preise, Billing-Felder oder Testflags aus
dem Registrierungs-Request an. Ein authentifizierter Same-Origin-Request darf
ausschließlich eine exakt allowlistete Starter- oder Daily-Tarifkombination
und die ausdrückliche aktuelle Zahlungsbedingungen-Annahme übergeben. Der
Server leitet die Nutzeridentität aus der verifizierten Session ab,
überschreibt die sicherheitsrelevante Auswahl nur für den unmittelbaren
Provisionierungsaufruf und vertraut dafür keinen persistenten
Auth-`user_metadata`. Nach einer E-Mail-Bestätigung bietet `/workspace/setup`
den Daily-Test nur dann erneut an, wenn Zeitfenster, RPC-Readiness und der
vollständige Stripe-Testvertrag frisch serverseitig bereit sind; die Mutation
prüft diese Grenzen unmittelbar vor dem RPC nochmals. Der bestehende
authentifizierte Starter-RPC bleibt absichtlich Starter-only. Der Daily-SQL-Schritt liegt
außerhalb `supabase/migrations/`; ein normaler Web-Deploy und ein generisches
`supabase db push` dürfen ihn weder entdecken noch anwenden und aktivieren das
Fenster nicht.

## Artefakte

- App-Grenze: `src/app/api/register/workspace/route.ts`
- frischer Zeitfensterstatus: `src/lib/runtimeProductSettings.ts`
- gemeinsame Stripe-/Webhook-Admission:
  `src/lib/internalDailyTestReadinessPolicy.mjs`
- serverseitige Provisionierung: `src/lib/supabase/server.ts`
- einzeln freizugebender kontrollierter SQL-Schritt:
  `supabase/controlled/20260808230102_internal_daily_test_workspace_provisioning.sql`
- checksum- und zielgebundener Runner:
  `scripts/operations/internal-daily-test-provisioning-migration-runner.mjs`
- getrennte manuelle Staging-Workflows:
  `.github/workflows/internal-daily-test-workspace-provisioning-staging-verify.yml`
  und
  `.github/workflows/internal-daily-test-workspace-provisioning-staging-apply.yml`
- Browser-INSERT-Contract:
  `supabase/controlled/20260726121000_workspace_server_owned_columns.sql`

## Gepinnter Staging-Kontrollpfad

Der kontrollierte SQL-Stand ist ausschließlich mit folgendem SHA-256
freigegeben:

```text
235b1f7e57cd2c6ecfdc9d68b6412c3649aee776b7bb1bc8688d74ac0da5ed4a
```

Der Stand vom 9. August 2026 verwendet für die Owner-Membership bewusst den
benannten Unique-Constraint `workspace_members_workspace_id_user_id_key` als
`ON CONFLICT`-Ziel. Dadurch kollidiert das PL/pgSQL-Rückgabefeld
`workspace_id` nicht mit einem unqualifizierten Conflict-Target. Der reale
Staging-Funktionstest muss Erstaufruf, Wiederholung und Cleanup bestätigen.

Jede Abweichung blockiert bereits den Offline-Check. Der Runner stellt drei
getrennte Modi bereit:

```bash
npm run db:daily-workspace-provisioning:check
npm run db:daily-workspace-provisioning:verify
npm run db:daily-workspace-provisioning:apply
```

- `check` liest weder Datenbank noch Secrets und prüft SHA-256 sowie den engen
  SQL-Vertrag.
- `verify` führt genau einen read-only, zurückgerollten Katalog-Postflight aus.
- `apply` führt zuerst einen read-only, zurückgerollten Preflight aus, übergibt
  danach ausschließlich den gepinnten SQL-Inhalt an `psql` und führt zuletzt
  denselben read-only Postflight aus. Schlägt einer der drei Schritte fehl,
  endet der Lauf mit einem festen, redigierten Fehlercode.

Der Postflight vertraut nicht allein dem Readiness-RPC: Er bindet beide
Funktionen zusätzlich an Owner `postgres`, SECURITY-DEFINER, exakten
`search_path`, Sprache, Volatilität, Tabellen-Rückgabevertrag und den
bytegenauen Funktionskörper aus dem zuvor SHA-256-geprüften SQL-Artefakt. Die
vollständige `EXECUTE`-ACL darf je Funktion ausschließlich aus dem Owner und
einem nicht weiterdelegierbaren, vom Owner gewährten `service_role`-Eintrag
bestehen; jede zusätzliche Rolle blockiert den Postflight.

Der Apply ist ausschließlich über den manuellen, geschützten Staging-Workflow
erlaubt. Er verlangt `refs/heads/main`, den exakten 40-stelligen aktuellen
Commit als Workflow-Eingabe; der Workflow reicht ihn im geschützten
`staging`-Environment an den Runner weiter, und Workflow sowie Runner
vergleichen ihn mit `github.sha` beziehungsweise `GITHUB_SHA`. Hinzu kommen
die Bestätigung
`apply-internal-daily-test-workspace-provisioning`, das Schreib-Acknowledge
`I_UNDERSTAND_NON_PRODUCTION_ONLY`, eine exakte Staging-Projektbindung und
TLS `verify-full` mit absolutem CA-Pfad. Der Verify-Workflow verlangt getrennt
`verify-internal-daily-test-workspace-provisioning`, setzt Writes ausdrücklich
auf `false` und besitzt keinen Apply-Schritt. Beide verwenden nur eine eigene
private `0600`-Passwortdatei; URL-, Passwort- und libpq-Umleitungen werden
fail-closed abgewiesen beziehungsweise vor `psql` entfernt.

Der Preflight blockiert, wenn der Supabase-Migrationsledger fehlt oder Version
`20260808230102` bereits in `supabase_migrations.schema_migrations` steht. Ein
solcher Eintrag deutet auf
eine frühere generische Anwendung hin und muss als History-Drift separat
geklärt werden; der kontrollierte Apply darf ihn nicht übergehen. Das gepinnte
SQL wiederholt diese Prüfung innerhalb seiner Transaktion und hält den Ledger
dabei im `SHARE`-Modus gesperrt, sodass ein paralleler generischer Push die
Preflight-Entscheidung nicht überholen kann. Es existiert absichtlich kein
Production-Apply-Workflow. Production benötigt nach einem dokumentierten
Staging-Receipt einen eigenen, später freizugebenden und erneut geprüften
Kontrollpfad.

## Verbindliche Reihenfolge

1. Fenster deaktiviert lassen und den App-Stand zuerst deployen. Ohne neuen
   RPC bleibt die Daily-Auswahl durch den Readiness-Check verborgen.
2. In der isolierten Staging-Datenbank bestätigen, dass
   `20260726120000_workspace_provisioning_rpc.sql` und der kontrollierte
   Browser-INSERT-Contract vollständig abgenommen sind.
3. Vor der Migration count-only prüfen, dass alle bestehenden
   `commercial_option`- und `payment_collection_method`-Werte im unten
   dokumentierten erweiterten Vertrag liegen. Jeder Fremdwert blockiert den
   Rollout und muss anhand der Billing-Auditdaten getrennt geklärt werden.
4. Den neuen kontrollierten Expand-/Contract-SQL-Schritt ausschließlich mit
   dem manuellen Staging-Apply-Workflow gegen dieses bestätigte Ziel anwenden.
   Seine neuen CHECKs werden zuerst erweitert und validiert; erst danach
   ersetzt er die bisherigen engeren CHECKs.
5. PostgREST-Schema-Cache aktualisieren und die unten stehenden Privileg- und
   Readiness-Prüfungen ausführen.
6. Mit einem dedizierten synthetischen Staging-Auth-Nutzer den positiven,
   negativen und parallelen Provisioning-Fall prüfen. Transaktionale
   Testdaten anschließend kontrolliert entfernen; keine Production-Nutzer
   verwenden.
7. Das Staging-Ergebnis mit Commit, Workflow-Run, Zielidentität ohne Secret,
   SHA-256 und allen DB-/PostgREST-/Parallelitätsnachweisen dokumentieren.
   Production bleibt bis zu einem getrennt geprüften Kontrollpfad gesperrt.
8. Daily-Preis, Stripe-Secret, kanonische App-URL und Webhook-Secret im
   exakten Ziel prüfen; die Prüfung darf nur Statuswerte und keine Secrets
   ausgeben.
9. Das öffentliche Fenster auch nach erfolgreicher Staging-Abnahme aus lassen.
   Seine Öffnung und jeder spätere Production-Rollout benötigen getrennte
   Freigaben.

## Read-only Preflight und Postflight

Nur in der kontrollierten SQL-Umgebung des exakt bestätigten Ziels ausführen.
Ausgaben dürfen keine Nutzer-, Workspace-, Stripe- oder Secretwerte enthalten.

```sql
select
  to_regprocedure(
    'public.ensure_current_user_workspace(text,text,boolean)'
  ) is not null as starter_rpc_present,
  to_regprocedure(
    'public.ensure_internal_daily_test_workspace(uuid,text,boolean)'
  ) is not null as daily_rpc_present,
  not has_table_privilege('anon', 'public.workspaces', 'INSERT')
    and not has_any_column_privilege(
      'anon', 'public.workspaces', 'INSERT'
    ) as anon_insert_denied,
  not has_table_privilege('authenticated', 'public.workspaces', 'INSERT')
    and not has_any_column_privilege(
      'authenticated', 'public.workspaces', 'INSERT'
    ) as authenticated_insert_denied;

select
  count(*) filter (
    where commercial_option not in (
      'pilot_only',
      'starter_paid_setup',
      'starter_no_setup_commitment',
      'internal_daily_test'
    )
  ) as incompatible_commercial_options,
  count(*) filter (
    where payment_collection_method is not null
      and payment_collection_method not in (
        'none',
        'manual_invoice',
        'sepa_direct_debit',
        'card'
      )
  ) as incompatible_payment_methods
from public.workspaces;

select
  conname,
  convalidated,
  case conname
    when 'workspaces_commercial_option_check' then
      pg_get_constraintdef(oid, true) =
        $commercial_option_contract$CHECK (commercial_option = ANY (ARRAY['pilot_only'::text, 'starter_paid_setup'::text, 'starter_no_setup_commitment'::text, 'internal_daily_test'::text]))$commercial_option_contract$
    when 'workspaces_payment_collection_method_check' then
      pg_get_constraintdef(oid, true) =
        $payment_collection_contract$CHECK (payment_collection_method IS NULL OR (payment_collection_method = ANY (ARRAY['none'::text, 'manual_invoice'::text, 'sepa_direct_debit'::text, 'card'::text])))$payment_collection_contract$
    else false
  end as exact_value_contract
from pg_constraint
where conrelid = 'public.workspaces'::regclass
  and conname in (
    'workspaces_commercial_option_check',
    'workspaces_payment_collection_method_check'
  )
order by conname;
```

Der Repository-Policytest sichert den erwarteten Migrationstext ab; maßgeblich
für den Staging-Rollout ist zusätzlich der Runner-Katalog-Postflight im
tatsächlichen Ziel. Falls ein PostgreSQL-Major-Upgrade
die kanonische Ausgabe ändert, bleibt Readiness absichtlich `false`, bis der
unveränderte Wertvertrag erneut geprüft und die erwartete Definition bewusst
aktualisiert wurde.

Vor der Anwendung müssen beide `incompatible_*`-Zähler `0` sein. Nach der
Anwendung müssen beide Constraint-Zeilen vorhanden und validiert sein; der
Wert `exact_value_contract` muss für beide Zeilen `true` sein. Damit reichen
weder ein bloßes Vorkommen von `internal_daily_test` beziehungsweise `card`
noch ein CHECK mit zusätzlichen erlaubten Werten aus. Auch alle übrigen
booleschen Werte müssen `true` sein. Zusätzlich mit der
serverseitigen Staging-Service-Role über PostgREST prüfen:

```text
POST /rest/v1/rpc/internal_daily_test_workspace_provisioning_ready
{}
```

Erwartung: exakt eine Zeile mit `ready=true`. Derselbe Aufruf mit `anon` oder
`authenticated` muss verweigert werden. Der Daily-Provisioning-RPC muss für
beide Browserrollen ebenfalls verweigert werden. Dieser PostgREST-Nachweis und
der nachfolgende synthetische Parallelitätstest sind separate externe
Staging-Abnahmen; ein grüner Runner-DB-Postflight behauptet sie nicht mit.

## Funktionsabnahme

- Fenster geschlossen: Registrierung endet vor der DB-Mutation; keine
  Workspace- und keine Membership-Zeile entsteht.
- Fehlender Daily-Preis, Stripe-Secret, App-URL oder Webhook-Secret: Die
  Pre-Sign-up-Admission antwortet fail-closed und der Registrierungsablauf
  ruft Supabase Sign-up nicht auf; die Workspace-Mutation bleibt ebenfalls
  gesperrt. Der Checkout startet nicht, solange der Webhook nicht bereit ist.
- Fenster offen und Readiness `true`: genau ein Daily-Workspace mit
  `pilot`, `internal_daily_test`, `0/0/0`, `pending_payment_setup`,
  `stripe`, `card`, Zahlungsbedingung `2026-06-v1` und genau eine
  Owner-Membership entsteht.
- Wiederholung und parallele Aufrufe: dieselbe Workspace-ID, höchstens ein
  `created=true`, keine Duplikate.
- Bestehender Workspace: keine Tarifkonvertierung; der vorhandene Workspace
  bleibt unverändert.
- Direkter authentifizierter Aufruf: `EXECUTE` verweigert, auch während eines
  offenen Fensters.
- Abgelaufenes, fehlendes oder beschädigtes Laufzeitfile: fail-closed, keine
  Mutation.

## Rollback

1. Das öffentliche Fenster zuerst deaktivieren.
2. Falls nur die App zurückgerollt wird, die RPCs installiert aber ungenutzt
   lassen; keine bestehenden Workspaces verändern.
3. Falls die Funktionen zurückgenommen werden müssen, `EXECUTE` zuerst für
   alle Browserrollen und `service_role` entziehen und anschließend nur die
   beiden neuen Funktionen droppen. Die Readiness fällt dann automatisch auf
   `false`.
4. Der Browser-INSERT-Contract bleibt bestehen und darf für einen Rollback
   niemals wieder geöffnet werden. Bestehende Workspaces, Abos und Zahlungen
   werden nicht gelöscht oder umgestellt.

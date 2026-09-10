# Workspace-Felder serverseitig schützen

Stand: 26. Juli 2026

## Ziel

Normale Workspace-Owner dürfen ausschließlich diese Stammdaten direkt mit
ihrem Supabase-JWT ändern:

- `name`
- `organization_name`
- `street_address`
- `postal_code`
- `city`
- `country`
- `vat_id`
- `tax_number`
- `company_register_number`
- `company_register_court`

Plan, Preise, Billing, Stripe, Subscription, Zahlungsannahme,
`owner_user_id`, interne Testflags und alle zukünftigen Workspace-Spalten sind
serververwaltet. Neue Starter-Workspaces entstehen atomar über
`ensure_current_user_workspace(...)`.

## Angezeigte Vertragsversion bestätigen

Vor der kostenpflichtigen Anlage übertragen alle drei Paketformulare die
angezeigte `paymentTermsVersion` zusätzlich zu Paketwahl und ausdrücklicher
Zustimmung. Auch `POST /api/register/workspace` verlangt diese Version.
Beide authentifizierten Einstiegspunkte und der gemeinsame
`buildTrustedProvisioningUser`-Helper vergleichen sie exakt mit der aktiven
Serverversion, bevor `ensureUserWorkspace` erreicht wird. Fehlende oder alte
Versionen erfordern eine neue Bestätigung; die API antwortet mit HTTP 409 und
`payment_terms_changed`. Ein Eintrag in veränderbarer Auth-Metadaten ersetzt
keine übermittelte Bestätigung. Zeitpunkt, Owner und kommerzielle Werte bleiben
serververwaltet.

Die Codekorrektur aus FM-BILL-003 ist keine Vertragsfreigabe oder SQL-Aktivierung.
Insbesondere müssen eine neue Fassung und die bestehenden SQL-Funktionen vor
Freischaltung gemeinsam versioniert werden. Die historischen Annahmedaten
werden dabei nicht auf eine neue Fassung umgeschrieben. Die folgenden
kontrollierten Rollout- und Abnahmeschritte bleiben erforderlich.

## Harte Release-Grenze

Der Rollout ist ein Expand-/Contract-Verfahren mit einer verpflichtenden
Abnahmepause:

1. den RPC-kompatiblen App-Brückenstand deployen; allgemeine Reads und
   Demo-Normalisierungen verwenden weiterhin nur die bereits produktiv
   gelesene Workspace-Spaltenliste, und ein exakt fehlendes Step-A-Feld fällt
   auf den älteren kommerziellen Core-Insert zurück;
2. den unten ausdrücklich als „vor Schritt A“ markierten Production-Preflight
   vollständig ausführen;
3. die additive Migration
   `supabase/migrations/20260726120000_workspace_provisioning_rpc.sql`
   einzeln anwenden;
4. alle von Migration und RPC verwendeten Workspace-Spalten sowie den
   PostgREST-Schema-Cache nachweisen;
5. Registrierung, Login-Backfill sowie feste und temporäre Demo real testen;
6. denselben Stand in einer isolierten Supabase-/PostgreSQL-Umgebung mit
   echten JWT-, Grant-, RLS- und Parallelitätstests bestätigen;
7. erst nach schriftlich festgehaltenem Go den Contract-Schritt
   `supabase/controlled/20260726121000_workspace_server_owned_columns.sql`
   einzeln anwenden;
8. alle positiven, negativen und Service-Role-Abnahmetests wiederholen.

Der Contract-Schritt liegt absichtlich nicht unter `supabase/migrations`.
Ein generisches `supabase db push` darf Schritt B weder anwenden noch als
Ersatz für die Abnahmepause verwendet werden.

Der App-Brückenstand verwendet bei einem exakt fehlenden
RPC-/Schema-Cache-Eintrag den bisherigen kompatiblen Insert-Pfad und bleibt
vor Schritt A auf der bereits produktiv verwendeten Workspace-Spaltenliste.
Die sieben durch Schritt A garantierten Felder `payment_terms_version`,
`payment_terms_accepted_at`, `payment_terms_accepted_by_user_id`,
`stripe_checkout_session_id`, `stripe_payment_intent_id`,
`stripe_mandate_id` und `billing_note` werden bis dahin weder in neuen
allgemeinen Workspace-SELECTs noch Demo-Normalisierungen vorausgesetzt. Die
beiden Missing-RPC-Brücken versuchen die bereits bestehende vollständige
Zahlungsannahme nur dann zu speichern, wenn die Spalten verfügbar sind. Nur
bei einer exakt erkannten fehlenden Step-A-Spalte wiederholen sie atomar mit
dem älteren Core-Satz einschließlich Billing-Status, Provider,
Zahlungsweg und Auditzeit; andere Fehler bleiben fail-closed. Schritt A
bereinigt alle sieben Felder für temporäre Demos über `demo_start_sessions`
und für die feste Sandra-Demo über die exakt festgelegte Auth-Identität
`sandra.m@fanmind.ch`. Temporäre Demos werden ausschließlich über ihre
serverseitige Session-Zuordnung normalisiert; der änderbare Workspace-Name ist
kein Identitätsmerkmal.

## Production-Preflight vor Schritt A

Nur in der kontrollierten Supabase-SQL-Umgebung ausführen. Ergebnisse als
redigiertes Rollout-Protokoll sichern.

### Schema, Daten und eindeutige Identität

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'workspaces'
order by ordinal_position;

select owner_user_id, count(*)
from public.workspaces
group by owner_user_id
having count(*) > 1;

select workspace_id, user_id, count(*)
from public.workspace_members
group by workspace_id, user_id
having count(*) > 1;

select w.id, w.owner_user_id
from public.workspaces w
left join public.workspace_members wm
  on wm.workspace_id = w.id
 and wm.user_id = w.owner_user_id
where wm.id is null;

select id
from public.workspaces
where owner_user_id is null
   or plan_id is null
   or commercial_option is null
   or setup_fee_cents is null
   or monthly_fee_cents is null
   or commitment_months is null
   or billing_status is null
   or billing_provider is null
   or payment_collection_method is null
   or workspace_access_mode is null
   or test_access_flags is null;
```

Jede Duplicate-Zeile blockiert schon Schritt A. Jede Null-/Invariantenzeile
blockiert Schritt B, bis sie anhand von Stripe- und Admin-Auditdaten mit
Service Role fachlich geklärt wurde. Die Migration darf keine unbekannten
Altdaten erraten.

### Policies, direkte und geerbte Rechte

```sql
select policyname, permissive, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('workspaces', 'workspace_members')
order by tablename, policyname;

select relrowsecurity
from pg_class
where oid = 'public.workspaces'::regclass;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'workspaces'
order by grantee, privilege_type;

select grantee, column_name, privilege_type
from information_schema.role_column_grants
where table_schema = 'public'
  and table_name = 'workspaces'
order by grantee, column_name, privilege_type;

select
  member_role.rolname as member_role,
  inherited_role.rolname as inherited_role,
  membership.admin_option
from pg_auth_members membership
join pg_roles member_role
  on member_role.oid = membership.member
join pg_roles inherited_role
  on inherited_role.oid = membership.roleid
where member_role.rolname in ('anon', 'authenticated')
order by member_role.rolname, inherited_role.rolname;

select
  attribute.attname as column_name,
  has_column_privilege(
    'anon',
    'public.workspaces',
    attribute.attname,
    'INSERT'
  ) as anon_can_insert,
  has_column_privilege(
    'authenticated',
    'public.workspaces',
    attribute.attname,
    'INSERT'
  ) as authenticated_can_insert,
  has_column_privilege(
    'anon',
    'public.workspaces',
    attribute.attname,
    'UPDATE'
  ) as anon_can_update,
  has_column_privilege(
    'authenticated',
    'public.workspaces',
    attribute.attname,
    'UPDATE'
  ) as authenticated_can_update
from pg_attribute attribute
where attribute.attrelid = 'public.workspaces'::regclass
  and attribute.attnum > 0
  and not attribute.attisdropped
order by attribute.attnum;
```

Unbekannte Policies, Alt-Column-Grants oder geerbte Schreibrechte müssen vor
Schritt B erklärt sein. Der Contract-Schritt aktiviert RLS, widerruft alle
aktuellen spaltenbezogenen INSERT-/UPDATE-Rechte und besitzt eine
Postcondition, die bei deaktiviertem RLS oder verbleibenden direkten bzw.
geerbten Rechten abbricht. Eine zusätzliche restrictive Owner-Policy
verhindert, dass eine fremde permissive UPDATE-/ALL-Policy den Mandantenrahmen
erweitert.

## Schritt A: additive Migration

In einem kontrollierten Fenster ausführen, weil die beiden eindeutigen
Index-Builds Tabellenwrites blockieren können:

```bash
psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20260726120000_workspace_provisioning_rpc.sql
```

Danach PostgRESTs Schema-Cache gemäß Supabase-Betriebsweg neu laden. Alle
folgenden Postconditions müssen erfolgreich sein, bevor der Rollout über
Schritt A hinaus fortgesetzt und Schritt B freigegeben wird. Der
RPC-kompatible App-Brückenstand wurde gemäß der verbindlichen Reihenfolge
bereits vor Schritt A deployt.

### Postcondition: Indizes

Beide benannten Indizes müssen eindeutig, gültig, bereit, live,
immediate/nicht aufschiebbar, ungefiltert und exakt auf den vorgesehenen
Schlüsselspalten liegen:

```sql
select
  index_class.relname as index_name,
  index_record.indisunique,
  index_record.indisvalid,
  index_record.indisready,
  index_record.indislive,
  index_record.indimmediate,
  index_record.indpred is null as unfiltered,
  pg_get_indexdef(index_record.indexrelid) as definition
from pg_index index_record
join pg_class index_class
  on index_class.oid = index_record.indexrelid
where index_record.indexrelid in (
  'public.workspaces_owner_user_id_uidx'::regclass,
  'public.workspace_members_workspace_user_uidx'::regclass
);
```

### Postcondition: SECURITY-DEFINER-Funktion

```sql
select
  function_record.oid::regprocedure as function_name,
  pg_get_userbyid(function_record.proowner) as owner,
  function_record.prosecdef,
  function_record.proconfig,
  function_record.proacl
from pg_proc function_record
where function_record.oid =
  'public.ensure_current_user_workspace(text,text,boolean)'::regprocedure;

select
  has_function_privilege(
    'authenticated',
    'public.ensure_current_user_workspace(text,text,boolean)',
    'EXECUTE'
  ) as authenticated_can_execute,
  has_function_privilege(
    'anon',
    'public.ensure_current_user_workspace(text,text,boolean)',
    'EXECUTE'
  ) as anon_can_execute;
```

Erwartet werden `prosecdef = true`, der feste dokumentierte Suchpfad,
EXECUTE nur für `authenticated` und ein geprüfter `postgres`- oder dedizierter
nicht anmeldbarer Funktionsowner. Ein unbekannter oder anmeldbarer Definer
blockiert den Rollout.

### Postcondition: Spalten und PostgREST-Schema-Cache

Diese Katalogabfrage muss leer bleiben:

```sql
with required(column_name) as (
  values
    ('billing_provider'),
    ('payment_collection_method'),
    ('payment_terms_version'),
    ('payment_terms_accepted_at'),
    ('payment_terms_accepted_by_user_id'),
    ('stripe_checkout_session_id'),
    ('stripe_payment_intent_id'),
    ('stripe_mandate_id'),
    ('billing_note')
)
select required.column_name
from required
left join information_schema.columns actual
  on actual.table_schema = 'public'
 and actual.table_name = 'workspaces'
 and actual.column_name = required.column_name
where actual.column_name is null
order by required.column_name;
```

Der Katalognachweis allein belegt den PostgREST-Schema-Cache nicht. Mit einem
kurzlebigen normalen Owner-JWT müssen deshalb zusätzlich zwei rein lesende
API-Nachweise erfolgreich sein. Weder JWT noch Antwortdaten dürfen im
Rollout-Protokoll erscheinen:

```bash
curl --fail-with-body --silent --show-error \
  --output /dev/null \
  --get "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/workspaces" \
  --data-urlencode \
    "select=id,billing_provider,payment_collection_method,payment_terms_version,payment_terms_accepted_at,payment_terms_accepted_by_user_id,stripe_checkout_session_id,stripe_payment_intent_id,stripe_mandate_id,billing_note" \
  --data-urlencode "limit=1" \
  --header "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OWNER_ACCESS_TOKEN"

curl --fail-with-body --silent --show-error \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/" \
  --header "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OWNER_ACCESS_TOKEN" \
  | jq -e '.paths["/rpc/ensure_current_user_workspace"] != null' \
  >/dev/null

unset OWNER_ACCESS_TOKEN
```

Erst nach leerer Katalogabfrage und beiden erfolgreichen API-Nachweisen darf
der Rollout über die App-Brücke hinaus fortgesetzt werden. Danach in der
Anwendung prüfen:

- Starter Flex erzeugt `starter_paid_setup`, 99.000 Setup-Cents,
  31.200 Monats-Cents und 0 Monate Bindung;
- Starter 12 Monate erzeugt `starter_no_setup_commitment`, 0 Setup-Cents,
  31.200 Monats-Cents und 12 Monate Bindung;
- beide erzeugen `pending_payment_setup`, `stripe`,
  `sepa_direct_debit` und Zahlungsbedingungen `2026-06-v1`;
- Wiederholung und zwei parallele Aufrufe liefern denselben Workspace;
- bestehende Workspace-Billingwerte werden nicht aus User-Metadaten repariert
  oder überschrieben;
- fehlende Annahme, Pilot, internes Testabo und unbekannte Optionen scheitern
  ohne Teilzeilen;
- feste Sandra-Demo und temporäre Demo bleiben funktionsfähig;
- die feste Sandra-Demo besitzt nach Schritt A keine Checkout-, Payment-
  Intent-, Customer-, Subscription-, Mandats-, Billing-Notiz- oder
  Zahlungsbedingungen-Referenz mehr; ihre Identität wird dabei über die
  dedizierte Auth-E-Mail und nicht über den Workspace-Namen bestimmt;
- reservierte, aktive, abgelaufene oder fehlgeschlagene temporäre Demos mit
  `demo_start_sessions`-Zuordnung besitzen `billing_status = demo_free` und
  exakt `test_access_flags = {"temporary_demo": true}`; alte Testflags,
  Stripe- inklusive Payment-Intent-/Mandat-Referenzen, Billing-Notiz, Invoice-,
  Subscription-, Kündigungs- und Zahlungsannahmewerte sind gelöscht;
- zwei parallele Sandra-Aufrufe erzeugen dank deterministischer IDs und
  Primary-Key-Upserts weder doppelte Kontakte noch doppelte Memories,
  Follow-ups, Conversations oder Nachrichten.
- der feste Sandra-Workspace wird auch bei bereits vorhandenem Workspace über
  den normalen Dashboard-Pfad kanonisiert; ein erst nach vollständig
  erfolgreichem Seed gesetzter Versionsmarker verhindert teure Wiederholung
  und lässt partielle Alt-Seeds erneut anlaufen;
- die Auth-User-ID eines temporären Demo-Starts wird bereits im reservierten
  Zustand persistiert, bevor ein Workspace angelegt wird; ein Owner-Cascade
  macht dadurch auch einen Abbruch zwischen Workspace-Anlage und Aktivierung
  aufräumbar;
- `reserved` und `cleanup_failed` mit abgelaufener Frist, ein `failed` mit
  verbliebener Auth- oder Workspace-Ressource sowie ein seit mindestens
  15 Minuten hängen gebliebenes `cleanup_pending` werden vom Cleanup-Worker
  erneut beansprucht; ein ressourcenfreies `failed` bleibt als Auditzeile
  erhalten.

### Postcondition: Bridge-Zahlungsannahme

Ein Core-Fallback kann nur dann entstehen, wenn der RPC und mindestens eine
Step-A-Spalte gleichzeitig noch fehlen. Nach Schritt A muss dieser rein
aggregierte Nachweis `0` ergeben:

```sql
select count(*) as starter_without_payment_terms_evidence
from public.workspaces
where plan_id = 'starter'
  and commercial_option in (
    'starter_paid_setup',
    'starter_no_setup_commitment'
  )
  and (
    payment_terms_version is distinct from '2026-06-v1'
    or payment_terms_accepted_at is null
    or payment_terms_accepted_at <
      timestamptz '2026-06-01 00:00:00+00'
    or payment_terms_accepted_at >
      statement_timestamp() + interval '5 minutes'
    or payment_terms_accepted_by_user_id is distinct from owner_user_id
  );
```

Ein Wert größer `0` blockiert Schritt B. Auth-`raw_user_meta_data` ist
benutzerbearbeitbar und darf nicht automatisch als Annahmenachweis
zurückgeschrieben werden. Die betroffenen Konten werden nur in der geschützten
Rollout-Umgebung ermittelt; anschließend muss die damalige Annahme aus einem
vertrauenswürdigen Signup-/Consent-Audit belegt oder über einen
authentifizierten Flow neu eingeholt werden. Erst dann darf Service Role die
drei Felder setzen. Das Rollout-Protokoll enthält nur den Count, keine User-
oder Workspace-IDs. Der Contract-Schritt prüft dieselbe Invariante erneut und
bricht mit `workspace_payment_terms_evidence_missing` ab. Gültig sind nur die
exakte Version `2026-06-v1`, der Workspace-Owner als annehmender User und ein
Zeitpunkt ab 1. Juni 2026, der höchstens fünf Minuten in der Zukunft liegt.

Preise oder eine neue Zahlungsbedingungsversion dürfen nie nur in TypeScript
geändert werden. Jede Änderung an 31.200/99.000 Cents oder `2026-06-v1`
benötigt vor Aktivierung eine neue, gemeinsam geprüfte Funktionsmigration.

## Schritt B: Contract kontrolliert anwenden

Erst nach der dokumentierten Abnahme von Schritt A einschließlich eines
Bridge-Zahlungsannahme-Counts von `0`:

```bash
psql "$SUPABASE_DB_URL" \
  -v ON_ERROR_STOP=1 \
  -f supabase/controlled/20260726121000_workspace_server_owned_columns.sql
```

Ein `supabase db push` ist für Schritt B ausdrücklich nicht zulässig.

Anschließend Kataloggrenzen prüfen:

```sql
select
  has_table_privilege(
    'authenticated',
    'public.workspaces',
    'INSERT'
  ) as authenticated_can_insert_workspace,
  has_table_privilege(
    'authenticated',
    'public.workspaces',
    'UPDATE'
  ) as authenticated_has_table_update,
  has_column_privilege(
    'authenticated',
    'public.workspaces',
    'name',
    'UPDATE'
  ) as authenticated_can_update_name,
  has_column_privilege(
    'authenticated',
    'public.workspaces',
    'billing_status',
    'UPDATE'
  ) as authenticated_can_update_billing;
```

Erwartung:

- `authenticated_can_insert_workspace = false`
- `authenticated_has_table_update = false`
- `authenticated_can_update_name = true`
- `authenticated_can_update_billing = false`

Zusätzlich die vollständige effektive Spaltenmatrix aus dem Preflight erneut
ausführen. Exakt die zehn dokumentierten Spalten dürfen für `authenticated`
bei `UPDATE` `true` ergeben. `INSERT` muss für `authenticated` auf jeder
Spalte `false` sein; für `anon` müssen beide Rechte in jeder Zeile `false`
sein.

## Reale Abnahme

Mit einem normalen Owner-JWT kontrollieren:

- direkter `INSERT` und Upsert auf `workspaces` scheitern;
- `owner_user_id`, Plan, Commercial Option, Preise, Billing-, Stripe-,
  Invoice-, Subscription- und `test_access_flags`-Felder scheitern einzeln;
- ein gemischtes PATCH aus `name` und `billing_status` scheitert atomar;
- fremde Workspace-Stammdaten bleiben trotz erlaubter Spalte unänderbar;
- `anon`, normale Mitglieder, Admins und Manager können Workspace-Stammdaten
  nicht direkt schreiben;
- Owner können alle zehn erlaubten Spalten weiterhin ändern.

Mit Service Role kontrollieren:

- Stripe-Webhook kann geschützte Felder aktualisieren;
- derselbe Webhook lehnt feste und temporäre Demo-Workspaces vor jedem PATCH
  und vor der Referral-Synchronisierung ab, auch wenn ein altes Stripe-Objekt
  den Workspace direkt per `workspace_id`/`client_reference_id` adressiert.
  Die Ablehnung stützt sich bereits vor Schritt B ausschließlich auf die
  serverseitige Auth-E-Mail der festen Demo beziehungsweise eine
  `demo_start_sessions`-Zuordnung; die bis Schritt B noch owner-veränderbaren
  Status-, Commercial- und Testflag-Felder sind kein alleiniger
  Ablehnungsgrund;
- ein bewusst abgelehntes Demo-Ziel und ein durch `manual_suspended`
  abgewehrtes Update werden ohne Referral-Synchronisierung bestätigt. Ein
  Nullzeilen-PATCH gilt dabei erst dann als bewusster Block, wenn eine
  nachgelagerte Service-Role-Abfrage exakt denselben Workspace mit
  `billing_status = manual_suspended` bestätigt; fehlende Zeile, `NULL`,
  anderer Status oder Lesefehler bleiben retry-fail-closed;
- nicht verfügbare Stripe-Referenz-, Workspace-, Demo-Session- oder
  Auth-Prüfungen, ungültige Guard-Antworten und fehlgeschlagene
  beziehungsweise uneindeutige PATCHes erzeugen einen Fehlerstatus, damit
  Stripe das Event wiederholt; nur sauber bestätigte Nulltreffer aller
  vorhandenen Stripe-Referenzen gelten als „nicht zugeordnet“. Doppelte
  Referenzzeilen und widersprüchliche Customer-, Subscription- oder
  Payment-Intent-Zuordnungen scheitern ebenfalls retry-fail-closed;
- ein erfolgreicher Billing-PATCH muss exakt die erwartete Workspace-ID
  zurückgeben, bevor die Referral-Synchronisierung beginnt;
- Admin-Billing und interne Testflags funktionieren;
- Kündigung und Rücknahme funktionieren;
- fester und temporärer Demo-Workspace funktionieren;
- Cleanup löscht eine umbenannte temporäre Demo weiterhin anhand der
  serverseitigen Session- und Marker-Identität;
- falls zuerst nur Workspace-Daten oder nur der Auth-User gelöscht wurden,
  beendet ein Wiederholungslauf die jeweils verbliebene Hälfte sicher über
  dieselbe serverseitige Session-Zuordnung.
- Ein Abbruch direkt nach Auth-Anlage sowie ein Fehler nach Workspace-Anlage
  hinterlassen eine Reservation mit Resource-ID und werden nach Ablauf
  gelöscht.
- Einen Testdatensatz in `cleanup_pending` mit mehr als 15 Minuten altem
  `cleanup_started_at` kann genau ein Worker erneut beanspruchen; ein frischer
  Lease bleibt unangetastet.

Regex-Unit-Tests im Repository ersetzen diese Datenbankabnahme nicht. Vor
Production-Schritt B sind echte Transaktionen gegen eine isolierte
Supabase-/PostgreSQL-Instanz sowie danach dieselben read-only Katalognachweise
in Production verpflichtend.

## Rollback

Die sichere App-Rollback-Grenze ist der erste RPC-kompatible Commit. Nicht auf
einen älteren Direktinsert-Stand zurückrollen, nachdem Schritt B angewendet
wurde.

Die additive Migration muss für einen App-Rollback nicht entfernt werden. Ein
erneutes breites `GRANT INSERT, UPDATE TO authenticated` würde die
Sicherheitslücke wieder öffnen und ist kein normaler Rollback. Falls der
Contract einen legitimen Pfad blockiert, den betroffenen serverseitigen Pfad
korrigieren und ausschließlich die konkret erforderliche Spalte ergänzen.

Workspace- und Steuerstammdaten sind in App und RLS Owner-only. Persönliche
Profildaten bleiben für die bisher zugelassenen Workspace-Rollen separat
bearbeitbar. Eine spätere Mehrrollenfreigabe für Workspace-Felder benötigt
eine eigene Produkt- und Security-Entscheidung.

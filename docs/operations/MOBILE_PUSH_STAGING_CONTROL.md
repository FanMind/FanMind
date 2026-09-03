# Mobile Push Registration – kontrollierter Staging-Pfad

## Ziel und Status

Dieser Ablauf kontrolliert ausschließlich die vorbereitete Tabelle für eine
verschlüsselte Mobile-Push-Registrierung in einem getrennten FanMind-Staging.
Ein extern gemeldeter Stand von 45 Migrationen und 33 öffentlichen Tabellen
ist mit einer bereits vorhandenen Tabelle vereinbar, beweist aber weder den
exakten Ledger-Eintrag noch den vollständigen Objektvertrag. Vor einem Apply
muss deshalb der read-only Ablauf in
`STAGING_DATABASE_ROLLOUT_STATE.md` die Aktion `verify`, `skip`, `apply` oder
`block` ableiten. Eine echte Staging-Acceptance ist damit noch nicht belegt.

Die festgeschriebene Migration ist:

```text
supabase/migrations/20260729120000_mobile_push_registrations.sql
SHA-256: 1a22d71a09427bbf0093dfc12f6fbcaf76256d61728048390b1299c526bfd0d7
```

Der Ablauf:

- aktiviert keine Push-Zustellung;
- sendet keine Nachricht und ruft weder Expo, FCM noch APNs auf;
- verwendet keinen echten Expo-Push-Token;
- setzt keinen Push-Verschlüsselungsschlüssel;
- erstellt oder verändert keine EAS- oder Signing-Ressource;
- ist ausschließlich für das geschützte GitHub-Environment `staging`
  vorgesehen;
- kann durch einen normalen Web-Deploy nicht angewendet werden.

## Drei getrennte Kontrollen

### 1. Read-only Ressourcenprüfung

Workflow:

```text
FanMind Mobile Push Staging Resource Readiness
```

Datei:

```text
.github/workflows/mobile-push-staging-resource-readiness.yml
```

Bestätigung:

```text
verify-mobile-push-staging-resources
```

Der Workflow verlangt den exakten, manuell geprüften `main`-Commit und prüft
ohne Schema- oder Datenänderung:

- Runtime ist exakt `staging`;
- App-/API-Ursprung ist HTTPS, stimmt mit dem bestätigten Staging-Ziel überein
  und ist nicht `fanmind.ch`;
- Supabase-URL und explizite Staging-Projektreferenz stimmen überein und sind
  nicht die bestätigte Production-Projektreferenz;
- der verwendete DB-Host ist der bestätigte Staging-Host und nicht der
  bestätigte Production-DB-Host;
- direkte libpq-Umleitungen wie `PGHOSTADDR` oder `PGSERVICE` fehlen;
- ein synthetischer, nicht öffentlicher Demo-Workspace mit unterschiedlichem
  Owner und Mitglied existiert;
- beide Auth-Konten sind weder Sandra-Demo noch als temporärer Demo-Nutzer
  markiert;
- Workspace-, Owner-, Member-, EAS-Projekt- und synthetische Geräte-ID sind
  gültige, voneinander verschiedene UUIDs.

Die Prüfung verbindet sich read-only mit PostgreSQL. Sie liest weder die
Registrierungstabelle noch wendet sie die Migration an, damit sie bereits vor
dem ersten Apply laufen kann.

### 2. Expliziter Migrations-Apply

Workflow:

```text
FanMind Mobile Push Staging Migration
```

Datei:

```text
.github/workflows/mobile-push-staging-migration.yml
```

Bestätigung:

```text
apply-mobile-push-registration-migration
```

Der Apply besitzt eine eigene Freigabe und kann nur für denselben ausdrücklich
eingetragenen `main`-Commit gestartet werden. Vor der Datenbankverbindung
werden SHA-256 und SQL-Vertrag offline geprüft. Der Runner führt die bereits
transaktionale Migration aus und prüft anschließend read-only:

- Tabelle und 13 erwartete Spalten;
- aktiviertes RLS ohne Browser-Policy;
- keine Tabellen- oder Spaltenrechte für `anon` oder `authenticated`;
- ausschließlich `SELECT`, `INSERT`, `UPDATE` und `DELETE` für
  `service_role`;
- Constraints, kaskadierende Fremdschlüssel, partiellen Ablaufindex,
  Security-Invoker-Funktion und exakt den `updated_at`-Trigger.

SQL-Fehlerausgaben werden nicht in GitHub-Logs übernommen. Der Workflow meldet
nur stabile, redigierte Fehlercodes.

### 3. Rollback-only Acceptance

Workflow:

```text
FanMind Mobile Push Staging Acceptance
```

Datei:

```text
.github/workflows/mobile-push-staging-acceptance.yml
```

Bestätigung:

```text
run-mobile-push-staging-acceptance
```

Vor der Acceptance wird das angewendete Schema noch einmal read-only geprüft.
Danach führt der Acceptance-Runner ausschließlich synthetische Prüfungen aus:

1. Owner, Mitglied, Workspace, EAS-Projekt und Geräte-ID werden erneut
   fail-closed validiert.
2. Für `anon`, den synthetischen Owner und das synthetische Mitglied müssen
   `SELECT`, `INSERT`, `UPDATE` und `DELETE` jeweils scheitern.
3. Aus der synthetischen Geräte-ID werden zwei deterministische Testwerte
   erzeugt. Sie sind keine Expo-Push-Tokens und werden nie ausgegeben.
4. `service_role` führt für Owner und Mitglied innerhalb einer einzigen
   Transaktion Insert, Update und Delete aus.
5. Die Transaktion wird immer zurückgerollt.
6. Eine anschließende read-only Prüfung verlangt, dass weder die synthetischen
   User- noch die synthetischen Hash-Werte vorhanden sind.

Jeder unerwartete Browser-Erfolg, eine vorhandene Ausgangsregistrierung, ein
unvollständiger CRUD-Schritt oder ein fehlender Cleanup-Beleg lässt den Lauf
fehlschlagen. Bei einem vorzeitigen psql-Abbruch wird die offene Transaktion
durch das Schließen der Verbindung ebenfalls verworfen.

### 4. Delivery-Ledger rollback-only Acceptance

Erst nach einem separat genehmigten Delivery-Ledger-Apply darf der manuelle
Workflow `FanMind Mobile Push Delivery Ledger Staging Acceptance` mit dem
exakten aktuellen `main` und der Bestätigung
`run-mobile-push-delivery-ledger-acceptance` ausgeführt werden. Er prüft das
angewendete Ledger zunächst read-only und beweist danach mit ausschließlich
synthetischen Staging-Zeilen Reservation, Lease-Exklusivität,
Ticket-/Receipt-Lifecycle und atomare Registrierungsdeaktivierung. Sämtliche
Zeilen werden zurückgerollt und anschließend read-only als abwesend geprüft.
Expo-Zugang, echter Push-Token und Provideraufruf sind nicht Teil dieses
Workflows.

## Geschützte Staging-Konfiguration

Das GitHub-Environment `staging` benötigt zusätzlich zu den bestehenden
Staging-Zielen folgende Werte.

Variablen:

```text
FANMIND_STAGING_APP_URL
FANMIND_STAGING_SUPABASE_PROJECT_REF
FANMIND_PRODUCTION_SUPABASE_PROJECT_REF
FANMIND_STAGING_DB_PORT
FANMIND_STAGING_DB_NAME
FANMIND_MOBILE_PUSH_STAGING_WORKSPACE_ID
FANMIND_MOBILE_PUSH_STAGING_OWNER_USER_ID
FANMIND_MOBILE_PUSH_STAGING_MEMBER_USER_ID
FANMIND_MOBILE_PUSH_STAGING_EAS_PROJECT_ID
FANMIND_MOBILE_PUSH_STAGING_DEVICE_ID
```

Secrets:

```text
FANMIND_STAGING_SUPABASE_URL
FANMIND_STAGING_DB_HOST
FANMIND_STAGING_DB_USER
FANMIND_STAGING_DB_PASSWORD
```

Der nicht geheime Production-Vergleichshost wird aus der bereits gebundenen
Production-Projektreferenz als `db.<production-project-ref>.supabase.co`
abgeleitet. Es werden keine Production-DB-Zugangsdaten und kein separates
Production-DB-Host-Secret in Staging benötigt oder verwendet.

Jeder Workflow erzeugt eine eigene PGPASS-Datei im privaten Runner-Tempordner,
verlangt Modus `0600`, erstellt intern einen gegen Symlink- und Austauschangriffe
geschützten Snapshot und entfernt die Datei mit `always()`.

## Verbindliche Reihenfolge

1. getrenntes Staging und die synthetischen Ressourcen bereitstellen;
2. Read-only Ressourcenprüfung erfolgreich abschließen;
3. den exakten `main`-Commit erneut prüfen und den Apply separat freigeben;
4. Migrations-Postflight erfolgreich abschließen;
5. Rollback-only Acceptance separat freigeben und abschließen;
6. erst danach serverseitigen Verschlüsselungsschlüssel und freigegebene
   EAS-Projekt-ID im Staging konfigurieren;
7. reale Registrierung ausschließlich in einem signierten
   Development-/Preview-Build mit Testkonten abnehmen.

Eine echte Follow-up-Zustellung bleibt auch nach einem grünen Acceptance-Lauf
deaktiviert. Sie benötigt einen gesonderten, datenschutzgeprüften
Delivery-Baustein und eine neue Freigabe.

### 4. Delivery-Ledger Verify und separat freizugebender Apply

Der vorbereitete Ledger besitzt einen eigenen manuellen Workflow:

```text
FanMind Mobile Push Delivery Ledger Staging
.github/workflows/mobile-push-delivery-ledger-staging.yml
```

Für die read-only Prüfung sind `action=verify` und die Bestätigung
`verify-mobile-push-delivery-ledger-schema` erforderlich. Eine spätere
Installation verlangt stattdessen `action=apply` und die getrennte
Bestätigung `apply-mobile-push-delivery-ledger`. Beide Jobs sind an den
exakten aktuellen `main`-Commit, das geschützte Environment `staging`, die
bestätigte Staging-Datenbank und die Abweichung von allen Production-Zielen
gebunden. Der Apply verwendet ausschließlich den checksum-gepinnten SQL-Block
und muss unmittelbar danach den read-only Postflight bestehen: RLS aktiv,
keine Browser-Policies oder PUBLIC-/Browser-Rechte, genau drei RPCs,
Security Invoker, gepinnter `search_path` und ausschließlich die vorgesehenen
`service_role`-Rechte.

Der Workflow enthält keine Provider-Credentials und keinen Sendepfad. Seine
Existenz ist keine Apply-Freigabe; bis zu einem ausdrücklich autorisierten
geschützten Lauf bleibt der Ledger in Staging unangewendet.

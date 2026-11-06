# Dauerhafte synthetische Staging-Fixtures

## Zweck

Der manuelle Workflow `FanMind Staging Synthetic Fixture Provisioning` stellt
die kleinste wiederverwendbare Ressourcenbasis für bereits vorhandene
Abnahmewege bereit. Er erzeugt keine Kunden- oder Production-Daten und führt
keine Stripe-Zahlung aus.

Die Fixture besteht aus:

- zwei bestätigten, ausdrücklich synthetischen Login-Identitäten;
- zwei vollständig getrennten Workspaces mit je einem synthetischen Kontakt;
- einer dritten synthetischen Login-Identität als `member` des primären
  Workspace;
- dem Marker `staging_synthetic_fixture = true`;
- dem zusätzlichen Marker `workspace_processing_acceptance = true` nur am
  primären Workspace.

Damit kann derselbe primäre Workspace die bereits getrennt implementierten
Read-only-/Rollback-Gates bedienen:

- Browser-E2E und bidirektionale Kontakt-RLS;
- Workspace-Processing-Staging-Acceptance;
- AI-Tier-Staging-Resource-Readiness und rollback-only AI-Tier-Acceptance;
- spätere, weiterhin separat geschützte Billing-/Referral-Test-Mode-Abnahme.

Die sekundäre Login-Identität ist absichtlich **kein** Mitglied des primären
Workspace. Dadurch bleibt die Zwei-Wege-RLS-Negativgrenze erhalten.

## Vorhandene Bausteine, die wiederverwendet werden

Die Provisionierung erstellt Workspaces nicht über eine neue parallele
Geschäftslogik. Sie:

1. erstellt oder erkennt markierte Nutzer ausschließlich über Supabase Auth
   Admin auf dem Server;
2. meldet die beiden Login-Nutzer gegen Supabase Auth an;
3. ruft für beide die vorhandene RPC
   `public.ensure_current_user_workspace(...)` auf;
4. ergänzt Profile, den dritten Member, zwei Kontakte und die reinen
   Staging-Marker in einer kontrollierten PostgreSQL-Transaktion;
5. validiert Owner-/Member-/Kontaktgrenzen vor dem Commit.

Ein vorhandener Nutzer wird nur wiederverwendet, wenn seine Metadaten bereits
exakt den FanMind-Staging-Fixture-Marker und die aktuelle Fixture-Version
tragen. Ein gleichnamiges fremdes Konto stoppt fail-closed.

## Sicherheitsgrenzen

Der Workflow verlangt gleichzeitig:

- `main` und den exakten vollständig geprüften Commit;
- das geschützte GitHub-Environment `staging`;
- eine Staging-App-URL mit `staging` im Hostnamen;
- verschiedene Staging-/Production-Supabase-Projektreferenzen;
- `FANMIND_ENABLE_NON_PRODUCTION_WRITES=true` und
  `I_UNDERSTAND_NON_PRODUCTION_ONLY`;
- die Bestätigung `provision-staging-synthetic-fixtures`;
- den gemeinsamen read-only Datenbank-Rollout-State `PASS`;
- Supavisor Session-Pooler, Port `5432` und TLS `verify-full`;
- zwei unterschiedliche synthetische Owner-E-Mail-Adressen, die fest gebundene
  synthetische Member-Adresse und drei untereinander unterschiedliche
  Passwörter mit mindestens 20 Zeichen, Groß-/Kleinbuchstaben, Zahl und
  Sonderzeichen.

Opaque `sb_secret_...`-Keys werden gemäß gemeinsamer Supabase-Key-Policy nur
im `apikey`-Header transportiert. Weder Passwörter, API-Keys, Tokens noch
E-Mail-Adressen werden ausgegeben. Bei einem Fehler entfernt der Lauf nur die
in genau diesem Versuch neu erstellten markierten Auth-Nutzer; deren neu
erstellte abhängige Workspaces werden dadurch über die vorhandenen
Fremdschlüssel ebenfalls entfernt. Bereits vorhandene Fixture-Nutzer werden
nicht gelöscht.

## Einmalige GitHub-Konfiguration

Im Environment `staging` müssen vor dem Lauf zusätzlich zu den vorhandenen
Supabase-/DB-Werten diese fünf Secrets gesetzt sein:

```text
FANMIND_STAGING_E2E_EMAIL
FANMIND_STAGING_E2E_PASSWORD
FANMIND_STAGING_E2E_SECONDARY_EMAIL
FANMIND_STAGING_E2E_SECONDARY_PASSWORD
FANMIND_STAGING_E2E_MEMBER_PASSWORD
```

Beide E-Mail-Adressen müssen `staging`, `synthetic` oder `test` enthalten.
Die E-Mail-Adressen sind rein synthetisch; der Admin-Pfad bestätigt sie ohne
Versand einer Nachricht. Das Member-Konto verwendet die fest gebundene Adresse
`fanmind-ai-member-staging@example.invalid`. Alle drei Passwörter müssen
unterschiedlich sein und dürfen nicht in Issue, PR, Log oder Chat kopiert
werden.

Dieses Member-Secret gehört nur zum einmaligen oder ausdrücklich wiederholten
Provisionierungslauf. Die nachfolgende Core-/CSV-Abnahme liest es nicht mehr:
Sie erzeugt ein eigenes kurzlebiges Passwort im geschützten Hosted Runner,
rotiert ausschließlich das bereits markierte Member-Konto und setzt danach
ein neues unbekanntes Passwort. Der getrennte Vertrag ist unter
`docs/operations/STAGING_EPHEMERAL_MEMBER_CREDENTIAL.md` beschrieben.

## Kontrollierter Lauf

1. Code vollständig prüfen und nach `main` mergen.
2. Workflow `FanMind Staging Synthetic Fixture Provisioning` auswählen.
3. Branch `main` verwenden.
4. Exakten aktuellen `main`-Commit eintragen.
5. Bestätigung `provision-staging-synthetic-fixtures` eintragen.
6. Nur einen Lauf akzeptieren, der gemeinsam meldet:

   ```text
   STAGING_SYNTHETIC_FIXTURE_AUTH_USERS=3
   STAGING_SYNTHETIC_FIXTURE_WORKSPACES=2
   STAGING_SYNTHETIC_FIXTURE_CONTACTS=2
   STAGING_SYNTHETIC_FIXTURE_SECRETS_OUTPUT=0
   STAGING_SYNTHETIC_FIXTURE=PASS
   ```

Der Lauf gibt zusätzlich sechs nicht geheime UUID-Zuordnungen aus. Diese
Werte anschließend als Environment-Variablen unter exakt denselben Namen
übernehmen:

```text
FANMIND_STAGING_E2E_WORKSPACE_ID
FANMIND_STAGING_E2E_CONTACT_ID
FANMIND_STAGING_E2E_SECONDARY_WORKSPACE_ID
FANMIND_STAGING_E2E_SECONDARY_CONTACT_ID
FANMIND_AI_TIER_STAGING_WORKSPACE_ID
FANMIND_WORKSPACE_PROCESSING_STAGING_WORKSPACE_ID
```

Die letzten beiden Workspace-Variablen zeigen absichtlich auf denselben
primären synthetischen Workspace. Das ist eine kontrollierte Wiederverwendung,
keine Vermischung mit Production oder Kundendaten.

## Danach

Erst nach gesetzten UUID-Variablen werden die vorhandenen Workflows in dieser
Reihenfolge ausgeführt:

1. `FanMind Browser E2E Staging Read-only`;
2. `FanMind Staging Core and CSV Acceptance`;
3. `FanMind Workspace Processing Staging Acceptance`;
4. `FanMind AI Tier Staging Resource Readiness`;
5. `FanMind AI Tier Staging Acceptance`.

Jeder dieser Läufe behält seinen eigenen Bestätigungs-, Commit- und
Write-/Rollback-Vertrag. Die Fixture-Provisionierung selbst aktiviert weder
KI Plus/Ultra noch Production-Billing.

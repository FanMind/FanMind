# Meta Content Intelligence: kontrollierte Staging-Migration

## Zweck und harte Grenze

Dieser Kontrollpfad prüft zuerst die getrennten Staging-Ressourcen strikt
read-only und wendet erst in einem zweiten, separat bestätigten Workflow
ausschließlich die drei festgeschriebenen Schema-Schritte

- `20260803120000_meta_content_intelligence_foundation.sql`
- `20260803210000_preserve_incremental_conversation_history.sql`
- `20260806160000_meta_webhook_external_id_idempotency.sql` aus
  `supabase/controlled/`

auf ein getrenntes Supabase-Staging an. Ein normaler Web-Deploy ruft den
Runner nicht auf. Der Pfad verbindet kein Meta-Konto, startet keine Analyse,
reicht keinen App Review ein und verändert Production nicht.

## Sicherheitsvertrag

Der Runner arbeitet fail-closed und verlangt gleichzeitig:

- `refs/heads/main` und einen exakt übereinstimmenden, 40-stelligen
  `reviewed_commit`;
- Runtime `staging`, HTTPS-Staging-Origin und ein Supabase-Projekt, dessen
  Referenz eindeutig von Production abweicht;
- direkten libpq-Zugriff auf den bestätigten Staging-Host; Connection-URLs,
  `PGHOSTADDR`, Services und andere Zielumleitungen sind gesperrt;
- den IPv4-kompatiblen Supabase-Supavisor-Session-Pooler auf Port `5432`;
  direkte `db.<project-ref>.supabase.co`-Verbindungen und der
  Transaction-Pooler-Port `6543` sind für diesen GitHub-Hosted-Lauf gesperrt;
- den Datenbankbenutzer `postgres.<staging-project-ref>`, der im Workflow
  ausschließlich aus der getrennten Staging-Projektreferenz abgeleitet wird;
- TLS mit `PGSSLMODE=verify-full` und absolutem CA-Pfad;
- ein absolutes, reguläres, eigentümergeführtes `PGPASSFILE` mit Modus `0600`;
- die getrennten Bestätigungen
  `I_UNDERSTAND_NON_PRODUCTION_ONLY` und
  `apply-meta-content-intelligence-migrations`;
- bytegenaue SHA-256-Prüfung aller drei unveränderten SQL-Dateien.

Der Apply läuft als eine Datenbanktransaktion. Wenn der vollständige
Read-only-Postflight bereits besteht, meldet ein Wiederholungslauf
`META_CONTENT_MIGRATION_APPLY=already_current` und wendet die nicht vollständig
idempotenten SQL-Dateien nicht erneut an. Ein teilweise vorhandenes oder
abweichendes Schema wird nicht repariert oder überschrieben, sondern mit
`existing_schema_invalid` blockiert. Ein vollständig gültiger Stand der ersten
beiden Schritte wird als `foundation` erkannt und darf ausschließlich um den
dritten, kontrollierten Idempotenzschritt ergänzt werden.

## GitHub-Environment `staging`

Vor dem ersten Lauf müssen geschützt und getrennt von Production vorhanden
sein:

| Typ | Name |
| --- | --- |
| Variable | `FANMIND_STAGING_APP_URL` |
| Variable | `FANMIND_STAGING_SUPABASE_PROJECT_REF` |
| Variable | `FANMIND_PRODUCTION_SUPABASE_PROJECT_REF` |
| Variable | `FANMIND_STAGING_DB_PORT` |
| Variable | `FANMIND_STAGING_DB_NAME` |
| Secret | `FANMIND_STAGING_SUPABASE_URL` |
| Secret | `FANMIND_STAGING_DB_HOST` |
| Secret | `FANMIND_STAGING_DB_PASSWORD` |

`FANMIND_STAGING_DB_HOST` muss der Supabase-Supavisor-Session-Pooler sein,
`FANMIND_STAGING_DB_PORT` muss `5432` enthalten. `PGUSER` wird nicht als Secret
übernommen, sondern fest als `postgres.<FANMIND_STAGING_SUPABASE_PROJECT_REF>`
gebildet. Diese Staging-Datenbankidentität muss für den späteren Apply die
vorgesehenen DDL-Rechte besitzen. Sie darf nicht dieselbe Projektidentität wie
Production sein. Ein regionaler Supavisor-Pooler-Hostname kann zwischen
Projekten geteilt sein; deshalb sind die getrennte Projektreferenz und der
projektqualifizierte Benutzer die verbindliche Zielgrenze. Repository-Secrets
und Secretwerte dürfen nicht in Logs oder Screenshots übernommen werden.
Der nicht geheime Production-Vergleichshost wird im Workflow aus
`FANMIND_PRODUCTION_SUPABASE_PROJECT_REF` als kanonischer direkter Host
`db.<production-project-ref>.supabase.co` abgeleitet. Dafür werden weder ein
Production-DB-Host-Secret noch Production-Zugangsdaten benötigt.
Für `PGSSLMODE=verify-full` wird die review- und fingerprint-gebundene
öffentliche Provider-CA aus
`config/certificates/supabase-root-2021-ca.crt` verwendet. Der allgemeine
Ubuntu-CA-Speicher allein reicht für die private Supabase-Root-CA nicht aus.

## Ablauf

1. Den zu prüfenden Commit vollständig nach `main` mergen und seine SHA
   festhalten.
2. Lokal oder in CI nur die unveränderliche Offline-Prüfung ausführen:

   ```bash
   npm run db:meta-content:check
   ```

3. Den manuellen Workflow `FanMind Meta Content Staging Resource Readiness`
   auf `main` starten.
4. Als `reviewed_commit` exakt die SHA aus Schritt 1 und als Bestätigung exakt
   `verify-meta-content-staging-resources` eintragen.
5. Nur einen read-only Lauf akzeptieren, der gemeinsam
   `META_CONTENT_STAGING_RESOURCES=PASS`,
   `META_CONTENT_MIGRATION_APPLY=not_requested` und
   `META_CONTENT_ANALYSIS_ACTIVATION=disabled` meldet. Ein vollständig
   fehlendes Schema wird als `META_CONTENT_STAGING_SCHEMA=absent`, ein bereits
   vollständig gültiges Schema als `current` gemeldet. Eine gültige Basis ohne
   die beiden Meta-ID-Indizes wird als `upgrade_required` gemeldet; partielle
   oder driftende Zustände schlagen fehl.
6. Erst danach den manuellen Workflow `FanMind Meta Content Staging Migration`
   auf `main` starten.
7. Als `reviewed_commit` erneut exakt dieselbe SHA eintragen.
8. Als Bestätigung exakt
   `apply-meta-content-intelligence-migrations` eintragen.
9. Nur einen Lauf akzeptieren, dessen redigierte Ausgabe gemeinsam zeigt:

   - dreimal `META_CONTENT_MIGRATION_CHECKSUM=verified`;
   - `META_CONTENT_MIGRATION_APPLY=completed` oder bei belegtem
     Wiederholungslauf `META_CONTENT_MIGRATION_APPLY=already_current`;
   - `META_CONTENT_MIGRATION_POSTFLIGHT=PASS`;
   - `META_CONTENT_ANALYSIS_ACTIVATION=disabled`;
   - `SECRETS_WURDEN_NICHT_AUSGEGEBEN=true`.

Der Postflight liest nur Metadaten. Er prüft unter anderem Tabellen, RLS,
SELECT als einzige erlaubende Browser-Policy, Tabellen- und Spaltenrechte, den Ausschluss des
verschlüsselten Page-Tokens, Service-Role-Zugriff, eindeutige Kontoindizes,
workspace- und plattformgebundene eindeutige Meta-Message-/Comment-IDs,
50/100/150-Kontextbedingungen und die Entfernung des alten 50-Nachrichten-
Löschtriggers.

Die spätere Workspace-Member-Datengrenze darf zusätzlich ausschließlich die
erwarteten restriktiven Owner-Policies für INSERT, UPDATE und DELETE an
`authenticated` ergänzen. Restriktive Policies gewähren selbst keinen Zugriff.
Erlaubende Schreibpolicies, unbekannte Schreibpolicies, FOR ALL und
Browser-Schreibrechte bleiben verboten. Die gemeinsame Rollout-Prüfung
verifiziert den Member-Vertrag weiterhin unabhängig.

## Danach weiterhin offen

Ein bestandener Apply ist nur der Schema-Nachweis. Vor einem Pilot bleiben
mindestens synthetische Owner-/Member-/Fremdworkspace-Negativtests,
OAuth/Webhook-Ende-zu-Ende-Test, 150er-Erstabruf und inkrementeller Sync,
Export/Löschung/Widerruf, Meta App Review sowie das rechtliche Aktivierungsgate
offen. Production-Migration und globale Aktivierung benötigen einen eigenen,
später ausdrücklich freigegebenen Ablauf.

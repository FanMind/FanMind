# Staging-Datenbank: read-only Rollout-Zustand

## Zweck und harte Grenze

Der manuelle Workflow `FanMind Staging Database Rollout State` entscheidet
vor einem kontrollierten Datenbankschritt ausschließlich read-only, welcher
nächste Zustand für die bereits vorhandenen Kontrollpfade sicher ist:

- KI-Stufen-Entitlements;
- Mobile-Push-Registrierungen;
- die kontrollierte Workspace-Member-Datengrenze;
- die kontrollierte, weiterhin deaktivierte WhatsApp-Cloud-Inbound-Grundlage;
- Meta Content Intelligence plus inkrementelle Conversation-Historie;
- die kontrollierte Meta Conversation Catch-up Queue;
- die kontrollierte Meta Conversation Continuation;
- Triggerfunktions-Härtung, sobald ihr kontrollierter Pfad auf `main`
  vorhanden ist.

Der Zustandscheck führt keine Migration und kein `supabase db push` aus,
repariert keinen Migrationsledger und verändert weder Schema noch Daten. Seine
Ausgabe enthält keine Projekt-, Workspace-, Nutzer-, Stripe-, Host- oder
sonstigen Ressourcen-IDs.

## Warum Ledger und Objekte getrennt geprüft werden

Supabase CLI vergleicht bei einem generischen `db push` die Zeitstempel unter
`supabase/migrations/` mit
`supabase_migrations.schema_migrations`. Die kontrollierten FanMind-Runner
führen ihre festgeschriebenen SQL-Dateien dagegen direkt mit `psql` aus. Ein
vollständig gültiges Objekt kann deshalb existieren, obwohl sein Zeitstempel
im Ledger fehlt.

Der Zustandscheck verbindet deshalb zwei unabhängige Nachweise:

1. die exakten fünf Migrationszeitstempel im Supabase-Ledger, einschließlich
   `20260811220000_meta_conversation_sync_continuation`;
2. die bereits bestehenden vollständigen Metadaten-Postflights der
   ledger- und controlled-geführten Pfade.

Der kontrollierte Meta-Idempotency-Schritt liegt unter
`supabase/controlled/` und ist kein Supabase-Ledger-Eintrag. Er wird niemals
als Version aus `schema_migrations` gelesen. Sein Vorhandensein fließt
ausschließlich über den wiederverwendeten vollständigen Meta-Objekt-Postflight
in `installed` ein. Sind beide ledger-geführten Meta-Foundation-Schritte
gültig, aber der kontrollierte Idempotency-Schritt fehlt, lautet die sichere
Aktion `apply` für den separaten Meta-Spezialrunner.

Dateiname, Inhalt und SHA-256 werden zusätzlich offline durch die vorhandenen
Runner festgeschrieben. Ein Tabellenname allein gilt niemals als gültiger
Migrationsnachweis.

Auch die Catch-up Queue liegt unter `supabase/controlled/` und besitzt keinen
Ledger-Eintrag. Ihr vollständiger Queue-Postflight entscheidet deshalb direkt:
`absent` ergibt `apply`, ein vollständig gültiger Zustand `verify` und jeder
partielle oder abweichende Zustand `block`.

Die Conversation Continuation liegt dagegen unter `supabase/migrations/` und
ist ledger-geführt. Der Zustandscheck kombiniert ihren exakten Zeitstempel
`20260811220000` mit dem vollständigen Spalten-/Constraint-/ACL-Postflight:
gemeinsam abwesend ergibt `apply`, gemeinsam vorhanden `verify`, vorhandene
Objekte bei fehlendem Ledger `skip` und ein Ledger-Eintrag bei fehlenden oder
ungültigen Objekten `block`. Damit wird weder aus Objektpräsenz ein Apply
behauptet noch bei einem Ledger-/Objektwiderspruch erneut angewendet.

Dasselbe Prinzip gilt für die Workspace-Member-Datengrenze. Nur gemeinsam
abwesende drei Funktionen und null der 42 benannten Boundary-Policies ergeben
`apply`. Exakt drei Funktionen plus 42 Policies werden erst nach dem
vollständigen Funktions-, Policy-, ACL- und Verhaltenspostflight zu `verify`.
Jeder Teilzustand ergibt `block`. Der Ledger wird dabei nur auf den exakten
server-owned-Prerequisite-Beleg
`20260809141141 / workspace_server_owned_columns_controlled` und auf das
verbotene Vorhandensein des Boundary-Controls im generischen Ledger geprüft.

Die WhatsApp-Cloud-Inbound-Grundlage liegt ebenfalls ausschließlich unter
`supabase/controlled/`. Ihr eindeutiger späterer Control-Zeitstempel
`20260817230000` darf nie im generischen Ledger stehen. Sie setzt die
Workspace-Member-Datengrenze hart voraus: solange die Member-Boundary fehlt,
ist nur der gemeinsam abwesende WhatsApp-Zustand als `skip` zulässig. Erst eine
vollständig verifizierte Member-Boundary erlaubt für WhatsApp `apply` bei exakt
elf abwesenden benannten Objekten, drei abwesenden WhatsApp-Spalten, zwei
abwesenden Message-Constraints, zwei abwesenden Identity-Policies, vier
abwesenden Funktionsnamen und keinem Legacy-Index. `verify` ist nur nach dem
vollständigen exakten Postflight zulässig: Spaltennamen, Typen, Nullbarkeit und
Defaults; Constraints, zusammengesetzte Foreign Keys und Löschaktionen;
Indexspalten und partielle Prädikate; Policy-Modus und -Ausdrücke; Tabellen-
und Funktions-ACLs ohne unerwartetes `EXECUTE`; exakter
`workspace_processing_allowed_contract`; Funktionssignaturen und -Bodies sowie
Verhalten für Processing und `trusted_demo`. Katalog-Attestierungen binden die
kanonischen Definitionen und lassen auch gleichnamig neu angelegte
`CHECK (true)`- oder Prädikat-Drifts scheitern. Die Message-/Receipt-Identity
ist dabei Connection + `phone_number_id` + WAMID und der Receipt bindet den
SHA-256-Fingerprint des exakt normalisierten Payloads. Jeder Teilzustand, ein
Legacy-Index oder ein vor Member vorhandenes WhatsApp-Objekt ergibt `block`.

Diese Zustandslogik ist nur vorbereitet. Für WhatsApp wurde weder ein
Datenbank-Apply noch ein realer Staging-/Meta-Providerlauf ausgeführt; Route,
Feature-Flag und Connector bleiben dormant. Der read-only Zustandscheck enthält
keine Provider-, Outbound- oder Dispatch-Logik und Production ist als Ziel
verboten.

## Ausschließlich mögliche Aktionen

| Aktion | Bedeutung |
| --- | --- |
| `verify` | Ledger und vollständiger Objekt-Postflight stimmen überein. Nicht erneut anwenden; mit der dokumentierten Acceptance fortfahren. |
| `skip` | Vollständiger Objekt-Postflight ist grün, aber der Ledger-Eintrag fehlt, oder der optionale Kontrollpfad ist auf diesem Commit noch nicht vorhanden. Keine Migration erneut anwenden und niemals durch einen generischen Push „angleichen“. |
| `apply` | Ledger-Eintrag und verwaltetes Objekt fehlen gemeinsam. Nur der separate, bereits dokumentierte Spezialrunner darf nach eigener Freigabe angewendet werden. |
| `block` | Ledger, Objektzustand, Teilmigration oder Postflight widersprechen sich. Keine Datenbankaktion starten. |

Für Meta müssen Foundation und History im Ledger beide vorhanden oder beide
abwesend sein. Ein einzelner Eintrag, ein partielles Schema oder ein roter
Postflight ergibt immer `block`. Die getrennte Continuation verwendet zusätzlich
ihren eigenen exakten Ledger-/Objektentscheid; die kontrollierte Catch-up Queue
bleibt absichtlich ledgerfrei.

Für bereits angelegte KI-Stufen- oder Mobile-Push-Tabellen entfernt die
Migration
`20260812162000_restrict_service_role_table_privileges.sql` ausschließlich die
durch Supabase-Default-Privileges zusätzlich entstandenen Rechte `TRUNCATE`,
`REFERENCES` und `TRIGGER`. Die benötigten CRUD-Rechte bleiben erhalten; die
Migration verändert keine Zeile und überspringt noch nicht vorhandene Tabellen.

## Gemeldeter 45er-Staging-Stand

Am 6. August 2026 wurde extern ein read-only Stand von 45 Migrationen und 33
öffentlichen Tabellen gemeldet. Diese beiden Anzahlen sind mit einem Zustand
bis einschließlich KI-Stufen- und Mobile-Push-Migration vereinbar. Sie
beweisen jedoch weder die exakten Ledger-Zeitstempel noch die vollständigen
RLS-, Rechte-, Constraint-, Index-, Funktions- und Triggerverträge.

Deshalb gilt erst die Ausgabe dieses Workflows als Handlungsgrundlage. Wenn
die exakten Ledger-Einträge und beide Objekt-Postflights passen, werden KI und
Mobile als `verify` ausgegeben. Wenn Meta gleichzeitig vollständig fehlt,
wird Meta als `apply` ausgegeben. Jede Abweichung blockiert statt aus der
Zahl `45` eine Anwendung abzuleiten.

## Geschützter Workflow

Workflow:

```text
FanMind Staging Database Rollout State
```

Bestätigung:

```text
verify-staging-database-rollout-state
```

Erforderlich sind:

- `github.ref == refs/heads/main`;
- ein 40-stelliger `reviewed_commit`, der exakt `github.sha` entspricht;
- das geschützte GitHub-Environment `staging`;
- von Production verschiedene Supabase-Projektreferenzen;
- der IPv4-kompatible Session-Pooler auf Port `5432`;
- der aus der Staging-Projektreferenz abgeleitete Benutzer
  `postgres.<staging-project-ref>`;
- `PGSSLMODE=verify-full` mit dem review- und fingerprint-gebundenen
  `config/certificates/supabase-root-2021-ca.crt` statt nur dem
  Betriebssystem-CA-Speicher;
- eine private, eigentümergeführte `PGPASSFILE` mit Modus `0600`;
- `FANMIND_ENABLE_NON_PRODUCTION_WRITES=false` und ein leerer Write-Acknowledge;
- keine Connection-URL, kein `PGHOSTADDR`, kein libpq-Service und keine
  alternative Client-Zertifikatsumleitung.

Regionale Supavisor-Session-Pooler können von Staging und Production geteilt
werden. Die tatsächliche Projektbindung entsteht deshalb aus Supabase-URL,
expliziter Projektreferenz und projektqualifiziertem Datenbankbenutzer. Der
Production-DB-Host muss als Vergleichswert vorhanden sein, ist aber kein
ausreichender Projektidentifikator.

Scheitert eine Pflichtabfrage, nennt
`STAGING_DATABASE_ROLLOUT_STATE_PROBE_FAILURE` nur den festen Prüfschritt und
eine allowlist-basierte Fehlerkategorie. Der rohe `psql`-Fehler bleibt
unterdrückt; Host, Nutzer, Projekt-Referenz und Passwort gelangen nicht ins
Workflow-Log.

## Sichere Reihenfolge nach der Ausgabe

1. Bei irgendeinem `block` stoppen und Drift separat untersuchen.
2. Für `verify` keinen Apply starten; den vorhandenen read-only Verify und
   danach gegebenenfalls die rollback-only Acceptance verwenden.
3. Für `skip` weder Spezialrunner noch generischen Push starten. Eine
   Ledger-Reparatur ist eine eigene schreibende Änderung und liegt außerhalb
   dieses Workflows.
4. Für `apply` zuerst den zugehörigen Resource-Readiness-Workflow abnehmen und
   danach ausschließlich den getrennten checksum- und commitgebundenen
   Migrationsworkflow freigeben. Der Queue-Apply verlangt zusätzlich aus
   demselben Lauf exakt `STAGING_DATABASE_ROLLOUT_META_CATCHUP=apply`.
   Die Member-Datengrenze verlangt zusätzlich den app-first deployten exakten
   Commit und ihren getrennten Apply-/Verify-/Chromium-Ablauf.
   WhatsApp darf erst nach `WORKSPACE_MEMBER_BOUNDARY=verify` angewendet werden
   und verlangt im selben read-only Lauf exakt
   `STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=apply`; danach muss der
   getrennte Verify-Lauf `...=verify` melden. Dieser Schema-Schritt aktiviert
   weder Route noch Feature-Flag und führt keinen Provider-Dispatch aus.
5. Datenbank-Schreibworkflows nie parallel ausführen.
6. Meta Foundation und History immer gemeinsam und atomar anwenden.
7. Trigger-Hardening vorzugsweise nach Meta ausführen; dann ist die alte
   optionale 50-Nachrichten-Retention-Funktion bereits entfernt.

Erlaubte Ergebniszeilen:

```text
STAGING_DATABASE_ROLLOUT_WORKSPACE_MEMBER_BOUNDARY=verify|apply|block
STAGING_DATABASE_ROLLOUT_WHATSAPP_CLOUD_INBOUND=verify|skip|apply|block
STAGING_DATABASE_ROLLOUT_AI_TIER=verify|skip|apply|block
STAGING_DATABASE_ROLLOUT_MOBILE_PUSH=verify|skip|apply|block
STAGING_DATABASE_ROLLOUT_META_CONTENT=verify|skip|apply|block
STAGING_DATABASE_ROLLOUT_META_CATCHUP=verify|apply|block
STAGING_DATABASE_ROLLOUT_META_CONTINUATION=verify|skip|apply|block
STAGING_DATABASE_ROLLOUT_TRIGGER_HARDENING=verify|skip|apply|block
STAGING_DATABASE_ROLLOUT_GENERIC_MIGRATION=disabled
STAGING_DATABASE_ROLLOUT_STATE=PASS|BLOCKED
SECRETS_WURDEN_NICHT_AUSGEGEBEN=true
```

`PASS` bedeutet nur, dass ein widerspruchsfreier nächster Schritt abgeleitet
wurde. Es bedeutet nicht, dass eine Migration, Staging-Acceptance,
Production-Freigabe oder Produktaktivierung abgeschlossen ist.

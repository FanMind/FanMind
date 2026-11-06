# Kontrollierter Rollout der KI-Prompt-Einstellungen

Diese Anleitung gilt ausschließlich für die additive Migration
`20260726213000_workspace_ai_prompt_settings.sql`. Merge und Web-Deploy führen
keine automatische Production-Migration aus. Fehlt die Tabelle, bleibt die
bestehende Antwortgenerierung funktionsfähig und fällt ohne
Workspace-Unternehmens-Prompt zurück.

## Sicherheitsmodell

Der Runner arbeitet in drei Modi:

1. `npm run db:ai-prompts:check` prüft offline den festgeschriebenen SHA-256
   und die wesentlichen SQL-, RLS- und Rechteverträge. Das ist der Default.
2. `npm run db:ai-prompts:verify` führt ausschließlich einen
   `READ ONLY`-Postflight gegen das explizit gebundene Ziel aus.
3. `npm run db:ai-prompts:apply` wendet genau die festgeschriebene Migration
   an und verlangt danach denselben Postflight.

Die Datenbankverbindung wird nicht als URL oder Prozessargument übergeben.
Der Runner verlangt `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` und eine
reguläre, eigentümergeführte `PGPASSFILE` mit Modus `0600`. Er erstellt davon
für den Lauf einen privaten Snapshot und entfernt ihn anschließend.
`PGHOSTADDR`, `PGSERVICE`, `PGSERVICEFILE` und `PGSYSCONFDIR` sind gesperrt.

## Vorbereitung

Vor einem Production-Lauf:

1. `main` muss den geprüften KI-Prompt-Code enthalten und Production muss
   gesund sein.
2. Aktuelles Datenbank-Backup und dessen Verifikation müssen vorliegen.
3. Das genaue Production-Supabase-Projekt und der Datenbankhost müssen aus
   zwei unabhängig geprüften Quellen bestätigt werden.
4. Ein Change-Ticket oder ein gleichwertiger interner Freigabeverweis muss
   vorhanden sein.
5. `psql` muss installiert sein.

Beispielvariablen – Werte niemals in Shell-Historie, GitHub-Kommentare oder
Artefakte kopieren:

```bash
export FANMIND_RUNTIME_ENVIRONMENT=production
export NEXT_PUBLIC_SUPABASE_URL=https://<PRODUCTION_PROJECT_REF>.supabase.co
export FANMIND_TARGET_SUPABASE_PROJECT_REF=<PRODUCTION_PROJECT_REF>
export FANMIND_PRODUCTION_SUPABASE_PROJECT_REF=<PRODUCTION_PROJECT_REF>
export FANMIND_TARGET_DB_HOST=<EXPECTED_DATABASE_HOST>
export PGHOST=<EXPECTED_DATABASE_HOST>
export PGPORT=5432
export PGDATABASE=postgres
export PGUSER=<DATABASE_USER>
export PGPASSFILE=<ABSOLUTE_PRIVATE_PASSFILE>
export FANMIND_PRODUCTION_CHANGE_TICKET=<APPROVED_CHANGE_REFERENCE>
```

## Ausführung

Zuerst immer die lokale Vertragsprüfung:

```bash
npm run db:ai-prompts:check
```

Die Anwendung erfordert zusätzlich die exakte, absichtlich lange Bestätigung:

```bash
export FANMIND_AI_PROMPT_MIGRATION_CONFIRM=apply-workspace-ai-prompt-settings
npm run db:ai-prompts:apply
```

Erfolgreich ist der Datenbankschritt nur, wenn abschließend erscheint:

```text
AI_PROMPT_MIGRATION_POSTFLIGHT=PASS
```

Der Postflight liest keine Prompt- oder Kundendaten. Er prüft Tabelle, RLS,
Mitglieder-Select-Policy, Rollenrechte, drei Größen-/Typ-Constraints,
`updated_at`-Trigger und die nicht privilegierte Triggerfunktion.

## Funktionale Abnahme mit synthetischen Inhalten

1. Als Workspace-Owner `Einstellungen → KI-Nutzung` öffnen.
2. Einen synthetischen Unternehmens-Prompt und zwei synthetische Profile
   speichern, davon genau eines als Standard.
3. Seite neu laden und gespeicherte Werte prüfen.
4. Als normales Mitglied prüfen: Einstellungen und aktive Profile lesen,
   aber nicht bearbeiten.
5. Einen Antwortvorschlag mit Standardprofil und einen mit dem zweiten Profil
   erzeugen. Beide bleiben Entwürfe; es erfolgt kein automatisches Senden.
6. Prompttexte dürfen nicht in KI-Usage-Logs oder technischen Fehlerausgaben
   erscheinen.

## Fehler und Rückfall

- Vor `AI_PROMPT_MIGRATION_APPLY=completed`: Ursache beheben, nichts als
  angewendet markieren.
- Nach erfolgreicher Anwendung, aber fehlgeschlagenem Postflight: keine
  UI-Abnahme durchführen; Rechte, Policy, Trigger und Constraints direkt in
  Supabase prüfen.
- Die Migration ist additiv und idempotent. Kein automatisches `DROP TABLE`
  als Rollback ausführen. Bei einem Problem bleibt die bestehende
  Antwortgenerierung durch ihren sicheren Fallback funktionsfähig; die
  Promptverwaltung wird bis zur Korrektur nicht freigegeben.

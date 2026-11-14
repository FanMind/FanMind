# Monatliches Production-Update: Vorbereitung und offene Gesamtprobe

Stand: 14. November 2026. Auftrag: ein gebündeltes Monatsupdate, höchstens
60 Minuten vom tatsächlichen Releasebeginn bis Abschluss oder kontrolliertem
Abbruch. Entwicklung, Staging-Abnahme und Paketvorbereitung liegen davor.
Kein kalendergesteuertes Production-Deployment. Jeder Release braucht eine
ausdrückliche Owner-Freigabe für sein genaues Paket und den bestehenden
geschützten Production-Weg.

**Status: Quellcodevorbereitung, noch keine betriebliche Gesamtabnahme.**
Der neue Vorbereitungsschritt deployt nichts. Seine Prüfsumme bestätigt
Paketidentität, keine Echtheit externer Betriebsnachweise und keine Freigabe.
Das 60-Minuten-Ziel ist noch nicht als vollständiges Verfahren nachgewiesen.

## Bestandsanalyse am Main bbe29a0924448330159996de8591f6654d493b3a

| Bestehender Baustein | Tatsächlich im geprüften Quellcode | Konsequenz |
| --- | --- | --- |
| `deploy-fanmind.yml` | Manueller Dispatch, aktueller geschützter Main, feste Owner-ID, gemergter PR und vollständige Main-/PR-Checks | Bestehender einziger Production-Einstieg bleibt erhalten; Merge deployt nicht |
| Production-Lock | `fanmind-production-deploy`, `cancel-in-progress: false`, Environment `production` | Kein zweiter Production-Controller und kein Überschreiben laufender Releases |
| Live-Bindung | Erwartete bisherige Version und exakter aktueller Main werden vor dem Build geprüft | Drift blockiert; ein vorbereiteter Kandidat darf nicht still durch neueren Main ersetzt werden |
| `deploy-isolated-release.sh` | Git-Archiv des exakten SHA, getrennte Releaseverzeichnisse, zwei `npm ci`, Truth/Lint/Operations/Integrationstests und Build | Frühere Staging-Erfolge ersetzen diese Pflichtprüfungen aktuell nicht |
| Umschaltung | Next.js deploymentId, nginx-Prüfung, atomischer Symlink, PM2-Cluster-Reload, Versions-/Login-/Public-Smoke und Verfügbarkeitsprobe | Vorheriger Release bleibt beim Build erreichbar; Umschaltfehler lösen bestehenden Rückwechsel aus |
| Grenzen des Rückwechsels | EXIT-Trap im isolierten Script; weitere systemd-/Backup-Installationen folgen im Workflow | Kein Nachweis eines atomaren Rollbacks des gesamten Workflows; hartes Runner-Ende ist keine sichere Rückwechselstrategie |
| SQL | Separate checksum-/target-/environment-gebundene Controller unter `scripts/operations/`, `supabase/migrations/` und `supabase/controlled/` | Kein generisches `supabase db push`, keine automatische SQL-Ausführung im Webdeploy |
| Backups | Backup-Worker, verschlüsselte Artefakte, Prüfsummen, getrennte Vollbackup-/Restore-Receipts und private Restore-Identität | Aktuelle Verifikation und Wiederherstellbarkeit bleiben zwingend; Quellcode ist kein Live-Backupnachweis |
| Staging | Eigener Workflow/Target/Schutz und eigene Locks | Laufende Support-, Medien-, Meta- und Billing-Arbeiten nicht für die Probe verdrängen |
| Zeitgrenzen heute | Validation 5 Minuten, Production-Job 45 Minuten | Job-Timeouts sind kein Gesamtzeit- und Wiederherstellungsnachweis |

Ältere Abschnitte in `AGENTS.md` beschreiben den Production-Einstieg als
versiegelt; der aktuelle Workflow enthält wieder erreichbare geschützte Jobs.
`ISOLATED_RELEASE_DEPLOY.md` beschreibt außerdem noch einen Legacy-Fallback,
den der aktuelle Workflow ausdrücklich ablehnt. Für diese Analyse ist der
aktuelle Quellcode maßgeblich. Es wurde kein Production-Host untersucht oder
verändert und kein aktueller Laufzeitzustand daraus abgeleitet.

## Minimaler Verbesserungsplan

1. **In diesem PR:** deterministisches Quellpaket mit Base, Kandidat, Git-Tree,
   Archiv-Prüfsumme, vollständiger Dateidifferenz, SQL-Inventar und separaten
   obligatorischen Freigabe-/Backup-/Probenblockern. Ein reiner GitHub-hosted
   Vorbereitungslauf bindet echte GitHub-Checks und ausgewählte anschließende
   Staging-Läufe an exakt denselben Kandidaten. Keine neue Deploymentplattform.
2. **Vor betrieblich nutzbarem Monatsrelease:** dieses Paket im bestehenden
   Production-Controller verbindlich konsumieren, inklusive frischer
   Backup-/Restore-Nachweise, vollständiger fachlicher Abnahmematrix und
   einzeln freigegebener SQL-Entscheidungen. Diese Verbindung ist hier bewusst
   noch nicht implementiert: das Paket ist keine alternative Freigabequelle.
3. **Vor erster Nutzung:** eine terminierte Gesamtprobe unter dem bestehenden
   Staging-Lock durchführen. Den tatsächlichen Production-Pfad einschließlich
   Build, Host-Nacharbeiten, Prüfungen, Abbruch und Wiederaufnahme in einer
   geeigneten isolierten vorhandenen Umgebung erproben. Keine neue DB/Instanz
   und keinen konkurrierenden Rollout starten. Den Production-Controller erst
   nach diesem Nachweis um sichere phasenbezogene Fristen erweitern; keinen
   beliebigen SIGKILL als kontrollierten Abbruch ausgeben.

Punkt 2 und 3 sind offene Umsetzung und Abnahme, kein bereits erledigter
Release. Falls das vorhandene Testziel den Production-Pfad nicht ausführen
kann, muss die konkrete Einschränkung vor der Probe geklärt werden.

## Paket vorbereiten

Vorher den gemeinsamen Main/Staging-Kandidaten fertig prüfen und fachlich
abnehmen. In einer kurzen Releasephase Main unverändert halten: der bestehende
Controller verlangt weiterhin den **aktuellen** Main. Andere Entwicklung darf
auf ihren Branches weitergehen. Keine Dateien manuell nach Production kopieren
und keine Features aus parallelen Draft-PRs hinzufügen.

GitHub Actions → **Prepare FanMind monthly release (no deployment)** → Main:

| Eingabe | Inhalt |
| --- | --- |
| `production_base` | Vollständiger, frisch verifizierter tatsächlicher Production-Commit |
| `staging_deployment_run` | Erfolgreicher `deploy-staging.yml`-Lauf für exakt diesen Main |
| `staging_acceptance_runs` | JSON-Liste erfolgreicher nachfolgender Staging-Abnahmen für denselben SHA |

Der Vorbereitungslauf prüft GitHub-Metadaten selbst, nicht vom Nutzer
gelieferte Erfolgszeichen. Fehlende/fehlgeschlagene Checks, falscher SHA,
fremdes Repository, ungeschützter Main, unbekannte Workflowpfade und zeitlich
vor dem Rollout liegende Abnahmen blockieren. Die begrenzte Liste unterstützt
Browser-/Admin-/ChatAdmin-Abnahmen; fehlende Fachprüfungen müssen weiterhin
separat in die Abnahmematrix. Ein ausgewählter grüner Lauf beweist ausdrücklich
keine Vollständigkeit aller Feature-Abnahmen. Bei mehr als einer API-Seite
Check-Runs stoppt die bestehende Prüflogik konservativ.

Das nur einmal beschreibbare Actions-Artefakt enthält `monthly-release.json`.
SHA256 aus dem Log zusammen mit Actions-Lauf, Versuch und Artifact-Digest
aufbewahren. Ein erneuter Versuch erzeugt ein eigenes Artefakt, ersetzt kein
genehmigtes Paket. Artefakte verfallen nach 35 Tagen; dauerhafte Historie durch
den üblichen geprüften Abschlussbericht mit SHA/Prüfsumme erhalten.

Offline ohne GitHub-/Production-Zugriff, für lokale Planung:

```bash
node scripts/operations/monthly-release-package.mjs plan BASE_SHA CANDIDATE_SHA /private/path/monthly-release.json
node scripts/operations/monthly-release-package.mjs verify /private/path/monthly-release.json
```

Die SHA-Platzhalter durch vollständige 40-stellige Commits ersetzen. Beide
müssen lokal vorhanden sein und Base muss Vorfahr des Kandidaten sein.
`verify` prüft nur Quellcodeidentität; es authentifiziert keine beigefügten
Nachweise. Auch der Online-Vorbereitungslauf setzt immer
`PREPARED_NOT_AUTHORIZED`. Keine Paketdatei ins öffentliche Repository legen,
wenn ihre späteren ergänzenden Betriebsnachweise vertraulich sind. Keine
Secrets, privaten Backup-URLs oder Kundendaten hinzufügen.

## SQL-Entscheidungen vor Freigabe

Jede geänderte SQL-Datei unter `supabase/` wird inklusive Änderung/Löschung,
Pfad und gegebenenfalls SHA256 erfasst. Das ist eine **Quellcodedifferenz**,
keine Aussage darüber, was in Production schon installiert ist. Nicht jede
enthaltene SQL-Datei muss ausgeführt werden. Produktionsstand ausschließlich
durch den bestehenden zuständigen read-only Verifier ermitteln.

Pro tatsächlich benötigter Änderung festhalten: zuständiger vorhandener
Controller, SQL-Checksumme, Targetbindung, Abhängigkeiten/Reihenfolge,
verifiziertes `skip` oder genehmigtes `apply`, Laufzeitobergrenze,
Idempotenz-/Wiederholungsnachweis und Postflight. Teilzustand/Drift blockiert.
Geänderte oder gelöschte historische Migrationen nicht automatisch als
auszuführen behandeln. Dafür eine neue geprüfte Korrekturmigration entwerfen.

Nicht rückwärtskompatible Änderungen in Expand → kompatible App → getrennte
Datenübernahme → spätere Contract-Phase zerlegen. Bereits verwendete Strukturen
und Daten niemals automatisch mit Down-SQL zurückrollen. Ein sicherer App-
Rückwechsel setzt die Kompatibilität mit dem **nach** der Migration vorhandenen
Schema voraus. Andernfalls vor Releasebeginn blockieren. Echte Guthaben,
Zahlungen, Meta-Konfiguration oder Feature-Aktivierungen sind kein impliziter
Bestandteil des Monatsupdates.

## Ablauf am Releasetag (Ziel, bis Gesamtprobe noch nicht aktiviert)

| Phase | Budget | Bestehende Gates und Ergebnis |
| --- | --- | --- |
| Vorprüfung und Start | 10 min | Paket/Digest/SHA, tatsächliche Base, Schema-/Konfigurationsdrift, frisches verschlüsseltes Backup, vollständiger passender Restore-Nachweis, Owner und Environment |
| Migrationen und Deployment | 20 min | Nur einzeln freigegebene Controller; bestehender isolierter Build und Umschaltung; keine generische SQL-Ausführung |
| Production-Prüfungen | 15 min | Versions-/Runtimebindung, Public Smoke, nginx/PM2/Verfügbarkeit sowie erforderliche autorisierte Funktions- und Sicherheitsprüfungen |
| Abschluss und Reserve | 15 min | Host-Nacharbeiten prüfen, vollständigen Ergebnisstatus und gemessene Zeiten sichern; bei Fehlern kompatiblen Rückwechsel prüfen |

Vorprüfung darf fehlende Sicherung/Wiederherstellbarkeit nicht durch einen
zeitlich unbeschränkten Restore im Releasefenster ersetzen. Vollständige
Restore-Probe vorher erledigen; am Releasetag deren Gültigkeit und frische
Backup-Verifikation prüfen. Abnahme-/Freigabewartezeit und Runner-Queue vor dem
Start gesondert dokumentieren; nach Start läuft die Gesamtzeit weiter.

Jede Phase mit Start, Ende, monotonic elapsed, Workflow-/Job-ID und Ergebnis
protokollieren. Der vorhandene `evaluateTimeline`-Helper prüft die vier
gemeldeten Phasendauern konservativ. Er steuert keine Prozesse und kann weder
einen Release freigeben noch die Wahrheit der gemeldeten Zeiten bestätigen.
Eine sichere Friststeuerung des tatsächlichen Controllers bleibt offen.

Bei absehbarer Überschreitung keine weitere Mutation beginnen. Einen laufenden
Datenbank-Commit nicht blind abbrechen oder wiederholen. Bei fehlendem oder
unterbrochenem Ergebnis tatsächlichen Schema-/Version-/Prozesszustand mit
bestehenden read-only Verifiern ermitteln. Status `INSPECTION_REQUIRED`,
`BUDGET_EXCEEDED_NOT_COMPLETE` oder `INCOMPLETE` bleibt offen, niemals Erfolg.

Vor Wiederaufnahme das identische Paket prüfen, tatsächliche Base/Schema-
Postflights und frische Gates erneut prüfen. Nur nachweislich vollständig
installierte Schritte überspringen. Bestehender Production-Lock bleibt
zwingend. Ein geänderter Kandidat, Target oder Migrationsplan benötigt ein
neues Paket und neue passende Freigabe. Nach Live-Umschaltung genügt ein
erneuter blinder Workflow-Start ausdrücklich nicht als Recovery.

## Nachweise und noch offene Abnahme

| Nachweis | Aussage / Grenze |
| --- | --- |
| Neue Pakettests | Echter lokaler Git-/CLI-Ablauf, deterministische Wiederholung, fehlender Commit, Manipulation, exklusives Schreiben und Wiederaufnahme der **Vorbereitung** |
| GitHub-Negativtests | Falscher SHA/Target/Workflow, rote/fehlende Checks, veraltete Abnahme blockieren |
| Zeit-/Abbruchtests | Überbudget/unvollständige/unterbrochene Phasen erzeugen keinen Release-Erfolg; keine Live-Prozesssteuerung |
| Bestehender isolierter Release-Test | Tatsächliches Shellscript im synthetischen npm/PM2/curl/sudo-Harness; Build-before-switch, Rolling-Reload, Smoke-/Verfügbarkeitsfehler und Rückwechsel |
| Beobachtete Staging-Läufe | 43643452215: 110 s; 43645449548: 112 s von `run_started_at` bis `updated_at`. Nur obere Workflow-Zeitgrenze, kein Production-/Monats-Gesamtnachweis |
| Vollständige nichtproduktive 60-min-Probe | **OFFEN**: reale Build-/Migrations-/Backup-/Host-/Test-Kette mit kontrolliertem Abbruch und zustandsgeprüfter Wiederaufnahme |
| Production | **UNVERÄNDERT / NICHT AUSGEFÜHRT** |

Die Freigabevorlage für den späteren Betrieb nennt lediglich: Paket-Hash,
Base → Kandidat, benötigte SQL-Entscheidungen, gültigen Backup-/Restore-Nachweis,
Gesamtprobenbericht, Zeitplan und Rückwechselziel. Der Owner gibt genau diese
Version frei. Danach wird ausschließlich der bestehende geschützte
`Deploy FanMind` verwendet. Bis Paketkonsum und sichere Zeitsteuerung dort
integriert und die Gesamtprobe bestanden sind, ist dies ein vorbereiteter
Arbeitsablauf und **kein fertiges automatisiertes Monatsrelease**.

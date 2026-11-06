# FanMind Offsite-Retention

## Zweck

FanMind überträgt verschlüsselte Backup-Artefakte und ihre benachbarten `.sha256`-Dateien paarweise auf ein rclone-Offsite-Ziel. `scripts/operations/offsite-backup-retention-plan.mjs` bewertet dieses Remote-Inventar ausschließlich read-only gegen dieselbe 1-1-1-Retention-Policy wie die lokale Sicherung.

Der erste Schritt ist bewusst nur ein **Planer**. Er kann keine Remote-Datei löschen, verschieben, überschreiben oder synchronisieren.

## Nachgewiesener Production-Ausgangsstand

Read-only Dry-Run vom 23. Juli 2026:

- 76 relevante Remote-Objekte;
- 38 vollständige Artefakt-/Prüfsummen-Paare;
- 0 Orphan-Paare;
- 7 Paare werden durch die aktuelle Policy gehalten;
- 31 Paare wären Löschkandidaten;
- Datenbank: 11 vollständig, 2 halten, 9 Kandidaten;
- Storage: 11 vollständig, 2 halten, 9 Kandidaten;
- Server-Konfiguration: 11 vollständig, 2 halten, 9 Kandidaten;
- Vollbackup: 5 vollständig, 1 halten, 4 Kandidaten;
- das neueste vollständige Paar jedes Typs bleibt geschützt;
- es wurde keine Remote-Löschung ausgeführt.

Diese Zahlen sind ein Bestandsnachweis, keine Löschfreigabe.

## Ausführung

Auf dem Production-Host als root oder mit explizit erlaubtem non-interactive `sudo`:

```bash
sudo -n node /usr/local/lib/fanmind-ops/offsite-backup-retention-plan.mjs --dry-run
```

Alternativ aus einem vertrauenswürdigen Repository-Checkout:

```bash
sudo -n FANMIND_BACKUP_ENV_FILE=/etc/fanmind-backup/worker.env \
  node scripts/operations/offsite-backup-retention-plan.mjs --dry-run
```

Das Skript liest `/etc/fanmind-backup/worker.env` als Text. Es führt die Datei nicht mit `source` aus und verwendet nur die benötigten Allowlist-Felder:

- `FANMIND_BACKUP_OFFSITE_ENABLED`;
- `FANMIND_BACKUP_RCLONE_REMOTE`;
- `FANMIND_BACKUP_RCLONE_CONFIG`;
- `FANMIND_BACKUP_REMOTE_PATH`;
- optional `FANMIND_RCLONE_BIN`;
- die bestehenden lokalen Retention-Zähler.

## Read-only rclone-Vertrag

Der Planer ruft ausschließlich auf:

```text
rclone --config <config> lsjson <remote-target> --files-only --recursive
```

Der Remote-Name, Remote-Pfad, die Konfigurationsdatei und einzelne Objekt-/Dateinamen werden nicht ausgegeben. Der Bericht enthält nur redigierte Zähler und die angewandte Policy.

## Ausgabe

Beispiel:

```text
OFFSITE_RETENTION_MODE=read_only_dry_run
OFFSITE_REMOTE_IDENTIFIER_REDACTED=true
OFFSITE_RELEVANT_OBJECT_COUNT=76
OFFSITE_COMPLETE_PAIR_COUNT=38
OFFSITE_ORPHAN_PAIR_COUNT=0
OFFSITE_KEEP_PAIR_COUNT=7
OFFSITE_DELETION_CANDIDATE_PAIR_COUNT=31
OFFSITE_RETENTION_TYPE=database|complete:11|keep:2|candidate:9|latest_protected:true
OFFSITE_LATEST_PER_TYPE_PROTECTED=true
OFFSITE_RETENTION_PLAN_STRUCTURALLY_SAFE=true
OFFSITE_RETENTION_EXECUTION_AVAILABLE=false
OFFSITE_REMOTE_DELETE_EXECUTED=false
OFFSITE_RETENTION_DRY_RUN_RESULT=success
```

`OFFSITE_RETENTION_PLAN_STRUCTURALLY_SAFE=true` bedeutet nur:

- mindestens ein vollständiges Paar ist vorhanden;
- es gibt keine Orphans;
- es gibt keine vollständigen, aber unbekannten FanMind-Paarmuster;
- das neueste Paar jedes vorhandenen Backup-Typs bleibt in der Keep-Menge.

Es ist **keine** Freigabe zum Löschen.

## Fail-closed-Regeln

Der Dry-Run schlägt fehl bei:

- deaktivierter oder fehlender Offsite-Konfiguration;
- nicht lesbarer Konfiguration;
- fehlgeschlagenem oder ungültigem rclone-Inventar;
- keinem vollständigen Paar;
- mindestens einem Orphan-Paar;
- einem unbekannten vollständigen FanMind-Paarmuster;
- einem nicht geschützten neuesten Paar.

Fehlerausgaben bestehen nur aus einer begrenzten maschinenlesbaren Fehlerklasse. Rohfehler, Remote-Ziele, Pfade und Credentials werden nicht ausgegeben.

## Retention-Policy

Der Planer verwendet die bestehende lokale Policy aus `backup-retention.mjs`:

| Backup-Typ | täglich | wöchentlich | monatlich |
| --- | ---: | ---: | ---: |
| Datenbank | 1 | 1 | 1 |
| Storage | 1 | 1 | 1 |
| Server-Konfiguration | 1 | 1 | 1 |
| Vollbackup | 0 | 1 | 1 |

Tages-, Wochen- und Monatsauswahl können denselben Zeitraum überlappen. Deshalb ist die tatsächliche Keep-Zahl nicht zwingend die Summe der drei Grenzwerte. Wenn alle Grenzwerte null wären, schützt die bestehende Policy weiterhin mindestens das neueste vollständige Paar je Typ.

## Nicht implementiert

Der Planer lehnt `--execute` ausdrücklich mit `execute_mode_not_implemented` ab. Er enthält keine rclone-Kommandos für:

- `delete` oder `deletefile`;
- `purge`;
- `sync`;
- `move` oder `moveto`;
- `copy` oder `copyto`.

Ein späterer Execute-Pfad benötigt einen separaten PR und mindestens:

1. ausdrückliche Löschfreigabe nach geprüftem Dry-Run;
2. exakte Ack-Variable;
3. kryptographisch gebundene Ziel-Allowlist;
4. erneute Inventarprüfung direkt vor jeder Änderung;
5. paarweise Quarantäne-/Rollback-Strategie;
6. Abbruch bei Orphans, unbekannten Mustern oder Inventaränderung;
7. begrenzte Löschmenge pro Lauf;
8. einen erneuten read-only Nachweis nach dem Lauf;
9. keine automatische Aktivierung durch Deployment.

## Sicherheitsgrenzen

- keine Entschlüsselung;
- kein Restore;
- keine Ausgabe von Backup-Inhalten;
- keine Ausgabe von Remote-Namen, Pfaden oder Credentials;
- keine automatische oder zeitgesteuerte Remote-Löschung;
- kein Einfluss auf die lokale Retention;
- keine Production-Löschung ohne einen separaten, ausdrücklich freigegebenen Arbeitsblock.

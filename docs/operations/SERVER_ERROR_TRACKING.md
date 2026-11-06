# FanMind serverseitiges Fehlertracking

## Ziel

FanMind erfasst unerwartete serverseitige Next.js-Fehler datensparsam, gruppiert wiederkehrende Fehler und erzeugt Admin-Meldungen bei neuen Gruppen oder einem Fehleranstieg.

Die Integration verwendet `src/instrumentation.ts` und den Next.js-Hook `onRequestError` ausschließlich im Node.js-Runtime-Pfad.

## Standard- und Production-Zustand

Repository-Vorlagen und neue Umgebungen bleiben fail-closed deaktiviert:

```text
FANMIND_SERVER_ERROR_TRACKING_ENABLED=false
FANMIND_SERVER_ERROR_EMAIL_ENABLED=false
```

Die Supabase-Migration wird nicht automatisch angewendet.

Auf Production wurde die Migration am 1. August 2026 kontrolliert repariert und
unabhängig verifiziert. Seit dem E-Mail-freien Aktivierungslauf
[`30708776759`](https://github.com/Bernds-tech/FanMind/actions/runs/30708776759)
gilt auf dem Release `04f2a472c57559393dd2d9c89575edf0ce8141ba`:

```text
FANMIND_SERVER_ERROR_TRACKING_ENABLED=true
FANMIND_SERVER_ERROR_EMAIL_ENABLED=false
```

Der normale Web-Deploy leitet daraus keine automatische Aktivierung für andere
Umgebungen ab. E-Mail bleibt eine getrennte, nicht freigegebene Entscheidung.

## Gespeicherte Felder

Gespeichert werden ausschließlich:

- SHA-256-Fingerprint;
- optionaler sicher formatierter Next.js-Digest;
- Route-Schablone wie `/fans/[id]` ohne Query oder Fragment;
- Route-Typ und Router-Art;
- HTTP-Methode;
- Umgebung;
- Release-Commit;
- erster und letzter Zeitpunkt;
- Gesamtzahl und Anzahl im 10-Minuten-Fenster.

Nicht gespeichert werden:

- Fehlermeldung;
- Stack;
- Header oder Cookies;
- Query-Parameter;
- Request- oder Response-Body;
- Kontakt-, Nachrichten-, Prompt-, KI- oder Zahlungsinhalte;
- IP-Adresse oder Browserkennung.

## Migration und kontrollierter Production-Weg

Vor Aktivierung manuell anwenden:

```text
supabase/migrations/20260718203000_privacy_server_error_tracking.sql
```

Die Migration ist transaktional, SHA-256-gebunden und legt an:

- `server_error_events` für minimale Ereignismetadaten;
- `server_error_groups` für Aggregation und Cooldown;
- `record_server_error_event(...)` als service-role-only RPC;
- `cleanup_server_error_events(...)` für die Ereignisaufbewahrung.

RLS ist aktiv. `PUBLIC`, `anon` und `authenticated` erhalten keine Tabellen- oder RPC-Rechte.

Der normale Web-Deploy installiert nur den root-eigenen Runner, die gepinnte
SQL-Datei, Ergebnisverifier und gehärtete systemd-Units. Er wendet die
Migration niemals an und ändert die Schalter nicht. Der ausschließlich
manuelle Workflow `.github/workflows/server-error-production-control.yml`
bindet jeden Schritt an `main`, das geschützte `production`-Environment, den
Production-Runner und den exakt live ausgelieferten Commit.

## Alarmierung

Standardwerte:

```text
FANMIND_SERVER_ERROR_ALERT_THRESHOLD=5
FANMIND_SERVER_ERROR_ALERT_COOLDOWN_MINUTES=30
```

Verhalten:

- die erste neue Fehlergruppe erzeugt eine Warnung im Admin Operations Center;
- ab dem Schwellenwert innerhalb von zehn Minuten wird dieselbe Gruppe kritisch;
- die Eskalation auf kritisch umgeht den normalen Cooldown einmalig;
- unveränderte Fehler erzeugen erst nach Ablauf des Cooldowns erneut eine Meldung;
- Admin-Meldungen enthalten nur eine verkürzte Fingerprint-Referenz, keine Route oder technische Fehlermeldung.

Kritische E-Mails bleiben separat opt-in:

```text
FANMIND_SERVER_ERROR_EMAIL_ENABLED=false
```

Erforderlich für E-Mail:

```text
RESEND_API_KEY=<server-only>
FANMIND_NOTIFICATION_FROM=FanMind <noreply@fanmind.ch>
FANMIND_ADMIN_EMAILS=admin1@example.com,admin2@example.com
```

Die E-Mail enthält nur Referenz, Anzahl, Release-Kurzcommit und Link zum Operations Center.

## Kontrollierte Aktivierung

1. Workflow mit `action=verify` und der Bestätigung
   `server-error-tracking-production-verify` ausführen.
2. Nur bei `schema_not_ready` mit `action=apply` und der Bestätigung
   `server-error-tracking-production-apply` transaktional anwenden.
3. `verify` unabhängig wiederholen; Tabellen, exakte Spalten, RLS,
   Browser-Sperren, Indizes, `security definer`/`search_path` und
   service-role-only Funktionsrechte müssen grün sein.
4. Mit `action=accept` und
   `accept-server-error-tracking-production` zwei reservierte synthetische
   Ereignisse prüfen. Der Lauf muss Warnung, Kritisch, genau eine generische
   Admin-Meldung und das vollständige Cleanup belegen; echte Routen,
   Fehlermeldungen und Kundendaten sind ausgeschlossen.
5. Erst mit `action=activate` und
   `activate-server-error-tracking-production` rollback-gesichert setzen:

```text
FANMIND_SERVER_ERROR_TRACKING_ENABLED=true
FANMIND_SERVER_ERROR_EMAIL_ENABLED=false
```

6. PM2 wird kontrolliert rollierend neu geladen; Release, `/api/health` und
   der vollständige Production-Audit müssen danach unverändert grün sein.
7. Die E-Mail-freie Storage-Abnahme wird nach Aktivierung wiederholt. Es gibt
   bewusst keinen öffentlichen oder dauerhaft erreichbaren Fehler-Endpunkt.
8. E-Mail bleibt eine spätere, getrennte Freigabe und ist nicht Bestandteil
   dieses Aktivierungswegs.

## Production-Abnahme am 1. August 2026

- der bekannte Legacy-Zustand der bereits registrierten Migration wurde
  ausschließlich für die exakt erkannte alte Konfliktform transaktional
  repariert;
- ein unabhängiger Verify bestätigte Schema, RLS, Indizes, Funktionen und
  service-role-only Rechte;
- die reservierte Acceptance-Folge `warning -> critical -> cleanup` war vor
  und nach Aktivierung vollständig erfolgreich;
- Tracking wurde rollback-gesichert aktiviert, E-Mail blieb deaktiviert;
- der abschließende Production-Audit meldete 8/8 gesunde Komponenten;
- der Aktivierungs-Reload erhöhte den erwarteten PM2-Restart-Zähler von 39 auf
  40;
- der gesonderte read-only Betriebsfenster-Audit
  [`30706456013`, Versuch 2](https://github.com/Bernds-tech/FanMind/actions/runs/30706456013/attempts/2)
  bestätigte danach unveränderte 40 Restarts, 2.213 Sekunden kontinuierliche
  Uptime, denselben Release-Commit, 8/8 Health sowie 7 lokale und 71 externe
  vollständige Backup-Paare. Dieser historische Lauf leitete die unverändert
  E-Mail-freie Laufzeitkonfiguration noch aus dem Aktivierungsnachweis und dem
  ausgebliebenen weiteren Prozess-Reload ab.

Der dauerhaft installierte read-only Production-Audit schließt diese
Nachweislücke inzwischen direkt: Er liest aus der geschützten Production-ENV
ausschließlich die beiden allowlisteten Booleschen Serverfehler-Schalter,
lehnt fehlende, doppelte, ungültige, zu große oder symlinkartige ENV-Dateien
fail-closed ab und veröffentlicht nur die normalisierten Wahrheitswerte. Ein
Audit-Pass verlangt `SERVER_ERROR_TRACKING_ENABLED=true` und
`SERVER_ERROR_EMAIL_ENABLED=false`.

## Aufbewahrung

Die Ereignistabelle kann über die service-role-only RPC bereinigt werden:

```sql
select public.cleanup_server_error_events(30);
```

Der Wert wird auf 7 bis 365 Tage begrenzt. Fehlergruppen bleiben als aggregierte technische Historie bestehen, bis eine spätere, gesonderte Retention-Entscheidung umgesetzt wird.

## Fehleroberflächen

`src/app/error.tsx` und `src/app/global-error.tsx` zeigen Nutzern nur neutrale Hinweise und Wiederholungsaktionen. Sie rendern keine Fehlermeldung, keinen Stack und keinen Digest.

# Triggerfunktionen – kontrollierter Staging-Härtungspfad

## Ziel und unveränderliche Grenze

Dieser Pfad härtet ausschließlich vier interne Triggerfunktionen in einem
isolierten FanMind-Staging. Drei Funktionen müssen vorhanden sein; der frühere
Retention-Trigger wird nur geprüft und gehärtet, falls er in einer älteren
Umgebung noch existiert.

Die festgeschriebene kontrollierte SQL-Datei ist:

```text
supabase/controlled/20260806203023_harden_trigger_function_privileges.sql
SHA-256: 6eb928fe7df73072ce03d6e78dfca7feb5c77c950fbdd70ffe1169e4dabf1132
```

Die Datei liegt absichtlich nicht unter `supabase/migrations/`. Deshalb darf
ein generisches `supabase db push` sie niemals anwenden. Auch der normale Web-
Deploy ruft weder den Runner noch einen der beiden Staging-Workflows auf.

Es gibt keinen Production-Apply in diesem Pfad. Der getrennte Production-
Kontrollweg ist unter
`docs/operations/TRIGGER_FUNCTION_HARDENING_PRODUCTION.md` dokumentiert. Sein
normaler Deploy installiert nur nicht aktivierte Kontrollartefakte; ein
Production-Apply bleibt eine eigene, erneut ausdrücklich freizugebende
Datenbankmutation.

## Kontrollierte Objekte

Immer erforderlich:

```text
public.set_social_connections_updated_at()
public.set_referral_updated_at()
public.set_demo_start_session_updated_at()
```

Nur in älteren Umgebungen optional vorhanden:

```text
public.trim_conversation_messages_to_latest_50()
```

Für jede vorhandene Funktion gilt nach dem Apply:

- `search_path` ist fest auf `pg_catalog, pg_temp` gesetzt;
- `PUBLIC`, `anon` und `authenticated` besitzen kein `EXECUTE`;
- die Funktion bleibt als Triggerfunktion erhalten;
- Tabellenzeilen, Triggerzuordnungen und Anwendungsdaten werden nicht gelesen
  oder verändert.

Der optionale Retention-Trigger muss zusätzlich weiterhin `SECURITY DEFINER`
sein, solange er existiert. In aktuellen Umgebungen wurde er durch die
Migration zur inkrementellen Conversation-Historie bereits entfernt. Seine
Abwesenheit ist deshalb ein gültiger Zustand; eine teilweise vorhandene oder
unzureichend gehärtete Funktion ist es nicht.

## Drei Betriebsmodi

### 1. Offline-Prüfung

```bash
npm run db:trigger-function-hardening:check
```

Die Prüfung verbindet sich mit keiner Datenbank. Sie bindet Dateipfad,
SHA-256 und den engen SQL-Vertrag. Jede Abweichung stoppt mit einem festen
Fehlercode.

### 2. Read-only Staging-Verify

Workflow:

```text
FanMind Trigger Function Hardening Staging Verify
```

Bestätigung:

```text
verify-trigger-function-hardening
```

Der manuelle Workflow verlangt den exakten, bereits geprüften `main`-Commit
und das geschützte GitHub-Environment `staging`. Er führt nur einen
read-only Metadaten-Postflight in einer zurückgerollten Transaktion aus. Vor
dem ersten Apply darf dieser Lauf fail-closed melden, dass die Härtung noch
nicht vollständig ist. Nach dem Apply muss er grün sein.

Direkter Runner-Modus für einen gleichwertig geschützten CI-Kontext:

```bash
npm run db:trigger-function-hardening:verify
```

### 3. Expliziter Staging-Apply mit Postflight

Workflow:

```text
FanMind Trigger Function Hardening Staging Apply
```

Bestätigung:

```text
apply-trigger-function-hardening
```

Der Apply ist zusätzlich an beide Nicht-Production-Schreibgates gebunden:

```text
FANMIND_ENABLE_NON_PRODUCTION_WRITES=true
FANMIND_NON_PRODUCTION_WRITE_ACK=I_UNDERSTAND_NON_PRODUCTION_ONLY
```

Nach dem transaktionalen SQL-Apply führt der Runner denselben read-only
Postflight aus. Ein Apply ohne vollständigen Postflight gilt als
fehlgeschlagen. Ein wiederholter Apply ist nur über denselben manuellen,
checksum- und zielgebundenen Weg zulässig.

## Ziel-, Commit- und TLS-Bindung

Beide Workflows laufen ausschließlich, wenn:

- `github.ref` exakt `refs/heads/main` ist;
- `reviewed_commit` ein 40-stelliger Commit ist und exakt `github.sha`
  entspricht;
- das GitHub-Environment exakt `staging` ist;
- App-URL und bestätigter API-Ursprung dasselbe HTTPS-Staging benennen und
  nicht `https://fanmind.ch` sind;
- Supabase-URL und Staging-Projektreferenz dasselbe Projekt benennen;
- Staging- und Production-Projektreferenz verschieden sind;
- `PGHOST` dem bestätigten Staging-DB-Host entspricht; ein regionaler
  Supabase-Session-Pooler darf für Staging und Production denselben Hostnamen
  besitzen, weil er geteilte Infrastruktur ist;
- der IPv4-kompatible Supabase-Session-Pooler auf Port `5432` mit
  `postgres.<staging-project-ref>` verwendet wird;
- die Staging-Projektreferenz von der bestätigten Production-Projektreferenz
  abweicht und `PGUSER` weder unqualifiziert noch an die Production-Referenz
  gebunden ist;
- `PGSSLMODE=verify-full` und ein absolutes CA-Bundle gesetzt sind;
- keine libpq-Umleitung über `PGHOSTADDR`, `PGSERVICE` oder eine alternative
  Connection-URL aktiv ist.

Der Production-DB-Host und die Production-Projektreferenz sind nur
Vergleichswerte. Die Zieltrennung wird beim geteilten Supavisor-Host durch die
unabhängig geprüften Projektreferenzen und den projektqualifizierten
Staging-Benutzer erzwungen. Production-Zugangsdaten werden in diesem Ablauf
weder benötigt noch verwendet.

## Private Passwortdatei und redigierte Ausgabe

Jeder Workflow erzeugt eine eigene `PGPASSFILE` im privaten Runner-Tempordner,
verlangt Modus `0600`, erstellt im Runner einen gegen Symlinks und Austausch
geschützten Snapshot und entfernt die Ausgangsdatei mit `always()`.
`PGPASSWORD` und alternative Datenbank-URLs werden vor dem psql-Aufruf
entfernt.

Erfolgszeilen sind fest begrenzt:

```text
TRIGGER_FUNCTION_HARDENING_CHECKSUM=verified
TRIGGER_FUNCTION_HARDENING_CONTRACT=verified
TRIGGER_FUNCTION_HARDENING_APPLY=not_requested|completed
TRIGGER_FUNCTION_HARDENING_POSTFLIGHT=PASS
TRIGGER_FUNCTION_HARDENING_READY=YES
SECRETS_WURDEN_NICHT_AUSGEGEBEN=true
```

Fehler erscheinen ausschließlich als:

```text
TRIGGER_FUNCTION_HARDENING_ERROR=<fester_code>
```

psql-Fehlerdetails, Hosts, Projektreferenzen, Benutzer und Passwörter werden
nicht ausgegeben.

## Verbindliche Reihenfolge

1. PR, SQL-Diff, Workflow, Runner und Policytests prüfen.
2. PR mergen und den exakten neuen `main`-Commit festhalten.
3. Offline-Prüfung auf genau diesem Commit ausführen.
4. Optional den read-only Verify als Ausgangsnachweis starten.
5. Den Apply mit dem exakten Commit und der exakten Bestätigung separat im
   geschützten `staging`-Environment freigeben.
6. Den integrierten Postflight abwarten.
7. Den getrennten read-only Verify auf demselben Commit erneut ausführen.
8. Ergebnis dokumentieren; keine Production-Änderung aus diesem Pfad starten.

# FanMind Account- und Datenlöschung

## Ziel

FanMind bietet eine leicht auffindbare vollständige Account-Löschanfrage:

- direkt in der nativen App unter `Konto`;
- außerhalb der App über `https://fanmind.ch/account-deletion`;
- nach Anmeldung im geschützten Webbereich unter `/settings/account-deletion`.

Der Prozess löscht nicht nur den App-Zugang und ist keine bloße Deaktivierung. Er ist bewusst von der Abo-Kündigung getrennt.

## Nutzerablauf

1. Nutzer öffnet die Löschfunktion in Mobile oder Web.
2. FanMind lädt ausschließlich den eigenen aktiven Löschstatus.
3. Der Nutzer bestätigt:
   - die E-Mail-Adresse des angemeldeten Accounts;
   - exakt die Phrase `KONTO LÖSCHEN`.
4. FanMind legt idempotent höchstens eine aktive Löschanfrage an.
5. Die sichtbare maximale Bearbeitungsfrist beträgt 30 Tage.
6. Die App führt nach erfolgreicher Aufnahme sofort den vorhandenen sicheren Logout-/SecureStore-Purge einschließlich der verschlüsselten Offline-Kontaktübersicht aus.
7. Solange der Status `pending` oder `blocked` ist, kann der Nutzer nach erneuter Anmeldung mit `LÖSCHANFRAGE ABBRECHEN` widerrufen. Die widerrufene Queue-Zeile wird vollständig entfernt, damit keine rohe User-ID aus einer alten Anfrage zurückbleibt.
8. Ab Status `processing` ist kein automatischer Widerruf mehr möglich.

Temporäre Demo-Accounts verwenden weiterhin ihre separate automatische Ablaufbereinigung und können keine parallele Löschanfrage anlegen.

## Server- und Datenbankgrenze

Migration:

```text
supabase/migrations/20260724103000_account_deletion_requests.sql
```

Die Tabelle `account_deletion_requests` ist ausschließlich für die serverseitige Service Role zugänglich:

- RLS ist aktiv;
- `PUBLIC`, `anon` und `authenticated` erhalten keine Tabellenrechte;
- Browser und Mobile lesen oder schreiben die Tabelle niemals direkt;
- API-Zugriff benötigt eine gültige Cookie- oder Mobile-Bearer-Sitzung;
- pro Auth-User ist höchstens eine aktive Anfrage zulässig;
- Status, Deadline und Blocker werden öffentlich auf eine minimale Darstellung reduziert;
- E-Mail, User-ID, Providertexte oder Secrets werden nicht an den Client zurückgegeben.

Die Request-Tabelle besitzt absichtlich keinen Foreign Key zu `auth.users`. Dadurch bleibt nach der Auth-Löschung eine pseudonyme Abschlussreferenz bestehen. Die ursprüngliche User-ID wird nach erfolgreicher Löschung durch einen serverseitigen HMAC-SHA-256-Wert ersetzt.

## Destruktive Bearbeitung

Processor:

```text
scripts/operations/process-account-deletion.mjs
```

Das normale Deployment installiert den Processor als:

```text
/usr/local/lib/fanmind-ops/process-account-deletion.mjs
```

Es gibt keinen Timer und keine automatische Ausführung.

### Dry-Run – verbindlicher Standard

```bash
sudo -n env FANMIND_ENV_FILE=/var/www/fanmind/.env.production \
  /usr/bin/node /usr/local/lib/fanmind-ops/process-account-deletion.mjs \
  --request-id=<UUID>
```

Der Dry-Run gibt ausschließlich aus:

- Modus;
- Requeststatus;
- Anzahl eigener Workspaces;
- Anzahl anderer Workspace-Mitglieder;
- Subscription-Blocker als Boolean;
- Eignung als Boolean.

Er gibt keine E-Mail-Adresse, User-ID, Tokens, Schlüssel, Workspace-ID, Providerantwort oder Kundendaten aus.

### Execute – dreifach gesperrt

Eine destruktive Verarbeitung benötigt gleichzeitig:

1. `--execute`;
2. `--confirm=<dieselbe Request-ID>`;
3. `FANMIND_ACCOUNT_DELETION_EXECUTION_ENABLED=true`.

Zusätzlich muss `FANMIND_ACCOUNT_DELETION_HASH_SECRET` mit mindestens 32 zufälligen Bytes konfiguriert sein.

Beispiel ausschließlich nach dokumentierter Freigabe:

```bash
sudo -n env FANMIND_ENV_FILE=/var/www/fanmind/.env.production \
  /usr/bin/node /usr/local/lib/fanmind-ops/process-account-deletion.mjs \
  --request-id=<UUID> \
  --execute \
  --confirm=<dieselbe UUID>

Bei einem unterbrochenen Lauf mit Status `processing` ist zusätzlich `--resume` erforderlich. Der Resume-Pfad prüft zuerst, ob der Auth-User noch existiert. Ist er bereits gelöscht, werden ausschließlich die Post-Delete-Verifikation, die Abschlussbenachrichtigung und die Pseudonymisierung sicher fortgesetzt.
```

Der Processor:

1. lädt Anfrage und Auth-User ausschließlich serverseitig;
2. bestätigt, dass Request- und Auth-Identität sowie E-Mail exakt zusammenpassen;
3. ermittelt alle eigenen Workspaces;
4. blockiert bei anderen Workspace-Mitgliedern;
5. blockiert bei aktivem oder ungeklärtem Stripe-Abo;
6. setzt den Request erst danach auf `processing`;
7. löscht den Auth-User ausschließlich über die Supabase Admin API;
8. verifiziert, dass Profil, Mitgliedschaften und eigene Workspaces nicht mehr im aktiven System vorhanden sind;
9. versendet eine Abschlussbestätigung, sofern der Mailprovider verfügbar ist;
10. entfernt User-ID, Workspace-ID und nach erfolgreicher Zustellung auch die E-Mail aus der Request-Zeile;
11. behält ausschließlich die HMAC-Referenz und technische Abschlussmetadaten.

Eine fehlgeschlagene Zustellung verändert die abgeschlossene Kontolöschung nicht. Der Request bleibt dann als `completed_notification_pending` mit der minimal notwendigen E-Mail-Adresse für einen kontrollierten Zustellversuch sichtbar.

## Workspace-Grenzen

### Alleiniger Owner

Hat der Nutzer einen eigenen Workspace ohne weitere Mitglieder und kein aktives beziehungsweise ungeklärtes Abo, kann der Account verarbeitet werden. Die bestehende Datenbank nutzt für den Auth-/Workspace- und CRM-Kern geprüfte Cascades. Der Processor verifiziert den aktiven Zustand nach der Admin-Löschung.

### Owner mit weiteren Mitgliedern

Die Anfrage erhält `blocked` und `requires_ownership_transfer=true`. FanMind löscht weder den gemeinsamen Workspace noch Daten anderer Mitglieder. Eine Verantwortungsübertragung oder kontrollierte Workspace-Auflösung ist zuerst separat zu dokumentieren.

### Reines Workspace-Mitglied

Die Auth-Löschung darf die eigene Membership und das persönliche Profil entfernen, aber keinen fremden Workspace und keine fremden Kontakte löschen.

## Subscription-Grenze

Eine Account-Löschung ist kein Ersatz für einen vertraglichen Kündigungsprozess. Existiert eine Stripe-Subscription und ist das wirksame Ende noch nicht erreicht beziehungsweise der Billingstatus ungeklärt, bleibt die Anfrage blockiert.

Der Löschprocessor:

- kündigt kein Abo automatisch;
- verändert keine Stripe-Subscription;
- setzt keine Preise oder Billing-Felder;
- löscht keine Rechnungsnachweise.

## Aufbewahrung

Aus dem aktiven FanMind-System werden nicht gesetzlich aufzubewahrende Account- und Workspace-Daten entfernt. Ausgenommen bleiben, soweit erforderlich:

- Rechnungs- und steuerrechtliche Nachweise;
- Sicherheits-/Missbrauchsnachweise in minimaler, pseudonymer Form;
- technisch nicht selektiv bearbeitbare verschlüsselte Sicherungskopien bis zum Ablauf ihrer veröffentlichten Retention.

Backups werden nicht als Nebenwirkung einer einzelnen Account-Löschung verändert oder remote gelöscht.

## Mailgrenze

Resend wird ausschließlich serverseitig verwendet. Die Operations-Benachrichtigung enthält:

- Request-ID;
- Quelle;
- Deadline;
- Blocker als Boolean.

Sie enthält keine Account-E-Mail, User-ID, Tokens, Secrets oder Kundendaten. Die Account-E-Mail wird nur für die persönliche Eingangs- und Abschlussbestätigung verwendet.

## Production-Rollout

1. Fach-PR vollständig grün prüfen und mergen.
2. Exakten Release und gesunde Anwendung bestätigen.
3. Frisches verschlüsseltes Datenbank-Backup erzeugen.
4. `.age`-/`.sha256`-Paar checksum-only verifizieren.
5. Migration mit `psql -v ON_ERROR_STOP=1` anwenden.
6. Tabelle, Constraint, RLS und Rollenrechte prüfen.
7. ausschließlich mit einem synthetischen Test-Auth-User einen Antrag erzeugen.
8. Status und 30-Tage-Deadline prüfen.
9. Antrag widerrufen und bestätigen, dass keine Account-/Workspace-Daten verändert wurden.
10. Processor ausschließlich im Dry-Run gegen einen synthetischen offenen Request prüfen.
11. Keine echte destruktive Kundenlöschung als Release-Smoke ausführen.
12. Public Health, Landingpage, Login, Registrierung, Passwort-Recovery und `/account-deletion` prüfen.

## Reale Store-Abnahme

Nach einem signierten internen Build:

- Mobile: `Konto` → `Account und Daten löschen` muss leicht auffindbar sein;
- Antrag mit synthetischem Testkonto auf realem Gerät prüfen;
- sichere lokale Abmeldung und SecureStore-Purge einschließlich Offline-Kontaktübersicht prüfen;
- Webressource ohne installierte App öffnen;
- Widerruf nach erneuter Anmeldung prüfen;
- Google Play Data Safety und App Store Datenschutz-/Reviewangaben mit exakt diesem veröffentlichten Prozess befüllen.

Die realen signierten Geräte- und Storetests bleiben bis zu EAS-/Apple-/Google-Zugängen in Issue `#690` sichtbar extern.

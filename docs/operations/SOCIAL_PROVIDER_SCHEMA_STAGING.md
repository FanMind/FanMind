# Social-Verbindungen auf isoliertem Staging einrichten

Die Installation ist abgeschlossen: #1104 / Main d19254f06da3205a954e903f72e5c5b6928de3ab, Verify 34591253931, Apply 34591339718 am 11.09.2026 um 10:53:12 UTC mit POSTFLIGHT=PASS und Staging Deploy 34591566257. Unabhängig um 10:54:15 UTC: zwei RLS-Tabellen, acht interne Funktionen, korrekte Rechte und null Verbindungen/OAuth-Versuche. RUNTIME_ACTIVATED=false bezeichnet hier, dass der Controller keine Aktivierung vorgenommen hat; es ist keine Messung eines Host-Schalters. Der Ablauf unten dokumentiert die Installation und darf nicht als Aufforderung zu einem erneuten Apply gelesen werden. Tatsächliche App-/Creator-/Provider-/Pilotabnahme bleibt offen; vor weiterer Zielarbeit aktuellen Zustand prüfen. Der historische
Nachweis ist unter EV-SOCIAL-STAGING-FOUNDATION-20260911 registriert; spätere
Staging-Deploys haben seine Verwendung als aktuellen Zielnachweis bereits
ungültig gemacht. Für neue Ziel-/Pilotabnahmen ist eine aktuelle Prüfung nötig,
keine Wiederholung der abgeschlossenen Installation.

Dieser Weg installiert nur das neue TikTok-/X-Verbindungsschema. Er aktiviert
keinen Provider, lädt keine Nachrichten und verändert keine Produktionsdaten.
Er verwendet das bereits vorhandene Staging-Projekt; eine weitere Datenbank oder
ein weiterer Server ist dafür nicht vorgesehen. Creator-Rollout und Backup-Diagnose
bleiben eigene Arbeiten.

Die geprüfte Datei `supabase/controlled/social_provider_connections.sql` enthält
zwei Tabellen und acht interne Funktionen. Der SHA256 in
`scripts/operations/social-provider-schema-sql.mjs` bindet exakt diesen Inhalt.
Stand vor Umsetzung: beide Tabellen auf dem am 11.09.2026 lesend geprüften
Staging-Projekt nicht vorhanden. Vor jeder Anwendung den Zielzustand neu prüfen.
Diese damalige Vorbedingung ist durch den oben belegten Apply überholt. Eine vorhandene oder abweichende Installation wird nicht still ersetzt.

Der manuelle Workflow `.github/workflows/social-provider-schema-staging.yml`
verwendet das geschützte GitHub-Environment `staging`. Er läuft ausschließlich
auf dem explizit geprüften Main-Commit. Notwendige vorhandene Konfiguration:

| Geschützter Wert | Zweck |
|---|---|
| `FANMIND_STAGING_APP_URL` | Exakte Staging-Origin, verschieden von Production. |
| `FANMIND_STAGING_SUPABASE_PROJECT_REF` | Isoliertes Zielprojekt. |
| `FANMIND_PRODUCTION_SUPABASE_PROJECT_REF` | Aktuell bestätigtes Production-Projekt zum Gegenvergleich. |
| `FANMIND_STAGING_DB_NAME` | Ziel-Datenbankname. |
| Secret `FANMIND_STAGING_SUPABASE_URL` | Passend zum isolierten Ziel-Ref. |
| Secret `FANMIND_STAGING_DB_HOST` | Bestätigter Session-Pooler auf Port 5432. |
| Secret `FANMIND_STAGING_DB_PASSWORD` | Nur für die private temporäre Passfile. |

Der Datenbanknutzer ist an `postgres.<Staging-Ref>` gebunden. Ziel-API, Supabase-URL,
Pooler, Datenbanknutzer und Production-Vergleich werden unabhängig geprüft. TLS
verlangt `verify-full` und das im geprüften Commit enthaltene CA-Bundle.
Weiterleitungen über `PGHOSTADDR` oder libpq-Service-Dateien sind ausgeschlossen.
Passwörter, Tokens und SQL-Diagnostik erscheinen nicht im Ergebnis. Die private
Passfile wird ohne Symlink-Folge gelesen, mit festen Rechten eingefroren und
anschließend entfernt. Der Runner übernimmt nur erlaubte Verbindungsvariablen.

1. Den geprüften Branch über den normalen Review-/CI-Weg in Main übernehmen.
2. Im Workflow `action=verify`, den exakten Main-SHA und
   `confirmation=verify-social-provider-schema` wählen. Beide Schreibfreigaben
   bleiben aus. `STATE=absent` belegt nur das fehlende Schema und benötigt Apply.
3. Nach dieser Vorprüfung `action=apply`, denselben geprüften Commit und
   `confirmation=apply-social-provider-schema` verwenden. Nur dieser Pfad öffnet
   die beiden Staging-Schreibfreigaben. Das gemeinsame Lock verhindert parallele
   Workflow-Läufe; ein Datenbanklock schützt zusätzlich die Transaktion.
4. Apply prüft die Voraussetzungen, installiert atomar und vergleicht noch vor
   dem Commit die genaue Struktur mit einer von PostgreSQL selbst geparsten
   temporären Referenz. Ein Fehler rollt die neue Installation zurück.
5. Danach folgt in einer neuen Sitzung die unabhängige, auf echte Tabellen nur
   lesende Nachprüfung. Erfolg erfordert `STATE=verified`, `POSTFLIGHT=PASS` und
   `RUNTIME_ACTIVATED=false`. Lauf, Commit, Ziel und Ergebnis im Beleg festhalten.

Verify legt nur leere, sitzungslokale Referenzobjekte an. Anschließend vergleicht
eine serverseitig schreibgeschützte Transaktion Typen, Defaults, Constraints,
Fremdschlüsselziele, RLS, Policies, Indizes, Tabellen-/Spaltenrechte und genaue
Funktionskörper, Argumente, Rollenrechte und Sicherheitsattribute. Kundendaten
und gespeicherte Tokens werden nicht gelesen. Referenzen verschwinden beim
Verbindungsende.

Eine Teilinstallation oder Abweichung wird abgelehnt. Es gibt keinen
automatischen Reparatur-, Drop- oder erneuten Apply-Pfad. Eine bereits korrekte
Installation wird nur erneut geprüft. Nach fehlender oder unklarer Commit-Antwort
gilt `apply_indeterminate_verify_before_retry`: ausschließlich Verify ausführen
und den tatsächlichen Zustand feststellen, bevor weitere Schritte erfolgen.

Der bestehende Normal-Deploy spielt dieses SQL nicht ein. Pilot, technische
FanMind-Provider-App, Creator-Zustimmung, genehmigtes X-Budget und echte positive/
negative Provider-Abnahme bleiben gesonderte Voraussetzungen. Ein erfolgreicher
Schema-Lauf belegt weder die Einbindung echter Kanäle noch Produktionsreife.

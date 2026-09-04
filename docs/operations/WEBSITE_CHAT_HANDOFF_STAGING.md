# Website Chat Handoff — geschützter Staging-Ablauf

Status: Repository-seitig vorbereitet. Kein Workflow wurde gestartet, keine
Datenbank verändert und keine Installation aktiviert.

Dieser Ablauf gilt ausschließlich für die checksum-gebundene Datei
`supabase/controlled/20260904120000_website_chat_handoff.sql`. Er ist kein
generischer Migrationsweg und darf niemals gegen Production ausgeführt werden.
KI-Antworten und E-Mail-Versand bleiben in allen drei Schritten deaktiviert.

## Schutzbedingungen

- Start ausschließlich manuell aus dem exakten geprüften Commit auf `main`.
- GitHub Environment `staging` mit getrennten Staging-/Production-Bindungen.
- `NEXT_PUBLIC_SUPABASE_URL`, Projektreferenz, API-Origin und direkter
  PostgreSQL-Host müssen dasselbe isolierte Staging-Ziel benennen.
- Der Production-API-Origin, die Production-Projektreferenz und der
  abgeleitete Production-DB-Host müssen gesetzt und vom Ziel verschieden sein.
- PostgreSQL TLS muss `verify-full` verwenden. `PGHOSTADDR`, Service-Dateien
  und alternative Connection-URLs werden verworfen oder abgelehnt.
- Das Datenbankpasswort liegt nur in einer privaten temporären `0600`-Datei,
  wird nie als Kommandozeilenargument verwendet und am Jobende entfernt.
- Verify, Apply und Acceptance besitzen verschiedene Bestätigungstexte. Eine
  Bestätigung kann keinen anderen Schritt freischalten.

Benötigte zusätzliche Staging-Variable:

- `FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID`: UUID eines ausdrücklich für
  isolierte synthetische Staging-Abnahmen bestimmten Workspaces. Der Workspace
  muss bereits die beiden Marker `staging_synthetic_fixture=true` und
  `workspace_processing_acceptance=true` tragen; andernfalls stoppt der Lauf.

## Reihenfolge

1. Nach vollständig grünen Prüfungen auf dem exakten `main`-Commit den
   manuellen Workflow **FanMind Website Chat Handoff Staging** mit Aktion
   `verify` und Bestätigung `verify-website-chat-handoff-schema` starten.
   Dieser Schritt ist read-only. Vor dem ersten Apply wird er erwartungsgemäß
   geschlossen melden, dass das Schema fehlt.
2. Nur nach einer eigenen ausdrücklichen Freigabe denselben Workflow mit
   Aktion `apply` und Bestätigung
   `apply-website-chat-handoff-migration` starten. Der Runner prüft vorher den
   festen SHA-256-Wert und danach RLS, Tabellen-/Funktionsrechte sowie den
   entzogenen Legacy-Aufruf.
3. Security Advisor und die ausgegebenen festen Postflight-Marker prüfen. Es
   dürfen keine Browser-Grants/Policies und keine unerwarteten
   `PUBLIC`-Funktionsrechte vorhanden sein.
4. Nur nach einer weiteren ausdrücklichen Freigabe den manuellen Workflow
   **FanMind Website Chat Handoff Staging Acceptance** mit Bestätigung
   `run-website-chat-handoff-acceptance` starten.
5. Die Acceptance muss drei Browser-Zugriffe ablehnen und anschließend
   Nachricht, Wiederholung, Handoff, Handoff-Wiederholung, Handoff ohne
   vorherige Nachricht, falsche Origin für Nachricht und Handoff,
   CRM-Verknüpfung, E-Mail-Fingerprint und das Fehlen ausgehender Nachrichten
   prüfen. Sämtliche synthetischen Schreibvorgänge liegen in einer Transaktion,
   die zurückgerollt wird; eine zweite read-only Prüfung bestätigt die
   vollständige Bereinigung.

Lokale, rein statische Vorprüfungen:

```sh
npm run db:website-chat-handoff:check
npm run website-chat:handoff:staging:check
npm run test:website-chat
```

## Abbruch und Wiederaufnahme

- Bei einem fehlenden Schema endet Verify geschlossen. Erst Ursache und
  Zielbindung prüfen; Apply nicht als automatischen Reparaturschritt starten.
- Bei einem Apply-Fehler ist der kontrollierte SQL-Block transaktional. Den
  Fehler klassifizieren, den exakten Commit unverändert lassen und erst nach
  neuer Prüfung erneut entscheiden.
- Bei einer fehlgeschlagenen Acceptance nicht aktivieren. Der Runner gibt nur
  feste Fehlercodes aus und löscht die private Passwortdatei trotzdem.
- Auch nach erfolgreicher Acceptance bleiben alle Website-Chat-Installationen
  deaktiviert. Aktivierung, echte Besucherdaten, KI und E-Mail-Transport sind
  jeweils eigene spätere Freigaben.

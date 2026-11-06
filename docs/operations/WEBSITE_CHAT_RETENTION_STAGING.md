# Website Chat Retention — geschützter Staging-Ablauf

Status: Repository-seitig vorbereitet. Kein Workflow wurde gestartet, keine
Datenbank verändert und kein Retention-Zeitplan aktiviert.

Dieser Ablauf gilt ausschließlich für
`supabase/controlled/20260904170000_website_chat_retention.sql` mit SHA-256
`485bc7133764ce7c2f9d002a4a46a5a1895441ad405c9a7a0fa0970b0900ab0f`.
Er darf niemals gegen Production oder über den generischen Migrationsweg
ausgeführt werden. Installationen, KI und E-Mail-Versand bleiben deaktiviert.

## Schutzbedingungen

- manueller Start aus dem exakten geprüften `main`-Commit;
- GitHub Environment `staging` und voneinander verschiedene Staging-/
  Production-Bindungen für API, Supabase-Projekt und PostgreSQL-Host;
- TLS `verify-full`; keine alternative Connection-URL, `PGHOSTADDR` oder
  libpq-Service-Datei;
- Passwort nur über eine private temporäre `0600`-Datei ohne Symlink;
- verschiedene Bestätigungstexte für Verify, Apply und Acceptance;
- dieselbe exklusive Workflow-Concurrency wie der Website-Chat-Handoff;
- Acceptance nur in einem markierten synthetischen Workspace und vollständig
  innerhalb einer zurückgerollten Transaktion.

Benötigte Staging-Variable:

- `FANMIND_WEBSITE_CHAT_STAGING_WORKSPACE_ID`: UUID eines isolierten
  synthetischen Workspaces mit den Markern
  `staging_synthetic_fixture=true` und
  `workspace_processing_acceptance=true`.

## Getrennte Schritte

1. Nach grünen Prüfungen den manuellen Workflow **FanMind Website Chat
   Retention Staging** mit Aktion `verify`, dem exakten `main`-SHA und
   Bestätigung `verify-website-chat-retention-schema` starten. Dieser Schritt
   ist read-only. Vor dem Apply muss er erwartungsgemäß geschlossen melden,
   dass die Funktion noch fehlt.
2. Nur nach eigener ausdrücklicher Freigabe denselben Workflow mit Aktion
   `apply` und Bestätigung `apply-website-chat-retention-migration` starten.
   Der Runner prüft vorher den festen SQL-Hash und danach Eigentümer,
   Security-Invoker, Suchpfad, Funktions- und Tabellenrechte, Cascade-Verträge
   sowie einen read-only Dry-run.
3. Nur nach weiterer ausdrücklicher Freigabe den Workflow **FanMind Website
   Chat Retention Staging Acceptance** mit Bestätigung
   `run-website-chat-retention-acceptance` starten.
4. Die Acceptance muss vier Browser-Aufrufe auf RPC und technische Tabelle
   ablehnen, ungültige Limits und einen NULL-Ausführungsmodus verwerfen, genau den synthetischen Workspace
   verwenden, Dry-run und begrenzte Löschung beweisen, eine aktive Übergabe
   schützen, nur technische Cascades zulassen, CRM-Verlauf erhalten und alle
   Fixture-Schreibvorgänge vollständig zurückrollen.

Lokale statische Vorprüfungen:

```sh
npm run db:website-chat-retention:check
npm run website-chat:retention:staging:check
npm run test:website-chat
```

## Abbruchgrenze

- Ein fehlendes Schema im Verify ist kein Auftrag zum automatischen Apply.
- Ein Apply-Fehler bleibt durch den kontrollierten SQL-Block transaktional;
  Ziel, Commit und Hash müssen vor einer neuen Entscheidung erneut geprüft
  werden.
- Eine fehlgeschlagene Acceptance erlaubt weder Zeitplan noch Aktivierung.
- Auch eine erfolgreiche Acceptance startet keine automatische Löschung und
  autorisiert weder Production noch KI, E-Mail oder echte Besucherdaten.

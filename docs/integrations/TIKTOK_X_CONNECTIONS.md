# TikTok und X/Twitter: aktueller Verbindungsumfang

Bernd nimmt beide Kanäle am 11. September 2026 in die laufende Entwicklung auf
(FM-DEC-017 / FM-CR-031). Ein Creator-Account verwendet auf allen Kanälen seinen
einen persönlichen Text-Schreibstil. Die Verbindung legt kein weiteres
Schreibstilprofil an. Manager und Discord bleiben später.

| Kanal | Implementierter Umfang | Noch offen |
|---|---|---|
| TikTok | Offizieller Login Kit Web-Codeaustausch, Prüfung des eigenen Profils, verschlüsselte Speicherung, erneute Anmeldung und Trennen. Scope `user.info.basic`. | Konkrete App-/Testfreigabe; separater offizieller Nachrichten-/Kommentarzugang. Profil-Login ist keine DM-Freigabe. |
| X / Twitter | OAuth2 mit S256-PKCE, eigene Identität, verschlüsselte Access-/Refresh-Tokens, kontrollierte Rotation, Trennen und manuell ausgelöste Lesevorschau. | Eigene freigegebene App, Account-Zustimmung, API-Guthaben/-Budget, echte Provider-Abnahme und dauerhafte CRM-Ingestion. |

X lädt höchstens 20 Ereignisse in einem Abruf, frühestens alle 15 Minuten pro
Account. Angezeigt werden nur validierte eingehende Einzelchat-Nachrichten.
Gruppen, Ausgangsnachrichten, unklare Teilnehmer und Dubletten werden ausgelassen.
Weitere Seiten werden angezeigt, aber nicht automatisch geladen. Laut X sind
über diesen Endpunkt Ereignisse der letzten 30 Tage verfügbar. Die Vorschau ist
flüchtig: keine neuen Fans, keine CRM-Nachrichten und kein automatisches Lernen.
Antworten werden weiterhin auf der Originalplattform manuell gesendet.

## Sicherheits- und Datenvertrag

- Der Server autorisiert den aktuellen aktiven Workspace-Owner; Demo und Member
  dürfen keine Verbindung verwalten. Lesen des Status und lokales Trennen bleiben
  für den Owner auch bei pausierter Verarbeitung möglich.
- Start/Trennen/Abruf sind POST mit exaktem Origin-Vergleich. Callback bindet
  Provider, Workspace und Nutzer an einen zufälligen einmaligen State mit zehn
  Minuten Gültigkeit. Der State wird in der Datenbank atomar verbraucht; die
  vollständige Verbindung prüft ihn noch einmal, damit Trennen einen schon
  laufenden Callback ungültig macht. Neue Versuche ersetzen den früheren State.
- AES-256-GCM bindet Tokens zusätzlich kryptografisch an Provider, Workspace und
  externe Konto-ID; der PKCE-Verifier ist ebenfalls verschlüsselt. Tokens und
  Provider-Fehlertexte erscheinen nicht in UI, Export, Logs oder Redirects.
- Ein aktives externes Konto kann nur einem Workspace zugeordnet sein; je
  Workspace/Provider besteht höchstens eine Verbindung. Ein Kontowechsel erfordert
  vorheriges Trennen. Datenbank-Constraints sichern auch konkurrierende Requests.
- Eine Datenbank-Lease und Revisionsprüfung schützen Abruf/Tokenrotation gegen
  parallele Requests, erneute Anmeldung und Trennen. Gedrehte Refresh-Tokens werden
  vor dem DM-Abruf gespeichert. Unklare Refresh-Fehler werden nicht automatisch wiederholt.
- TikTok-Tokens werden in diesem Profilumfang nicht im Hintergrund erneuert;
  die Oberfläche bietet erneute Anmeldung. Der vorhandene Refresh-Adapter wird
  ausschließlich durch den kontrollierten X-Leseweg aufgerufen.
- Trennen entfernt lokale Credentials und offene Anmeldeversuche zuerst. Ein
  fehlgeschlagener oder abgeschalteter Provider-Widerruf wird ausdrücklich
  angezeigt; der Owner kann die App zusätzlich auf der Plattform entfernen.
- Owner können nur ungefährliche Verbindungsmetadaten exportieren. Browserrollen
  haben keine Token-/Versuchstabellenrechte und keine internen RPC-Rechte. Löschen
  des Workspace entfernt Verbindungen/Versuche per Foreign-Key-Cascade.
- Pro Workspace/Provider bleibt höchstens ein OAuth-Versuch gespeichert. Nach
  zehn Minuten ist er unbrauchbar; neuer Versuch, Trennen oder Accountlöschung
  entfernt/ersetzt ihn. Kein dauerhafter Nachrichten- oder Payload-Cache entsteht.

## Pilot einrichten und abnehmen

Der gesamte Provider-Zugriff bleibt standardmäßig aus und ist in dieser Version
strukturell auf isoliertes Staging begrenzt. Ein normaler Merge/Deploy spielt
keine SQL ein und aktiviert keinen Provider. Das additive Schema liegt unter
`supabase/controlled/social_provider_connections.sql`; keine generische
`supabase db push`-Anwendung. Es existiert noch kein freigegebener zielgebundener
Apply-Workflow für dieses neue Schema. Vor realer Nutzung dessen kontrollierten
Verify/Apply/Postflight nach dem vorhandenen Creator-/Meta-Vorbild abschließen.
Ein fehlendes Schema blockiert die Anmeldung vor dem Provider-Redirect.

Serverkonfiguration (Werte niemals in Git oder Chat):

| Variable | Zweck |
|---|---|
| `FANMIND_APP_URL` | Exakte HTTPS-Staging-Origin; Callback wird ausschließlich daraus abgeleitet. |
| `FANMIND_RUNTIME_ENVIRONMENT=staging` | Getrennte Laufzeit. |
| `FANMIND_SOCIAL_STAGING_PROJECT_REF` | Exakter isolierter Supabase-Ref, verschieden von Production und passend zu `NEXT_PUBLIC_SUPABASE_URL`. |
| `FANMIND_SOCIAL_PILOT_WORKSPACE_IDS` | Explizite synthetische Test-Workspace-Allowlist. |
| `FANMIND_SOCIAL_PILOT_ENABLED` | Kill Switch; Standard aus. |
| `FANMIND_SOCIAL_TOKEN_KEY` | Separater zufälliger 32-Byte-Schlüssel als 64 Hexzeichen. |
| `FANMIND_X_CLIENT_ID`, `FANMIND_X_CLIENT_SECRET` | Vertrauliche X-Web-App, kein Operator-Bearer-Token. |
| `FANMIND_TIKTOK_CLIENT_ID`, `FANMIND_TIKTOK_CLIENT_SECRET` | TikTok Client Key / Secret. |
| `FANMIND_X_PILOT_APPROVED`, `FANMIND_TIKTOK_PILOT_APPROVED` | Serverbestätigung der tatsächlich geprüften App-/Zweck-/Datenschutz-/Budgetfreigabe, kein Ersatz für deren Beleg. |

Callback-Pfade: `/api/integrations/social/x/callback` und
`/api/integrations/social/tiktok/callback`, jeweils auf der exakten freigegebenen
HTTPS-Staging-Origin. Bei X nur `tweet.read users.read dm.read offline.access`,
bei TikTok nur `user.info.basic` anfordern. Keine Schreib-/Sende-Scopes.

Abnahme benötigt echte positive und negative Provider-Proben, Scope-/Token-
Rotation, Rate Limit, Disconnect, getrennte Creator-Accounts, Browser-Denial,
Export/Löschung und aktuelle vertragliche/Datenschutzfreigabe. Fixtures/CI beweisen
nur den Source-Vertrag. Production benötigt danach einen separat geprüften
Aktivierungspfad; bestehende Sales- und Phase-7-Gates bleiben PARTIAL.

Rücknahme: Pilot ausschalten, vorhandene lokale Verbindungen trennen, Provider-
Freigaben bei Bedarf widerrufen; Quelländerung begrenzt zurücknehmen. Keine
automatische Datenbank-Drop-/Kundenlöschaktion. Reconnect/Rotation ohne gültigen
State bzw. gültige Lease darf keinen älteren Account wiederherstellen.

## Offizielle Quellen, geprüft am 11. September 2026

- [TikTok Login Kit Web](https://developers.tiktok.com/doc/login-kit-web/)
- [TikTok Tokenaustausch, Refresh und Widerruf](https://developers.tiktok.com/docs/en/oauth-user-access-token-management)
- [TikTok eigene Profildaten und Scopes](https://developers.tiktok.com/doc/tiktok-api-v2-get-user-info/)
- [X OAuth2 mit PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code)
- [X Direktnachrichten und Zeitfenster](https://docs.x.com/x-api/direct-messages/lookup/introduction)
- [X DM-Endpunkt und Felder](https://docs.x.com/x-api/direct-messages/get-dm-events)
- [X Gesprächs-ID, Nachrichtentypen und Senderfelder](https://docs.x.com/x-api/direct-messages/lookup/integrate)
- [X nutzungsabhängige Kosten](https://docs.x.com/x-api/getting-started/pricing)

Der konkrete TikTok-Business-Messaging-Zugang ist nicht bestätigt. Der Abruf der
vermuteten offiziellen Hilfeseite war nicht verfügbar; das ist weder ein Beleg
für allgemein erlaubten Zugriff noch für dessen generelle Unmöglichkeit.

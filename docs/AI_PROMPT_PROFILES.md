# Workspace-Unternehmens-Prompt und Antwortprofile

Unter `Einstellungen → KI-Nutzung` kann ein Workspace seine gewünschte
Unternehmenssprache für KI-Antwortvorschläge pflegen.

## Ein Account, ein Schreibstil — FM-DEC-016

Jeder Nutzer-/Creator-Account hat genau einen persönlichen Schreibstil.
Die unten beschriebene bestehende Legacy-Profilverwaltung ist kein Modell
für mehrere Creator oder wechselnde Schreibstile in einem Account. Im
Creator-Pfad bestimmt allein das freigegebene Account-Profil den Schreibstil;
Unternehmens-Prompt und Antwortprofile dürfen nur vereinbare Geschäftshinweise
und Gesprächsziele ergänzen. Auch Recommended/Softer/Stronger bleiben im
selben Stil. Audio oder echte Stimmen sind nicht gemeint.

Ein späterer Manager darf mehrere getrennte Creator-Accounts und deren
Kanäle betreuen; der Stil wird dabei aus dem jeweils autorisierten
Creator-Account geladen, nicht aus dem Managerzugang. Die heutige Legacy-UI
und ihr Zusammenspiel mit dem Creator-Pfad müssen vor dessen Aktivierung
gegen diese Regel geprüft werden. Diese Klarstellung ändert weder bestehende
gespeicherte Profile noch behauptet sie eine bereits abgeschlossene Umstellung.

## Struktur

1. **Unternehmens-Prompt**
   - gilt für alle Antwortvorschläge im Workspace;
   - beschreibt Unternehmen, Zielgruppe, Leistungen, Anrede, Ton, No-Gos und
     typische nächste Schritte;
   - maximal 3.000 Zeichen.
2. **Antwortprofile**
   - bis zu acht Profile pro Workspace;
   - maximal 1.500 Zeichen je Profil;
   - ein aktives Profil ist Standard;
   - weitere aktive Profile können direkt bei der Antwortgenerierung gewählt
     werden.

Vorlagen für Verkauf & Beratung, Kundenservice, Reklamation & Deeskalation
sowie Community & Fans helfen beim Einstieg. Jede Vorlage bleibt editierbar.

## Verbindliche Sicherheitsreihenfolge

Workspace-Prompts steuern Ton, Wortwahl, fachliche Schwerpunkte und gewünschte
nächste Schritte. Sie dürfen niemals:

- die Wahrheits- und Sicherheitsregeln überschreiben;
- automatische Sendung aktivieren;
- das strukturierte Antwortschema verändern;
- unbelegte Preise, Rabatte, Termine oder Zusagen erzeugen;
- Auth-, Workspace-, RLS- oder Abrechnungsgrenzen verändern.

Der Browser sendet bei einer Antwortanfrage ausschließlich die ID des gewählten
Profils. Unternehmens- und Profil-Prompt werden erst nach Kontakt- und
Workspace-Autorisierung serverseitig geladen.

## Zugriff und Datenschutz

- Lesen: Mitglieder des eigenen Workspaces.
- Ändern: Workspace-Owner oder FanMind-Plattform-Admin.
- Mutationen: ausschließlich über den serverseitigen, Origin-geprüften
  FanMind-Endpunkt.
- Speicherung: RLS-geschützt und Workspace-gebunden.
- Keine Passwörter, Tokens, Zugangsdaten oder unnötigen personenbezogenen
  Daten in Prompts eintragen.
- Prompt-Inhalte werden nicht in KI-Usage-Logs geschrieben.

## Rollout

Die additive Migration
`20260726213000_workspace_ai_prompt_settings.sql` muss vor der produktiven
Bearbeitung angewendet sein. Fehlt die Tabelle, bleibt die bestehende
Antwortgenerierung funktionsfähig, verwendet aber keine eigenen
Workspace-Prompts; die Einstellungsseite meldet die Promptverwaltung als
nicht verfügbar. Prüfung, kontrollierte Anwendung und Postflight sind unter
`docs/operations/AI_PROMPT_MIGRATION.md` beschrieben; ein Web-Deploy wendet
die Migration niemals automatisch an.

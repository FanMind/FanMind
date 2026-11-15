# Private Character-Bilderbibliothek

Implementierung zu #1425, 5. November 2026. Repository-Implementierung und
synthetische Tests sind von Installation, echter Bildanalyse und Live-Abnahme
getrennt. Beide neuen Schalter bleiben standardmäßig aus.

## Bedienung

Beim ausgewählten Character öffnet „Bilder“ dessen private Bibliothek. JPG-,
PNG- und WebP-Einzelbilder bis 5 MB werden vollständig dekodiert, auf höchstens
1600 × 1600 Pixel verkleinert und ohne ursprüngliche Metadaten als WebP abgelegt.
SVG, Animationen und Eingaben über 16 Millionen Pixel werden abgewiesen.
Ordnernamen sind Sammlungsangaben, keine Zugriffserlaubnis. Der Upload verlangt
eine Bestätigung der Nutzungsrechte und Volljährigkeit abgebildeter Personen;
die KI überprüft keine Identität, Rechte oder Altersangaben.

Die optionale Aktion „Mit KI beschreiben“ überträgt nach ausdrücklicher
Bestätigung genau ein Bild an die bestehende serverseitige OpenAI-Anbindung.
Neutrale Beschreibung und Schlagwörter bleiben ungeprüft. Erst die manuelle
Freigabe plus „Verfügbar“ macht sie für Antwortvorschläge nutzbar. Die Analyse
schaltet eine vorherige Freigabe wieder aus. Gesichtserkennung und sensible
Eigenschaftsableitung sind nicht Bestandteil der Funktion.

## Suche und Anfertigung

Die Suche arbeitet konservativ mit geprüften Schlagwörtern: Alle erkannten
Motivwörter müssen passen. Allgemeine, uneindeutige, zu lange oder nicht
vollständig passende Anfragen bleiben unbestätigt. Die Funktion ist keine
allgemeine semantische Bildsuchmaschine. Bis zu drei passende geprüfte Bilder
werden mit ID und Revision gebunden; ihre tatsächliche private Datei wird vor
und nach der Modellausführung mit der Nutzerberechtigung geprüft. Preise dürfen
nur zum explizit verknüpften, aktiven Angebot desselben Characters gehören.

Unter „Kostenpflichtige Anfertigungen“ werden ein vorhandenes aktives Angebot
der Kategorie `custom`, erlaubte Motive und eine Lieferfrist von 1–720 Stunden
ausgewählt. Preis und Beschreibung bleiben ausschließlich im bestehenden
Character-Verkaufsplan. Eine zusätzliche Bestätigungspflicht sperrt autonome
Zusagen. „Innerhalb von 24 Stunden“ ist nur nach ausdrücklicher entsprechender
Konfiguration möglich. Bestehende Verkaufsstopps, Nachbetreuung, Ablehnungen und
Character-Grenzen bleiben maßgeblich. Fehlende Daten erlauben keine Zusage.
Der Mensch prüft, bearbeitet, kopiert und sendet; keine automatische Bildlieferung,
Bestellung, Zahlung oder externe Nachricht wird ausgelöst.

## Speicherung, Zugriff und Löschung

`supabase/controlled/chat_admin_media.sql` ist ein separater **unapplied**
Vertrag. Der private Bucket `chat-character-media` ist nicht der vorhandene
Profilbild-Bucket und kein öffentlicher Admin-Asset-Speicher. Er enthält nur
unveränderliche Schlüssel `<workspace>/<character>/<uuid>.webp`.
`chat_character_media` und `chat_character_media_policies` haben RLS,
komposite Character-Bindung und beschränkte Client-Spaltenrechte.

APIs verwenden das bestehende Owner-/Capability-Verfahren und den Nutzer-JWT.
Jede Vorschau läuft über einen erneut autorisierten Proxy mit `private,
no-store`, ohne öffentliche oder langlebig signierte URL. Ein inaktiver
Character erlaubt keine neue Bildverwendung; seine Bilder bleiben löschbar.
Jede Medien-/Regeländerung erhöht die Character-Revision in derselben
Datenbanktransaktion. Ein Bucket-spezifischer Storage-INSERT-Trigger nimmt dieselbe Character-Sperre und prüft danach Metadaten und Löschstatus erneut; ein verspäteter Upload darf die Dateibereinigung nicht überholen. Bestehende revisiongebundene Generation und Bestätigung
sowie ein zusätzlicher Replay-Check verwerfen dadurch veraltete Vorschläge.

Löschen entzieht zuerst Verfügbarkeit/Freigabe. Die Datei muss danach tatsächlich
entfernt sein; erst dann darf der Metadatensatz verschwinden. Ein Fehlschlag
bleibt als wiederholbar bereinigbarer Eintrag sichtbar. Die Datenbank verhindert
Metadaten- und Character-Löschung, die eine vorhandene private Datei verwaisen
lassen würde. Der bestehende geschützte Account-Löschprozessor bereinigt und
prüft die Dateien vor der Auth-Löschung anhand seines atomaren eigenen
Workspace-Inventars; neue Medien-/Regelschreibungen sind während `processing`
gesperrt. Exportiert werden die Bildangaben und Anfertigungsregeln; Bilddateien
sind über die private Vorschau zugänglich und nicht Teil des PDF-Exports.

## Betrieb und Freigabegrenze

- `FANMIND_CHAT_ADMIN_MEDIA_ENABLED=false`: Bibliothek und neue Datenzugriffe aus.
- `FANMIND_CHAT_ADMIN_MEDIA_ANALYSIS_ENABLED=false`: Bildübertragung zur KI aus.
- Maximal 100 Bibliothekseinträge je Character; ein überschrittenes Inventar
  sperrt die normale Verwendung statt eine unvollständige Suche zu behaupten.
- Analyse: ein normalisiertes Bild je bestätigtem Aufruf, höchstens 2048
  Ausgabetokens, bestehendes Premium-Modell und 55-Sekunden-Grenze. Gemeinsame
  Rate-Limits begrenzen auf 5 Aufrufe pro zehn Minuten und 30 je Tag/Workspace;
  fehlende Limit-Infrastruktur sperrt den Aufruf. Die bestehende Usage-Erfassung
  verwendet `chat_admin_reply` mit separater Quellroute und Provider-Tokenzahlen.
  Keine neue Providerberechtigung oder Zugangsdaten werden eingerichtet.

Vor einer Installation: exakten freigegebenen Commit und Ziel festhalten,
vorhandenen Schema-/Bucket-Zustand und Sicherung prüfen, native PG17-Negativtests
und unabhängige Prüfung bestehen. Das SQL läuft nie beim normalen Web-Deploy.
Nach separater Installation beide Schalter zunächst aus lassen; RLS, private
Dateioperationen, Löschung, Export/Account-Löschung und synthetischen UI-Flow am
exakten Ziel abnehmen. Erst dann die Bibliothek einschalten. Bildanalyse und
echte Bildübertragung benötigen ihre eigene Provider-/Datenschutzfreigabe.
Recovery vor Nutzung: Schalter aus und Source-Revert. Nach Nutzung keine
Tabellen-/Bucket-Drops: Verfügbarkeit entziehen, Dateien verifiziert bereinigen
und bestehende Daten aufbewahren, bis die Löschung bestätigt ist.

Die bestehende #1219-Staging-Abnahme bleibt offen. Lauf 42041782472 scheiterte
mit HTTP 2xx bei `invented_price`; vor einem weiteren Zielschreiblauf ist dessen
`inflight_reconciliation_required` unabhängig zu klären. Die konkrete
Source-Ursache wurde reproduziert: selbst angelegte Angebote haben Kategorie
`custom`; „Ist … erhältlich?“ wurde nicht als konkrete Anfrage erkannt. Die
Erkennung umfasst nun begrenzte DE/EN-Verfügbarkeits-/Angebotsfragen, und
Fan-Preisangaben verlangen in allen drei Varianten den hinterlegten Preis.
Synthetische Tests ersetzen keine erfolgreiche neue Live-Abnahme.

# FanMind aktive Chat-Testdaten

## Dateien

- `docs/testdata/fanmind_active_chat_contacts.csv`
- SQL-Seed lokal erzeugt: `fanmind_active_chat_seed.sql`

## Wichtig

Die aktuelle CSV-Importfunktion von FanMind importiert nur Kontakte. Sie importiert keine Conversation Messages.

Unterstützte CSV-Spalten sind aktuell:

- `name` / `display_name`
- `handle`
- `platform` / `source_platform`
- `language`
- `status`
- `tags`
- `summary`

Damit ein Fan im Detailbereich echte Timeline-Nachrichten und KI-Antwortvorschläge bekommt, müssen zusätzlich Datensätze in `conversations` und `conversation_messages` vorhanden sein.

## Testablauf

1. `fanmind_active_chat_contacts.csv` unter `/fans/import` importieren.
2. Danach den SQL-Seed im Supabase SQL Editor ausführen, um echte Nachrichten zu den Testkontakten anzulegen.
3. FanMind neu laden.
4. Einen der neuen Kontakte öffnen, z. B. Mara König oder Niko Steiner.
5. `KI-Vorschläge erzeugen` klicken.
6. Danach `/admin/ai-usage` prüfen.

## Erwartung

- Fan-Detail zeigt einen gespeicherten Nachrichtenverlauf.
- KI-Antwortvorschläge können erzeugt werden.
- `/admin/ai-usage` zeigt mindestens einen Usage-Eintrag oder eine Aggregation.
- Keine Prompt- oder Antwortvolltexte werden im Adminbereich angezeigt.

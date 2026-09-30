# FanMind KI-Nutzungsanzeige

Stand: Juli 2026

## Zweck

Die Seite `/settings/ai-usage` zeigt einem authentifizierten Workspace die im aktuellen Kalendermonat protokollierte KI-Nutzung. Sie dient der Transparenz und verwendet ausschließlich serverseitig geladene Daten aus `ai_usage_events`.

Angezeigt werden:

- Anzahl protokollierter KI-Aktionen;
- erfolgreiche, fehlerhafte und übersprungene Aufrufe;
- geschätzte Eingabe-, Ausgabe- und Gesamttokens;
- Aufteilung nach Funktion;
- die letzten zehn KI-Ereignisse ohne Nachrichteninhalte;
- optionale Soft-Hinweisgrenzen.

## Keine erfundene Kontingentlogik

Solange die exakten enthaltenen AI-Budgets der 99-/199-/312-€-Pakete noch nicht anhand realer Nutzung freigegeben wurden, zeigt FanMind ausdrücklich:

- AI-Kapazität wird gemessen, aber noch kein vertraglicher Restbetrag behauptet;
- keine automatische Sperre oder Nachberechnung aus unfertigen Budgets;
- interne Provider-/Modell-/Tokenkosten bleiben serverseitig;
- Schnell / Ausgewogen / Premium ist eine Qualitätswahl, keine separate Plus/Ultra-Buchung;
- nachgekaufte Kapazität wird erst nach finaler Top-up-Preis-/Gültigkeitsfreigabe angezeigt.

## Optionale serverseitige Soft-Hinweise

```env
FANMIND_AI_STANDARD_SOFT_REQUEST_WARNING=
FANMIND_AI_STANDARD_SOFT_TOKEN_WARNING=
```

Leere Werte bedeuten Messung ohne Hinweisgrenze. Konfigurierte Werte erzeugen folgende rein informative Zustände:

- unter 80 Prozent: normal;
- ab 80 Prozent: Hinweisgrenze nähert sich;
- ab 100 Prozent: Hinweisgrenze erreicht.

Keiner dieser Zustände blockiert KI-Aufrufe oder verändert Rechnungen.

Davon getrennt schützen technische Kurzzeit-, Kontext- und Ausgabegrenzen den
Dienst vor Missbrauch und unkontrollierten Providerkosten. Diese
Betriebsgrenzen sind keine vertraglichen KI-Standard-/Plus-/Ultra-Kontingente
und erzeugen keine Nachberechnung.

## Datenschutz und Berechtigung

- Die Seite ist nur nach Authentifizierung erreichbar.
- Der Workspace wird aus der serverseitig geprüften Session bestimmt.
- Es werden keine Prompt-, Nachrichten- oder Antwortinhalte angezeigt.
- Die Nutzeransicht zeigt keine internen Kostenwerte.
- Der Service-Role-Key bleibt ausschließlich serverseitig.

## Spätere AI-Kapazitätsfreigabe

Verbindliche Restkapazität wird erst angezeigt, wenn die enthaltenen Monatsbudgets, Top-up-Preise und Top-up-Gültigkeit freigegeben sowie atomare Monats-/Top-up-Verbuchung abgenommen sind. Das frühere KI-Plus-/KI-Ultra-Produktmodell wird nicht reaktiviert.

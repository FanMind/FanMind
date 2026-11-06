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

Solange keine verbindlichen KI-Standard-, Plus- oder Ultra-Kontingente beschlossen wurden, zeigt FanMind ausdrücklich:

- kein vertragliches Kontingent aktiv;
- keine automatische Sperre aktiv;
- keine automatische Nachberechnung;
- Tokenwerte sind Schätzwerte;
- Soft-Hinweisgrenzen dienen nur der Orientierung.

Die Anzeige darf nicht mit Begriffen wie „Restguthaben“, „harte Grenze“ oder „zusätzliche Kosten“ arbeiten, solange diese Produkt- und Billing-Logik nicht freigegeben ist.

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

## Spätere KI Plus/Ultra-Freigabe

Erst nach einer schriftlichen Entscheidung zu Preisen, Modellen, Kontingenten, Wechsel/Kündigung und Billing dürfen aus Soft-Hinweisen verbindliche Paketgrenzen werden. Bis dahin bleiben KI Plus und KI Ultra als Coming Soon markiert.

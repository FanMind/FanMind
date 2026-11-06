# Entscheidungsvorlage für KI Standard, Plus und Ultra

Stand: 3. August 2026

## Zweck und Status

Diese Vorlage bündelt die noch offenen fachlichen Entscheidungen, damit die
KI-Stufen später einmal vollständig und widerspruchsfrei freigegeben werden
können. Sie ist **keine Freigabe**. Solange die Entscheidungstabelle nicht
vollständig beschlossen, geprüft und datiert ist, bleiben KI Plus und KI Ultra
`Coming Soon`, technisch blockiert und nicht automatisch buchbar.

Der aktuelle Codezustand bleibt unverändert:

- KI Standard ist im Starter-Paket enthalten;
- KI Plus kostet nach Freigabe zusätzlich 100 € pro Monat;
- KI Ultra kostet nach Freigabe zusätzlich 200 € pro Monat;
- es gibt keine automatische Sendung;
- KI-Add-ons erhalten keinen Referral-Rabatt;
- technische Kurzzeit-, Kontext- und Ausgabegrenzen bleiben
  Missbrauchs-/Kostenschutz und sind keine Vertragskontingente;
- Stripe-Entitlements, Migrationen oder produktive Tier-Routen werden durch
  dieses Dokument weder aktiviert noch angewendet.

## Beschlusspflichtige Matrix

`UNENTSCHIEDEN` darf erst durch einen schriftlich bestätigten Wert ersetzt
werden. Provider-Modellnamen, Stripe-IDs und Secrets gehören nicht in diese
attachierbare Entscheidungsvorlage; sie werden später ausschließlich in der
serverseitigen Konfiguration hinterlegt.

| Entscheidung | KI Standard | KI Plus | KI Ultra |
| --- | --- | --- | --- |
| Öffentlicher Status | Aktiv | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Monatlicher Add-on-Preis | im Basispaket enthalten | 100 € | 200 € |
| Freigegebene Modellklasse | UNENTSCHIEDEN | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Vertragskontingent Anfragen/Monat | UNENTSCHIEDEN | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Vertragskontingent Tokens/Monat | UNENTSCHIEDEN | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Gesprächskontext in Nachrichten | 50 | 100 | 150 |
| Verhalten bei 80 % | UNENTSCHIEDEN | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Verhalten bei 100 % | UNENTSCHIEDEN | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Nachberechnung/Overage | UNENTSCHIEDEN | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Automatisch buchbar | nein | UNENTSCHIEDEN | UNENTSCHIEDEN |
| Automatische Sendung | nein | nein | nein |
| Referral-Rabatt | nein | nein | nein |

## Nicht aktivierende Arbeitsempfehlung

Damit die offenen Felder nicht nur abstrakt beschrieben bleiben, liegt eine
datierte, rechnerisch prüfbare Arbeitsempfehlung vor. Sie ersetzt keinen
`UNENTSCHIEDEN`-Wert und besitzt keine Aktivierungswirkung.

| Entscheidung | KI Standard | KI Plus | KI Ultra |
| --- | --- | --- | --- |
| Modellklasse | effizient / hohes Volumen | ausgewogen | Frontier |
| Anfragen/Monat | 750 | 1.500 | 2.000 |
| Tokens/Monat | 3.000.000 | 6.000.000 | 8.000.000 |
| Gesprächskontext | 50 Nachrichten | 100 Nachrichten | 150 Nachrichten |
| Verhalten bei 80 % | Workspace-Hinweis + Admin-Warnung | Workspace-Hinweis + Admin-Warnung | Workspace-Hinweis + Admin-Warnung |
| Verhalten bei 100 % | fail-closed bis Monatsreset | fail-closed bis Monatsreset | fail-closed bis Monatsreset |
| Nachberechnung/Overage | keine automatische Nachberechnung | keine automatische Nachberechnung | keine automatische Nachberechnung |
| Automatisch buchbar | nein | erst nach allen Freigabekriterien | erst nach allen Freigabekriterien |

Herleitung, datierter Preis-Snapshot, konservative Kostenszenarien und der
reproduzierbare Check stehen in
`AI_TIER_COST_AND_QUOTA_RECOMMENDATION.md`. Die aktive zentrale Policy behält
für alle noch nicht beschlossenen Modell-/Kontingentfelder weiterhin `null`.

Die geschützte Adminansicht `/admin/ai-usage` stellt die reale
Entscheidungsgrundlage technisch bereit: Für erfolgreiche, konsistente
Usage-Ereignisse zeigt sie je Feature Stichprobengröße sowie nearest-rank P50,
P90 und P95 für Input-, Output- und Gesamttokens. Historische Fallbackwerte
können geschätzt sein; bei erreichter 10.000-Ereignis-Grenze gilt die
Verteilung ausdrücklich nur für die geladene Stichprobe. Diese Beobachtung
füllt keinen `UNENTSCHIEDEN`-Wert automatisch aus.

## Paketwechsel und Abrechnung

Vor technischer Aktivierung müssen zusätzlich diese Regeln eindeutig
beschlossen sein:

| Thema | Beschluss |
| --- | --- |
| Wirksamkeit Upgrade | UNENTSCHIEDEN |
| Wirksamkeit Downgrade | UNENTSCHIEDEN |
| Anteilige Berechnung beim Wechsel | UNENTSCHIEDEN |
| Kündigung des Add-ons | UNENTSCHIEDEN |
| Verhalten bei `past_due`/`paused` | UNENTSCHIEDEN |
| Verhalten nach Starter-Vertragsende | fail-closed; produktive KI bleibt deaktiviert |
| Rückerstattung/Gutschrift | UNENTSCHIEDEN |
| Steuerliche Darstellung | UNENTSCHIEDEN |

## Empfohlene Entscheidungsreihenfolge

1. Zielgruppe und Nutzen je Stufe festlegen.
2. Modellklassen und serverseitige Provider-Zuordnung freigeben.
3. Reale Kostenmessung aus `ai_usage_events` auswerten.
4. Die nicht aktivierende Arbeitsmatrix mit realen Median-/P90-/P95-Werten
   und dem repräsentativen, verblindeten Qualitäts-Eval aus
   `AI_REPLY_QUALITY_EVAL.md` prüfen. Die am 3. August 2026 beschlossene
   50/100/150-Kontextstaffel ist davon ausgenommen und bereits in der zentralen
   Policy verankert; sie aktiviert Plus oder Ultra nicht.
5. Monatskontingente mit mindestens 30 Prozent Kostenpuffer beschließen und
   die bereits festgelegten Kontextgrenzen in Staging belasten.
6. Verhalten bei 80 % und 100 % sowie Overage festlegen.
7. Upgrade-, Downgrade-, Kündigungs- und Prorationsregeln beschließen.
8. Rechtliche, steuerliche und öffentliche Texte prüfen.
9. Getrennte Stripe-Test-Prices für Plus und Ultra bereitstellen.
10. Staging-Migration und rollback-only Akzeptanz vollständig grün nachweisen.
11. Erst danach zentrale Policy, Billing und öffentliche Anzeige in einem
    separat geprüften Aktivierungs-PR umstellen.

## Technische Freigabekriterien

Eine spätere Aktivierung darf nur erfolgen, wenn alle Punkte nachweislich
erfüllt sind:

- die Matrix und alle Abrechnungsregeln enthalten keinen
  `UNENTSCHIEDEN`-Wert mehr;
- `src/config/aiTiers.mjs`, `docs/SOURCE_OF_TRUTH.md`, README, Sales-Texte und
  öffentliche Paketdarstellung stimmen exakt überein;
- serverseitige Stripe-Prices sind getrennt, im richtigen Modus und für exakt
  100 €/200 € monatlich geprüft;
- jede Stufe besitzt eine dedizierte serverseitige Provider-Modellzuordnung
  und ein davon unterschiedliches, getestetes Fallback-Modell;
- Workspace-Felder und Entitlements bleiben server-owned und RLS-/Rollen-Tests
  sind positiv und negativ grün;
- Staging-Migration, Lifecycle-Reihenfolge, Idempotenz und Rollback sind grün;
- Anfrage-/Tokenkontingente und Kontextgrenzen werden in jedem produktiven
  KI-Einstiegspunkt serverseitig und fail-closed durchgesetzt;
- Qualitäts-/Kosten-Eval, Rechts-/Steuerfreigabe, Staging-Akzeptanz,
  produktive Runtime-Integration und ausdrückliche Production-Aktivierung
  sind für Plus und Ultra jeweils separat bestätigt;
- Kosten-, Missbrauchs-, Datenschutz- und manuelle Versandgrenzen bleiben
  wirksam;
- `npm run ai:tiers:readiness` meldet die beabsichtigte Matrix ohne Secrets
  oder konkrete externe IDs auszugeben;
- eine ausdrückliche Production-Freigabe liegt vor.

## Schriftliche Freigabe

Die folgenden Felder werden erst nach vollständiger Entscheidung ausgefüllt:

```text
Fachlich freigegeben von: UNENTSCHIEDEN
Technisch freigegeben von: UNENTSCHIEDEN
Recht/Steuer geprüft von: UNENTSCHIEDEN
Freigabedatum (UTC): UNENTSCHIEDEN
Ziel-Release-Commit: UNENTSCHIEDEN
```

Ohne diese vollständige Freigabe bleibt der bestehende fail-closed Zustand
maßgeblich.

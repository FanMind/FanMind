# Kosten- und Kontingentempfehlung für KI-Stufen

Stand: 30. Juli 2026

## Status

Dieses Dokument ist eine technische, **nicht aktivierende Empfehlung**. Es
ändert weder die zentrale Laufzeit-Policy noch Billing, Stripe, Entitlements,
Migrationen oder öffentliche Buchbarkeit. Die beschlusspflichtigen Felder in
`AI_TIER_DECISION_PROPOSAL.md` bleiben bis zur schriftlichen Freigabe
`UNENTSCHIEDEN`.

Die maschinenlesbare Arbeitsgrundlage liegt getrennt in
`src/config/aiTierRecommendation.mjs`. Produktive KI-Pfade importieren sie
nicht. Der bestehende fail-closed Zustand in `src/config/aiTiers.mjs` bleibt
maßgeblich.

## Datiertes Provider-Fundament

Die OpenAI-Modellübersicht vom 30. Juli 2026 ordnet die GPT-5.6-Familie so ein:

| FanMind-Arbeitsklasse | Technische Provider-Empfehlung | Uncached Input / 1 Mio. Tokens | Output / 1 Mio. Tokens |
| --- | --- | ---: | ---: |
| effizient / hohes Volumen | `gpt-5.6-luna` | 0,20 USD | 1,20 USD |
| ausgewogen | `gpt-5.6-terra` | 2,00 USD | 12,00 USD |
| Frontier | `gpt-5.6-sol` | 5,00 USD | 30,00 USD |

Quellen:

- <https://developers.openai.com/api/docs/models>
- <https://developers.openai.com/api/docs/guides/latest-model>

Die Preise sind kein produktiver Laufzeitwert. Produktionskosten werden
weiterhin ausschließlich über serverseitige Umgebungswerte in
`src/lib/aiUsage.ts` geschätzt. Vor einer Freigabe müssen Verfügbarkeit,
Preise, Modellqualität und Datenschutz erneut geprüft werden.

## Empfohlene Arbeitsmatrix

| Stufe | Modellklasse | Anfragen / Monat | Tokens / Monat | Kontextnachrichten |
| --- | --- | ---: | ---: | ---: |
| KI Standard | effizient / hohes Volumen | 750 | 3.000.000 | 50 |
| KI Plus | ausgewogen | 1.500 | 6.000.000 | 100 |
| KI Ultra | Frontier | 2.000 | 8.000.000 | 150 |

Es gilt jeweils die zuerst erreichte Grenze. Der Token-Cap ist der primäre
Kostenschutz; die Anfragegrenze begrenzt zusätzlich Missbrauch und extrem
kurze Massenanfragen.

Empfohlenes Verhalten:

- ab 80 Prozent: deutlicher Workspace-Hinweis plus Admin-Warnung;
- bei 100 Prozent: weitere KI-Aufrufe bis zum Monatsreset fail-closed
  blockieren;
- keine automatische Nachberechnung und keine überraschenden Overage-Kosten;
- keine automatische Sendung;
- Plus/Ultra erst nach vollständiger fachlicher, technischer, rechtlicher,
  Stripe- und Staging-Freigabe buchbar machen.

## Konservative Kostenszenarien

Für eine reproduzierbare Vergleichsbasis nimmt der Rechner 75 Prozent
Input- und 25 Prozent Output-Tokens, uncached Standardverarbeitung und die
vollständige Ausschöpfung des Token-Caps an.

| Stufe | Input-Tokens | Output-Tokens | Geschätzte Providerkosten |
| --- | ---: | ---: | ---: |
| KI Standard | 2.250.000 | 750.000 | 1,35 USD |
| KI Plus | 4.500.000 | 1.500.000 | 27,00 USD |
| KI Ultra | 6.000.000 | 2.000.000 | 90,00 USD |

Diese Werte sind keine Marge und keine Abrechnung. Nicht enthalten sind unter
anderem Wechselkurs, Steuern, Retries, Fehler, zusätzlicher Reasoning-Verbrauch,
Cache-Schreibkosten, Tool-Kosten und zukünftige Preisänderungen. Für einzelne
Prompts oberhalb von 272.000 Input-Tokens nennt OpenAI außerdem höhere
Langkontextpreise; FanMinds bestehende Kontextgrenzen liegen deutlich darunter
und dürfen vor einer Freigabe nicht ungeprüft angehoben werden.

## Reproduzierbarer Check

```bash
npm run ai:tiers:recommendation
```

Der Befehl gibt ausschließlich die Arbeitsklasse, Kontingente,
Kontextnachrichten und das Kosten-Szenario aus. Er zeigt keine Secrets, führt
keinen Provider- oder Stripe-Aufruf aus und endet mit:

```text
AI_TIER_RECOMMENDATION=PASS activation=none
```

## Voraussetzungen für eine echte Entscheidung

1. Mindestens vier vollständige Wochen reale, datenschutzkonforme
   `ai_usage_events` je relevantem Workspace-Segment auswerten.
2. Die in `/admin/ai-usage` vorbereiteten nearest-rank P50-, P90- und
   P95-Werte für Input-, Output- und Gesamt-Tokens je Feature über diesen
   vollständigen Zeitraum prüfen; Stichprobengröße, Schätz-Fallbacks und eine
   mögliche 10.000-Ereignis-Begrenzung ausdrücklich berücksichtigen.
3. Antwortqualität der drei Modellklassen auf einem repräsentativen,
   anonymisierten und verblindeten Eval-Set vergleichen. Der datensparsame
   Offline-Vertrag und der nicht aktivierende Prüfbefehl sind in
   `AI_REPLY_QUALITY_EVAL.md` beschrieben.
4. Kostenrechnung mit aktuellen Providerpreisen, Wechselkurs, Steuern,
   Fehlerrate und mindestens 30 Prozent Sicherheitspuffer wiederholen.
5. Produkt-, Billing-, Rechts- und Steuerentscheidungen schriftlich
   freigeben.
6. Erst danach die aktive Policy in einem separaten Aktivierungs-PR ändern.

# Privater Antwortqualitäts-Eval für KI Standard, Plus und Ultra

Stand: 31. Juli 2026

## Zweck und Grenze

Dieser Ablauf bereitet den noch offenen Qualitätsvergleich der drei
KI-Arbeitsklassen vor. Er ist rein offline und besitzt **keine
Aktivierungswirkung**. Er ruft weder OpenAI noch Stripe auf, verändert keine
Entitlements und füllt keinen `UNENTSCHIEDEN`-Wert in der KI-Entscheidung aus.

Prompts und Antworten bleiben außerhalb von Git. Dasselbe gilt für
Kontaktwerte, Nachrichten, Reviewer-Identitäten, Provider-Modellnamen und die
verblindete Zuordnung zwischen Varianten und Modellen. Das Repository
verarbeitet ausschließlich die nach der menschlichen Blindbewertung
übertragenen numerischen Ergebnisse.

## Mindestabdeckung

Ein gültiger Lauf benötigt:

- mindestens 12 und höchstens 120 anonymisierte oder synthetische Fälle;
- die Segmente `creator` und `business`;
- die Sprachen `de` und `en`;
- die Szenarien `reply_suggestion`, `contact_knowledge` und `follow_up`;
- pro Fall genau je eine Bewertung für `standard`, `plus` und `ultra`;
- pro Kandidat zwei bis fünf voneinander unabhängige Reviews;
- ganzzahlige Werte von 1 bis 5 für Grounding, Relevanz, Ton und Safety;
- getrennte boolesche Prüfungen der manuellen Versandgrenze und des
  Datenschutzes.

Die Reviewer sehen nur neutrale Varianten. Erst nach Abschluss der Bewertung
ordnet eine berechtigte Person die numerischen Ergebnisse den drei
FanMind-Stufen zu. Provider-Modellnamen gehören auch danach nicht in die
Ergebnisdatei.

## Private Ergebnisdatei

Die lokale Datei liegt unter:

```text
docs/operations/private-ai-evals/results.json
```

Das gesamte Verzeichnis ist von Git ausgeschlossen. Die Datei darf nur diese
Struktur enthalten:

```json
{
  "schemaVersion": 1,
  "asOf": "2026-07-31",
  "datasetRef": "sha256:<64 hex characters>",
  "cases": [
    {
      "id": "case-synthetic-001",
      "segment": "creator",
      "locale": "de",
      "scenario": "reply_suggestion",
      "candidates": [
        {
          "tier": "standard",
          "reviews": [
            {
              "groundedness": 4,
              "relevance": 4,
              "tone": 4,
              "safety": 5,
              "manualSendBoundary": true,
              "privacySafe": true
            },
            {
              "groundedness": 4,
              "relevance": 5,
              "tone": 4,
              "safety": 5,
              "manualSendBoundary": true,
              "privacySafe": true
            }
          ]
        }
      ]
    }
  ]
}
```

Das Beispiel zeigt bewusst nur einen Kandidaten. Ein ausführbarer Datensatz
muss pro Fall alle drei Stufen sowie die vollständige Mindestabdeckung
enthalten. Zusätzliche Felder wie Prompt, Antwort, Name, E-Mail, Handle,
Reviewer oder Modell werden abgelehnt.

## Ausführung

```bash
npm run ai:reply-quality:eval
```

Der Prüfer gibt ausschließlich Fallzahl, Abdeckungsstatus und aggregierte
Basiswerte je Stufe aus. Er gibt weder Dateipfad, Dataset-Hash, Fall-IDs,
Rohtexte, Reviewer noch Modellnamen aus. Der Abschluss lautet:

```text
AI_REPLY_QUALITY_EVAL_VALID=true
AI_REPLY_QUALITY_EVAL_ACTIVATION=none
```

`VALID=true` bestätigt nur Schema, Mindestabdeckung und reproduzierbare
Aggregation. Es ist keine Qualitäts-, Tarif-, Kosten-, Rechts-, Billing- oder
Production-Freigabe. Die finale Entscheidung benötigt weiterhin vier Wochen
reale Usage-Daten, aktuelle Kosten, fachliche Bewertung, Staging, Stripe sowie
Rechts- und Steuerfreigabe.

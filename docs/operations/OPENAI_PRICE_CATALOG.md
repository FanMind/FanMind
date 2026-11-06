# FanMind OpenAI Price Catalog

Stand: 2026-09-30

FanMind pins OpenAI model selection and provider pricing server-side. Customer labels
remain **Schnell**, **Ausgewogen** and **Premium**; the underlying OpenAI model is a
versioned implementation detail.

## Current quality policy

| FanMind mode | OpenAI model | Reasoning | Purpose |
| --- | --- | --- | --- |
| Schnell | `gpt-6-luna` | `low` | fastest/cost-efficient communication analysis and reply generation |
| Ausgewogen | `gpt-6.1-sol` | `medium` | balanced quality, latency and provider cost |
| Premium | `gpt-6-astra` | `max` | highest-quality approved model for demanding analysis and replies |

Premium does **not** use a floating `latest` alias. It points to the strongest
approved model in the current FanMind catalog version. When OpenAI releases a
better suitable model, FanMind creates a new reviewed catalog version and only
then moves Premium. This keeps historical settlement reproducible.

FanMind's quality label **Schnell** is not OpenAI's paid Fast processing tier.
All three current profiles use OpenAI Standard processing. Any future Fast,
Flex, Batch, regional or other processing tier requires its own explicit price
entry and review.

## Catalog version

Current catalog: `openai-2026-09-30-gpt6-standard-v1`.

Source observation date: 2026-09-30.

Official provider sources:
- https://developers.openai.com/api/docs/models/gpt-6-luna
- https://developers.openai.com/api/docs/models/gpt-6.1-sol
- https://developers.openai.com/api/docs/models/gpt-6-astra
- https://developers.openai.com/api/docs/pricing

Prices are stored as integer **USD micro-units per one million tokens**, not
floating-point ledger money.

### Standard processing, short context

| Model | Input | Cached input | Cache write | Output |
| --- | ---: | ---: | ---: | ---: |
| `gpt-6-luna` | $0.10 | $0.01 | $0.125 | $0.50 |
| `gpt-6.1-sol` | $2.00 | $0.10 | $2.50 | $10.00 |
| `gpt-6-astra` | $10.00 | $1.00 | $12.50 | $50.00 |

### Standard processing, long context

OpenAI applies long-context pricing when input exceeds 272,000 tokens.

| Model | Input | Cached input | Cache write | Output |
| --- | ---: | ---: | ---: | ---: |
| `gpt-6-luna` | $0.20 | $0.02 | $0.25 | $0.75 |
| `gpt-6.1-sol` | $4.00 | $0.20 | $5.00 | $15.00 |
| `gpt-6-astra` | $20.00 | $2.00 | $25.00 | $75.00 |

## Settlement boundary

The catalog is the provider-cost source for the upcoming
Reserve -> Settle/Release -> capacity-consumption flow.

- Reserve uses the selected FanMind quality profile, its pinned model and a
  conservative upper-bound usage estimate.
- Settle uses the actual provider usage returned by OpenAI plus the exact price
  entry valid for the model, processing tier, context class and occurrence
  time.
- Missing or ambiguous price entries fail closed. Monitoring estimates must
  never settle the Capacity-v2 ledger.
- Regional-processing uplifts are not silently inferred. The current catalog
  covers non-regional Standard processing only.
- Provider USD cost and FanMind customer capacity/margin remain separate
  accounting layers. FX and the FanMind commercial uplift are applied in the
  later Capacity-v2 settlement layer, not inside this provider price catalog.

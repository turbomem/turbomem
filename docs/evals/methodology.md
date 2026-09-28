---
title: Eval methodology
description: How turbomem scores memory quality, which models and k we use, and what the numbers do not mean.
---

# Methodology

Every public number is tied to a JSON snapshot with `gitSha`, date, models, storage, and `searchLimit`. If those fields are missing, the number is incomplete.

## Pipeline

```
messages or gold facts
  → TurboMemory.add / addFacts  (extract → embed → write-time dedup)
  → TurboMemory.search(query, { userId, limit: k })
  → (LoCoMo only) short-answer LLM over retrieved facts
  → score
```

Default **published** config:

| Knob | Value |
| ---- | ----- |
| Storage | PGlite, in-memory |
| Embeddings | OpenAI `text-embedding-3-small` |
| Extraction | `gpt-4.1-mini` |
| Answer model (LoCoMo) | `gpt-4.1-mini` |
| Search `k` | 10 |
| Dedup | enabled (library default) |

Smoke runs may replace embeddings with a local hash vector. Those runs set `config.embeddings` to `"hash"` and must not be published.

## Scoring

- **Retrieval** - recall@1, recall@5, MRR against gold fact strings (case-insensitive exact content match).
- **Extraction** - LLM-as-judge precision/recall against gold facts, plus a cosine coverage score as a secondary number.
- **Dedup** - final store size and required strings after sequential writes.
- **Scoping** - leak rate across `userId` / `sessionId` (target 0).
- **LoCoMo** - official category-aware token F1 (Porter stem + a/an/the/and stripping). **Not** LLM-as-judge. See [LoCoMo](/evals/locomo).

Latency is p50/p95 of `addFacts` / `search` on PGlite in this harness. It is an architecture measurement, not an SLA.

## What we do not claim

- We do not publish a competitor column (Mem0, Zep, or others).
- We do not treat LoCoMo F1 as comparable to another vendor’s number unless the snapshot matches their judge, `k`, dataset file, and ingest protocol.
- We do not claim hybrid / BM25 retrieval (turbomem search is dense cosine KNN).
- We do not auto-update the marketing page on every commit. A human freezes `latest.json` with `--publish`.

## Reproducibility

```bash
pnpm --filter @turbomem/evals test
pnpm --filter @turbomem/evals download-locomo
pnpm --filter @turbomem/evals evals -- --suite all --publish --sync-landing
```

Details: [Running evals](/evals/running).

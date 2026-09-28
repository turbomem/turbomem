---
title: Evals
description: Public memory evals for turbomem — product goldens and LoCoMo, with a frozen snapshot you can reproduce.
---

# Evals

turbomem publishes a frozen eval snapshot so customers can inspect **how memory quality is measured**, not just a marketing claim.

Numbers live on [turbomem.dev/evals](https://turbomem.dev/evals). The snapshot file is [`packages/evals/results/latest.json`](https://github.com/turbomem/turbomem/blob/main/packages/evals/results/latest.json) in the library repo.

| Suite | What it measures | Headline metric |
| ----- | ---------------- | --------------- |
| **Product** | Extraction, semantic retrieval, dedup, scope isolation, local latency | recall@5, leak rate |
| **LoCoMo** | Multi-session conversational QA after `add` + `search` | official token F1 |

This page is the index. Read next:

- [Methodology](/evals/methodology) — pipeline, models, `k`, what we do not claim
- [LoCoMo protocol](/evals/locomo) — dataset IDs, scoring, ingest
- [Product goldens](/evals/product) — dataset cards
- [Running evals](/evals/running) — commands, cost, CI

A snapshot with `"published": false` is a harness check, not a public score. Do not cite hash-embedding smoke runs as semantic recall.

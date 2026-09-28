---
title: Product eval goldens
description: Dataset cards for turbomem product evals - extraction, retrieval, dedup, scoping, latency.
---

# Product goldens

First-party cases in `packages/evals/datasets/product/`. They track claims in the docs and blog (hiking / marathon / vegetarian, scoped search, write-time dedup), not LoCoMo.

## Extraction

Transcripts with a gold fact list. Live runs call `TurboMemory.add` (real extractor) and score with an LLM judge (paraphrases allowed) plus cosine coverage of gold vs extracted embeddings.

The `noise-only` case expects no durable facts from “Thanks!” / “Can you rephrase that?”.

## Retrieval

`addFacts` then `search`. Metrics: recall@1, recall@5, MRR. Gold is exact fact strings.

Smoke runs substitute `smokeQuery` (keyword overlap) and hash embeddings so CI does not need an API key. Those recall numbers are **plumbing checks**, not semantic quality.

## Dedup

Sequential `addFacts` under `skip` or `replace`. Checks final row count and required substrings. The more-specific replace case is live-only (needs similar embeddings above the 0.92 threshold).

## Scoping

Writes for `alice` / `bob` and mismatched `sessionId`. A leak is any hit from the wrong user, or any hit when the session should be empty. Target leak rate is 0.

## Latency

Timed `addFacts` and `search` on in-memory PGlite. Report p50/p95 only as a local-path illustration, not a hosted SLA.

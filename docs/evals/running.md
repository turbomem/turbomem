---
title: Running evals
description: How to run turbomem product and LoCoMo evals locally and in CI.
---

# Running evals

The harness is the private workspace package `@turbomem/evals`.

## Prerequisites

- Node 20+
- `pnpm install` in the turbomem repo
- `OPENAI_API_KEY` for live extraction, OpenAI embeddings, LoCoMo answering, and the extraction judge
- LoCoMo file for the LoCoMo suite:

```bash
pnpm --filter @turbomem/evals download-locomo
```

## Cheap CI (no API key)

```bash
pnpm --filter @turbomem/evals test
pnpm --filter @turbomem/evals evals -- --suite product --smoke
```

Product smoke uses hash embeddings. Do not freeze it with `--publish`.

## Full public freeze

```bash
pnpm --filter @turbomem/evals evals -- --suite all --publish --sync-landing
```

`--publish` sets `"published": true` only when LoCoMo ran, embeddings are OpenAI, and the run is not `--smoke`. Copy `packages/evals/results/latest.json` into the marketing site with `--sync-landing` when the `landing/` tree sits next to this repo.

## Flags

| Flag | Meaning |
| ---- | ------- |
| `--suite product\|locomo\|all` | Which suite(s) |
| `--smoke` | Product: hash embeddings. LoCoMo: 1 conversation / 20 questions |
| `--limit n` | Cap LoCoMo questions per conversation |
| `--out path` | Snapshot path (default `results/latest.json`) |
| `--publish` | Mark as the public freeze when the run qualifies |
| `--sync-landing` | Write `landing/src/data/evals.json` if that path exists |
| `--no-write` | Print JSON only |

## Cost

A full LoCoMo pass is expensive: ten long conversations, one extraction call per session, one embed+search per question, plus an answer completion per question. Use `--smoke` or `--limit` while iterating.

## CI

`packages/evals` unit tests run on every PR via [evals.yml](https://github.com/turbomem/turbomem/blob/main/.github/workflows/evals.yml). A full live run is `workflow_dispatch` (and an optional weekly schedule) and uploads an artifact. Scores are not auto-committed.

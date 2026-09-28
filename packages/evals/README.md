# @turbomem/evals

Private eval harness for [turbomem](https://github.com/turbomem/turbomem). Not published to npm.

Two suites:

1. **Product goldens** — extraction, retrieval (recall@k / MRR), dedup, scoping isolation, PGlite latency.
2. **LoCoMo** — ingest `locomo10.json` through `TurboMemory.add`, answer from `search`, score with the official category-aware token F1.

Published numbers live in [`results/latest.json`](results/latest.json) and are shown at [turbomem.dev/evals](https://turbomem.dev/evals). Methodology: [docs.turbomem.dev/evals](https://docs.turbomem.dev/evals).

## Commands

```bash
pnpm --filter @turbomem/evals test          # F1 port, IR, schema, product smoke (no API key)
pnpm --filter @turbomem/evals evals -- --suite product --smoke
pnpm --filter @turbomem/evals download-locomo
pnpm --filter @turbomem/evals evals -- --suite locomo --smoke
pnpm --filter @turbomem/evals evals -- --suite all --publish --sync-landing
```

Live runs need `OPENAI_API_KEY`. Smoke product runs use hash embeddings and must not be cited as semantic recall.

Do not vendor `locomo10.json`. Download it; see LoCoMo's license at [snap-research/locomo](https://github.com/snap-research/locomo).

<p align="center">
  <img src="docs/public/logo.svg" alt="turbomem" width="120" />
</p>

# turbomem

[![npm version](https://img.shields.io/npm/v/turbomem)](https://www.npmjs.com/package/turbomem)

Local-first agent memory for TypeScript. Persistent, semantically searchable memory that runs inside your Node or Bun process, no separate memory server, no Python sidecar.

## Features

- **Embedded runtime**: in-process memory with no HTTP hop per call
- **Semantic search**: LLM fact extraction plus vector embeddings (OpenAI, local WASM, Voyage AI, or Google Gemini)
- **PGlite storage**: WASM Postgres with pgvector; data stays on disk in your app (default)
- **sqlite-vec storage**: optional SQLite backend via `better-sqlite3` + `sqlite-vec`
- **Upstash Vector storage**: optional HTTP backend for edge runtimes (Cloudflare Workers, Vercel Edge)
- **Scoped by user, agent, or session**: multi-tenant friendly out of the box
- **Memory deduplication**: merge, smart replace, or skip overlapping facts on write (enabled by default)
- **Framework adapters**: Mastra and Vercel AI SDK integrations ship as separate packages

## Install

```bash
npm install turbomem
```

Set `OPENAI_API_KEY` for the default OpenAI embeddings and fact-extraction stack. PGlite is included, no extra database setup. For the optional sqlite-vec backend: `npm install better-sqlite3 sqlite-vec`. For edge: `npm install @upstash/vector` — see the [Edge guide](https://turbomem.dev/guide/edge).

Prefer another provider? Embeddings support OpenAI, local (transformers), Voyage AI (`VOYAGE_API_KEY`), and Google Gemini (`GEMINI_API_KEY`); fact extraction supports OpenAI, Anthropic, and Google Gemini (plus any OpenAI-compatible endpoint via a custom `baseURL`). See the [Providers reference](https://turbomem.dev/guide/providers).

## Quick start

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4.1-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

await memory.init();

await memory.add(
  [{ role: "user", content: "I love hiking and I'm training for a half marathon this fall." }],
  { userId: "user_123" },
);

const results = await memory.search("What outdoor activities is the user into?", {
  userId: "user_123",
  limit: 5,
});

for (const { memory: m, score } of results) {
  console.log(`[${score.toFixed(3)}] ${m.content}`);
}

await memory.close();
```

When similar facts are added again, turbomem deduplicates by default — merging with an LLM, smart-replacing when the new fact is more specific, or skipping duplicates. Configure via `deduplication` or disable with `{ enabled: false }`. See [Configuration](https://turbomem.dev/guide/configuration#deduplication).

## Adapters

| Package                                                                    | Use case                                                        |
| -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| [`turbomem`](https://www.npmjs.com/package/turbomem)                       | Core library                                                    |
| [`@turbomem/mastra`](https://www.npmjs.com/package/@turbomem/mastra)       | Mastra memory provider (`remember` / `recall`)                  |
| [`@turbomem/vercel-ai`](https://www.npmjs.com/package/@turbomem/vercel-ai) | Vercel AI SDK tools for agent-driven memory                     |
| [`@turbomem/okf`](https://www.npmjs.com/package/@turbomem/okf)             | Open Knowledge Format parser and turbomem bridge (Experimental) |

```bash
npm install @turbomem/mastra turbomem
# or
npm install @turbomem/vercel-ai turbomem ai
# or
npm install @turbomem/okf
```

## Documentation

Full guides, configuration reference, and runnable examples:

**https://turbomem.dev**

## Requirements

Node.js 20+ or Bun. TypeScript recommended.

## License

Apache License 2.0 see [LICENSE](LICENSE) for details.

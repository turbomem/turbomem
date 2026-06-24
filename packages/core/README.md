<p align="center">
  <img src="./logo.svg" alt="turbomem" width="120" />
</p>

# turbomem

[![npm version](https://img.shields.io/npm/v/turbomem)](https://www.npmjs.com/package/turbomem)

Local-first agent memory for TypeScript. Persistent, semantically searchable memory that runs inside your Node or Bun process, no separate memory server, no Python sidecar.

## Install

```bash
npm install turbomem
```

Set `OPENAI_API_KEY` for the default OpenAI embeddings and fact-extraction stack. PGlite is included; no extra database setup. For the optional sqlite-vec backend: `npm install better-sqlite3 sqlite-vec`.

**Providers:** embeddings via OpenAI, local (transformers), Voyage AI (`VOYAGE_API_KEY`), or Google Gemini (`GEMINI_API_KEY`); fact extraction via OpenAI, Anthropic, or Google Gemini (plus any OpenAI-compatible endpoint via a custom `baseURL`). See the [Providers reference](https://turbomem.dev/guide/providers).

## Quick start

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4o-mini" },
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

## Framework adapters

| Package                                                                    | Use case               |
| -------------------------------------------------------------------------- | ---------------------- |
| [`@turbomem/mastra`](https://www.npmjs.com/package/@turbomem/mastra)       | Mastra memory provider |
| [`@turbomem/vercel-ai`](https://www.npmjs.com/package/@turbomem/vercel-ai) | Vercel AI SDK tools    |

## Documentation

Full guides, configuration reference, and runnable examples:

**https://turbomem.dev**

## Requirements

Node.js 20+ or Bun. TypeScript recommended.

## License

Apache License 2.0

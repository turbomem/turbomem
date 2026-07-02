<p align="center">
  <img src="./logo.svg" alt="turbomem" width="120" />
</p>

# turbomem

[![npm version](https://img.shields.io/npm/v/turbomem)](https://www.npmjs.com/package/turbomem) · [Documentation](https://docs.turbomem.dev) · [Site](https://turbomem.dev)

Local-first agent memory for TypeScript. Persistent, semantically searchable memory that runs inside your Node or Bun process or in the browser with IndexedDB-backed PGlite. No separate memory server, no Python sidecar.

## Install

```bash
npm install turbomem
```

Set `OPENAI_API_KEY` for the default OpenAI embeddings and fact-extraction stack. PGlite is included; no extra database setup. For the optional sqlite-vec backend: `npm install better-sqlite3 sqlite-vec`. For edge deployment with Upstash Vector: `npm install @upstash/vector` — see the [Edge guide](https://docs.turbomem.dev/guide/edge). For browser apps, import from `turbomem/browser` — see the [Browser guide](https://docs.turbomem.dev/guide/browser).

**Providers:** embeddings via OpenAI, local (transformers), Voyage AI (`VOYAGE_API_KEY`), or Google Gemini (`GEMINI_API_KEY`); fact extraction via OpenAI, Anthropic, or Google Gemini (plus any OpenAI-compatible endpoint via a custom `baseURL`). See the [Providers reference](https://docs.turbomem.dev/guide/providers).

## Quick start

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  embeddings: "openai", // or "local" | "voyage" | "google"
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

The example above uses OpenAI (`text-embedding-3-small` by default). You can also use local transformers, Voyage AI, or Google Gemini via the `embeddings` preset, or pass a custom adapter for a specific model — see the [Providers reference](https://docs.turbomem.dev/guide/providers).

## Framework adapters

| Package                                                                    | Use case               |
| -------------------------------------------------------------------------- | ---------------------- |
| [`@turbomem/mastra`](https://www.npmjs.com/package/@turbomem/mastra)       | Mastra memory provider |
| [`@turbomem/vercel-ai`](https://www.npmjs.com/package/@turbomem/vercel-ai) | Vercel AI SDK tools    |

## CLI

| Package                                                        | Use case                   |
| -------------------------------------------------------------- | -------------------------- |
| [`@turbomem/cli`](https://www.npmjs.com/package/@turbomem/cli) | Terminal memory management |

## Documentation

Full guides, configuration reference, and runnable examples:

**https://docs.turbomem.dev** · **https://turbomem.dev**

## Requirements

Node.js 20+ or Bun. TypeScript recommended.

## License

Apache License 2.0

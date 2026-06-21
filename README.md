# turbomem

[![npm version](https://img.shields.io/npm/v/turbomem)](https://www.npmjs.com/package/turbomem)

Local-first agent memory for TypeScript. Persistent, semantically searchable memory that runs inside your Node or Bun process, no separate memory server, no Python sidecar.

## Features

- **Embedded runtime**: in-process memory with no HTTP hop per call
- **Semantic search**: LLM fact extraction plus vector embeddings (OpenAI or local WASM)
- **PGlite storage**: WASM Postgres with pgvector; data stays on disk in your app
- **Scoped by user, agent, or session**: multi-tenant friendly out of the box
- **Framework adapters**: Mastra and Vercel AI SDK integrations ship as separate packages

## Install

```bash
npm install turbomem
```

Set `OPENAI_API_KEY` for the default OpenAI embeddings and fact-extraction stack. PGlite is included — no extra database setup.

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

## Adapters

| Package                                                                    | Use case                                       |
| -------------------------------------------------------------------------- | ---------------------------------------------- |
| [`turbomem`](https://www.npmjs.com/package/turbomem)                       | Core library                                   |
| [`@turbomem/mastra`](https://www.npmjs.com/package/@turbomem/mastra)       | Mastra memory provider (`remember` / `recall`) |
| [`@turbomem/vercel-ai`](https://www.npmjs.com/package/@turbomem/vercel-ai) | Vercel AI SDK tools for agent-driven memory    |

```bash
npm install @turbomem/mastra turbomem
# or
npm install @turbomem/vercel-ai turbomem ai
```

## Documentation

Full guides, configuration reference, and runnable examples:

**https://turbomem.dev/**

## Requirements

Node.js 20+ or Bun. TypeScript recommended.

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

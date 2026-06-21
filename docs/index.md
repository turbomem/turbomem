---
layout: home

hero:
  image:
    src: /logo.svg
    alt: turbomem
  name: turbomem
  text: Local-first agent memory for TypeScript
  tagline: No Python. No servers. Just npm install.
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/turbomem/turbomem

features:
  - title: Fully embedded
    details: Runs inside your Node or Bun process. No sidecar server, no HTTP hop per memory call.
  - title: Semantic search
    details: LLM fact extraction plus vector embeddings with PGlite and pgvector (WASM Postgres).
  - title: Adapter-based
    details: Swap OpenAI or local WASM embeddings, PGlite storage, and Mastra or Vercel AI SDK integrations.
  - title: Type-safe
    details: Strict TypeScript with Zod-validated inputs. Works in Node 20+, Bun, and serverless.
  - title: Terminal CLI
    details: Add, search, and manage memories from your shell with one-shot commands or an interactive REPL.
    link: /cli
---

## Quick example

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

console.log(results.map((r) => r.memory.content));
```

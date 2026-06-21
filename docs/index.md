---
layout: home
title: turbomem
description: Local-first agent memory for TypeScript. No Python. No servers. Just npm install.

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

## Why embedded memory?

Many agent-memory setups rely on a separate service, a Python server, hosted platform, or
self-managed vector DB. For TypeScript apps that means another process, extra infra, and
an HTTP hop on every memory call. **turbomem runs entirely in-process** as a library you
`npm install`.

## Embedded vs server-based

|             | turbomem (embedded)                     | Server-based memory             |
| ----------- | --------------------------------------- | ------------------------------- |
| Runtime     | TypeScript, in-process                  | Separate server / hosted API    |
| Deployment  | `npm install`                           | Run or host a service           |
| Network hop | None (local)                            | HTTP per call                   |
| Storage     | PGlite (WASM Postgres)                  | External vector store           |
| Best for    | TS apps, edge, embedding into a product | Multi-language or managed infra |

If you need a cross-language managed platform, a dedicated memory service may fit better.
If you're shipping a TypeScript app and want memory as a _library_, that's turbomem.

## How it works

```
messages → Extractor (LLM) → facts → Embeddings → vectors → PGlite
query    → Embeddings → vector search (scoped) → ranked results
```

- **`add(messages, scope)`**: extracts discrete facts from conversation, embeds them, and stores each fact with its vector and scope.
- **`addFacts(facts, scope)`**: store explicit fact strings directly, skipping LLM extraction.
- **`search(query, scope)`**: embeds the query and returns the closest matching facts, filtered by scope.
- **`getAll(scope)`**: list every memory in a scope (newest first). The [CLI](/cli) exposes this as `turbomem list`.
- **`delete(id)`** / **`deleteAll(scope)`**: remove one memory or wipe a scope.
- **Scoping**: every memory is tagged with optional `userId`, `agentId`, and `sessionId` for multi-tenant isolation.

See [Architecture](/guide/architecture) for the pipeline and [API reference](/api/reference) for the full method list.

## When turbomem fits

- **[TypeScript agents](/guide/getting-started)** (Node, Bun, serverless) that need memory without a sidecar
- **Products embedding memory** into an app, not operating a memory platform
- **[Local-first / edge](/guide/configuration)** where PGlite on disk beats a remote vector DB
- **Framework integrations** via [`@turbomem/mastra`](/adapters/mastra) or [`@turbomem/vercel-ai`](/adapters/vercel-ai) when you already use those stacks

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

await memory.close();
```

## Explore the docs

- [Getting started](/guide/getting-started) - install, env setup, and first memory
- [Configuration](/guide/configuration) - embeddings, storage, extraction, and scoping
- [Architecture](/guide/architecture) - pipeline, adapters, and error handling
- [CLI](/cli) - manage memories from your terminal
- [Examples](/examples) - runnable projects in the repo
- [API reference](/api/reference) - types, methods, and error codes

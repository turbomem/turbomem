---
title: Getting started
description: Install turbomem, set up OpenAI, and store your first agent memory in TypeScript.
---

# Getting started

turbomem gives your LLM agents persistent, semantically-searchable memory that runs
entirely inside your Node/Bun process. Type-safe, adapter-based, and dependency-light.
No separate memory server required. Local-first by default; pluggable to edge and serverless.

::: tip Deploying to Vercel or edge?
Use `upstash-vector` or `pinecone` storage on serverless and edge runtimes. See the [Edge guide](/guide/edge) for setup on Cloudflare Workers, Vercel Edge, and Next.js serverless.
:::

## Install

```bash
npm install turbomem
```

The default stack (OpenAI embeddings + PGlite storage) works out of the box.
PGlite ships as a dependency, no extra setup.

## Environment

Set your OpenAI API key for embeddings and fact extraction:

```bash
export OPENAI_API_KEY=sk-...
```

## Basic usage

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4.1-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
  pglite: { dataDir: ".turbomem" },
});

await memory.init();

await memory.add(
  [
    { role: "user", content: "Hey, I love hiking and I'm training for a half marathon this fall." },
    { role: "assistant", content: "Nice — I'll remember your fitness goals." },
  ],
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

`init()` is required before any other method. It runs storage migrations and
loads embedding models (for local embeddings). Calling other methods before
`init()` throws `NotInitialisedError`.

## Why embedded memory?

Many agent-memory setups rely on a **separate service**. A Python server, a hosted
platform, or a vector database you operate yourself. For a TypeScript app that often
means running another process, managing extra infrastructure, and crossing a network
boundary for every memory operation.

turbomem is **fully embedded**:

|             | turbomem (embedded)                     | Server-based memory             |
| ----------- | --------------------------------------- | ------------------------------- |
| Runtime     | TypeScript, in-process                  | Separate server / hosted API    |
| Deployment  | `npm install`                           | Run or host a service           |
| Network hop | None (local)                            | HTTP per call                   |
| Storage     | PGlite (WASM Postgres)                  | External vector store           |
| Best for    | TS apps, edge, embedding into a product | Multi-language or managed infra |

If you need a cross-language managed platform, a dedicated memory service may fit better.
If you're shipping a TypeScript app and want memory as a _library_, that's turbomem.

## Next steps

- [Configuration](/guide/configuration) - embeddings, extraction, scoping
- [Storage](/guide/storage) - PGlite, sqlite-vec, Upstash Vector, and Pinecone
- [Edge](/guide/edge) - deploy on Workers, Vercel Edge, and Next.js serverless
- [Architecture](/guide/architecture) - how the pipeline works
- [Examples](/examples) - runnable projects in the repo

## Deploy on Vercel / Next.js

```
Next.js on Vercel?
├── Edge runtime → upstash-vector or pinecone (see Edge guide)
├── Node serverless → upstash-vector or pinecone recommended; pglite only with persistent volume
└── Client-side → turbomem/browser with idb://
```

The [vercel-ai-chatbot example](/examples) switches between PGlite (local dev) and Upstash (production) via `TURBOMEM_STORAGE`.

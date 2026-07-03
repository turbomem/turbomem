---
title: Examples
description: Runnable turbomem examples for Node.js, Mastra agents, and a Next.js Vercel AI SDK chatbot.
---

# Examples

Runnable examples live in the
[examples/](https://github.com/turbomem/turbomem/tree/master/examples) directory.
Clone the repo and run with pnpm from the monorepo root.

All examples require `OPENAI_API_KEY`:

```bash
export OPENAI_API_KEY=sk-...
```

## basic-node

Minimal Node.js script showing the core `add` / `search` flow with OpenAI
embeddings and PGlite storage.

```bash
pnpm --filter @turbomem/example-basic-node start
```

Source: [examples/basic-node/src/index.ts](https://github.com/turbomem/turbomem/blob/main/examples/basic-node/src/index.ts)

## mastra-agent {#mastra-agent}

Shows how to wrap `TurboMemory` as a Mastra memory provider via `@turbomem/mastra`.

```bash
pnpm --filter @turbomem/example-mastra-agent start
```

Source: [examples/mastra-agent/src/index.ts](https://github.com/turbomem/turbomem/blob/main/examples/mastra-agent/src/index.ts)

## vercel-ai-chatbot {#vercel-ai-chatbot}

A Next.js (App Router) chatbot that gives the model long-term memory using
`@turbomem/vercel-ai` tools (`rememberFact` / `recallMemories`).

```bash
pnpm --filter @turbomem/example-vercel-ai-chatbot dev
```

Key files:

- `app/api/chat/route.ts` — streams a response and wires in the memory tools
- `lib/memory.ts` — lazily-initialised `TurboMemory`; PGlite locally, Upstash on Vercel via `TURBOMEM_STORAGE`
- `app/page.tsx` — minimal chat UI using `useChat`

**Local dev:** PGlite on disk (default). **Vercel deploy:** set `TURBOMEM_STORAGE=upstash-vector` plus Upstash env vars. See the [example README](https://github.com/turbomem/turbomem/blob/main/examples/vercel-ai-chatbot/README.md).

## browser-vite {#browser-vite}

A Vite SPA showing turbomem running **entirely in the browser** with IndexedDB-backed
PGlite storage. Add facts, search, and reload — memories persist in IndexedDB.

```bash
pnpm --filter turbomem build
pnpm --filter @turbomem/example-browser-vite dev
```

You'll need a [Google AI API key](https://aistudio.google.com/apikey) for Gemini
embeddings. The demo stores the key in `sessionStorage` for convenience only.

Source: [examples/browser-vite/src/main.ts](https://github.com/turbomem/turbomem/blob/main/examples/browser-vite/src/main.ts)

## tanstack-pinecone-starter {#tanstack-pinecone-starter}

A TanStack Start CS tutoring app with long-term learner memory backed by Pinecone. Demonstrates
the **explicit `indexClient`** pattern required for Vite SSR (see
[Pinecone integration patterns](/guide/storage#integration-patterns)).

```bash
cd turbomem-tanstack-pinecone-starter
cp .env.example .env   # add OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_INDEX
npm install
npm run dev
```

Key files:

- `src/lib/pinecone.ts` — static Pinecone import + `PineconeStorageAdapter({ indexClient })`
- `src/lib/memory.ts` — shared `TurboMemory` instance
- `src/routes/api/chat.ts` — streaming tutor with memory search / add
- `vite.config.ts` — `ssr.external` for `@pinecone-database/pinecone`

Source: [turbomem-tanstack-pinecone-starter/](https://github.com/turbomem/turbomem/tree/master/turbomem-tanstack-pinecone-starter)

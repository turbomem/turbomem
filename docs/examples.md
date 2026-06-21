---
title: Examples
description: Runnable turbomem examples for Node.js, Mastra agents, and a Next.js Vercel AI SDK chatbot.
---

# Examples

Runnable examples live in the
[examples/](https://github.com/turbomem/turbomem/tree/main/examples) directory.
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
- `lib/memory.ts` — a lazily-initialised shared `TurboMemory` instance
- `app/page.tsx` — minimal chat UI using `useChat`

> PGlite writes to a local directory. On serverless platforms, point
> `TURBOMEM_DATA_DIR` at a writable, persistent volume (or swap in a hosted
> storage adapter).

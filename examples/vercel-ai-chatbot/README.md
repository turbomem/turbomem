# vercel-ai-chatbot example

A Next.js (App Router) chatbot that gives the model long-term memory using
`@turbomem/vercel-ai` tools (`rememberFact` / `recallMemories`).

## Local dev (default)

Uses PGlite on disk — no extra services required.

```bash
export OPENAI_API_KEY=sk-...
pnpm --filter @turbomem/example-vercel-ai-chatbot dev
```

## Deploy to Vercel (serverless)

Uses Upstash Vector for persistent, shared storage across serverless invocations.

1. Create an [Upstash Vector](https://upstash.com/docs/vector/overall/getstarted) index (cosine similarity, dimensions matching your embedding model — 1536 for OpenAI `text-embedding-3-small`).
2. Install the peer dependency: `npm install @upstash/vector`
3. Set environment variables in your Vercel project:

```bash
TURBOMEM_STORAGE=upstash-vector
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=...
OPENAI_API_KEY=sk-...
```

For Pinecone instead, see the [Storage guide](https://docs.turbomem.dev/guide/storage).

## Key files

- `app/api/chat/route.ts` — streams a response and wires in the memory tools
- `lib/memory.ts` — lazily-initialised `TurboMemory`; switches storage via `TURBOMEM_STORAGE`
- `app/page.tsx` — minimal chat UI using `useChat`

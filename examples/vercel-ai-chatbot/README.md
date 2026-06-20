# vercel-ai-chatbot example

A Next.js (App Router) chatbot that gives the model long-term memory using
`@turbomem/vercel-ai` tools (`rememberFact` / `recallMemories`).

```bash
export OPENAI_API_KEY=sk-...
pnpm --filter @turbomem/example-vercel-ai-chatbot dev
```

Key files:

- `app/api/chat/route.ts` — streams a response and wires in the memory tools
- `lib/memory.ts` — a lazily-initialised shared `TurboMemory` instance
- `app/page.tsx` — minimal chat UI using `useChat`

> Note: PGlite writes to a local directory. On serverless platforms, point
> `TURBOMEM_DATA_DIR` at a writable, persistent volume (or swap in a hosted
> storage adapter).

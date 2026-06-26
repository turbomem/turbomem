# @turbomem/vercel-ai

[![npm version](https://img.shields.io/npm/v/@turbomem/vercel-ai)](https://www.npmjs.com/package/@turbomem/vercel-ai)

Vercel AI SDK tools backed by [turbomem](https://www.npmjs.com/package/turbomem). Exposes `rememberFact` and `recallMemories` tools the model can call during `generateText` or `streamText`.

## Install

```bash
npm install @turbomem/vercel-ai turbomem ai
```

## Quick start

```ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { TurboMemory } from "turbomem";
import { createMemoryTools } from "@turbomem/vercel-ai";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4.1-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

await memory.init();

const result = await generateText({
  model: openai("gpt-4.1-mini"),
  tools: createMemoryTools(memory, { userId: "user_123" }),
  prompt: "Remember that I prefer dark mode, then tell me my preferences.",
  maxSteps: 5,
});
```

`createMemoryTools` accepts a scope object (`userId`, `agentId`, `sessionId`) applied to every tool invocation.

## Documentation

Adapter guide and Next.js example:

**https://turbomem.dev/adapters/vercel-ai**

## License

Apache License 2.0

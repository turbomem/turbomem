---
title: Vercel AI SDK adapter
description: Give Vercel AI SDK agents long-term memory with turbomem rememberFact and recallMemories tools.
---

# Vercel AI SDK adapter

Package: `@turbomem/vercel-ai`

Exposes turbomem as two tools the model can call: remember facts and recall
memories by semantic search.

## Install

```bash
npm install @turbomem/vercel-ai turbomem ai
```

## Usage

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

`createMemoryTools` accepts a scope object (`userId`, `agentId`, `sessionId`) that
is applied to every tool invocation.

See the [vercel-ai-chatbot example](/examples#vercel-ai-chatbot) for a full
Next.js App Router integration.

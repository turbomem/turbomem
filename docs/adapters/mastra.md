---
title: Mastra adapter
description: Use turbomem as a Mastra memory provider with remember and recall methods.
---

# Mastra adapter

Package: `@turbomem/mastra`

Wraps a `TurboMemory` instance as a Mastra memory provider with `remember` and
`recall` methods.

## Install

```bash
npm install @turbomem/mastra turbomem
```

## Usage

```ts
import { TurboMemory } from "turbomem";
import { createMastraMemory } from "@turbomem/mastra";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4o-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

await memory.init();

const provider = createMastraMemory(memory);
// provider.remember(messages, ctx)
// provider.recall(query, ctx)
```

Check your installed `@mastra/core` version's `MastraMemoryProvider` interface,
the structural shape exported here is intentionally minimal.

See the [mastra-agent example](/examples#mastra-agent) for a runnable project.

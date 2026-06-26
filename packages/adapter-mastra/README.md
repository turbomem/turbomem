# @turbomem/mastra

[![npm version](https://img.shields.io/npm/v/@turbomem/mastra)](https://www.npmjs.com/package/@turbomem/mastra)

Mastra memory provider backed by [turbomem](https://www.npmjs.com/package/turbomem). Wraps a `TurboMemory` instance with `remember` and `recall` methods for Mastra agents.

## Install

```bash
npm install @turbomem/mastra turbomem
```

You also need `@mastra/core` in your project.

## Quick start

```ts
import { TurboMemory } from "turbomem";
import { createMastraMemory } from "@turbomem/mastra";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4.1-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

await memory.init();

const provider = createMastraMemory(memory);

await provider.remember([{ role: "user", content: "I prefer dark mode." }], { userId: "user_123" });

const context = await provider.recall("UI preferences", { userId: "user_123" });
```

Check your installed `@mastra/core` version's `MastraMemoryProvider` interface, the shape exported here is intentionally minimal and structurally compatible.

## Documentation

Adapter guide and examples:

**https://turbomem.dev/adapters/mastra**

## License

Apache License 2.0

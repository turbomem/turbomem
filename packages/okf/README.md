# @turbomem/okf

[![npm version](https://img.shields.io/npm/v/@turbomem/okf)](https://www.npmjs.com/package/@turbomem/okf) · [Documentation](https://docs.turbomem.dev/adapters/okf)

Open Knowledge Format (OKF) v0.1 parser, validator, writer, and concept graph for Node.js. Optionally seed [turbomem](https://www.npmjs.com/package/turbomem) agent memory from OKF bundles.

## Install

```bash
npm install @turbomem/okf
```

For turbomem integration, also install `turbomem`:

```bash
npm install @turbomem/okf turbomem
```

## Standalone usage

```ts
import { parseBundle, validateBundle, buildGraph } from "@turbomem/okf";

const bundle = await parseBundle("./knowledge");
const result = validateBundle(bundle);
const graph = buildGraph(bundle);
```

## CLI

```bash
npx okf validate ./knowledge
npx okf parse ./knowledge
```

## turbomem integration

```ts
import { TurboMemory } from "turbomem";
import { parseBundle, addFromBundle } from "@turbomem/okf";

const memory = new TurboMemory({
  embeddings: "openai",
  storage: "pglite",
  extraction: { provider: "openai", model: "gpt-4.1-mini" },
  openai: { apiKey: process.env.OPENAI_API_KEY },
});

await memory.init();

const bundle = await parseBundle("./knowledge");
await addFromBundle(memory, bundle, { userId: "agent_1" });

const results = await memory.search("How do I compute weekly active users?", {
  userId: "agent_1",
  limit: 5,
});
```

## Documentation

**https://docs.turbomem.dev/adapters/okf**

## License

Apache License 2.0

---
title: OKF
description: Parse, validate, and load Open Knowledge Format bundles into turbomem.
---

# OKF

Package: `@turbomem/okf` · **Experimental**

Parser, validator, writer, and concept graph for the [Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) v0.1 specification. Works standalone or as a bridge to seed turbomem agent memory from structured knowledge bundles.

## Install

```bash
npm install @turbomem/okf
```

For turbomem integration:

```bash
npm install @turbomem/okf turbomem
```

## Standalone usage

```ts
import { parseBundle, validateBundle, buildGraph } from "@turbomem/okf";

const bundle = await parseBundle("./knowledge");
const result = validateBundle(bundle);

if (result.valid) {
  const graph = buildGraph(bundle);
  console.log(`${graph.nodes.size} concepts, ${graph.edges.length} cross-links`);
}
```

## CLI

```bash
npx okf validate ./knowledge
npx okf parse ./knowledge
```

## turbomem integration

Convert OKF concept documents into searchable agent memory:

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
```

Each OKF document becomes one or more fact strings ingested via `memory.addFacts()`. The agent can then search across table schemas, runbooks, and metric definitions using natural language.

## Reference

OKF spec: https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf

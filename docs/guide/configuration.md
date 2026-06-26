---
title: Configuration
description: Configure embeddings, PGlite, sqlite-vec, or Upstash Vector storage, LLM fact extraction, and memory scoping in turbomem.
---

# Configuration

`TurboMemory` accepts a single config object. All adapters are resolved at
construction time from string presets or custom adapter instances.

::: tip Looking for the full provider list?
See the [Providers reference](/guide/providers) for a side-by-side comparison of
every embedding and extraction provider, their models, dimensions, and required
API keys.
:::

::: tip Choosing a storage backend?
See the [Storage guide](/guide/storage) for PGlite vs sqlite-vec vs Upstash Vector,
install steps, and custom adapters. Deploying to edge? See the [Edge guide](/guide/edge).
Running in the browser? See the [Browser guide](/guide/browser).
:::

## Full config shape

```ts
const memory = new TurboMemory({
  embeddings: "openai", // or "local" | "voyage" | "google" | EmbeddingAdapter
  storage: "pglite", // or "sqlite-vec" | "upstash-vector" | StorageAdapter (default: "pglite")
  extraction: {
    provider: "openai", // or "anthropic" | "google"
    model: "gpt-4.1-mini",
    apiKey: process.env.OPENAI_API_KEY, // optional if openai.apiKey is set
    baseURL: undefined, // optional custom endpoint
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: undefined,
  },
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY, // used when embeddings: "voyage"
    model: "voyage-4",
  },
  google: {
    apiKey: process.env.GEMINI_API_KEY, // used when embeddings/extraction is "google"
    model: "gemini-embedding-001",
  },
  pglite: {
    dataDir: ".turbomem", // or "idb://my-db" in the browser
    inMemory: false, // set true for ephemeral storage (tests)
    relaxedDurability: undefined, // defaults to true for idb:// paths
  },
  sqliteVec: {
    dbPath: ".turbomem.sqlite", // defaults to .turbomem.sqlite in process.cwd()
    inMemory: false, // set true for ephemeral storage (tests)
  },
  upstashVector: {
    url: process.env.UPSTASH_VECTOR_REST_URL, // or UPSTASH_VECTOR_REST_URL env var
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    namespace: undefined, // optional Upstash namespace
  },
  local: {
    model: undefined, // defaults to Xenova/all-MiniLM-L6-v2
  },
});
```

## Embedding adapters

### OpenAI (default)

```ts
new TurboMemory({
  embeddings: "openai", // text-embedding-3-small (1536d)
  openai: { apiKey: process.env.OPENAI_API_KEY },
  // ...
});
```

`embedBatch` sends all inputs in a single request, chunked into groups of 100 for
larger batches. Use `text-embedding-3-large` (3072d) via a custom adapter instance.

### Local WASM (optional)

Zero-API-cost embeddings using
[`@huggingface/transformers`](https://github.com/huggingface/transformers.js):

```bash
npm install @huggingface/transformers
```

```ts
new TurboMemory({
  embeddings: "local", // Xenova/all-MiniLM-L6-v2 (384d)
  // ...
});
```

The model (~25MB) downloads on first use and is cached for the rest of the process.

### Voyage AI (optional)

Hosted embeddings via plain `fetch` (no extra dependency). Defaults to
`voyage-4` at 1024 dimensions:

```ts
new TurboMemory({
  embeddings: "voyage",
  voyage: { apiKey: process.env.VOYAGE_API_KEY, model: "voyage-4" },
  // ...
});
```

### Google Gemini (optional)

Hosted embeddings via plain `fetch`. Defaults to `gemini-embedding-001` at 3072
dimensions; vectors are always L2-normalized:

```ts
new TurboMemory({
  embeddings: "google",
  google: { apiKey: process.env.GEMINI_API_KEY, dimensions: 768 },
  // ...
});
```

See the [Providers reference](/guide/providers) for all models and supported
dimensions.

### Custom adapter

Pass any object implementing `EmbeddingAdapter`:

```ts
new TurboMemory({
  embeddings: myCustomAdapter,
  // ...
});
```

## Storage adapters

Select with `storage: "pglite" | "sqlite-vec" | "upstash-vector"` or pass a custom
`StorageAdapter`. PGlite (WASM Postgres + pgvector) is the default and requires no extra
install. sqlite-vec (SQLite + native extension) is optional and needs `better-sqlite3`
and `sqlite-vec` as peer dependencies. Upstash Vector (HTTP) is optional for edge
deployments and needs `@upstash/vector` as a peer dependency.

See the [Storage guide](/guide/storage) for a full comparison, setup steps, and when to
use each backend. For edge deployment, see the [Edge guide](/guide/edge).

## Fact extraction

Extraction uses an LLM to turn conversations into discrete, third-person facts.
Supported providers: `openai`, `anthropic`, and `google`. Any OpenAI-compatible
endpoint (Groq, OpenRouter, Together, Mistral, Ollama, …) also works via the
`openai` provider with a custom `baseURL` see the
[Providers reference](/guide/providers).

```ts
extraction: {
  provider: "openai", // or "anthropic" | "google"
  model: "gpt-4.1-mini",
}
```

Extraction is **non-fatal**: parse or transport failures log a warning and yield
`[]` rather than throwing. Use `addFacts()` to store explicit strings without
extraction.

## Scoping

Every memory is tagged with optional scope fields:

```ts
{ userId?: string; agentId?: string; sessionId?: string }
```

Reads and deletes filter by whatever scope fields are provided. This is the
extent of multi-tenancy, there is no auth layer.

Provide at least `userId` or `agentId` when storing memories.

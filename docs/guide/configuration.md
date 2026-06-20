# Configuration

`TurboMemory` accepts a single config object. All adapters are resolved at
construction time from string presets or custom adapter instances.

## Full config shape

```ts
const memory = new TurboMemory({
  embeddings: "openai", // or "local" | EmbeddingAdapter
  storage: "pglite", // or StorageAdapter (default: "pglite")
  extraction: {
    provider: "openai", // or "anthropic"
    model: "gpt-4o-mini",
    apiKey: process.env.OPENAI_API_KEY, // optional if openai.apiKey is set
    baseURL: undefined, // optional custom endpoint
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: undefined,
  },
  pglite: {
    dataDir: ".turbomem", // defaults to .turbomem in process.cwd()
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

### Custom adapter

Pass any object implementing `EmbeddingAdapter`:

```ts
new TurboMemory({
  embeddings: myCustomAdapter,
  // ...
});
```

## Storage adapters

### PGlite (default, v0.1)

WASM Postgres with `pgvector` — no native compilation, runs anywhere Node runs.
Data persists to `.turbomem` in your CWD by default:

```ts
new TurboMemory({
  storage: "pglite",
  pglite: { dataDir: "./my-memory" },
  // ...
});
```

The vector column dimension is derived from your embedding adapter at `init()`.
Switching to an embedding model with different dimensions against an existing store
throws `DimensionMismatchError`.

> **Planned:** a `sqlite-vec` backend in v0.2.

### Custom adapter

Pass any object implementing `StorageAdapter`:

```ts
new TurboMemory({
  storage: myCustomStorage,
  // ...
});
```

## Fact extraction

Extraction uses an LLM to turn conversations into discrete, third-person facts.
Supported providers: `openai` and `anthropic`.

```ts
extraction: {
  provider: "openai",
  model: "gpt-4o-mini",
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
extent of multi-tenancy — there is no auth layer.

Provide at least `userId` or `agentId` when storing memories.

## Roadmap

- `sqlite-vec` storage backend (v0.2)
- Edge runtime support
- Browser support (IndexedDB-backed PGlite)
- Memory deduplication / update-in-place

# Architecture

turbomem is a small, embeddable agent-memory library. There is no server, no
sidecar process, and no native compilation in v0.2, everything runs inside your
Node/Bun process.

## High-level flow

```
messages ──► Extractor (LLM) ──► facts ──► EmbeddingAdapter ──► vectors ──► StorageAdapter
                                                                                  │
query ──────────────► EmbeddingAdapter ──► query vector ──► StorageAdapter.search ┘ ──► ranked results
```

1. **`add(messages, scope)`** runs LLM-based fact extraction, embeds each fact in
   a batch, and inserts the fact + vector + scope into storage.
2. **`search(query, scope)`** embeds the query and performs a vector similarity
   search filtered by scope.

## Components

### `TurboMemory`

The single public entry point. It resolves the configured adapters, owns
initialisation state, and orchestrates extraction → embedding → storage. All
public methods assert initialisation first and throw `NotInitialisedError`
otherwise.

### Embedding adapters

Implement `EmbeddingAdapter` (`embed`, `embedBatch`, `dimensions`):

- **OpenAI** (`text-embedding-3-small`, 1536d default) — batches up to 100 inputs
  per request, chunking larger batches with `Promise.all`.
- **Transformers** (local WASM, `Xenova/all-MiniLM-L6-v2`, 384d) — lazily loads
  and caches the model as a module-level singleton, processes batches
  sequentially because WASM is single-threaded.

### Storage adapters

Implement `StorageAdapter` (`init`, `insert`, `search`, `getAll`, `delete`,
`deleteAll`):

- **PGlite** (default), WASM Postgres + `pgvector`. The vector column dimension
  is set from the embedding adapter's `dimensions` at `init()`. A `turbomem_meta`
  table records the dimension so a later dimension change fails loudly with
  `DimensionMismatchError`. Similarity search uses the cosine distance operator
  (`<=>`) with an HNSW index.

### Extractor

Turns a conversation into discrete, third-person facts about the user using an
LLM (OpenAI or Anthropic). Extraction is **non-fatal**: parse/transport failures
log a warning and yield `[]` rather than throwing.

## Scoping

Every memory is tagged with optional `userId`, `agentId`, and `sessionId`.
Reads and deletes filter by whatever scope fields are provided. This is the
extent of multi-tenancy, there is no auth layer.

## Error handling

All errors derive from `TurboMemError` with a stable `code`
(`NOT_INITIALISED`, `EMBEDDING_FAILED`, `STORAGE_FAILED`, `EXTRACTION_FAILED`,
`DIMENSION_MISMATCH`, `INVALID_CONFIG`, `INVALID_INPUT`). Only extraction
failures are swallowed; everything else propagates.

See the [API reference](/api/reference) for error class details.

## Adapters as separate entrypoints

Framework integrations (`@turbomem/mastra`, `@turbomem/vercel-ai`) are published
as separate packages so the core stays framework-agnostic and dependency-light.

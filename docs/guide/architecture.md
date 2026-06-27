---
title: Architecture
description: How turbomem's extraction, embedding, and storage pipeline works under the hood.
---

# Architecture

turbomem is a small, embeddable agent-memory library. There is no server, no
sidecar process — storage defaults to WASM Postgres (PGlite) with no native
compilation. An optional sqlite-vec backend is available for users who prefer
SQLite.

## High-level flow

```
messages ──► Extractor (LLM) ──► facts ──► EmbeddingAdapter ──► vectors ──► dedup check ──► StorageAdapter
                                                                                  │
query ──────────────► EmbeddingAdapter ──► query vector ──► StorageAdapter.search ┘ ──► ranked results
```

1. **`add(messages, scope)`** runs LLM-based fact extraction, embeds each fact in
   a batch, and upserts each fact + vector + scope into storage (with deduplication
   when enabled).
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

Implement `StorageAdapter` (`init`, `insert`, `update`, `search`, `getAll`, `delete`,
`deleteAll`):

- **PGlite** (default), WASM Postgres + `pgvector`. See [Storage](/guide/storage)
  for setup and comparison with sqlite-vec and Upstash Vector.
- **sqlite-vec** (optional), SQLite + the `sqlite-vec` extension via
  `better-sqlite3`. Uses a `vec0` virtual table with cosine distance for KNN
  search, linked to a regular `memories` table by rowid.
- **Upstash Vector** (optional, edge), remote vector store over HTTP. See
  [Edge](/guide/edge) for deployment setup.

### Extractor

Turns a conversation into discrete, third-person facts about the user using an
LLM (OpenAI or Anthropic). Extraction is **non-fatal**: parse/transport failures
log a warning and yield `[]` rather than throwing.

### Deduplication

On write, turbomem searches for semantically similar memories in the same scope.
When matches exceed the configured threshold:

- **`merge`** (default): consolidates all matches plus the new fact in one LLM call,
  updates the best match, and deletes duplicates.
- **`replace`**: smart replace using a zero-cost specificity heuristic — updates
  only when the new fact adds more detail.
- **`skip`**: keeps the existing memory unchanged.

See [Configuration — Deduplication](/guide/configuration#deduplication) for options.

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

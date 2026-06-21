---
title: API reference
description: TurboMemory methods, Memory types, adapter interfaces, and error codes for turbomem.
---

# API reference

## `TurboMemory`

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory(config);
```

### Methods

| Method | Description |
| ------ | ----------- |
| `init()` | Run migrations / load models. Idempotent. Required before other calls. |
| `add(messages, scope)` | Extract facts from conversation, embed, store. Returns `Memory[]`. |
| `addFacts(facts, scope)` | Store explicit fact strings (no extraction). Returns `Memory[]`. |
| `search(query, options)` | Semantic search. Returns `MemorySearchResult[]` sorted by score (desc). |
| `getAll(scope)` | List all memories for a scope. Returns `Memory[]`. |
| `delete(id)` | Delete one memory by ID. |
| `deleteAll(scope)` | Delete all memories matching scope. |
| `close()` | Release PGlite connections / model resources. |

### `search` options

Extends `MemoryScope` with:

```ts
{
  userId?: string;
  agentId?: string;
  sessionId?: string;
  limit?: number; // default: 10
}
```

### `MemoryScope`

```ts
{ userId?: string; agentId?: string; sessionId?: string }
```

### `Memory`

```ts
{
  id: string;
  content: string;
  embedding: number[];
  userId?: string;
  agentId?: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

### `MemorySearchResult`

```ts
{
  memory: Memory;
  score: number; // cosine similarity, 0–1
}
```

## Adapter interfaces

### `EmbeddingAdapter`

```ts
{
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}
```

### `StorageAdapter`

```ts
{
  init(dimensions: number): Promise<void>;
  insert(memory): Promise<Memory>;
  search(embedding, scope, limit): Promise<MemorySearchResult[]>;
  getAll(scope): Promise<Memory[]>;
  delete(id): Promise<void>;
  deleteAll(scope): Promise<void>;
  close?(): Promise<void>;
}
```

## Errors

All errors extend `TurboMemError` with a stable `code` field:

| Code | Class | When |
| ---- | ----- | ---- |
| `NOT_INITIALISED` | `NotInitialisedError` | Method called before `init()` |
| `EMBEDDING_FAILED` | `EmbeddingError` | Embedding adapter failure |
| `STORAGE_FAILED` | `StorageError` | Storage adapter failure |
| `EXTRACTION_FAILED` | `ExtractionError` | Extraction failure (usually swallowed in `add`) |
| `DIMENSION_MISMATCH` | `DimensionMismatchError` | Embedding dimensions changed against existing store |
| `INVALID_CONFIG` | `ConfigError` | Invalid adapter or config value |
| `INVALID_INPUT` | `TurboMemError` | Zod validation failure on inputs |

Branch on `error.code` rather than message strings:

```ts
import { TurboMemError } from "turbomem";

try {
  await memory.search("query", { userId: "u1" });
} catch (err) {
  if (err instanceof TurboMemError && err.code === "NOT_INITIALISED") {
    await memory.init();
  }
}
```

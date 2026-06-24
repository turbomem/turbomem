---
title: Storage
description: Compare PGlite and sqlite-vec storage backends in turbomem, including defaults, install steps, and when to use each.
---

# Storage

turbomem persists memories and vector embeddings through a pluggable
`StorageAdapter`. Pick a built-in backend with a string preset, or pass your own
adapter instance.

> See [Configuration](/guide/configuration) for the full config shape and how
> storage fits alongside embeddings and extraction.

## Quick comparison

|                | PGlite (default)                                                 | sqlite-vec                                                  |
| -------------- | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| Preset         | `"pglite"`                                                       | `"sqlite-vec"`                                              |
| Engine         | WASM Postgres + [pgvector](https://github.com/pgvector/pgvector) | SQLite + [sqlite-vec](https://github.com/asg017/sqlite-vec) |
| Native compile | No                                                               | Yes (`better-sqlite3`)                                      |
| Extra install  | None (bundled)                                                   | `npm install better-sqlite3 sqlite-vec`                     |
| Default path   | `.turbomem/` (directory)                                         | `.turbomem.sqlite` (file)                                   |
| Vector search  | pgvector HNSW, cosine (`<=>`)                                    | `vec0` KNN, cosine distance                                 |
| Best for       | Default, zero native deps, broad Node compatibility              | Teams already on SQLite, familiar `.db` files               |

Both backends share the same API surface: scoped insert/search/delete, dimension
guards at `init()`, and cosine similarity scores in the 0–1 range.

## Selecting a backend

```ts
new TurboMemory({
  storage: "pglite", // or "sqlite-vec" | StorageAdapter
  // ...
});
```

Omit `storage` to use PGlite. Backend-specific options live under `pglite` or
`sqliteVec` in the config object, they are ignored when another backend is
selected.

::: tip Dimensions are fixed per store
The vector column dimension is set from your embedding adapter at `init()`. A
`turbomem_meta` table records the dimension so switching to a model with
different dimensions against an existing store throws `DimensionMismatchError`.
Use a fresh data directory or database file when you change embedding models.
:::

## PGlite (default)

[PGlite](https://pglite.dev/) runs a WASM Postgres instance inside your Node/Bun
process. The pgvector extension handles vector storage and similarity search, no
native compilation, no separate database server.

### Setup

PGlite ships as a dependency of `turbomem`. No extra install step.

### Configuration

```ts
new TurboMemory({
  storage: "pglite",
  pglite: {
    dataDir: "./my-memory", // default: .turbomem in process.cwd()
  },
  // ...
});
```

Data is written to a directory on disk (Postgres data files). Point `dataDir` at
any path your process can write to.

For tests or ephemeral usage, pass a custom adapter with in-memory mode:

```ts
import { PGliteStorageAdapter } from "turbomem";

new TurboMemory({
  storage: new PGliteStorageAdapter({ inMemory: true }),
  // ...
});
```

### How it works

On `init()`, turbomem creates a `memories` table with a `vector(N)` column sized
to your embedding adapter, an HNSW index for cosine search, and scope indexes on
`user_id` / `agent_id`. Search uses pgvector's `<=>` operator; scores are mapped
to cosine similarity as `1 - distance`.

## sqlite-vec (optional)

[sqlite-vec](https://github.com/asg017/sqlite-vec) adds vector search to SQLite
via a `vec0` virtual table. turbomem loads it through
[`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) a native Node
addon that must be compiled for your platform and Node version.

### Setup

Install the optional peer dependencies alongside `turbomem`:

```bash
npm install better-sqlite3 sqlite-vec
```

If you see a Node ABI mismatch after upgrading Node, rebuild the native module:

```bash
npm rebuild better-sqlite3
```

If the packages are missing at runtime, turbomem throws a `ConfigError` with
install instructions.

### Configuration

```ts
new TurboMemory({
  storage: "sqlite-vec",
  sqliteVec: {
    dbPath: "./my-memory.db", // default: .turbomem.sqlite in process.cwd()
    inMemory: false, // set true for ephemeral storage (tests)
  },
  // ...
});
```

PGlite and sqlite-vec use **separate default paths** (`.turbomem/` vs
`.turbomem.sqlite`) so switching backends does not mix Postgres data files with
a SQLite file.

For tests:

```ts
new TurboMemory({
  storage: "sqlite-vec",
  sqliteVec: { inMemory: true },
  // ...
});
```

Or instantiate the adapter directly:

```ts
import { SqliteVecStorageAdapter } from "turbomem";

new TurboMemory({
  storage: new SqliteVecStorageAdapter({ inMemory: true }),
  // ...
});
```

### How it works

sqlite-vec uses a two-table layout:

1. **`memories`** - scalar fields (content, scope, metadata, timestamps) with a
   UUID primary key.
2. **`memory_embeddings`** - a `vec0` virtual table holding vectors and scope
   columns for filtered KNN search, linked to `memories` by SQLite `rowid`.

Search runs cosine KNN inside SQLite (`distance_metric=cosine`); results are
joined back to `memories` and scored as `1 - distance` to match PGlite semantics.

## Custom adapter

Implement the `StorageAdapter` interface to plug in any vector store - Pinecone,
Qdrant, an hosted Postgres instance, or an in-memory mock for tests:

```ts
interface StorageAdapter {
  init(dimensions: number): Promise<void>;
  insert(memory: Omit<Memory, "id" | "createdAt" | "updatedAt">): Promise<Memory>;
  search(embedding: number[], scope: MemoryScope, limit: number): Promise<MemorySearchResult[]>;
  getAll(scope: MemoryScope): Promise<Memory[]>;
  delete(id: string): Promise<void>;
  deleteAll(scope: MemoryScope): Promise<void>;
  close?(): Promise<void>;
}
```

```ts
new TurboMemory({
  storage: myCustomStorage,
  // ...
});
```

Custom adapters receive the embedding dimension in `init()` so the underlying
vector column or index can be created with a matching size.

## Choosing a backend

**Use PGlite when:**

- You want the simplest install (`npm install turbomem` and go).
- Native compilation is a concern (CI, restricted environments, Electron without rebuild tooling).
- WASM Postgres fits your deployment target.

**Use sqlite-vec when:**

- You already standardize on SQLite or want a single `.db` file to ship or back up.
- Your team is comfortable managing `better-sqlite3` native builds.
- You prefer the sqlite-vec extension over embedded Postgres.

**Use a custom adapter when:**

- You need a hosted or cloud vector database.
- You want to share storage with an existing system of record.

## Next steps

- [Configuration](/guide/configuration) - full config object
- [Architecture](/guide/architecture) - how storage fits in the pipeline
- [Providers](/guide/providers) - embedding models and dimensions

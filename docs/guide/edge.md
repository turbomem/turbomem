---
title: Edge
description: Deploy agent memory on Vercel Edge, Cloudflare Workers, and Next.js serverless. Upstash Vector or Pinecone setup for turbomem.
---

# Edge

turbomem supports **opt-in edge deployment** via remote vector databases over HTTP:
[Upstash Vector](https://upstash.com/docs/vector/overall/getstarted) or
[Pinecone](https://docs.pinecone.io/). PGlite and sqlite-vec remain the default local backends
for Node/Bun; you only need this guide when deploying to stateless edge runtimes.

## When to use edge vs local storage

| Runtime                                      | Recommended storage                    |
| -------------------------------------------- | -------------------------------------- |
| Node, Bun, local-first apps                  | `"pglite"` (default) or `"sqlite-vec"` |
| Cloudflare Workers, Vercel Edge, Deno Deploy | `"upstash-vector"` or `"pinecone"`     |

Edge runtimes are **stateless**, there is no writable filesystem, and memory in an isolate does not survive between requests. Local PGlite or sqlite-vec paths will not persist on edge. Use a remote vector store instead.

::: tip No migration required
Existing PGlite or sqlite-vec setups keep working unchanged. Edge storage is an additional opt-in path.
:::

## How edge deployment works

```
Edge runtime ──► TurboMemory ──► Embedding API (fetch)
                      │
                      └──► Upstash Vector or Pinecone (HTTP)
```

1. Facts are extracted and embedded using fetch-based providers.
2. Vectors and metadata are stored in your remote vector index over REST.
3. Search queries embed the text, then query the index for similar vectors.

See [Architecture](/guide/architecture) for the full pipeline.

## Prerequisites

Before writing code:

- [ ] A remote vector store account — [Upstash](https://upstash.com/) or [Pinecone](https://www.pinecone.io/) (free tiers available)
- [ ] A vector index created in the console (see below)
- [ ] An embedding provider API key - [Google](/guide/providers) (`gemini-embedding-001`) or [Voyage](/guide/providers) (`voyage-4`) recommended. See [Providers](/guide/providers) for the full model list.
- [ ] An extraction provider API key - [Google](/guide/providers) (`gemini-3.5-flash`) recommended for edge. See [Providers](/guide/providers) for the full model list.

## Step 1: Create a vector index

turbomem does **not** create the index for you. Set it up once in your provider console.

### Upstash Vector

1. Go to [console.upstash.com](https://console.upstash.com/) → **Vector** → **Create Index**
2. Choose a name (e.g. `turbomem-prod`)
3. Set **Dimensions** to match your embedding model (see table below)
4. Set **Similarity function** to **Cosine** (matches PGlite and sqlite-vec)
5. Create the index
6. Open the index → **Connect** tab → copy **UPSTASH_VECTOR_REST_URL** and **UPSTASH_VECTOR_REST_TOKEN**

### Pinecone

1. Go to [app.pinecone.io](https://app.pinecone.io/) → **Create Index**
2. Choose **Serverless** and a name (e.g. `turbomem-prod`)
3. Set **Dimensions** to match your embedding model (see table below)
4. Set **Metric** to **cosine**
5. Create the index
6. Copy your **API key** from the console and note the **index name**

::: warning Dimensions must match your embedding model
The index dimension count is fixed at creation time. If it does not match your embedding adapter, `init()` throws `DimensionMismatchError`. Create a new index when you change models.
:::

### Dimensions reference

| Embeddings preset                     | Default dimensions | Set index to                                                           |
| ------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `"openai"` (`text-embedding-3-small`) | 1536               | **1536**                                                               |
| `"openai"` (`text-embedding-3-large`) | 3072               | **3072**                                                               |
| `"google"` (`gemini-embedding-001`)   | 3072               | **768**, **1536**, or **3072** (match your `google.dimensions` config) |
| `"voyage"`                            | 1024               | **1024** (or match your `voyage.dimensions`)                           |
| `"local"`                             | 384                | Not recommended on edge                                                |

See [Providers](/guide/providers) for the full embedding reference.

## Step 2: Install

**Upstash:**

```bash
npm install turbomem @upstash/vector
```

`@upstash/vector` is an optional peer dependency - only required when using `storage: "upstash-vector"`.

**Pinecone:**

```bash
npm install turbomem @pinecone-database/pinecone@^8
```

`@pinecone-database/pinecone` v8+ is an optional peer dependency — required when using
`storage: "pinecone"`. For Vite SSR / TanStack Start, see
[Pinecone integration patterns](/guide/storage#integration-patterns) (explicit `indexClient`).

## Step 3: Environment variables

```bash
# Upstash Vector (from console Connect tab)
export UPSTASH_VECTOR_REST_URL=https://...
export UPSTASH_VECTOR_REST_TOKEN=...

# Pinecone (from console)
export PINECONE_API_KEY=...
export PINECONE_INDEX=turbomem-prod

# Embedding + extraction (Google example)
export GEMINI_API_KEY=...
```

| Variable                    | Required                      | Used by                               |
| --------------------------- | ----------------------------- | ------------------------------------- |
| `UPSTASH_VECTOR_REST_URL`   | Yes (Upstash, unless config)  | Upstash storage                       |
| `UPSTASH_VECTOR_REST_TOKEN` | Yes (Upstash, unless config)  | Upstash storage                       |
| `PINECONE_API_KEY`          | Yes (Pinecone, unless config) | Pinecone storage                      |
| `PINECONE_INDEX`            | Yes (Pinecone, unless config) | Pinecone storage                      |
| `PINECONE_INDEX_HOST`       | No                            | Pinecone storage (skip describeIndex) |
| `GEMINI_API_KEY`            | Yes (Google stack)            | Embeddings + extraction               |
| `VOYAGE_API_KEY`            | Yes (Voyage embeddings)       | Embeddings                            |

## Step 4: Configure turbomem

**Upstash:**

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  storage: "upstash-vector",
  upstashVector: {
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
    // namespace: "my-app", // optional
  },
  embeddings: "google",
  google: {
    apiKey: process.env.GEMINI_API_KEY,
    dimensions: 768, // must match your index
  },
  extraction: {
    provider: "google",
    model: "gemini-3.5-flash",
    apiKey: process.env.GEMINI_API_KEY,
  },
});

await memory.init();

await memory.addFacts(["The user prefers edge deployments"], { userId: "user_123" });

const results = await memory.search("deployment preferences", { userId: "user_123" });
```

**Pinecone:**

```ts
import { TurboMemory } from "turbomem";

const memory = new TurboMemory({
  storage: "pinecone",
  pinecone: {
    apiKey: process.env.PINECONE_API_KEY,
    index: process.env.PINECONE_INDEX,
    // namespace: "my-app", // optional
  },
  embeddings: "google",
  google: {
    apiKey: process.env.GEMINI_API_KEY,
    dimensions: 768, // must match your index
  },
  extraction: {
    provider: "google",
    model: "gemini-3.5-flash",
    apiKey: process.env.GEMINI_API_KEY,
  },
});

await memory.init();

await memory.addFacts(["The user prefers edge deployments"], { userId: "user_123" });

const results = await memory.search("deployment preferences", { userId: "user_123" });
```

Or pass the adapter directly:

```ts
import { TurboMemory, UpstashVectorStorageAdapter, PineconeStorageAdapter } from "turbomem";

// Upstash
const memory = new TurboMemory({
  storage: new UpstashVectorStorageAdapter({
    url: process.env.UPSTASH_VECTOR_REST_URL,
    token: process.env.UPSTASH_VECTOR_REST_TOKEN,
  }),
  // ...
});

// Pinecone — see Storage guide for the explicit indexClient pattern (Vite SSR)
const memory = new TurboMemory({
  storage: new PineconeStorageAdapter({
    apiKey: process.env.PINECONE_API_KEY,
    index: process.env.PINECONE_INDEX,
  }),
  // ...
});
```

## Recommended provider stack

| Component  | Recommended                      | Avoid on edge                     |
| ---------- | -------------------------------- | --------------------------------- |
| Storage    | `"upstash-vector"`, `"pinecone"` | `"pglite"`, `"sqlite-vec"`        |
| Embeddings | `"google"`, `"voyage"`           | `"local"` (heavy WASM cold start) |
| Extraction | `"google"`                       | -                                 |

## Runtime notes

### Cloudflare Workers

Set secrets with `wrangler secret put UPSTASH_VECTOR_REST_URL` (and token, API keys) or
`wrangler secret put PINECONE_API_KEY`. No filesystem access — remote vector stores over HTTP
are the right fit.

### Vercel Edge Functions

Add environment variables in your project settings. If using Next.js App Router, mark the route as edge-compatible in your route config.

### Node / serverless (not edge)

PGlite is usually simpler for Node deployments with disk access. Upstash and Pinecone are
optional here too, useful when you want shared remote storage across serverless instances.

## Limitations

- **`getAll()`** - paginates or metadata-filters the index. Can be slow on large indexes.
- **`deleteAll()`** - metadata filter deletes can perform a full index scan (O(n)).
- **Eventual consistency** - newly upserted vectors may take a moment before appearing in search results.
- **Cost** - remote providers charge per request; PGlite uses free local disk.
- **CLI** - the turbomem CLI targets local PGlite. Edge users integrate via the SDK.

## Troubleshooting

| Error                                                 | Cause                              | Fix                                                                       |
| ----------------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `DimensionMismatchError`                              | Index dimensions ≠ embedding model | Create a new index with correct dimensions, or adjust `google.dimensions` |
| `ConfigError` (missing `@upstash/vector`)             | Peer not installed                 | `npm install @upstash/vector`                                             |
| `ConfigError` (missing `@pinecone-database/pinecone`) | Peer not installed                 | `npm install @pinecone-database/pinecone@^8`                              |
| `fetchByMetadata is not a function`                   | Pinecone SDK older than v8         | `npm install @pinecone-database/pinecone@^8`                              |
| `ConfigError` for Pinecone despite package installed  | Vite SSR bundled dynamic import    | Use explicit `indexClient` — [Storage patterns](/guide/storage#integration-patterns) |
| Upsert/query fails (401)                              | Wrong credentials                  | Re-copy credentials from provider console                                 |
| Empty search results right after insert               | Eventual consistency               | Retry after a brief delay                                                 |

## Next steps

- [Storage](/guide/storage) - full backend comparison
- [Configuration](/guide/configuration) - `upstashVector` and `pinecone` config reference
- [Providers](/guide/providers) - embedding dimensions and API keys
- [Architecture](/guide/architecture) - pipeline overview

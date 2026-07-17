---
title: Browser
description: Client-side agent memory in the browser with IndexedDB-backed PGlite. No remote database or Node.js server required.
---

# Browser

turbomem runs in the browser with **client-side persistence** via PGlite's IndexedDB
filesystem (`idb://`). No remote database, no Node.js server required.

## When to use browser vs Node vs edge

| Runtime                         | Recommended storage                 |
| ------------------------------- | ----------------------------------- |
| Browser (React, Vite, SPA)      | `"pglite"` with `idb://`            |
| Node, Bun, local-first apps     | `"pglite"` (disk) or `"sqlite-vec"` |
| Cloudflare Workers, Vercel Edge | `"upstash-vector"` or `"pinecone"`  |

The browser path keeps memories in **IndexedDB** on the user's device. Edge
runtimes are stateless, use [Upstash Vector or Pinecone](/guide/edge) instead.

::: tip Import from `turbomem/browser`
Browser apps should import from `turbomem/browser`, not the main `turbomem` entry.
The browser export excludes Node-only storage adapters (`sqlite-vec`) so bundlers
like Vite can produce a clean client bundle.
:::

## How browser deployment works

```
Browser app ──► TurboMemory ──► Embedding API (fetch)
                     │
                     └──► PGlite (idb://) ──► IndexedDB
```

1. Facts are extracted and embedded using fetch-based providers.
2. Vectors and metadata are stored in a WASM Postgres instance backed by IndexedDB.
3. Search queries embed the text, then query pgvector locally.

See [Architecture](/guide/architecture) for the full pipeline.

## Prerequisites

Before writing code:

- [ ] An embedding provider API key — [Google](/guide/providers) (`gemini-embedding-001`) or [Voyage](/guide/providers) (`voyage-4`) recommended; OpenAI (`text-embedding-3-small`) also works. See [Providers](/guide/providers) for the full model list.
- [ ] An extraction provider API key — [Google](/guide/providers) (`gemini-3.5-flash`) recommended (same key as Google embeddings). OpenAI also works. See [Providers](/guide/providers) for the full model list.
- [ ] A client-side app (React, Vue, Svelte, vanilla TS) bundled with Vite, webpack, etc.

## Step 1: Install

```bash
npm install turbomem
```

PGlite ships as a dependency. No extra database setup.

## Step 2: Configure turbomem

```ts
import { TurboMemory } from "turbomem/browser";

const memory = new TurboMemory({
  storage: "pglite",
  pglite: {
    dataDir: "idb://my-app-memories",
    relaxedDurability: true, // default for idb:// paths
  },
  embeddings: "google",
  google: {
    apiKey: "...", // pass explicitly - no process.env in the browser
    dimensions: 768,
  },
  extraction: {
    provider: "google",
    model: "gemini-3.5-flash",
    apiKey: "...",
  },
});

await memory.init();

await memory.addFacts(["The user prefers dark mode"], { userId: "user_123" });

const results = await memory.search("UI preferences", { userId: "user_123" });
```

Or pass the adapter directly:

```ts
import { TurboMemory, PGliteStorageAdapter } from "turbomem/browser";

const memory = new TurboMemory({
  storage: new PGliteStorageAdapter({
    dataDir: "idb://my-app-memories",
    relaxedDurability: true,
  }),
  // ...
});
```

## Recommended provider stack

| Component  | Recommended                        | Also works                      | Avoid in browser                                 |
| ---------- | ---------------------------------- | ------------------------------- | ------------------------------------------------ |
| Storage    | `"pglite"` + `idb://`              | custom adapter                  | `"sqlite-vec"`, `"upstash-vector"`, `"pinecone"` |
| Embeddings | `"google"`, `"voyage"`             | `"openai"` (proxy keys in prod) | `"local"` (heavy WASM cold start)                |
| Extraction | `"google"` (single key with above) | `"openai"`                      | -                                                |

## API keys and security

Browsers have no `process.env`. Pass API keys explicitly in your config.

**Do not ship provider API keys in production client bundles.** For production
apps, proxy embedding and extraction calls through your backend and keep secrets
server-side. The [browser-vite example](https://github.com/turbomem/turbomem/tree/master/examples/browser-vite)
accepts a key in the UI for demo purposes only.

## Framework notes

### React / Vite

Import from `turbomem/browser` in client components. Initialise once (singleton
or `useRef`) - PGlite loads WASM on first `init()`.

```ts
// vite.config.ts
export default defineConfig({
  optimizeDeps: {
    exclude: ["@electric-sql/pglite"],
  },
});
```

### Next.js App Router

Use a `"use client"` component. Do not import turbomem in Server Components.
For server-side memory, use disk PGlite or Upstash instead.

## IndexedDB options

| Option                  | Description                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `dataDir: "idb://name"` | Persists to an IndexedDB database named `name` on this origin.                       |
| `relaxedDurability`     | Returns query results before IndexedDB flush completes. Default `true` for `idb://`. |
| `inMemory: true`        | Ephemeral storage (no persistence). Useful for tests.                                |

::: warning Dimensions are fixed per store
The vector column dimension is set at `init()`. Changing embedding models
against an existing IndexedDB store throws `DimensionMismatchError`. Use a new
`idb://` name when switching models.
:::

## Limitations

- **Single-tab (v1)** - each browser tab has its own PGlite connection. Multi-tab
  worker support is planned for a future release.
- **IndexedDB flush latency** - writes can take a few milliseconds. Enable
  `relaxedDurability` for responsive UIs.
- **Safari private browsing** - IndexedDB may not persist across private sessions.
- **Storage eviction** - browsers may evict IndexedDB under storage pressure (especially on iOS).
- **CLI** - the turbomem CLI targets Node/PGlite on disk. Browser users integrate via the SDK.
- **Bundle size** - PGlite ships WASM Postgres (~8 MB). Acceptable for local-first apps but not zero-cost.

## Troubleshooting

| Error                      | Cause                                              | Fix                                                                |
| -------------------------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| `DimensionMismatchError`   | Store dimensions ≠ embedding model                 | Use a new `idb://` name or clear IndexedDB for the origin          |
| Bundler fails on `node:fs` | Imported main entry in browser                     | Switch to `import { TurboMemory } from "turbomem/browser"`         |
| Empty results after reload | Wrong `idb://` name or cleared storage             | Verify `dataDir` matches; check DevTools → Application → IndexedDB |
| `ConfigError` for storage  | Used `sqlite-vec`, `upstash-vector`, or `pinecone` | Use `storage: "pglite"` with `idb://` in the browser               |

## Next steps

- [Storage](/guide/storage) - full backend comparison
- [Configuration](/guide/configuration) - `pglite` config reference
- [Providers](/guide/providers) - embedding dimensions and API keys
- [Examples](/examples) - runnable browser-vite demo

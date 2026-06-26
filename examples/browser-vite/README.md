# browser-vite

A minimal Vite SPA showing turbomem running **entirely in the browser** with
IndexedDB-backed PGlite storage.

## What it demonstrates

- Import from `turbomem/browser` (browser-safe entry point)
- PGlite persistence via `pglite.dataDir: "idb://turbomem-demo"`
- Google embeddings over `fetch` (no Node.js required)
- Facts survive page reloads (stored in IndexedDB)

## Run locally

From the monorepo root:

```bash
pnpm install
pnpm --filter turbomem build
pnpm --filter @turbomem/example-browser-vite dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

You'll need a [Google AI API key](https://aistudio.google.com/apikey) for
Gemini embeddings. The demo stores the key in `sessionStorage` for convenience
only.

## Security note

This demo sends your API key directly from the browser to Google. **Do not ship
API keys in client-side production apps.** Proxy embedding and extraction calls
through your backend instead.

## Source

- [`src/main.ts`](src/main.ts) — turbomem setup and UI handlers
- [`index.html`](index.html) — minimal UI

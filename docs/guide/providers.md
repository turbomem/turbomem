---
title: Providers
description: Compare every embedding and fact-extraction provider supported by turbomem, including models, dimensions, and required API keys.
---

# Providers

turbomem ships with several built-in **embedding** and **fact-extraction**
providers. Pick one with a string preset in your config, or pass a custom
adapter. This page is a quick reference for the models, dimensions, and
credentials each provider needs.

> See [Configuration](/guide/configuration) for the full config shape and how
> these presets are wired together.

## Embedding providers

Select with `embeddings: "openai" | "local" | "voyage" | "google"`.

::: tip Recommended defaults
**OpenAI** - `text-embedding-3-small` (1536d) · **Voyage** - `voyage-4` (1024d) · **Google** - `gemini-embedding-001` (3072d, recommend truncating to 768 / 1536)
:::

| Provider | Models | Default dims | Supported dims | API key / env var |
| -------- | ------ | ------------ | -------------- | ----------------- |
| OpenAI<br>Preset: `"openai"` | `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002` (legacy) | 1536 (`3-small`) | 1536 / 3072 | `OPENAI_API_KEY` |
| Local (transformers)<br>Preset: `"local"` | `Xenova/all-MiniLM-L6-v2`, `Xenova/bge-small-en-v1.5` | 384 | 384 | none (runs on-device) |
| Voyage AI<br>Preset: `"voyage"` | `voyage-4`, `voyage-4-large`, `voyage-4-lite`, `voyage-code-3`, `voyage-3.5`, `voyage-3.5-lite`, `voyage-3-large` | 1024 | 256 / 512 / 1024 / 2048 | `VOYAGE_API_KEY` |
| Google Gemini<br>Preset: `"google"` | `gemini-embedding-001` | 3072 | 128–3072 (recommend 768 / 1536 / 3072) | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) |

::: tip Dimensions are fixed per store
The vector column dimension is derived from your embedding adapter at `init()`.
Switching to a model with different dimensions against an existing store throws
`DimensionMismatchError` - start a fresh data directory when you change models.
:::

### OpenAI

```ts
new TurboMemory({
  embeddings: "openai", // text-embedding-3-small (1536d)
  openai: { apiKey: process.env.OPENAI_API_KEY },
  // ...
});
```

### Local (transformers)

Zero-API-cost, on-device embeddings. Requires the optional
[`@huggingface/transformers`](https://github.com/huggingface/transformers.js)
package (`npm install @huggingface/transformers`). The model (~25MB) downloads
on first use and is cached for the rest of the process.

```ts
new TurboMemory({
  embeddings: "local", // Xenova/all-MiniLM-L6-v2 (384d)
  local: { model: "Xenova/bge-small-en-v1.5" }, // optional
  // ...
});
```

### Voyage AI

Calls `https://api.voyageai.com/v1/embeddings` over plain `fetch` (no extra
dependency). Defaults to `voyage-4` at 1024 dimensions; set `dimensions` to one
of 256 / 512 / 1024 / 2048 to use Matryoshka truncation. Voyage 3.x models remain
supported but Voyage 4 is recommended for new projects.

```ts
new TurboMemory({
  embeddings: "voyage",
  voyage: {
    apiKey: process.env.VOYAGE_API_KEY,
    model: "voyage-4",
    dimensions: 1024, // optional
  },
  // ...
});
```

### Google Gemini

Calls the Generative Language API over plain `fetch`. Defaults to
`gemini-embedding-001` at 3072 dimensions. Vectors are always L2-normalized,
which is required when you request a truncated `dimensions` value (Gemini does
not normalize those automatically).

```ts
new TurboMemory({
  embeddings: "google",
  google: {
    apiKey: process.env.GEMINI_API_KEY,
    model: "gemini-embedding-001",
    dimensions: 768, // optional (recommend 768 / 1536 / 3072)
  },
  // ...
});
```

### Custom adapter

Pass any object implementing `EmbeddingAdapter`:

```ts
new TurboMemory({ embeddings: myCustomAdapter /* ... */ });
```

## Extraction providers

Select with `extraction.provider: "openai" | "anthropic" | "google"`.

::: tip Recommended defaults
**OpenAI** - `gpt-4.1-mini` · **Anthropic** - `claude-haiku-4-5` · **Google** `gemini-3.5-flash`
:::

| Provider          | Preset                 | Example models                                                                    | API key / env var                                 |
| ----------------- | ---------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------- |
| OpenAI            | `"openai"`             | `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o`                                          | `OPENAI_API_KEY`                                  |
| Anthropic         | `"anthropic"`          | `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-8`                        | `ANTHROPIC_API_KEY`                               |
| Google Gemini     | `"google"`             | `gemini-3.5-flash`, `gemini-3.1-flash-lite`, `gemini-2.5-flash`, `gemini-2.5-pro` | `GEMINI_API_KEY` (or `GOOGLE_API_KEY`)            |
| OpenAI-compatible | `"openai"` + `baseURL` | Groq, OpenRouter, Together, Mistral, DeepSeek, Ollama, …                          | provider-specific (passed as `extraction.apiKey`) |

::: tip Any OpenAI-compatible endpoint works
Providers that expose an OpenAI-compatible chat completions API (Groq,
OpenRouter, Together, Mistral, Ollama, and others) work today via the `openai`
provider with a custom `baseURL` - no new provider needed.
:::

```ts
// OpenAI extraction
extraction: {
  provider: "openai",
  model: "gpt-4.1-mini",
  apiKey: process.env.OPENAI_API_KEY,
}

// Native Google extraction
extraction: {
  provider: "google",
  model: "gemini-3.5-flash",
  apiKey: process.env.GEMINI_API_KEY,
}

// Any OpenAI-compatible endpoint (e.g. Groq)
extraction: {
  provider: "openai",
  model: "llama-3.3-70b-versatile",
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
}

// Anthropic extraction - needs npm install @anthropic-ai/sdk
extraction: {
  provider: "anthropic",
  model: "claude-haiku-4-5",
  apiKey: process.env.ANTHROPIC_API_KEY,
}
```

The Anthropic provider needs the optional `@anthropic-ai/sdk` package
(`npm install @anthropic-ai/sdk`). OpenAI and Google providers use the bundled
`openai` SDK and plain `fetch` respectively, so they need no extra install.

Extraction is **non-fatal**: parse or transport failures log a warning and yield
`[]` rather than throwing.

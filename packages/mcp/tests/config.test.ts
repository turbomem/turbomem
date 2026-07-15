import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkCredentials, resolveConfig, toMemoryConfig } from "../src/config.js";

const ENV_KEYS = [
  "TURBOMEM_PROVIDER",
  "TURBOMEM_API_KEY",
  "TURBOMEM_EMBEDDINGS_PROVIDER",
  "TURBOMEM_EMBEDDINGS_API_KEY",
  "TURBOMEM_USER_ID",
  "TURBOMEM_DATA_DIR",
  "TURBOMEM_EXTRACTION_MODEL",
  "TURBOMEM_EMBEDDING_MODEL",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "ANTHROPIC_API_KEY",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

describe("resolveConfig", () => {
  it("defaults to OpenAI for both extraction and embeddings with a single key", () => {
    process.env.TURBOMEM_API_KEY = "sk-openai";
    const resolved = resolveConfig();
    expect(resolved.extractionProvider).toBe("openai");
    expect(resolved.embeddingsProvider).toBe("openai");
    expect(resolved.extractionApiKey).toBe("sk-openai");
    expect(resolved.embeddingsApiKey).toBe("sk-openai");

    const cfg = toMemoryConfig(resolved);
    expect(cfg.embeddings).toBe("openai");
    expect(cfg.extraction.provider).toBe("openai");
    expect(cfg.openai?.apiKey).toBe("sk-openai");
  });

  it("mirrors the provider for google", () => {
    process.env.TURBOMEM_PROVIDER = "google";
    process.env.TURBOMEM_API_KEY = "g-key";
    const resolved = resolveConfig();
    expect(resolved.embeddingsProvider).toBe("google");
    const cfg = toMemoryConfig(resolved);
    expect(cfg.embeddings).toBe("google");
    expect(cfg.extraction.provider).toBe("google");
    expect(cfg.google?.apiKey).toBe("g-key");
  });

  it("runs Anthropic extraction with OpenAI embeddings when a search provider is set", () => {
    process.env.TURBOMEM_PROVIDER = "anthropic";
    process.env.TURBOMEM_API_KEY = "sk-ant";
    process.env.TURBOMEM_EMBEDDINGS_PROVIDER = "openai";
    process.env.TURBOMEM_EMBEDDINGS_API_KEY = "sk-openai";

    const resolved = resolveConfig();
    expect(resolved.extractionProvider).toBe("anthropic");
    expect(resolved.embeddingsProvider).toBe("openai");

    const cfg = toMemoryConfig(resolved);
    expect(cfg.embeddings).toBe("openai");
    expect(cfg.openai?.apiKey).toBe("sk-openai");
    expect(cfg.extraction.provider).toBe("anthropic");
    expect(cfg.extraction.apiKey).toBe("sk-ant");
    expect(checkCredentials(resolved)).toBeNull();
  });

  it("falls back to local embeddings for bare Anthropic", () => {
    process.env.TURBOMEM_PROVIDER = "anthropic";
    process.env.TURBOMEM_API_KEY = "sk-ant";
    const resolved = resolveConfig();
    expect(resolved.embeddingsProvider).toBe("local");
    expect(checkCredentials(resolved)).toBeNull();
    const cfg = toMemoryConfig(resolved);
    expect(cfg.embeddings).toBe("local");
  });

  it("ignores unsubstituted template placeholders", () => {
    process.env.TURBOMEM_PROVIDER = "openai";
    process.env.TURBOMEM_API_KEY = "sk-openai";
    process.env.TURBOMEM_EMBEDDINGS_PROVIDER = "${user_config.embeddings_provider}";
    process.env.TURBOMEM_EMBEDDINGS_API_KEY = "${user_config.embeddings_api_key}";
    const resolved = resolveConfig();
    expect(resolved.embeddingsProvider).toBe("openai");
    expect(resolved.embeddingsApiKey).toBe("sk-openai");
  });

  it("reports a missing extraction key", () => {
    process.env.TURBOMEM_PROVIDER = "openai";
    const resolved = resolveConfig();
    expect(checkCredentials(resolved)).toMatch(/OpenAI API key/);
  });

  it("reports a missing embeddings key for Anthropic + OpenAI search", () => {
    process.env.TURBOMEM_PROVIDER = "anthropic";
    process.env.TURBOMEM_API_KEY = "sk-ant";
    process.env.TURBOMEM_EMBEDDINGS_PROVIDER = "openai";
    const resolved = resolveConfig();
    expect(checkCredentials(resolved)).toMatch(/OpenAI API key found for embeddings/);
  });
});

import { homedir } from "node:os";
import { join } from "node:path";
import { TurboMemory } from "turbomem";
import type { TurboMemoryConfig } from "turbomem";

/** Root directory for turbomem state, shared with the CLI. */
export const TURBOMEM_HOME = join(homedir(), ".turbomem");
/** Default on-disk location for the PGlite database (shared with the CLI). */
export const DEFAULT_DATA_DIR = join(TURBOMEM_HOME, "data");
/** Default scope used when the user has not set one. */
export const DEFAULT_USER_ID = "me";

/**
 * The provider a user picks at install time. A single API key drives both
 * embeddings and fact extraction:
 * - `openai` / `google`: the same provider handles embeddings and extraction.
 * - `anthropic`: extraction runs on Anthropic; embeddings fall back to a local
 *   WASM model so no second key is required.
 */
export type Provider = "openai" | "anthropic" | "google";

const PROVIDERS: readonly Provider[] = ["openai", "anthropic", "google"];

const DEFAULT_EXTRACTION_MODEL: Record<Provider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-haiku-4-5",
  google: "gemini-3.5-flash",
};

/** Fully-resolved config with defaults applied. */
export interface ResolvedConfig {
  provider: Provider;
  apiKey?: string;
  extractionModel: string;
  embeddingModel?: string;
  localModel?: string;
  dataDir: string;
  userId: string;
}

function parseProvider(value: string | undefined): Provider {
  const normalized = (value ?? "openai").trim().toLowerCase();
  return PROVIDERS.includes(normalized as Provider) ? (normalized as Provider) : "openai";
}

/** Read the effective config from the environment (populated by the .mcpb host). */
export function resolveConfig(): ResolvedConfig {
  const provider = parseProvider(process.env.TURBOMEM_PROVIDER);

  const apiKey =
    provider === "anthropic"
      ? process.env.ANTHROPIC_API_KEY
      : provider === "google"
        ? (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY)
        : process.env.OPENAI_API_KEY;

  return {
    provider,
    apiKey: apiKey?.trim() || undefined,
    extractionModel: process.env.TURBOMEM_EXTRACTION_MODEL ?? DEFAULT_EXTRACTION_MODEL[provider],
    embeddingModel: process.env.TURBOMEM_EMBEDDING_MODEL,
    localModel: process.env.TURBOMEM_LOCAL_MODEL,
    dataDir: process.env.TURBOMEM_DATA_DIR?.trim() || DEFAULT_DATA_DIR,
    userId: process.env.TURBOMEM_USER_ID?.trim() || DEFAULT_USER_ID,
  };
}

/** Map the resolved config to a core {@link TurboMemoryConfig}. */
export function toMemoryConfig(resolved: ResolvedConfig): TurboMemoryConfig {
  const base = {
    storage: "pglite" as const,
    pglite: { dataDir: resolved.dataDir },
  };

  if (resolved.provider === "google") {
    return {
      ...base,
      embeddings: "google",
      google: { apiKey: resolved.apiKey, model: resolved.embeddingModel },
      extraction: { provider: "google", model: resolved.extractionModel, apiKey: resolved.apiKey },
    };
  }

  if (resolved.provider === "anthropic") {
    return {
      ...base,
      embeddings: "local",
      local: resolved.localModel ? { model: resolved.localModel } : undefined,
      extraction: {
        provider: "anthropic",
        model: resolved.extractionModel,
        apiKey: resolved.apiKey,
      },
    };
  }

  return {
    ...base,
    embeddings: "openai",
    extraction: { provider: "openai", model: resolved.extractionModel, apiKey: resolved.apiKey },
    openai: { apiKey: resolved.apiKey },
  };
}

/**
 * Validate that the credential required by the chosen provider is present,
 * returning a human-readable error message or `null` when everything is set.
 */
export function checkCredentials(resolved: ResolvedConfig): string | null {
  if (resolved.apiKey) return null;

  switch (resolved.provider) {
    case "anthropic":
      return "No Anthropic API key found. Open Claude Desktop → Settings → Extensions → turbomem and paste your Anthropic API key.";
    case "google":
      return "No Google (Gemini) API key found. Open Claude Desktop → Settings → Extensions → turbomem and paste your Gemini API key.";
    default:
      return "No OpenAI API key found. Open Claude Desktop → Settings → Extensions → turbomem and paste your OpenAI API key.";
  }
}

/**
 * Build and initialise a {@link TurboMemory} instance from the environment.
 * Throws with a friendly message when the required credential is missing.
 */
export async function buildMemory(): Promise<{ memory: TurboMemory; resolved: ResolvedConfig }> {
  const resolved = resolveConfig();
  const credentialError = checkCredentials(resolved);
  if (credentialError) throw new Error(credentialError);

  const memory = new TurboMemory(toMemoryConfig(resolved));
  await memory.init();
  return { memory, resolved };
}

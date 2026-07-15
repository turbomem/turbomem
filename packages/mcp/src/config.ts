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

/** Provider used for LLM fact extraction. */
export type ExtractionProvider = "openai" | "anthropic" | "google";
/** Provider used to embed memories for semantic search. */
export type EmbeddingsProvider = "openai" | "google" | "local";

const EXTRACTION_PROVIDERS: readonly ExtractionProvider[] = ["openai", "anthropic", "google"];
const EMBEDDINGS_PROVIDERS: readonly EmbeddingsProvider[] = ["openai", "google", "local"];

const DEFAULT_EXTRACTION_MODEL: Record<ExtractionProvider, string> = {
  openai: "gpt-4.1-mini",
  anthropic: "claude-haiku-4-5",
  google: "gemini-3.5-flash",
};

/**
 * Fully-resolved config with defaults applied.
 *
 * Extraction and embeddings are resolved independently so that, for example,
 * Anthropic can handle extraction while OpenAI or Google handles embeddings
 * (HTTP-only, no local model required).
 */
export interface ResolvedConfig {
  extractionProvider: ExtractionProvider;
  extractionApiKey?: string;
  extractionModel: string;
  embeddingsProvider: EmbeddingsProvider;
  embeddingsApiKey?: string;
  embeddingModel?: string;
  localModel?: string;
  dataDir: string;
  userId: string;
}

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  // Guard against hosts that leave optional "${user_config.x}" placeholders
  // unsubstituted when a field is left blank.
  if (!trimmed || trimmed.includes("${")) return undefined;
  return trimmed;
}

function parseExtractionProvider(value: string | undefined): ExtractionProvider {
  const normalized = (value ?? "openai").trim().toLowerCase();
  return EXTRACTION_PROVIDERS.includes(normalized as ExtractionProvider)
    ? (normalized as ExtractionProvider)
    : "openai";
}

/** Standard env var key for a provider, matching the turbomem convention. */
function envKeyFor(provider: ExtractionProvider | EmbeddingsProvider): string | undefined {
  switch (provider) {
    case "anthropic":
      return clean(process.env.ANTHROPIC_API_KEY);
    case "google":
      return clean(process.env.GEMINI_API_KEY) ?? clean(process.env.GOOGLE_API_KEY);
    case "openai":
      return clean(process.env.OPENAI_API_KEY);
    default:
      return undefined;
  }
}

/**
 * Resolve the embeddings provider. Explicit `TURBOMEM_EMBEDDINGS_PROVIDER` wins;
 * otherwise it mirrors the extraction provider for openai/google, and falls back
 * to a local WASM model for anthropic (which has no embedding API).
 */
function resolveEmbeddingsProvider(
  raw: string | undefined,
  extractionProvider: ExtractionProvider,
): EmbeddingsProvider {
  const normalized = clean(raw)?.toLowerCase();
  if (normalized && EMBEDDINGS_PROVIDERS.includes(normalized as EmbeddingsProvider)) {
    return normalized as EmbeddingsProvider;
  }
  if (extractionProvider === "google") return "google";
  if (extractionProvider === "anthropic") return "local";
  return "openai";
}

/** Read the effective config from the environment (populated by the .mcpb host). */
export function resolveConfig(): ResolvedConfig {
  const extractionProvider = parseExtractionProvider(process.env.TURBOMEM_PROVIDER);
  const extractionApiKey = clean(process.env.TURBOMEM_API_KEY) ?? envKeyFor(extractionProvider);

  const embeddingsProvider = resolveEmbeddingsProvider(
    process.env.TURBOMEM_EMBEDDINGS_PROVIDER,
    extractionProvider,
  );

  let embeddingsApiKey: string | undefined;
  if (embeddingsProvider !== "local") {
    embeddingsApiKey =
      clean(process.env.TURBOMEM_EMBEDDINGS_API_KEY) ??
      // When embeddings and extraction share a provider, the single key covers both.
      (embeddingsProvider === extractionProvider ? extractionApiKey : undefined) ??
      envKeyFor(embeddingsProvider);
  }

  return {
    extractionProvider,
    extractionApiKey,
    extractionModel:
      clean(process.env.TURBOMEM_EXTRACTION_MODEL) ?? DEFAULT_EXTRACTION_MODEL[extractionProvider],
    embeddingsProvider,
    embeddingsApiKey,
    embeddingModel: clean(process.env.TURBOMEM_EMBEDDING_MODEL),
    localModel: clean(process.env.TURBOMEM_LOCAL_MODEL),
    dataDir: clean(process.env.TURBOMEM_DATA_DIR) ?? DEFAULT_DATA_DIR,
    userId: clean(process.env.TURBOMEM_USER_ID) ?? DEFAULT_USER_ID,
  };
}

/** Map the resolved config to a core {@link TurboMemoryConfig}. */
export function toMemoryConfig(resolved: ResolvedConfig): TurboMemoryConfig {
  const config: TurboMemoryConfig = {
    storage: "pglite",
    pglite: { dataDir: resolved.dataDir },
    embeddings: resolved.embeddingsProvider,
    extraction: {
      provider: resolved.extractionProvider,
      model: resolved.extractionModel,
      apiKey: resolved.extractionApiKey,
    },
  };

  if (resolved.embeddingsProvider === "openai") {
    config.openai = { apiKey: resolved.embeddingsApiKey };
  } else if (resolved.embeddingsProvider === "google") {
    config.google = { apiKey: resolved.embeddingsApiKey, model: resolved.embeddingModel };
  } else if (resolved.embeddingsProvider === "local") {
    config.local = resolved.localModel ? { model: resolved.localModel } : undefined;
  }

  // Extraction may need its own provider config block for the API key.
  if (resolved.extractionProvider === "openai") {
    config.openai = { ...config.openai, apiKey: config.openai?.apiKey ?? resolved.extractionApiKey };
  } else if (resolved.extractionProvider === "google") {
    config.google = {
      ...config.google,
      apiKey: config.google?.apiKey ?? resolved.extractionApiKey,
    };
  }

  return config;
}

function providerLabel(provider: ExtractionProvider | EmbeddingsProvider): string {
  switch (provider) {
    case "anthropic":
      return "Anthropic";
    case "google":
      return "Google (Gemini)";
    case "openai":
      return "OpenAI";
    default:
      return provider;
  }
}

/**
 * Validate that the credentials required by the resolved config are present,
 * returning a human-readable error message or `null` when everything is set.
 */
export function checkCredentials(resolved: ResolvedConfig): string | null {
  if (!resolved.extractionApiKey) {
    return `No ${providerLabel(resolved.extractionProvider)} API key found. Open Claude Desktop → Settings → Extensions → turbomem and paste your ${providerLabel(resolved.extractionProvider)} API key.`;
  }
  if (resolved.embeddingsProvider !== "local" && !resolved.embeddingsApiKey) {
    return `No ${providerLabel(resolved.embeddingsProvider)} API key found for embeddings. Set the embeddings API key in Claude Desktop → Settings → Extensions → turbomem (search needs it).`;
  }
  return null;
}

/**
 * Build and initialise a {@link TurboMemory} instance from the environment.
 * Throws with a friendly message when a required credential is missing.
 */
export async function buildMemory(): Promise<{ memory: TurboMemory; resolved: ResolvedConfig }> {
  const resolved = resolveConfig();
  const credentialError = checkCredentials(resolved);
  if (credentialError) throw new Error(credentialError);

  const memory = new TurboMemory(toMemoryConfig(resolved));
  await memory.init();
  return { memory, resolved };
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { TurboMemory } from "turbomem";
import type { TurboMemoryConfig } from "turbomem";

/** Root directory for all CLI state. */
export const TURBOMEM_HOME = join(homedir(), ".turbomem");
/** Path to the persisted config file written by `turbomem init`. */
export const CONFIG_PATH = join(TURBOMEM_HOME, "config.json");
/** Default on-disk location for the PGlite database. */
export const DEFAULT_DATA_DIR = join(TURBOMEM_HOME, "data");

export type EmbeddingsProvider = "openai" | "local" | "voyage" | "google";
export type ExtractionProvider = "openai" | "anthropic" | "google";

/** Shape persisted to `~/.turbomem/config.json`. All fields optional. */
export interface CliConfig {
  embeddings?: EmbeddingsProvider;
  localModel?: string;
  embeddingModel?: string;
  extractionProvider?: ExtractionProvider;
  extractionModel?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  voyageApiKey?: string;
  googleApiKey?: string;
  dataDir?: string;
}

/** Fully-resolved config with defaults applied. */
export interface ResolvedConfig {
  embeddings: EmbeddingsProvider;
  localModel?: string;
  embeddingModel?: string;
  extractionProvider: ExtractionProvider;
  extractionModel: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  voyageApiKey?: string;
  googleApiKey?: string;
  dataDir: string;
}

/** Overrides supplied via CLI flags (highest precedence). */
export interface ConfigOverrides {
  dataDir?: string;
  embeddings?: EmbeddingsProvider;
  extractionProvider?: ExtractionProvider;
  extractionModel?: string;
  openaiApiKey?: string;
  anthropicApiKey?: string;
  voyageApiKey?: string;
  googleApiKey?: string;
}

const DEFAULT_EXTRACTION_MODEL: Record<ExtractionProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-3-5-haiku-latest",
  google: "gemini-2.5-flash",
};

/** Read the saved config file, returning an empty object when none exists. */
export function loadConfigFile(): CliConfig {
  if (!existsSync(CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as CliConfig;
  } catch {
    return {};
  }
}

/** Persist the config file, creating `~/.turbomem` if needed. */
export function saveConfigFile(config: CliConfig): void {
  mkdirSync(dirname(CONFIG_PATH), { recursive: true });
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + "\n", "utf8");
}

/** Whether a config file has been written yet. */
export function hasConfigFile(): boolean {
  return existsSync(CONFIG_PATH);
}

/**
 * Resolve effective config with precedence: flags > environment > config file >
 * built-in defaults.
 */
export function resolveConfig(overrides: ConfigOverrides = {}): ResolvedConfig {
  const file = loadConfigFile();

  const embeddings =
    overrides.embeddings ?? (process.env.TURBOMEM_EMBEDDINGS as EmbeddingsProvider) ?? file.embeddings ?? "openai";

  const extractionProvider =
    overrides.extractionProvider ??
    (process.env.TURBOMEM_EXTRACTION_PROVIDER as ExtractionProvider) ??
    file.extractionProvider ??
    "openai";

  const extractionModel =
    overrides.extractionModel ??
    process.env.TURBOMEM_EXTRACTION_MODEL ??
    file.extractionModel ??
    DEFAULT_EXTRACTION_MODEL[extractionProvider];

  return {
    embeddings,
    localModel: process.env.TURBOMEM_LOCAL_MODEL ?? file.localModel,
    embeddingModel: process.env.TURBOMEM_EMBEDDING_MODEL ?? file.embeddingModel,
    extractionProvider,
    extractionModel,
    openaiApiKey: overrides.openaiApiKey ?? process.env.OPENAI_API_KEY ?? file.openaiApiKey,
    anthropicApiKey:
      overrides.anthropicApiKey ?? process.env.ANTHROPIC_API_KEY ?? file.anthropicApiKey,
    voyageApiKey: overrides.voyageApiKey ?? process.env.VOYAGE_API_KEY ?? file.voyageApiKey,
    googleApiKey:
      overrides.googleApiKey ??
      process.env.GEMINI_API_KEY ??
      process.env.GOOGLE_API_KEY ??
      file.googleApiKey,
    dataDir: overrides.dataDir ?? process.env.TURBOMEM_DATA_DIR ?? file.dataDir ?? DEFAULT_DATA_DIR,
  };
}

/** Map the resolved CLI config to a core {@link TurboMemoryConfig}. */
export function toMemoryConfig(resolved: ResolvedConfig): TurboMemoryConfig {
  const extractionApiKey =
    resolved.extractionProvider === "anthropic"
      ? resolved.anthropicApiKey
      : resolved.extractionProvider === "google"
        ? resolved.googleApiKey
        : resolved.openaiApiKey;

  return {
    embeddings: resolved.embeddings,
    local: resolved.localModel ? { model: resolved.localModel } : undefined,
    voyage:
      resolved.embeddings === "voyage"
        ? { apiKey: resolved.voyageApiKey, model: resolved.embeddingModel }
        : undefined,
    google:
      resolved.embeddings === "google" || resolved.extractionProvider === "google"
        ? {
            apiKey: resolved.googleApiKey,
            model: resolved.embeddings === "google" ? resolved.embeddingModel : undefined,
          }
        : undefined,
    storage: "pglite",
    pglite: { dataDir: resolved.dataDir },
    extraction: {
      provider: resolved.extractionProvider,
      model: resolved.extractionModel,
      apiKey: extractionApiKey,
    },
    openai: { apiKey: resolved.openaiApiKey },
  };
}

/**
 * Validate that the credentials required by the resolved config are present,
 * returning a human-readable error message or `null` when everything is set.
 */
export function checkCredentials(resolved: ResolvedConfig): string | null {
  if (resolved.embeddings === "openai" && !resolved.openaiApiKey) {
    return "OpenAI embeddings selected but no API key found. Run `turbomem init` or set OPENAI_API_KEY.";
  }
  if (resolved.embeddings === "voyage" && !resolved.voyageApiKey) {
    return "Voyage embeddings selected but no API key found. Run `turbomem init` or set VOYAGE_API_KEY.";
  }
  if (resolved.embeddings === "google" && !resolved.googleApiKey) {
    return "Google embeddings selected but no API key found. Run `turbomem init` or set GEMINI_API_KEY.";
  }
  if (resolved.extractionProvider === "openai" && !resolved.openaiApiKey) {
    return "OpenAI extraction selected but no API key found. Run `turbomem init` or set OPENAI_API_KEY.";
  }
  if (resolved.extractionProvider === "anthropic" && !resolved.anthropicApiKey) {
    return "Anthropic extraction selected but no API key found. Run `turbomem init` or set ANTHROPIC_API_KEY.";
  }
  if (resolved.extractionProvider === "google" && !resolved.googleApiKey) {
    return "Google extraction selected but no API key found. Run `turbomem init` or set GEMINI_API_KEY.";
  }
  return null;
}

/**
 * Build and initialise a {@link TurboMemory} instance from the resolved config.
 * Throws with a friendly message if required credentials are missing.
 */
export async function buildMemory(overrides: ConfigOverrides = {}): Promise<{
  memory: TurboMemory;
  resolved: ResolvedConfig;
}> {
  const resolved = resolveConfig(overrides);
  const credentialError = checkCredentials(resolved);
  if (credentialError) throw new Error(credentialError);

  const memory = new TurboMemory(toMemoryConfig(resolved));
  await memory.init();
  return { memory, resolved };
}

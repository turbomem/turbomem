import { PGliteStorageAdapter, TurboMemory, type EmbeddingAdapter } from "turbomem";
import { HashEmbeddingAdapter } from "./embeddings/hash.js";
import {
  DEFAULT_ANSWER_MODEL,
  DEFAULT_EMBEDDING_MODEL,
  DEFAULT_EXTRACTION_MODEL,
  DEFAULT_SEARCH_LIMIT,
  type EvalConfig,
} from "./results/schema.js";
import { requireOpenAiKey } from "./openai.js";

export interface RunnerOptions {
  smoke: boolean;
  searchLimit?: number;
  extractionModel?: string;
  answerModel?: string;
  embeddingModel?: string;
  /** Cap LoCoMo questions per conversation. */
  qaLimit?: number;
  deduplication?: {
    enabled?: boolean;
    strategy?: "merge" | "replace" | "skip";
    threshold?: number;
  };
}

export interface EvalRuntime {
  memory: TurboMemory;
  config: EvalConfig;
  smoke: boolean;
  close: () => Promise<void>;
}

export function buildEvalConfig(options: RunnerOptions): EvalConfig {
  const smoke = options.smoke;
  return {
    embeddings: smoke ? "hash" : "openai",
    embeddingModel: smoke ? "hash-bow-64" : (options.embeddingModel ?? DEFAULT_EMBEDDING_MODEL),
    extractionModel: options.extractionModel ?? DEFAULT_EXTRACTION_MODEL,
    answerModel: options.answerModel ?? DEFAULT_ANSWER_MODEL,
    storage: "pglite",
    searchLimit: options.searchLimit ?? DEFAULT_SEARCH_LIMIT,
    judgeModel: smoke ? undefined : (options.extractionModel ?? DEFAULT_EXTRACTION_MODEL),
  };
}

export async function createRuntime(options: RunnerOptions): Promise<EvalRuntime> {
  const config = buildEvalConfig(options);
  let embeddings: EmbeddingAdapter | "openai";

  if (config.embeddings === "hash") {
    embeddings = new HashEmbeddingAdapter();
  } else {
    requireOpenAiKey();
    embeddings = "openai";
  }

  const apiKey = process.env.OPENAI_API_KEY ?? (config.embeddings === "hash" ? "smoke-no-key" : undefined);

  const memory = new TurboMemory({
    embeddings,
    storage: new PGliteStorageAdapter({ inMemory: true }),
    extraction: {
      provider: "openai",
      model: config.extractionModel,
      apiKey,
    },
    openai: apiKey ? { apiKey } : undefined,
    deduplication: options.deduplication ?? { enabled: true },
  });

  await memory.init();

  return {
    memory,
    config,
    smoke: options.smoke,
    close: () => memory.close(),
  };
}

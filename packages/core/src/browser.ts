/**
 * Browser-safe entry point for turbomem. Import from `turbomem/browser` in
 * client-side apps to avoid pulling in Node-only storage adapters.
 */
export { TurboMemory } from "./memory-browser.js";

export type {
  Message,
  Memory,
  MemorySearchResult,
  MemoryScope,
  EmbeddingAdapter,
  StorageAdapter,
  TurboMemoryConfig,
  ExtractionConfig,
  ExtractionProvider,
  OpenAIConfig,
  VoyageConfig,
  GoogleConfig,
} from "./types.js";
export { MessageSchema, MessagesSchema, MemoryScopeSchema } from "./types.js";

export {
  TurboMemError,
  NotInitialisedError,
  EmbeddingError,
  StorageError,
  ExtractionError,
  DimensionMismatchError,
  ConfigError,
} from "./errors.js";
export type { TurboMemErrorCode } from "./errors.js";

export {
  OpenAIEmbeddingAdapter,
  VoyageEmbeddingAdapter,
  GoogleEmbeddingAdapter,
} from "./embeddings/index.js";
export type {
  OpenAIEmbeddingOptions,
  OpenAIEmbeddingModel,
  VoyageEmbeddingOptions,
  VoyageEmbeddingModel,
  GoogleEmbeddingOptions,
} from "./embeddings/index.js";

export { PGliteStorageAdapter } from "./storage/pglite.js";
export type { PGliteStorageOptions } from "./storage/pglite.js";

export { Extractor, EXTRACTION_SYSTEM_PROMPT, parseFacts } from "./extraction/index.js";
export type { ExtractorOptions } from "./extraction/index.js";

export { cosineSimilarity } from "./utils/cosine.js";
export { chunkArray, formatTranscript } from "./utils/chunking.js";

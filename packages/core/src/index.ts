export { TurboMemory } from "./memory.js";

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
  TransformersEmbeddingAdapter,
} from "./embeddings/index.js";
export type {
  OpenAIEmbeddingOptions,
  OpenAIEmbeddingModel,
  TransformersEmbeddingOptions,
} from "./embeddings/index.js";

export { PGliteStorageAdapter } from "./storage/index.js";
export type { PGliteStorageOptions } from "./storage/index.js";

export { Extractor, EXTRACTION_SYSTEM_PROMPT, parseFacts } from "./extraction/index.js";
export type { ExtractorOptions } from "./extraction/index.js";

export { cosineSimilarity } from "./utils/cosine.js";
export { chunkArray, formatTranscript } from "./utils/chunking.js";

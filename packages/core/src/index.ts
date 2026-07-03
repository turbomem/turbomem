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
  VoyageConfig,
  GoogleConfig,
  DeduplicationConfig,
  DeduplicationStrategy,
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
  VoyageEmbeddingAdapter,
  GoogleEmbeddingAdapter,
} from "./embeddings/index.js";
export type {
  OpenAIEmbeddingOptions,
  OpenAIEmbeddingModel,
  TransformersEmbeddingOptions,
  VoyageEmbeddingOptions,
  VoyageEmbeddingModel,
  GoogleEmbeddingOptions,
} from "./embeddings/index.js";

export { PGliteStorageAdapter } from "./storage/index.js";
export type { PGliteStorageOptions } from "./storage/index.js";
export { SqliteVecStorageAdapter } from "./storage/index.js";
export type { SqliteVecStorageOptions } from "./storage/index.js";
export { UpstashVectorStorageAdapter, buildScopeFilter } from "./storage/index.js";
export type {
  UpstashVectorStorageOptions,
  UpstashMemoryMetadata,
  UpstashVectorIndex,
} from "./storage/index.js";
export { PineconeStorageAdapter, buildPineconeScopeFilter } from "./storage/index.js";
export type {
  PineconeStorageOptions,
  PineconeMemoryMetadata,
  PineconeIndexClient,
} from "./storage/index.js";

export { Extractor, EXTRACTION_SYSTEM_PROMPT, parseFacts } from "./extraction/index.js";
export type { ExtractorOptions } from "./extraction/index.js";

export {
  Merger,
  MERGE_SYSTEM_PROMPT,
  isMoreSpecific,
  specificityScore,
  resolveDeduplicationConfig,
  upsertFact,
} from "./deduplication/index.js";
export type { MergerOptions, ResolvedDeduplicationConfig } from "./deduplication/index.js";

export { cosineSimilarity } from "./utils/cosine.js";
export { chunkArray, formatTranscript } from "./utils/chunking.js";

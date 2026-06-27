import { z } from "zod";

/**
 * Input message format — matches the OpenAI/Anthropic message shape.
 */
export const MessageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const MessagesSchema = z.array(MessageSchema);

/**
 * A stored memory fact.
 */
export interface Memory {
  id: string;
  /** The extracted fact, in plain English. */
  content: string;
  /** Vector embedding of the content. */
  embedding: number[];
  userId?: string;
  agentId?: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result from {@link TurboMemory.search}.
 */
export interface MemorySearchResult {
  memory: Memory;
  /** Cosine similarity score, 0–1. */
  score: number;
}

/**
 * Scope for operations — provide at least one of userId or agentId.
 */
export interface MemoryScope {
  userId?: string;
  agentId?: string;
  sessionId?: string;
}

export const MemoryScopeSchema = z.object({
  userId: z.string().optional(),
  agentId: z.string().optional(),
  sessionId: z.string().optional(),
});

/**
 * Pluggable embedding backend.
 */
export interface EmbeddingAdapter {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
  readonly dimensions: number;
}

/**
 * Pluggable storage backend.
 */
export interface StorageAdapter {
  /**
   * Initialise the store. Receives the embedding dimensions so the underlying
   * vector column can be created with a matching size.
   */
  init(dimensions: number): Promise<void>;
  insert(memory: Omit<Memory, "id" | "createdAt" | "updatedAt">): Promise<Memory>;
  update(
    id: string,
    patch: {
      content: string;
      embedding: number[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<Memory>;
  search(embedding: number[], scope: MemoryScope, limit: number): Promise<MemorySearchResult[]>;
  getAll(scope: MemoryScope): Promise<Memory[]>;
  delete(id: string): Promise<void>;
  deleteAll(scope: MemoryScope): Promise<void>;
  /** Release any held resources (file handles, db connections). */
  close?(): Promise<void>;
}

/** Supported providers for LLM-based fact extraction. */
export type ExtractionProvider = "openai" | "anthropic" | "google";

export interface ExtractionConfig {
  provider: ExtractionProvider;
  model: string;
  apiKey?: string;
  baseURL?: string;
}

export interface OpenAIConfig {
  apiKey?: string;
  baseURL?: string;
}

/** Options for the Voyage embedding adapter. */
export interface VoyageConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  dimensions?: number;
}

/** Options for the Google (Gemini) embedding adapter. */
export interface GoogleConfig {
  apiKey?: string;
  baseURL?: string;
  model?: string;
  dimensions?: number;
}

/** How overlapping memories are handled on write. */
export type DeduplicationStrategy = "replace" | "skip" | "merge";

/** Controls semantic deduplication during {@link TurboMemory.add} / {@link TurboMemory.addFacts}. */
export interface DeduplicationConfig {
  /** Default true. Set false to always insert new rows. */
  enabled?: boolean;
  /** Cosine similarity threshold (0–1). Default 0.92. */
  threshold?: number;
  /** Default "merge". */
  strategy?: DeduplicationStrategy;
  /** Max similar memories to retrieve for merge / consolidation. Default 5. */
  mergeTopK?: number;
}

/**
 * Configuration for the {@link TurboMemory} class.
 */
export interface TurboMemoryConfig {
  embeddings: "openai" | "local" | "voyage" | "google" | EmbeddingAdapter;
  storage?: "pglite" | "sqlite-vec" | "upstash-vector" | StorageAdapter;
  extraction: ExtractionConfig;
  openai?: OpenAIConfig;
  /** Options forwarded to the Voyage embedding adapter. */
  voyage?: VoyageConfig;
  /** Options forwarded to the Google embedding adapter. */
  google?: GoogleConfig;
  pglite?: {
    /**
     * Persistence location. Defaults to `.turbomem` in `process.cwd()` on Node,
     * or `idb://turbomem` in the browser. Prefix with `idb://` for IndexedDB.
     */
    dataDir?: string;
    /** Use an in-memory database (ignores `dataDir`). Handy for tests. */
    inMemory?: boolean;
    /**
     * When true, PGlite returns before IndexedDB flushes complete. Defaults to
     * `true` for `idb://` paths.
     */
    relaxedDurability?: boolean;
  };
  sqliteVec?: {
    /** Defaults to `.turbomem.sqlite` in `process.cwd()`. */
    dbPath?: string;
    /** Use an in-memory database. Handy for tests. */
    inMemory?: boolean;
  };
  upstashVector?: {
    /** Upstash Vector REST URL. Falls back to `UPSTASH_VECTOR_REST_URL`. */
    url?: string;
    /** Upstash Vector REST token. Falls back to `UPSTASH_VECTOR_REST_TOKEN`. */
    token?: string;
    /** Optional Upstash namespace. */
    namespace?: string;
  };
  /** Options forwarded to the local (transformers) embedding adapter. */
  local?: {
    model?: string;
  };
  /** Semantic deduplication on write. Enabled by default. */
  deduplication?: DeduplicationConfig;
}

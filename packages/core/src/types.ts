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
  search(embedding: number[], scope: MemoryScope, limit: number): Promise<MemorySearchResult[]>;
  getAll(scope: MemoryScope): Promise<Memory[]>;
  delete(id: string): Promise<void>;
  deleteAll(scope: MemoryScope): Promise<void>;
  /** Release any held resources (file handles, db connections). */
  close?(): Promise<void>;
}

/** Supported providers for LLM-based fact extraction. */
export type ExtractionProvider = "openai" | "anthropic";

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

/**
 * Configuration for the {@link TurboMemory} class.
 */
export interface TurboMemoryConfig {
  embeddings: "openai" | "local" | EmbeddingAdapter;
  storage?: "pglite" | StorageAdapter;
  extraction: ExtractionConfig;
  openai?: OpenAIConfig;
  pglite?: {
    /** Defaults to `.turbomem` in `process.cwd()`. */
    dataDir?: string;
  };
  /** Options forwarded to the local (transformers) embedding adapter. */
  local?: {
    model?: string;
  };
}

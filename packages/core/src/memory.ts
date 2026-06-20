import { randomUUID } from "node:crypto";
import type {
  EmbeddingAdapter,
  Memory,
  MemoryScope,
  MemorySearchResult,
  Message,
  StorageAdapter,
  TurboMemoryConfig,
} from "./types.js";
import { MessagesSchema } from "./types.js";
import { ConfigError, NotInitialisedError } from "./errors.js";
import { OpenAIEmbeddingAdapter } from "./embeddings/openai.js";
import { TransformersEmbeddingAdapter } from "./embeddings/transformers.js";
import { PGliteStorageAdapter } from "./storage/pglite.js";
import { Extractor } from "./extraction/extractor.js";

const DEFAULT_SEARCH_LIMIT = 10;

/**
 * The single entry point for turbomem. Wires together an embedding adapter, a
 * storage adapter, and an LLM-based fact extractor.
 */
export class TurboMemory {
  private readonly embeddingAdapter: EmbeddingAdapter;
  private readonly storageAdapter: StorageAdapter;
  private readonly extractor: Extractor;
  private initialised = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: TurboMemoryConfig) {
    this.embeddingAdapter = TurboMemory.resolveEmbeddingAdapter(config);
    this.storageAdapter = TurboMemory.resolveStorageAdapter(config);
    this.extractor = new Extractor({
      config: {
        ...config.extraction,
        apiKey:
          config.extraction.apiKey ??
          (config.extraction.provider === "openai" ? config.openai?.apiKey : undefined),
        baseURL: config.extraction.baseURL ?? config.openai?.baseURL,
      },
    });
  }

  private static resolveEmbeddingAdapter(config: TurboMemoryConfig): EmbeddingAdapter {
    const { embeddings } = config;
    if (embeddings === "openai") {
      return new OpenAIEmbeddingAdapter({
        apiKey: config.openai?.apiKey,
        baseURL: config.openai?.baseURL,
      });
    }
    if (embeddings === "local") {
      return new TransformersEmbeddingAdapter({ model: config.local?.model });
    }
    if (typeof embeddings === "object" && embeddings !== null) {
      return embeddings;
    }
    throw new ConfigError(`Invalid embeddings config: ${String(embeddings)}`);
  }

  private static resolveStorageAdapter(config: TurboMemoryConfig): StorageAdapter {
    const storage = config.storage ?? "pglite";
    if (storage === "pglite") {
      return new PGliteStorageAdapter({ dataDir: config.pglite?.dataDir });
    }
    if (typeof storage === "object" && storage !== null) {
      return storage;
    }
    throw new ConfigError(`Invalid storage config: ${String(storage)}`);
  }

  /**
   * Initialise storage (run migrations, set up the vector column with the right
   * dimensions). Idempotent — calling twice is a no-op and concurrent calls
   * share a single initialisation.
   */
  async init(): Promise<void> {
    if (this.initialised) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      await this.storageAdapter.init(this.embeddingAdapter.dimensions);
      this.initialised = true;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  /**
   * Extract facts from `messages`, embed them, and persist them.
   * Returns the created {@link Memory} objects (empty if nothing memorable).
   */
  async add(messages: Message[], scope: MemoryScope): Promise<Memory[]> {
    this.assertInitialised();
    const parsed = MessagesSchema.parse(messages);

    const facts = await this.extractor.extract(parsed);
    if (facts.length === 0) return [];

    const embeddings = await this.embeddingAdapter.embedBatch(facts);

    const created: Memory[] = [];
    for (let i = 0; i < facts.length; i++) {
      const memory = await this.storageAdapter.insert({
        content: facts[i],
        embedding: embeddings[i],
        userId: scope.userId,
        agentId: scope.agentId,
        sessionId: scope.sessionId,
        metadata: {},
      });
      created.push(memory);
    }
    return created;
  }

  /**
   * Store one or more raw facts directly, bypassing LLM extraction. Useful when
   * the caller already knows exactly what to remember.
   */
  async addFacts(facts: string[], scope: MemoryScope): Promise<Memory[]> {
    this.assertInitialised();
    const cleaned = facts.map((f) => f.trim()).filter((f) => f.length > 0);
    if (cleaned.length === 0) return [];

    const embeddings = await this.embeddingAdapter.embedBatch(cleaned);
    const created: Memory[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      created.push(
        await this.storageAdapter.insert({
          content: cleaned[i],
          embedding: embeddings[i],
          userId: scope.userId,
          agentId: scope.agentId,
          sessionId: scope.sessionId,
          metadata: {},
        }),
      );
    }
    return created;
  }

  /**
   * Semantic search over stored memories, ranked by cosine similarity (highest
   * score first).
   */
  async search(
    query: string,
    scope: MemoryScope & { limit?: number },
  ): Promise<MemorySearchResult[]> {
    this.assertInitialised();
    const { limit = DEFAULT_SEARCH_LIMIT, ...rest } = scope;
    const embedding = await this.embeddingAdapter.embed(query);
    return this.storageAdapter.search(embedding, rest, limit);
  }

  /** Return every memory for the given scope (newest first). */
  async getAll(scope: MemoryScope): Promise<Memory[]> {
    this.assertInitialised();
    return this.storageAdapter.getAll(scope);
  }

  /** Delete a single memory by id. */
  async delete(id: string): Promise<void> {
    this.assertInitialised();
    return this.storageAdapter.delete(id);
  }

  /** Delete every memory matching the given scope. */
  async deleteAll(scope: MemoryScope): Promise<void> {
    this.assertInitialised();
    return this.storageAdapter.deleteAll(scope);
  }

  /** Release underlying resources (e.g. the database connection). */
  async close(): Promise<void> {
    if (this.storageAdapter.close) {
      await this.storageAdapter.close();
    }
    this.initialised = false;
  }

  /** Generate a fresh id (exposed for adapters/tests). */
  static newId(): string {
    return randomUUID();
  }

  private assertInitialised(): void {
    if (!this.initialised) {
      throw new NotInitialisedError();
    }
  }
}

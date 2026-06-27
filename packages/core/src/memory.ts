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
import { VoyageEmbeddingAdapter } from "./embeddings/voyage.js";
import { GoogleEmbeddingAdapter } from "./embeddings/google.js";
import { Extractor } from "./extraction/extractor.js";
import { Merger } from "./deduplication/merger.js";
import { resolveDeduplicationConfig } from "./deduplication/resolve-config.js";
import { upsertFact } from "./deduplication/upsert-fact.js";

const DEFAULT_SEARCH_LIMIT = 10;

/**
 * The single entry point for turbomem. Wires together an embedding adapter, a
 * storage adapter, and an LLM-based fact extractor.
 */
export class TurboMemory {
  private readonly config: TurboMemoryConfig;
  private readonly embeddingAdapter: EmbeddingAdapter;
  private storageAdapter: StorageAdapter | null = null;
  private readonly extractor: Extractor;
  private readonly merger: Merger;
  private readonly deduplicationConfig: ReturnType<typeof resolveDeduplicationConfig>;
  private initialised = false;
  private initPromise: Promise<void> | null = null;

  constructor(config: TurboMemoryConfig) {
    this.config = config;
    this.embeddingAdapter = TurboMemory.resolveEmbeddingAdapter(config);
    if (typeof config.storage === "object" && config.storage !== null) {
      this.storageAdapter = config.storage;
    }
    this.extractor = new Extractor({
      config: {
        ...config.extraction,
        apiKey: config.extraction.apiKey ?? TurboMemory.fallbackExtractionKey(config),
        baseURL: config.extraction.baseURL ?? config.openai?.baseURL,
      },
    });
    this.merger = new Merger({
      config: {
        ...config.extraction,
        apiKey: config.extraction.apiKey ?? TurboMemory.fallbackExtractionKey(config),
        baseURL: config.extraction.baseURL ?? config.openai?.baseURL,
      },
    });
    this.deduplicationConfig = resolveDeduplicationConfig(config.deduplication);
  }

  private static fallbackExtractionKey(config: TurboMemoryConfig): string | undefined {
    if (config.extraction.provider === "openai") return config.openai?.apiKey;
    if (config.extraction.provider === "google") return config.google?.apiKey;
    return undefined;
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
    if (embeddings === "voyage") {
      return new VoyageEmbeddingAdapter({
        apiKey: config.voyage?.apiKey,
        baseURL: config.voyage?.baseURL,
        model: config.voyage?.model,
        dimensions: config.voyage?.dimensions,
      });
    }
    if (embeddings === "google") {
      return new GoogleEmbeddingAdapter({
        apiKey: config.google?.apiKey,
        baseURL: config.google?.baseURL,
        model: config.google?.model,
        dimensions: config.google?.dimensions,
      });
    }
    if (typeof embeddings === "object" && embeddings !== null) {
      return embeddings;
    }
    throw new ConfigError(`Invalid embeddings config: ${String(embeddings)}`);
  }

  private async ensureStorageAdapter(): Promise<StorageAdapter> {
    if (this.storageAdapter) return this.storageAdapter;

    const storage = this.config.storage ?? "pglite";
    if (storage === "pglite") {
      const { PGliteStorageAdapter } = await import("./storage/pglite.js");
      this.storageAdapter = new PGliteStorageAdapter({
        dataDir: this.config.pglite?.dataDir,
        inMemory: this.config.pglite?.inMemory,
        relaxedDurability: this.config.pglite?.relaxedDurability,
      });
      return this.storageAdapter;
    }
    if (storage === "sqlite-vec") {
      const { SqliteVecStorageAdapter } = await import("./storage/sqlite-vec.js");
      this.storageAdapter = new SqliteVecStorageAdapter({
        dbPath: this.config.sqliteVec?.dbPath,
        inMemory: this.config.sqliteVec?.inMemory,
      });
      return this.storageAdapter;
    }
    if (storage === "upstash-vector") {
      const { UpstashVectorStorageAdapter } = await import("./storage/upstash-vector.js");
      this.storageAdapter = new UpstashVectorStorageAdapter({
        url: this.config.upstashVector?.url,
        token: this.config.upstashVector?.token,
        namespace: this.config.upstashVector?.namespace,
      });
      return this.storageAdapter;
    }
    throw new ConfigError(`Invalid storage config: ${String(storage)}`);
  }

  private requireStorageAdapter(): StorageAdapter {
    if (!this.storageAdapter) {
      throw new NotInitialisedError();
    }
    return this.storageAdapter;
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
      const adapter = await this.ensureStorageAdapter();
      await adapter.init(this.embeddingAdapter.dimensions);
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

    const storage = this.requireStorageAdapter();
    const created: Memory[] = [];
    for (let i = 0; i < facts.length; i++) {
      created.push(
        await upsertFact(
          storage,
          this.embeddingAdapter,
          this.merger,
          this.deduplicationConfig,
          facts[i],
          embeddings[i],
          scope,
        ),
      );
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
    const storage = this.requireStorageAdapter();
    const created: Memory[] = [];
    for (let i = 0; i < cleaned.length; i++) {
      created.push(
        await upsertFact(
          storage,
          this.embeddingAdapter,
          this.merger,
          this.deduplicationConfig,
          cleaned[i],
          embeddings[i],
          scope,
        ),
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
    return this.requireStorageAdapter().search(embedding, rest, limit);
  }

  /** Return every memory for the given scope (newest first). */
  async getAll(scope: MemoryScope): Promise<Memory[]> {
    this.assertInitialised();
    return this.requireStorageAdapter().getAll(scope);
  }

  /** Delete a single memory by id. */
  async delete(id: string): Promise<void> {
    this.assertInitialised();
    return this.requireStorageAdapter().delete(id);
  }

  /** Delete every memory matching the given scope. */
  async deleteAll(scope: MemoryScope): Promise<void> {
    this.assertInitialised();
    return this.requireStorageAdapter().deleteAll(scope);
  }

  /** Release underlying resources (e.g. the database connection). */
  async close(): Promise<void> {
    if (this.storageAdapter?.close) {
      await this.storageAdapter.close();
    }
    this.initialised = false;
  }

  /** Generate a fresh id (exposed for adapters/tests). */
  static newId(): string {
    return globalThis.crypto.randomUUID();
  }

  private assertInitialised(): void {
    if (!this.initialised) {
      throw new NotInitialisedError();
    }
  }
}

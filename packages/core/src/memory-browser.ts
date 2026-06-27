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
import { VoyageEmbeddingAdapter } from "./embeddings/voyage.js";
import { GoogleEmbeddingAdapter } from "./embeddings/google.js";
import { Extractor } from "./extraction/extractor.js";
import { Merger } from "./deduplication/merger.js";
import { resolveDeduplicationConfig } from "./deduplication/resolve-config.js";
import { upsertFact } from "./deduplication/upsert-fact.js";
import { PGliteStorageAdapter } from "./storage/pglite.js";

const DEFAULT_SEARCH_LIMIT = 10;

/**
 * Browser entry point for turbomem. Same API as {@link TurboMemory} but only
 * supports PGlite (IndexedDB / in-memory) or a custom {@link StorageAdapter}.
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
      throw new ConfigError(
        'embeddings: "local" is not recommended in the browser (heavy WASM cold start). Use "google" or "voyage".',
      );
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

  private ensureStorageAdapter(): StorageAdapter {
    if (this.storageAdapter) return this.storageAdapter;

    const storage = this.config.storage ?? "pglite";
    if (storage === "pglite") {
      this.storageAdapter = new PGliteStorageAdapter({
        dataDir: this.config.pglite?.dataDir,
        inMemory: this.config.pglite?.inMemory,
        relaxedDurability: this.config.pglite?.relaxedDurability,
      });
      return this.storageAdapter;
    }
    if (typeof storage === "string") {
      throw new ConfigError(
        `Storage "${storage}" is not available in the browser. Use storage: "pglite" or pass a custom StorageAdapter.`,
      );
    }
    throw new ConfigError(`Invalid storage config: ${String(storage)}`);
  }

  private requireStorageAdapter(): StorageAdapter {
    if (!this.storageAdapter) {
      throw new NotInitialisedError();
    }
    return this.storageAdapter;
  }

  async init(): Promise<void> {
    if (this.initialised) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const adapter = this.ensureStorageAdapter();
      await adapter.init(this.embeddingAdapter.dimensions);
      this.initialised = true;
    })();

    try {
      await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

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

  async search(
    query: string,
    scope: MemoryScope & { limit?: number },
  ): Promise<MemorySearchResult[]> {
    this.assertInitialised();
    const { limit = DEFAULT_SEARCH_LIMIT, ...rest } = scope;
    const embedding = await this.embeddingAdapter.embed(query);
    return this.requireStorageAdapter().search(embedding, rest, limit);
  }

  async getAll(scope: MemoryScope): Promise<Memory[]> {
    this.assertInitialised();
    return this.requireStorageAdapter().getAll(scope);
  }

  async delete(id: string): Promise<void> {
    this.assertInitialised();
    return this.requireStorageAdapter().delete(id);
  }

  async deleteAll(scope: MemoryScope): Promise<void> {
    this.assertInitialised();
    return this.requireStorageAdapter().deleteAll(scope);
  }

  async close(): Promise<void> {
    if (this.storageAdapter?.close) {
      await this.storageAdapter.close();
    }
    this.initialised = false;
  }

  static newId(): string {
    return globalThis.crypto.randomUUID();
  }

  private assertInitialised(): void {
    if (!this.initialised) {
      throw new NotInitialisedError();
    }
  }
}

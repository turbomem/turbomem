import type { Memory, MemoryScope, MemorySearchResult, StorageAdapter } from "../types.js";
import { ConfigError, DimensionMismatchError, StorageError } from "../errors.js";

export interface UpstashVectorStorageOptions {
  /** Upstash Vector REST URL. Falls back to `UPSTASH_VECTOR_REST_URL`. */
  url?: string;
  /** Upstash Vector REST token. Falls back to `UPSTASH_VECTOR_REST_TOKEN`. */
  token?: string;
  /** Optional Upstash namespace. Omit for the default namespace. */
  namespace?: string;
  /**
   * Inject a preconfigured Upstash `Index` client (for tests). When set,
   * `url` and `token` are ignored.
   */
  index?: UpstashVectorIndex;
}

/** Minimal Upstash Vector client surface used by the adapter. */
export interface UpstashVectorIndex {
  info(): Promise<{ dimension: number }>;
  upsert(
    args:
      | {
          id: string | number;
          vector: number[];
          metadata?: UpstashMemoryMetadata;
        }
      | Array<{
          id: string | number;
          vector: number[];
          metadata?: UpstashMemoryMetadata;
        }>,
    options?: { namespace?: string },
  ): Promise<string>;
  query(
    args: {
      vector: number[];
      topK: number;
      filter?: string;
      includeMetadata?: boolean;
      includeVectors?: boolean;
    },
    options?: { namespace?: string },
  ): Promise<
    Array<{
      id: string | number;
      score: number;
      vector?: number[];
      metadata?: UpstashMemoryMetadata;
    }>
  >;
  range(
    args: {
      cursor: number | string;
      limit: number;
      includeMetadata?: boolean;
      includeVectors?: boolean;
    },
    options?: { namespace?: string },
  ): Promise<{
    nextCursor: string;
    vectors: Array<{
      id: string | number;
      vector?: number[];
      metadata?: UpstashMemoryMetadata;
    }>;
  }>;
  delete(
    payload: string | number | Array<string | number> | { filter: string },
    options?: { namespace?: string },
  ): Promise<{ deleted: number }>;
}

export type UpstashMemoryMetadata = {
  content: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

const PEER_DEPS_MESSAGE =
  'storage: "upstash-vector" requires optional peer dependency `@upstash/vector`. Install it with: npm install @upstash/vector';

const RANGE_PAGE_SIZE = 100;

function escapeFilterString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function buildScopeFilter(scope: MemoryScope): string | undefined {
  const parts: string[] = [];
  if (scope.userId) {
    parts.push(`userId = "${escapeFilterString(scope.userId)}"`);
  }
  if (scope.agentId) {
    parts.push(`agentId = "${escapeFilterString(scope.agentId)}"`);
  }
  if (scope.sessionId) {
    parts.push(`sessionId = "${escapeFilterString(scope.sessionId)}"`);
  }
  return parts.length > 0 ? parts.join(" AND ") : undefined;
}

function matchesScope(
  scope: MemoryScope,
  memory: Pick<Memory, "userId" | "agentId" | "sessionId">,
): boolean {
  if (scope.userId !== undefined && memory.userId !== scope.userId) return false;
  if (scope.agentId !== undefined && memory.agentId !== scope.agentId) return false;
  if (scope.sessionId !== undefined && memory.sessionId !== scope.sessionId) return false;
  return true;
}

function metadataToMemory(id: string, vector: number[] | undefined, meta: UpstashMemoryMetadata): Memory {
  return {
    id,
    content: meta.content,
    embedding: vector ?? [],
    userId: meta.userId,
    agentId: meta.agentId,
    sessionId: meta.sessionId,
    metadata: meta.metadata ?? {},
    createdAt: new Date(meta.createdAt),
    updatedAt: new Date(meta.updatedAt),
  };
}

async function loadUpstashIndex(options: UpstashVectorStorageOptions): Promise<UpstashVectorIndex> {
  if (options.index) return options.index;

  const url = options.url ?? process.env.UPSTASH_VECTOR_REST_URL;
  const token = options.token ?? process.env.UPSTASH_VECTOR_REST_TOKEN;

  if (!url || !token) {
    throw new ConfigError(
      "Upstash Vector credentials are required. Set upstashVector.url/token or UPSTASH_VECTOR_REST_URL and UPSTASH_VECTOR_REST_TOKEN.",
    );
  }

  try {
    const { Index } = await import("@upstash/vector");
    return new Index({ url, token }) as UpstashVectorIndex;
  } catch {
    throw new ConfigError(PEER_DEPS_MESSAGE);
  }
}

export class UpstashVectorStorageAdapter implements StorageAdapter {
  private index: UpstashVectorIndex | null = null;
  private dimensions = 0;
  private readonly options: UpstashVectorStorageOptions;

  constructor(options: UpstashVectorStorageOptions = {}) {
    this.options = options;
  }

  private namespaceOptions(): { namespace?: string } {
    return this.options.namespace ? { namespace: this.options.namespace } : {};
  }

  private requireIndex(): UpstashVectorIndex {
    if (!this.index) {
      throw new StorageError("Upstash Vector storage not initialised. Call init() first.");
    }
    return this.index;
  }

  async init(dimensions: number): Promise<void> {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new StorageError(`Invalid embedding dimensions: ${dimensions}`);
    }
    this.dimensions = dimensions;

    try {
      this.index = await loadUpstashIndex(this.options);
      const info = await this.index.info();

      if (info.dimension !== dimensions) {
        throw new DimensionMismatchError(
          `Upstash Vector index was created with ${info.dimension}-dimensional vectors but the configured embedding adapter produces ${dimensions}-dimensional vectors. Create a new index with matching dimensions or use a matching embedding model.`,
        );
      }
    } catch (error) {
      if (error instanceof DimensionMismatchError) throw error;
      if (error instanceof ConfigError) throw error;
      throw new StorageError(
        `Failed to initialise Upstash Vector storage: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  async update(
    id: string,
    patch: {
      content: string;
      embedding: number[];
      metadata?: Record<string, unknown>;
    },
  ): Promise<Memory> {
    const index = this.requireIndex();
    if (patch.embedding.length !== this.dimensions) {
      throw new DimensionMismatchError(
        `Embedding has ${patch.embedding.length} dimensions but store expects ${this.dimensions}.`,
      );
    }

    const now = new Date().toISOString();
    let existingMeta: UpstashMemoryMetadata | undefined;

    try {
      let cursor: number | string = 0;
      for (;;) {
        const page = await index.range(
          { cursor, limit: RANGE_PAGE_SIZE, includeMetadata: true, includeVectors: true },
          this.namespaceOptions(),
        );
        for (const row of page.vectors) {
          if (String(row.id) === id && row.metadata) {
            existingMeta = row.metadata;
            break;
          }
        }
        if (existingMeta || !page.nextCursor || page.vectors.length === 0) break;
        cursor = page.nextCursor;
      }

      if (!existingMeta) {
        throw new StorageError(`Memory not found: ${id}`);
      }

      const metadata: UpstashMemoryMetadata = {
        content: patch.content,
        userId: existingMeta.userId,
        agentId: existingMeta.agentId,
        sessionId: existingMeta.sessionId,
        metadata: patch.metadata ?? existingMeta.metadata ?? {},
        createdAt: existingMeta.createdAt,
        updatedAt: now,
      };

      await index.upsert({ id, vector: patch.embedding, metadata }, this.namespaceOptions());
      return metadataToMemory(id, patch.embedding, metadata);
    } catch (error) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(`Failed to update memory: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async insert(memory: Omit<Memory, "id" | "createdAt" | "updatedAt">): Promise<Memory> {
    const index = this.requireIndex();
    if (memory.embedding.length !== this.dimensions) {
      throw new DimensionMismatchError(
        `Embedding has ${memory.embedding.length} dimensions but store expects ${this.dimensions}.`,
      );
    }

    const now = new Date().toISOString();
    const id = globalThis.crypto.randomUUID();
    const metadata: UpstashMemoryMetadata = {
      content: memory.content,
      userId: memory.userId,
      agentId: memory.agentId,
      sessionId: memory.sessionId,
      metadata: memory.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    };

    try {
      await index.upsert({ id, vector: memory.embedding, metadata }, this.namespaceOptions());
      return metadataToMemory(id, memory.embedding, metadata);
    } catch (error) {
      throw new StorageError(`Failed to insert memory: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async search(
    embedding: number[],
    scope: MemoryScope,
    limit: number,
  ): Promise<MemorySearchResult[]> {
    const index = this.requireIndex();
    const filter = buildScopeFilter(scope);

    try {
      const results = await index.query(
        {
          vector: embedding,
          topK: limit,
          filter,
          includeMetadata: true,
          includeVectors: true,
        },
        this.namespaceOptions(),
      );

      return results.map((row) => {
        const meta = row.metadata ?? {
          content: "",
          metadata: {},
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        };
        return {
          memory: metadataToMemory(String(row.id), row.vector, meta),
          score: row.score,
        };
      });
    } catch (error) {
      throw new StorageError(`Failed to search memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async getAll(scope: MemoryScope): Promise<Memory[]> {
    const index = this.requireIndex();

    try {
      const memories: Memory[] = [];
      let cursor: number | string = 0;

      for (;;) {
        const page = await index.range(
          {
            cursor,
            limit: RANGE_PAGE_SIZE,
            includeMetadata: true,
            includeVectors: true,
          },
          this.namespaceOptions(),
        );

        for (const row of page.vectors) {
          if (!row.metadata) continue;
          const memory = metadataToMemory(String(row.id), row.vector, row.metadata);
          if (matchesScope(scope, memory)) {
            memories.push(memory);
          }
        }

        if (!page.nextCursor || page.vectors.length === 0) break;
        cursor = page.nextCursor;
      }

      return memories.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } catch (error) {
      throw new StorageError(`Failed to list memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    const index = this.requireIndex();
    try {
      await index.delete(id, this.namespaceOptions());
    } catch (error) {
      throw new StorageError(`Failed to delete memory: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async deleteAll(scope: MemoryScope): Promise<void> {
    const index = this.requireIndex();
    if (!scope.userId && !scope.agentId && !scope.sessionId) {
      throw new StorageError(
        "deleteAll requires at least one of userId, agentId, or sessionId to avoid wiping the entire store.",
      );
    }

    const filter = buildScopeFilter(scope);
    if (!filter) {
      throw new StorageError(
        "deleteAll requires at least one of userId, agentId, or sessionId to avoid wiping the entire store.",
      );
    }

    try {
      await index.delete({ filter }, this.namespaceOptions());
    } catch (error) {
      throw new StorageError(`Failed to delete memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async close(): Promise<void> {
    this.index = null;
  }
}

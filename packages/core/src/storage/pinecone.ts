import type { Memory, MemoryScope, MemorySearchResult, StorageAdapter } from "../types.js";
import { ConfigError, DimensionMismatchError, StorageError } from "../errors.js";

export interface PineconeStorageOptions {
  /** Pinecone API key. Falls back to `PINECONE_API_KEY`. */
  apiKey?: string;
  /** Pinecone index name (used with `describeIndex` to resolve host). Falls back to `PINECONE_INDEX`. */
  index?: string;
  /** Direct index host (skips `describeIndex` lookup). Falls back to `PINECONE_INDEX_HOST`. */
  host?: string;
  /** Optional Pinecone namespace. */
  namespace?: string;
  /**
   * Inject a preconfigured Pinecone index client (for tests). When set,
   * `apiKey`, `index`, and `host` are ignored.
   */
  indexClient?: PineconeIndexClient;
}

/** Minimal Pinecone index client surface used by the adapter. */
export interface PineconeIndexClient {
  describeIndexStats(): Promise<{ dimension?: number }>;
  upsert(args: {
    records: Array<{ id: string; values: number[]; metadata?: PineconeMemoryMetadata }>;
  }): Promise<void>;
  fetch(args: { ids: string[] }): Promise<{
    records: Record<string, { id: string; values?: number[]; metadata?: PineconeMemoryMetadata } | undefined>;
  }>;
  query(args: {
    vector: number[];
    topK: number;
    filter?: Record<string, unknown>;
    includeMetadata?: boolean;
    includeValues?: boolean;
  }): Promise<{
    matches: Array<{
      id: string;
      score?: number;
      values?: number[];
      metadata?: PineconeMemoryMetadata;
    }>;
  }>;
  fetchByMetadata(args: {
    filter: Record<string, unknown>;
    limit?: number;
    paginationToken?: string;
  }): Promise<{
    records: Array<{ id: string; values?: number[]; metadata?: PineconeMemoryMetadata }>;
    pagination?: { next?: string };
  }>;
  deleteOne(args: { id: string }): Promise<void>;
  deleteMany(args: { filter: Record<string, unknown> } | { ids: string[] }): Promise<void>;
  listPaginated(args?: {
    limit?: number;
    paginationToken?: string;
  }): Promise<{
    vectors: Array<{ id: string }>;
    pagination?: { next?: string };
  }>;
}

export type PineconeMemoryMetadata = {
  content: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  /** JSON-serialised user metadata (Pinecone supports flat metadata only). */
  metadataJson: string;
  createdAt: string;
  updatedAt: string;
};

const PEER_DEPS_MESSAGE =
  'storage: "pinecone" requires optional peer dependency `@pinecone-database/pinecone`. Install it with: npm install @pinecone-database/pinecone';

const PAGE_SIZE = 100;
const FETCH_BATCH_SIZE = 100;

export function buildPineconeScopeFilter(scope: MemoryScope): Record<string, unknown> | undefined {
  const parts: Record<string, unknown>[] = [];
  if (scope.userId) {
    parts.push({ userId: { $eq: scope.userId } });
  }
  if (scope.agentId) {
    parts.push({ agentId: { $eq: scope.agentId } });
  }
  if (scope.sessionId) {
    parts.push({ sessionId: { $eq: scope.sessionId } });
  }
  if (parts.length === 0) return undefined;
  if (parts.length === 1) return parts[0];
  return { $and: parts };
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

function parseUserMetadata(metadataJson: string | undefined): Record<string, unknown> {
  if (!metadataJson) return {};
  try {
    const parsed: unknown = JSON.parse(metadataJson);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

function memoryToMetadata(
  memory: Pick<Memory, "content" | "userId" | "agentId" | "sessionId" | "metadata">,
  createdAt: string,
  updatedAt: string,
): PineconeMemoryMetadata {
  return {
    content: memory.content,
    userId: memory.userId,
    agentId: memory.agentId,
    sessionId: memory.sessionId,
    metadataJson: JSON.stringify(memory.metadata ?? {}),
    createdAt,
    updatedAt,
  };
}

function metadataToMemory(
  id: string,
  vector: number[] | undefined,
  meta: PineconeMemoryMetadata,
): Memory {
  return {
    id,
    content: meta.content,
    embedding: vector ?? [],
    userId: meta.userId,
    agentId: meta.agentId,
    sessionId: meta.sessionId,
    metadata: parseUserMetadata(meta.metadataJson),
    createdAt: new Date(meta.createdAt),
    updatedAt: new Date(meta.updatedAt),
  };
}

async function loadPineconeIndex(options: PineconeStorageOptions): Promise<PineconeIndexClient> {
  if (options.indexClient) return options.indexClient;

  const apiKey = options.apiKey ?? process.env.PINECONE_API_KEY;
  const indexName = options.index ?? process.env.PINECONE_INDEX;
  const host = options.host ?? process.env.PINECONE_INDEX_HOST;

  if (!apiKey) {
    throw new ConfigError(
      "Pinecone API key is required. Set pinecone.apiKey or PINECONE_API_KEY.",
    );
  }
  if (!indexName && !host) {
    throw new ConfigError(
      "Pinecone index name or host is required. Set pinecone.index/host or PINECONE_INDEX/PINECONE_INDEX_HOST.",
    );
  }

  try {
    const { Pinecone } = await import("@pinecone-database/pinecone");
    const pc = new Pinecone({ apiKey });

    let index: PineconeIndexClient;
    if (indexName && host) {
      index = pc.index(indexName, host) as unknown as PineconeIndexClient;
    } else if (indexName) {
      index = pc.index(indexName) as unknown as PineconeIndexClient;
    } else {
      throw new ConfigError(
        "PINECONE_INDEX is required when only PINECONE_INDEX_HOST is set.",
      );
    }

    if (options.namespace) {
      index = (index as unknown as { namespace: (ns: string) => PineconeIndexClient }).namespace(
        options.namespace,
      );
    }

    return index;
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    throw new ConfigError(PEER_DEPS_MESSAGE);
  }
}

export class PineconeStorageAdapter implements StorageAdapter {
  private index: PineconeIndexClient | null = null;
  private dimensions = 0;
  private readonly options: PineconeStorageOptions;

  constructor(options: PineconeStorageOptions = {}) {
    this.options = options;
  }

  private requireIndex(): PineconeIndexClient {
    if (!this.index) {
      throw new StorageError("Pinecone storage not initialised. Call init() first.");
    }
    return this.index;
  }

  async init(dimensions: number): Promise<void> {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new StorageError(`Invalid embedding dimensions: ${dimensions}`);
    }
    this.dimensions = dimensions;

    try {
      this.index = await loadPineconeIndex(this.options);
      const stats = await this.index.describeIndexStats();
      const indexDimension = stats.dimension;

      if (indexDimension !== undefined && indexDimension !== dimensions) {
        throw new DimensionMismatchError(
          `Pinecone index was created with ${indexDimension}-dimensional vectors but the configured embedding adapter produces ${dimensions}-dimensional vectors. Create a new index with matching dimensions or use a matching embedding model.`,
        );
      }
    } catch (error) {
      if (error instanceof DimensionMismatchError) throw error;
      if (error instanceof ConfigError) throw error;
      throw new StorageError(
        `Failed to initialise Pinecone storage: ${(error as Error).message}`,
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

    try {
      const fetched = await index.fetch({ ids: [id] });
      const existing = fetched.records[id];
      if (!existing?.metadata) {
        throw new StorageError(`Memory not found: ${id}`);
      }

      const metadata = memoryToMetadata(
        {
          content: patch.content,
          userId: existing.metadata.userId,
          agentId: existing.metadata.agentId,
          sessionId: existing.metadata.sessionId,
          metadata: patch.metadata ?? parseUserMetadata(existing.metadata.metadataJson),
        },
        existing.metadata.createdAt,
        now,
      );

      await index.upsert({ records: [{ id, values: patch.embedding, metadata }] });
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
    const metadata = memoryToMetadata(memory, now, now);

    try {
      await index.upsert({ records: [{ id, values: memory.embedding, metadata }] });
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
    const filter = buildPineconeScopeFilter(scope);

    try {
      const response = await index.query({
        vector: embedding,
        topK: limit,
        filter,
        includeMetadata: true,
        includeValues: true,
      });

      return response.matches.map((match) => {
        const meta = match.metadata ?? {
          content: "",
          metadataJson: "{}",
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        };
        return {
          memory: metadataToMemory(match.id, match.values, meta),
          score: match.score ?? 0,
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
    const filter = buildPineconeScopeFilter(scope);

    try {
      const memories: Memory[] = [];

      if (filter) {
        let paginationToken: string | undefined;
        for (;;) {
          const page = await index.fetchByMetadata({
            filter,
            limit: PAGE_SIZE,
            paginationToken,
          });
          for (const record of page.records) {
            if (!record.metadata) continue;
            memories.push(metadataToMemory(record.id, record.values, record.metadata));
          }
          if (!page.pagination?.next) break;
          paginationToken = page.pagination.next;
        }
      } else {
        let paginationToken: string | undefined;
        for (;;) {
          const page = await index.listPaginated({ limit: PAGE_SIZE, paginationToken });
          const ids = page.vectors.map((v) => v.id);

          for (let i = 0; i < ids.length; i += FETCH_BATCH_SIZE) {
            const batch = ids.slice(i, i + FETCH_BATCH_SIZE);
            if (batch.length === 0) continue;
            const fetched = await index.fetch({ ids: batch });
            for (const id of batch) {
              const record = fetched.records[id];
              if (!record?.metadata) continue;
              const memory = metadataToMemory(id, record.values, record.metadata);
              if (matchesScope(scope, memory)) {
                memories.push(memory);
              }
            }
          }

          if (!page.pagination?.next) break;
          paginationToken = page.pagination.next;
        }
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
      await index.deleteOne({ id });
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

    const filter = buildPineconeScopeFilter(scope);
    if (!filter) {
      throw new StorageError(
        "deleteAll requires at least one of userId, agentId, or sessionId to avoid wiping the entire store.",
      );
    }

    try {
      await index.deleteMany({ filter });
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

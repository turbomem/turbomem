import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite/vector";
import type { Memory, MemoryScope, MemorySearchResult, StorageAdapter } from "../types.js";
import { DimensionMismatchError, StorageError } from "../errors.js";
import { ensureDiskDirectory } from "./pglite-disk.js";

export interface PGliteStorageOptions {
  /**
   * Directory to persist the database. Defaults to `.turbomem` in
   * `process.cwd()` on Node, or `idb://turbomem` in the browser.
   *
   * Prefix with `idb://` for IndexedDB persistence in the browser.
   * Pass `"memory://"` (or set `inMemory`) for an ephemeral database.
   */
  dataDir?: string;
  /** Use an in-memory database (ignores `dataDir`). Handy for tests. */
  inMemory?: boolean;
  /**
   * When true, PGlite returns query results before IndexedDB flushes complete.
   * Defaults to `true` for `idb://` paths; otherwise `false`.
   */
  relaxedDurability?: boolean;
}

interface MemoryRow {
  id: string;
  content: string;
  embedding: string | number[];
  user_id: string | null;
  agent_id: string | null;
  session_id: string | null;
  metadata: Record<string, unknown> | string | null;
  created_at: string | Date;
  updated_at: string | Date;
  score?: number;
}

function isIndexedDbPath(dataDir: string): boolean {
  return dataDir.startsWith("idb://");
}

function defaultDataDir(): string {
  if (typeof process !== "undefined" && typeof process.cwd === "function") {
    return `${process.cwd()}/.turbomem`;
  }
  return "idb://turbomem";
}

function resolveRelaxedDurability(
  dataDir: string | undefined,
  explicit: boolean | undefined,
): boolean | undefined {
  if (explicit !== undefined) return explicit;
  if (dataDir && isIndexedDbPath(dataDir)) return true;
  return undefined;
}

function parseEmbedding(value: string | number[]): number[] {
  if (Array.isArray(value)) return value;
  // pgvector serialises as e.g. "[0.1,0.2,0.3]"
  return JSON.parse(value) as number[];
}

function parseMetadata(value: MemoryRow["metadata"]): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return value;
}

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    content: row.content,
    embedding: parseEmbedding(row.embedding),
    userId: row.user_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    metadata: parseMetadata(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export class PGliteStorageAdapter implements StorageAdapter {
  private db: PGlite | null = null;
  private dimensions = 0;
  private readonly dataDir: string | undefined;
  private readonly inMemory: boolean;
  private readonly relaxedDurability: boolean | undefined;

  constructor(options: PGliteStorageOptions = {}) {
    this.inMemory = options.inMemory ?? options.dataDir === "memory://";
    this.dataDir = this.inMemory ? undefined : (options.dataDir ?? defaultDataDir());
    this.relaxedDurability = resolveRelaxedDurability(this.dataDir, options.relaxedDurability);
  }

  async init(dimensions: number): Promise<void> {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new StorageError(`Invalid embedding dimensions: ${dimensions}`);
    }
    this.dimensions = dimensions;

    try {
      if (this.dataDir && !isIndexedDbPath(this.dataDir)) {
        await ensureDiskDirectory(this.dataDir);
      }

      const pgOptions = {
        extensions: { vector },
        ...(this.relaxedDurability !== undefined
          ? { relaxedDurability: this.relaxedDurability }
          : {}),
      };

      this.db = this.inMemory
        ? new PGlite(pgOptions)
        : new PGlite(this.dataDir!, pgOptions);

      await this.db.exec(`CREATE EXTENSION IF NOT EXISTS vector;`);

      // Track the dimension this store was created with so we can fail loudly
      // if the embedding adapter later changes.
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS turbomem_meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      const existing = await this.db.query<{ value: string }>(
        `SELECT value FROM turbomem_meta WHERE key = 'dimensions'`,
      );

      if (existing.rows.length > 0) {
        const storedDim = Number(existing.rows[0].value);
        if (storedDim !== dimensions) {
          throw new DimensionMismatchError(
            `Existing turbomem store was created with ${storedDim}-dimensional vectors but the configured embedding adapter produces ${dimensions}-dimensional vectors. Use a matching embedding model or a fresh data directory.`,
          );
        }
      }

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          content     TEXT NOT NULL,
          embedding   vector(${dimensions}),
          user_id     TEXT,
          agent_id    TEXT,
          session_id  TEXT,
          metadata    JSONB DEFAULT '{}',
          created_at  TIMESTAMPTZ DEFAULT now(),
          updated_at  TIMESTAMPTZ DEFAULT now()
        );

        CREATE INDEX IF NOT EXISTS memories_embedding_idx
          ON memories USING hnsw (embedding vector_cosine_ops);

        CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories (user_id);
        CREATE INDEX IF NOT EXISTS memories_agent_id_idx ON memories (agent_id);
      `);

      await this.db.query(
        `INSERT INTO turbomem_meta (key, value) VALUES ('dimensions', $1)
         ON CONFLICT (key) DO NOTHING`,
        [String(dimensions)],
      );
    } catch (error) {
      if (error instanceof DimensionMismatchError) throw error;
      throw new StorageError(`Failed to initialise PGlite storage: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  private requireDb(): PGlite {
    if (!this.db) {
      throw new StorageError("PGlite storage not initialised. Call init() first.");
    }
    return this.db;
  }

  async insert(memory: Omit<Memory, "id" | "createdAt" | "updatedAt">): Promise<Memory> {
    const db = this.requireDb();
    if (memory.embedding.length !== this.dimensions) {
      throw new DimensionMismatchError(
        `Embedding has ${memory.embedding.length} dimensions but store expects ${this.dimensions}.`,
      );
    }
    try {
      const result = await db.query<MemoryRow>(
        `INSERT INTO memories (content, embedding, user_id, agent_id, session_id, metadata)
         VALUES ($1, $2::vector, $3, $4, $5, $6::jsonb)
         RETURNING *`,
        [
          memory.content,
          toVectorLiteral(memory.embedding),
          memory.userId ?? null,
          memory.agentId ?? null,
          memory.sessionId ?? null,
          JSON.stringify(memory.metadata ?? {}),
        ],
      );
      return rowToMemory(result.rows[0]);
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
    const db = this.requireDb();
    try {
      const result = await db.query<MemoryRow>(
        `SELECT *, 1 - (embedding <=> $1::vector) AS score
         FROM memories
         WHERE ($2::text IS NULL OR user_id = $2)
           AND ($3::text IS NULL OR agent_id = $3)
           AND ($4::text IS NULL OR session_id = $4)
         ORDER BY embedding <=> $1::vector
         LIMIT $5`,
        [
          toVectorLiteral(embedding),
          scope.userId ?? null,
          scope.agentId ?? null,
          scope.sessionId ?? null,
          limit,
        ],
      );

      return result.rows.map((row) => ({
        memory: rowToMemory(row),
        score: typeof row.score === "number" ? row.score : Number(row.score),
      }));
    } catch (error) {
      throw new StorageError(`Failed to search memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async getAll(scope: MemoryScope): Promise<Memory[]> {
    const db = this.requireDb();
    try {
      const result = await db.query<MemoryRow>(
        `SELECT * FROM memories
         WHERE ($1::text IS NULL OR user_id = $1)
           AND ($2::text IS NULL OR agent_id = $2)
           AND ($3::text IS NULL OR session_id = $3)
         ORDER BY created_at DESC`,
        [scope.userId ?? null, scope.agentId ?? null, scope.sessionId ?? null],
      );
      return result.rows.map(rowToMemory);
    } catch (error) {
      throw new StorageError(`Failed to list memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    const db = this.requireDb();
    try {
      await db.query(`DELETE FROM memories WHERE id = $1`, [id]);
    } catch (error) {
      throw new StorageError(`Failed to delete memory: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async deleteAll(scope: MemoryScope): Promise<void> {
    const db = this.requireDb();
    if (!scope.userId && !scope.agentId && !scope.sessionId) {
      throw new StorageError(
        "deleteAll requires at least one of userId, agentId, or sessionId to avoid wiping the entire store.",
      );
    }
    try {
      await db.query(
        `DELETE FROM memories
         WHERE ($1::text IS NULL OR user_id = $1)
           AND ($2::text IS NULL OR agent_id = $2)
           AND ($3::text IS NULL OR session_id = $3)`,
        [scope.userId ?? null, scope.agentId ?? null, scope.sessionId ?? null],
      );
    } catch (error) {
      throw new StorageError(`Failed to delete memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }
}

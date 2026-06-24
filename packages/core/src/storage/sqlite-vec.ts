import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Memory, MemoryScope, MemorySearchResult, StorageAdapter } from "../types.js";
import { ConfigError, DimensionMismatchError, StorageError } from "../errors.js";

export interface SqliteVecStorageOptions {
  /**
   * Path to the SQLite database file. Defaults to `.turbomem.sqlite` in
   * `process.cwd()`.
   */
  dbPath?: string;
  /** Use an in-memory database (ignores `dbPath`). Handy for tests. */
  inMemory?: boolean;
}

interface MemoryRow {
  id: string;
  content: string;
  user_id: string | null;
  agent_id: string | null;
  session_id: string | null;
  metadata: string | null;
  created_at: string;
  updated_at: string;
  embedding?: unknown;
  score?: number;
}

type BetterSqliteDatabase = import("better-sqlite3").Database;

const PEER_DEPS_MESSAGE =
  'storage: "sqlite-vec" requires optional peer dependencies `better-sqlite3` and `sqlite-vec`. Install them with: npm install better-sqlite3 sqlite-vec';

function parseMetadata(value: string | null): Record<string, unknown> {
  if (value == null || value === "") return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseEmbedding(value: unknown): number[] {
  if (Array.isArray(value)) return value as number[];
  if (value instanceof Float32Array) return Array.from(value);
  if (value instanceof Buffer) {
    return Array.from(
      new Float32Array(value.buffer, value.byteOffset, value.byteLength / 4),
    );
  }
  if (typeof value === "string") {
    return JSON.parse(value) as number[];
  }
  throw new StorageError("Unexpected embedding format from sqlite-vec store.");
}

function toFloat32Array(embedding: number[]): Float32Array {
  return new Float32Array(embedding);
}

/** vec0 TEXT metadata columns reject NULL — use empty string for unset scope. */
function scopeText(value: string | undefined): string {
  return value ?? "";
}

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    content: row.content,
    embedding: row.embedding != null ? parseEmbedding(row.embedding) : [],
    userId: row.user_id ?? undefined,
    agentId: row.agent_id ?? undefined,
    sessionId: row.session_id ?? undefined,
    metadata: parseMetadata(row.metadata),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

async function loadSqliteDeps(): Promise<{
  Database: new (path: string) => BetterSqliteDatabase;
  sqliteVec: { load: (db: BetterSqliteDatabase) => void };
}> {
  try {
    const [betterSqlite3, sqliteVec] = await Promise.all([
      import("better-sqlite3"),
      import("sqlite-vec"),
    ]);
    return {
      Database: betterSqlite3.default,
      sqliteVec,
    };
  } catch {
    throw new ConfigError(PEER_DEPS_MESSAGE);
  }
}

export class SqliteVecStorageAdapter implements StorageAdapter {
  private db: BetterSqliteDatabase | null = null;
  private dimensions = 0;
  private readonly dbPath: string;
  private readonly inMemory: boolean;

  constructor(options: SqliteVecStorageOptions = {}) {
    this.inMemory = options.inMemory ?? false;
    this.dbPath = this.inMemory
      ? ":memory:"
      : (options.dbPath ?? join(process.cwd(), ".turbomem.sqlite"));
  }

  async init(dimensions: number): Promise<void> {
    if (!Number.isInteger(dimensions) || dimensions <= 0) {
      throw new StorageError(`Invalid embedding dimensions: ${dimensions}`);
    }
    this.dimensions = dimensions;

    try {
      const { Database, sqliteVec } = await loadSqliteDeps();

      if (!this.inMemory) {
        const dir = dirname(this.dbPath);
        if (dir !== "." && !existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }

      this.db = new Database(this.dbPath);
      sqliteVec.load(this.db);

      const db = this.requireDb();

      db.exec(`
        CREATE TABLE IF NOT EXISTS turbomem_meta (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      const existing = db
        .prepare(`SELECT value FROM turbomem_meta WHERE key = 'dimensions'`)
        .get() as { value: string } | undefined;

      if (existing != null) {
        const storedDim = Number(existing.value);
        if (storedDim !== dimensions) {
          throw new DimensionMismatchError(
            `Existing turbomem store was created with ${storedDim}-dimensional vectors but the configured embedding adapter produces ${dimensions}-dimensional vectors. Use a matching embedding model or a fresh database file.`,
          );
        }
      }

      db.exec(`
        CREATE TABLE IF NOT EXISTS memories (
          id          TEXT PRIMARY KEY,
          content     TEXT NOT NULL,
          user_id     TEXT,
          agent_id    TEXT,
          session_id  TEXT,
          metadata    TEXT DEFAULT '{}',
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS memories_user_id_idx ON memories (user_id);
        CREATE INDEX IF NOT EXISTS memories_agent_id_idx ON memories (agent_id);
        CREATE INDEX IF NOT EXISTS memories_session_id_idx ON memories (session_id);
      `);

      db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_embeddings USING vec0(
          embedding float[${dimensions}] distance_metric=cosine,
          user_id TEXT,
          agent_id TEXT,
          session_id TEXT
        );
      `);

      db.prepare(
        `INSERT INTO turbomem_meta (key, value) VALUES ('dimensions', ?)
         ON CONFLICT (key) DO NOTHING`,
      ).run(String(dimensions));
    } catch (error) {
      if (error instanceof DimensionMismatchError || error instanceof ConfigError) {
        throw error;
      }
      throw new StorageError(
        `Failed to initialise sqlite-vec storage: ${(error as Error).message}`,
        { cause: error },
      );
    }
  }

  private requireDb(): BetterSqliteDatabase {
    if (!this.db) {
      throw new StorageError("sqlite-vec storage not initialised. Call init() first.");
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
      const id = randomUUID();
      const now = new Date().toISOString();
      const metadata = JSON.stringify(memory.metadata ?? {});

      const insert = db.transaction(() => {
        const result = db
          .prepare(
            `INSERT INTO memories (id, content, user_id, agent_id, session_id, metadata, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            id,
            memory.content,
            memory.userId ?? null,
            memory.agentId ?? null,
            memory.sessionId ?? null,
            metadata,
            now,
            now,
          );

        db.prepare(
          `INSERT INTO memory_embeddings (rowid, embedding, user_id, agent_id, session_id)
           VALUES (?, ?, ?, ?, ?)`,
        ).run(
          BigInt(result.lastInsertRowid),
          toFloat32Array(memory.embedding),
          scopeText(memory.userId),
          scopeText(memory.agentId),
          scopeText(memory.sessionId),
        );

        return { id, now, metadata };
      });
      const inserted = insert();

      return {
        id: inserted.id,
        content: memory.content,
        embedding: memory.embedding,
        userId: memory.userId,
        agentId: memory.agentId,
        sessionId: memory.sessionId,
        metadata: memory.metadata ?? {},
        createdAt: new Date(inserted.now),
        updatedAt: new Date(inserted.now),
      };
    } catch (error) {
      if (error instanceof DimensionMismatchError) throw error;
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
    const k = Math.max(1, Math.floor(limit));
    try {
      const rows = db
        .prepare(
          `SELECT
             m.id,
             m.content,
             m.user_id,
             m.agent_id,
             m.session_id,
             m.metadata,
             m.created_at,
             m.updated_at,
             v.embedding,
             1 - v.distance AS score
           FROM memory_embeddings v
           JOIN memories m ON m.rowid = v.rowid
           WHERE v.embedding MATCH ?
             AND k = ${k}
             AND (? IS NULL OR v.user_id = ?)
             AND (? IS NULL OR v.agent_id = ?)
             AND (? IS NULL OR v.session_id = ?)
           ORDER BY v.distance`,
        )
        .all(
          toFloat32Array(embedding),
          scope.userId ?? null,
          scope.userId ?? null,
          scope.agentId ?? null,
          scope.agentId ?? null,
          scope.sessionId ?? null,
          scope.sessionId ?? null,
        ) as MemoryRow[];

      return rows.map((row) => ({
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
      const rows = db
        .prepare(
          `SELECT
             m.id,
             m.content,
             m.user_id,
             m.agent_id,
             m.session_id,
             m.metadata,
             m.created_at,
             m.updated_at,
             v.embedding
           FROM memories m
           JOIN memory_embeddings v ON m.rowid = v.rowid
           WHERE (? IS NULL OR m.user_id = ?)
             AND (? IS NULL OR m.agent_id = ?)
             AND (? IS NULL OR m.session_id = ?)
           ORDER BY m.created_at DESC`,
        )
        .all(
          scope.userId ?? null,
          scope.userId ?? null,
          scope.agentId ?? null,
          scope.agentId ?? null,
          scope.sessionId ?? null,
          scope.sessionId ?? null,
        ) as MemoryRow[];

      return rows.map(rowToMemory);
    } catch (error) {
      throw new StorageError(`Failed to list memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async delete(id: string): Promise<void> {
    const db = this.requireDb();
    try {
      const runDelete = db.transaction(() => {
        const row = db.prepare(`SELECT rowid FROM memories WHERE id = ?`).get(id) as
          | { rowid: number }
          | undefined;
        if (row == null) return;
        db.prepare(`DELETE FROM memory_embeddings WHERE rowid = ?`).run(row.rowid);
        db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
      });
      runDelete();
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
      const runDeleteAll = db.transaction(() => {
        db.prepare(
          `DELETE FROM memory_embeddings
           WHERE rowid IN (
             SELECT rowid FROM memories
             WHERE (? IS NULL OR user_id = ?)
               AND (? IS NULL OR agent_id = ?)
               AND (? IS NULL OR session_id = ?)
           )`,
        ).run(
          scope.userId ?? null,
          scope.userId ?? null,
          scope.agentId ?? null,
          scope.agentId ?? null,
          scope.sessionId ?? null,
          scope.sessionId ?? null,
        );

        db.prepare(
          `DELETE FROM memories
           WHERE (? IS NULL OR user_id = ?)
             AND (? IS NULL OR agent_id = ?)
             AND (? IS NULL OR session_id = ?)`,
        ).run(
          scope.userId ?? null,
          scope.userId ?? null,
          scope.agentId ?? null,
          scope.agentId ?? null,
          scope.sessionId ?? null,
          scope.sessionId ?? null,
        );
      });
      runDeleteAll();
    } catch (error) {
      throw new StorageError(`Failed to delete memories: ${(error as Error).message}`, {
        cause: error,
      });
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

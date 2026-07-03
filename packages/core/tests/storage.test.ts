import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PGliteStorageAdapter } from "../src/storage/pglite.js";
import { SqliteVecStorageAdapter } from "../src/storage/sqlite-vec.js";
import {
  UpstashVectorStorageAdapter,
  type UpstashMemoryMetadata,
  type UpstashVectorIndex,
} from "../src/storage/upstash-vector.js";
import {
  PineconeStorageAdapter,
  type PineconeMemoryMetadata,
  type PineconeIndexClient,
} from "../src/storage/pinecone.js";
import { DimensionMismatchError } from "../src/errors.js";
import type { MemoryScope } from "../src/types.js";

const DIM = 8;

/**
 * Build a deterministic non-negative vector from a seed. Real embedding models
 * return normalised vectors whose pairwise cosine similarity stays in [0, 1];
 * keeping components non-negative mirrors that here.
 */
function vec(seed: number): number[] {
  return new Array(DIM).fill(0).map((_, i) => Math.abs(Math.sin(seed + i)) + 0.01);
}

class MockUpstashIndex implements UpstashVectorIndex {
  readonly dimension: number;
  private readonly store = new Map<
    string,
    { vector: number[]; metadata: UpstashMemoryMetadata }
  >();

  constructor(dimension = DIM) {
    this.dimension = dimension;
  }

  async info(): Promise<{ dimension: number }> {
    return { dimension: this.dimension };
  }

  async upsert(
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
  ): Promise<string> {
    const items = Array.isArray(args) ? args : [args];
    for (const item of items) {
      if (!item.metadata) continue;
      this.store.set(String(item.id), { vector: item.vector, metadata: item.metadata });
    }
    return "OK";
  }

  async query(args: {
    vector: number[];
    topK: number;
    filter?: string;
    includeMetadata?: boolean;
    includeVectors?: boolean;
  }): Promise<
    Array<{
      id: string | number;
      score: number;
      vector?: number[];
      metadata?: UpstashMemoryMetadata;
    }>
  > {
    const scope = parseFilter(args.filter);
    const scored = [...this.store.entries()]
      .filter(([, row]) => matchesParsedScope(scope, row.metadata))
      .map(([id, row]) => ({
        id,
        score: cosineScore(args.vector, row.vector),
        vector: row.vector,
        metadata: row.metadata,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, args.topK);
    return scored;
  }

  async range(args: {
    cursor: number | string;
    limit: number;
    includeMetadata?: boolean;
    includeVectors?: boolean;
  }): Promise<{
    nextCursor: string;
    vectors: Array<{
      id: string | number;
      vector?: number[];
      metadata?: UpstashMemoryMetadata;
    }>;
  }> {
    const start = Number(args.cursor) || 0;
    const entries = [...this.store.entries()].slice(start, start + args.limit);
    const nextStart = start + entries.length;
    return {
      nextCursor: nextStart >= this.store.size ? "" : String(nextStart),
      vectors: entries.map(([id, row]) => ({
        id,
        vector: row.vector,
        metadata: row.metadata,
      })),
    };
  }

  async delete(
    payload: string | number | Array<string | number> | { filter: string },
  ): Promise<{ deleted: number }> {
    if (typeof payload === "object" && !Array.isArray(payload) && "filter" in payload) {
      const scope = parseFilter(payload.filter);
      let deleted = 0;
      for (const [id, row] of this.store.entries()) {
        if (matchesParsedScope(scope, row.metadata)) {
          this.store.delete(id);
          deleted++;
        }
      }
      return { deleted };
    }

    const ids = Array.isArray(payload) ? payload.map(String) : [String(payload)];
    let deleted = 0;
    for (const id of ids) {
      if (this.store.delete(id)) deleted++;
    }
    return { deleted };
  }
}

function parseFilter(filter?: string): MemoryScope {
  if (!filter) return {};
  const scope: MemoryScope = {};
  for (const part of filter.split(" AND ")) {
    const match = part.match(/^(\w+) = "(.*)"$/);
    if (!match) continue;
    const [, key, value] = match;
    const unescaped = value.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    if (key === "userId") scope.userId = unescaped;
    if (key === "agentId") scope.agentId = unescaped;
    if (key === "sessionId") scope.sessionId = unescaped;
  }
  return scope;
}

function matchesParsedScope(scope: MemoryScope, metadata: UpstashMemoryMetadata): boolean {
  if (scope.userId !== undefined && metadata.userId !== scope.userId) return false;
  if (scope.agentId !== undefined && metadata.agentId !== scope.agentId) return false;
  if (scope.sessionId !== undefined && metadata.sessionId !== scope.sessionId) return false;
  return true;
}

function cosineScore(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function parsePineconeFilter(filter: Record<string, unknown>): MemoryScope {
  const scope: MemoryScope = {};
  if ("$and" in filter && Array.isArray(filter.$and)) {
    for (const part of filter.$and) {
      Object.assign(scope, parsePineconeFilter(part as Record<string, unknown>));
    }
    return scope;
  }
  for (const [key, value] of Object.entries(filter)) {
    if (key === "userId" && value && typeof value === "object" && "$eq" in value) {
      scope.userId = String((value as { $eq: unknown }).$eq);
    }
    if (key === "agentId" && value && typeof value === "object" && "$eq" in value) {
      scope.agentId = String((value as { $eq: unknown }).$eq);
    }
    if (key === "sessionId" && value && typeof value === "object" && "$eq" in value) {
      scope.sessionId = String((value as { $eq: unknown }).$eq);
    }
  }
  return scope;
}

function matchesPineconeScope(scope: MemoryScope, metadata: PineconeMemoryMetadata): boolean {
  if (scope.userId !== undefined && metadata.userId !== scope.userId) return false;
  if (scope.agentId !== undefined && metadata.agentId !== scope.agentId) return false;
  if (scope.sessionId !== undefined && metadata.sessionId !== scope.sessionId) return false;
  return true;
}

class MockPineconeIndex implements PineconeIndexClient {
  readonly dimension: number;
  private readonly store = new Map<
    string,
    { vector: number[]; metadata: PineconeMemoryMetadata }
  >();

  constructor(dimension = DIM) {
    this.dimension = dimension;
  }

  async describeIndexStats(): Promise<{ dimension?: number }> {
    return { dimension: this.dimension };
  }

  async upsert(args: {
    records: Array<{ id: string; values: number[]; metadata?: PineconeMemoryMetadata }>;
  }): Promise<void> {
    for (const record of args.records) {
      if (!record.metadata) continue;
      this.store.set(record.id, { vector: record.values, metadata: record.metadata });
    }
  }

  async fetch(args: { ids: string[] }): Promise<{
    records: Record<string, { id: string; values?: number[]; metadata?: PineconeMemoryMetadata } | undefined>;
  }> {
    const records: Record<
      string,
      { id: string; values?: number[]; metadata?: PineconeMemoryMetadata } | undefined
    > = {};
    for (const id of args.ids) {
      const row = this.store.get(id);
      records[id] = row
        ? { id, values: row.vector, metadata: row.metadata }
        : undefined;
    }
    return { records };
  }

  async query(args: {
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
  }> {
    const scope = args.filter ? parsePineconeFilter(args.filter) : {};
    const matches = [...this.store.entries()]
      .filter(([, row]) => matchesPineconeScope(scope, row.metadata))
      .map(([id, row]) => ({
        id,
        score: cosineScore(args.vector, row.vector),
        values: row.vector,
        metadata: row.metadata,
      }))
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
      .slice(0, args.topK);
    return { matches };
  }

  async fetchByMetadata(args: {
    filter: Record<string, unknown>;
    limit?: number;
    paginationToken?: string;
  }): Promise<{
    records: Array<{ id: string; values?: number[]; metadata?: PineconeMemoryMetadata }>;
    pagination?: { next?: string };
  }> {
    const scope = parsePineconeFilter(args.filter);
    const all = [...this.store.entries()]
      .filter(([, row]) => matchesPineconeScope(scope, row.metadata))
      .map(([id, row]) => ({ id, values: row.vector, metadata: row.metadata }));
    const start = Number(args.paginationToken) || 0;
    const limit = args.limit ?? 100;
    const page = all.slice(start, start + limit);
    const nextStart = start + page.length;
    return {
      records: page,
      pagination: nextStart >= all.length ? undefined : { next: String(nextStart) },
    };
  }

  async deleteOne(args: { id: string }): Promise<void> {
    this.store.delete(args.id);
  }

  async deleteMany(args: { filter: Record<string, unknown> } | { ids: string[] }): Promise<void> {
    if ("ids" in args) {
      for (const id of args.ids) {
        this.store.delete(id);
      }
      return;
    }
    const scope = parsePineconeFilter(args.filter);
    for (const [id, row] of this.store.entries()) {
      if (matchesPineconeScope(scope, row.metadata)) {
        this.store.delete(id);
      }
    }
  }

  async listPaginated(args?: {
    limit?: number;
    paginationToken?: string;
  }): Promise<{
    vectors: Array<{ id: string }>;
    pagination?: { next?: string };
  }> {
    const start = Number(args?.paginationToken) || 0;
    const limit = args?.limit ?? 100;
    const ids = [...this.store.keys()].slice(start, start + limit);
    const nextStart = start + ids.length;
    return {
      vectors: ids.map((id) => ({ id })),
      pagination: nextStart >= this.store.size ? undefined : { next: String(nextStart) },
    };
  }
}

function runStorageAdapterTests(
  name: string,
  createStorage: () =>
    | PGliteStorageAdapter
    | SqliteVecStorageAdapter
    | UpstashVectorStorageAdapter
    | PineconeStorageAdapter,
) {
  describe(name, () => {
    let storage:
      | PGliteStorageAdapter
      | SqliteVecStorageAdapter
      | UpstashVectorStorageAdapter
      | PineconeStorageAdapter;

    beforeEach(async () => {
      storage = createStorage();
      await storage.init(DIM);
    });

    afterEach(async () => {
      await storage.close();
    });

    it("inserts and retrieves a memory", async () => {
      const inserted = await storage.insert({
        content: "The user likes pizza",
        embedding: vec(1),
        userId: "user_1",
        metadata: { source: "test" },
      });

      expect(inserted.id).toBeTruthy();
      expect(inserted.content).toBe("The user likes pizza");
      expect(inserted.embedding).toHaveLength(DIM);
      expect(inserted.createdAt).toBeInstanceOf(Date);

      const all = await storage.getAll({ userId: "user_1" });
      expect(all).toHaveLength(1);
      expect(all[0].content).toBe("The user likes pizza");
      expect(all[0].metadata).toEqual({ source: "test" });
    });

    it("search returns cosine similarity scores between 0 and 1", async () => {
      await storage.insert({ content: "a", embedding: vec(1), userId: "u", metadata: {} });
      await storage.insert({ content: "b", embedding: vec(5), userId: "u", metadata: {} });

      const results = await storage.search(vec(1), { userId: "u" }, 5);

      expect(results.length).toBeGreaterThan(0);
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
      expect(results[0].memory.content).toBe("a");
    });

    it("filters by scope correctly", async () => {
      await storage.insert({ content: "alice fact", embedding: vec(1), userId: "alice", metadata: {} });
      await storage.insert({ content: "bob fact", embedding: vec(2), userId: "bob", metadata: {} });

      const aliceResults = await storage.search(vec(1), { userId: "alice" }, 10);
      expect(aliceResults.every((r) => r.memory.userId === "alice")).toBe(true);
      expect(aliceResults.some((r) => r.memory.content === "bob fact")).toBe(false);

      const aliceAll = await storage.getAll({ userId: "alice" });
      expect(aliceAll).toHaveLength(1);
    });

    it("deleteAll removes only the scoped memories", async () => {
      await storage.insert({ content: "alice fact", embedding: vec(1), userId: "alice", metadata: {} });
      await storage.insert({ content: "bob fact", embedding: vec(2), userId: "bob", metadata: {} });

      await storage.deleteAll({ userId: "alice" });

      expect(await storage.getAll({ userId: "alice" })).toHaveLength(0);
      expect(await storage.getAll({ userId: "bob" })).toHaveLength(1);
    });

    it("rejects embeddings with the wrong dimension", async () => {
      await expect(
        storage.insert({ content: "x", embedding: [1, 2, 3], userId: "u", metadata: {} }),
      ).rejects.toBeInstanceOf(DimensionMismatchError);
    });

    it("updates content and embedding in place", async () => {
      const inserted = await storage.insert({
        content: "original fact",
        embedding: vec(1),
        userId: "user_1",
        metadata: { source: "test" },
      });

      const updated = await storage.update(inserted.id, {
        content: "updated fact",
        embedding: vec(2),
      });

      expect(updated.id).toBe(inserted.id);
      expect(updated.content).toBe("updated fact");
      expect(updated.embedding).toHaveLength(DIM);
      expect(updated.embedding[0]).toBeCloseTo(vec(2)[0], 5);
      expect(updated.createdAt.getTime()).toBe(inserted.createdAt.getTime());
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(inserted.updatedAt.getTime());

      const all = await storage.getAll({ userId: "user_1" });
      expect(all).toHaveLength(1);
      expect(all[0].content).toBe("updated fact");
    });
  });
}

describe("PGliteStorageAdapter disk persistence", () => {
  it("creates the data directory on init when using a disk path", async () => {
    const { mkdtempSync, rmSync, existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { tmpdir } = await import("node:os");

    const base = mkdtempSync(join(tmpdir(), "turbomem-pglite-"));
    const dataDir = join(base, "nested", "store");

    const storage = new PGliteStorageAdapter({ dataDir });
    try {
      await storage.init(DIM);
      expect(existsSync(dataDir)).toBe(true);
    } finally {
      await storage.close();
      rmSync(base, { recursive: true, force: true });
    }
  });
});

runStorageAdapterTests("PGliteStorageAdapter", () => new PGliteStorageAdapter({ inMemory: true }));
runStorageAdapterTests(
  "PGliteStorageAdapter (IndexedDB)",
  () =>
    new PGliteStorageAdapter({
      dataDir: `idb://turbomem-test-${crypto.randomUUID()}`,
      relaxedDurability: false,
    }),
);
runStorageAdapterTests("SqliteVecStorageAdapter", () => new SqliteVecStorageAdapter({ inMemory: true }));
runStorageAdapterTests("UpstashVectorStorageAdapter", () => {
  const index = new MockUpstashIndex();
  return new UpstashVectorStorageAdapter({ index });
});
runStorageAdapterTests("PineconeStorageAdapter", () => {
  const indexClient = new MockPineconeIndex();
  return new PineconeStorageAdapter({ indexClient });
});

describe("UpstashVectorStorageAdapter dimension guard", () => {
  it("throws DimensionMismatchError when index dimensions differ", async () => {
    const storage = new UpstashVectorStorageAdapter({ index: new MockUpstashIndex(4) });
    await expect(storage.init(DIM)).rejects.toBeInstanceOf(DimensionMismatchError);
  });
});

describe("PineconeStorageAdapter dimension guard", () => {
  it("throws DimensionMismatchError when index dimensions differ", async () => {
    const storage = new PineconeStorageAdapter({ indexClient: new MockPineconeIndex(4) });
    await expect(storage.init(DIM)).rejects.toBeInstanceOf(DimensionMismatchError);
  });
});

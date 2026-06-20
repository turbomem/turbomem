import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PGliteStorageAdapter } from "../src/storage/pglite.js";
import { DimensionMismatchError } from "../src/errors.js";

const DIM = 8;

/**
 * Build a deterministic non-negative vector from a seed. Real embedding models
 * return normalised vectors whose pairwise cosine similarity stays in [0, 1];
 * keeping components non-negative mirrors that here.
 */
function vec(seed: number): number[] {
  return new Array(DIM).fill(0).map((_, i) => Math.abs(Math.sin(seed + i)) + 0.01);
}

describe("PGliteStorageAdapter", () => {
  let storage: PGliteStorageAdapter;

  beforeEach(async () => {
    storage = new PGliteStorageAdapter({ inMemory: true });
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
    // Results are ordered by similarity (descending).
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
    // Exact match should be the top result.
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
});
